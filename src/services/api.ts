// API服务模块 - 提供与后端API的交互功能
import type { N8nWorkflow, WorkflowGenerateResponse } from '../types/workflow';

// 兼容性类型定义
export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: unknown[];
  connections: unknown[];
  createdAt: string;
  updatedAt: string;
}

// 模板接口定义
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Workflow;
  tags: string[];
  createdAt: string;
  usageCount: number;
}

// 生成请求接口
export interface GenerateRequest {
  description: string;
}

// 生成响应接口
export interface GenerateResponse {
  workflow: N8nWorkflow;
  success: boolean;
  message?: string;
}

const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');

// 智能节点推荐请求接口
export interface NodeRecommendationRequest {
  description: string;
  context?: string;
  requirements?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  existingNodes?: string[];
  limit?: number;
  maxResults?: number;
}

// 智能节点推荐响应接口
export interface NodeRecommendation {
  nodeType: string;
  name: string;
  description: string;
  confidence: number;
  category: string;
  parameters?: Record<string, unknown>;
}

// 提示工程请求接口
export interface PromptOptimizationRequest {
  description: string;
  context?: string;
  requirements?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
}

// 工作流建议请求接口
export interface WorkflowSuggestionRequest {
  description: string;
  existingNodes?: string[];
}
export interface WorkflowSuggestion {
  description?: string;
  requirements?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  steps?: string[];
}

// 节点配置建议请求接口
export interface NodeConfigRequest {
  nodeType: string;
  context?: string;
}

// 参数推理请求接口
export interface ParameterInferenceRequest {
  nodeType: string;
  context?: string;
  workflowDescription?: string;
  existingNodes?: string[];
  userInput?: Record<string, unknown>;
}

// 参数推荐响应接口
export interface ParameterRecommendation {
  parameter: string;
  value: unknown;
  confidence: number;
  reasoning: string;
  alternatives?: Array<{
    value: unknown;
    confidence: number;
    reasoning: string;
  }>;
}

// 参数推理响应接口
export interface ParameterInferenceResponse {
  nodeType: string;
  recommendations: ParameterRecommendation[];
  metadata: {
    totalParameters: number;
    inferredParameters: number;
    confidence: number;
  };
}

// 增强工作流生成请求接口
export interface EnhancedGenerateRequest {
  description: string;
  context?: string;
  requirements?: string[];
  complexity: 'simple' | 'medium' | 'complex';
  useEnhancedPrompt: boolean;
  preferredNodes?: string[];
}

/**
 * 生成工作流
 * @param description 工作流的自然语言描述
 * @returns 返回后端的标准数据对象，包含 workflow 与 meta
 */
export async function generateWorkflow(description: string): Promise<WorkflowGenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      // 尝试解析错误响应
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        // 如果无法解析错误响应，使用默认错误消息
        console.warn('无法解析错误响应:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // 验证响应数据结构
    if (!result.success) {
      throw new Error(result.message || '工作流生成失败');
    }
    
    if (!result.data || !result.data.workflow) {
      throw new Error('服务器返回的数据格式不正确');
    }

    return result.data;
  } catch (error) {
    console.error('生成工作流失败:', error);
    throw error;
  }
}

/**
 * 获取所有模板
 * @returns 模板列表
 */
