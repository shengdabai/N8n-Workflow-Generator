import express from 'express'
import { promptEngineService } from '../services/promptEngineService'

const router = express.Router()

/**
 * 优化用户描述
 * @route POST /api/prompt-engine/optimize-description
 */
router.post('/optimize-description', async (req, res) => {
  try {
    const { description } = req.body

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '描述不能为空' 
      })
    }

    if (description.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        error: '描述过于简短，请至少输入5个字符' 
      })
    }

    const optimizedDescription = await promptEngineService.optimizeDescription(description)

    res.json({
      success: true,
      data: {
        originalDescription: description,
        optimizedDescription,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('描述优化失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '描述优化失败' 
    })
  }
})

/**
 * 生成工作流提示
 * @route POST /api/prompt-engine/generate-workflow-prompt
 */
router.post('/generate-workflow-prompt', async (req, res) => {
  try {
    const { 
      description, 
      context, 
      requirements, 
      constraints, 
      preferredNodes, 
      avoidNodes, 
      complexity = 'medium' 
    } = req.body

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '工作流描述不能为空' 
      })
    }

    const options = {
      includeContext: true,
      includeNodeList: true,
      includeExamples: true
    }

    const prompt = await promptEngineService.generateWorkflowPrompt({
      description,
      context,
      requirements,
      constraints,
      preferredNodes,
      avoidNodes,
      complexity
    }, options)

    res.json({
      success: true,
      data: {
        prompt,
        metadata: {
          complexity,
          requirementsCount: requirements?.length || 0,
          constraintsCount: constraints?.length || 0,
          preferredNodesCount: preferredNodes?.length || 0,
          timestamp: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('工作流提示生成失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '工作流提示生成失败' 
    })
  }
})

/**
 * 生成节点推荐提示
 * @route POST /api/prompt-engine/generate-node-recommendation-prompt
 */
router.post('/generate-node-recommendation-prompt', async (req, res) => {
  try {
    const { description, context = '' } = req.body

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '场景描述不能为空' 
      })
    }

    const prompt = await promptEngineService.generateNodeRecommendationPrompt(
      description, 
      context
    )

    res.json({
      success: true,
      data: {
        prompt,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('节点推荐提示生成失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '节点推荐提示生成失败' 
    })
  }
})

/**
 * 分析工作流
 * @route POST /api/prompt-engine/analyze-workflow
 */
router.post('/analyze-workflow', async (req, res) => {
  try {
    const { workflow } = req.body

    if (!workflow || typeof workflow !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '工作流配置不能为空' 
      })
    }

    const analysis = await promptEngineService.analyzeWorkflow(workflow)

    res.json({
      success: true,
      data: {
        analysis,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('工作流分析失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '工作流分析失败' 
    })
  }
})

/**
 * 获取所有提示模板
 * @route GET /api/prompt-engine/templates
 */
router.get('/templates', async (_req, res) => {
  try {
    const templates = promptEngineService.getAllTemplates()

    res.json({
      success: true,
      data: {
        templates,
        count: templates.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取模板失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '获取模板失败' 
    })
  }
})

/**
 * 获取特定提示模板
 * @route GET /api/prompt-engine/templates/:templateId
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params

    if (!templateId) {
      return res.status(400).json({ 
        success: false, 
        error: '模板ID不能为空' 
      })
    }

    const template = promptEngineService.getTemplate(templateId)

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: '模板未找到' 
      })
    }

    res.json({
      success: true,
      data: {
        template,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取模板失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '获取模板失败' 
    })
  }
})

/**
 * 添加自定义模板
 * @route POST /api/prompt-engine/templates
 */
router.post('/templates', async (req, res) => {
  try {
    const { template } = req.body

    if (!template || typeof template !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '模板配置不能为空' 
      })
    }

    // 验证必需字段
    const requiredFields = ['id', 'name', 'description', 'template', 'variables', 'category']
    for (const field of requiredFields) {
      if (!template[field]) {
        return res.status(400).json({ 
          success: false, 
          error: `模板缺少必需字段: ${field}` 
        })
      }
    }

    promptEngineService.addTemplate(template)

    res.json({
      success: true,
      data: {
        message: '模板添加成功',
        templateId: template.id,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('添加模板失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '添加模板失败' 
    })
  }
})

/**
 * 生成动态提示
 * @route POST /api/prompt-engine/generate-dynamic-prompt
 */
router.post('/generate-dynamic-prompt', async (req, res) => {
  try {
    const { 
      basePrompt, 
      context = {}, 
      enhancementType = 'detailed' 
    } = req.body

    if (!basePrompt || typeof basePrompt !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '基础提示不能为空' 
      })
    }

    if (!['detailed', 'concise', 'technical'].includes(enhancementType)) {
      return res.status(400).json({ 
        success: false, 
        error: '增强类型必须是 detailed、concise 或 technical' 
      })
    }

    const enhancedPrompt = await promptEngineService.generateDynamicPrompt(
      basePrompt,
      context,
      enhancementType
    )

    res.json({
      success: true,
      data: {
        basePrompt,
        enhancedPrompt,
        enhancementType,
        contextKeys: Object.keys(context),
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('动态提示生成失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '动态提示生成失败' 
    })
  }
})

/**
 * 健康检查
 * @route GET /api/prompt-engine/health
 */
router.get('/health', async (_req, res) => {
  try {
    const templatesCount = promptEngineService.getAllTemplates().length
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'prompt-engine',
        templatesCount,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    })
  } catch (error) {
    console.error('健康检查失败:', error)
    res.status(500).json({ 
      success: false, 
      error: '服务不可用' 
    })
  }
})

export default router