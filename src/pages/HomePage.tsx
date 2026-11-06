import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/workflowStore'
import { workflowApi } from '../utils/api'

/**
 * 主页面组件
 * 提供工作流目标输入和生成功能
 */
function HomePage() {
  const navigate = useNavigate()
  const { 
    description, 
    setDescription, 
    setCurrentWorkflow, 
    setIsGenerating, 
    isGenerating,
    error,
    setError 
  } = useWorkflowStore()
  
  const [localDescription, setLocalDescription] = useState(description)
  
  /**
   * 处理工作流生成
   */
  const handleGenerate = async () => {
    if (!localDescription.trim()) {
      toast.error('请输入工作流描述')
      return
    }
    
    setIsGenerating(true)
    setError(null)
    setDescription(localDescription)
    
    try {
      const response = await workflowApi.generate({
        description: localDescription.trim(),
        preferences: {
          complexity: 'medium',
          includeErrorHandling: true,
          nodeStyle: 'detailed'
        }
      })
      
      if (response.success && response.data) {
        setCurrentWorkflow(response.data.workflow)
        toast.success('工作流生成成功！')
        navigate('/editor')
      } else {
        throw new Error(response.error || '生成失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成工作流时发生错误'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }
  
  /**
   * 处理示例描述点击
   */
  const handleExampleClick = (example: string) => {
    setLocalDescription(example)
  }
  
  const examples = [
    '每天定时从API获取数据并发送邮件报告',
    '监控网站状态，异常时发送Slack通知',
    '处理CSV文件数据并同步到数据库',
    '自动化社交媒体内容发布流程',
    '订单处理和库存管理自动化'
  ]
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full">
            <Sparkles className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          AI驱动的n8n工作流生成器
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          只需描述您的自动化需求，AI将为您生成完整的n8n工作流配置
        </p>
      </div>
      
      {/* 主要输入区域 */}
      <div className="card mb-8">
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            描述您想要自动化的工作流程
          </label>
          <textarea
            id="description"
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            placeholder="例如：每天早上9点从CRM系统获取新客户数据，处理后发送欢迎邮件，并在Slack中通知销售团队..."
            className="textarea w-full h-32 resize-none"
            disabled={isGenerating}
          />
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
        
        {/* 生成按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !localDescription.trim()}
            className="btn-primary px-8 py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                正在生成工作流...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                生成工作流
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 示例区域 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💡 示例工作流描述
        </h3>
        <div className="grid gap-3">
          {examples.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className="text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200"
              disabled={isGenerating}
            >
              <span className="text-gray-700">{example}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* 功能特性 */}
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI智能解析</h3>
          <p className="text-gray-600">基于GPT模型理解自然语言描述，智能生成工作流结构</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4">
            <ArrowRight className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">可视化编辑</h3>
          <p className="text-gray-600">生成后可在可视化编辑器中进一步调整和优化工作流</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4">
            <ArrowRight className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">一键导出</h3>
          <p className="text-gray-600">生成的工作流可直接导入到n8n平台使用</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage
