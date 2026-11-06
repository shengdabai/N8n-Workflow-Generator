import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// AI模型服务接口
export interface AIModelResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// AI模型服务类
export class AIModelService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  private getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API密钥未配置');
    this.openai ??= new OpenAI({ apiKey });
    return this.openai;
  }

  private getGemini(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API密钥未配置');
    this.gemini ??= new GoogleGenerativeAI(apiKey);
    return this.gemini;
  }

  /**
   * 使用OpenAI生成响应
   */
  async generateWithOpenAI(prompt: string): Promise<AIModelResponse> {
    try {
      // 检查API密钥是否配置
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key') {
        throw new Error('OpenAI API密钥未配置');
      }

      const response = await this.getOpenAI().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        model: 'OpenAI GPT-4',
        usage: {
          prompt_tokens: response.usage?.prompt_tokens,
          completion_tokens: response.usage?.completion_tokens,
          total_tokens: response.usage?.total_tokens,
        },
      };
    } catch (error) {
      console.error('OpenAI API错误:', error);
      throw new Error(`OpenAI连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 使用Gemini生成响应
   */
  async generateWithGemini(prompt: string): Promise<AIModelResponse> {
    try {
      // 检查API密钥是否配置
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
        throw new Error('Gemini API密钥未配置');
      }

      const model = this.getGemini().getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-pro' 
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        content: text,
        model: 'Google Gemini Pro',
      };
    } catch (error) {
      console.error('Gemini API错误:', error);
      throw new Error(`Gemini连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 使用Grok生成响应
   */
  async generateWithGrok(prompt: string): Promise<AIModelResponse> {
    try {
      // 检查API密钥是否配置
      const grokApiKey = process.env.GROK_API_KEY;
      if (!grokApiKey) {
        throw new Error('Grok API密钥未配置');
      }

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.GROK_MODEL || 'grok-beta',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API请求失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0]?.message?.content || '',
        model: 'xAI Grok',
        usage: {
          prompt_tokens: data.usage?.prompt_tokens,
          completion_tokens: data.usage?.completion_tokens,
          total_tokens: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      console.error('Grok API错误:', error);
      throw new Error(`Grok连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 并行调用所有AI模型生成响应
   */
  async generateWithAllModels(prompt: string): Promise<AIModelResponse[]> {
    const promises = [
      this.generateWithOpenAI(prompt).catch(error => ({ 
        content: '', 
        model: 'OpenAI GPT-4', 
        error: error.message 
      })),
      this.generateWithGemini(prompt).catch(error => ({ 
        content: '', 
        model: 'Google Gemini Pro', 
        error: error.message 
      })),
      this.generateWithGrok(prompt).catch(error => ({ 
        content: '', 
        model: 'xAI Grok', 
        error: error.message 
      })),
    ];

    const results = await Promise.all(promises);
    return results.filter(result => result.content && !('error' in result)) as AIModelResponse[];
  }

  /**
   * 选择最佳响应（基于内容长度和质量评估）
   */
  selectBestResponse(responses: AIModelResponse[]): AIModelResponse | null {
    if (responses.length === 0) return null;

    // 简单的评分算法：基于内容长度和结构完整性
    const scoredResponses = responses.map(response => {
      let score = 0;
      
      // 内容长度评分
      score += Math.min(response.content.length / 100, 50);
      
      // JSON结构评分
      try {
        const parsed = JSON.parse(response.content);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          score += 30;
        }
        if (parsed.connections) {
          score += 20;
        }
      } catch {
        // 不是有效JSON，降低评分
        score -= 10;
      }
      
      return { ...response, score };
    });

    // 返回评分最高的响应
    return scoredResponses.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }
}

export const aiModelService = new AIModelService();
