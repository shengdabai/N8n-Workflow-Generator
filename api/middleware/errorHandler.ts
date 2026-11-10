import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '@/shared/types'
import { MulterError } from 'multer'

/**
 * 错误类型定义
 */
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean
  public code?: string

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    this.code = code
    
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 异步错误处理包装器
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => unknown) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 全局错误处理中间件
 */
export const globalErrorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  void _next
  let statusCode = 500
  let message = '服务器内部错误'
  let code = 'INTERNAL_ERROR'

  // 处理自定义错误
  if (error instanceof AppError) {
    statusCode = error.statusCode
    message = error.message
    code = error.code || 'APP_ERROR'
  }
  else if (error instanceof MulterError) {
    statusCode = error.code === 'LIMIT_UNEXPECTED_FILE' ? 400 : 413
    message = '上传请求超出允许的文件或字段限制'
    code = error.code
  }
  // 处理验证错误
  else if (error.name === 'ValidationError') {
    statusCode = 400
    message = '请求参数验证失败'
    code = 'VALIDATION_ERROR'
  }
  // 处理JSON解析错误
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400
    message = '请求体格式错误'
    code = 'JSON_PARSE_ERROR'
  }
  // 处理超时错误
  else if (error.message.includes('timeout')) {
    statusCode = 408
    message = '请求超时'
    code = 'TIMEOUT_ERROR'
  }
  // 处理网络错误
  else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    statusCode = 503
    message = '外部服务不可用'
    code = 'SERVICE_UNAVAILABLE'
  }
  // 处理OpenAI API错误
  else if (error.message.includes('OpenAI') || error.message.includes('API key')) {
    statusCode = 503
    message = 'AI服务暂时不可用，请稍后重试'
    code = 'AI_SERVICE_ERROR'
  }

  // 记录错误日志
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${statusCode} ${code}:`, {
    message: error.message,
    stack: error.stack,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })

  // 返回错误响应
  const response: ApiResponse<null> = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString()
  }

  res.status(statusCode).json(response)
}

/**
 * 404处理中间件
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false,
    error: `API端点未找到: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  }
  
  res.status(404).json(response)
}

/**
 * 请求日志中间件
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  // 记录请求开始
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - 开始处理请求`, {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 400 ? 'ERROR' : 'INFO'
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      level,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')
    })
  })

  next()
}

/**
 * 速率限制错误处理
 */
export const rateLimitHandler = (_req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: false,
    error: '请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
  
  res.status(429).json(response)
}
