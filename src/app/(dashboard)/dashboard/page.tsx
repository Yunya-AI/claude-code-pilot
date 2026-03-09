"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, FileText, History, Play } from "lucide-react";

interface Stats {
  projectCount: number;
  templateCount: number;
  taskCount: number;
  runningCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    projectCount: 0,
    templateCount: 0,
    taskCount: 0,
    runningCount: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("auth_token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [projectsRes, templatesRes, tasksRes] = await Promise.all([
          fetch("/api/projects?pageSize=1", { headers }),
          fetch("/api/templates?pageSize=1", { headers }),
          fetch("/api/tasks?pageSize=1000", { headers }),
        ]);

        const [projects, templates, tasks] = await Promise.all([
          projectsRes.json(),
          templatesRes.json(),
          tasksRes.json(),
        ]);

        setStats({
          projectCount: projects.data?.total || 0,
          templateCount: templates.data?.total || 0,
          taskCount: tasks.data?.total || 0,
          runningCount: tasks.data?.items?.filter((t: { status: string }) => t.status === "RUNNING").length || 0,
        });
      } catch (error) {
        console.error("获取统计信息失败:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-6">控制台</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">项目数量</CardTitle>
            <FolderKanban className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projectCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">任务模板</CardTitle>
            <FileText className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.templateCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">任务总数</CardTitle>
            <History className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">运行中</CardTitle>
            <Play className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.runningCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/projects">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FolderKanban className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">项目管理</h3>
                <p className="text-sm text-gray-500">管理你的项目目录</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/templates">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">任务模板</h3>
                <p className="text-sm text-gray-500">创建和管理提示词模板</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/tasks">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">运行任务</h3>
                <p className="text-sm text-gray-500">启动新任务并查看历史</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
