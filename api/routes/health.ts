import express from 'express'
import { ApiResponse } from '@/shared/types'

const router = express.Router()

/**
 * 健康检查接口
 * @route GET /api/health
 * @returns {ApiResponse} 服务状态信息
 */
router.get('/', (_req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      database: true, // 暂时硬编码，后续可添加实际数据库检查
    }
  }

  const response: ApiResponse<typeof healthData> = {
    success: true,
    data: healthData,
    message: '服务运行正常'
  }

  res.json(response)
})

/**
 * 详细健康检查接口
 * @route GET /api/health/detailed
 * @returns {ApiResponse} 详细的服务状态信息
 */
router.get('/detailed', async (req, res) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          status: 'unknown' // 可以添加实际的OpenAI连接测试
        },
        filesystem: {
          templatesPath: process.env.TEMPLATES_PATH || './data/templates',
          preferencesPath: process.env.PREFERENCES_PATH || './data/preferences',
          writable: true // 可以添加实际的文件系统写入测试
        }
      },
      performance: {
        responseTime: (() => {
          const startedAt = Number(req.get('x-request-start'))
          return Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0
        })(),
        requestCount: 0 // 可以添加请求计数器
      }
    }

    const response: ApiResponse<typeof detailedHealth> = {
      success: true,
      data: detailedHealth,
      message: '详细健康检查完成'
    }

    res.json(response)
  } catch (error) {
    console.error('详细健康检查失败:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: '健康检查失败',
      message: error instanceof Error ? error.message : '未知错误'
    }

    res.status(500).json(response)
  }
})

export default router
