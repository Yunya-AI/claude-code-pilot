import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { ApiResponse } from "@/types";

// 获取任务输出
async function getTaskOutput(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await prisma.task.findUnique({
    where: { id: parseInt(id, 10) },
    select: { id: true, output: true, status: true },
  });

  if (!task) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "任务不存在", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<{ output: string | null; status: string }>>({
    success: true,
    message: "获取成功",
    data: { output: task.output, status: task.status },
  });
}

export const GET = withAuth(getTaskOutput);
