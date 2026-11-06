// n8n工作流类型定义

/**
 * n8n节点接口
 */
export interface N8nNode {
  id?: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  webhookId?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  notes?: string;
  notesInFlow?: boolean;
}

/**
 * n8n连接接口
 */
export interface N8nConnection {
  node: string;
  type: string;
  index: number;
}

/**
 * n8n连接映射接口
 */
export interface N8nConnections {
  [key: string]: {
    main?: N8nConnection[][];
  };
}

/**
 * n8n工作流接口
 */
export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  active: boolean;
  settings: Record<string, unknown>;
  staticData: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  pinData?: Record<string, unknown>;
  versionId?: string;
}

/**
 * 工作流生成请求接口
 */
export interface WorkflowGenerateRequest {
  description: string;
}

/**
 * 工作流生成响应接口
 */
export interface WorkflowGenerateResponse {
  success: boolean;
  workflow: N8nWorkflow;
  meta?: {
    nodesUsed: number;
    connectionsCreated: number;
    complexity: string;
    estimatedExecutionTime: string;
    recommendedNodes: string[];
    generationTime: number;
    confidence: number;
  };
  message?: string;
}

/**
 * 模板接口
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: N8nWorkflow;
  tags: string[];
  createdAt: string;
  usageCount: number;
}
