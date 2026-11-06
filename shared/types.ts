/**
 * 共享类型定义 - 前后端通用
 */

// n8n工作流节点接口
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, string>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  color?: string;
  continueOnFail?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  alwaysOutputData?: boolean;
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
}

// n8n工作流连接接口
export interface N8nConnection {
  node: string;
  type: string;
  index: number;
}

// n8n工作流接口
export interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, Record<string, N8nConnection[][]>>;
  active?: boolean;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  pinData?: Record<string, unknown>;
  versionId?: string;
  meta?: Record<string, unknown>;
  tags?: string[];
}

// 工作流模板接口
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: N8nWorkflow;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  usageCount: number;
  author?: string;
  version?: string;
}

// 工作流生成响应接口
export interface WorkflowGenerateResponse {
  workflow: N8nWorkflow;
  meta: {
    nodesUsed: number;
    connectionsCreated: number;
    complexity: string;
    estimatedExecutionTime: string;
    recommendedNodes: string[];
    generationTime: number;
    confidence: number;
  };
}

export interface WorkflowGenerateRequest {
  description: string;
  context?: string;
  requirements?: string[];
  constraints?: string[];
  preferredNodes?: string[];
  avoidNodes?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  useEnhancedPrompt?: boolean;
  preferences?: {
    preferredNodes?: string[];
    complexity?: 'simple' | 'medium' | 'complex';
    includeErrorHandling?: boolean;
    nodeStyle?: string;
  };
}

export type WorkflowGenerationRequest = WorkflowGenerateRequest;

export interface WorkflowExportRequest {
  workflow: N8nWorkflow;
  format: 'json' | 'yaml';
  includeCredentials?: boolean;
  includeSettings?: boolean;
  minify?: boolean;
  filename?: string;
}

export type WorkflowExportResponse = ApiResponse<ExportResult>;

export type TemplateListResponse = ApiResponse<WorkflowTemplate[]>;

// 节点推荐接口
export interface NodeRecommendation {
  nodeType: string;
  name: string;
  description: string;
  confidence: number;
  category: string;
  parameters?: Record<string, unknown>;
  usageExample?: string;
  documentation?: string;
}

// 向量搜索请求接口
export interface VectorSearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
  category?: string;
  includeMetadata?: boolean;
}

// 向量搜索响应接口
export interface VectorSearchResponse {
  nodes: NodeRecommendation[];
  totalResults: number;
  searchTime: number;
  query: string;
}

// 提示工程请求接口
export interface PromptRequest {
  description: string;
  context?: string;
  requirements?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  relevantNodes?: NodeRecommendation[];
  detailLevel?: 'concise' | 'detailed' | 'technical';
}

// API响应基础接口
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T | null;
  error?: string | null;
  message?: string;
  code?: string;
  timestamp?: string;
}

// 错误类型枚举
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 自定义错误接口
export interface CustomError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// 缓存配置接口
export interface CacheConfig {
  ttl: number; // 生存时间（秒）
  maxSize?: number; // 最大缓存大小
  prefix?: string; // 缓存键前缀
}

// 性能指标接口
export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
}

// 用户会话接口
export interface UserSession {
  sessionId: string;
  userId?: string;
  createdAt: string;
  lastActivity: string;
  preferences: Record<string, unknown>;
  workflowHistory: string[];
}

// 工作流历史记录接口
export interface WorkflowHistory {
  id: string;
  sessionId: string;
  workflow: N8nWorkflow;
  description: string;
  createdAt: string;
  generationMeta: WorkflowGenerateResponse['meta'];
  feedback?: {
    rating: number;
    comment?: string;
    useful: boolean;
  };
}

// 节点参数推理请求接口
export interface ParameterInferenceRequest {
  nodeType: string;
  context: string;
  workflowDescription: string;
  existingParameters?: Record<string, unknown>;
}

// 节点参数推理响应接口
export interface ParameterInferenceResponse {
  parameters: Record<string, unknown>;
  confidence: number;
  suggestions: {
    parameter: string;
    value: unknown;
    reason: string;
  }[];
}

// 工作流优化建议接口
export interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'maintainability' | 'security';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestion: string;
  nodeId?: string;
  automated?: boolean;
}

// 工作流分析结果接口
export interface WorkflowAnalysis {
  complexity: {
    score: number;
    level: 'simple' | 'medium' | 'complex';
    factors: string[];
  };
  performance: {
    estimatedExecutionTime: number;
    bottlenecks: string[];
    optimizations: OptimizationSuggestion[];
  };
  reliability: {
    errorHandling: boolean;
    retryMechanisms: boolean;
    dataValidation: boolean;
    suggestions: OptimizationSuggestion[];
  };
  security: {
    credentialUsage: boolean;
    dataExposure: string[];
    recommendations: OptimizationSuggestion[];
  };
}

// 导出格式枚举
export enum ExportFormat {
  JSON = 'json',
  YAML = 'yaml',
  N8N = 'n8n'
}

// 导出选项接口
export interface ExportOptions {
  format: ExportFormat;
  includeCredentials?: boolean;
  includeSettings?: boolean;
  minify?: boolean;
  filename?: string;
}

// 导出结果接口
export interface ExportResult {
  content: string;
  filename: string;
  contentType: string;
  size: number;
}
