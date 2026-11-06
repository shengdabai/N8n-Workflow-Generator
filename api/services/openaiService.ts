import OpenAI from 'openai'
import { N8nWorkflow, WorkflowGenerationRequest } from '@/shared/types'
import fs from 'fs/promises'
import path from 'path'
import { normalizeConnections } from '../../shared/workflowConnections'

interface NodeReferenceEntry { description: string; parameters: unknown }
interface PatternReferenceEntry { description: string; nodes: string[] }
type WorkflowDraftNode = Record<string, unknown> & {
  id?: unknown; name?: unknown; type?: unknown; typeVersion?: unknown;
  position?: unknown; parameters?: unknown;
}
type WorkflowDraft = Record<string, unknown> & {
  name?: unknown; nodes?: WorkflowDraftNode[]; connections?: Record<string, unknown>;
  active?: unknown; settings?: unknown; staticData?: unknown;
}

// OpenAI客户端实例
let openaiClient: OpenAI | null = null

export class AIConfigurationError extends Error {
  constructor() {
    super('OPENAI_API_KEY环境变量未设置')
    this.name = 'AIConfigurationError'
  }
}

/**
 * 初始化OpenAI客户端
 * @returns {OpenAI} OpenAI客户端实例
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new AIConfigurationError()
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey,
    })
  }
  
  return openaiClient
}

/**
 * 生成n8n工作流的系统提示词
 * @returns {string} 系统提示词
 */
async function getSystemPrompt(): Promise<string> {
  try {
    // 读取节点参考文件
    const referencePath = path.join(process.cwd(), 'data', 'n8n-nodes-reference.json')
    const referenceData = await fs.readFile(referencePath, 'utf-8')
    const nodeReference = JSON.parse(referenceData)
    
    return `你是一个专业的n8n工作流自动化专家。你的任务是根据用户的自然语言描述，生成完整且符合n8n官方标准的工作流配置。

## 重要规则：
1. 必须严格遵循n8n官方JSON格式
2. 节点ID必须唯一且有意义
3. 节点位置要合理布局（从左到右，间距200px）
4. 连接关系必须正确且完整
5. 参数配置必须符合节点类型要求
6. 包含适当的错误处理和数据验证

请严格按照以下JSON格式返回工作流配置：

{
  "name": "工作流名称",
  "nodes": [
    {
      "id": "唯一节点ID",
      "name": "节点显示名称",
      "type": "节点类型",
      "typeVersion": 1,
      "position": [x坐标, y坐标],
      "parameters": {
        // 节点参数配置 - 必须符合节点类型要求
      }
    }
  ],
  "connections": {
    "节点ID": {
      "main": [
        [
          {
            "node": "目标节点ID",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "settings": {},
  "staticData": {},
  "meta": {
    "createdAt": "${new Date().toISOString()}",
    "generatedBy": "n8n-workflow-generator",
    "version": "1.0.0"
  }
}

## 节点布局规则：
- 起始节点位置: [20, 20]
- 水平间距: 200px
- 垂直间距: 100px（分支时使用）
- 确保所有节点可见且不重叠

## 可用的n8n节点类型和参数：

### 触发器节点：
${(Object.entries(nodeReference.nodeTypes.triggers) as Array<[string, NodeReferenceEntry]>).map(([type, info]) => 
  `- ${type}: ${info.description}\n  参数: ${JSON.stringify(info.parameters, null, 2)}`
).join('\n')}

### 操作节点：
${(Object.entries(nodeReference.nodeTypes.actions) as Array<[string, NodeReferenceEntry]>).map(([type, info]) => 
  `- ${type}: ${info.description}\n  参数: ${JSON.stringify(info.parameters, null, 2)}`
).join('\n')}

### 逻辑节点：
${(Object.entries(nodeReference.nodeTypes.logic) as Array<[string, NodeReferenceEntry]>).map(([type, info]) => 
  `- ${type}: ${info.description}\n  参数: ${JSON.stringify(info.parameters, null, 2)}`
).join('\n')}

### 数据库节点：
${(Object.entries(nodeReference.nodeTypes.databases || {}) as Array<[string, NodeReferenceEntry]>).map(([type, info]) => 
  `- ${type}: ${info.description}\n  参数: ${JSON.stringify(info.parameters, null, 2)}`
).join('\n')}

### 集成节点：
${(Object.entries(nodeReference.nodeTypes.integrations || {}) as Array<[string, NodeReferenceEntry]>).map(([type, info]) => 
  `- ${type}: ${info.description}\n  参数: ${JSON.stringify(info.parameters, null, 2)}`
).join('\n')}

## 最佳实践：
- ${nodeReference.bestPractices.nodeNaming}
- ${nodeReference.bestPractices.errorHandling}
- ${nodeReference.bestPractices.dataValidation}
- ${nodeReference.bestPractices.positioning}

## 常见模式：
${(Object.entries(nodeReference.commonPatterns) as Array<[string, PatternReferenceEntry]>).map(([pattern, info]) => 
  `- ${pattern}: ${info.description} (使用节点: ${info.nodes.join(', ')})`
).join('\n')}

请确保：
1. 每个工作流都有一个适当的触发节点（start、webhook、cron等）
2. 节点ID必须唯一，使用描述性名称
3. 节点位置合理分布，从左到右排列
4. 连接关系正确，确保数据流向清晰
5. 参数配置符合节点要求，使用实际可用的参数
6. 只返回JSON格式，不要包含其他文本
7. 生成的工作流应该是完整的、可执行的`
  } catch (error) {
    console.warn('无法读取节点参考文件，使用基础提示词:', error)
    return getBasicSystemPrompt()
  }
}

