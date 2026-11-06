import OpenAI from 'openai'
import { AIConfigurationError, getOpenAIClient } from './openaiService'
import { vectorSearchService } from './vectorSearchService'
import fs from 'fs/promises'
import path from 'path'

/**
 * 提示模板接口
 */
export interface PromptTemplate {
  id: string
  name: string
  description: string
  template: string
  variables: string[]
  category: 'workflow' | 'node' | 'optimization' | 'analysis'
  examples?: string[]
}

/**
 * 提示生成选项
 */
export interface PromptOptions {
  includeContext?: boolean
  includeExamples?: boolean
  includeNodeList?: boolean
  maxTokens?: number
  temperature?: number
}

/**
 * 增强的工作流生成请求
 */
export interface EnhancedWorkflowRequest {
  description: string
  context?: string
  requirements?: string[]
  constraints?: string[]
  preferredNodes?: string[]
  avoidNodes?: string[]
  complexity?: 'simple' | 'medium' | 'complex'
  relevantNodes?: unknown[]
}

/**
 * 提示工程引擎
 * 提供智能的提示生成和优化功能
 */
export class PromptEngineService {
  private openai: OpenAI | null = null
  private templates: Map<string, PromptTemplate> = new Map()
  private nodeReference: unknown = null

  constructor() {
    this.initializeTemplates()
    this.loadNodeReference()
  }

  private getClient(): OpenAI {
    this.openai ??= getOpenAIClient()
    return this.openai
  }

