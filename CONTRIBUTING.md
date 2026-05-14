# Contributing to SellerCanvas AI

欢迎一起完善 SellerCanvas AI。这个项目的目标是做成面向跨境卖家的 AI 商品图与 Listing SaaS 工具。

## 开发流程

1. Fork 本仓库。
2. 基于 `main` 创建功能分支。
3. 修改代码。
4. 本地运行检查：

```powershell
npm.cmd run check
```

5. 如果本地服务已经启动，再运行商业闭环验收：

```powershell
npm.cmd run check:commercial
```

6. 提交 Pull Request，并说明你改了什么、为什么改、怎么验证。

## 代码要求

- 不要提交真实 API Key、服务器密码、数据库密码、Token 或私钥。
- 不要提交 `.env`、`data/`、`exports/`、`data/provider-secrets.json`。
- 客户端不要出现 OpenAI / Stripe / 数据库等服务端密钥。
- 客户功能和管理后台功能要保持隔离。
- 新增商业流程时，请补充或更新 `scripts/check-commercial-flow.js`。

## 重点方向

- 真实 AI Provider 质量优化
- 异步生图队列和 Worker
- Stripe Webhook 生产闭环
- 对象存储接入
- 浏览器端到端测试
- 后台分页、筛选、导出优化
- Listing 文案和 Prompt 底层逻辑增强