/**
 * 基础系统提示词（备用）
 * @returns {string} 基础系统提示词
 */
function getBasicSystemPrompt(): string {
  return `你是一个专业的n8n工作流自动化专家。你的任务是根据用户的自然语言描述，生成完整的n8n工作流配置。

请严格按照以下JSON格式返回工作流配置：

{
  "name": "工作流名称",
  "nodes": [
    {
      "id": "唯一节点ID",
      "name": "节点显示名称",
      "type": "节点类型",
      "typeVersion": 1,
      "position": [x坐标, y坐标],
      "parameters": {
        // 节点参数配置
      }
    }
  ],
  "connections": {
    "节点ID": {
      "main": [
        [
          {
            "node": "目标节点ID",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "settings": {},
  "staticData": {}
}

常用的n8n节点类型包括：
- n8n-nodes-base.start: 开始节点
- n8n-nodes-base.httpRequest: HTTP请求
- n8n-nodes-base.webhook: Webhook触发器
- n8n-nodes-base.cron: 定时触发器
- n8n-nodes-base.emailSend: 发送邮件
- n8n-nodes-base.slack: Slack集成
- n8n-nodes-base.googleSheets: Google表格
- n8n-nodes-base.mysql: MySQL数据库
- n8n-nodes-base.function: JavaScript代码
- n8n-nodes-base.if: 条件判断
- n8n-nodes-base.set: 设置数据
- n8n-nodes-base.merge: 合并数据

请确保：
1. 每个工作流都有一个开始节点
2. 节点ID必须唯一
3. 节点位置合理分布
4. 连接关系正确
5. 参数配置符合节点要求
6. 只返回JSON格式，不要包含其他文本`
}

/**
 * 使用OpenAI API生成n8n工作流
 * @param {WorkflowGenerationRequest} request - 工作流生成请求
 * @returns {Promise<N8nWorkflow>} 生成的n8n工作流配置
 */
