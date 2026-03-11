"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Square, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types";
import { XTermTerminal, XTermReplay } from "@/components/terminal/xterm-terminal";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  PENDING: "secondary",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  STOPPED: "default",
};

const statusLabels: Record<string, string> = {
  PENDING: "等待中",
  RUNNING: "运行中",
  COMPLETED: "已完成",
  FAILED: "已失败",
  STOPPED: "已停止",
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = parseInt(params.id as string, 10);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [token] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("auth_token") ?? "") : ""
  );
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [processDeadDialog, setProcessDeadDialog] = useState(false);
  const { toast } = useToast();

  const fetchTask = async () => {
    try {
      const savedToken = localStorage.getItem("auth_token");
      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const data = await response.json();
      if (data.success) {
        const fetchedTask: Task = data.data;
        setTask(fetchedTask);
        // 任务状态为 RUNNING，但进程可能已死（服务重启等情况）
        if (fetchedTask.status === "RUNNING") {
          checkProcessAlive(fetchedTask, savedToken || "");
        }
      } else {
        toast({ variant: "destructive", title: data.message });
        router.push("/dashboard/tasks");
      }
    } catch {
      toast({ variant: "destructive", title: "获取任务失败" });
    } finally {
      setLoading(false);
    }
  };

  const checkProcessAlive = async (fetchedTask: Task, savedToken: string) => {
    try {
      const res = await fetch(`/api/tasks/${fetchedTask.id}/running`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const data = await res.json();
      if (data.success && !data.data?.running) {
        // 进程已死，弹窗提示
        setProcessDeadDialog(true);
      }
    } catch {}
  };

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const handleStopTask = async () => {
    if (!confirm("确定要停止当前任务吗？停止后任务将无法恢复。")) return;
    const savedToken = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/tasks/${taskId}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "任务已停止" });
        fetchTask();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch {
      toast({ variant: "destructive", title: "停止失败" });
    }
  };

  const handleFinished = (status: string) => {
    const labels: Record<string, string> = {
      COMPLETED: "任务完成",
      FAILED: "任务失败",
      STOPPED: "任务已停止",
    };
    toast({ title: labels[status] || "任务结束" });
    fetchTask();
  };

  const handleResumeTask = async () => {
    const savedToken = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "任务已 Resume" });
        fetchTask();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch {
      toast({ variant: "destructive", title: "Resume 失败" });
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-4 lg:p-6">
        <div className="text-center py-8">任务不存在</div>
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-6">
      {/* 进程已死弹窗 */}
      <Dialog open={processDeadDialog} onOpenChange={setProcessDeadDialog}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>进程已停止</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            检测到该任务的 Claude 进程已停止运行（可能因服务重启导致）。
            {task?.sessionId ? "是否恢复会话继续执行？" : ""}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setProcessDeadDialog(false);
                fetchTask();
              }}
            >
              忽略
            </Button>
            {task?.sessionId && (
              <Button
                onClick={async () => {
                  setProcessDeadDialog(false);
                  await handleResumeTask();
                }}
              >
                恢复会话
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-3 lg:mb-6">
        <div className="flex items-center gap-2 lg:gap-4">
          <Button variant="ghost" size="sm" className="px-2" onClick={() => router.push("/dashboard/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base lg:text-2xl font-bold">#{task.id}</h1>
          <Badge variant={statusColors[task.status]}>{statusLabels[task.status]}</Badge>
        </div>
        <div className="flex gap-1.5 lg:gap-2">
          {task.status === "RUNNING" && (
            <Button variant="destructive" size="sm" onClick={handleStopTask}>
              <Square className="h-4 w-4 lg:mr-1" />
              <span className="hidden lg:inline">停止</span>
            </Button>
          )}
          {(task.status === "STOPPED" || task.status === "FAILED") && task.sessionId && (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white border-0" onClick={handleResumeTask}>
              <RotateCcw className="h-4 w-4 lg:mr-1" />
              <span className="hidden lg:inline">Resume</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchTask}>
            <RefreshCw className="h-4 w-4 lg:mr-1" />
            <span className="hidden lg:inline">刷新</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-2 lg:gap-6">
        {/* 移动端：默认隐藏，点击展开任务信息 */}
        <div className="lg:col-span-1">
          {infoExpanded && (
            <Card className="lg:hidden mb-1">
              <CardContent className="px-3 py-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">任务信息</span>
                  <button onClick={() => setInfoExpanded(false)}>
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">项目</p>
                    <p className="font-medium text-sm">{task.project?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">路径</p>
                    <code className="text-xs break-all">{task.project?.path || "-"}</code>
                  </div>
                  {task.template && (
                    <div>
                      <p className="text-xs text-gray-500">模板</p>
                      <p className="text-sm">{task.template.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">创建</p>
                    <p className="text-xs">{new Date(task.createTime).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">提示词</p>
                  <div className="bg-gray-50 rounded p-2 text-xs font-mono whitespace-pre-wrap max-h-24 overflow-auto">
                    {task.prompt}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {!infoExpanded && (
            <button
              className="lg:hidden flex items-center gap-1 text-xs text-gray-400 mb-1"
              onClick={() => setInfoExpanded(true)}
            >
              <ChevronDown className="h-3 w-3" />
              <span>展开任务信息</span>
            </button>
          )}

          {/* 桌面端完整版 */}
          <Card className="hidden lg:block">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base">任务信息</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div>
                <p className="text-sm text-gray-500">项目</p>
                <p className="font-medium">{task.project?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">项目路径</p>
                <code className="text-sm break-all">{task.project?.path || "-"}</code>
              </div>
              {task.template && (
                <div>
                  <p className="text-sm text-gray-500">模板</p>
                  <p className="font-medium">{task.template.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">创建时间</p>
                <p>{new Date(task.createTime).toLocaleString("zh-CN")}</p>
              </div>
              {task.startedAt && (
                <div>
                  <p className="text-sm text-gray-500">开始时间</p>
                  <p>{new Date(task.startedAt).toLocaleString("zh-CN")}</p>
                </div>
              )}
              {task.finishedAt && (
                <div>
                  <p className="text-sm text-gray-500">结束时间</p>
                  <p>{new Date(task.finishedAt).toLocaleString("zh-CN")}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-2">提示词</p>
                <div className="bg-gray-50 rounded p-3 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                  {task.prompt}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 终端 */}
        <div className="lg:col-span-3 min-w-0">
          {task.status === "RUNNING" && token ? (
            <XTermTerminal taskId={taskId} token={token} onFinished={handleFinished} />
          ) : task.output ? (
            <XTermReplay taskId={taskId} output={task.output} />
          ) : (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                暂无输出内容
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
