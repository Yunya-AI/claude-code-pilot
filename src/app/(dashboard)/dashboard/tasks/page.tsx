"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, Square, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Task, Project, Template } from "@/types";

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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const router = useRouter();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [tasksRes, projectsRes, templatesRes] = await Promise.all([
        fetch(`/api/tasks?pageSize=100${filterStatus !== "all" ? `&status=${filterStatus}` : ""}`, { headers }),
        fetch("/api/projects?pageSize=100", { headers }),
        fetch("/api/templates?pageSize=100", { headers }),
      ]);

      const [tasksData, projectsData, templatesData] = await Promise.all([
        tasksRes.json(),
        projectsRes.json(),
        templatesRes.json(),
      ]);

      if (tasksData.success) setTasks(tasksData.data.items);
      if (projectsData.success) setProjects(projectsData.data.items);
      if (templatesData.success) setTemplates(templatesData.data.items);
    } catch (error) {
      toast({ variant: "destructive", title: "获取数据失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const handleStopTask = async (taskId: number) => {
    if (!confirm("确定要停止当前任务吗？停止后任务将无法恢复。")) return;
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/tasks/${taskId}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "任务已停止" });
        fetchData();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch {
      toast({ variant: "destructive", title: "停止失败" });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("确定要删除此任务吗？")) return;

    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "删除成功" });
        fetchData();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch {
      toast({ variant: "destructive", title: "删除失败" });
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">任务记录</h1>
        <Link href="/dashboard/tasks/new">
          <Button size="sm" className="lg:size-default">
            <Plus className="h-4 w-4 mr-1 lg:mr-2" />
            <span className="hidden sm:inline">新建任务</span>
            <span className="sm:hidden">新建</span>
          </Button>
        </Link>
      </div>

      <div className="mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 lg:w-40">
            <SelectValue placeholder="筛选状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="PENDING">等待中</SelectItem>
            <SelectItem value="RUNNING">运行中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">已失败</SelectItem>
            <SelectItem value="STOPPED">已停止</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            暂无任务记录，请点击上方按钮创建新任务
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 移动端卡片列表 */}
          <div className="space-y-3 lg:hidden">
            {tasks.map((task) => (
              <Card key={task.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">#{task.id}</span>
                      <Badge variant={statusColors[task.status]}>
                        {statusLabels[task.status]}
                      </Badge>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {task.status === "RUNNING" && (
                        <Button variant="ghost" size="sm" onClick={() => handleStopTask(task.id)}>
                          <Square className="h-4 w-4 text-orange-500" />
                        </Button>
                      )}
                      {task.status !== "RUNNING" && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2 mb-2">{task.prompt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{task.project?.name || "-"}</span>
                    <span>{new Date(task.createTime).toLocaleString("zh-CN")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 桌面端表格 */}
          <Card className="hidden lg:block">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>提示词</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>#{task.id}</TableCell>
                      <TableCell>{task.project?.name || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.prompt}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[task.status]}>
                          {statusLabels[task.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(task.createTime).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {task.status === "RUNNING" && (
                          <Button variant="ghost" size="sm" onClick={() => handleStopTask(task.id)}>
                            <Square className="h-4 w-4 text-orange-500" />
                          </Button>
                        )}
                        {task.status !== "RUNNING" && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
