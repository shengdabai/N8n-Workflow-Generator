import { create } from 'zustand'
import { N8nWorkflow, N8nNode, WorkflowTemplate } from '@/shared/types'
import { normalizeConnections } from '../../shared/workflowConnections'

interface WorkflowState {
  // 当前工作流
  currentWorkflow: N8nWorkflow | null
  // 生成状态
  isGenerating: boolean
  // 错误信息
  error: string | null
  // 模板列表
  templates: WorkflowTemplate[]
  // 用户输入的描述
  description: string
  
  // Actions
  setCurrentWorkflow: (workflow: N8nWorkflow | null) => void
  setIsGenerating: (generating: boolean) => void
  setError: (error: string | null) => void
  setTemplates: (templates: WorkflowTemplate[]) => void
  setDescription: (description: string) => void
  
  // 工作流操作
  addNode: (node: N8nNode) => void
  removeNode: (nodeId: string) => void
  updateNode: (nodeId: string, updates: Partial<N8nNode>) => void
  
  // 重置状态
  reset: () => void
}

/**
 * 工作流状态管理store
 * 管理当前工作流、生成状态、模板等全局状态
 */
export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  currentWorkflow: null,
  isGenerating: false,
  error: null,
  templates: [],
  description: '',
  
  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setError: (error) => set({ error }),
  setTemplates: (templates) => set({ templates }),
  setDescription: (description) => set({ description }),
  
  addNode: (node) => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return
    
    set({
      currentWorkflow: {
        ...currentWorkflow,
        nodes: [...currentWorkflow.nodes, node]
      }
    })
  },
  
  removeNode: (nodeId) => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return
    
    if (!currentWorkflow.nodes.some(node => node.id === nodeId)) return
    try {
      const connections = normalizeConnections(currentWorkflow.nodes, currentWorkflow.connections, 'id', false, { dropDangling: true })
      delete connections[nodeId]
      for (const outputs of Object.values(connections)) {
        for (const [type, groups] of Object.entries(outputs)) {
          outputs[type] = groups.map(group => group.filter(connection => connection.node !== nodeId))
        }
      }
      set({
        error: null,
        currentWorkflow: {
          ...currentWorkflow,
          nodes: currentWorkflow.nodes.filter(node => node.id !== nodeId),
          connections
        }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '连接格式错误' })
    }
  },
  
  updateNode: (nodeId, updates) => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return
    
    if (!currentWorkflow.nodes.some(node => node.id === nodeId)) return
    try {
      if (updates.id !== undefined && updates.id !== nodeId) throw new Error('节点ID不能在编辑后改变')
      const connections = normalizeConnections(currentWorkflow.nodes, currentWorkflow.connections, 'id', false, { dropDangling: true })
      const nodes = currentWorkflow.nodes.map(node => node.id === nodeId ? { ...node, ...updates } : node)
      normalizeConnections(nodes, connections)
      set({ error: null, currentWorkflow: { ...currentWorkflow, nodes, connections } })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '节点更新失败' })
    }
  },
  
  reset: () => set({
    currentWorkflow: null,
    isGenerating: false,
    error: null,
    description: ''
  })
}))
