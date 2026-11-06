import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wand2, 
  Zap, 
  FileText, 
  ArrowRight, 
  Settings, 
  Lightbulb,
  Target,
  Layers,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  generateEnhancedWorkflow, 
  optimizeDescription, 
  getNodeRecommendations,
  generateWorkflowPrompt 
} from '../services/api';
import { ErrorHandler } from '../utils/errorHandler';
import IntelligentRecommendations from '../components/IntelligentRecommendations';
import type { 
  EnhancedGenerateRequest, 
  NodeRecommendationRequest, 
  PromptOptimizationRequest,
  NodeRecommendation,
  WorkflowSuggestion
} from '../services/api';

/**
 * 增强工作流生成页面 - 集成提示工程和智能节点推荐
 * @returns JSX.Element
 */
const EnhancedGenerator: React.FC = () => {
  const navigate = useNavigate();
  
  // 基础状态
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex'>('medium');
  
  // 优化和推荐状态
  const [optimizedDescription, setOptimizedDescription] = useState('');
  const [nodeRecommendations, setNodeRecommendations] = useState<NodeRecommendation[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  
  // 加载状态
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGettingRecommendations, setIsGettingRecommendations] = useState(false);
  const [, setIsGeneratingPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // UI状态
  const [showRecommendations, setShowRecommendations] = useState(true);
  
  // 错误状态
  const [error, setError] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  
  // 高级选项
  const [useEnhancedPrompt, setUseEnhancedPrompt] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  /**
   * 添加新的需求项
   */
  const addRequirement = () => {
    setRequirements([...requirements, '']);
  };

  /**
   * 更新需求项
   */
  const updateRequirement = (index: number, value: string) => {
    const newRequirements = [...requirements];
    newRequirements[index] = value;
    setRequirements(newRequirements);
  };

  /**
   * 删除需求项
   */
  const removeRequirement = (index: number) => {
    if (requirements.length > 1) {
      setRequirements(requirements.filter((_, i) => i !== index));
    }
  };

  /**
   * 优化描述
   */
  const handleOptimizeDescription = async () => {
    if (!description.trim()) {
      setOptimizeError('请先输入工作流描述');
      return;
    }

    if (description.trim().length < 5) {
      setOptimizeError('描述过于简短，请至少输入5个字符');
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(null);
    setError('');

    try {
      const request: PromptOptimizationRequest = {
        description: description.trim(),
        context: context.trim() || undefined,
        requirements: requirements.filter(req => req.trim()).length > 0 
          ? requirements.filter(req => req.trim()) 
          : undefined,
        complexity
      };

      const optimized = await optimizeDescription(request);
      setOptimizedDescription(optimized);
    } catch (err) {
      console.error('描述优化失败:', err);
      const errorMessage = ErrorHandler.getUserMessage(err);
      setOptimizeError(errorMessage);
      ErrorHandler.logError(err, '优化描述');
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * 获取节点推荐
   */
  const handleGetRecommendations = async () => {
    const targetDescription = optimizedDescription || description;
    if (!targetDescription.trim()) {
      setRecommendError('请先输入工作流描述');
      return;
    }

    setIsGettingRecommendations(true);
    setRecommendError(null);
    setError('');

    try {
      const request: NodeRecommendationRequest = {
        description: targetDescription.trim(),
        context: context.trim() || undefined,
        requirements: requirements.filter(req => req.trim()).length > 0 
          ? requirements.filter(req => req.trim()) 
          : undefined,
        complexity,
        limit: 10
      };

      const recommendations = await getNodeRecommendations(request);
      setNodeRecommendations(recommendations);
    } catch (err) {
      console.error('获取节点推荐失败:', err);
      const errorMessage = ErrorHandler.getUserMessage(err);
      setRecommendError(errorMessage);
      ErrorHandler.logError(err, '获取节点推荐');
    } finally {
      setIsGettingRecommendations(false);
    }
  };

  /**
   * 生成工作流提示
   */
  const handleGeneratePrompt = useCallback(async () => {
    const targetDescription = optimizedDescription || description;
    if (!targetDescription.trim()) {
      return;
    }

    setIsGeneratingPrompt(true);
    setError('');

    try {
      const request: PromptOptimizationRequest = {
        description: targetDescription.trim(),
        context: context.trim() || undefined,
        requirements: requirements.filter(req => req.trim()).length > 0 
          ? requirements.filter(req => req.trim()) 
          : undefined,
        complexity
      };

      const prompt = await generateWorkflowPrompt(request);
      setGeneratedPrompt(prompt);
    } catch (err) {
      console.error('生成提示失败:', err);
      const errorMessage = ErrorHandler.getUserMessage(err);
      setError(errorMessage);
      ErrorHandler.logError(err, '生成工作流提示');
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [optimizedDescription, description, context, requirements, complexity]);

  /**
   * 处理节点选择
   */
  const handleNodeSelect = (nodeType: string) => {
    setSelectedNodes(prev => {
      if (prev.includes(nodeType)) {
        return prev.filter(node => node !== nodeType);
      } else {
        return [...prev, nodeType];
      }
    });
  };

  /**
   * 处理工作流建议应用
   */
  const handleWorkflowSuggestionApply = (suggestion: WorkflowSuggestion) => {
    if (suggestion.description) {
      setDescription(suggestion.description);
    }
    if (suggestion.requirements) {
      setRequirements(suggestion.requirements);
    }
    if (suggestion.complexity) {
      setComplexity(suggestion.complexity);
    }
  };

  /**
   * 生成增强工作流
   */
  const handleGenerateWorkflow = async () => {
    const targetDescription = optimizedDescription || description;
    if (!targetDescription.trim()) {
      setError('请输入工作流描述');
      return;
    }

    if (targetDescription.trim().length < 10) {
      setError('工作流描述过于简短，请至少输入 10 个字符的详细描述');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const request: EnhancedGenerateRequest = {
        description: targetDescription.trim(),
        context: context.trim() || undefined,
        requirements: requirements.filter(req => req.trim()).length > 0 
          ? requirements.filter(req => req.trim()) 
          : undefined,
        complexity,
        useEnhancedPrompt,
        preferredNodes: selectedNodes.length > 0 ? selectedNodes : undefined
      };

      const data = await generateEnhancedWorkflow(request);
      
      // 导航到工作流编辑器页面，传递生成的工作流数据
      navigate('/editor', { 
        state: { 
          workflow: data.workflow,
          isNewWorkflow: true,
          generationMeta: data.meta
        } 
      });
      
    } catch (err) {
      console.error('工作流生成失败:', err);
      const errorMessage = ErrorHandler.getUserMessage(err);
      setError(errorMessage);
      ErrorHandler.logError(err, '生成增强工作流');
    } finally {
      setIsGenerating(false);
    }
  };

  // 自动生成提示
  useEffect(() => {
    if (useEnhancedPrompt && (optimizedDescription || description)) {
      const timer = setTimeout(() => {
        handleGeneratePrompt();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [optimizedDescription, description, useEnhancedPrompt, handleGeneratePrompt]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Zap className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">增强工作流生成器</h1>
            </div>
            <nav className="flex space-x-6">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                基础生成器
              </button>
              <button
                onClick={() => navigate('/templates')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                模板库
              </button>
              <button
                onClick={() => navigate('/editor')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                编辑器
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            AI增强工作流生成
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            使用提示工程和智能节点推荐，生成更精确、更复杂的n8n工作流
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：输入区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基础描述 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-purple-600" />
                工作流描述
              </h3>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (error && e.target.value.trim()) {
                    setError(''); // 清除错误状态
                  }
                }}
                placeholder="详细描述你想要实现的自动化流程..."
                className={`w-full h-32 px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent resize-none text-gray-900 placeholder-gray-500 ${
                  error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'
                }`}
                disabled={isGenerating}
              />
              
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handleOptimizeDescription}
                  disabled={isOptimizing || !description.trim()}
                  className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-400 disabled:to-gray-400 text-white disabled:text-gray-300 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {isOptimizing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Lightbulb className="h-4 w-4" />
                  )}
                  <span>智能优化描述</span>
                </button>
                
                <button
                  onClick={handleGetRecommendations}
                  disabled={isGettingRecommendations || !(optimizedDescription || description).trim()}
                  className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white disabled:text-gray-300 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {isGettingRecommendations ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  <span>获取智能推荐</span>
                </button>
              </div>

              {optimizeError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{optimizeError}</p>
                </div>
              )}

              {optimizedDescription && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    优化后的描述
                  </h4>
                  <p className="text-green-700 text-sm">{optimizedDescription}</p>
                </div>
              )}
            </div>

            {/* 高级选项 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-purple-600" />
                  高级选项
                </h3>
                <ArrowRight className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  showAdvancedOptions ? 'rotate-90' : ''
                }`} />
              </button>

              {showAdvancedOptions && (
                <div className="mt-6 space-y-6">
                  {/* 上下文 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      业务上下文（可选）
                    </label>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="描述业务背景、使用场景等..."
                      className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                      disabled={isGenerating}
                    />
                  </div>

                  {/* 需求列表 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      具体需求
                    </label>
                    {requirements.map((req, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={req}
                          onChange={(e) => updateRequirement(index, e.target.value)}
                          placeholder={`需求 ${index + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                          disabled={isGenerating}
                        />
                        {requirements.length > 1 && (
                          <button
                            onClick={() => removeRequirement(index)}
                            className="p-2 text-red-500 hover:text-red-700"
                            disabled={isGenerating}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addRequirement}
                      className="text-sm text-purple-600 hover:text-purple-800"
                      disabled={isGenerating}
                    >
                      + 添加需求
                    </button>
                  </div>

                  {/* 复杂度 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      工作流复杂度
                    </label>
                    <div className="flex space-x-4">
                      {(['simple', 'medium', 'complex'] as const).map((level) => (
                        <label key={level} className="flex items-center">
                          <input
                            type="radio"
                            value={level}
                            checked={complexity === level}
                            onChange={(e) => setComplexity(e.target.value as typeof complexity)}
                            className="mr-2"
                            disabled={isGenerating}
                          />
                          <span className="text-sm text-gray-700">
                            {level === 'simple' ? '简单' : level === 'medium' ? '中等' : '复杂'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 增强提示选项 */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={useEnhancedPrompt}
                        onChange={(e) => setUseEnhancedPrompt(e.target.checked)}
                        className="mr-2"
                        disabled={isGenerating}
                      />
                      <span className="text-sm text-gray-700">使用增强提示工程</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 智能推荐组件 */}
            {showRecommendations && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">智能推荐</h3>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <IntelligentRecommendations
                  description={description}
                  context={context}
                  requirements={requirements}
                  complexity={complexity}
                  selectedNodes={selectedNodes}
                  onNodeSelect={handleNodeSelect}
                  onWorkflowSuggestionApply={handleWorkflowSuggestionApply}
                />
              </div>
            )}

            {/* 显示/隐藏推荐按钮 */}
            {!showRecommendations && (
              <div className="text-center">
                <button
                  onClick={() => setShowRecommendations(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto"
                >
                  <Lightbulb className="h-4 w-4" />
                  显示智能推荐
                </button>
              </div>
            )}

            {/* 生成按钮 */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-purple-100">
              {/* 错误提示 */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-red-700">
                    <p className="font-medium">操作失败</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">🚀 AI智能工作流生成器</h3>
                <p className="text-sm text-gray-600">基于您的描述和需求，AI将为您构建完整的n8n工作流</p>
              </div>

              <button
                onClick={handleGenerateWorkflow}
                disabled={isGenerating || !(optimizedDescription || description).trim()}
                className="w-full bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-700 hover:via-purple-800 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span className="text-lg">AI正在构建您的工作流...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-6 w-6" />
                    <span className="text-lg">开始生成智能工作流</span>
                    <ArrowRight className="h-6 w-6" />
                  </>
                )}
              </button>
              
              {!isGenerating && !(optimizedDescription || description).trim() && (
                <p className="text-center text-sm text-gray-500 mt-3">
                  请先输入工作流描述
                </p>
              )}
            </div>
          </div>

          {/* 右侧：推荐和预览区域 */}
          <div className="space-y-6">
            {/* 节点推荐 */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Layers className="h-5 w-5 mr-2 text-blue-600" />
                🎯 智能节点推荐
              </h3>
              
              {recommendError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{recommendError}</p>
                </div>
              )}

              {nodeRecommendations.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 mb-3">
                    基于您的需求，AI推荐以下 {nodeRecommendations.length} 个节点：
                  </div>
                  {nodeRecommendations.map((node, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900 text-base">{node.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 rounded-full font-medium">
                            匹配度 {(node.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 leading-relaxed">{node.description}</p>
                      {node.category && (
                        <div className="flex items-center">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            📂 {node.category}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Target className="h-10 w-10 text-gray-300" />
                  </div>
                  <p className="text-base font-medium text-gray-600 mb-2">等待节点推荐</p>
                  <p className="text-sm text-gray-500">点击上方"获取智能推荐"按钮，AI将为您推荐最适合的n8n节点</p>
                </div>
              )}
            </div>

            {/* 生成的提示预览 */}
            {generatedPrompt && (
              <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-green-600" />
                  ✨ AI生成的工作流提示
                </h3>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    AI已为您生成优化的工作流构建提示，包含详细的节点配置和连接逻辑
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 max-h-80 overflow-y-auto border border-green-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium">
                      📝 智能提示内容
                    </span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md transition-colors duration-200 flex items-center space-x-1"
                    >
                      <span>📋</span>
                      <span>复制</span>
                    </button>
                  </div>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono">{generatedPrompt}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EnhancedGenerator;
