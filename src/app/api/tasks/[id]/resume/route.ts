import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { resumeTaskViaSocket, isTaskRunningViaSocket } from "@/lib/socket-client";
import { ApiResponse } from "@/types";
import prisma from "@/lib/db";

async function resumeTask(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const taskId = parseInt(id, 10);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "任务不存在", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!task.sessionId) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "该任务没有 Session ID，无法 Resume", code: "NO_SESSION_ID" },
      { status: 400 }
    );
  }

  const running = await isTaskRunningViaSocket(taskId);
  if (running) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "任务已在运行中", code: "ALREADY_RUNNING" },
      { status: 400 }
    );
  }

  const success = await resumeTaskViaSocket(taskId);

  if (!success) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "Resume 失败", code: "RESUME_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    message: "任务已 Resume",
  });
}

export const POST = withAuth(resumeTask);
