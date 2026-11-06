import { AIConfigurationError, generateWorkflowWithPrompt } from './openaiService';
import { VectorSearchService, type SearchResult } from './vectorSearchService';
import { PromptEngineService } from './promptEngineService';
import type { N8nWorkflow, N8nNode } from '../../shared/types';

/**
 * 智能工作流生成请求接口
 */
export interface IntelligentWorkflowRequest {
  description: string;
  context?: string;
  requirements?: string[];
  constraints?: string[];
  preferredNodes?: string[];
  avoidNodes?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  useEnhancedPrompt?: boolean;
  existingNodes?: string[];
}

/**
 * 工作流生成元数据
 */
export interface WorkflowGenerationMeta {
  nodesUsed: number;
  connectionsCreated: number;
  complexity: string;
  estimatedExecutionTime: string;
  recommendedNodes: string[];
  generationTime: number;
  confidence: number;
}

/**
 * 智能工作流生成器
 * 整合向量检索、提示工程和GPT生成能力
 */
export class IntelligentWorkflowGenerator {
  private vectorSearchService: VectorSearchService;
  private promptEngineService: PromptEngineService;

  constructor() {
    this.vectorSearchService = new VectorSearchService();
    this.promptEngineService = new PromptEngineService();
  }

  /**
   * 生成智能工作流
   * @param request 生成请求参数
   * @returns 生成的工作流和元数据
   */
  async generateWorkflow(request: IntelligentWorkflowRequest): Promise<{
    workflow: N8nWorkflow;
    meta: WorkflowGenerationMeta;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('开始智能工作流生成:', request.description);

      // 优化描述
      // 1. 获取相关节点推荐
      const relevantNodes = await this.getRelevantNodes(request);
      console.log(`找到 ${relevantNodes.length} 个相关节点`);

      // 2. 生成优化的提示
      const optimizedPrompt = await this.generateOptimizedPrompt(request, relevantNodes);
      console.log('生成优化提示完成');

      // 3. 使用GPT生成工作流结构
      const workflowStructure = await this.generateWorkflowStructure(optimizedPrompt, request);
      console.log('生成工作流结构完成');

      // 4. 优化和验证工作流
      const optimizedWorkflow = await this.optimizeWorkflow(workflowStructure, request);
      console.log('工作流优化完成');

      // 5. 生成元数据
      const meta = this.generateMeta(optimizedWorkflow, relevantNodes, startTime);

      return {
        workflow: optimizedWorkflow,
        meta
      };
    } catch (error) {
      console.error('智能工作流生成失败:', error);
      if (error instanceof AIConfigurationError) throw error;
      throw new Error(`工作流生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取相关节点
   * @param request 请求参数
   * @returns 相关节点列表
   */
  private async getRelevantNodes(request: IntelligentWorkflowRequest): Promise<SearchResult[]> {
    try {
      // 构建搜索查询
      const searchQuery = this.buildSearchQuery(request);
      
      // 使用向量搜索获取相关节点
      const searchResults = await this.vectorSearchService.searchNodes(searchQuery, {
        limit: 15,
        threshold: 0.7,
        category: this.inferCategory(request.description)
      });

      return searchResults;
    } catch (error) {
      console.error('获取相关节点失败:', error);
      return [];
    }
  }

  /**
   * 构建搜索查询
   * @param request 请求参数
   * @returns 搜索查询字符串
   */
  private buildSearchQuery(request: IntelligentWorkflowRequest): string {
    let query = request.description;
    
    if (request.context) {
      query += ` ${request.context}`;
    }
    
    if (request.requirements && request.requirements.length > 0) {
      query += ` ${request.requirements.join(' ')}`;
    }
    
    return query;
  }

  /**
   * 推断节点类别
   * @param description 描述
   * @returns 节点类别
   */
  private inferCategory(description: string): string | undefined {
    const categoryKeywords = {
      'trigger': ['webhook', 'schedule', 'manual', 'trigger', '触发', '定时', '手动'],
      'data': ['database', 'api', 'http', 'json', 'csv', 'excel', '数据库', '接口', '数据'],
      'logic': ['if', 'switch', 'condition', 'filter', 'merge', '条件', '判断', '合并', '筛选'],
      'notification': ['email', 'slack', 'telegram', 'sms', '邮件', '通知', '消息'],
      'file': ['file', 'ftp', 'sftp', 'google drive', 'dropbox', '文件', '上传', '下载']
    };

    const lowerDesc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        return category;
      }
    }
    
    return undefined;
  }

  /**
   * 生成优化的提示
   * @param request 请求参数
   * @param relevantNodes 相关节点
   * @returns 优化的提示
   */
  private async generateOptimizedPrompt(
    request: IntelligentWorkflowRequest, 
    relevantNodes: SearchResult[]
  ): Promise<string> {
    try {
      if (request.useEnhancedPrompt) {
        return await this.promptEngineService.generateWorkflowPrompt({
          description: request.description,
          context: request.context,
          requirements: request.requirements,
          constraints: request.constraints,
          preferredNodes: request.preferredNodes,
          avoidNodes: request.avoidNodes,
          relevantNodes,
          complexity: request.complexity || 'medium'
        });
      } else {
        return this.buildBasicPrompt(request, relevantNodes);
      }
    } catch (error) {
      console.error('生成优化提示失败:', error);
      return this.buildBasicPrompt(request, relevantNodes);
    }
  }

  /**
   * 构建基础提示
   * @param request 请求参数
   * @param relevantNodes 相关节点
   * @returns 基础提示
   */
  private buildBasicPrompt(request: IntelligentWorkflowRequest, relevantNodes: SearchResult[]): string {
    let prompt = `请根据以下描述生成一个n8n工作流:\n\n描述: ${request.description}\n\n`;
    
    if (request.context) {
      prompt += `上下文: ${request.context}\n\n`;
    }
    
    if (request.requirements && request.requirements.length > 0) {
      prompt += `需求:\n${request.requirements.map(req => `- ${req}`).join('\n')}\n\n`;
    }

    if (request.constraints && request.constraints.length > 0) {
      prompt += `约束条件:\n${request.constraints.map(item => `- ${item}`).join('\n')}\n\n`;
    }
    
    if (relevantNodes.length > 0) {
      prompt += `推荐使用的节点:\n${relevantNodes.slice(0, 8).map(node => 
        `- ${node.displayName}: ${node.description}`
      ).join('\n')}\n\n`;
    }
    
    prompt += `请返回完整的n8n工作流JSON格式，包含nodes和connections数组。`;
    
    return prompt;
  }

  /**
   * 生成工作流结构
   * @param prompt 提示内容
   * @param request 请求参数
   * @returns 工作流结构
   */
  private async generateWorkflowStructure(
    prompt: string, 
    _request: IntelligentWorkflowRequest
  ): Promise<N8nWorkflow> {
    void _request;
    try {
      const response = await generateWorkflowWithPrompt(prompt);

      // 验证和清理生成的工作流
      return this.validateAndCleanWorkflow(response);
    } catch (error) {
      console.error('生成工作流结构失败:', error);
      if (error instanceof AIConfigurationError) throw error;
      throw new Error('无法生成工作流结构');
    }
  }

  /**
   * 验证和清理工作流
   * @param workflow 原始工作流
   * @returns 清理后的工作流
   */
  private validateAndCleanWorkflow(workflow: Partial<N8nWorkflow>): N8nWorkflow {
    // 确保基本结构
    const cleanWorkflow: N8nWorkflow = {
      name: workflow.name || '智能生成的工作流',
      nodes: Array.isArray(workflow.nodes) ? workflow.nodes : [],
      connections: workflow.connections || {},
      active: false,
      settings: workflow.settings || {},
      staticData: workflow.staticData || {}
    };

    // 验证节点
    cleanWorkflow.nodes = cleanWorkflow.nodes.map((node: Partial<N8nNode>, index: number) => ({
      id: node.id || `node_${index}`,
      name: node.name || `Node ${index + 1}`,
      type: node.type || 'n8n-nodes-base.noOp',
      typeVersion: node.typeVersion || 1,
      position: node.position || [100 + index * 200, 100],
      parameters: node.parameters || {}
    }));

    return cleanWorkflow;
  }

  /**
   * 优化工作流
   * @param workflow 原始工作流
   * @param request 请求参数
   * @returns 优化后的工作流
   */
  private async optimizeWorkflow(
    workflow: N8nWorkflow, 
    request: IntelligentWorkflowRequest
  ): Promise<N8nWorkflow> {
    try {
      // 添加错误处理节点
      const optimizedWorkflow = this.addErrorHandling(workflow);
      
      // 优化节点连接
      this.optimizeConnections(optimizedWorkflow);
      
      // 添加描述和标签
      optimizedWorkflow.name = this.generateWorkflowName(request.description);
      
      return optimizedWorkflow;
    } catch (error) {
      console.error('工作流优化失败:', error);
      return workflow;
    }
  }

  /**
   * 添加错误处理
   * @param workflow 工作流
   * @returns 添加错误处理后的工作流
   */
  private addErrorHandling(workflow: N8nWorkflow): N8nWorkflow {
    // 简单的错误处理逻辑
    // 在实际实现中，这里会添加更复杂的错误处理节点
    return workflow;
  }

  /**
   * 优化连接
   * @param workflow 工作流
   */
  private optimizeConnections(_workflow: N8nWorkflow): void {
    void _workflow;
    // 优化节点间的连接逻辑
    // 在实际实现中，这里会优化连接路径和数据流
  }

  /**
   * 生成工作流名称
   * @param description 描述
   * @returns 工作流名称
   */
  private generateWorkflowName(description: string): string {
    // 从描述中提取关键词生成名称
    const words = description.split(' ').slice(0, 4);
    return words.join(' ') + ' - 智能生成';
  }

  /**
   * 生成元数据
   * @param workflow 工作流
   * @param relevantNodes 相关节点
   * @param startTime 开始时间
   * @returns 元数据
   */
  private generateMeta(
    workflow: N8nWorkflow, 
    relevantNodes: SearchResult[], 
    startTime: number
  ): WorkflowGenerationMeta {
    const generationTime = Date.now() - startTime;
    
    return {
      nodesUsed: workflow.nodes.length,
      connectionsCreated: Object.keys(workflow.connections).length,
      complexity: this.calculateComplexity(workflow),
      estimatedExecutionTime: this.estimateExecutionTime(workflow),
      recommendedNodes: relevantNodes.slice(0, 5).map(node => node.displayName),
      generationTime,
      confidence: this.calculateConfidence(workflow, relevantNodes)
    };
  }

  /**
   * 计算复杂度
   * @param workflow 工作流
   * @returns 复杂度描述
   */
  private calculateComplexity(workflow: N8nWorkflow): string {
    const nodeCount = workflow.nodes.length;
    
    if (nodeCount <= 3) return '简单';
    if (nodeCount <= 7) return '中等';
    return '复杂';
  }

  /**
   * 估算执行时间
   * @param workflow 工作流
   * @returns 执行时间估算
   */
  private estimateExecutionTime(workflow: N8nWorkflow): string {
    const nodeCount = workflow.nodes.length;
    const estimatedSeconds = nodeCount * 2; // 简单估算
    
    if (estimatedSeconds < 60) return `${estimatedSeconds}秒`;
    return `${Math.ceil(estimatedSeconds / 60)}分钟`;
  }

  /**
   * 计算置信度
   * @param workflow 工作流
   * @param relevantNodes 相关节点
   * @returns 置信度 (0-1)
   */
  private calculateConfidence(workflow: N8nWorkflow, relevantNodes: SearchResult[]): number {
    // 基于节点匹配度和工作流完整性计算置信度
    const nodeMatchScore = relevantNodes.length > 0 ? 0.7 : 0.3;
    const structureScore = workflow.nodes.length > 0 ? 0.3 : 0;
    
    return Math.min(nodeMatchScore + structureScore, 1.0);
  }
}

export default IntelligentWorkflowGenerator;
