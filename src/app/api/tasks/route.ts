import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { startTaskViaSocket } from "@/lib/socket-client";
import { ApiResponse, PaginatedResponse } from "@/types";

// 任务列表项类型（用于前端展示）
type TaskListItem = {
  id: number;
  projectId: number;
  prompt: string;
  templateId: number | null;
  status: string;
  output: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createTime: Date;
  updateTime: Date;
  project?: { id: number; name: string; path: string };
  template?: { id: number; name: string } | null;
};

// 获取任务列表
async function getTasks(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { status: { not: "DELETED" } };
  if (projectId) where.projectId = parseInt(projectId, 10);
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createTime: "desc" },
      include: {
        project: { select: { id: true, name: true, path: true } },
        template: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json<ApiResponse<PaginatedResponse<TaskListItem>>>({
    success: true,
    message: "获取成功",
    data: { items: items as unknown as TaskListItem[], total, page, pageSize },
  });
}

// 创建并启动任务
const createTaskSchema = z.object({
  projectId: z.number().int().positive("项目ID无效"),
  prompt: z.string().min(1, "提示词不能为空"),
  templateId: z.number().int().positive().optional(),
  runnerType: z.enum(["CLAUDE", "CODEX"]).optional().default("CLAUDE"),
});

async function createTask(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, prompt, templateId, runnerType } = createTaskSchema.parse(body);

    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: "项目不存在", code: "PROJECT_NOT_FOUND" },
        { status: 400 }
      );
    }

    // 创建任务
    const task = await prisma.task.create({
      data: {
        projectId,
        prompt,
        templateId,
        runnerType,
        status: "PENDING",
      },
      include: {
        project: { select: { id: true, name: true, path: true } },
        template: { select: { id: true, name: true } },
      },
    });

    // 通知 Socket.io 服务启动任务
    await startTaskViaSocket(task.id);

    return NextResponse.json<ApiResponse<TaskListItem>>({
      success: true,
      message: "任务创建并启动成功",
      data: task as unknown as TaskListItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("创建任务失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "创建失败", code: "CREATE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getTasks);
export const POST = withAuth(createTask);
