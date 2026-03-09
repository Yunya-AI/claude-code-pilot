const SOCKET_PORT = parseInt(process.env.SOCKET_PORT || "3041", 10);
const BASE_URL = `http://127.0.0.1:${SOCKET_PORT}`;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return res.json();
}

export async function startTaskViaSocket(taskId: number): Promise<boolean> {
  try {
    console.log(`[SocketClient] 通知启动任务: taskId=${taskId}, url=${BASE_URL}/internal/tasks/start`);
    const data = await request("/internal/tasks/start", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    console.log(`[SocketClient] 启动任务响应:`, data);
    return data.success === true;
  } catch (err) {
    console.error("[SocketClient] 通知 Socket 服务启动任务失败:", err);
    return false;
  }
}

export async function stopTaskViaSocket(taskId: number): Promise<boolean> {
  try {
    const data = await request("/internal/tasks/stop", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    return data.success === true;
  } catch (err) {
    console.error("通知 Socket 服务停止任务失败:", err);
    return false;
  }
}

export async function resumeTaskViaSocket(taskId: number): Promise<boolean> {
  try {
    console.log(`[SocketClient] 通知 resume 任务: taskId=${taskId}`);
    const data = await request("/internal/tasks/resume", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    console.log(`[SocketClient] resume 任务响应:`, data);
    return data.success === true;
  } catch (err) {
    console.error("[SocketClient] 通知 Socket 服务 resume 任务失败:", err);
    return false;
  }
}

export async function isTaskRunningViaSocket(taskId: number): Promise<boolean> {
  try {
    const data = await request(`/internal/tasks/running/${taskId}`);
    return data.running === true;
  } catch {
    return false;
  }
}
