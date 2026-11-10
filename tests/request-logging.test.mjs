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

test('malformed request bodies never reach parser error logs', async (t) => {
  const entries = []
  t.mock.method(console, 'error', (...args) => entries.push(args))
  const app = express()
  app.use(express.json())
  app.post('/fixture', (_req, res) => res.sendStatus(204))
  app.use(globalErrorHandler)
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  try {
    for (const body of ['BODY_FIXTURE_SECRET', '"BODY_FIXTURE_SECRET"']) {
      entries.length = 0
      const response = await fetch(`http://127.0.0.1:${server.address().port}/fixture`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      })
      assert.equal(response.status, 400)
      assert.equal((await response.json()).code, 'JSON_PARSE_ERROR')
      assert.equal(entries.length, 1)
      assert.ok(!JSON.stringify(entries).includes('BODY_FIXTURE_SECRET'))
      assert.deepEqual(entries[0][1], { type: 'entity.parse.failed', status: 400 })
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('parser error families log only type and response status', (t) => {
  const entries = []
  t.mock.method(console, 'error', (...args) => entries.push(args))
  const types = [
    'entity.parse.failed', 'entity.verify.failed', 'entity.too.large',
    'encoding.unsupported', 'charset.unsupported', 'request.aborted',
    'request.size.invalid', 'stream.encoding.set', 'stream.not.readable',
    'parameters.too.many', 'querystring.parse.rangeError',
  ]
  const req = { method: 'POST', path: '/fixture', get: () => 'test', ip: '127.0.0.1' }
  let status
  const res = { status(value) { status = value; return this }, json() {} }
  for (const type of types) {
    entries.length = 0
    const error = Object.assign(new Error('BODY_FIXTURE_SECRET'), {
      type, status: 400, body: 'BODY_FIXTURE_SECRET',
    })
    globalErrorHandler(error, req, res, () => {})
    assert.equal(entries.length, 1)
    assert.ok(!JSON.stringify(entries).includes('BODY_FIXTURE_SECRET'), type)
    assert.deepEqual(entries[0][1], { type, status })
  }
})
