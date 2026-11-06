import type { WorkflowGenerateRequest } from '../../shared/types'

export interface NormalizedWorkflowRequest {
  description: string
  context?: string
  requirements?: string[]
  constraints?: string[]
  preferredNodes?: string[]
  avoidNodes?: string[]
  complexity: 'simple' | 'medium' | 'complex'
  useEnhancedPrompt: boolean
}

export function normalizeWorkflowRequest(input: WorkflowGenerateRequest): NormalizedWorkflowRequest {
  const preferences = input.preferences
  const constraints = [...(input.constraints ?? [])]
  if (preferences?.includeErrorHandling) constraints.push('包含明确的错误处理路径')
  if (preferences?.nodeStyle) constraints.push(`节点配置详细程度: ${preferences.nodeStyle}`)

  return {
    description: input.description.trim(),
    context: input.context,
    requirements: input.requirements,
    constraints: constraints.length > 0 ? constraints : undefined,
    preferredNodes: input.preferredNodes ?? preferences?.preferredNodes,
    avoidNodes: input.avoidNodes,
    complexity: input.complexity ?? preferences?.complexity ?? 'medium',
    useEnhancedPrompt: input.useEnhancedPrompt ?? true,
  }
}
