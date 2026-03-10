"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Project, Template, RunnerType } from "@/types";

const RUNNER_TYPE_KEY = "last_runner_type";

export default function NewTaskPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [runnerType, setRunnerType] = useState<RunnerType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(RUNNER_TYPE_KEY) as RunnerType) || "CLAUDE";
    }
    return "CLAUDE";
  });
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("auth_token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [projectsRes, templatesRes] = await Promise.all([
          fetch("/api/projects?pageSize=100", { headers }),
          fetch("/api/templates?pageSize=100", { headers }),
        ]);

        const [projectsData, templatesData] = await Promise.all([
          projectsRes.json(),
          templatesRes.json(),
        ]);

        if (projectsData.success) setProjects(projectsData.data.items);
        if (templatesData.success) setTemplates(templatesData.data.items);
      } catch {
        toast({ variant: "destructive", title: "获取数据失败" });
      }
    };

    fetchData();
  }, [toast]);

  // 当选择模板时，自动填充提示词
  useEffect(() => {
    if (templateId) {
      const template = templates.find((t) => t.id === parseInt(templateId, 10));
      if (template) {
        setPrompt(template.prompt);
      }
    }
  }, [templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({ variant: "destructive", title: "请选择项目" });
      return;
    }

    if (!prompt.trim()) {
      toast({ variant: "destructive", title: "请输入提示词" });
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("auth_token");
    localStorage.setItem(RUNNER_TYPE_KEY, runnerType);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: parseInt(projectId, 10),
          prompt,
          templateId: templateId ? parseInt(templateId, 10) : undefined,
          runnerType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "任务创建成功，正在启动..." });
        router.push(`/dashboard/tasks/${data.data.id}`);
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch {
      toast({ variant: "destructive", title: "创建失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <Button variant="ghost" size="sm" className="mb-3 lg:mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回
      </Button>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>新建任务</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>选择项目 *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要执行任务的项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name} ({project.path})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-sm text-gray-500">暂无项目，请先创建项目</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>选择模板（可选）</Label>
              <Select value={templateId} onValueChange={(val) => setTemplateId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模板自动填充提示词" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用模板</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>执行引擎</Label>
              <Select value={runnerType} onValueChange={(val) => setRunnerType(val as RunnerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLAUDE">Claude Code</SelectItem>
                  <SelectItem value="CODEX">Codex</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>提示词 *</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={runnerType === "CODEX" ? "输入 Codex 要执行的提示词..." : "输入 Claude Code 要执行的提示词..."}
                className="min-h-40 font-mono"
                required
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading || projects.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                {loading ? "启动中..." : "启动任务"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