  /**
   * 初始化提示模板
   */
  private initializeTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: 'workflow_generation',
        name: '工作流生成',
        description: '生成完整的n8n工作流',
        category: 'workflow',
        template: `你是一个专业的n8n工作流设计师。请根据以下需求生成一个完整的n8n工作流：

需求描述：{description}
{context}
{requirements}
{constraints}
{nodeList}

请生成一个JSON格式的n8n工作流，包含：
1. 合适的触发器节点
2. 必要的处理节点
3. 正确的节点连接
4. 合理的参数配置
5. 错误处理机制

{examples}

请确保工作流的实用性和可执行性。`,
        variables: ['description', 'context', 'requirements', 'constraints', 'nodeList', 'examples']
      },
      {
        id: 'node_recommendation',
        name: '节点推荐',
        description: '推荐合适的n8n节点',
        category: 'node',
        template: `作为n8n专家，请为以下场景推荐最合适的节点：

场景描述：{description}
当前工作流：{context}

{nodeList}

请推荐3-5个最相关的节点，并说明：
1. 节点名称和类型
2. 推荐理由
3. 配置要点
4. 使用注意事项

以JSON格式返回推荐结果。`,
        variables: ['description', 'context', 'nodeList']
      },
      {
        id: 'workflow_optimization',
        name: '工作流优化',
        description: '优化现有工作流',
        category: 'optimization',
        template: `请分析并优化以下n8n工作流：

当前工作流：{workflow}
优化目标：{description}

{constraints}

请提供优化建议，包括：
1. 性能优化点
2. 错误处理改进
3. 节点配置优化
4. 流程简化建议
5. 最佳实践应用

返回优化后的工作流JSON和改进说明。`,
        variables: ['workflow', 'description', 'constraints']
      },
      {
        id: 'requirement_analysis',
        name: '需求分析',
        description: '分析用户需求',
        category: 'analysis',
        template: `请分析以下工作流需求：

用户描述：{description}
{context}

请提取并分析：
1. 核心业务需求
2. 技术实现要点
3. 数据流向分析
4. 集成服务需求
5. 潜在挑战和解决方案

以结构化JSON格式返回分析结果。`,
        variables: ['description', 'context']
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.id, template)
    })

    console.log(`已加载${templates.length}个提示模板`)
  }

  /**
   * 加载节点参考信息
   */
  private async loadNodeReference(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'n8n-nodes-reference.json')
      const content = await fs.readFile(dataPath, 'utf-8')
      this.nodeReference = JSON.parse(content)
      console.log('节点参考信息加载完成')
    } catch (error) {
      console.warn('节点参考信息加载失败，将使用基础模式:', error)
    }
  }

  /**
   * 生成增强的工作流提示
   * @param request 工作流请求
   * @param options 提示选项
   * @returns 生成的提示文本
   */
  async generateWorkflowPrompt(
    request: EnhancedWorkflowRequest,
    options: PromptOptions = {}
  ): Promise<string> {
    const template = this.templates.get('workflow_generation')
    if (!template) {
      throw new Error('工作流生成模板未找到')
    }

    let prompt = template.template

    // 替换基础变量（用函数作替换值：用户输入里的 $$ $& $` $' 不会被当成替换模式）
    prompt = prompt.replace('{description}', () => request.description)

    // 添加上下文信息
    const contextText = request.context 
      ? `\n上下文信息：${request.context}`
      : ''
    prompt = prompt.replace('{context}', () => contextText)

    // 添加需求列表
    const requirementsText = request.requirements && request.requirements.length > 0
      ? `\n具体需求：\n${request.requirements.map(r => `- ${r}`).join('\n')}`
      : ''
    prompt = prompt.replace('{requirements}', () => requirementsText)

    // 添加约束条件
    const constraintsText = request.constraints && request.constraints.length > 0
      ? `\n约束条件：\n${request.constraints.map(c => `- ${c}`).join('\n')}`
      : ''
    prompt = prompt.replace('{constraints}', () => constraintsText)

    // 添加节点列表
    let nodeListText = ''
    if (options.includeNodeList && this.nodeReference) {
      // 使用向量搜索获取相关节点
      try {
        const relevantNodes = await vectorSearchService.searchNodes(request.description, {
          limit: 20,
          threshold: 0.3
        })
        
        if (relevantNodes.length > 0) {
          nodeListText = `\n相关可用节点：\n${relevantNodes.map(node => 
            `- ${node.nodeType}: ${node.description}`
          ).join('\n')}`
        }
      } catch (error) {
        console.warn('获取相关节点失败:', error)
      }
    }
    prompt = prompt.replace('{nodeList}', () => nodeListText)

    // 添加示例
    let examplesText = ''
    if (options.includeExamples && template.examples) {
      examplesText = `\n参考示例：\n${template.examples.join('\n\n')}`
    }
    prompt = prompt.replace('{examples}', () => examplesText)

    return prompt
  }

  /**
   * 生成节点推荐提示
   * @param description 场景描述
   * @param context 上下文
   * @param options 选项
   * @returns 提示文本
   */
  async generateNodeRecommendationPrompt(
    description: string,
    context: string = '',
    _options: PromptOptions = {}
  ): Promise<string> {
    void _options
    const template = this.templates.get('node_recommendation')
    if (!template) {
      throw new Error('节点推荐模板未找到')
    }

    let prompt = template.template
    prompt = prompt.replace('{description}', () => description)
    prompt = prompt.replace('{context}', () => context)

    // 添加节点列表
    let nodeListText = ''
    if (this.nodeReference) {
      // 获取相关节点信息
      try {
        const relevantNodes = await vectorSearchService.searchNodes(description, {
          limit: 15,
          threshold: 0.4
        })
        
        if (relevantNodes.length > 0) {
          nodeListText = `\n可用节点列表：\n${relevantNodes.map(node => 
            `- ${node.nodeType}: ${node.description} (类别: ${node.category})`
          ).join('\n')}`
        }
      } catch (error) {
        console.warn('获取节点列表失败:', error)
      }
    }
    prompt = prompt.replace('{nodeList}', () => nodeListText)

    return prompt
  }

  /**
   * 优化用户描述
   * @param description 原始描述
   * @returns 优化后的描述
   */
  async optimizeDescription(description: string): Promise<string> {
    try {
      const prompt = `
请优化以下工作流描述，使其更加清晰、具体和可执行：

原始描述："${description}"

优化要求：
1. 明确输入和输出
2. 详细说明处理步骤
3. 指定需要的集成服务
4. 添加错误处理需求
5. 保持简洁明了

请直接返回优化后的描述，不要其他解释。
      `

      const response = await this.getClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的业务分析师，擅长将模糊的需求转化为清晰的技术规格。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })

      const optimizedDescription = response.choices[0]?.message?.content?.trim()
      
      if (optimizedDescription) {
        console.log('描述优化完成')
        return optimizedDescription
      }

      return description

    } catch (error) {
      if (error instanceof AIConfigurationError) throw error
      console.error('描述优化失败:', error)
      return description
    }
  }

  /**
   * 生成工作流分析报告
   * @param workflow 工作流JSON
   * @returns 分析报告
   */
  async analyzeWorkflow(workflow: unknown): Promise<unknown> {
    try {
      const prompt = `
请分析以下n8n工作流，提供详细的分析报告：

工作流JSON：
${JSON.stringify(workflow, null, 2)}

请分析：
1. 工作流结构和逻辑
2. 节点配置合理性
3. 数据流向分析
4. 潜在问题和风险
5. 优化建议
6. 性能评估

以JSON格式返回分析结果。
      `

      const response = await this.getClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是n8n工作流专家，能够深入分析工作流的设计和实现。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1500
      })

      const content = response.choices[0]?.message?.content
      if (content) {
        return JSON.parse(content)
      }

      return { error: 'AI分析返回空结果' }

    } catch (error) {
      if (error instanceof AIConfigurationError) throw error
      console.error('工作流分析失败:', error)
      return { error: '工作流分析失败' }
    }
  }

  /**
   * 获取提示模板
   * @param templateId 模板ID
   * @returns 提示模板
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId)
  }

  /**
   * 获取所有模板
   * @returns 模板列表
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * 添加自定义模板
   * @param template 模板
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template)
    console.log(`已添加自定义模板: ${template.name}`)
  }

  /**
   * 生成动态提示
   * @param basePrompt 基础提示
   * @param context 上下文信息
   * @param enhancementType 增强类型
   * @returns 增强后的提示
   */
  async generateDynamicPrompt(
    basePrompt: string,
    context: Record<string, unknown>,
    enhancementType: 'detailed' | 'concise' | 'technical' = 'detailed'
  ): Promise<string> {
    let enhancedPrompt = basePrompt

    // 根据增强类型调整提示
    switch (enhancementType) {
      case 'detailed':
        enhancedPrompt += '\n\n请提供详细的实现步骤和配置说明。'
        break
      case 'concise':
        enhancedPrompt += '\n\n请提供简洁明了的解决方案。'
        break
      case 'technical':
        enhancedPrompt += '\n\n请重点关注技术实现细节和最佳实践。'
        break
    }

    // 添加上下文信息
    if (Object.keys(context).length > 0) {
      enhancedPrompt += '\n\n上下文信息：'
      for (const [key, value] of Object.entries(context)) {
        enhancedPrompt += `\n- ${key}: ${value}`
      }
    }

    return enhancedPrompt
  }
}

// 导出单例实例
export const promptEngineService = new PromptEngineService()
