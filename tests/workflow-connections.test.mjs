import test from 'node:test'
import assert from 'node:assert/strict'
import yaml from 'js-yaml'
import router from '../api/routes/export.ts'
import { useWorkflowStore } from '../src/store/workflowStore.ts'
import { workflowValidationService } from '../api/services/workflowValidationService.ts'
import { normalizeConnections } from '../shared/workflowConnections.ts'
import { normalizeWorkflowConfig } from '../api/services/openaiService.ts'

const node = (id, name) => ({ id, name, type: 'n8n-nodes-base.start', typeVersion: 1, position: [0, 0], parameters: {} })
const edge = (name, type = 'main', index = 0) => ({ node: name, type, index })
const workflow = () => ({ name: 'fixture', nodes: [node('a', 'Start'), node('b', 'Branch'), node('c', 'End')], connections: { a: { main: [[], [edge('b', 'main', 2)]], ai_tool: [[edge('c', 'ai_tool', 1)]] }, b: { main: [[edge('c')]] } } })
async function exportFixture(value, format = 'json') {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  const handler = router.stack.find(layer => layer.route?.path === '/export').route.stack[0].handle
  await handler({ body: { workflow: value, format } }, response)
  return response
}

test('JSON and YAML exports resolve IDs to n8n names and preserve all branches and channels', async () => {
  for (const format of ['json', 'yaml']) {
    const value = workflow()
    const before = JSON.stringify(value)
    const response = await exportFixture(value, format)
    assert.equal(response.statusCode, 200)
    const exported = format === 'json' ? JSON.parse(response.body.data.content) : yaml.load(response.body.data.content)
    assert.deepEqual(exported.connections.Start.main, [[], [edge('Branch', 'main', 2)]])
    assert.deepEqual(exported.connections.Start.ai_tool, [[edge('End', 'ai_tool', 1)]])
    assert.equal(exported.active, false)
    assert.equal(JSON.stringify(value), before)
  }
})

test('exports accept n8n names and preserve execution options without credential references', async () => {
  const value = workflow()
  value.connections = { Start: { main: [[edge('End')]] } }
  Object.assign(value.nodes[0], { disabled: true, retryOnFail: true, maxTries: 4, onError: 'continueErrorOutput', credentials: { fixture: 'fake-reference' } })
  const response = await exportFixture(value)
  assert.equal(response.statusCode, 200)
  const exported = JSON.parse(response.body.data.content)
  assert.deepEqual(exported.connections, value.connections)
  for (const key of ['disabled', 'retryOnFail', 'maxTries', 'onError']) assert.equal(exported.nodes[0][key], value.nodes[0][key])
  assert.equal(exported.nodes[0].credentials, undefined)
})

for (const [label, mutate] of [
  ['duplicate names', w => { w.nodes[1].name = 'Start' }],
  ['duplicate IDs', w => { w.nodes[1].id = 'a' }],
  ['ambiguous name and ID', w => { w.nodes[1].name = 'a' }],
  ['missing source', w => { w.connections.missing = { main: [] } }],
  ['missing target', w => { w.connections.a.main[1][0].node = 'missing' }],
  ['negative input index', w => { w.connections.a.main[1][0].index = -1 }],
  ['fractional input index', w => { w.connections.a.main[1][0].index = 0.5 }],
  ['numeric-string input index', w => { w.connections.a.main[1][0].index = '0' }],
  ['invalid channel shape', w => { w.connections.a.ai_tool = 'invalid' }],
  ['null edge', w => { w.connections.a.main[1][0] = null }],
]) {
  test(`export rejects ${label} with 400`, async () => {
    const value = workflow(); mutate(value)
    const response = await exportFixture(value)
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.success, false)
  })
}

test('export rejects non-string workflow names and unsupported formats', async () => {
  const value = workflow(); value.name = { invalid: true }
  assert.equal((await exportFixture(value)).statusCode, 400)
  assert.equal((await exportFixture(workflow(), 'csv')).statusCode, 400)
})

for (const style of ['id', 'name']) {
  test(`removing a node clears incoming and outgoing ${style} connections without moving branches`, () => {
    const value = workflow()
    value.connections = normalizeConnections(value.nodes, value.connections, style)
    const before = JSON.stringify(value)
    useWorkflowStore.getState().setCurrentWorkflow(value)
    useWorkflowStore.getState().removeNode('b')
    const current = useWorkflowStore.getState().currentWorkflow
    assert.deepEqual(current.nodes.map(n => n.id), ['a', 'c'])
    assert.deepEqual(JSON.parse(JSON.stringify(current.connections)), { a: { main: [[], []], ai_tool: [[edge('c', 'ai_tool', 1)]] } })
    assert.equal(JSON.stringify(value), before)
    useWorkflowStore.getState().reset()
  })
}

