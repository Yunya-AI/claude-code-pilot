import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { stopTaskViaSocket, isTaskRunningViaSocket } from "@/lib/socket-client";
import { ApiResponse } from "@/types";

async function stopTask(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const taskId = parseInt(id, 10);

  const running = await isTaskRunningViaSocket(taskId);
  if (!running) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "任务未在运行", code: "NOT_RUNNING" },
      { status: 400 }
    );
  }

  const success = await stopTaskViaSocket(taskId);

  if (!success) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "停止失败", code: "STOP_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    message: "任务已停止",
  });
}

export const POST = withAuth(stopTask);
