import { Pinecone } from '@pinecone-database/pinecone'
import { OpenAI } from 'openai'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  limit?: number
  threshold?: number
  category?: string
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  nodeType: string
  displayName: string
  score: number
  description: string
  category: string
  operations: string[]
  suggestedParams?: Record<string, unknown>
}
interface CommonNodeConfig { scenario?: string; parameters: Record<string, unknown> }
interface NodeMetadata {
  nodeType: string
  displayName: string
  category: string
  operations?: string[]
  description?: string
  tags?: string[]
}

/**
 * 节点向量数据接口
 */
export interface NodeVectorData {
  id: string
  nodeType: string
  displayName: string
  vector: number[]
  metadata: {
    nodeType: string
    displayName: string
    category: string
    operations: string[]
    description: string
    tags: string[]
  }
}

/**
 * 向量检索服务类
 * 提供基于语义相似度的n8n节点检索功能
 */
export class VectorSearchService {
  private pinecone: Pinecone | null = null
  private openai: OpenAI | null = null
  private firestore: Firestore | null = null
  private indexName: string
  private cache: Map<string, SearchResult[]> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_TTL = 3600000 // 1小时缓存

  private requirePinecone(): Pinecone {
    if (!this.pinecone) {
      throw new Error('PINECONE_API_KEY环境变量未设置')
    }
    return this.pinecone
  }

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'n8n-nodes'
  }

  /**
   * 初始化Pinecone客户端
   */
  private initializePinecone(): void {
    const apiKey = process.env.PINECONE_API_KEY
    const environment = process.env.PINECONE_ENVIRONMENT

    if (!apiKey || apiKey === 'your-pinecone-api-key-here') {
      console.warn('⚠️  PINECONE_API_KEY未配置，向量搜索功能将不可用')
      this.pinecone = null
      return
    }

    if (!environment || environment === 'your-pinecone-environment-here') {
      console.warn('⚠️  PINECONE_ENVIRONMENT未配置，向量搜索功能将不可用')
      this.pinecone = null
      return
    }

    try {
      this.pinecone = new Pinecone({
        apiKey: apiKey
      })

      console.log(`✅ Pinecone初始化成功，使用索引: ${this.indexName}`)
    } catch (error) {
      console.error('❌ Pinecone初始化失败:', error)
      this.pinecone = null
    }
  }

  /**
   * 初始化OpenAI客户端
   */
  private initializeOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('⚠️  OPENAI_API_KEY未配置，向量搜索功能将不可用')
      this.openai = null
      return
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    })
  }

  /**
   * 初始化Firestore客户端
   */
  private initializeFirestore(): void {
    const projectId = process.env.FIRESTORE_PROJECT_ID
    const privateKey = process.env.FIRESTORE_PRIVATE_KEY
    const clientEmail = process.env.FIRESTORE_CLIENT_EMAIL

    if (!projectId || projectId === 'your-firestore-project-id' ||
        !privateKey || privateKey === 'your-firestore-private-key' ||
        !clientEmail || clientEmail === 'your-firestore-client-email') {
      console.warn('⚠️  Firestore环境变量未完整配置，参数建议功能将不可用')
      this.firestore = null
      return
    }

    try {
      // 初始化Firebase Admin SDK
      const app = getApps().find(candidate => candidate.name === '[DEFAULT]') ?? initializeApp({
          credential: cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail
          })
        })

      this.firestore = getFirestore(app)
      console.log('✅ Firestore初始化成功')
    } catch (error) {
      console.error('❌ Firestore初始化失败:', error)
      this.firestore = null
    }
  }

  /**
   * 生成文本的向量表示
   * @param text 要向量化的文本
   * @returns 向量数组
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.openai) this.initializeOpenAI()
      if (!this.openai) {
        throw new Error('OPENAI_API_KEY环境变量未设置')
      }
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('生成向量失败:', error)
      throw new Error('向量生成失败')
    }
  }

  /**
   * 检查缓存是否有效
   * @param cacheKey 缓存键
   * @returns 是否有效
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey)
    return expiry ? Date.now() < expiry : false
  }

  /**
   * 设置缓存
   * @param cacheKey 缓存键
   * @param results 搜索结果
   */
  private setCache(cacheKey: string, results: SearchResult[]): void {
    this.cache.set(cacheKey, results)
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
  }

  /**
   * 搜索相关节点
   * @param query 查询文本
   * @param options 搜索选项
   * @returns 搜索结果数组
   */
  async searchNodes(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.7, category } = options
    const cacheKey = `${query}:${JSON.stringify(options)}`

    // 检查缓存
    if (this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        console.log('从缓存返回搜索结果')
        return cached
      }
    }

    try {
      if (!this.pinecone) this.initializePinecone()
      // 检查Pinecone是否可用
      if (!this.pinecone) {
        console.warn('Pinecone未配置，返回空结果')
        return []
      }

      // 生成查询向量
      const queryVector = await this.getEmbedding(query)

      // 构建过滤条件
      const filter = category ? { category } : undefined

      // 执行向量检索
      const index = this.requirePinecone().index(this.indexName)
      const queryResponse = await index.query({
        vector: queryVector,
        topK: limit * 2, // 获取更多结果以便过滤
        filter,
        includeMetadata: true,
        includeValues: false
      })

      // 处理搜索结果
      const results: SearchResult[] = []
      
      for (const match of queryResponse.matches || []) {
        if (match.score && match.score >= threshold && match.metadata) {
          const metadata = match.metadata as unknown as NodeMetadata
          
          // 获取节点参数建议
          const suggestedParams = await this.getSuggestedParameters(
            metadata.nodeType,
            query
          )

          results.push({
            nodeType: metadata.nodeType,
            displayName: metadata.displayName,
            score: match.score,
            description: metadata.description || '',
            category: metadata.category,
            operations: metadata.operations || [],
            suggestedParams
          })
        }
      }

      // 限制结果数量
      const finalResults = results.slice(0, limit)

      // 缓存结果
      this.setCache(cacheKey, finalResults)

      console.log(`向量检索完成，返回${finalResults.length}个结果`)
      return finalResults

    } catch (error) {
      console.error('向量检索失败:', error)
      return [] // 返回空数组而不是抛出错误
    }
  }

  /**
   * 获取节点参数建议
   * @param nodeType 节点类型
   * @param context 上下文描述
   * @returns 参数建议
   */
  private async getSuggestedParameters(
    nodeType: string,
    context: string
  ): Promise<Record<string, unknown> | undefined> {
    try {
      if (!this.firestore) this.initializeFirestore()
      if (!this.firestore) {
        console.warn('Firestore未配置，返回空建议')
        return undefined
      }

      // 从Firestore获取节点参数配置
      const nodeDoc = await this.firestore
        .collection('nodeParameters')
        .doc(nodeType)
        .get()

      if (!nodeDoc.exists) {
        return undefined
      }

      const nodeData = nodeDoc.data()
      if (!nodeData || !nodeData.commonConfigs) {
        return undefined
      }

      // 基于上下文匹配最佳配置
      const commonConfigs = nodeData.commonConfigs as CommonNodeConfig[]
      const contextLower = context.toLowerCase()

      for (const config of commonConfigs) {
        const scenario = config.scenario?.toLowerCase() || ''
        if (contextLower.includes(scenario) || scenario.includes(contextLower)) {
          return config.parameters
        }
      }

      // 返回第一个通用配置
      return commonConfigs[0]?.parameters

    } catch (error) {
      console.error('获取参数建议失败:', error)
      return undefined
    }
  }

  /**
   * 向Pinecone索引添加节点向量数据
   * @param nodeData 节点向量数据
   */
  async upsertNodeVector(nodeData: NodeVectorData): Promise<void> {
    try {
      const index = this.requirePinecone().index(this.indexName)
      
      await index.upsert([
        {
          id: nodeData.id,
          values: nodeData.vector,
          metadata: nodeData.metadata
        }
      ])

      console.log(`节点向量已更新: ${nodeData.nodeType}`)
    } catch (error) {
      console.error('更新节点向量失败:', error)
      throw new Error('节点向量更新失败')
    }
  }

  /**
   * 批量向Pinecone索引添加节点向量数据
   * @param nodeDataList 节点向量数据数组
   */
  async batchUpsertNodeVectors(nodeDataList: NodeVectorData[]): Promise<void> {
    try {
      const index = this.requirePinecone().index(this.indexName)
      
      const vectors = nodeDataList.map(nodeData => ({
        id: nodeData.id,
        values: nodeData.vector,
        metadata: nodeData.metadata
      }))

      // 分批处理，每批最多100个向量
      const batchSize = 100
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        await index.upsert(batch)
        console.log(`已处理第${Math.floor(i / batchSize) + 1}批，共${batch.length}个向量`)
      }

      console.log(`批量更新完成，共处理${nodeDataList.length}个节点向量`)
    } catch (error) {
      console.error('批量更新节点向量失败:', error)
      throw new Error('批量节点向量更新失败')
    }
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        this.cache.delete(key)
        this.cacheExpiry.delete(key)
      }
    }
  }

  /**
   * 获取索引统计信息
   * @returns 索引统计
   */
  async getIndexStats(): Promise<unknown> {
    try {
      const index = this.requirePinecone().index(this.indexName)
      const stats = await index.describeIndexStats()
      return stats
    } catch (error) {
      console.error('获取索引统计失败:', error)
      throw new Error('获取索引统计失败')
    }
  }
}

// 导出单例实例
export const vectorSearchService = new VectorSearchService()