export async function generateWorkflow(request: WorkflowGenerationRequest): Promise<N8nWorkflow> {
  try {
    const client = getOpenAIClient()
    const model = process.env.OPENAI_MODEL || 'gpt-4'
    
    console.log('🤖 开始生成工作流:', request.description)
    
    // 构建增强的用户提示词
    let userPrompt = `请为以下需求生成n8n工作流配置：\n\n${request.description}`
    
    // 添加具体要求
    userPrompt += `\n\n## 具体要求：
1. 确保所有节点ID使用有意义的名称（如：webhook_trigger, http_request_data, process_data等）
2. 节点位置从左到右排列，起始位置[20, 20]，水平间距200px
3. 所有参数必须完整且符合n8n标准
4. 包含适当的错误处理节点（如需要）
5. 连接关系必须完整且正确`
    
    // 添加用户偏好设置
    if (request.preferences) {
      userPrompt += `\n\n## 用户偏好设置：`
      if (request.preferences.preferredNodes?.length) {
        userPrompt += `\n- 优先使用节点: ${request.preferences.preferredNodes.join(', ')}`
      }
      if (request.preferences.complexity) {
        userPrompt += `\n- 复杂度要求: ${request.preferences.complexity}`
      }
      if (request.preferences.includeErrorHandling) {
        userPrompt += `\n- 需要包含错误处理`
      }
    }
    
    // 添加需求分析
    if (request.requirements?.length) {
      userPrompt += `\n\n## 功能需求：\n${request.requirements.map(req => `- ${req}`).join('\n')}`
    }
    
    // 调用OpenAI API，使用更高的temperature以获得更好的创造性
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: await getSystemPrompt()
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3, // 降低temperature以获得更一致的结果
      max_tokens: 4000,
      response_format: { type: "json_object" } // 确保返回JSON格式
    })
    
    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('OpenAI API返回空响应')
    }
    
    console.log('🤖 OpenAI原始响应长度:', response.length)
    
    // 解析JSON响应
    let workflowConfig: N8nWorkflow
    
    // 兜底构造函数：当解析失败时生成一个最简工作流
    const buildFallbackWorkflow = (description: string): N8nWorkflow => {
      const nodes = [
        {
          id: 'cron_1',
          name: 'Cron 1',
          type: 'n8n-nodes-base.cron',
          typeVersion: 1,
          position: [20, 20],
        },
        {
          id: 'http_request_2',
          name: 'HTTP Request 2',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [220, 20],
        },
        {
          id: 'set_3',
          name: 'Set 3',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [420, 20],
        }
      ]
      const connections = {
        cron_1: { main: [[{ node: 'http_request_2', type: 'main', index: 0 }]] },
        http_request_2: { main: [[{ node: 'set_3', type: 'main', index: 0 }]] }
      }
      return {
        name: '自动生成的工作流',
        nodes,
        connections,
        active: false,
        settings: {},
        staticData: {},
        meta: { originalDescription: description }
      } as unknown as N8nWorkflow
    }
    
    try {
      // 尝试直接解析JSON
      workflowConfig = JSON.parse(response.trim())
    } catch (parseError) {
      console.error('JSON解析失败:', parseError)
      console.error('原始响应前500字符:', response.substring(0, 500))
      
      // 优先尝试提取markdown代码块中的JSON
      const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (fenceMatch) {
        const raw = fenceMatch[1].trim()
        try {
          workflowConfig = JSON.parse(raw)
        } catch {
          // 常见错误修复：移除尾逗号
          const repaired = raw.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']')
          workflowConfig = JSON.parse(repaired)
        }
      } else {
        // 回退：使用大括号贪婪匹配提取可能的JSON片段
        const braceMatch = response.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          const raw = braceMatch[0]
          try {
            workflowConfig = JSON.parse(raw)
          } catch {
            // 再次尝试尾逗号修复
            const repaired = raw.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']')
            workflowConfig = JSON.parse(repaired)
          }
        } else {
          console.warn('无法解析OpenAI返回的工作流配置，已使用兜底模板')
          workflowConfig = buildFallbackWorkflow(request.description)
        }
      }
    }
    
    // 规范化工作流配置
    workflowConfig = normalizeWorkflowConfig(workflowConfig)

    // 验证工作流配置
    validateWorkflowConfig(workflowConfig)
    
    // 添加元数据
    if (!workflowConfig.meta) {
      workflowConfig.meta = {}
    }
    workflowConfig.meta = {
      ...workflowConfig.meta,
      createdAt: new Date().toISOString(),
      generatedBy: 'n8n-workflow-generator',
      originalDescription: request.description,
      version: '1.0.0'
    }
    
    console.log('✅ 工作流生成成功:', workflowConfig.name)
    console.log('📊 节点数量:', workflowConfig.nodes?.length || 0)
    
    return workflowConfig
    
  } catch (error) {
    console.error('工作流生成失败:', error)
    
    if (error instanceof Error) {
      // 处理特定的OpenAI错误
      if (error.message.includes('API key')) {
        throw new Error('OpenAI API密钥配置错误')
      }
      if (error.message.includes('quota')) {
        throw new Error('OpenAI API配额已用完')
      }
      if (error.message.includes('rate limit')) {
        throw new Error('OpenAI API请求频率限制')
      }
      if (error.message.includes('model')) {
        throw new Error('OpenAI模型配置错误')
      }
    }
    
    throw error
  }
}

