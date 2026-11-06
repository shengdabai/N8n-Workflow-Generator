import fs from 'fs/promises';
import path from 'path';
import { N8nWorkflow, N8nNode } from './n8nWorkflowService';
import { normalizeConnections } from '../../shared/workflowConnections';

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  /** Backward-compatible name used by API responses. */
  recommendations: string[];
  score: number; // 0-100的质量评分
}

/**
 * n8n节点参考数据接口
 */
interface NodeReference {
  nodeTypes: {
    [category: string]: {
      [nodeType: string]: {
        displayName: string;
        description: string;
        parameters: Record<string, { required?: boolean }>;
      }
    }
  };
  commonPatterns: unknown;
  bestPractices: unknown;
}

/**
 * 工作流验证服务
 * 确保生成的工作流符合n8n官方标准
 */
export class WorkflowValidationService {
  private nodeReference: NodeReference | null = null;
  private standardNodeTypes: Set<string> = new Set();

  constructor() {
    this.loadNodeReference();
  }

  /**
   * 加载n8n节点参考数据
   */
  private async loadNodeReference(): Promise<void> {
    try {
      const referencePath = path.join(process.cwd(), 'data', 'n8n-nodes-reference.json');
      const referenceData = await fs.readFile(referencePath, 'utf-8');
      this.nodeReference = JSON.parse(referenceData);
      
      // 构建标准节点类型集合
      if (this.nodeReference) {
        Object.values(this.nodeReference.nodeTypes).forEach(category => {
          Object.keys(category).forEach(nodeType => {
            this.standardNodeTypes.add(nodeType);
          });
        });
      }
      
      console.log('✅ n8n节点参考数据加载成功');
    } catch (error) {
      console.error('❌ 加载n8n节点参考数据失败:', error);
    }
  }