test('validation accepts both references and checks non-main channels', async () => {
  const value = workflow()
  value.connections = normalizeConnections(value.nodes, value.connections, 'name')
  const valid = await workflowValidationService.validateWorkflow(value)
  assert.equal(valid.isValid, true, valid.errors.join('; '))
  value.connections.Start.ai_tool[0][0].node = 'missing'
  const invalid = await workflowValidationService.validateWorkflow(value)
  assert.equal(invalid.isValid, false)
  assert.ok(invalid.errors.some(error => error.includes('missing')))
})

test('legacy numeric output indexes preserve empty branches and source aliases merge', () => {
  const value = workflow()
  const result = normalizeConnections(value.nodes, { a: { '1': [edge('b')] }, Start: { main: [[edge('End')]] } }, 'id', true)
  assert.deepEqual(result.a.main, [[edge('c')], [edge('b')]])
  assert.throws(() => normalizeConnections(value.nodes, { a: { '10000000': [] } }, 'id', true), /索引/)
})

test('prototype-like node names and channels remain data', () => {
  const nodes = [node('a', '__proto__'), node('b', 'constructor')]
  const input = JSON.parse('{"__proto__":{"__proto__":[[{"node":"constructor","type":"main","index":0}]]}}')
  const result = normalizeConnections(nodes, input, 'name')
  assert.equal(result.__proto__.__proto__[0][0].node, 'constructor')
  assert.equal({}.node, undefined)
})

test('generation keeps all channels, accepts flat legacy groups and fills sparse output slots', () => {
  const value = workflow()
  value.connections = { Start: { main: [edge('Branch')], ai_tool: [[edge('End', 'ai_tool', 1)]] }, Branch: { '2': [{ node: 'End' }] } }
  const normalized = normalizeWorkflowConfig(value)
  assert.deepEqual(normalized.connections.a.main, [[edge('b')]])
  assert.deepEqual(normalized.connections.a.ai_tool, [[edge('c', 'ai_tool', 1)]])
  assert.deepEqual(normalized.connections.b.main, [[], [], [edge('c')]])
})

test('generation drops dangling edges with warnings while preserving branches and channels', () => {
  const value = workflow()
  value.connections.a.main[1].push(edge('missing'))
  value.connections.a.ai_tool[0].push(edge('missing-tool', 'ai_tool'))
  value.connections.missing = { main: [[edge('c')]] }
  const normalized = normalizeWorkflowConfig(value)
  assert.deepEqual(normalized.connections.a.main, [[], [edge('b', 'main', 2)]])
  assert.deepEqual(normalized.connections.a.ai_tool, [[edge('c', 'ai_tool', 1)]])
  assert.equal(normalized.connections.missing, undefined)
  for (const name of ['missing', 'missing-tool']) {
    assert.ok(normalized.meta.normalizationWarnings.some(warning => warning.includes(name)))
  }
  assert.equal(normalized.meta.normalizationWarnings.length, 3)
})

test('generation converts numeric-string input indexes to integers', () => {
  const value = workflow(); value.connections.a.main[1][0].index = '0'
  const normalized = normalizeWorkflowConfig(value)
  assert.deepEqual(normalized.connections.a.main[1], [edge('b')])
  assert.ok(normalized.meta.normalizationWarnings.some(warning => warning.includes('索引')))
})

test('generation renames duplicate names and rewrites ID and name references', () => {
  const value = workflow()
  value.nodes.forEach(n => { n.name = 'Set' })
  value.connections.Set = { main: [[edge('b')]] }
  value.connections.b.main[0].push(edge('Set'))
  const normalized = normalizeWorkflowConfig(value)
  assert.deepEqual(normalized.nodes.map(n => n.name), ['Set', 'Set1', 'Set2'])
  assert.deepEqual(normalized.connections.a.main, [[edge('b')], [edge('b', 'main', 2)]])
  assert.deepEqual(normalized.connections.b.main, [[edge('c'), edge('a')]])
  assert.ok(normalized.meta.normalizationWarnings.some(warning => warning.includes('Set1')))
  assert.ok(normalized.meta.normalizationWarnings.some(warning => warning.includes('Set2')))
  const exported = normalizeConnections(normalized.nodes, normalized.connections, 'name')
  assert.deepEqual(exported.Set1.main, [[edge('Set2'), edge('Set')]])
})

