import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Badge component not available, using span instead
import { Loader2, Download, Eye, Zap, GitCompare, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { N8nWorkflow } from '@/shared/types';

interface WorkflowResult {
  model: string;
  workflow: N8nWorkflow;
  complexity: number;
  completeness: number;
  nodeCount: number;
  error?: string;
  savedPath?: string;
}

interface ComparisonResult {
  results: WorkflowResult[];
  bestResult: WorkflowResult;
  bestWorkflowPath: string;
  allResultsPaths: { model: string; path: string }[];
}

interface ModelTestResult {
  model: string;
  status: 'success' | 'error';
  response?: string;
  error?: string;
}
interface StoredWorkflowSummary { filename: string; name: string; nodeCount: number; createdAt: string }

const N8nWorkflowGenerator: React.FC = () => {
  const [description, setDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState<'openai' | 'gemini' | 'grok'>('openai');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [singleResult, setSingleResult] = useState<WorkflowResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [modelTests, setModelTests] = useState<ModelTestResult[]>([]);
  const [workflowList, setWorkflowList] = useState<StoredWorkflowSummary[]>([]);

  // 测试AI模型连接
  const testModels = async (showToast = true) => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/n8n-workflow/test-models');
      const data = await response.json();
      
      if (data.success) {
        setModelTests(data.data);
        if (showToast) {
          const successCount = data.data.filter((test: ModelTestResult) => test.status === 'success').length;
          toast.success(`模型测试完成，${successCount}/${data.data.length} 个模型连接成功`);
        }
      } else {
        if (showToast) {
          toast.error('模型测试失败');
        }
      }
    } catch (error) {
      console.error('测试模型失败:', error);
      if (showToast) {
        toast.error('测试模型失败');
      }
    } finally {
      setIsTesting(false);
    }
  };

  // 生成单个模型工作流
  const generateSingleWorkflow = async () => {
    if (!description.trim()) {
      toast.error('请输入工作流描述');
      return;
    }

    setIsGenerating(true);
    setSingleResult(null);
    
    try {
      const response = await fetch('/api/n8n-workflow/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          model: selectedModel
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSingleResult(data.data);
        toast.success(`使用 ${selectedModel.toUpperCase()} 模型生成工作流成功`);
        loadWorkflowList(); // 刷新工作流列表
      } else {
        toast.error(data.error || '生成工作流失败');
      }
    } catch (error) {
      console.error('生成工作流失败:', error);
      toast.error('生成工作流失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成多模型对比工作流
  const generateComparisonWorkflow = async () => {
    if (!description.trim()) {
      toast.error('请输入工作流描述');
      return;
    }

    setIsComparing(true);
    setComparisonResult(null);
    
    try {
      const response = await fetch('/api/n8n-workflow/generate-compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setComparisonResult(data.data);
        toast.success(`多模型对比完成，最佳模型: ${data.data.bestResult.model}`);
        loadWorkflowList(); // 刷新工作流列表
      } else {
        toast.error(data.error || '多模型对比失败');
      }
    } catch (error) {
      console.error('多模型对比失败:', error);
      toast.error('多模型对比失败');
    } finally {
      setIsComparing(false);
    }
  };

  // 下载工作流
  const downloadWorkflow = (filename: string, workflowName: string) => {
    const link = document.createElement('a');
    link.href = `/api/n8n-workflow/download/${filename}`;
    link.download = filename;
    link.click();
    toast.success(`开始下载工作流: ${workflowName}`);
  };

  // 加载工作流列表
  const loadWorkflowList = async () => {
    try {
      const response = await fetch('/api/n8n-workflow/list');
      const data = await response.json();
      
      if (data.success) {
        setWorkflowList(data.data);
      }
    } catch (error) {
      console.error('加载工作流列表失败:', error);
    }
  };

  // 组件加载时获取工作流列表，静默测试模型状态
  useEffect(() => {
    loadWorkflowList();
    // 静默测试模型，不显示toast提示
    testModels(false);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 标题和模型状态 */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">n8n AI 工作流生成器</h1>
        <p className="text-gray-600">使用 AI 模型自动生成专业的 n8n 工作流</p>
        
        {/* 模型连接状态 */}
        <div className="flex justify-center items-center gap-4 flex-wrap">
          {modelTests.map((test) => (
            <span 
              key={test.model} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-w-[100px] justify-center ${
                test.status === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
              }`}
            >
              {test.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {test.model}
            </span>
          ))}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => testModels(true)} 
            disabled={isTesting}
            className="ml-4 border-2 border-gray-300 hover:border-gray-400"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : '重新测试'}
          </Button>
        </div>
      </div>

      {/* 工作流描述输入 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            工作流描述
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="请详细描述您想要创建的工作流，例如：创建一个收集错题的工作流，包括题目录入、分类管理、统计分析等功能..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="resize-none"
          />
          
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between mt-6 mb-6">
            <div className="flex items-center gap-4 py-4">
              <label className="text-sm font-medium whitespace-nowrap min-w-[70px]">选择模型:</label>
              <Select value={selectedModel} onValueChange={(value) => {
                if (value === 'openai' || value === 'gemini' || value === 'grok') setSelectedModel(value)
              }}>
                <SelectTrigger className="w-40 min-w-[160px] border-2 border-gray-300 hover:border-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-white border-2 border-gray-200 shadow-xl">
                  <SelectItem value="openai" className="py-3 px-4 hover:bg-blue-50 cursor-pointer">OpenAI GPT-4</SelectItem>
                  <SelectItem value="gemini" className="py-3 px-4 hover:bg-green-50 cursor-pointer">Google Gemini</SelectItem>
                  <SelectItem value="grok" className="py-3 px-4 hover:bg-purple-50 cursor-pointer">xAI Grok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-4 flex-wrap justify-center sm:justify-end">
              <Button 
                onClick={generateSingleWorkflow} 
                disabled={isGenerating || !description.trim()}
                className="flex items-center gap-2 border-4 border-blue-600 bg-blue-600 hover:bg-blue-700 hover:border-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 min-w-[140px]"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                生成工作流
              </Button>
              
              <Button 
                onClick={generateComparisonWorkflow} 
                disabled={isComparing || !description.trim()}
                variant="outline"
                className="flex items-center gap-2 border-4 border-purple-600 bg-purple-50 hover:bg-purple-100 hover:border-purple-700 text-purple-700 font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 min-w-[140px]"
              >
                {isComparing ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitCompare className="w-5 h-5" />}
                多模型对比
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 单个模型结果 */}
      {singleResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>生成结果 - {singleResult.model.toUpperCase()}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => downloadWorkflow(
                  singleResult.savedPath?.split('/').pop() || 'workflow.json',
                  singleResult.workflow.name || '工作流'
                )}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{singleResult.nodeCount}</div>
                <div className="text-sm text-gray-600">节点数量</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{singleResult.complexity.toFixed(1)}</div>
                <div className="text-sm text-gray-600">复杂度评分</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{singleResult.completeness.toFixed(1)}</div>
                <div className="text-sm text-gray-600">完整度评分</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">工作流名称: {singleResult.workflow.name}</h4>
              <p className="text-sm text-gray-600 mb-2">节点: {singleResult.workflow.nodes?.map((node) => node.type).join(', ')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 多模型对比结果 */}
      {comparisonResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>多模型对比结果</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => downloadWorkflow(
                  comparisonResult.bestWorkflowPath.split('/').pop() || 'best_workflow.json',
                  comparisonResult.bestResult.workflow.name || '最佳工作流'
                )}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载最佳
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparisonResult.results.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-2 ${
                    result.model === comparisonResult.bestResult.model 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{result.model}</h4>
                      {result.model === comparisonResult.bestResult.model && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">最佳</span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        const pathInfo = comparisonResult.allResultsPaths.find(p => p.model === result.model);
                        if (pathInfo) {
                          downloadWorkflow(
                            pathInfo.path.split('/').pop() || 'workflow.json',
                            result.workflow.name || `${result.model}工作流`
                          );
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      下载
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">节点数: </span>
                      <span className="font-medium">{result.nodeCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">复杂度: </span>
                      <span className="font-medium">{result.complexity.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">完整度: </span>
                      <span className="font-medium">{result.completeness.toFixed(1)}</span>
                    </div>
                  </div>
                  
                  {result.error && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      错误: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 历史工作流列表 */}
      {workflowList.length > 0 && (
        <div className="mt-12 pt-8 border-t-2 border-gray-200">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                历史工作流 ({workflowList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {workflowList.slice(0, 10).map((workflow, index) => {
                  // 从文件名中提取模型信息
                  const getModelFromFilename = (filename: string) => {
                    if (filename.includes('openai') || filename.includes('OpenAI')) return 'OpenAI';
                    if (filename.includes('gemini') || filename.includes('Gemini')) return 'Gemini';
                    if (filename.includes('grok') || filename.includes('Grok')) return 'Grok';
                    if (filename.includes('best') || filename.includes('compare')) return '多模型对比';
                    return '';
                  };
                  
                  const modelLabel = getModelFromFilename(workflow.filename);
                  const displayName = modelLabel ? `${workflow.name} [${modelLabel}]` : workflow.name;
                  
                  return (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{displayName}</h4>
                        <p className="text-sm text-gray-600">
                          {workflow.nodeCount} 个节点 • {new Date(workflow.createdAt).toLocaleString()}
                        </p>
                        {modelLabel && (
                          <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                            modelLabel === 'OpenAI' ? 'bg-green-100 text-green-800' :
                            modelLabel === 'Gemini' ? 'bg-blue-100 text-blue-800' :
                            modelLabel === 'Grok' ? 'bg-purple-100 text-purple-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {modelLabel}
                          </span>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => downloadWorkflow(workflow.filename, displayName)}
                        className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Download className="w-4 h-4" />
                        下载
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default N8nWorkflowGenerator;
