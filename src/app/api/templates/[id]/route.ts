import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { ApiResponse, Template } from "@/types";

// 获取单个模板
async function getTemplate(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const template = await prisma.template.findUnique({
    where: { id: parseInt(id, 10) },
  });

  if (!template) {
    return NextResponse.json<ApiResponse>(
      { success: false, message: "模板不存在", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<Template>>({
    success: true,
    message: "获取成功",
    data: template,
  });
}

// 更新模板
const updateTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(100).optional(),
  prompt: z.string().min(1, "提示词不能为空").optional(),
  description: z.string().optional(),
});

async function updateTemplate(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    const template = await prisma.template.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    return NextResponse.json<ApiResponse<Template>>({
      success: true,
      message: "更新成功",
      data: template,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("更新模板失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "更新失败", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
}

// 删除模板
async function deleteTemplate(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await prisma.template.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "删除成功",
    });
  } catch (error) {
    console.error("删除模板失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "删除失败", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getTemplate);
export const PUT = withAuth(updateTemplate);
export const DELETE = withAuth(deleteTemplate);
