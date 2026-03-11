import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { stopTaskViaSocket, isTaskRunningViaSocket } from "@/lib/socket-client";
import { ApiResponse } from "@/types";

type TaskDetail = {
  id: number;
  projectId: number;
  prompt: string;
  templateId: number | null;
  status: string;
  runnerType: string;
  sessionId: string | null;
  output: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createTime: Date;
  updateTime: Date;
  project?: { id: number; name: string; path: string };
  template?: { id: number; name: string } | null;
};

async function getTask(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await prisma.task.findFirst({
    where: { id: parseInt(id, 10), status: { not: "DELETED" } },
    select: {
      id: true,
      projectId: true,
      prompt: true,
      templateId: true,
      status: true,
      runnerType: true,
      sessionId: true,
      output: true,
      startedAt: true,
      finishedAt: true,
      createTime: true,
      updateTime: true,
      project: { select: { id: true, name: true, path: true } },
      template: { select: { id: true, name: true } },
    },
  });

  if (!task) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "任务不存在", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<TaskDetail>>({
    success: true,
    message: "获取成功",
    data: task as unknown as TaskDetail,
  });
}

async function deleteTask(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = parseInt(id, 10);

    const running = await isTaskRunningViaSocket(taskId);
    if (running) {
      await stopTaskViaSocket(taskId);
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "DELETED" },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "删除成功",
    });
  } catch (error) {
    console.error("删除任务失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "删除失败", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getTask);
export const DELETE = withAuth(deleteTask);
