import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { ApiResponse, PaginatedResponse, Project } from "@/types";
import { promises as fs } from "fs";
import path from "path";

// 检查目录是否存在
async function checkDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// 创建目录（包括父目录）
async function createDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// 获取项目列表
async function getProjects(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

  const [total, items] = await Promise.all([
    prisma.project.count(),
    prisma.project.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createTime: "desc" },
    }),
  ]);

  return NextResponse.json<ApiResponse<PaginatedResponse<Project>>>({
    success: true,
    message: "获取成功",
    data: { items, total, page, pageSize },
  });
}

// 创建项目
const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100),
  path: z.string().min(1, "项目路径不能为空").max(500),
  description: z.string().optional(),
  autoCreateDir: z.boolean().optional().default(false),
});

async function createProject(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, path, description, autoCreateDir } = createProjectSchema.parse(body);

    // 检查目录是否存在
    const dirExists = await checkDirectoryExists(path);

    if (!dirExists) {
      if (!autoCreateDir) {
        // 目录不存在且用户未选择自动创建
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            message: "项目目录不存在",
            code: "DIRECTORY_NOT_FOUND",
            data: { path, dirExists: false },
          },
          { status: 400 }
        );
      }
      // 自动创建目录
      const created = await createDirectory(path);
      if (!created) {
        return NextResponse.json<ApiResponse>(
          { success: false, message: "目录创建失败", code: "DIRECTORY_CREATE_FAILED" },
          { status: 500 }
        );
      }
    }

    const project = await prisma.project.create({
      data: { name, path, description },
    });

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      message: dirExists ? "创建成功" : "目录已自动创建",
      data: project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("创建项目失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "创建失败", code: "CREATE_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProjects);
export const POST = withAuth(createProject);
