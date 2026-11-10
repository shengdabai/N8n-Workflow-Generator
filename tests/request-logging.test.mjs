import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { requestLogger, globalErrorHandler } from '../api/middleware/errorHandler.ts'

test('request and global error logs omit body and query values', async () => {
  const app = express()
  app.use(express.json())
  app.use(requestLogger)
  app.post('/fixture', (_req, _res, next) => next(new Error('fixture error')))
  app.use(globalErrorHandler)
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const original = { log: console.log, error: console.error }
  const entries = []
  console.log = (...args) => entries.push(args)
  console.error = (...args) => entries.push(args)
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/fixture?token=query-fixture-sensitive`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userInput: { password: 'body-fixture-sensitive' } }),
    })
    assert.equal(response.status, 500)
    assert.ok(entries.length >= 3)
    const logged = JSON.stringify(entries)
    assert.ok(!logged.includes('query-fixture-sensitive'))
    assert.ok(!logged.includes('body-fixture-sensitive'))
  } finally {
    Object.assign(console, original)
    await new Promise(resolve => server.close(resolve))
  }
})
