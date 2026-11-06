import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = name => readFile(new URL(name, import.meta.url), 'utf8')

test('Docker stages match Node engine and exclude local credentials and backups', async () => {
  const pkg = JSON.parse(await read('../package.json'))
  const dockerfile = await read('../Dockerfile')
  const major = pkg.engines.node.match(/\d+/)[0]
  assert.deepEqual([...dockerfile.matchAll(/^FROM node:(\d+)-alpine/gm)].map(match => match[1]), [major, major])
  const ignored = (await read('../.dockerignore')).trim().split('\n')
  for (const pattern of ['**/.env*', '**/*.key', '**/*.pem', '**/credentials*', '**/secrets*', '**/.omc', '**/node_modules*']) {
    assert.ok(ignored.includes(pattern), `Missing exclusion: ${pattern}`)
  }
})
