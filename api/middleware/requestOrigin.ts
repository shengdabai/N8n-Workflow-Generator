import cors from 'cors'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler'

// Reject disallowed origins before parsing bodies or performing side effects.
// Omitting CORS response headers alone would still permit simple form requests.
export function requestOrigin(frontendUrl = process.env.FRONTEND_URL) {
  const allowed = new Set(frontendUrl
    ? [new URL(frontendUrl).origin]
    : ['http://localhost:3000', 'http://127.0.0.1:3000'])
  const corsMiddleware = cors({
    origin(origin, callback) {
      if (origin === undefined) return callback(null, false)
      if (allowed.has(origin)) return callback(null, true)
      return callback(new AppError('请求来源不受信任', 403, 'ORIGIN_NOT_ALLOWED'))
    },
  })
  return (req: Request, res: Response, next: NextFunction) => {
    // Cross-site navigations and image loads may omit Origin entirely.
    if (!req.get('Origin') && req.get('Sec-Fetch-Site') === 'cross-site') {
      return next(new AppError('请求来源不受信任', 403, 'ORIGIN_NOT_ALLOWED'))
    }
    return corsMiddleware(req, res, next)
  }
}
