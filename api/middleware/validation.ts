import { Request, Response, NextFunction } from 'express';

/**
 * 验证规则接口
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
}

/**
 * 验证规则集合
 */
export interface ValidationRules {
  [key: string]: ValidationRule;
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * 验证单个字段
 */
function validateField(field: string, value: unknown, rule: ValidationRule): ValidationError | null {
  // 检查必填项
  if (rule.required && (value === undefined || value === null || value === '')) {
    return {
      field,
      message: `${field} is required`,
      value
    };
  }

  // 如果值为空且不是必填项，跳过其他验证
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // 类型验证
  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return {
        field,
        message: `${field} must be of type ${rule.type}, got ${actualType}`,
        value
      };
    }
  }

  // 字符串长度验证
  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return {
        field,
        message: `${field} must be at least ${rule.minLength} characters long`,
        value
      };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return {
        field,
        message: `${field} must be at most ${rule.maxLength} characters long`,
        value
      };
    }
  }

  // 数字范围验证
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return {
        field,
        message: `${field} must be at least ${rule.min}`,
        value
      };
    }
    if (rule.max !== undefined && value > rule.max) {
      return {
        field,
        message: `${field} must be at most ${rule.max}`,
        value
      };
    }
  }

  // 数组长度验证
  if (rule.type === 'array' && Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return {
        field,
        message: `${field} must have at least ${rule.minLength} items`,
        value
      };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return {
        field,
        message: `${field} must have at most ${rule.maxLength} items`,
        value
      };
    }
  }

  // 正则表达式验证
  if (rule.pattern && typeof value === 'string') {
    if (!rule.pattern.test(value)) {
      return {
        field,
        message: `${field} format is invalid`,
        value
      };
    }
  }

  // 枚举值验证
  if (rule.enum && !rule.enum.includes(value)) {
    return {
      field,
      message: `${field} must be one of: ${rule.enum.join(', ')}`,
      value
    };
  }

  // 自定义验证
  if (rule.custom) {
    const result = rule.custom(value);
    if (result !== true) {
      return {
        field,
        message: typeof result === 'string' ? result : `${field} is invalid`,
        value
      };
    }
  }

  return null;
}

/**
 * 验证请求数据
 */
export function validateData(data: Record<string, unknown>, rules: ValidationRules): ValidationError[] {
  const errors: ValidationError[] = [];

  // 验证每个字段
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const error = validateField(field, value, rule);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * 请求验证中间件
 */
export function validateRequest(rules: ValidationRules) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 添加请求开始时间用于性能监控
    req.startTime = Date.now();

    const errors = validateData(req.body, rules);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * 查询参数验证中间件
 */
export function validateQuery(rules: ValidationRules) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validateData(req.query, rules);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * 路径参数验证中间件
 */
export function validateParams(rules: ValidationRules) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validateData(req.params, rules);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Parameter validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * 常用验证规则预设
 */
export const commonRules = {
  // 字符串规则
  requiredString: { required: true, type: 'string' as const, minLength: 1 },
  optionalString: { required: false, type: 'string' as const },
  shortString: { required: true, type: 'string' as const, minLength: 1, maxLength: 100 },
  longString: { required: true, type: 'string' as const, minLength: 1, maxLength: 1000 },
  
  // 数字规则
  requiredNumber: { required: true, type: 'number' as const },
  positiveNumber: { required: true, type: 'number' as const, min: 0 },
  optionalNumber: { required: false, type: 'number' as const },
  
  // 布尔规则
  requiredBoolean: { required: true, type: 'boolean' as const },
  optionalBoolean: { required: false, type: 'boolean' as const },
  
  // 数组规则
  requiredArray: { required: true, type: 'array' as const },
  optionalArray: { required: false, type: 'array' as const },
  nonEmptyArray: { required: true, type: 'array' as const, minLength: 1 },
  
  // 对象规则
  requiredObject: { required: true, type: 'object' as const },
  optionalObject: { required: false, type: 'object' as const },
  
  // 复杂度枚举
  complexity: { 
    required: true, 
    type: 'string' as const, 
    enum: ['simple', 'medium', 'complex'] 
  },
  
  // 邮箱验证
  email: {
    required: true,
    type: 'string' as const,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // URL验证
  url: {
    required: true,
    type: 'string' as const,
    pattern: /^https?:\/\/.+/
  },
  
  // ID验证（UUID或数字）
  id: {
    required: true,
    type: 'string' as const,
    pattern: /^[a-zA-Z0-9-_]+$/
  }
};

/**
 * 创建自定义验证规则的辅助函数
 */
export function createValidationRule(options: ValidationRule): ValidationRule {
  return options;
}

/**
 * 合并验证规则
 */
export function mergeRules(...rulesets: ValidationRules[]): ValidationRules {
  return Object.assign({}, ...rulesets);
}
