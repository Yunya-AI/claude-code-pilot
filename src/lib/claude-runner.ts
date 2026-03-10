import * as pty from "node-pty";
import { Server as SocketServer } from "socket.io";
import { randomUUID } from "crypto";
import prisma from "./db";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

type RunnerType = "CLAUDE" | "CODEX";

// 进程管理器（支持 Claude Code 和 Codex）
class ClaudeRunner {
  private processes: Map<number, pty.IPty> = new Map();
  private io: SocketServer | null = null;
  private saveTimers: Map<number, NodeJS.Timeout> = new Map();
  private outputBuffers: Map<number, string> = new Map();
  // 记录已手动停止的任务，防止 onExit 用 FAILED 覆盖 STOPPED 状态
  private stoppedTasks: Set<number> = new Set();
  // 是否将输出持久化到数据库（SAVE_OUTPUT=false 时禁用）
  private readonly saveOutput: boolean = process.env.SAVE_OUTPUT !== "false";

  setIO(io: SocketServer) {
    this.io = io;
  }

  private scheduleSave(taskId: number) {
    if (!this.saveOutput) return;
    if (this.saveTimers.has(taskId)) return;
    const timer = setTimeout(async () => {
      this.saveTimers.delete(taskId);
      const buf = this.outputBuffers.get(taskId);
      if (buf === undefined) return;
      try {
        await prisma.task.update({
          where: { id: taskId },
          data: { output: buf, textOutput: stripAnsi(buf) },
        });
      } catch (e) {
        console.error(`[ClaudeRunner] 保存输出失败 taskId=${taskId}:`, e);
      }
    }, 2000);
    this.saveTimers.set(taskId, timer);
  }

  private buildEnv(): Record<string, string> {
    const env = { ...process.env } as Record<string, string>;
    const pathSep = process.platform === "win32" ? ";" : ":";
    const extraPaths =
      process.platform === "win32"
        ? [
            process.env.LOCALAPPDATA && process.env.LOCALAPPDATA + "\\Programs\\Python\\Python311\\Scripts",
            process.env.USERPROFILE && process.env.USERPROFILE + "\\.local\\bin",
          ].filter(Boolean) as string[]
        : ["/root/.local/bin", "/usr/local/bin", "/usr/bin", "/bin"];
    const currentPath = env.PATH || env.Path || "";
    const pathParts = currentPath.split(pathSep).filter(Boolean);
    for (const p of extraPaths) {
      if (p && !pathParts.includes(p)) pathParts.push(p);
    }
    env.PATH = pathParts.join(pathSep);
    if (process.platform !== "win32") {
      if (!env.LANG) env.LANG = "en_US.UTF-8";
      if (!env.LC_ALL) env.LC_ALL = "en_US.UTF-8";
    }
    delete env.CLAUDECODE;
    return env;
  }

  /** 从 SHELL_PATH 环境变量获取 shell 路径和参数，支持 Windows */
  private getShellConfig(): { shell: string; args: string[] } {
    const custom = process.env.SHELL_PATH;
    if (custom) {
      const lower = custom.toLowerCase();
      if (lower.includes("powershell") || lower.endsWith("pwsh.exe")) {
        return { shell: custom, args: ["-NoProfile", "-Command"] };
      }
      if (lower.includes("cmd.exe")) {
        return { shell: custom, args: ["/c"] };
      }
      if (lower.includes("zsh") || lower.includes("bash")) {
        return { shell: custom, args: ["-l", "-c"] };
      }
      return { shell: custom, args: ["-c"] };
    }
    if (process.platform === "win32") {
      return { shell: "cmd.exe", args: ["/c"] };
    }
    return { shell: "/bin/zsh", args: ["-l", "-c"] };
  }

