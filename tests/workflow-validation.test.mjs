import test from 'node:test'
import assert from 'node:assert/strict'

import { validateData } from '../api/middleware/validation.ts'
import { workflowValidationService } from '../api/services/workflowValidationService.ts'
import { normalizeWorkflowRequest } from '../api/utils/workflowRequest.ts'

test('request validation rejects missing and out-of-range fields', () => {
  const errors = validateData(
    { description: '', limit: 11 },
    {
      description: { required: true, type: 'string', minLength: 10 },
      limit: { required: true, type: 'number', min: 1, max: 10 },
    },
  )

  assert.deepEqual(
    errors.map(({ field }) => field),
    ['description', 'limit'],
  )
})

test('workflow validation accepts a minimal connected workflow', async () => {
  const result = await workflowValidationService.validateWorkflow({
    name: 'minimal',
    nodes: [
      {
        id: 'start',
        name: 'Start',
        type: 'n8n-nodes-base.start',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: 'set',
        name: 'Set',
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [200, 0],
        parameters: {},
      },
    ],
    connections: {
      start: { main: [[{ node: 'set', type: 'main', index: 0 }]] },
    },
    active: false,
    settings: {},
    staticData: {},
  })

  assert.equal(result.isValid, true, result.errors.join('; '))
})

test('workflow validation rejects duplicate node IDs and dangling targets', async () => {
  const result = await workflowValidationService.validateWorkflow({
    name: 'invalid',
    nodes: [
      {
        id: 'duplicate',
        name: 'First',
        type: 'n8n-nodes-base.start',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: 'duplicate',
        name: 'Second',
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [200, 0],
        parameters: {},
      },
    ],
    connections: {
      duplicate: { main: [[{ node: 'missing', type: 'main', index: 0 }]] },
    },
    active: false,
    settings: {},
    staticData: {},
  })

  assert.equal(result.isValid, false)
  assert.ok(result.errors.some((message) => message.includes('节点ID重复')))
  assert.ok(result.errors.some((message) => message.includes('不存在的目标节点: missing')))
})

test('generation request preserves nested preferences and legacy top-level overrides', () => {
  const nested = normalizeWorkflowRequest({
    description: '  Create a resilient notification workflow  ',
    preferences: {
      preferredNodes: ['Slack'],
      complexity: 'complex',
      includeErrorHandling: true,
      nodeStyle: 'detailed',
    },
  })

  assert.equal(nested.description, 'Create a resilient notification workflow')
  assert.deepEqual(nested.preferredNodes, ['Slack'])
  assert.equal(nested.complexity, 'complex')
  assert.ok(nested.constraints?.some(value => value.includes('错误处理')))
  assert.ok(nested.constraints?.some(value => value.includes('detailed')))

  const legacy = normalizeWorkflowRequest({
    description: 'Create a compatible workflow',
    preferredNodes: ['HTTP Request'],
    complexity: 'simple',
    preferences: { preferredNodes: ['Slack'], complexity: 'complex' },
  })
  assert.deepEqual(legacy.preferredNodes, ['HTTP Request'])
  assert.equal(legacy.complexity, 'simple')
})
