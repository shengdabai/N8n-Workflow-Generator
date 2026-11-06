import express from 'express'
import { ApiResponse } from '@/shared/types'
import { N8nWorkflow } from '@/shared/types'
import yaml from 'js-yaml'
import { normalizeConnections } from '../../shared/workflowConnections'

const router = express.Router()

/**
 * 生成安全文件名
 * @param name 原始工作流名称
 * @param ext 扩展名（.json 或 .yaml）
 * @returns 规范化后的文件名
 */
function buildSafeFilename(name: string | undefined, ext: '.json' | '.yaml'): string {
  const base = (name || 'workflow')
    .trim()
    .replace(/[\s]+/g, '-') // 空白转短横线
    .replace(/[^a-zA-Z0-9-_]/g, '') // 仅保留字母数字和 - _
    .slice(0, 100) || 'workflow'
  return `${base}${ext}`
}

/**
 * 导出工作流为n8n兼容格式
 * @route POST /api/workflow/export
 * @body {object} workflow - 工作流数据
 * @body {string} format - 导出格式 (json|yaml)
 * @returns {ApiResponse} 导出的工作流文件内容与元数据
 */
router.post('/export', async (req, res) => {
  try {
    const { workflow, format = 'json' } = (req.body || {}) as { workflow?: N8nWorkflow; format?: 'json' | 'yaml' }

    if (!workflow) {
      return res.status(400).json({
        success: false,
        error: '缺少工作流数据',
        data: null
      } as ApiResponse<null>)
    }

    // 验证工作流格式
    if (typeof workflow.name !== 'string' || !workflow.name.trim() ||
        !Array.isArray(workflow.nodes) || workflow.nodes.length === 0 ||
        !['json', 'yaml'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: '工作流数据格式不正确',
        data: null
      } as ApiResponse<null>)
    }

    let connections: N8nWorkflow['connections']
    try {
      connections = normalizeConnections(workflow.nodes, workflow.connections ?? {}, 'name')
    } catch (error) {
      return res.status(400).json({ success: false, error: (error as Error).message, data: null })
    }

    // 准备导出的工作流数据
    const exportWorkflow: N8nWorkflow = {
      name: workflow.name,
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion || 1,
        position: node.position,
        parameters: node.parameters || {},
        disabled: node.disabled,
        continueOnFail: node.continueOnFail,
        alwaysOutputData: node.alwaysOutputData,
        executeOnce: node.executeOnce,
        retryOnFail: node.retryOnFail,
        maxTries: node.maxTries,
        waitBetweenTries: node.waitBetweenTries,
        onError: node.onError
      })),
      connections,
      active: false,
      settings: workflow.settings || {},
      staticData: workflow.staticData || {},
      meta: {
        ...workflow.meta,
        exportedAt: new Date().toISOString(),
        exportedBy: 'n8n-workflow-generator',
        version: '1.0.0'
      }
    }

    let content: string
    let contentType: string
    let filename: string

    if (format === 'yaml') {
      // 使用 js-yaml 将 JSON 转换为 YAML
      content = yaml.dump(exportWorkflow, { noRefs: true })
      contentType = 'application/x-yaml'
      filename = buildSafeFilename(workflow.name, '.yaml')
    } else {
      // 默认JSON格式
      content = JSON.stringify(exportWorkflow, null, 2)
      contentType = 'application/json'
      filename = buildSafeFilename(workflow.name, '.json')
    }

    console.log(`📥 导出工作流: ${workflow.name} (${format}格式)`)

    // 返回JSON响应，包含文件内容和元数据
    res.json({
      success: true,
      data: {
        content: content,
        filename: filename,
        contentType: contentType,
        size: Buffer.byteLength(content, 'utf8')
      },
        error: undefined
    } as ApiResponse<{
      content: string
      filename: string
      contentType: string
      size: number
    }>)

  } catch (error) {
    console.error('导出工作流失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
      data: null
    } as ApiResponse<null>)
  }
})

export default router
