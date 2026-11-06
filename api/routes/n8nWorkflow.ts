import express from 'express';
import path from 'node:path';
import { safeWorkflowPath } from '../utils/safeWorkflowPath';
import { n8nWorkflowService } from '../services/n8nWorkflowService';
import { aiModelService } from '../services/aiModelService';
import { WorkflowValidationService } from '../services/workflowValidationService';

const router = express.Router();
const validationService = new WorkflowValidationService();

/**
 * 生成n8n工作流 - 单个模型
 * POST /api/n8n-workflow/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { description, model = 'openai' } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: '请提供工作流描述'
      });
    }

    if (!['openai', 'gemini', 'grok'].includes(model)) {
      return res.status(400).json({
        success: false,
        error: '不支持的AI模型，请选择: openai, gemini, grok'
      });
    }

    console.log(`使用${model}模型生成工作流:`, description);

    const result = await n8nWorkflowService.generateWorkflowWithModel(
      description, 
      model as 'openai' | 'gemini' | 'grok'
    );

    // 验证工作流兼容性
    const validationResult = await validationService.validateWorkflow(result.workflow);
    
    // 如果验证失败，返回错误信息
    if (!validationResult.isValid) {
      console.warn('工作流验证失败:', validationResult.errors);
      return res.status(400).json({
        success: false,
        error: '生成的工作流不符合n8n标准',
        validationErrors: validationResult.errors,
        warnings: validationResult.warnings
      });
    }

    // 保存生成的工作流
    const savedPath = await n8nWorkflowService.saveWorkflow(
      result.workflow,
      `${model}_workflow_${Date.now()}.json`
    );

    // 计算额外的指标
    const nodeCount = result.workflow.nodes?.length || 0;
    const complexity = n8nWorkflowService.calculateComplexity(result.workflow);
    const completeness = n8nWorkflowService.calculateCompleteness(result.workflow);

    res.json({
      success: true,
      data: {
        ...result,
        nodeCount,
        complexity,
        completeness,
        savedPath,
        validation: {
          score: validationResult.score,
          warnings: validationResult.warnings,
          recommendations: validationResult.recommendations
        }
      }
    });

  } catch (error) {
    console.error('生成工作流失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成工作流失败'
    });
  }
});

/**
 * 生成n8n工作流 - 多模型对比
 * POST /api/n8n-workflow/generate-compare
 */
router.post('/generate-compare', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: '请提供工作流描述'
      });
    }

    console.log('使用多模型对比生成工作流:', description);

    const result = await n8nWorkflowService.generateWorkflowWithAllModels(description);

    // 验证最佳工作流兼容性
    const bestValidationResult = await validationService.validateWorkflow(result.bestResult.workflow);
    
    // 如果最佳工作流验证失败，尝试从其他结果中选择
    let finalBestResult = result.bestResult;
    let finalValidationResult = bestValidationResult;
    
    if (!bestValidationResult.isValid) {
      console.warn('最佳工作流验证失败，尝试选择其他有效工作流');
      
      // 验证所有结果，选择验证通过且得分最高的
      for (const r of result.results) {
        const validation = await validationService.validateWorkflow(r.workflow);
        if (validation.isValid && validation.score > finalValidationResult.score) {
          finalBestResult = r;
          finalValidationResult = validation;
        }
      }
      
      // 如果仍然没有有效的工作流，返回错误
      if (!finalValidationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: '所有生成的工作流都不符合n8n标准',
          validationErrors: finalValidationResult.errors
        });
      }
    }

    // 保存最佳工作流
    const savedPath = await n8nWorkflowService.saveWorkflow(
      finalBestResult.workflow,
      `best_workflow_${Date.now()}.json`
    );

    // 保存所有结果并计算指标
    const allResultsPaths = await Promise.all(
      result.results.map(async (r, index) => {
        const path = await n8nWorkflowService.saveWorkflow(
          r.workflow,
          `${r.model.toLowerCase().replace(/\s+/g, '_')}_workflow_${Date.now()}_${index}.json`
        );
        return { model: r.model, path };
      })
    );

    // 为每个结果添加计算指标
    const resultsWithMetrics = result.results.map(r => ({
      ...r,
      nodeCount: r.workflow.nodes?.length || 0,
      complexity: n8nWorkflowService.calculateComplexity(r.workflow),
      completeness: n8nWorkflowService.calculateCompleteness(r.workflow)
    }));

    // 为最佳结果添加计算指标
    const bestResultWithMetrics = {
      ...finalBestResult,
      nodeCount: finalBestResult.workflow.nodes?.length || 0,
      complexity: n8nWorkflowService.calculateComplexity(finalBestResult.workflow),
      completeness: n8nWorkflowService.calculateCompleteness(finalBestResult.workflow),
      validation: {
        score: finalValidationResult.score,
        warnings: finalValidationResult.warnings,
        recommendations: finalValidationResult.recommendations
      }
    };

    res.json({
      success: true,
      data: {
        ...result,
        results: resultsWithMetrics,
        bestResult: bestResultWithMetrics,
        bestWorkflowPath: savedPath,
        allResultsPaths
      }
    });

  } catch (error) {
    console.error('多模型对比生成工作流失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '多模型对比生成工作流失败'
    });
  }
});

