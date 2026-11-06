import express from 'express'
import { intelligentNodeService } from '../services/intelligentNodeService'
import { IntelligentWorkflowGenerator } from '../services/intelligentWorkflowGenerator'
import { ApiResponse, WorkflowGenerateResponse } from '@/shared/types'
import type { WorkflowGenerateRequest } from '@/shared/types'
import { normalizeWorkflowRequest } from '../utils/workflowRequest'

function isAIConfigurationError(error: unknown): boolean {
  return error instanceof Error && /(?:OPENAI|GEMINI|GROK)_API_KEY.*(?:未设置|未配置)/.test(error.message)
}

function sendWorkflowError(res: express.Response, error: unknown, fallback: string) {
  if (isAIConfigurationError(error)) {
    return res.status(503).json({
      success: false,
      error: 'AI 服务尚未配置，请先设置服务端 API 密钥',
      code: 'AI_SERVICE_UNAVAILABLE',
    })
  }
  const message = error instanceof Error ? error.message : fallback
  return res.status(500).json({ success: false, error: message } as ApiResponse<null>)
}

// 初始化智能工作流生成器
const intelligentGenerator = new IntelligentWorkflowGenerator()

const router = express.Router()

/**
 * 生成工作流 - 增强版
 * @route POST /api/workflow/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const request = req.body as WorkflowGenerateRequest
    const { description } = request

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ success: false, error: '工作流描述不能为空' } as ApiResponse<null>)
    }
    if (description.trim().length < 10) {
      return res.status(400).json({ success: false, error: '工作流描述过于简短，请至少输入 10 个字符' } as ApiResponse<null>)
    }

    // 使用智能工作流生成器
    const generateRequest = normalizeWorkflowRequest(request)
    const { complexity, useEnhancedPrompt, requirements, constraints } = generateRequest

    console.log(`开始生成智能工作流: "${description}"`, {
      complexity,
      useEnhancedPrompt,
      requirementsCount: requirements?.length || 0,
      constraintsCount: constraints?.length || 0
    })

    const result = await intelligentGenerator.generateWorkflow(generateRequest)
    
    const data: WorkflowGenerateResponse = {
      workflow: result.workflow,
      meta: {
        nodesUsed: result.meta.nodesUsed,
        connectionsCreated: result.meta.connectionsCreated,
        complexity: result.meta.complexity,
        estimatedExecutionTime: result.meta.estimatedExecutionTime,
        recommendedNodes: result.meta.recommendedNodes,
        generationTime: result.meta.generationTime,
        confidence: result.meta.confidence
      }
    }
    
    res.json({ success: true, data } as ApiResponse<WorkflowGenerateResponse>)
  } catch (error) {
    console.error('生成工作流失败:', error)
    return sendWorkflowError(res, error, '生成失败')
  }
})

/**
 * 获取智能节点推荐
 * @route POST /api/workflow/recommend-nodes
 */
router.post('/recommend-nodes', async (req, res) => {
  try {
    const { description, existingNodes = [] } = req.body
    
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '工作流描述不能为空' 
      } as ApiResponse<null>)
    }

    if (description.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        error: '工作流描述过于简短，请至少输入 5 个字符' 
      } as ApiResponse<null>)
    }

    console.log(`接收到节点推荐请求: "${description}"`)

    // 分析需求并推荐节点
    const requirements = await intelligentNodeService.analyzeWorkflowRequirements(description)
    const recommendations = await intelligentNodeService.recommendNodes(requirements, existingNodes)

    res.json({
      success: true,
      data: {
        description,
        requirements,
        recommendations,
        total: recommendations.length
      }
    } as ApiResponse<unknown>)

  } catch (error) {
    console.error('节点推荐失败:', error)
    return sendWorkflowError(res, error, '节点推荐失败')
  }
})

/**
 * 生成完整工作流建议
 * @route POST /api/workflow/suggest
 */
router.post('/suggest', async (req, res) => {
  try {
    const { description, existingNodes = [] } = req.body
    
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '工作流描述不能为空' 
      } as ApiResponse<null>)
    }

    if (description.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: '工作流描述过于简短，请至少输入 10 个字符' 
      } as ApiResponse<null>)
    }

    console.log(`接收到工作流建议请求: "${description}"`)

    // 生成完整的工作流建议
    const suggestion = await intelligentNodeService.generateWorkflowSuggestion(description, existingNodes)

    res.json({
      success: true,
      data: suggestion
    } as ApiResponse<unknown>)

  } catch (error) {
    console.error('工作流建议生成失败:', error)
    return sendWorkflowError(res, error, '工作流建议生成失败')
  }
})

/**
 * 获取节点配置建议
 * @route POST /api/workflow/node-config
 */
router.post('/node-config', async (req, res) => {
  try {
    const { nodeType, context = '' } = req.body
    
    if (!nodeType || typeof nodeType !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '节点类型不能为空' 
      } as ApiResponse<null>)
    }

    console.log(`获取节点配置建议: ${nodeType}`)

    // 获取节点配置建议
    const configSuggestions = await intelligentNodeService.getNodeConfigSuggestions(nodeType, context)

    res.json({
      success: true,
      data: {
        nodeType,
        context,
        suggestions: configSuggestions
      }
    } as ApiResponse<unknown>)

  } catch (error) {
    console.error('获取节点配置建议失败:', error)
    return sendWorkflowError(res, error, '获取节点配置建议失败')
  }
})

export default router
