# @medprint/ai-agent

**MedPrint 专属 AI 医疗排版 Agent 与 DeepSeek Harness (`dsh`) 插件**

*Autonomous AI Agent & Tool Plugin for DeepSeek Harness, Claude, Cursor & OpenAI-compatible Models*

---

## 🌟 核心能力

通过 Tool Calling（函数调用），将 MedPrint 核心排版引擎的全部能力赋予 AI Agent：
1. **自然语言生成医疗报告模板 (`create_medical_template`)**：医生用中文自然语言描述需求，Agent 自动生成符合规范的 AST 并选择 A5 横向双列折流或 PACS 多联影像排版；
2. **临床医学公式自动计算 (`calculate_clinical_formula`)**：输入患者原始化验数据，Agent 自动调用内核执行 eGFR (CKD-EPI 2021)、LDL-C、BMI 等计算，并判定偏高偏低标记；
3. **单页弹性排版自适应优化 (`optimize_page_compaction`)**：Agent 自动评估纸张净高度，微调行高字号，保证 100% 紧凑在 1 张 A5 纸内；
4. **硬件级静默打印与卡纸监控 (`dispatch_silent_print`)**：直连底层 Spooler 假脱机，感知真实出纸。

---

## 🚀 在 DeepSeek Harness (`dsh`) 中集成

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 是 DeepSeek 开源的“万物皆插件 (Everything is a Plugin)”模块化智能体框架。

### 1. 注册 MedPrint 工具集
在 `dsh.config.json` 或您的自定义 harness 脚本中引入：

```typescript
import { MEDPRINT_TOOLS, MedPrintToolExecutor } from '@medprint/ai-agent'

export default {
  plugins: [
    {
      name: 'medprint-medical-printer',
      tools: MEDPRINT_TOOLS,
      handler: async ({ tool, args }) => {
        return await MedPrintToolExecutor.executeTool(tool, args)
      }
    }
  ]
}
```

### 2. 在 CLI 中直接调用

```bash
# 启动 DeepSeek Harness Web 交互
npx @deepseek-ai/dsh web --plugin @medprint/ai-agent
```

在对话界面中直接对 DeepSeek 说：
> “帮我生成一份 A5 横向双列的肾内科复查报告单，患者男性 55岁，包含血肌酐和尿素氮，自动计算 eGFR，重点标出异常值，加上医院红章并检查是否能 1 页打完。”

DeepSeek 会自主规划多步 Tool Calls：
1. 调用 `calculate_clinical_formula` 计算 eGFR；
2. 调用 `create_medical_template` 构建 A5 双列 AST；
3. 调用 `optimize_page_compaction` 校验纸张预算；
4. 输出最终排版并提示医生可一键出单。

---

## 🧪 独立单测与独立运行

设置环境变量：
```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
```

调用 Agent 运行器：
```typescript
import { MedPrintAgentRunner } from '@medprint/ai-agent'

const runner = new MedPrintAgentRunner()
const result = await runner.runTask("生成一张A5横向双列血常规化验单并打印")
console.log(result)
```
