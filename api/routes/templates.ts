import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { safeWorkflowPath } from '../utils/safeWorkflowPath'
import { 
  WorkflowTemplate, 
  ApiResponse 
} from '@/shared/types'

const router = express.Router()

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 模板存储路径
const TEMPLATES_DIR = process.env.TEMPLATES_PATH || path.join(__dirname, '../../data/templates')

/**
 * 确保模板目录存在
 */
async function ensureTemplatesDir() {
  try {
    await fs.access(TEMPLATES_DIR)
  } catch {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true })
    console.log('📁 创建模板目录:', TEMPLATES_DIR)
  }
}

/**
 * 获取所有模板
 * @route GET /api/templates
 * @query {string} category - 可选，按分类筛选
 * @query {string} search - 可选，搜索关键词
 * @returns {ApiResponse<WorkflowTemplate[]>} 模板列表
 */
router.get('/', async (req, res) => {
  try {
    await ensureTemplatesDir()
    
    const { category, search } = req.query
    
    // 读取所有模板文件
    const files = await fs.readdir(TEMPLATES_DIR)
    const templateFiles = files.filter(file => file.endsWith('.json'))
    
    const templates: WorkflowTemplate[] = []
    
    for (const file of templateFiles) {
      try {
        const filePath = await safeWorkflowPath(TEMPLATES_DIR, file)
        if (!filePath) continue
        const content = await fs.readFile(filePath, 'utf-8')
        const template: WorkflowTemplate = JSON.parse(content)
        
        // 分类筛选
        if (category && template.category !== category) {
          continue
        }
        
        // 搜索筛选
        if (search) {
          const searchLower = search.toString().toLowerCase()
          const matchesSearch = 
            template.name.toLowerCase().includes(searchLower) ||
            template.description.toLowerCase().includes(searchLower) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchLower))
          
          if (!matchesSearch) {
            continue
          }
        }
        
        templates.push(template)
      } catch (error) {
        console.warn(`跳过无效模板文件: ${file}`, error)
      }
    }
    
    // 按创建时间排序（最新的在前）
    templates.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    const response: ApiResponse<WorkflowTemplate[]> = {
      success: true,
      data: templates,
      message: `找到 ${templates.length} 个模板`
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('获取模板列表失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '获取模板列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 获取单个模板
 * @route GET /api/templates/:id
 * @param {string} id - 模板ID
 * @returns {ApiResponse<WorkflowTemplate>} 模板详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '模板ID不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    await ensureTemplatesDir()
    
    const filePath = await safeWorkflowPath(TEMPLATES_DIR, `${id}.json`)
    if (!filePath) return res.status(404).json({ success: false, error: '模板不存在', data: null })
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const template: WorkflowTemplate = JSON.parse(content)
      
      const response: ApiResponse<WorkflowTemplate> = {
        success: true,
        data: template,
        message: '模板获取成功'
      }
      
      res.json(response)
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: '模板不存在',
          data: null
        } as ApiResponse<null>)
      }
      throw error
    }
    
  } catch (error) {
    console.error('获取模板失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '获取模板失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 创建新模板
 * @route POST /api/templates
 * @body {Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>} 模板数据
 * @returns {ApiResponse<WorkflowTemplate>} 创建的模板
 */
router.post('/', async (req, res) => {
  try {
    const templateData = req.body
    
    // 验证必填字段
    if (!templateData.name || !templateData.workflow) {
      return res.status(400).json({
        success: false,
        error: '模板名称和工作流配置不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    await ensureTemplatesDir()
    
    // 生成模板ID和时间戳
    const templateId = generateTemplateId(templateData.name)
    const now = new Date().toISOString()
    
    const template: WorkflowTemplate = {
      id: templateId,
      name: templateData.name,
      description: templateData.description || '',
      category: templateData.category || 'general',
      tags: templateData.tags || [],
      workflow: templateData.workflow,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      author: templateData.author || 'Anonymous'
    }
    
    // 原子创建，避免检查与写入之间的竞争及符号链接覆盖。
    const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`)
    try {
      await fs.writeFile(filePath, JSON.stringify(template, null, 2), { encoding: 'utf-8', flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return res.status(409).json({ success: false, error: '同名模板已存在', data: null } as ApiResponse<null>)
      }
      throw error
    }
    
    console.log('✅ 模板创建成功:', template.name)
    
    const response: ApiResponse<WorkflowTemplate> = {
      success: true,
      data: template,
      message: '模板创建成功'
    }
    
    res.status(201).json(response)
    
  } catch (error) {
    console.error('创建模板失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '创建模板失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 更新模板
 * @route PUT /api/templates/:id
 * @param {string} id - 模板ID
 * @body {Partial<WorkflowTemplate>} 更新数据
 * @returns {ApiResponse<WorkflowTemplate>} 更新后的模板
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '模板ID不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    await ensureTemplatesDir()
    
    const filePath = await safeWorkflowPath(TEMPLATES_DIR, `${id}.json`)
    if (!filePath) return res.status(404).json({ success: false, error: '模板不存在', data: null })
    
    // 读取现有模板
    let existingTemplate: WorkflowTemplate
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      existingTemplate = JSON.parse(content)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: '模板不存在',
          data: null
        } as ApiResponse<null>)
      }
      throw error
    }
    
    // 更新模板数据
    const updatedTemplate: WorkflowTemplate = {
      ...existingTemplate,
      ...updateData,
      id: existingTemplate.id, // 保持ID不变
      createdAt: existingTemplate.createdAt, // 保持创建时间不变
      updatedAt: new Date().toISOString()
    }
    
    // 保存更新后的模板
    await fs.writeFile(filePath, JSON.stringify(updatedTemplate, null, 2), 'utf-8')
    
    console.log('✅ 模板更新成功:', updatedTemplate.name)
    
    const response: ApiResponse<WorkflowTemplate> = {
      success: true,
      data: updatedTemplate,
      message: '模板更新成功'
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('更新模板失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '更新模板失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 删除模板
 * @route DELETE /api/templates/:id
 * @param {string} id - 模板ID
 * @returns {ApiResponse<null>} 删除结果
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '模板ID不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    await ensureTemplatesDir()
    
    const filePath = await safeWorkflowPath(TEMPLATES_DIR, `${id}.json`)
    if (!filePath) return res.status(404).json({ success: false, error: '模板不存在', data: null })
    
    try {
      await fs.unlink(filePath)
      
      console.log('✅ 模板删除成功:', id)
      
      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: '模板删除成功'
      }
      
      res.json(response)
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: '模板不存在',
          data: null
        } as ApiResponse<null>)
      }
      throw error
    }
    
  } catch (error) {
    console.error('删除模板失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '删除模板失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 增加模板使用次数
 * @route POST /api/templates/:id/use
 * @param {string} id - 模板ID
 * @returns {ApiResponse<WorkflowTemplate>} 更新后的模板
 */
router.post('/:id/use', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '模板ID不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    await ensureTemplatesDir()
    
    const filePath = await safeWorkflowPath(TEMPLATES_DIR, `${id}.json`)
    if (!filePath) return res.status(404).json({ success: false, error: '模板不存在', data: null })
    
    // 读取现有模板
    let template: WorkflowTemplate
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      template = JSON.parse(content)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: '模板不存在',
          data: null
        } as ApiResponse<null>)
      }
      throw error
    }
    
    // 增加使用次数
    template.usageCount = (template.usageCount || 0) + 1
    template.updatedAt = new Date().toISOString()
    
    // 保存更新后的模板
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8')
    
    const response: ApiResponse<WorkflowTemplate> = {
      success: true,
      data: template,
      message: '使用次数已更新'
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('更新使用次数失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '更新使用次数失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 获取模板分类列表
 * @route GET /api/templates/categories
 * @returns {ApiResponse<string[]>} 分类列表
 */
router.get('/meta/categories', async (_req, res) => {
  try {
    await ensureTemplatesDir()
    
    const files = await fs.readdir(TEMPLATES_DIR)
    const templateFiles = files.filter(file => file.endsWith('.json'))
    
    const categories = new Set<string>()
    
    for (const file of templateFiles) {
      try {
        const filePath = await safeWorkflowPath(TEMPLATES_DIR, file)
        if (!filePath) continue
        const content = await fs.readFile(filePath, 'utf-8')
        const template: WorkflowTemplate = JSON.parse(content)
        
        if (template.category) {
          categories.add(template.category)
        }
      } catch (error) {
        console.warn(`跳过无效模板文件: ${file}`, error)
      }
    }
    
    const response: ApiResponse<string[]> = {
      success: true,
      data: Array.from(categories).sort(),
      message: `找到 ${categories.size} 个分类`
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('获取分类列表失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '获取分类列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    }
    
    res.status(500).json(response)
  }
})

/**
 * 生成模板ID
 * @param {string} name - 模板名称
 * @returns {string} 生成的ID
 */
function generateTemplateId(name: string): string {
  const timestamp = Date.now()
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20)
  
  return `${sanitizedName}_${timestamp}`
}

export default router
