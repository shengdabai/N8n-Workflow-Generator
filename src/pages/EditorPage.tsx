import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Play, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/workflowStore'

/**
 * 工作流编辑器页面
 * 提供可视化的工作流编辑功能
 */
function EditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentWorkflow, setCurrentWorkflow } = useWorkflowStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  
  useEffect(() => {
    const stateWorkflow = location.state?.workflow
    
    if (stateWorkflow) {
      // 从路由状态中获取工作流
      setCurrentWorkflow(stateWorkflow)
    } else if (!currentWorkflow) {
      // 如果没有工作流数据，重定向到首页
      navigate('/')
    }
  }, [location.state, currentWorkflow, setCurrentWorkflow, navigate])
  
  /**
   * 保存工作流为模板
   */
  const handleSave = async () => {
    if (!currentWorkflow) return
    
    const templateName = prompt('请输入模板名称:')
    if (!templateName) return
    
    setIsSaving(true)
    try {
      const templates = JSON.parse(localStorage.getItem('workflow-templates') || '[]')
      const newTemplate = {
        id: Date.now().toString(),
        name: templateName,
        workflow: currentWorkflow,
        createdAt: new Date().toISOString()
      }
      
      templates.push(newTemplate)
      localStorage.setItem('workflow-templates', JSON.stringify(templates))
      
      toast.success('模板保存成功！')
    } catch (error) {
      console.error('保存模板失败:', error)
      toast.error('保存模板失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }
  
  /**
   * 测试运行工作流
   */
  const handleTest = async () => {
    if (!currentWorkflow) return
    
    setIsTesting(true)
    try {
      // 基本验证工作流结构
      if (!currentWorkflow.nodes || currentWorkflow.nodes.length === 0) {
        throw new Error('工作流必须包含至少一个节点')
      }
      
      // 检查是否有触发节点
      const hasTrigger = currentWorkflow.nodes.some(node => 
        node.type.includes('webhook') || 
        node.type.includes('cron') || 
        node.type.includes('start')
      )
      
      if (!hasTrigger) {
        throw new Error('工作流必须包含一个触发节点')
      }
      
      // 模拟测试执行
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('工作流测试通过！结构验证成功')
    } catch (error) {
      console.error('工作流测试失败:', error)
      toast.error(error instanceof Error ? error.message : '工作流测试失败')
    } finally {
      setIsTesting(false)
    }
  }
  
  /**
   * 导出工作流
   */
  const handleExport = () => {
    if (!currentWorkflow) return
    
    navigate('/export')
  }
  
  if (!currentWorkflow) {
    return null
  }
  
  return (
    <div className="h-full">
      {/* 工具栏 */}
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </button>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentWorkflow.name || '未命名工作流'}
              </h1>
              <p className="text-sm text-gray-500">
                节点数量: {currentWorkflow.nodes.length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="btn-secondary"
            >
              <Play className="w-4 h-4 mr-2" />
              {isTesting ? '测试中...' : '测试运行'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-secondary"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存模板'}
            </button>
            
            <button
              onClick={handleExport}
              className="btn-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              导出工作流
            </button>
          </div>
        </div>
      </div>
      
      {/* 工作流显示 */}
      <div className="h-[calc(100vh-200px)] px-6">
        <div className="bg-white rounded-lg border p-6 h-full overflow-auto">
          <h2 className="text-lg font-semibold mb-4">工作流结构</h2>
          <div className="space-y-4">
            {currentWorkflow.nodes.map((node, index) => (
              <div key={node.id || index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{node.name}</h3>
                  <span className="text-sm text-gray-500 bg-blue-100 px-2 py-1 rounded">
                    {node.type}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  位置: ({node.position?.[0] || 0}, {node.position?.[1] || 0})
                </div>
                {node.parameters && Object.keys(node.parameters).length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700">参数:</div>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(node.parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {currentWorkflow.connections && Object.keys(currentWorkflow.connections).length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-4">连接关系</h2>
              <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
                {JSON.stringify(currentWorkflow.connections, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorPage
