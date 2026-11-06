import type { N8nWorkflow } from './types'

type NodeIdentity = Pick<N8nWorkflow['nodes'][number], 'id' | 'name'>

interface NormalizationOptions {
  warnings?: string[]
  /** Editing may discard dangling references without enabling generation repairs. */
  dropDangling?: boolean
}

/** Strict by default; generation repairs are reported through options.warnings. */
export function normalizeConnections(
  nodes: NodeIdentity[],
  input: unknown,
  target: 'id' | 'name' = 'id',
  allowLegacy = false,
  options: NormalizationOptions = {},
): N8nWorkflow['connections'] {
  const errors: string[] = []
  const warnings: string[] = []
  const identities = allowLegacy ? nodes.map(node => ({ ...node })) : nodes
  const reservedNames = new Set(nodes.map(node => node?.name))
  const byId = new Map<string, NodeIdentity>()
  const byName = new Map<string, NodeIdentity>()
  for (const node of identities) {
    if (!node || typeof node.id !== 'string' || !node.id.trim() ||
        typeof node.name !== 'string' || !node.name.trim()) {
      throw new Error('每个节点必须有有效的ID和名称')
    }
    if (byId.has(node.id)) errors.push(`节点ID重复: ${node.id}`)
    if (byName.has(node.name)) {
      if (allowLegacy) {
        const originalName = node.name
        let suffix = 1
        while (reservedNames.has(`${originalName}${suffix}`)) suffix++
        node.name = `${originalName}${suffix}`
        reservedNames.add(node.name)
        warnings.push(`节点名称重复: ${originalName}，已重命名为 ${node.name}；原名称引用保留指向首个节点`)
      } else {
        errors.push(`节点名称重复: ${node.name}`)
      }
    }
    byId.set(node.id, node)
    byName.set(node.name, node)
  }
  const resolve = (key: unknown, role: string): NodeIdentity | undefined => {
    if (typeof key !== 'string') throw new Error(`连接缺少${role}节点`)
    const idMatch = byId.get(key)
    const nameMatch = byName.get(key)
    if (idMatch && nameMatch && idMatch !== nameMatch) {
      throw new Error(`节点引用存在ID与名称歧义: ${key}`)
    }
    const node = idMatch || nameMatch
    if (!node) {
      const message = `连接中引用了不存在的${role}节点: ${key}`
      if (!allowLegacy && !options.dropDangling) throw new Error(message)
      warnings.push(`${message}，已丢弃连接`)
    }
    return node
  }
  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!isObject(input)) throw new Error('连接配置必须是对象')
  const result: N8nWorkflow['connections'] = Object.create(null)
  for (const [source, rawOutputs] of Object.entries(input)) {
    const sourceNode = resolve(source, '源')
    if (!sourceNode) continue
    const sourceKey = sourceNode[target]
    if (!isObject(rawOutputs)) throw new Error('节点输出配置必须是对象')
    let outputs = rawOutputs
    const keys = Object.keys(outputs)
    if (allowLegacy && keys.length && keys.every(key => /^\d+$/.test(key))) {
      const indexes = keys.map(Number)
      if (indexes.some(index => !Number.isSafeInteger(index) || index >= 1000)) {
        throw new Error('旧格式输出索引超出范围')
      }
      outputs = { main: Array.from({ length: Math.max(...indexes) + 1 }, (_, i) => rawOutputs[String(i)] ?? []) }
    }
    const normalized = result[sourceKey] ??= Object.create(null)
    for (const [type, rawGroups] of Object.entries(outputs)) {
      if (!type || !Array.isArray(rawGroups)) throw new Error('连接分组必须是数组')
      const groups = allowLegacy && rawGroups.length && !Array.isArray(rawGroups[0])
        ? [rawGroups] : rawGroups
      const destination = normalized[type] ??= []
      groups.forEach((group, groupIndex) => {
        if (!Array.isArray(group)) throw new Error('每个输出分支必须是数组')
        const connections = []
        for (const connection of group as unknown[]) {
          if (!isObject(connection)) throw new Error('连接项必须是对象')
          const connectionType = connection.type ?? (allowLegacy ? type : undefined)
          let index = connection.index ?? (allowLegacy ? 0 : undefined)
          if (allowLegacy && typeof index === 'string' && /^\d+$/.test(index)) {
            index = Number(index)
            warnings.push('已将连接输入索引从数字字符串转换为整数')
          }
          if (typeof connectionType !== 'string' || !connectionType ||
              typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) {
            throw new Error('连接类型必须是字符串，输入索引必须是非负整数')
          }
          const destinationNode = resolve(connection.node, '目标')
          if (destinationNode) connections.push({ node: destinationNode[target], type: connectionType, index })
        }
        ;(destination[groupIndex] ??= []).push(...connections)
      })
    }
  }
  if (errors.length) throw new Error(errors.join('; '))
  if (allowLegacy) nodes.forEach((node, index) => { node.name = identities[index].name })
  options.warnings?.push(...warnings)
  return result
}
