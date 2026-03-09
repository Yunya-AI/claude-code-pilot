import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? "admin123";

// 生成 JWT Token
export function generateToken(): string {
  return jwt.sign({ role: "admin", iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

// 验证 JWT Token
export function verifyToken(token: string): { valid: boolean; payload?: jwt.JwtPayload } {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

// 验证密码
export function verifyPassword(password: string): boolean {
  if (!AUTH_PASSWORD || AUTH_PASSWORD === "") return true;
  return password === AUTH_PASSWORD;
}

// 从请求中获取 Token
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

// 认证中间件
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: "未登录", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { valid } = verifyToken(token);
    if (!valid) {
      return NextResponse.json<ApiResponse>(
        { success: false, message: "Token 无效或已过期", code: "TOKEN_INVALID" },
        { status: 401 }
      );
    }

    return handler(request, context);
  };
}

// 验证 WebSocket 连接的 Token
export function verifySocketToken(token: string): boolean {
  const { valid } = verifyToken(token);
  return valid;
}
