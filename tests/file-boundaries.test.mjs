import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'

test('template and workflow routes cannot access files outside their directories', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'file-boundaries-'))
  const templates = path.join(root, 'templates')
  const generated = path.join(root, 'data/generated_workflows')
  const previousCwd = process.cwd()
  const previousPath = process.env.TEMPLATES_PATH
  let server
  try {
    await fs.mkdir(templates)
    await fs.mkdir(generated, { recursive: true })
    const template = { id: 'valid', name: 'Fixture', description: '', tags: [], category: 'Test', usageCount: 0, workflow: {} }
    const outside = JSON.stringify({ ...template, name: 'Outside fixture' })
    await fs.writeFile(path.join(root, 'outside.json'), outside)
    await fs.writeFile(path.join(templates, '中文_123.json'), JSON.stringify(template))
    await fs.writeFile(path.join(generated, 'valid.json'), JSON.stringify(template))
    for (const base of [templates, generated]) {
      await fs.symlink(path.join(root, 'outside.json'), path.join(base, 'linked.json'))
      await fs.symlink(path.join(root, 'missing.json'), path.join(base, 'broken.json'))
    }
    process.env.TEMPLATES_PATH = templates
    process.chdir(root)
    const { default: templateRoutes } = await import('../api/routes/templates.ts')
    const { default: workflowRoutes } = await import('../api/routes/n8nWorkflow.ts')
    const app = express()
    app.use(express.json())
    app.use('/templates', templateRoutes)
    app.use('/workflows', workflowRoutes)
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const base = `http://127.0.0.1:${server.address().port}`
    for (const id of ['..%2Foutside', '..%5Coutside', 'linked', 'broken']) {
      for (const [method, suffix] of [['GET', ''], ['PUT', ''], ['DELETE', ''], ['POST', '/use']]) {
        const response = await fetch(`${base}/templates/${id}${suffix}`, {
          method, headers: { 'content-type': 'application/json' },
          ...(method === 'PUT' ? { body: JSON.stringify({ name: 'Changed' }) } : {}),
        })
        assert.equal(response.status, 404, `${method} template ${id}${suffix}`)
      }
    }
    for (const name of ['..%2F..%2Foutside.json', 'linked.json', 'broken.json']) {
      for (const prefix of ['', 'download/']) {
        const response = await fetch(`${base}/workflows/${prefix}${name}`)
        assert.equal(response.status, 404, `${prefix}${name}`)
      }
    }
    assert.equal((await fetch(`${base}/templates/${encodeURIComponent('中文_123')}`)).status, 200)
    assert.equal((await fetch(`${base}/workflows/valid.json`)).status, 200)
    t.mock.method(Date, 'now', () => 12345678)
    await fs.symlink(path.join(root, 'outside.json'), path.join(templates, 'fixture_12345678.json'))
    for (const target of ['outside.json', 'missing.json']) {
      await fs.unlink(path.join(templates, 'fixture_12345678.json'))
      await fs.symlink(path.join(root, target), path.join(templates, 'fixture_12345678.json'))
      const create = await fetch(`${base}/templates`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Fixture', workflow: {} }),
      })
      assert.equal(create.status, 409, 'creation must not follow an existing or dangling symlink')
    }
    await assert.rejects(fs.access(path.join(root, 'missing.json')), { code: 'ENOENT' })
    t.mock.restoreAll()
    const templateList = await (await fetch(`${base}/templates`)).json()
    assert.equal(templateList.data.length, 1)
    const categories = await (await fetch(`${base}/templates/meta/categories`)).json()
    assert.deepEqual(categories.data, ['Test'])
    const workflowList = await (await fetch(`${base}/workflows/list`)).json()
    assert.deepEqual(workflowList.data.map(item => item.filename), ['valid.json'])
    assert.equal(await fs.readFile(path.join(root, 'outside.json'), 'utf8'), outside)
    assert.equal(await fs.readlink(path.join(templates, 'linked.json')), path.join(root, 'outside.json'))
    await t.test('deleting an in-directory alias removes only the requested link', async () => {
      const target = path.join(templates, 'target.json')
      const alias = path.join(templates, 'alias.json')
      const content = JSON.stringify(template)
      await fs.writeFile(target, content)
      for (const destination of ['target.json', target]) {
        await fs.symlink(destination, alias)
        const response = await fetch(`${base}/templates/alias`, { method: 'DELETE' })
        assert.equal(response.status, 200)
        assert.equal((await response.json()).success, true)
        assert.equal(await fs.readFile(target, 'utf8'), content, 'alias deletion must preserve its target')
        await assert.rejects(fs.lstat(alias), { code: 'ENOENT' })
      }
      const response = await fetch(`${base}/templates/target`, { method: 'DELETE' })
      assert.equal(response.status, 200, 'regular files remain deletable')
      await assert.rejects(fs.lstat(target), { code: 'ENOENT' })
    })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    process.chdir(previousCwd)
    if (previousPath === undefined) delete process.env.TEMPLATES_PATH
    else process.env.TEMPLATES_PATH = previousPath
    await fs.rm(root, { recursive: true, force: true })
  }
})
