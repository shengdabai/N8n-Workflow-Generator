import { Request, Response, NextFunction } from 'express';

/**
 * 异步处理器类型定义
 */
export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

/**
 * 异步路由处理器包装函数
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 * 
 * @param fn 异步处理函数
 * @returns Express中间件函数
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.startTime ??= Date.now();
    // 执行异步函数并捕获错误
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 带有性能监控的异步处理器
 * 记录请求处理时间
 * 
 * @param fn 异步处理函数
 * @param label 性能标签（可选）
 * @returns Express中间件函数
 */
export function asyncHandlerWithTiming(fn: AsyncHandler, label?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestLabel = label || `${req.method} ${req.path}`;
    
    Promise.resolve(fn(req, res, next))
      .then((result) => {
        const duration = Date.now() - startTime;
        console.log(`[Performance] ${requestLabel}: ${duration}ms`);
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        console.error(`[Performance] ${requestLabel}: ${duration}ms (ERROR)`);
        next(error);
      });
  };
}

/**
 * 带有请求日志的异步处理器
 * 记录请求信息和响应状态
 * 
 * @param fn 异步处理函数
 * @returns Express中间件函数
 */
export function asyncHandlerWithLogging(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`[${requestId}] ${req.method} ${req.path} - Started`);
    
    // 监听响应完成事件
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    
    Promise.resolve(fn(req, res, next))
      .catch((error) => {
        const duration = Date.now() - startTime;
        console.error(`[${requestId}] ${req.method} ${req.path} - ERROR (${duration}ms):`, error.message);
        next(error);
      });
  };
}

/**
 * 带有超时控制的异步处理器
 * 如果请求处理时间超过指定时间，自动返回超时错误
 * 
 * @param fn 异步处理函数
 * @param timeoutMs 超时时间（毫秒）
 * @returns Express中间件函数
 */
export function asyncHandlerWithTimeout(fn: AsyncHandler, timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    Promise.race([
      Promise.resolve(fn(req, res, next)),
      timeoutPromise
    ]).catch(next);
  };
}

/**
 * 组合多个异步处理器功能
 * 
 * @param fn 异步处理函数
 * @param options 配置选项
 * @returns Express中间件函数
 */
export function createAsyncHandler(
  fn: AsyncHandler,
  options: {
    enableTiming?: boolean;
    enableLogging?: boolean;
    timeoutMs?: number;
    label?: string;
  } = {}
) {
  let handler = fn;
  
  // 应用超时控制
  if (options.timeoutMs) {
    const originalHandler = handler;
    handler = async (req, res, next) => {
      return asyncHandlerWithTimeout(originalHandler, options.timeoutMs!)(req, res, next);
    };
  }
  
  // 应用日志记录
  if (options.enableLogging) {
    const originalHandler = handler;
    handler = async (req, res, next) => {
      return asyncHandlerWithLogging(originalHandler)(req, res, next);
    };
  }
  
  // 应用性能监控
  if (options.enableTiming) {
    const originalHandler = handler;
    handler = async (req, res, next) => {
      return asyncHandlerWithTiming(originalHandler, options.label)(req, res, next);
    };
  }
  
  // 最后应用基础异步处理
  return asyncHandler(handler);
}

/**
 * 默认导出基础异步处理器
 */
export default asyncHandler;
