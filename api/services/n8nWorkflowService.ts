import fs from 'fs/promises';
import path from 'path';
import { aiModelService, AIModelResponse } from './aiModelService';

// n8n节点接口
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

// n8n工作流接口
export interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  active: boolean;
  settings: Record<string, unknown>;
  staticData?: Record<string, unknown>;
}

// 工作流生成结果接口
export interface WorkflowGenerationResult {
  workflow: N8nWorkflow;
  model: string;
  description: string;
  generatedAt: string;
}

// 多模型对比结果接口
export interface MultiModelResult {
  results: WorkflowGenerationResult[];
  bestResult: WorkflowGenerationResult;
  comparisonMetrics: {
    nodeCount: number[];
    complexity: number[];
    completeness: number[];
  };
}
interface NodeReferenceSummary { name: string; displayName: string; description: string }

export class N8nWorkflowService {
  private nodeList: NodeReferenceSummary[] = [];
  private nodeParameters: Record<string, unknown> = {};

  constructor() {
    this.loadNodeData();
  }

  /**
   * 加载n8n节点数据
   */
  private async loadNodeData() {
    try {
      // 加载节点列表
      const nodeListPath = path.join(process.cwd(), 'data/n8n_node_list_full.json');
      const nodeListData = await fs.readFile(nodeListPath, 'utf-8');
      this.nodeList = JSON.parse(nodeListData).data || [];

      // 加载节点参数数据
      const nodeParamsPath = path.join(process.cwd(), 'data/n8n_data_workflows');
      const files = await fs.readdir(nodeParamsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(nodeParamsPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);
          Object.assign(this.nodeParameters, parsed);
        }
      }

      console.log(`已加载 ${this.nodeList.length} 个n8n节点`);
    } catch (error) {
      console.error('加载n8n节点数据失败:', error);
    }
  }

  /**
   * 生成工作流提示词
   */
  private generateWorkflowPrompt(description: string): string {
    const availableNodes = this.nodeList.slice(0, 50).map(node => ({
      name: node.name,
      displayName: node.displayName,
      description: node.description
    }));

    return `
你是一个专业的n8n工作流生成器。请根据以下描述生成一个完整的n8n工作流JSON。

工作流描述: ${description}

可用的n8n节点类型（部分）:
${JSON.stringify(availableNodes, null, 2)}

请生成一个完整的n8n工作流JSON，包含以下结构：
{
  "name": "工作流名称",
  "nodes": [
    {
      "id": "唯一ID",
      "name": "节点名称",
      "type": "节点类型",
      "typeVersion": 1,
      "position": [x坐标, y坐标],
      "parameters": {
        // 节点参数
      }
    }
  ],
  "connections": {
    // 节点连接关系
  },
  "active": true,
  "settings": {}
}

要求：
1. 工作流必须是完整且可执行的
2. 节点之间的连接关系要正确
3. 参数配置要合理
4. 位置坐标要有序排列
5. 只返回JSON，不要其他说明文字
`;
  }

  /**
   * 使用单个AI模型生成工作流
   */
  async generateWorkflowWithModel(
    description: string, 
    model: 'openai' | 'gemini' | 'grok'
  ): Promise<WorkflowGenerationResult> {
    const prompt = this.generateWorkflowPrompt(description);
    let response: AIModelResponse;

    switch (model) {
      case 'openai':
        response = await aiModelService.generateWithOpenAI(prompt);
        break;
      case 'gemini':
        response = await aiModelService.generateWithGemini(prompt);
        break;
      case 'grok':
        response = await aiModelService.generateWithGrok(prompt);
        break;
      default:
        throw new Error(`不支持的模型: ${model}`);
    }

    // 解析生成的工作流JSON
    let workflow: N8nWorkflow;
    try {
      // 提取JSON部分（去除可能的markdown格式）
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      workflow = JSON.parse(jsonContent);
      
      // 验证工作流结构
      if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        throw new Error('工作流缺少nodes数组');
      }
      
      // 确保必要字段存在
      workflow.active = workflow.active ?? true;
      workflow.settings = workflow.settings ?? {};
      workflow.connections = workflow.connections ?? {};
      
    } catch (error) {
      console.error('解析工作流JSON失败:', error);
      console.error('原始响应:', response.content);
      throw new Error(`解析${response.model}生成的工作流失败: ${error}`);
    }

    return {
      workflow,
      model: response.model,
      description,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 使用所有AI模型生成工作流并对比
   */
  async generateWorkflowWithAllModels(description: string): Promise<MultiModelResult> {
    const models: ('openai' | 'gemini' | 'grok')[] = ['openai', 'gemini', 'grok'];
    const results: WorkflowGenerationResult[] = [];

    // 并行生成工作流
    const promises = models.map(async (model) => {
      try {
        return await this.generateWorkflowWithModel(description, model);
      } catch (error) {
        console.error(`${model}生成工作流失败:`, error);
        return null;
      }
    });

    const generatedResults = await Promise.all(promises);
    
    // 过滤掉失败的结果
    for (const result of generatedResults) {
      if (result) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      throw new Error('所有AI模型都无法生成有效的工作流');
    }

    // 计算对比指标
    const comparisonMetrics = {
      nodeCount: results.map(r => r.workflow.nodes.length),
      complexity: results.map(r => this.calculateComplexity(r.workflow)),
      completeness: results.map(r => this.calculateCompleteness(r.workflow))
    };

    // 选择最佳结果
    const bestResult = this.selectBestWorkflow(results);

    return {
      results,
      bestResult,
      comparisonMetrics
    };
  }

  /**
   * 计算工作流复杂度
   */
  public calculateComplexity(workflow: N8nWorkflow): number {
    let complexity = 0;
    
    // 基于节点数量
    complexity += workflow.nodes.length * 10;
    
    // 基于连接数量
    const connectionCount = Object.keys(workflow.connections).length;
    complexity += connectionCount * 5;
    
    // 基于参数复杂度
    for (const node of workflow.nodes) {
      const paramCount = Object.keys(node.parameters || {}).length;
      complexity += paramCount * 2;
    }
    
    return complexity;
  }

  /**
   * 计算工作流完整性
   */
  public calculateCompleteness(workflow: N8nWorkflow): number {
    let completeness = 0;
    
    // 检查基本结构
    if (workflow.name) completeness += 20;
    if (workflow.nodes && workflow.nodes.length > 0) completeness += 30;
    if (workflow.connections) completeness += 20;
    
    // 检查节点完整性
    for (const node of workflow.nodes || []) {
      if (node.id && node.name && node.type) completeness += 5;
      if (node.parameters && Object.keys(node.parameters).length > 0) completeness += 3;
      if (node.position && Array.isArray(node.position)) completeness += 2;
    }
    
    return Math.min(completeness, 100);
  }

  /**
   * 选择最佳工作流
   */
  private selectBestWorkflow(results: WorkflowGenerationResult[]): WorkflowGenerationResult {
    if (results.length === 1) return results[0];
    
    // 综合评分算法
    const scoredResults = results.map(result => {
      const complexity = this.calculateComplexity(result.workflow);
      const completeness = this.calculateCompleteness(result.workflow);
      
      // 权重：完整性70%，复杂度30%
      const score = completeness * 0.7 + (complexity / 10) * 0.3;
      
      return { ...result, score };
    });
    
    // 返回评分最高的结果
    return scoredResults.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  /**
   * 保存工作流到文件
   */
  async saveWorkflow(workflow: N8nWorkflow, filename?: string): Promise<string> {
    const workflowName = filename || `generated_workflow_${Date.now()}.json`;
    const filePath = path.join(process.cwd(), 'data/generated_workflows', workflowName);
    
    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // 保存工作流
    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    
    return filePath;
  }
}

export const n8nWorkflowService = new N8nWorkflowService();
