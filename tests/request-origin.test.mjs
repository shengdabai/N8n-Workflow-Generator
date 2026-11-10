import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { requestOrigin } from '../api/middleware/requestOrigin.ts'
import { globalErrorHandler } from '../api/middleware/errorHandler.ts'

test('only trusted origins can read responses or invoke API side effects', async () => {
  for (const frontendUrl of [undefined, 'https://frontend.example.test']) {
    const app = express()
    let calls = 0
    app.use(requestOrigin(frontendUrl))
    app.all('/api/fixture', (_req, res) => { calls++; res.json({ success: true }) })
    app.use(globalErrorHandler)
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const url = `http://127.0.0.1:${server.address().port}/api/fixture`
    try {
      for (const origin of ['https://untrusted.example.test', 'null', 'http://localhost:3000.evil.test']) {
        for (const method of ['GET', 'POST', 'OPTIONS']) {
          const response = await fetch(url, {
            method, headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
            ...(method === 'POST' ? { body: 'name=fixture' } : {}),
          })
          assert.equal(response.status, 403)
          assert.equal(response.headers.get('access-control-allow-origin'), null)
        }
      }
      const navigation = await fetch(url, { headers: { 'sec-fetch-site': 'cross-site' } })
      assert.equal(navigation.status, 403, 'cross-site navigation without Origin must be rejected')
      assert.equal(calls, 0)
      const allowed = frontendUrl ? [frontendUrl] : ['http://localhost:3000', 'http://127.0.0.1:3000']
      for (const origin of allowed) {
        const response = await fetch(url, { headers: { origin } })
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('access-control-allow-origin'), origin)
        const preflight = await fetch(url, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })
        assert.equal(preflight.status, 204)
      }
      const direct = await fetch(url)
      assert.equal(direct.status, 200)
      assert.equal(direct.headers.get('access-control-allow-origin'), null)
      assert.equal(calls, allowed.length + 1)
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  }
})