  private spawnProcess(cmd: string, cwd: string, env: Record<string, string>): pty.IPty {
    const { shell, args } = this.getShellConfig();
    const spawnArgs = [...args, cmd];
    const ptyProcess = pty.spawn(shell, spawnArgs, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd,
      env,
    });
    console.log(`[ClaudeRunner] 进程已创建, pid=${ptyProcess.pid}`);
    return ptyProcess;
  }

  /** 构建 Claude Code 命令 */
  private buildClaudeCmd(prompt: string, sessionId: string): string {
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const allowedTools = [
      "'Bash(*)'",
      "'Read(*)'",
      "'Edit(*)'",
      "'Write(*)'",
      "'Glob(*)'",
      "'Grep(*)'",
      "'MultiEdit(*)'",
    ].join(" ");
    return `claude --session-id ${sessionId} --allowedTools ${allowedTools} -- '${escapedPrompt}'`;
  }

  /** 构建 Codex 命令 */
  private buildCodexCmd(prompt: string): string {
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    return `codex "${escapedPrompt}"`;
  }

  private attachProcess(taskId: number, ptyProcess: pty.IPty, initialOutput: string) {
    this.processes.set(taskId, ptyProcess);

    let outputBuffer = initialOutput;
    this.outputBuffers.set(taskId, outputBuffer);

    ptyProcess.onData((data) => {
      outputBuffer += data;
      this.outputBuffers.set(taskId, outputBuffer);
      this.io?.to(`task-${taskId}`).emit("output", { taskId, data });
      this.scheduleSave(taskId);
    });

    ptyProcess.onExit(async ({ exitCode }) => {
      console.log(`[ClaudeRunner] 进程退出 taskId=${taskId}, exitCode=${exitCode}`);

      const timer = this.saveTimers.get(taskId);
      if (timer) {
        clearTimeout(timer);
        this.saveTimers.delete(taskId);
      }

      if (this.stoppedTasks.has(taskId)) {
        console.log(`[ClaudeRunner] 任务 ${taskId} 已手动停止，跳过 onExit 状态更新`);
        this.stoppedTasks.delete(taskId);
        this.processes.delete(taskId);
        this.outputBuffers.delete(taskId);
        return;
      }

      const finalStatus = exitCode === 0 ? "COMPLETED" : "FAILED";

      try {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: finalStatus,
            finishedAt: new Date(),
            ...(this.saveOutput
              ? { output: outputBuffer, textOutput: stripAnsi(outputBuffer) }
              : {}),
          },
        });
      } catch (e) {
        console.error(`[ClaudeRunner] 更新任务最终状态失败 taskId=${taskId}:`, e);
      }

      this.io?.to(`task-${taskId}`).emit("finished", { taskId, status: finalStatus });

      this.processes.delete(taskId);
      this.outputBuffers.delete(taskId);
    });
  }

  async startTask(taskId: number): Promise<boolean> {
    if (this.processes.has(taskId)) {
      console.log(`[ClaudeRunner] 任务 ${taskId} 已在运行，跳过`);
      return false;
    }

    console.log(`[ClaudeRunner] 查询任务 ${taskId} 信息...`);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task || !task.project) {
      console.error(`[ClaudeRunner] 任务 ${taskId} 不存在或无关联项目`);
      return false;
    }

    const runnerType: RunnerType = (task.runnerType as RunnerType) || "CLAUDE";
    console.log(`[ClaudeRunner] 启动 ${runnerType} 进程, cwd=${task.project.path}`);

    try {
      const env = this.buildEnv();

      let cmd: string;
      let sessionId: string | undefined;

      if (runnerType === "CODEX") {
        cmd = this.buildCodexCmd(task.prompt);
      } else {
        // 生成并保存 session ID，后续可用 --resume 恢复
        sessionId = randomUUID();
        cmd = this.buildClaudeCmd(task.prompt, sessionId);
      }

      console.log(`[ClaudeRunner] 执行命令: ${cmd}`);
      console.log(`[ClaudeRunner] PATH=${env.PATH}`);

      const ptyProcess = this.spawnProcess(cmd, task.project.path, env);

      await prisma.task.update({
        where: { id: taskId },
        data: { status: "RUNNING", startedAt: new Date(), ...(sessionId ? { sessionId } : {}) },
      });

      this.attachProcess(taskId, ptyProcess, task.output || "");

      return true;
    } catch (error) {
      console.error("启动任务失败:", error);
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
        },
      });
      return false;
    }
  }

  // 发送输入到任务
  sendInput(taskId: number, data: string): boolean {
    const ptyProcess = this.processes.get(taskId);
    if (!ptyProcess) {
      return false;
    }
    ptyProcess.write(data);
    return true;
  }

  // 调整终端大小
  resize(taskId: number, cols: number, rows: number): boolean {
    const ptyProcess = this.processes.get(taskId);
    if (!ptyProcess) {
      return false;
    }
    try {
      ptyProcess.resize(cols, rows);
    } catch {
      // pty fd 可能尚未就绪或已关闭，忽略 ENOTTY
    }
    return true;
  }

  // 停止任务
  async stopTask(taskId: number): Promise<boolean> {
    const ptyProcess = this.processes.get(taskId);
    if (!ptyProcess) {
      return false;
    }

    try {
      // 先标记为已停止，防止 onExit 回调用 FAILED 覆盖状态
      this.stoppedTasks.add(taskId);
      ptyProcess.kill();

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "STOPPED",
          finishedAt: new Date(),
          ...(this.saveOutput
            ? { output: this.outputBuffers.get(taskId) || "" }
            : {}),
        },
      });

      this.io?.to(`task-${taskId}`).emit("finished", {
        taskId,
        status: "STOPPED",
      });

      this.processes.delete(taskId);
      this.outputBuffers.delete(taskId);
      const saveTimer = this.saveTimers.get(taskId);
      if (saveTimer) {
        clearTimeout(saveTimer);
        this.saveTimers.delete(taskId);
      }
      return true;
    } catch (error) {
      console.error("停止任务失败:", error);
      return false;
    }
  }

  // resume 已停止/失败的任务（用原 session ID 恢复对话上下文）
  async resumeTask(taskId: number): Promise<boolean> {
    if (this.processes.has(taskId)) {
      console.log(`[ClaudeRunner] 任务 ${taskId} 已在运行，跳过`);
      return false;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task || !task.project) {
      console.error(`[ClaudeRunner] 任务 ${taskId} 不存在或无关联项目`);
      return false;
    }

    if (!task.sessionId) {
      console.error(`[ClaudeRunner] 任务 ${taskId} 没有 sessionId，无法 resume`);
      return false;
    }

    console.log(`[ClaudeRunner] Resume 任务 ${taskId}, sessionId=${task.sessionId}`);

    try {
      const env = this.buildEnv();
      const allowedTools = [
        "'Bash(*)'",
        "'Read(*)'",
        "'Edit(*)'",
        "'Write(*)'",
        "'Glob(*)'",
        "'Grep(*)'",
        "'MultiEdit(*)'",
      ].join(" ");
      // --resume 恢复会话上下文，不需要重传 prompt
      const cmd = `claude --resume ${task.sessionId} --allowedTools ${allowedTools}`;

      console.log(`[ClaudeRunner] 执行命令: ${cmd}`);

      const ptyProcess = this.spawnProcess(cmd, task.project.path, env);

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "RUNNING",
          finishedAt: null,
        },
      });

      // resume 时保留原有输出，新输出追加在后面
      this.attachProcess(taskId, ptyProcess, task.output || "");

      return true;
    } catch (error) {
      console.error("Resume 任务失败:", error);
      return false;
    }
  }

  isRunning(taskId: number): boolean {
    return this.processes.has(taskId);
  }

  getRunningTasks(): number[] {
    return Array.from(this.processes.keys());
  }
}

// 导出单例
export const claudeRunner = new ClaudeRunner();
export default claudeRunner;