  /**
   * 全面验证工作流
   * @param workflow 待验证的工作流
   * @returns 验证结果
   */
  async validateWorkflow(workflow: N8nWorkflow): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      recommendations: [],
      score: 100
    };

    try {
      // 1. 基础结构验证
      this.validateBasicStructure(workflow, result);
      
      // 2. 节点验证
      this.validateNodes(workflow.nodes, result);
      
      // 3. 连接验证
      this.validateConnections(workflow, result);
      
      // 4. 参数验证
      this.validateParameters(workflow.nodes, result);
      
      // 5. 布局验证
      this.validateLayout(workflow.nodes, result);
      
      // 6. 最佳实践检查
      this.checkBestPractices(workflow, result);
      
      // 7. n8n兼容性检查
      this.checkN8nCompatibility(workflow, result);
      
      // 计算最终评分
      this.calculateScore(result);
      
      // 判断是否有效
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push(`验证过程中发生错误: ${error}`);
      result.isValid = false;
      result.score = 0;
    }

    return result;
  }

  /**
   * 验证基础结构
   */
  private validateBasicStructure(workflow: N8nWorkflow, result: ValidationResult): void {
    // 检查必需字段
    if (!workflow.name || typeof workflow.name !== 'string') {
      result.errors.push('工作流必须有有效的名称');
    }
    
    if (!Array.isArray(workflow.nodes)) {
      result.errors.push('工作流必须包含节点数组');
    }
    
    if (!workflow.connections || typeof workflow.connections !== 'object') {
      result.errors.push('工作流必须包含连接配置对象');
    }
    
    // 检查可选但推荐的字段
    if (typeof workflow.active !== 'boolean') {
      result.warnings.push('建议设置active字段为布尔值');
    }
    
    if (!workflow.settings || typeof workflow.settings !== 'object') {
      result.warnings.push('建议包含settings配置对象');
    }
    
    if (!workflow.staticData || typeof workflow.staticData !== 'object') {
      result.warnings.push('建议包含staticData配置对象');
    }
  }

  /**
   * 验证节点
   */
  private validateNodes(nodes: N8nNode[], result: ValidationResult): void {
    if (!nodes || nodes.length === 0) {
      result.errors.push('工作流至少需要包含一个节点');
      return;
    }

    const nodeIds = new Set<string>();
    let hasStartNode = false;

    nodes.forEach((node, index) => {
      // 检查节点ID唯一性
      if (!node.id) {
        result.errors.push(`节点${index + 1}缺少ID`);
      } else if (nodeIds.has(node.id)) {
        result.errors.push(`节点ID重复: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      // 检查节点名称
      if (!node.name || typeof node.name !== 'string') {
        result.errors.push(`节点${node.id || index + 1}缺少有效名称`);
      }

      // 检查节点类型
      if (!node.type || typeof node.type !== 'string') {
        result.errors.push(`节点${node.id || index + 1}缺少有效类型`);
      } else {
        // 检查是否为标准n8n节点类型
        if (!this.standardNodeTypes.has(node.type)) {
          result.warnings.push(`节点${node.id}使用了非标准节点类型: ${node.type}`);
        }
        
        // 检查是否有开始节点
        if (node.type === 'n8n-nodes-base.start' || node.type === 'n8n-nodes-base.webhook' || node.type === 'n8n-nodes-base.cron') {
          hasStartNode = true;
        }
      }

      // 检查typeVersion
      if (node.typeVersion !== undefined && typeof node.typeVersion !== 'number') {
        result.errors.push(`节点${node.id}的typeVersion必须是数字`);
      }

      // 检查位置坐标
      if (!Array.isArray(node.position) || node.position.length !== 2) {
        result.errors.push(`节点${node.id}必须有有效的位置坐标[x, y]`);
      } else if (typeof node.position[0] !== 'number' || typeof node.position[1] !== 'number') {
        result.errors.push(`节点${node.id}的位置坐标必须是数字`);
      }
    });

    // 检查是否有触发节点
    if (!hasStartNode) {
      result.warnings.push('工作流建议包含至少一个触发节点(Start/Webhook/Cron等)');
    }
  }

  /**
   * 验证连接
   */
  private validateConnections(workflow: N8nWorkflow, result: ValidationResult): void {
    try {
      normalizeConnections(workflow.nodes, workflow.connections);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '连接格式错误');
    }
  }

  /**
   * 验证参数
   */
  private validateParameters(nodes: N8nNode[], result: ValidationResult): void {
    if (!this.nodeReference) {
      result.warnings.push('无法验证节点参数：节点参考数据未加载');
      return;
    }

    nodes.forEach(node => {
      // 查找节点类型的参考信息
      let nodeRef: { parameters: Record<string, { required?: boolean }> } | undefined;
      for (const category of Object.values(this.nodeReference!.nodeTypes)) {
        if (category[node.type]) {
          nodeRef = category[node.type];
          break;
        }
      }

      if (nodeRef && nodeRef.parameters) {
        // 检查必需参数
        Object.entries(nodeRef.parameters).forEach(([paramName, paramConfig]) => {
          if (paramConfig.required && (!node.parameters || !node.parameters[paramName])) {
            result.warnings.push(`节点${node.id}缺少推荐参数: ${paramName}`);
          }
        });
      }
    });
  }

  /**
   * 验证布局
   */
  private validateLayout(nodes: N8nNode[], result: ValidationResult): void {
    const positions = nodes.map(node => node.position);
    
    // 检查节点重叠
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];
        
        if (pos1 && pos2) {
          const distance = Math.sqrt(
            Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2)
          );
          
          if (distance < 150) { // 最小间距150像素
            result.warnings.push(`节点位置过于接近，可能重叠`);
          }
        }
      }
    }
    
    // 检查布局合理性
    const minX = Math.min(...positions.filter(p => p).map(p => p![0]));
    const minY = Math.min(...positions.filter(p => p).map(p => p![1]));
    
    if (minX < 0 || minY < 0) {
      result.warnings.push('建议节点位置使用正坐标');
    }
  }

  /**
   * 检查最佳实践
   */
  private checkBestPractices(workflow: N8nWorkflow, result: ValidationResult): void {
    // 检查节点命名
    workflow.nodes.forEach(node => {
      if (node.name === node.type.split('.').pop()) {
        result.suggestions.push(`建议为节点${node.id}使用更描述性的名称`);
      }
    });
    
    // 检查工作流复杂度
    if (workflow.nodes.length > 20) {
      result.suggestions.push('工作流较为复杂，建议考虑拆分为多个子工作流');
    }
    
    // 检查错误处理
    const hasErrorHandling = workflow.nodes.some(node => 
      node.type === 'n8n-nodes-base.if' || 
      node.type === 'n8n-nodes-base.switch'
    );
    
    if (!hasErrorHandling && workflow.nodes.length > 3) {
      result.suggestions.push('建议添加错误处理逻辑');
    }
  }

  /**
   * 检查n8n兼容性
   */
  private checkN8nCompatibility(workflow: N8nWorkflow, result: ValidationResult): void {
    // 检查JSON结构完整性
    try {
      JSON.stringify(workflow);
    } catch {
      result.errors.push('工作流JSON结构无效，无法序列化');
    }
    
    // 检查必需的n8n字段
    const requiredFields = ['name', 'nodes', 'connections'];
    requiredFields.forEach(field => {
      if (!(field in workflow)) {
        result.errors.push(`缺少n8n必需字段: ${field}`);
      }
    });
    
    // 检查节点ID格式
    workflow.nodes.forEach(node => {
      if (!/^[a-zA-Z0-9_-]+$/.test(node.id)) {
        result.warnings.push(`节点ID ${node.id} 包含特殊字符，可能影响n8n兼容性`);
      }
    });
  }

  /**
   * 计算质量评分
   */
  private calculateScore(result: ValidationResult): void {
    let score = 100;
    
    // 错误扣分
    score -= result.errors.length * 20;
    
    // 警告扣分
    score -= result.warnings.length * 5;
    
    // 建议扣分
    score -= result.suggestions.length * 2;
    
    result.score = Math.max(0, score);
  }

  /**
   * 生成验证报告
   */
  generateReport(result: ValidationResult): string {
    let report = `\n=== n8n工作流验证报告 ===\n`;
    report += `验证状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}\n`;
    report += `质量评分: ${result.score}/100\n\n`;
    
    if (result.errors.length > 0) {
      report += `🚨 错误 (${result.errors.length}):\n`;
      result.errors.forEach((error, index) => {
        report += `  ${index + 1}. ${error}\n`;
      });
      report += '\n';
    }
    
    if (result.warnings.length > 0) {
      report += `⚠️  警告 (${result.warnings.length}):\n`;
      result.warnings.forEach((warning, index) => {
        report += `  ${index + 1}. ${warning}\n`;
      });
      report += '\n';
    }
    
    if (result.suggestions.length > 0) {
      report += `💡 建议 (${result.suggestions.length}):\n`;
      result.suggestions.forEach((suggestion, index) => {
        report += `  ${index + 1}. ${suggestion}\n`;
      });
      report += '\n';
    }
    
    if (result.isValid) {
      report += '🎉 工作流已通过验证，可以直接导入n8n使用！\n';
    } else {
      report += '❌ 请修复上述错误后再导入n8n。\n';
    }
    
    return report;
  }
}

// 导出单例实例
export const workflowValidationService = new WorkflowValidationService();
