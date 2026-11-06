import { vectorSearchService, SearchResult } from './vectorSearchService'
import OpenAI from 'openai'
import { AIConfigurationError, getOpenAIClient } from './openaiService'

/**
 * 工作流需求分析结果
 */
export interface WorkflowRequirement {
  intent: string // 用户意图
  entities: string[] // 实体识别
  actions: string[] // 需要的操作
  dataFlow: string[] // 数据流向
  triggers: string[] // 触发器类型
  integrations: string[] // 需要的集成服务
}

/**
 * 节点推荐结果
 */
export interface NodeRecommendation {
  node: SearchResult
  reason: string // 推荐理由
  confidence: number // 置信度 0-1
  position: { x: number; y: number } // 建议位置
  connections: string[] // 建议连接的节点
}

/**
 * 工作流生成建议
 */
export interface WorkflowSuggestion {
  requirements: WorkflowRequirement
  recommendedNodes: NodeRecommendation[]
  workflowStructure: {
    trigger: NodeRecommendation
    processing: NodeRecommendation[]
    output: NodeRecommendation[]
  }
  estimatedComplexity: 'simple' | 'medium' | 'complex'
  tips: string[]
}

/**
 * 智能节点检索服务
 * 提供基于AI的节点推荐和工作流生成建议
 */
export class IntelligentNodeService {
  private openai: OpenAI | null = null

  private getClient(): OpenAI {
    this.openai ??= getOpenAIClient()
    return this.openai
  }

