import test from 'node:test'
import assert from 'node:assert/strict'

import { PromptEngineService } from '../api/services/promptEngineService.ts'

// 用户填写的描述、上下文、需求、约束会被替换进提示词模板。
// String.prototype.replace 的第二个参数若是字符串，会把其中的 $$ $& $` $' 当成替换模式解释，
// 所以这里专门用含这些符号的输入，确认提示词原样保留用户写的内容。
const TRICKY = [
  '每月预算 $$ 200 以内',
  '把 $& 当作变量名',
  "价格字段形如 $` 或 $' 的模板",
  '金额 $100 以上才通知',
]

test('工作流生成提示词：描述、上下文、需求、约束含 $ 符号时原样写入', async () => {
  const engine = new PromptEngineService()
  for (const s of TRICKY) {
    const prompt = await engine.generateWorkflowPrompt({
      description: s,
      context: '上下文 ' + s,
      requirements: ['需求 ' + s],
      constraints: ['约束 ' + s],
    })
    assert.ok(prompt.includes('需求描述：' + s + '\n'), '描述被改写：' + s)
    assert.ok(prompt.includes('上下文信息：上下文 ' + s), '上下文被改写：' + s)
    assert.ok(prompt.includes('- 需求 ' + s), '需求被改写：' + s)
    assert.ok(prompt.includes('- 约束 ' + s), '约束被改写：' + s)
    assert.ok(!/\{(description|context|requirements|constraints|nodeList|examples)\}/.test(prompt), '还有未替换的占位符：' + s)
  }
})

test('工作流生成提示词：没有上下文、需求、约束时占位符替换为空', async () => {
  const engine = new PromptEngineService()
  const prompt = await engine.generateWorkflowPrompt({ description: '每天早上把 RSS 汇总发到邮箱' })
  assert.ok(prompt.includes('需求描述：每天早上把 RSS 汇总发到邮箱\n'))
  assert.ok(!prompt.includes('上下文信息：'))
  assert.ok(!prompt.includes('具体需求：'))
  assert.ok(!prompt.includes('约束条件：'))
  assert.ok(!/\{[a-zA-Z]+\}/.test(prompt), '还有未替换的占位符')
})

test('节点推荐提示词：场景描述与当前工作流含 $ 符号时原样写入', async () => {
  const engine = new PromptEngineService()
  for (const s of TRICKY) {
    const prompt = await engine.generateNodeRecommendationPrompt(s, '工作流 ' + s)
    assert.ok(prompt.includes('场景描述：' + s + '\n'), '场景描述被改写：' + s)
    assert.ok(prompt.includes('当前工作流：工作流 ' + s + '\n'), '当前工作流被改写：' + s)
  }
})
