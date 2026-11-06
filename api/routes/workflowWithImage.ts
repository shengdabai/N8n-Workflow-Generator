import express from 'express'
import multer from 'multer'
import { generateWorkflowWithImage } from '../services/openaiService'
import { ApiResponse, type N8nWorkflow } from '@/shared/types'
import fs from 'fs/promises'
import path from 'path'

const router = express.Router()

// 配置multer用于处理文件上传
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error instanceof Error ? error : new Error('无法创建上传目录'), uploadDir)
    }
  },
  filename: (_req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `workflow-ref-${uniqueSuffix}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片文件格式'))
    }
  }
})

/**
 * 基于图片和文本描述生成工作流接口
 * @route POST /api/workflow/generate-with-image
 * @body {FormData} description: 文本描述, image: 图片文件
 * @returns {ApiResponse<WorkflowGenerationResponse>} 生成的工作流配置
 */
router.post('/generate-with-image', upload.single('image'), async (req, res) => {
  const uploadedFilePath = req.file?.path ?? null
  
  try {
    const { description } = req.body
    const imageFile = req.file
    
    // 验证请求参数
    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: '工作流描述不能为空',
        data: null
      } as ApiResponse<null>)
    }
    
    if (description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: '工作流描述过于简短，请提供更详细的描述',
        data: null
      } as ApiResponse<null>)
    }
    
    if (!imageFile) {
      return res.status(400).json({
        success: false,
        error: '请上传参考图片',
        data: null
      } as ApiResponse<null>)
    }
    
    
    console.log('📝 收到带图片的工作流生成请求:', description)
    console.log('🖼️ 图片文件:', imageFile.filename)
    
    // 调用OpenAI服务生成工作流
    const workflow = await generateWorkflowWithImage(description.trim(), imageFile.path)
    
    console.log('✅ 工作流生成成功')
    
    // 返回成功响应
    res.json({
      success: true,
      data: {
        workflow,
        message: '工作流生成成功'
      }
    } as ApiResponse<{ workflow: N8nWorkflow; message: string }>)
    
  } catch (error) {
    console.error('❌ 工作流生成失败:', error)
    
    // 返回错误响应
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '工作流生成失败',
      data: null
    } as ApiResponse<null>)
    
  } finally {
    // 清理上传的临时文件
    if (uploadedFilePath) {
      try {
        await fs.unlink(uploadedFilePath)
        console.log('🗑️ 临时文件已清理:', uploadedFilePath)
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError)
      }
    }
  }
})

export default router
