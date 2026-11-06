import { AIConfigurationError, getOpenAIClient } from './openaiService';
import type OpenAI from 'openai';

/**
 * 参数推理请求接口
 */
export interface ParameterInferenceRequest {
  nodeType: string;
  context?: string;
  workflowDescription?: string;
  existingNodes?: string[];
  userInput?: Record<string, unknown>;
}

/**
 * 参数推荐响应接口
 */
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

/**
 * 参数推理响应接口
 */
export interface ParameterInferenceResponse {
  nodeType: string;
  recommendations: ParameterRecommendation[];
  metadata: {
    totalParameters: number;
    inferredParameters: number;
    confidence: number;
  };
}

/**
 * 参数智能推理服务类
 */
export class ParameterInferenceService {
  private openaiClient: OpenAI | null = null;

  private getClient(): OpenAI {
    this.openaiClient ??= getOpenAIClient();
    return this.openaiClient;
  }

  /**
   * 推理节点参数
   */
  async inferParameters(request: ParameterInferenceRequest): Promise<ParameterInferenceResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request);

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return this.parseParameterResponse(response, request.nodeType);
    } catch (error) {
      if (error instanceof AIConfigurationError) throw error;
      console.error('Parameter inference error:', error);
      return this.getFallbackParameters(request.nodeType);
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    return `你是一个n8n工作流参数智能推理专家。你的任务是根据节点类型、上下文和用户描述，智能推荐最合适的参数配置。

## 核心能力
1. **参数智能推理**: 根据节点类型和上下文推荐参数值
2. **置信度评估**: 为每个推荐提供置信度分数(0-1)
3. **多选项推荐**: 为重要参数提供多个可选值
4. **推理解释**: 解释推荐理由和最佳实践

## 常见节点类型参数规则

### HTTP Request节点
- method: 根据操作类型推荐(GET/POST/PUT/DELETE)
- url: 根据描述推荐API端点格式
- headers: 推荐常用headers(Content-Type, Authorization等)
- body: 根据method和用途推荐数据格式

### Webhook节点
- httpMethod: 根据用途推荐方法
- path: 推荐语义化路径
- responseMode: 根据需求推荐响应模式

### Code节点
- jsCode: 根据功能需求生成基础代码框架
- workflowStaticData: 推荐是否使用静态数据

### IF节点
- conditions: 根据逻辑需求推荐条件配置
- combineOperation: 推荐AND/OR逻辑

### Set节点
- values: 根据数据流推荐字段设置
- options: 推荐保留/替换现有字段

### Email节点
- fromEmail: 推荐发件人格式
- toEmail: 根据上下文推荐收件人
- subject: 根据用途生成主题模板
- emailType: 推荐HTML/文本格式

### Database节点
- operation: 根据需求推荐CRUD操作
- table: 根据数据类型推荐表名
- columns: 推荐相关字段

## 输出格式
请严格按照以下JSON格式输出:

\`\`\`json
{
  "nodeType": "节点类型",
  "recommendations": [
    {
      "parameter": "参数名",
      "value": "推荐值",
      "confidence": 0.85,
      "reasoning": "推荐理由",
      "alternatives": [
        {
          "value": "备选值1",
          "confidence": 0.7,
          "reasoning": "备选理由1"
        }
      ]
    }
  ],
  "metadata": {
    "totalParameters": 5,
    "inferredParameters": 3,
    "confidence": 0.8
  }
}
\`\`\`

## 推理原则
1. **上下文相关**: 充分考虑工作流描述和现有节点
2. **实用性优先**: 推荐最常用和最实用的配置
3. **安全考虑**: 避免推荐可能有安全风险的配置
4. **最佳实践**: 遵循n8n和相关服务的最佳实践
5. **渐进式**: 从基础配置开始，提供进阶选项`;
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(request: ParameterInferenceRequest): string {
    let prompt = `请为以下n8n节点推荐参数配置:\n\n`;
    prompt += `**节点类型**: ${request.nodeType}\n`;
    
    if (request.workflowDescription) {
      prompt += `**工作流描述**: ${request.workflowDescription}\n`;
    }
    
    if (request.context) {
      prompt += `**上下文信息**: ${request.context}\n`;
    }
    
    if (request.existingNodes && request.existingNodes.length > 0) {
      prompt += `**现有节点**: ${request.existingNodes.join(', ')}\n`;
    }
    
    if (request.userInput && Object.keys(request.userInput).length > 0) {
      prompt += `**用户已配置参数**: ${JSON.stringify(request.userInput, null, 2)}\n`;
    }
    
    prompt += `\n请根据以上信息，为${request.nodeType}节点推荐最合适的参数配置。`;
    
    return prompt;
  }

  /**
   * 解析参数推荐响应
   */
  private parseParameterResponse(response: string, nodeType: string): ParameterInferenceResponse {
    try {
      // 提取JSON内容
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      // 验证响应格式
      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        throw new Error('Invalid response format');
      }
      
      return {
        nodeType,
        recommendations: parsed.recommendations,
        metadata: parsed.metadata || {
          totalParameters: parsed.recommendations.length,
          inferredParameters: parsed.recommendations.length,
          confidence: 0.7
        }
      };
    } catch (error) {
      console.error('Failed to parse parameter response:', error);
      return this.getFallbackParameters(nodeType);
    }
  }

  /**
   * 获取备用参数推荐
   */
  private getFallbackParameters(nodeType: string): ParameterInferenceResponse {
    const fallbackMap: Record<string, ParameterRecommendation[]> = {
      'n8n-nodes-base.httpRequest': [
        {
          parameter: 'method',
          value: 'GET',
          confidence: 0.8,
          reasoning: '默认使用GET方法进行数据获取'
        },
        {
          parameter: 'url',
          value: 'https://api.example.com/data',
          confidence: 0.5,
          reasoning: '示例API端点，需要根据实际需求修改'
        }
      ],
      'n8n-nodes-base.webhook': [
        {
          parameter: 'httpMethod',
          value: 'POST',
          confidence: 0.7,
          reasoning: 'POST方法适合接收数据'
        },
        {
          parameter: 'path',
          value: 'webhook',
          confidence: 0.6,
          reasoning: '通用webhook路径'
        }
      ],
      'n8n-nodes-base.code': [
        {
          parameter: 'jsCode',
          value: '// 在这里编写你的JavaScript代码\nreturn items;',
          confidence: 0.9,
          reasoning: '基础代码模板，返回输入数据'
        }
      ]
    };

    const recommendations = fallbackMap[nodeType] || [
      {
        parameter: 'default',
        value: '',
        confidence: 0.3,
        reasoning: '未知节点类型，请手动配置参数'
      }
    ];

    return {
      nodeType,
      recommendations,
      metadata: {
        totalParameters: recommendations.length,
        inferredParameters: 0,
        confidence: 0.3
      }
    };
  }

  /**
   * 批量推理多个节点的参数
   */
  async inferMultipleParameters(
    requests: ParameterInferenceRequest[]
  ): Promise<ParameterInferenceResponse[]> {
    const results = await Promise.allSettled(
      requests.map(request => this.inferParameters(request))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Parameter inference failed for ${requests[index].nodeType}:`, result.reason);
        return this.getFallbackParameters(requests[index].nodeType);
      }
    });
  }

  /**
   * 根据工作流上下文优化参数推荐
   */
  async optimizeParametersForWorkflow(
    nodeType: string,
    workflowContext: {
      description: string;
      existingNodes: Array<{ type: string; parameters: Record<string, unknown> }>;
      dataFlow: Array<{ from: string; to: string; data: unknown }>;
    }
  ): Promise<ParameterInferenceResponse> {
    const request: ParameterInferenceRequest = {
      nodeType,
      workflowDescription: workflowContext.description,
      existingNodes: workflowContext.existingNodes.map(node => node.type),
      context: `数据流: ${JSON.stringify(workflowContext.dataFlow, null, 2)}`
    };

    return this.inferParameters(request);
  }
}

// 导出服务实例
export const parameterInferenceService = new ParameterInferenceService();

// 导出便捷函数
export async function inferNodeParameters(
  request: ParameterInferenceRequest
): Promise<ParameterInferenceResponse> {
  return parameterInferenceService.inferParameters(request);
}

export async function inferMultipleNodeParameters(
  requests: ParameterInferenceRequest[]
): Promise<ParameterInferenceResponse[]> {
  return parameterInferenceService.inferMultipleParameters(requests);
}
