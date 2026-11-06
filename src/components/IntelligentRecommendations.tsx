import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lightbulb, 
  Target, 
  Layers, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Settings,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { 
  getNodeRecommendations, 
  getWorkflowSuggestion,
  getNodeConfigSuggestions 
} from '../services/api';
import type { 
  NodeRecommendationRequest, 
  NodeRecommendation,
  WorkflowSuggestionRequest,
  NodeConfigRequest,
  WorkflowSuggestion
} from '../services/api';

interface IntelligentRecommendationsProps {
  description: string;
  context?: string;
  requirements?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  selectedNodes?: string[];
  onNodeSelect?: (nodeType: string) => void;
  onWorkflowSuggestionApply?: (suggestion: WorkflowSuggestion) => void;
}

/**
 * 智能推荐组件 - 提供节点推荐和工作流建议
 * @param props 组件属性
 * @returns JSX.Element
 */
const IntelligentRecommendations: React.FC<IntelligentRecommendationsProps> = ({
  description,
  context,
  requirements,
  complexity = 'medium',
  selectedNodes = [],
  onNodeSelect,
  onWorkflowSuggestionApply
}) => {
  // 状态管理
  const [nodeRecommendations, setNodeRecommendations] = useState<NodeRecommendation[]>([]);
  const [workflowSuggestion, setWorkflowSuggestion] = useState<WorkflowSuggestion | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string>('');
  const [nodeConfig, setNodeConfig] = useState<Record<string, unknown> | null>(null);
  
  // 加载状态
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  
  // 错误状态
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  /**
   * 获取节点推荐
   */
  const fetchNodeRecommendations = useCallback(async () => {
    if (!description.trim()) return;
    
    setIsLoadingNodes(true);
    setNodeError(null);
    
    try {
      const request: NodeRecommendationRequest = {
        description: description.trim(),
        context: context?.trim(),
        requirements: requirements?.filter(req => req.trim()),
        complexity,
        limit: 8,
        existingNodes: selectedNodes
      };
      
      const recommendations = await getNodeRecommendations(request);
      setNodeRecommendations(recommendations);
    } catch (error) {
      console.error('获取节点推荐失败:', error);
      setNodeError(error instanceof Error ? error.message : '获取节点推荐失败');
    } finally {
      setIsLoadingNodes(false);
    }
  }, [description, context, requirements, complexity, selectedNodes]);

  /**
   * 获取工作流建议
   */
  const fetchWorkflowSuggestion = useCallback(async () => {
    if (!description.trim()) return;
    
    setIsLoadingSuggestion(true);
    setSuggestionError(null);
    
    try {
      const request: WorkflowSuggestionRequest = {
        description: description.trim(),
        existingNodes: nodeRecommendations.map(node => node.nodeType)
      };
      
      const suggestion = await getWorkflowSuggestion(request);
      setWorkflowSuggestion(suggestion);
    } catch (error) {
      console.error('获取工作流建议失败:', error);
      setSuggestionError(error instanceof Error ? error.message : '获取工作流建议失败');
    } finally {
      setIsLoadingSuggestion(false);
    }
  }, [description, nodeRecommendations]);

  /**
   * 获取节点配置建议
   */
  const fetchNodeConfig = async (nodeType: string) => {
    if (!nodeType) return;
    
    setIsLoadingConfig(true);
    setConfigError(null);
    
    try {
      const request: NodeConfigRequest = {
        nodeType,
        context: `${description} ${context || ''}`.trim()
      };
      
      const config = await getNodeConfigSuggestions(request);
      setNodeConfig(config);
    } catch (error) {
      console.error('获取节点配置失败:', error);
      setConfigError(error instanceof Error ? error.message : '获取节点配置失败');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  /**
   * 处理节点选择
   */
  const handleNodeSelect = (nodeType: string) => {
    setSelectedNodeType(nodeType);
    fetchNodeConfig(nodeType);
    onNodeSelect?.(nodeType);
  };

  /**
   * 应用工作流建议
   */
  const handleApplySuggestion = () => {
    if (workflowSuggestion && onWorkflowSuggestionApply) {
      onWorkflowSuggestionApply(workflowSuggestion);
    }
  };

  // 自动获取推荐
  useEffect(() => {
    if (description.trim().length >= 10) {
      const timer = setTimeout(() => {
        fetchNodeRecommendations();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [description, fetchNodeRecommendations]);

  // 当有节点推荐时，自动获取工作流建议
  useEffect(() => {
    if (nodeRecommendations.length > 0) {
      const timer = setTimeout(() => {
        fetchWorkflowSuggestion();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodeRecommendations, fetchWorkflowSuggestion]);

  return (
    <div className="space-y-6">
      {/* 节点推荐区域 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Target className="h-5 w-5 mr-2 text-blue-600" />
            智能节点推荐
          </h3>
          <button
            onClick={fetchNodeRecommendations}
            disabled={isLoadingNodes || !description.trim()}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingNodes ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
        </div>
        
        {isLoadingNodes && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">正在分析推荐节点...</span>
          </div>
        )}
        
        {nodeError && (
          <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{nodeError}</span>
          </div>
        )}
        
        {!isLoadingNodes && !nodeError && nodeRecommendations.length === 0 && description.trim() && (
          <div className="text-center py-8 text-gray-500">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>暂无推荐节点，请尝试更详细的描述</p>
          </div>
        )}
        
        {nodeRecommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nodeRecommendations.map((node, index) => (
              <div
                key={index}
                onClick={() => handleNodeSelect(node.nodeType)}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedNodeType === node.nodeType
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{node.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{node.description}</p>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {node.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        置信度: {Math.round(node.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  {selectedNodeType === node.nodeType && (
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 节点配置建议 */}
      {selectedNodeType && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-green-600" />
            节点配置建议
          </h3>
          
          {isLoadingConfig && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-600">正在生成配置建议...</span>
            </div>
          )}
          
          {configError && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-700">{configError}</span>
            </div>
          )}
          
          {nodeConfig && !isLoadingConfig && (
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {JSON.stringify(nodeConfig, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 工作流建议 */}
      {workflowSuggestion && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Layers className="h-5 w-5 mr-2 text-purple-600" />
              工作流建议
            </h3>
            <button
              onClick={handleApplySuggestion}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Zap className="h-4 w-4" />
              <span>应用建议</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          {isLoadingSuggestion && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">正在生成工作流建议...</span>
            </div>
          )}
          
          {suggestionError && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-700">{suggestionError}</span>
            </div>
          )}
          
          {!isLoadingSuggestion && !suggestionError && (
            <div className="space-y-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">建议的工作流结构:</h4>
                <p className="text-purple-800">{workflowSuggestion.description || '智能生成的工作流结构'}</p>
              </div>
              
              {workflowSuggestion.steps && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">执行步骤:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    {workflowSuggestion.steps.map((step: string, index: number) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntelligentRecommendations;
