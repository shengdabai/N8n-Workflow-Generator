# n8n 工作流生成器

一个基于 AI 的 n8n 工作流自动生成工具，帮助用户快速创建、编辑和管理 n8n 自动化工作流。

## 🚀 功能特性

### 核心功能
- **AI 工作流生成**: 基于自然语言描述自动生成 n8n 工作流
- **可视化编辑器**: 使用 React Flow 提供直观的工作流编辑界面
- **模板库管理**: 内置常用工作流模板，支持搜索和分类
- **工作流导出**: 支持导出为 n8n 兼容的 JSON 格式

### 技术特性
- **前后端分离**: React + TypeScript 前端，Express + Node.js 后端
- **现代化 UI**: 基于 Tailwind CSS 的响应式设计
- **API 集成**: RESTful API 设计，支持工作流 CRUD 操作
- **实时预览**: 工作流生成后即时预览和编辑

## 📋 系统要求

- Node.js >= 22.0.0
- pnpm 10.14.0（与 packageManager 一致）
- OpenAI API Key (用于 AI 工作流生成)

## 🛠️ 安装配置

### 1. 克隆项目
```bash
git clone <repository-url>
cd n8n-workflow-generator
```

### 2. 安装依赖
```bash
pnpm install --frozen-lockfile
```

### 3. 环境配置
复制环境变量模板文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：
```env
# OpenAI API 配置
OPENAI_API_KEY=your-openai-api-key-here

# 服务器配置
PORT=3001
FRONTEND_URL=http://localhost:3000

# 其他配置
NODE_ENV=development
```

### 4. 启动开发服务器
```bash
pnpm run dev
# 或使用 npm
npm run dev
```

服务启动后：
- 前端应用: http://localhost:3000
- 后端 API: http://localhost:3001
- API 文档: http://localhost:3001/api

## 📖 使用指南

### 主页面 - 工作流生成
1. 在主页面输入工作流描述，例如："创建一个每日邮件通知工作流"
2. 选择工作流偏好设置（可选）
3. 点击"生成工作流"按钮
4. 系统将使用 AI 自动生成相应的 n8n 工作流
5. 可以选择"编辑工作流"进入编辑器或"导出工作流"保存文件

### 编辑器页面 - 工作流编辑
1. 通过主页面生成工作流后进入编辑器
2. 使用可视化界面查看和编辑工作流节点
3. 支持拖拽、连接、删除节点操作
4. 可以导入现有的 n8n 工作流 JSON 文件
5. 编辑完成后可导出为 n8n 兼容格式

### 模板库页面 - 预设模板
1. 浏览内置的工作流模板
2. 使用搜索功能快速找到需要的模板
3. 按分类筛选模板（数据处理、通知、集成等）
4. 点击"使用模板"快速应用到编辑器
5. 可以基于模板进行自定义修改

### 导出页面 - 工作流导出
1. 查看工作流的详细信息和统计
2. 预览生成的 JSON 格式数据
3. 点击"复制 JSON"复制到剪贴板
4. 点击"下载文件"保存为本地 JSON 文件
5. 按照使用说明导入到 n8n 平台

## 🔧 API 接口

### 工作流生成
```http
POST /api/workflow/generate
Content-Type: application/json

{
  "description": "工作流描述",
  "preferences": {
    "complexity": "simple",
    "category": "notification"
  }
}
```

### 模板管理
```http
GET /api/templates
```

### 工作流导出
```http
POST /api/workflow/export
Content-Type: application/json

{
  "workflow": { /* 工作流数据 */ },
  "format": "json"
}
```

## 📁 项目结构

```
n8n-workflow-generator/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── pages/             # 页面组件
│   ├── services/          # API 服务
│   ├── hooks/             # 自定义 Hooks
│   └── utils/             # 工具函数
├── api/                   # 后端源码
│   ├── routes/            # API 路由
│   ├── services/          # 业务逻辑
│   ├── utils/             # 工具函数
│   └── server.js          # 服务器入口
├── data/                  # 数据文件
│   └── templates.json     # 工作流模板
├── public/                # 静态资源
└── docs/                  # 文档
```

## 🚀 部署指南

### 生产环境构建
```bash
pnpm run build
```

### 启动本地 API 服务
```bash
pnpm dev:server
```

API 默认只监听 `127.0.0.1`。只有在已配置反向代理、身份认证和请求配额后，才应通过 `HOST` 显式绑定其他地址。当前项目尚未实现面向公网的认证与配额控制，因此不能把本地可运行状态视为可直接公开部署；模型 API Key 也必须只保存在服务端配置中。

### Docker 前端镜像（可选）
```bash
# 构建镜像
docker build --build-arg VITE_API_BASE_URL=http://localhost:3001 -t n8n-workflow-generator .

# 仅运行静态前端；API 需要单独启动
docker run -p 127.0.0.1:3000:3000 n8n-workflow-generator
```

此镜像只提供静态前端，不启动 Express API，也不需要模型密钥。前端默认请求同源 `/api`，静态镜像本身不代理 API。上例通过构建参数 `VITE_API_BASE_URL` 指定浏览器所在机器的独立 API；远程部署时应设置实际 API 地址，或由反向代理处理 `/api`。`.dockerignore` 排除本机凭据、依赖、构建产物和过程备份。

### 离线连接回归
```bash
NODE_ENV=test TSX_DISABLE_CACHE=1 node --import tsx --test tests/workflow-connections.test.mjs
```
连接在生成器内部使用节点 ID，导出为 n8n JSON/YAML 时使用节点名称。验证器兼容两种引用，拒绝重复 ID、重复名称、名称与 ID 歧义、悬空连接和非法输入索引。分支位置和连接类型会保留，删除节点会清除其出入连接。导出保留节点执行选项，但不包含凭据引用。

## 🔍 故障排除

### 常见问题

**Q: AI 工作流生成失败**
A: 检查 OpenAI API Key 是否正确配置，确保有足够的 API 配额

**Q: 前端页面无法访问后端 API**
A: 确认后端服务正常运行，检查端口配置和 CORS 设置

**Q: 工作流导出的 JSON 在 n8n 中无法导入**
A: 确保导出的 JSON 格式符合 n8n 标准，检查节点类型和连接配置

### 调试模式
启用详细日志输出：
```bash
DEBUG=* pnpm run dev
```

## 🤝 贡献指南

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [n8n](https://n8n.io/) - 强大的工作流自动化平台
- [React Flow](https://reactflow.dev/) - 优秀的流程图组件库
- [OpenAI](https://openai.com/) - AI 技术支持
- [Tailwind CSS](https://tailwindcss.com/) - 现代化 CSS 框架

## 📞 支持

如有问题或建议，请通过以下方式联系：
- 创建 [Issue](../../issues)
- 发送邮件至项目维护者
- 查看 [Wiki](../../wiki) 获取更多文档

---

**开始使用 n8n 工作流生成器，让 AI 帮助您快速构建自动化工作流！** 🎉
