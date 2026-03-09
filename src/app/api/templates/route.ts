import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { ApiResponse, PaginatedResponse, Template } from "@/types";

// 获取模板列表
async function getTemplates(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  const [total, items] = await Promise.all([
    prisma.template.count(),
    prisma.template.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createTime: "desc" },
    }),
  ]);

  return NextResponse.json<ApiResponse<PaginatedResponse<Template>>>({
    success: true,
    message: "获取成功",
    data: { items, total, page, pageSize },
  });
}

// 创建模板
const createTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(100),
  prompt: z.string().min(1, "提示词不能为空"),
  description: z.string().optional(),
});

async function createTemplate(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, prompt, description } = createTemplateSchema.parse(body);

    const template = await prisma.template.create({
      data: { name, prompt, description },
    });

    return NextResponse.json<ApiResponse<Template>>({
      success: true,
      message: "创建成功",
      data: template,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("创建模板失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "创建失败", code: "CREATE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getTemplates);
export const POST = withAuth(createTemplate);
