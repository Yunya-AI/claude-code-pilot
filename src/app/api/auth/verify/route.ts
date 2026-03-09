import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { ApiResponse } from "@/types";

async function handler(request: NextRequest) {
  return NextResponse.json<ApiResponse<{ valid: boolean }>>({
    success: true,
    message: "Token 有效",
    data: { valid: true },
  });
}

export const GET = withAuth(handler);
