import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { ApiResponse, Project } from "@/types";

// 获取单个项目
async function getProject(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id: parseInt(id, 10) },
  });

  if (!project) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "项目不存在", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<Project>>({
    success: true,
    message: "获取成功",
    data: project,
  });
}

// 更新项目
const updateProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100).optional(),
  path: z.string().min(1, "项目路径不能为空").max(500).optional(),
  description: z.string().optional(),
});

async function updateProject(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const project = await prisma.project.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      message: "更新成功",
      data: project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("更新项目失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "更新失败", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
}

// 删除项目
async function deleteProject(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // 检查是否有关联的任务
    const taskCount = await prisma.task.count({
      where: { projectId: parseInt(id, 10) },
    });

    if (taskCount > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: "该项目下存在任务，无法删除", code: "HAS_TASKS" },
        { status: 400 }
      );
    }

    await prisma.project.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "删除成功",
    });
  } catch (error) {
    console.error("删除项目失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "删除失败", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProject);
export const PUT = withAuth(updateProject);
export const DELETE = withAuth(deleteProject);