  /**
   * 分析用户需求，提取工作流要求
   * @param description 用户描述
   * @returns 工作流需求分析
   */
  async analyzeWorkflowRequirements(description: string): Promise<WorkflowRequirement> {
    try {
      const prompt = `
分析以下工作流需求描述，提取关键信息：

用户描述："${description}"

请以JSON格式返回分析结果，包含以下字段：
{
  "intent": "用户的主要意图",
  "entities": ["识别出的实体，如邮件、文件、数据库等"],
  "actions": ["需要执行的操作，如发送、处理、转换等"],
  "dataFlow": ["数据流向，如输入->处理->输出"],
  "triggers": ["触发器类型，如定时、webhook、手动等"],
  "integrations": ["需要的第三方服务，如Gmail、Slack、数据库等"]
}

只返回JSON，不要其他文字。
      `

      const response = await this.getClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的工作流分析师，擅长理解用户需求并提取关键信息。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('AI分析返回空结果')
      }

      // 解析JSON响应
      const requirements = JSON.parse(content) as WorkflowRequirement
      
      console.log('工作流需求分析完成:', requirements)
      return requirements

    } catch (error) {
      if (error instanceof AIConfigurationError) throw error
      console.error('工作流需求分析失败:', error)
      
      // 返回基础分析结果
      return {
        intent: '自动化工作流程',
        entities: [],
        actions: ['处理', '发送'],
        dataFlow: ['输入', '处理', '输出'],
        triggers: ['手动'],
        integrations: []
      }
    }
  }

  /**
   * 基于需求推荐节点
   * @param requirements 工作流需求
   * @param existingNodes 已有节点
   * @returns 节点推荐列表
   */
  async recommendNodes(
    requirements: WorkflowRequirement,
    existingNodes: string[] = []
  ): Promise<NodeRecommendation[]> {
    try {
      const recommendations: NodeRecommendation[] = []
      let yPosition = 100

      // 1. 推荐触发器节点
      if (requirements.triggers.length > 0) {
        const triggerQuery = `触发器 ${requirements.triggers.join(' ')} ${requirements.intent}`
        const triggerNodes = await vectorSearchService.searchNodes(triggerQuery, {
          limit: 3,
          threshold: 0.6,
          category: 'Trigger'
        })

        for (const node of triggerNodes) {
          if (!existingNodes.includes(node.nodeType)) {
            recommendations.push({
              node,
              reason: `适合作为${requirements.triggers.join('、')}触发器`,
              confidence: node.score,
              position: { x: 100, y: yPosition },
              connections: []
            })
            yPosition += 150
            break // 只推荐一个触发器
          }
        }
      }

      // 2. 推荐处理节点
      for (const action of requirements.actions) {
        const actionQuery = `${action} ${requirements.entities.join(' ')} ${requirements.intent}`
        const actionNodes = await vectorSearchService.searchNodes(actionQuery, {
          limit: 5,
          threshold: 0.5
        })

        for (const node of actionNodes.slice(0, 2)) { // 每个动作最多推荐2个节点
          if (!existingNodes.includes(node.nodeType)) {
            recommendations.push({
              node,
              reason: `用于执行${action}操作`,
              confidence: node.score,
              position: { x: 400, y: yPosition },
              connections: []
            })
            yPosition += 150
          }
        }
      }

      // 3. 推荐集成服务节点
      for (const integration of requirements.integrations) {
        const integrationQuery = `${integration} 集成 API`
        const integrationNodes = await vectorSearchService.searchNodes(integrationQuery, {
          limit: 3,
          threshold: 0.6
        })

        for (const node of integrationNodes.slice(0, 1)) { // 每个集成推荐1个节点
          if (!existingNodes.includes(node.nodeType)) {
            recommendations.push({
              node,
              reason: `集成${integration}服务`,
              confidence: node.score,
              position: { x: 700, y: yPosition },
              connections: []
            })
            yPosition += 150
          }
        }
      }

      // 4. 推荐通用工具节点
      const utilityQuery = `数据处理 转换 格式化 ${requirements.intent}`
      const utilityNodes = await vectorSearchService.searchNodes(utilityQuery, {
        limit: 3,
        threshold: 0.4
      })

      for (const node of utilityNodes.slice(0, 2)) {
        if (!existingNodes.includes(node.nodeType) && 
            !recommendations.some(r => r.node.nodeType === node.nodeType)) {
          recommendations.push({
            node,
            reason: '数据处理和转换工具',
            confidence: node.score * 0.8, // 降低通用工具的置信度
            position: { x: 400, y: yPosition },
            connections: []
          })
          yPosition += 150
        }
      }

      // 按置信度排序
      recommendations.sort((a, b) => b.confidence - a.confidence)

      console.log(`生成${recommendations.length}个节点推荐`)
      return recommendations.slice(0, 10) // 最多返回10个推荐

    } catch (error) {
      console.error('节点推荐失败:', error)
      return []
    }
  }

  /**
   * 生成完整的工作流建议
   * @param description 用户描述
   * @param existingNodes 已有节点
   * @returns 工作流建议
   */
  async generateWorkflowSuggestion(
    description: string,
    existingNodes: string[] = []
  ): Promise<WorkflowSuggestion> {
    try {
      console.log(`生成工作流建议: "${description}"`)

      // 1. 分析需求
      const requirements = await this.analyzeWorkflowRequirements(description)

      // 2. 推荐节点
      const recommendedNodes = await this.recommendNodes(requirements, existingNodes)

      // 3. 构建工作流结构
      const workflowStructure = this.buildWorkflowStructure(recommendedNodes)

      // 4. 评估复杂度
      const estimatedComplexity = this.estimateComplexity(requirements, recommendedNodes)

      // 5. 生成使用提示
      const tips = await this.generateUsageTips(requirements, recommendedNodes)

      const suggestion: WorkflowSuggestion = {
        requirements,
        recommendedNodes,
        workflowStructure,
        estimatedComplexity,
        tips
      }

      console.log('工作流建议生成完成')
      return suggestion

    } catch (error) {
      console.error('生成工作流建议失败:', error)
      throw new Error('工作流建议生成失败')
    }
  }

  /**
   * 构建工作流结构
   * @param recommendations 推荐节点列表
   * @returns 工作流结构
   */
  private buildWorkflowStructure(recommendations: NodeRecommendation[]) {
    const trigger = recommendations.find(r => 
      r.node.category === 'Trigger' || 
      r.node.nodeType.toLowerCase().includes('trigger')
    )

    const processing = recommendations.filter(r => 
      r.node.category !== 'Trigger' && 
      !r.node.nodeType.toLowerCase().includes('output') &&
      !r.node.nodeType.toLowerCase().includes('send')
    )

    const output = recommendations.filter(r => 
      r.node.nodeType.toLowerCase().includes('output') ||
      r.node.nodeType.toLowerCase().includes('send') ||
      r.node.nodeType.toLowerCase().includes('email') ||
      r.node.nodeType.toLowerCase().includes('webhook')
    )

    return {
      trigger: trigger || recommendations[0],
      processing: processing.slice(0, 5),
      output: output.slice(0, 2)
    }
  }

  /**
   * 评估工作流复杂度
   * @param requirements 需求分析
   * @param recommendations 推荐节点
   * @returns 复杂度等级
   */
  private estimateComplexity(
    requirements: WorkflowRequirement,
    recommendations: NodeRecommendation[]
  ): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0

    // 基于需求复杂度评分
    complexityScore += requirements.actions.length * 2
    complexityScore += requirements.integrations.length * 3
    complexityScore += requirements.entities.length
    complexityScore += recommendations.length

    if (complexityScore <= 5) return 'simple'
    if (complexityScore <= 15) return 'medium'
    return 'complex'
  }

  /**
   * 生成使用提示
   * @param requirements 需求分析
   * @param recommendations 推荐节点
   * @returns 提示列表
   */
  private async generateUsageTips(
    requirements: WorkflowRequirement,
    recommendations: NodeRecommendation[]
  ): Promise<string[]> {
    const tips: string[] = []

    // 基础提示
    if (recommendations.length > 0) {
      tips.push('建议按照推荐的节点顺序构建工作流')
    }

    if (requirements.integrations.length > 0) {
      tips.push(`需要配置${requirements.integrations.join('、')}的API密钥`)
    }

    if (requirements.triggers.includes('定时')) {
      tips.push('定时触发器需要设置合适的执行频率')
    }

    if (requirements.actions.includes('发送邮件')) {
      tips.push('邮件发送节点需要配置SMTP服务器信息')
    }

    // 数据流提示
    if (requirements.dataFlow.length > 2) {
      tips.push('注意数据在节点间的传递格式和字段映射')
    }

    return tips
  }

  /**
   * 获取节点的详细配置建议
   * @param nodeType 节点类型
   * @param context 上下文
   * @returns 配置建议
   */
  async getNodeConfigSuggestions(
    nodeType: string,
    context: string
  ): Promise<Record<string, unknown>> {
    try {
      const prompt = `
为n8n工作流中的"${nodeType}"节点提供配置建议。

上下文：${context}

请以JSON格式返回配置建议，包含常用参数的推荐值。
只返回JSON，不要其他文字。
      `

      const response = await this.getClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是n8n工作流专家，熟悉各种节点的配置参数。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })

      const content = response.choices[0]?.message?.content
      if (content) {
        return JSON.parse(content)
      }

      return {}

    } catch (error) {
      if (error instanceof AIConfigurationError) throw error
      console.error('获取节点配置建议失败:', error)
      return {}
    }
  }
}

// 导出单例实例
export const intelligentNodeService = new IntelligentNodeService()
