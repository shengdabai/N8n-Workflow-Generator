import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import router from '../api/routes/workflowWithImage.ts'
import { globalErrorHandler } from '../api/middleware/errorHandler.ts'

test('multipart field and file counts are bounded and rejected uploads are removed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-limits-'))
  const previous = process.cwd()
  process.chdir(root)
  const app = express()
  app.use(router)
  app.use(globalErrorHandler)
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  try {
    for (const kind of ['fields', 'files']) {
      const body = new FormData()
      body.set('description', 'Fixture description long enough for validation')
      body.append('image', new Blob(['fixture'], { type: 'image/png' }), 'fixture.png')
      if (kind === 'fields') body.append('extra', 'fixture')
      else body.append('image', new Blob(['fixture'], { type: 'image/png' }), 'second.png')
      const response = await fetch(`http://127.0.0.1:${server.address().port}/generate-with-image`, { method: 'POST', body })
      assert.equal(response.status, 413)
      assert.equal((await response.json()).code, kind === 'fields' ? 'LIMIT_FIELD_COUNT' : 'LIMIT_FILE_COUNT')
      assert.deepEqual(await fs.readdir(path.join(root, 'data/uploads')), [])
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
    process.chdir(previous)
    await fs.rm(root, { recursive: true, force: true })
  }
})
