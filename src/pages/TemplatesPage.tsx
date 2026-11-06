import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trash2, Eye, Plus, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/workflowStore'
import { templateApi } from '../utils/api'
import { WorkflowTemplate } from '@/shared/types'

/**
 * 模板管理页面
 * 提供模板的查看、使用、删除等功能
 */
function TemplatesPage() {
  const navigate = useNavigate()
  const { templates, setTemplates, setCurrentWorkflow } = useWorkflowStore()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  /**
   * 加载模板列表
   */
  const loadTemplates = useCallback(async () => {
    try {
      const response = await templateApi.getTemplates()
      if (response.success && response.data) {
        setTemplates(response.data)
      }
    } catch {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [setTemplates])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])
  
  /**
   * 使用模板
   */
  const handleUseTemplate = (template: WorkflowTemplate) => {
    setCurrentWorkflow(template.workflow)
    toast.success(`已加载模板: ${template.name}`)
    navigate('/editor')
  }
  
  /**
   * 删除模板
   */
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      await templateApi.deleteTemplate(templateId)
      setTemplates(templates.filter(t => t.id !== templateId))
      toast.success('模板已删除')
    } catch {
      toast.error('删除模板失败')
    }
  }
  
  /**
   * 过滤模板
   */
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })
  
  /**
   * 获取所有分类
   */
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))]
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载模板中...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div>
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">模板管理</h1>
          <p className="text-gray-600 mt-2">管理和使用工作流模板</p>
        </div>
        
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建新工作流
        </button>
      </div>
      
      {/* 搜索和过滤 */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索模板..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input pl-10 pr-8 appearance-none bg-white"
            >
              <option value="all">所有分类</option>
              {categories.filter(cat => cat !== 'all').map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* 模板列表 */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || selectedCategory !== 'all' ? '未找到匹配的模板' : '暂无模板'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedCategory !== 'all' 
              ? '尝试调整搜索条件或过滤器' 
              : '创建您的第一个工作流来生成模板'
            }
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            创建工作流
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {template.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {template.category}
                </span>
                <span>使用 {template.usageCount} 次</span>
              </div>
              
              <div className="flex items-center text-xs text-gray-400 mb-4">
                <span>节点: {template.workflow.nodes.length}</span>
                <span className="mx-2">•</span>
                <span>创建于 {new Date(template.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="btn-primary flex-1 text-sm"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  使用模板
                </button>
                
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="btn-secondary text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TemplatesPage