/**
 * 规范化工作流配置，确保节点位置为 [x, y] 数组并填充默认值
 * @param config - 原始工作流配置
 * @returns 规范化后的工作流配置
 */
export function normalizeWorkflowConfig(input: unknown): N8nWorkflow {
  const config = (input && typeof input === 'object' ? input : {}) as WorkflowDraft
  // 若整体结构异常，仍然尝试补齐名称以避免后续验证失败
  if (!config || !Array.isArray(config.nodes)) {
    if (!config?.name || typeof config.name !== 'string') {
      config.name = '自动生成的工作流'
    }
    return config as unknown as N8nWorkflow
  }
  const startX = 20
  const startY = 20
  const spacing = 200
  
  // 先规范化节点：位置、typeVersion、id，并补齐缺失的 name
  config.nodes = config.nodes.map((node: WorkflowDraftNode, index: number) => {
    const n = { ...node }
    
    // normalize position: 支持 { x, y } 形式，最终统一为 [x, y]
    if (Array.isArray(n.position) && n.position.length === 2 &&
        typeof n.position[0] === 'number' && typeof n.position[1] === 'number') {
      // already valid
    } else if (n.position && typeof n.position === 'object') {
      const position = n.position as { x?: unknown; y?: unknown }
      n.position = typeof position.x === 'number' && typeof position.y === 'number'
        ? [position.x, position.y]
        : [startX + index * spacing, startY]
    } else {
      n.position = [startX + index * spacing, startY]
    }
    
    // default typeVersion
    if (typeof n.typeVersion !== 'number') {
      n.typeVersion = 1
    }
    
    // ensure id string
    if (!n.id || typeof n.id !== 'string') {
      const base = (n.name || n.type || 'node').toString().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
      n.id = `${base}_${index + 1}`
    }
    
    // ensure name string（基于类型生成可读名称，如缺失）
    if (!n.name || typeof n.name !== 'string' || !n.name.trim()) {
      const typeBase = (n.type || 'node').toString()
        .replace(/^n8n-nodes-/, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
      const suffix = index + 1
      const humanName = typeBase ? `${typeBase} ${suffix}` : `节点 ${suffix}`
      n.name = humanName
    }
    
    // ensure type string（基于名称的启发式匹配，否则使用通用 Set）
    if (!n.type || typeof n.type !== 'string' || !n.type.trim()) {
      const nameLower = String(n.name).toLowerCase()
      if (nameLower.includes('cron') || nameLower.includes('schedule') || nameLower.includes('定时')) {
        n.type = 'n8n-nodes-base.cron'
      } else if (nameLower.includes('http') || nameLower.includes('request') || nameLower.includes('api')) {
        n.type = 'n8n-nodes-base.httpRequest'
      } else if (nameLower.includes('webhook')) {
        n.type = 'n8n-nodes-base.webhook'
      } else if (nameLower.includes('function') || nameLower.includes('code') || nameLower.includes('函数')) {
        n.type = 'n8n-nodes-base.function'
      } else if (nameLower.includes('set')) {
        n.type = 'n8n-nodes-base.set'
      } else {
        n.type = 'n8n-nodes-base.set'
      }
    }
    
    return n
  })
  
  const normalizationWarnings: string[] = []
  config.connections = normalizeConnections(config.nodes as N8nWorkflow['nodes'], config.connections ?? {}, 'id', true, { warnings: normalizationWarnings })
  if (normalizationWarnings.length) {
    const meta = config.meta && typeof config.meta === 'object' && !Array.isArray(config.meta) ? config.meta : {}
    config.meta = { ...meta, normalizationWarnings }
  }

  // 补齐工作流标题，避免验证器抛错
  if (!config.name || typeof config.name !== 'string') {
    config.name = '自动生成的工作流'
  }
  
  return config as unknown as N8nWorkflow
}

/**
 * 验证工作流配置的基本结构
 * @param {any} config - 待验证的配置
 */
function validateWorkflowConfig(config: N8nWorkflow): void {
  // 基本结构验证
  if (!config || typeof config !== 'object') {
    throw new Error('工作流配置必须是一个对象')
  }
  
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('工作流必须有一个有效的名称')
  }
  
  if (!Array.isArray(config.nodes)) {
    throw new Error('工作流必须包含节点数组')
  }
  
  if (config.nodes.length === 0) {
    throw new Error('工作流至少需要包含一个节点')
  }
  
  // 验证节点结构
  const nodeIds = new Set<string>()
  for (const node of config.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new Error('每个节点必须有一个有效的ID')
    }
    
    if (nodeIds.has(node.id)) {
      throw new Error(`节点ID重复: ${node.id}`)
    }
    nodeIds.add(node.id)
    
    if (!node.name || typeof node.name !== 'string') {
      throw new Error(`节点 ${node.id} 必须有一个有效的名称`)
    }
    
    if (!node.type || typeof node.type !== 'string') {
      throw new Error(`节点 ${node.id} 必须有一个有效的类型`)
    }
    
    if (!Array.isArray(node.position) || node.position.length !== 2) {
      throw new Error(`节点 ${node.id} 必须有有效的位置坐标 [x, y]`)
    }
    
    if (typeof node.position[0] !== 'number' || typeof node.position[1] !== 'number') {
      throw new Error(`节点 ${node.id} 的位置坐标必须是数字`)
    }
    
    // 验证节点类型格式
    if (!node.type.startsWith('n8n-nodes-')) {
      console.warn(`警告: 节点 ${node.id} 的类型 ${node.type} 可能不是标准的n8n节点类型`)
    }
    
    // 验证typeVersion
    if (node.typeVersion && typeof node.typeVersion !== 'number') {
      throw new Error(`节点 ${node.id} 的typeVersion必须是数字`)
    }
  }
  
  // 验证连接结构
  if (!config.connections || typeof config.connections !== 'object') {
    throw new Error('工作流必须包含连接配置对象')
  }
  
  normalizeConnections(config.nodes, config.connections)

  // 验证必需的属性
  if (typeof config.active !== 'boolean') {
    console.warn('警告: 工作流的active属性应该是布尔值，已设置为false')
    config.active = false
  }
  
  if (!config.settings || typeof config.settings !== 'object') {
    console.warn('警告: 工作流缺少settings对象，已添加空对象')
    config.settings = {}
  }
  
  if (!config.staticData || typeof config.staticData !== 'object') {
    console.warn('警告: 工作流缺少staticData对象，已添加空对象')
    config.staticData = {}
  }
  
  console.log('✅ 工作流配置验证通过')
}

/**
 * 使用自定义提示生成n8n工作流
 * @param {string} customPrompt - 自定义提示文本
 * @returns {Promise<N8nWorkflow>} 生成的n8n工作流配置
 */
export async function generateWorkflowWithPrompt(customPrompt: string): Promise<N8nWorkflow> {
  try {
    const client = getOpenAIClient()
    const model = process.env.OPENAI_MODEL || 'gpt-4'
    
    console.log('🤖 使用自定义提示生成工作流')
    
    // 调用OpenAI API
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: await getSystemPrompt()
        },
        {
          role: 'user',
          content: customPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })
    
    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('OpenAI API返回空响应')
    }
    
    console.log('🤖 OpenAI原始响应长度:', response.length)
    
    // 解析JSON响应
    let workflowConfig: N8nWorkflow
    
    try {
      workflowConfig = JSON.parse(response.trim())
    } catch (parseError) {
      console.error('JSON解析失败:', parseError)
      
      // 尝试提取markdown代码块中的JSON
      const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (fenceMatch) {
        const raw = fenceMatch[1].trim()
        try {
          workflowConfig = JSON.parse(raw)
        } catch {
          const repaired = raw.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']')
          workflowConfig = JSON.parse(repaired)
        }
      } else {
        const braceMatch = response.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          const raw = braceMatch[0]
          try {
            workflowConfig = JSON.parse(raw)
          } catch {
            const repaired = raw.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']')
            workflowConfig = JSON.parse(repaired)
          }
        } else {
          throw new Error('无法解析OpenAI返回的工作流配置')
        }
      }
    }
    
    // 规范化工作流配置
    workflowConfig = normalizeWorkflowConfig(workflowConfig)
    
    // 验证工作流配置
    validateWorkflowConfig(workflowConfig)
    
    // 添加元数据
    if (!workflowConfig.meta) {
      workflowConfig.meta = {}
    }
    workflowConfig.meta = {
      ...workflowConfig.meta,
      createdAt: new Date().toISOString(),
      generatedBy: 'n8n-workflow-generator-enhanced',
      version: '1.0.0',
      enhancedPrompt: true
    }
    
    console.log('✅ 增强工作流生成成功:', workflowConfig.name)
    console.log('📊 节点数量:', workflowConfig.nodes?.length || 0)
    
    return workflowConfig
    
  } catch (error) {
    console.error('增强工作流生成失败:', error)
    throw error
  }
}

