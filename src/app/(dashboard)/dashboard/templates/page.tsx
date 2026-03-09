"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Template } from "@/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({ name: "", prompt: "", description: "" });
  const { toast } = useToast();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/templates?pageSize=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data.items);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "获取模板列表失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        prompt: template.prompt,
        description: template.description || "",
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: "", prompt: "", description: "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("auth_token");

    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

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
        toast({ title: editingTemplate ? "更新成功" : "创建成功" });
        setDialogOpen(false);
        fetchTemplates();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "操作失败" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此模板吗？")) return;

    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "删除成功" });
        fetchTemplates();
      } else {
        toast({ variant: "destructive", title: data.message });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "删除失败" });
    }
  };

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({ title: "已复制到剪贴板" });
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">任务模板</h1>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-1 lg:mr-2" />
          新建模板
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            暂无模板，请点击上方按钮创建
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(template.prompt)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(template)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-3">{template.description || "无描述"}</p>
                <div className="bg-gray-50 rounded p-3 text-sm font-mono whitespace-pre-wrap max-h-32 overflow-hidden">
                  {template.prompt}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "编辑模板" : "新建模板"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">模板名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：代码审查"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt">提示词</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="输入 Claude Code 要执行的提示词..."
                className="min-h-32 font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述这个模板的用途"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">{editingTemplate ? "更新" : "创建"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
