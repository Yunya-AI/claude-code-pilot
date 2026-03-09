import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateToken, verifyPassword } from "@/lib/auth";
import { ApiResponse } from "@/types";

const loginSchema = z.object({
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = loginSchema.parse(body);

    if (!verifyPassword(password)) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: "密码错误", code: "INVALID_PASSWORD" },
        { status: 401 }
      );
    }

    const token = generateToken();

    return NextResponse.json<ApiResponse<{ token: string }>>({
      success: true,
      message: "登录成功",
      data: { token },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: error.errors[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    console.error("登录失败:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: "服务器错误", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