export async function getTemplates(): Promise<Template[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/templates`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取模板失败:', error);
    // 返回模拟数据
    return [
      {
        id: '1',
        name: '数据同步工作流',
        description: '从API获取数据并同步到数据库',
        category: '数据处理',
        workflow: {
          id: '1',
          name: '数据同步工作流',
          description: '从API获取数据并同步到数据库',
          nodes: [],
          connections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        tags: ['API', '数据库', '同步'],
        createdAt: new Date().toISOString(),
        usageCount: 25,
      },
      {
        id: '2',
        name: '邮件通知工作流',
        description: '监控系统状态并发送邮件通知',
        category: '通知',
        workflow: {
          id: '2',
          name: '邮件通知工作流',
          description: '监控系统状态并发送邮件通知',
          nodes: [],
          connections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        tags: ['邮件', '监控', '通知'],
        createdAt: new Date().toISOString(),
        usageCount: 18,
      },
    ];
  }
}

/**
 * 根据ID获取模板
 * @param id 模板ID
 * @returns 模板详情或null
 */
export async function getTemplateById(id: string): Promise<Template | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/templates/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return null;
  }
}

/**
 * 使用模板创建工作流
 * @param templateId 模板ID
 * @returns 新工作流
 */
export async function useTemplate(templateId: string): Promise<Workflow> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflow/templates/${templateId}/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('使用模板失败:', error);
    throw error;
  }
}

/**
 * 保存工作流
 * @param workflow 工作流对象
 * @returns 保存结果
 */
export async function saveWorkflow(workflow: Workflow): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflow/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('保存工作流失败:', error);
    return { success: false, message: '保存失败，请重试' };
  }
}

/**
 * 增强工作流生成（使用提示工程）
 * @param request 增强生成请求参数
 * @returns 返回后端的标准数据对象，包含 workflow 与 meta
 */
export async function generateEnhancedWorkflow(request: EnhancedGenerateRequest): Promise<WorkflowGenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        console.warn('无法解析错误响应:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '工作流生成失败');
    }
    
    if (!result.data || !result.data.workflow) {
      throw new Error('服务器返回的数据格式不正确');
    }

    return result.data;
  } catch (error) {
    console.error('增强工作流生成失败:', error);
    throw error;
  }
}

/**
 * 获取智能节点推荐
 * @param request 节点推荐请求参数
 * @returns 推荐的节点列表
 */
export async function getNodeRecommendations(request: NodeRecommendationRequest): Promise<NodeRecommendation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows/recommend-nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取节点推荐失败');
    }

    return result.data?.recommendations || [];
  } catch (error) {
    console.error('获取节点推荐失败:', error);
    throw error;
  }
}

/**
 * 优化描述（提示工程）
 * @param request 描述优化请求参数
 * @returns 优化后的描述
 */
export async function optimizeDescription(request: PromptOptimizationRequest): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/prompt-engine/optimize-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '描述优化失败');
    }

    return result.data?.optimizedDescription || request.description;
  } catch (error) {
    console.error('描述优化失败:', error);
    throw error;
  }
}

/**
 * 生成工作流提示
 * @param request 提示生成请求参数
 * @returns 生成的提示内容
 */
export async function generateWorkflowPrompt(request: PromptOptimizationRequest): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/prompt-engine/generate-workflow-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '提示生成失败');
    }

    return result.data?.prompt || '';
  } catch (error) {
    console.error('提示生成失败:', error);
    throw error;
  }
}

/**
 * 获取工作流建议
 * @param request 工作流建议请求参数
 * @returns 工作流建议
 */
export async function getWorkflowSuggestion(request: WorkflowSuggestionRequest): Promise<WorkflowSuggestion> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取工作流建议失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取工作流建议失败:', error);
    throw error;
  }
}

/**
 * 获取节点配置建议
 * @param request 节点配置请求参数
 * @returns 节点配置建议
 */
export async function getNodeConfigSuggestions(request: NodeConfigRequest): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows/node-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取节点配置建议失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取节点配置建议失败:', error);
    throw error;
  }
}

/**
 * 推理节点参数配置
 */
export async function inferNodeParameters(request: ParameterInferenceRequest): Promise<ParameterInferenceResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/parameters/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('参数推理失败:', error);
    throw error;
  }
}

/**
 * 批量推理多个节点的参数配置
 */
export async function inferMultipleNodeParameters(requests: ParameterInferenceRequest[]): Promise<ParameterInferenceResponse[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/parameters/infer-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('批量参数推理失败:', error);
    throw error;
  }
}

/**
 * 获取支持参数推理的节点类型列表
 */
export async function getSupportedParameterNodes(): Promise<unknown[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/parameters/supported-nodes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('获取支持的节点类型失败:', error);
    throw error;
  }
}

/**
 * 根据工作流上下文优化参数推荐
 */
export async function optimizeParametersForWorkflow(
  nodeType: string,
  workflowContext: {
    description: string;
    existingNodes: Array<{ type: string; parameters: Record<string, unknown> }>;
    dataFlow: Array<{ from: string; to: string; data: unknown }>;
  }
): Promise<ParameterInferenceResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/parameters/optimize-for-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nodeType, workflowContext }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('工作流参数优化失败:', error);
    throw error;
  }
}

/**
 * 导出工作流为n8n格式
 * @param workflow n8n工作流对象
 * @param format 导出格式（json/yaml）
 * @returns Blob 文件
 */
export async function exportWorkflow(workflow: N8nWorkflow, format: string = 'json'): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workflow, format }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // 后端返回JSON格式，包含文件内容和元数据
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '导出失败');
    }

    // 从返回的数据中创建Blob
    const { content, contentType } = result.data;
    return new Blob([content], { type: contentType });
  } catch (error) {
    console.error('导出工作流失败:', error);
    throw error;
  }
}
