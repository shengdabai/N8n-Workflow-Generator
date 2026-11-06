import express from 'express'
import { vectorSearchService, SearchOptions } from '../services/vectorSearchService'

const router = express.Router()

/**
 * 搜索相关节点
 * POST /api/vector-search/nodes
 */
router.post('/nodes', async (req, res) => {
  try {
    const { query, options = {} } = req.body

    // 验证请求参数
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: '查询文本不能为空'
      })
    }

    if (query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '查询文本至少需要2个字符'
      })
    }

    // 验证搜索选项
    const searchOptions: SearchOptions = {
      limit: options.limit && Number.isInteger(options.limit) && options.limit > 0 
        ? Math.min(options.limit, 50) // 最多返回50个结果
        : 10,
      threshold: options.threshold && typeof options.threshold === 'number' 
        ? Math.max(0, Math.min(options.threshold, 1)) // 阈值范围0-1
        : 0.7,
      category: options.category && typeof options.category === 'string' 
        ? options.category.trim() 
        : undefined
    }

    console.log(`接收到节点搜索请求: "${query}", 选项:`, searchOptions)

    // 执行向量检索
    const results = await vectorSearchService.searchNodes(query, searchOptions)

    res.json({
      success: true,
      data: {
        query,
        results,
        total: results.length,
        options: searchOptions
      }
    })

  } catch (error) {
    console.error('节点搜索API错误:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '节点搜索失败'
    })
  }
})

/**
 * 获取节点推荐
 * POST /api/vector-search/recommendations
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { description, workflowContext = '', existingNodes = [] } = req.body

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: '工作流描述不能为空'
      })
    }

    // 构建增强的查询文本
    let enhancedQuery = description
    
    if (workflowContext) {
      enhancedQuery += ` 上下文: ${workflowContext}`
    }

    if (existingNodes.length > 0) {
      enhancedQuery += ` 已有节点: ${existingNodes.join(', ')}`
    }

    console.log(`接收到节点推荐请求: "${description}"`)

    // 搜索推荐节点
    const recommendations = await vectorSearchService.searchNodes(enhancedQuery, {
      limit: 15,
      threshold: 0.6
    })

    // 过滤已存在的节点
    const filteredRecommendations = recommendations.filter(
      rec => !existingNodes.includes(rec.nodeType)
    )

    // 按类别分组推荐
    const groupedRecommendations = filteredRecommendations.reduce((groups, node) => {
      const category = node.category || 'Other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(node)
      return groups
    }, {} as Record<string, typeof recommendations>)

    res.json({
      success: true,
      data: {
        description,
        recommendations: filteredRecommendations.slice(0, 10), // 返回前10个推荐
        groupedRecommendations,
        total: filteredRecommendations.length
      }
    })

  } catch (error) {
    console.error('节点推荐API错误:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '节点推荐失败'
    })
  }
})

/**
 * 获取相似节点
 * POST /api/vector-search/similar
 */
router.post('/similar', async (req, res) => {
  try {
    const { nodeType, context = '', limit = 5 } = req.body

    if (!nodeType || typeof nodeType !== 'string') {
      return res.status(400).json({
        success: false,
        error: '节点类型不能为空'
      })
    }

    // 构建查询文本
    const query = context 
      ? `${nodeType} ${context}`
      : `类似于 ${nodeType} 的节点`

    console.log(`接收到相似节点搜索请求: "${nodeType}"`)

    // 搜索相似节点
    const similarNodes = await vectorSearchService.searchNodes(query, {
      limit: Math.min(limit, 20),
      threshold: 0.5
    })

    // 过滤掉查询的节点本身
    const filteredNodes = similarNodes.filter(
      node => node.nodeType !== nodeType
    )

    res.json({
      success: true,
      data: {
        nodeType,
        similarNodes: filteredNodes,
        total: filteredNodes.length
      }
    })

  } catch (error) {
    console.error('相似节点搜索API错误:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '相似节点搜索失败'
    })
  }
})

/**
 * 获取索引统计信息
 * GET /api/vector-search/stats
 */
router.get('/stats', async (_req, res) => {
  try {
    console.log('获取向量索引统计信息')
    
    const stats = await vectorSearchService.getIndexStats()
    
    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('获取索引统计API错误:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取索引统计失败'
    })
  }
})

/**
 * 清理缓存
 * POST /api/vector-search/clear-cache
 */
router.post('/clear-cache', async (_req, res) => {
  try {
    console.log('清理向量搜索缓存')
    
    vectorSearchService.clearExpiredCache()
    
    res.json({
      success: true,
      message: '缓存清理完成'
    })

  } catch (error) {
    console.error('清理缓存API错误:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '缓存清理失败'
    })
  }
})

/**
 * 健康检查
 * GET /api/vector-search/health
 */
router.get('/health', async (_req, res) => {
  try {
    // 执行简单的搜索测试
    const testResults = await vectorSearchService.searchNodes('test', {
      limit: 1,
      threshold: 0.1
    })

    res.json({
      success: true,
      message: '向量搜索服务正常',
      data: {
        timestamp: new Date().toISOString(),
        testResultsCount: testResults.length
      }
    })

  } catch (error) {
    console.error('向量搜索健康检查失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '向量搜索服务异常'
    })
  }
})

export default router