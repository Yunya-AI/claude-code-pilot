import { NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export async function POST() {
  // JWT 是无状态的，客户端删除 token 即可
  return NextResponse.json<ApiResponse>({
    success: true,
    message: "登出成功",
  });
}
