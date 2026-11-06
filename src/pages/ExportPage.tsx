import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Copy, ArrowLeft, FileText, CheckCircle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/workflowStore'
import { workflowApi } from '../utils/api'
import yaml from 'js-yaml'

/**
 * 工作流导出页面
 * 提供工作流的导出、预览与校验功能
 */
function ExportPage() {
  const navigate = useNavigate()
  const { currentWorkflow } = useWorkflowStore()
  const [exportData, setExportData] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'yaml'>('json')
  const [copied, setCopied] = useState(false)
  const [serverFilename, setServerFilename] = useState<string>('')
  const [serverContentType, setServerContentType] = useState<string>('')

  /**
   * 导出工作流
   * @description 调用后端导出接口，获取内容与文件名
   */
  const handleExport = useCallback(async () => {
    if (!currentWorkflow) return
    setIsExporting(true)
    try {
      const response = await workflowApi.export({
        workflow: currentWorkflow,
        format: exportFormat,
        includeCredentials: false
      })

      if (response.success && response.data) {
        setExportData(response.data.content)
        setServerFilename(response.data.filename)
        setServerContentType(response.data.contentType)
      } else {
        throw new Error(response.error || '导出失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导出工作流时发生错误'
      toast.error(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }, [currentWorkflow, exportFormat])

  useEffect(() => {
    if (!currentWorkflow) {
      toast.error('请先生成一个工作流')
      navigate('/')
      return
    }
    void handleExport()
  }, [currentWorkflow, navigate, handleExport])

  /**
   * 预览区内容的 YAML 校验
   * @returns {string | ''} 返回错误信息，空字符串代表校验通过
   */
  const yamlValidationMessage = useMemo(() => {
    if (!exportData || exportFormat !== 'yaml') return ''
    try {
      yaml.load(exportData) // try parse YAML
      return ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'YAML 解析错误'
      return msg
    }
  }, [exportData, exportFormat])

  /**
   * 复制到剪贴板
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportData)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  /**
   * 下载文件
   * @description 使用后端返回的文件名和 MIME 类型，若缺失则回退
   */
  const handleDownload = () => {
    if (!exportData || !currentWorkflow) return

    const fallbackName = `${currentWorkflow.name || 'workflow'}.${exportFormat}`
    const fileName = serverFilename || fallbackName
    const mime = serverContentType || (exportFormat === 'json' ? 'application/json' : 'application/x-yaml')

    if (exportFormat === 'yaml' && yamlValidationMessage) {
      toast.error('YAML 校验失败，请修正后再下载')
      return
    }

    const blob = new Blob([exportData], { type: mime })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`文件已下载: ${fileName}`)
  }

  if (!currentWorkflow) {
    return null
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/editor')}
            className="btn-secondary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回编辑器
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              导出工作流
            </h1>
            <p className="text-gray-600 mt-2">
              {currentWorkflow.name || '未命名工作流'}
            </p>
          </div>
        </div>
      </div>

      {/* 导出选项 */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">导出设置</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              导出格式
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'json')}
                  className="mr-2"
                />
                JSON (推荐)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="yaml"
                  checked={exportFormat === 'yaml'}
                  onChange={(e) => setExportFormat(e.target.value as 'yaml')}
                  className="mr-2"
                />
                YAML
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 工作流信息 */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">工作流信息</h3>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">名称:</span>
            <span className="ml-2 text-gray-600">{currentWorkflow.name || '未命名'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">节点数量:</span>
            <span className="ml-2 text-gray-600">{currentWorkflow.nodes.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">连接数量:</span>
            <span className="ml-2 text-gray-600">
              {Object.keys(currentWorkflow.connections).length}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">状态:</span>
            <span className="ml-2 text-green-600">就绪</span>
          </div>
        </div>
      </div>

      {/* 导出内容预览 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            导出内容预览
          </h3>

          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              disabled={!exportData || isExporting}
              className="btn-secondary"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? '已复制' : '复制'}
            </button>

            <button
              onClick={handleDownload}
              disabled={!exportData || isExporting || (!!yamlValidationMessage && exportFormat === 'yaml')}
              className="btn-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              下载文件
            </button>
          </div>
        </div>

        {isExporting ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">正在生成导出文件...</p>
            </div>
          </div>
        ) : exportData ? (
          <div className="relative">
            {/* YAML 校验提示 */}
            {exportFormat === 'yaml' && yamlValidationMessage && (
              <div className="flex items-center text-red-600 text-sm mb-2">
                <ShieldAlert className="w-4 h-4 mr-2" />
                <span>YAML 校验失败：{yamlValidationMessage}</span>
              </div>
            )}
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
              <code>{exportData}</code>
            </pre>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">暂无导出内容</p>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="card mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h3>

        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start">
            <span className="font-medium text-gray-900 mr-2">1.</span>
            <span>复制上方的配置内容或下载为文件</span>
          </div>
          <div className="flex items-start">
            <span className="font-medium text-gray-900 mr-2">2.</span>
            <span>在n8n平台中选择"导入工作流"</span>
          </div>
          <div className="flex items-start">
            <span className="font-medium text-gray-900 mr-2">3.</span>
            <span>确认 YAML 校验通过后再下载（若选择 YAML 格式）</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportPage
