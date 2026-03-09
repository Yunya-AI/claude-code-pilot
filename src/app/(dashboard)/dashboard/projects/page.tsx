"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: "", path: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/projects?pageSize=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.items);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "获取项目列表失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        path: project.path,
        description: project.description || "",
      });
    } else {
      setEditingProject(null);
      setFormData({ name: "", path: "", description: "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("auth_token");
    setSubmitting(true);

    try {
      // 创建项目时，首先不设置 autoCreateDir，检查目录是否存在
      if (!editingProject) {
        const checkResponse = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...formData, autoCreateDir: false }),
        });

        const checkData = await checkResponse.json();

        // 如果目录不存在，询问用户是否自动创建
        if (!checkData.success && checkData.code === "DIRECTORY_NOT_FOUND") {
          const autoCreate = confirm(
            `项目目录 "${formData.path}" 不存在。\n\n是否自动创建该目录？`
          );

          if (autoCreate) {
            // 用户选择自动创建，重新提交请求
            const createResponse = await fetch("/api/projects", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ ...formData, autoCreateDir: true }),
            });

            const createData = await createResponse.json();
            if (createData.success) {
              toast({ title: createData.message || "创建成功" });
              setDialogOpen(false);
              fetchProjects();
            } else {
              toast({ variant: "destructive", title: createData.message });
            }
          }
          setSubmitting(false);
          return;
        }

        // 其他错误或成功情况
        if (checkData.success) {
          toast({ title: "创建成功" });
          setDialogOpen(false);
          fetchProjects();
        } else {
          toast({ variant: "destructive", title: checkData.message });
        }
      } else {
        // 编辑项目，不检查目录
        const url = `/api/projects/${editingProject.id}`;
        const method = "PUT";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();
        if (data.success) {
          toast({ title: "更新成功" });
          setDialogOpen(false);
          fetchProjects();
        } else {
          toast({ variant: "destructive", title: data.message });
        }
      }
    } catch (error) {
      toast({ variant: "destructive", title: "操作失败" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此项目吗？")) return;

    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "删除成功" });
        fetchProjects();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "删除失败" });
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">项目管理</h1>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-1 lg:mr-2" />
          新建项目
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">暂无项目，请点击上方按钮创建</CardContent>
        </Card>
      ) : (
        <>
          {/* 移动端卡片 */}
          <div className="space-y-3 lg:hidden">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{project.name}</h3>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(project)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-2 break-all">{project.path}</code>
                  <p className="text-sm text-gray-500">{project.description || "无描述"}</p>
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
                    <TableHead>项目名称</TableHead>
                    <TableHead>项目路径</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{project.path}</code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{project.description || "-"}</TableCell>
                      <TableCell>
                        {new Date(project.createTime).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(project)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? "编辑项目" : "新建项目"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">项目名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="path">项目路径</Label>
              <Input
                id="path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/path/to/your/project"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "处理中..." : editingProject ? "更新" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
