import http from "http";
import { Server } from "socket.io";
import { verifySocketToken } from "../src/lib/auth";
import claudeRunner from "../src/lib/claude-runner";

const SOCKET_PORT = parseInt(process.env.SOCKET_PORT || "3041", 10);
const PORT = parseInt(process.env.PORT || "3040", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;

const httpServer = http.createServer((req, res) => {
  const url = req.url || "";

  // 只处理内部 API 请求，其他请求交给 Socket.io
  if (!url.startsWith("/internal/")) {
    return;
  }

  const body: Buffer[] = [];
  req.on("data", (chunk) => body.push(chunk));
  req.on("end", async () => {
    const method = req.method || "GET";
    res.setHeader("Content-Type", "application/json");

    try {
      if (method === "POST" && url === "/internal/tasks/start") {
        const { taskId } = JSON.parse(Buffer.concat(body).toString());
        console.log(`[内部API] 收到启动任务请求: taskId=${taskId}`);
        const success = await claudeRunner.startTask(taskId);
        console.log(`[内部API] 启动任务结果: taskId=${taskId}, success=${success}`);
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
        return;
      }

      if (method === "POST" && url === "/internal/tasks/stop") {
        const { taskId } = JSON.parse(Buffer.concat(body).toString());
        console.log(`[内部API] 收到停止任务请求: taskId=${taskId}`);
        const success = await claudeRunner.stopTask(taskId);
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
        return;
      }

      if (method === "POST" && url === "/internal/tasks/resume") {
        const { taskId } = JSON.parse(Buffer.concat(body).toString());
        console.log(`[内部API] 收到 resume 任务请求: taskId=${taskId}`);
        const success = await claudeRunner.resumeTask(taskId);
        console.log(`[内部API] resume 任务结果: taskId=${taskId}, success=${success}`);
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
        return;
      }

      if (method === "GET" && url.startsWith("/internal/tasks/running/")) {
        const taskId = parseInt(url.split("/").pop() || "0", 10);
        const running = claudeRunner.isRunning(taskId);
        res.writeHead(200);
        res.end(JSON.stringify({ running }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error("[内部API] 错误:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  });
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

claudeRunner.setIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token || !verifySocketToken(token)) {
    return next(new Error("认证失败"));
  }
  next();
});

io.on("connection", (socket) => {
  console.log(`客户端连接: ${socket.id}`);

  socket.on("join-task", (taskId: number) => {
    socket.join(`task-${taskId}`);
    console.log(`客户端 ${socket.id} 加入任务房间: task-${taskId}`);

    if (claudeRunner.isRunning(taskId)) {
      socket.emit("status", { taskId, running: true });
    }
  });

  socket.on("leave-task", (taskId: number) => {
    socket.leave(`task-${taskId}`);
  });

  socket.on("input", ({ taskId, data }: { taskId: number; data: string }) => {
    claudeRunner.sendInput(taskId, data);
  });

  socket.on("resize", ({ taskId, cols, rows }: { taskId: number; cols: number; rows: number }) => {
    claudeRunner.resize(taskId, cols, rows);
  });

  socket.on("stop-task", async (taskId: number) => {
    await claudeRunner.stopTask(taskId);
  });

  socket.on("disconnect", () => {
    console.log(`客户端断开: ${socket.id}`);
  });
});

httpServer.listen(SOCKET_PORT, () => {
  console.log(`Socket.io 服务器启动在端口 ${SOCKET_PORT}（含内部 API）`);
});
