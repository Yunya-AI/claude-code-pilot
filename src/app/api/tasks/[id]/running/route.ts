import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { isTaskRunningViaSocket } from "@/lib/socket-client";
import { ApiResponse } from "@/types";

async function checkRunning(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const taskId = parseInt(id, 10);
  const running = await isTaskRunningViaSocket(taskId);
  return NextResponse.json<ApiResponse<{ running: boolean }>>({
    success: true,
    message: "",
    data: { running },
  });
}

export const GET = withAuth(checkRunning);