/**
 * 优化工作流描述，提高AI理解准确性
 * @param {string} description - 原始描述
 * @returns {Promise<string>} 优化后的描述
 */
export async function optimizeDescription(description: string): Promise<string> {
  try {
    const client = getOpenAIClient()
    
    // 优先使用环境变量指定的模型，默认使用较新的GPT-4系列模型
    const model = process.env.OPENAI_MODEL || 'gpt-4'

    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: '你是一个n8n工作流专家。请将用户的模糊描述转换为更清晰、更具体的工作流需求描述。保持原意，但增加技术细节和实现步骤。'
        },
        {
          role: 'user',
          content: `请优化以下工作流描述，使其更适合自动化实现：\n\n${description}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })
    
    return completion.choices[0]?.message?.content || description
  } catch (error) {
    console.error('描述优化失败:', error)
    // 失败时直接返回原始描述，避免影响主流程
    return description
  }
}

/**
 * 基于图片和文本描述生成n8n工作流
 * @param {string} description - 文本描述
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<N8nWorkflow>} 生成的n8n工作流配置
 */
export async function generateWorkflowWithImage(description: string, imagePath: string): Promise<N8nWorkflow> {
  try {
    const client = getOpenAIClient()
    const model = process.env.OPENAI_MODEL || 'gpt-4-vision-preview'
    
    console.log('🤖 开始基于图片和文本生成工作流:', description)
    console.log('🖼️ 图片路径:', imagePath)
    
    // 读取图片文件并转换为base64
    const imageBuffer = await fs.readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: await getSystemPrompt() + `

特别注意：你现在需要同时分析用户提供的参考图片和文本描述。
- 图片可能包含现有的工作流结构、节点类型、连接关系等信息
- 请结合图片中的工作流结构和用户的文本描述来生成新的工作流
- 如果图片显示的是n8n工作流截图，请参考其节点类型和连接方式
- 确保生成的工作流既符合图片中的结构思路，又满足文本描述的功能需求`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请基于以下描述和参考图片生成n8n工作流：\n\n${description}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    })
    
    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('OpenAI API返回空响应')
    }
    
    console.log('🤖 OpenAI响应:', response.substring(0, 200) + '...')
    
    // 解析JSON响应
    let workflowConfig
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        workflowConfig = JSON.parse(jsonMatch[0])
      } else {
        workflowConfig = JSON.parse(response)
      }
    } catch (parseError) {
      console.error('JSON解析失败:', parseError)
      console.error('原始响应:', response)
      throw new Error('生成的工作流配置格式无效')
    }

    // 新增：规范化节点位置等，确保通过验证
    workflowConfig = normalizeWorkflowConfig(workflowConfig)

    // 验证工作流配置
    validateWorkflowConfig(workflowConfig)
    
    console.log('✅ 工作流配置验证通过')
    return workflowConfig as N8nWorkflow
    
  } catch (error) {
    console.error('❌ 工作流生成失败:', error)
    throw error
  }
}
