import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function reservePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const port = address.port
  server.close()
  await once(server, 'close')
  return port
}

async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early with ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('server did not become healthy')
}

test('server starts without provider credentials and generation fails closed', { timeout: 20_000 }, async () => {
  const port = await reservePort()
  const child = spawn(process.execPath, ['--import', 'tsx', 'api/server.ts'], {
    cwd: projectRoot,
    env: {
      PATH: process.env.PATH ?? '',
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })

  try {
    const health = await waitForHealth(`http://127.0.0.1:${port}/api/health`, child)
    assert.equal((await health.json()).success, true)
    const privateQuery = await fetch(`http://127.0.0.1:${port}/api/health?token=private-query-fixture`)
    assert.equal(privateQuery.status, 200)

    const generated = await fetch(`http://127.0.0.1:${port}/api/workflows/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Create a daily report and send it to Slack' }),
    })
    const body = await generated.json()
    assert.equal(generated.status, 503, output)
    assert.equal(body.success, false)
    assert.equal(body.code, 'AI_SERVICE_UNAVAILABLE')
    assert.equal(body.workflow, undefined)
    assert.ok(!output.includes('private-query-fixture'), 'access logs must omit query values')
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    await Promise.race([
      once(child, 'exit'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('server did not stop')), 5_000)),
    ])
  }
})
