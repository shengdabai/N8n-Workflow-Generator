import { Router } from 'express';
import { 
  parameterInferenceService,
  type ParameterInferenceRequest
} from '../services/parameterInferenceService';
import { validateRequest } from '../middleware/validation';
import type { ValidationRules } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * 参数推理请求验证规则
 */
const parameterInferenceValidation = {
  nodeType: { required: true, type: 'string' },
  context: { required: false, type: 'string' },
  workflowDescription: { required: false, type: 'string' },
  existingNodes: { required: false, type: 'array' },
  userInput: { required: false, type: 'object' }
} satisfies ValidationRules;

/**
 * 批量参数推理请求验证规则
 */
const batchParameterInferenceValidation = {
  requests: { required: true, type: 'array' }
} satisfies ValidationRules;

/**
 * POST /api/parameters/infer
 * 推理单个节点的参数配置
 */
router.post('/infer', 
  validateRequest(parameterInferenceValidation),
  asyncHandler(async (req, res) => {
    const request: ParameterInferenceRequest = req.body;
    
    console.log('Parameter inference request:', {
      nodeType: request.nodeType,
      hasContext: !!request.context,
      hasWorkflowDescription: !!request.workflowDescription,
      existingNodesCount: request.existingNodes?.length || 0
    });
    
    const result = await parameterInferenceService.inferParameters(request);
    
    console.log('Parameter inference result:', {
      nodeType: result.nodeType,
      recommendationsCount: result.recommendations.length,
      confidence: result.metadata.confidence
    });
    
    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (req.startTime ?? Date.now())
      }
    });
  })
);

/**
 * POST /api/parameters/infer-batch
 * 批量推理多个节点的参数配置
 */
router.post('/infer-batch',
  validateRequest(batchParameterInferenceValidation),
  asyncHandler(async (req, res) => {
    const { requests } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Requests array is required and must not be empty'
      });
    }
    
    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 requests allowed per batch'
      });
    }
    
    console.log('Batch parameter inference request:', {
      requestsCount: requests.length,
      nodeTypes: requests.map((r: ParameterInferenceRequest) => r.nodeType)
    });
    
    const results = await parameterInferenceService.inferMultipleParameters(requests);
    
    console.log('Batch parameter inference results:', {
      resultsCount: results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.metadata.confidence, 0) / results.length
    });
    
    res.json({
      success: true,
      data: results,
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (req.startTime ?? Date.now()),
        batchSize: results.length
      }
    });
  })
);

/**
 * POST /api/parameters/optimize-for-workflow
 * 根据工作流上下文优化参数推荐
 */
router.post('/optimize-for-workflow',
  asyncHandler(async (req, res) => {
    const { nodeType, workflowContext } = req.body;
    
    if (!nodeType || !workflowContext) {
      return res.status(400).json({
        success: false,
        error: 'nodeType and workflowContext are required'
      });
    }
    
    console.log('Workflow-optimized parameter inference:', {
      nodeType,
      hasDescription: !!workflowContext.description,
      existingNodesCount: workflowContext.existingNodes?.length || 0,
      dataFlowCount: workflowContext.dataFlow?.length || 0
    });
    
    const result = await parameterInferenceService.optimizeParametersForWorkflow(
      nodeType,
      workflowContext
    );
    
    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - (req.startTime ?? Date.now()),
        optimizedForWorkflow: true
      }
    });
  })
);

/**
 * GET /api/parameters/supported-nodes
 * 获取支持参数推理的节点类型列表
 */
router.get('/supported-nodes', 
  asyncHandler(async (_req, res) => {
    const supportedNodes = [
      {
        type: 'n8n-nodes-base.httpRequest',
        name: 'HTTP Request',
        category: 'Regular',
        description: 'Make HTTP requests to any URL'
      },
      {
        type: 'n8n-nodes-base.webhook',
        name: 'Webhook',
        category: 'Trigger',
        description: 'Receive HTTP requests'
      },
      {
        type: 'n8n-nodes-base.code',
        name: 'Code',
        category: 'Data',
        description: 'Execute JavaScript code'
      },
      {
        type: 'n8n-nodes-base.if',
        name: 'IF',
        category: 'Logic',
        description: 'Conditional logic'
      },
      {
        type: 'n8n-nodes-base.set',
        name: 'Set',
        category: 'Data',
        description: 'Set node data'
      },
      {
        type: 'n8n-nodes-base.emailSend',
        name: 'Send Email',
        category: 'Communication',
        description: 'Send emails'
      },
      {
        type: 'n8n-nodes-base.mysql',
        name: 'MySQL',
        category: 'Database',
        description: 'MySQL database operations'
      },
      {
        type: 'n8n-nodes-base.postgres',
        name: 'PostgreSQL',
        category: 'Database',
        description: 'PostgreSQL database operations'
      },
      {
        type: 'n8n-nodes-base.googleSheets',
        name: 'Google Sheets',
        category: 'Productivity',
        description: 'Google Sheets operations'
      },
      {
        type: 'n8n-nodes-base.slack',
        name: 'Slack',
        category: 'Communication',
        description: 'Slack messaging'
      }
    ];
    
    res.json({
      success: true,
      data: supportedNodes,
      metadata: {
        timestamp: new Date().toISOString(),
        totalNodes: supportedNodes.length
      }
    });
  })
);

/**
 * GET /api/parameters/node-info/:nodeType
 * 获取特定节点类型的参数信息
 */
router.get('/node-info/:nodeType',
  asyncHandler(async (req, res) => {
    const { nodeType } = req.params;
    
    // 这里可以从n8n节点定义中获取参数信息
    // 目前返回基础信息
    const nodeInfo = {
      type: nodeType,
      parameters: [],
      description: `Information for ${nodeType}`,
      category: 'Unknown',
      version: 1
    };
    
    res.json({
      success: true,
      data: nodeInfo,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;