/**
 * 下载工作流文件
 * GET /api/n8n-workflow/download/:filename
 */
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const fullPath = await safeWorkflowPath(path.join(process.cwd(), 'data/generated_workflows'), filename);
    if (!fullPath) {
      return res.status(404).json({ success: false, error: '工作流文件不存在' });
    }
    res.type('application/json');
    res.download(fullPath, filename);

  } catch (error) {
    console.error('下载工作流失败:', error);
    res.status(500).json({
      success: false,
      error: '下载工作流失败'
    });
  }
});

/**
 * 获取工作流列表
 * GET /api/n8n-workflow/list
 */
router.get('/list', async (_req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const workflowsDir = path.join(process.cwd(), 'data/generated_workflows');

    // 确保目录存在
    try {
      await fs.mkdir(workflowsDir, { recursive: true });
    } catch {
      // Directory already exists or will fail on the subsequent read.
    }

    const files = await fs.readdir(workflowsDir);
    const workflows = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(workflowsDir, file);
        const stats = await fs.stat(filePath);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const workflow = JSON.parse(content);
          
          workflows.push({
            filename: file,
            name: workflow.name || file,
            nodeCount: workflow.nodes?.length || 0,
            createdAt: stats.birthtime,
            size: stats.size
          });
        } catch (error) {
          console.error(`解析工作流文件失败 ${file}:`, error);
        }
      }
    }

    // 按创建时间倒序排列
    workflows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: workflows
    });

  } catch (error) {
    console.error('获取工作流列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取工作流列表失败'
    });
  }
});

/**
 * 测试AI模型连接
 * GET /api/n8n-workflow/test-models
 */
router.get('/test-models', async (_req, res) => {
  try {
    const testPrompt = '请简单回复"连接成功"';
    const results = [];

    // 测试OpenAI
    try {
      const openaiResult = await aiModelService.generateWithOpenAI(testPrompt);
      results.push({ model: 'OpenAI', status: 'success', response: openaiResult.content });
    } catch (error) {
      results.push({ model: 'OpenAI', status: 'error', error: error instanceof Error ? error.message : '未知错误' });
    }

    // 测试Gemini
    try {
      const geminiResult = await aiModelService.generateWithGemini(testPrompt);
      results.push({ model: 'Gemini', status: 'success', response: geminiResult.content });
    } catch (error) {
      results.push({ model: 'Gemini', status: 'error', error: error instanceof Error ? error.message : '未知错误' });
    }

    // 测试Grok
    try {
      const grokResult = await aiModelService.generateWithGrok(testPrompt);
      results.push({ model: 'Grok', status: 'success', response: grokResult.content });
    } catch (error) {
      results.push({ model: 'Grok', status: 'error', error: error instanceof Error ? error.message : '未知错误' });
    }

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('测试AI模型失败:', error);
    res.status(500).json({
      success: false,
      error: '测试AI模型失败'
    });
  }
});

/**
 * 获取工作流详情
 * GET /api/n8n-workflow/:filename
 */
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'data/generated_workflows', filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const workflow = JSON.parse(content);
      
      res.json({
        success: true,
        data: workflow
      });
    } catch {
      res.status(404).json({
        success: false,
        error: '工作流文件不存在或格式错误'
      });
    }

  } catch (error) {
    console.error('获取工作流详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取工作流详情失败'
    });
  }
});

export default router;