test('legacy duplicate renaming preserves existing suffixed names', () => {
  const nodes = [node('a', 'Set'), node('b', 'Set'), node('c', 'Set1')]
  const warnings = []
  const result = normalizeConnections(nodes, { b: { main: [[edge('Set1')]] } }, 'name', true, { warnings })
  assert.deepEqual(nodes.map(n => n.name), ['Set', 'Set2', 'Set1'])
  assert.deepEqual(result.Set2.main, [[edge('Set1')]])
  assert.equal(warnings.length, 1)
})

test('validation remains strict for generation-only repairs', async () => {
  for (const mutate of [
    w => { w.nodes[1].name = 'Start' },
    w => { w.connections.a.main[1][0].node = 'missing' },
    w => { w.connections.a.main[1][0].index = '0' },
  ]) {
    const value = workflow(); mutate(value)
    assert.equal((await workflowValidationService.validateWorkflow(value)).isValid, false)
    assert.equal((await exportFixture(value)).statusCode, 400)
  }
})

test('deletion drops dangling connections and ignores an unknown node', () => {
  const value = workflow(); value.connections.a.main[1].push(edge('missing'))
  value.connections.missing = { main: [[edge('c')]] }
  const before = JSON.stringify(value)
  useWorkflowStore.getState().setCurrentWorkflow(value)
  useWorkflowStore.getState().removeNode('unknown')
  assert.equal(useWorkflowStore.getState().currentWorkflow, value)
  useWorkflowStore.getState().removeNode('b')
  const current = useWorkflowStore.getState().currentWorkflow
  assert.deepEqual(current.nodes.map(n => n.id), ['a', 'c'])
  assert.deepEqual(current.connections.a.main, [[], []])
  assert.deepEqual(current.connections.a.ai_tool, [[edge('c', 'ai_tool', 1)]])
  assert.equal(current.connections.b, undefined)
  assert.equal(current.connections.missing, undefined)
  assert.equal(useWorkflowStore.getState().error, null)
  assert.equal(JSON.stringify(value), before)
  useWorkflowStore.getState().reset()
})

test('editing tolerates dangling references but still rejects invalid identity changes', () => {
  const value = workflow()
  value.connections = normalizeConnections(value.nodes, value.connections, 'name')
  value.connections.Start.ai_tool[0].push(edge('missing', 'ai_tool'))
  value.connections.missing = { main: [[edge('End')]] }
  const before = JSON.stringify(value)
  useWorkflowStore.getState().setCurrentWorkflow(value)
  useWorkflowStore.getState().updateNode('b', { name: 'Renamed' })
  const current = useWorkflowStore.getState().currentWorkflow
  assert.equal(current.nodes[1].name, 'Renamed')
  assert.deepEqual(current.connections.a.main, [[], [edge('b', 'main', 2)]])
  assert.deepEqual(current.connections.a.ai_tool, [[edge('c', 'ai_tool', 1)]])
  assert.equal(current.connections.missing, undefined)
  assert.equal(useWorkflowStore.getState().error, null)
  assert.equal(JSON.stringify(value), before)
  for (const updates of [{ name: 'Start' }, { id: 'different-id' }]) {
    useWorkflowStore.getState().updateNode('b', updates)
    assert.equal(useWorkflowStore.getState().currentWorkflow, current)
    assert.ok(useWorkflowStore.getState().error)
  }
  useWorkflowStore.getState().reset()
})

test('renaming a node keeps name-based links and rejects duplicate names or identity changes', () => {
  const value = workflow(); value.connections = normalizeConnections(value.nodes, value.connections, 'name')
  useWorkflowStore.getState().setCurrentWorkflow(value)
  useWorkflowStore.getState().updateNode('b', { name: 'Renamed' })
  const renamed = useWorkflowStore.getState().currentWorkflow
  assert.deepEqual(renamed.connections.a.main[1], [edge('b', 'main', 2)])
  assert.equal(renamed.nodes[1].name, 'Renamed')
  for (const updates of [{ name: 'Start' }, { id: 'different-id' }]) {
    useWorkflowStore.getState().updateNode('b', updates)
    assert.equal(useWorkflowStore.getState().currentWorkflow, renamed)
    assert.ok(useWorkflowStore.getState().error)
  }
  useWorkflowStore.getState().reset()
})
