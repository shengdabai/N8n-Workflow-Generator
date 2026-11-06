/**
 * 前端错误处理工具类
 * 提供统一的错误处理和用户友好的错误消息
 */

// 错误类型枚举
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

// 错误信息接口
export interface ErrorInfo {
  type: ErrorType
  message: string
  originalError?: Error
  statusCode?: number
  timestamp: Date
}

// 用户友好的错误消息映射
const ERROR_MESSAGES: Record<string, string> = {
  // 网络错误
  'Failed to fetch': '网络连接失败，请检查网络连接后重试',
  'NetworkError': '网络错误，请稍后重试',
  'TypeError: Failed to fetch': '无法连接到服务器，请检查网络连接',
  
  // HTTP状态码错误
  '400': '请求参数错误，请检查输入内容',
  '401': '未授权访问，请重新登录',
  '403': '访问被拒绝，权限不足',
  '404': '请求的资源不存在',
  '429': '请求过于频繁，请稍后重试',
  '500': '服务器内部错误，请稍后重试',
  '502': '服务器网关错误，请稍后重试',
  '503': '服务暂时不可用，请稍后重试',
  '504': '服务器响应超时，请稍后重试',
  
  // 业务逻辑错误
  '描述不能为空': '请输入工作流描述',
  '描述过短': '工作流描述至少需要10个字符',
  '工作流生成失败': '工作流生成失败，请检查描述内容后重试',
  '节点推荐失败': '无法获取节点推荐，请稍后重试',
  '描述优化失败': '描述优化失败，请稍后重试',
  '提示生成失败': '提示生成失败，请稍后重试',
  '导出失败': '工作流导出失败，请稍后重试',
  '保存失败': '工作流保存失败，请稍后重试',
  
  // 默认错误
  'default': '操作失败，请稍后重试'
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 解析错误并返回用户友好的错误信息
   * @param error 原始错误对象
   * @returns 错误信息对象
   */
  static parseError(error: unknown): ErrorInfo {
    const timestamp = new Date()
    const parsedError = error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : ERROR_MESSAGES['default'])
    
    // 处理网络错误
    if (parsedError instanceof TypeError && parsedError.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: ERROR_MESSAGES['Failed to fetch'],
        originalError: parsedError,
        timestamp
      }
    }
    
    // 处理HTTP错误
    if (parsedError.message.includes('HTTP error! status:')) {
      const statusMatch = parsedError.message.match(/status: (\d+)/)
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 500
      
      return {
        type: ErrorType.SERVER,
        message: ERROR_MESSAGES[statusCode.toString()] || ERROR_MESSAGES['500'],
        originalError: parsedError,
        statusCode,
        timestamp
      }
    }
    
    // 处理业务逻辑错误
    if (ERROR_MESSAGES[parsedError.message]) {
      return {
        type: ErrorType.VALIDATION,
        message: ERROR_MESSAGES[parsedError.message],
        originalError: parsedError,
        timestamp
      }
    }
    
    // 处理超时错误
    if (parsedError.name === 'TimeoutError' || parsedError.message.includes('timeout')) {
      return {
        type: ErrorType.TIMEOUT,
        message: '请求超时，请稍后重试',
        originalError: parsedError,
        timestamp
      }
    }
    
    // 处理未知错误
    return {
      type: ErrorType.UNKNOWN,
      message: parsedError.message || ERROR_MESSAGES['default'],
      originalError: parsedError,
      timestamp
    }
  }
  
  /**
   * 获取用户友好的错误消息
   * @param error 错误对象
   * @returns 用户友好的错误消息
   */
  static getUserMessage(error: unknown): string {
    const errorInfo = this.parseError(error)
    return errorInfo.message
  }
  
  /**
   * 记录错误日志
   * @param error 错误对象
   * @param context 错误上下文
   */
  static logError(error: unknown, context?: string): void {
    const errorInfo = this.parseError(error)
    
    console.group(`🚨 错误日志 - ${errorInfo.type}`)
    console.error('时间:', errorInfo.timestamp.toISOString())
    console.error('类型:', errorInfo.type)
    console.error('消息:', errorInfo.message)
    if (context) {
      console.error('上下文:', context)
    }
    if (errorInfo.statusCode) {
      console.error('状态码:', errorInfo.statusCode)
    }
    if (errorInfo.originalError) {
      console.error('原始错误:', errorInfo.originalError)
    }
    console.groupEnd()
  }
  
  /**
   * 处理API调用错误的通用方法
   * @param error 错误对象
   * @param operation 操作名称
   * @returns 处理后的错误信息
   */
  static handleApiError(error: unknown, operation: string): ErrorInfo {
    const errorInfo = this.parseError(error)
    this.logError(error, `API操作: ${operation}`)
    return errorInfo
  }
}

/**
 * 创建带有错误处理的异步函数包装器
 * @param fn 异步函数
 * @param operation 操作名称
 * @returns 包装后的函数
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorInfo = ErrorHandler.handleApiError(error, operation)
      throw new Error(errorInfo.message)
    }
  }
}

/**
 * 重试机制配置
 */
export interface RetryConfig {
  maxRetries: number
  delay: number
  backoff: boolean
}

/**
 * 带重试机制的错误处理
 * @param fn 异步函数
 * @param config 重试配置
 * @returns 包装后的函数
 */
export function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig = { maxRetries: 3, delay: 1000, backoff: true }
) {
  return async (...args: T): Promise<R> => {
    let lastError: unknown
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === config.maxRetries) {
          break
        }
        
        // 计算延迟时间
        const delay = config.backoff 
          ? config.delay * Math.pow(2, attempt)
          : config.delay
        
        console.warn(`操作失败，${delay}ms后进行第${attempt + 2}次尝试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }
}

// 导出默认实例
export default ErrorHandler
