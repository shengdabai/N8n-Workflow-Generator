import { 
  WorkflowGenerateRequest, 
  WorkflowGenerateResponse,
  TemplateListResponse,
  WorkflowTemplate,
  WorkflowExportRequest,
  WorkflowExportResponse,
  ApiResponse
} from '@/shared/types'

// 在开发模式下使用相对路径以走 Vite 代理；生产环境使用环境变量或空字符串
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '')

/**
 * API请求基础函数
 * @param endpoint API端点（例如：/api/workflow/generate）
 * @param options 请求选项
 * @returns 返回泛型 T 的 JSON 数据
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }
  
  const response = await fetch(url, { ...defaultOptions, ...options })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

/**
 * 工作流API服务
 */
export const workflowApi = {
  /**
   * 生成工作流
   * @param request 生成请求参数
   * @returns 生成工作流响应
   */
  async generate(request: WorkflowGenerateRequest): Promise<ApiResponse<WorkflowGenerateResponse>> {
    return apiRequest<ApiResponse<WorkflowGenerateResponse>>('/api/workflows/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
  
  /**
   * 导出工作流
   * @param request 导出请求参数
   * @returns 导出工作流响应
   */
  async export(request: WorkflowExportRequest): Promise<WorkflowExportResponse> {
    return apiRequest<WorkflowExportResponse>('/api/export/export', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
}

/**
 * 模板API服务
 */
export const templateApi = {
  /**
   * 获取模板列表
   * @returns 模板列表响应
   */
  async getTemplates(): Promise<TemplateListResponse> {
    return apiRequest<TemplateListResponse>('/api/templates')
  },
  
  /**
   * 创建新模板
   * @param template 模板数据
   * @returns 创建模板响应
   */
  async createTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'usageCount'>): Promise<ApiResponse<WorkflowTemplate>> {
    return apiRequest<ApiResponse<WorkflowTemplate>>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    })
  },
  
  /**
   * 删除模板
   * @param templateId 模板ID
   * @returns 删除模板响应
   */
  async deleteTemplate(templateId: string): Promise<ApiResponse> {
    return apiRequest<ApiResponse>(`/api/templates/${templateId}`, {
      method: 'DELETE',
    })
  }
}

/**
 * 健康检查API
 */
export const healthApi = {
  /**
   * 检查服务器状态
   * @returns 简化的健康状态对象
   */
  async check(): Promise<{ status: string; timestamp: string }> {
    return apiRequest<{ status: string; timestamp: string }>('/api/health')
  }
}
