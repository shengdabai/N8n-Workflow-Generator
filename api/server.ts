import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 路由导入（移除.js 扩展，兼容 tsx 运行时）
import workflowRoutes from './routes/workflow'
import workflowWithImageRoutes from './routes/workflowWithImage'
import templateRoutes from './routes/templates'
import healthRoutes from './routes/health'
import exportRoutes from './routes/export'
import vectorSearchRoutes from './routes/vectorSearch'
import promptEngineRoutes from './routes/promptEngine'
import parameterRoutes from './routes/parameters'
import n8nWorkflowRoutes from './routes/n8nWorkflow'


// 错误处理中间件导入
import { 
  globalErrorHandler, 
  notFoundHandler, 
  requestLogger
} from './middleware/errorHandler'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 测试进程必须使用显式提供的隔离配置，避免意外加载开发机凭据。
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(__dirname, '../.env') })
}

const app = express()
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '127.0.0.1'

// 中间件配置
app.use(helmet()) // 安全头部
app.use(cors()) // 跨域支持
app.use(requestLogger) // 自定义请求日志
app.use(morgan('combined')) // 标准请求日志
app.use(express.json({ limit: '10mb' })) // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })) // URL编码解析

// API路由
app.use('/api/workflows', workflowRoutes)
app.use('/api/workflows-with-image', workflowWithImageRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/vector-search', vectorSearchRoutes)
app.use('/api/prompt-engine', promptEngineRoutes)
app.use('/api/parameters', parameterRoutes)
app.use('/api/n8n-workflow', n8nWorkflowRoutes)


// 根路径处理
app.get('/', (_req, res) => {
  res.json({
    message: 'n8n工作流自动生成工具 API服务',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  })
})

// 404处理
app.use(notFoundHandler)

// 全局错误处理
app.use(globalErrorHandler)

// 启动服务器
app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 服务器运行在 http://${HOST}:${PORT}`)
  console.log(`📝 API文档: http://${HOST}:${PORT}/api`)
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`)
  
  // 检查必要的环境变量
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  警告: OPENAI_API_KEY 环境变量未设置')
  }
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...')
  process.exit(0)
})

export default app
