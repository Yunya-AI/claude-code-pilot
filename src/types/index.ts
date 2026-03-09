// 项目类型
export interface Project {
  id: number;
  name: string;
  path: string;
  description: string | null;
  createTime: Date;
  updateTime: Date;
}

// 任务状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED' | 'DELETED';

// 任务类型
export interface Task {
  id: number;
  projectId: number;
  prompt: string;
  templateId: number | null;
  status: TaskStatus;
  sessionId: string | null;
  output: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createTime: Date;
  updateTime: Date;
  project?: Project;
  template?: Template;
}

// 模板类型
export interface Template {
  id: number;
  name: string;
  prompt: string;
  description: string | null;
  createTime: Date;
  updateTime: Date;
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
