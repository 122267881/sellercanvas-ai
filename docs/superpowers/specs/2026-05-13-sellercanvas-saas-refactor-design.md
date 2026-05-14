# SellerCanvas AI 生产级 SaaS 重构设计

## 1. 背景

SellerCanvas AI 是面向跨境卖家的 AI 商品图与 Listing 交付平台。它的目标不是展示 Demo，而是成为可部署上线、可收费、可承载真实业务流程的电商素材生产工具。

客户上传商品图后，系统需要完成商品理解、Prompt 反推、平台合规适配、批量生图、Listing 文案、导出交付与历史追踪，形成完整闭环。

当前项目已经具备基础原型能力，包括客户站、开发者后台、登录、项目、AI 分析、生图、导出、订阅和 API 管理雏形。但当前架构仍以单体 Node 服务、本地 JSON 文件和同步任务为主，不能作为长期商用架构。

## 2. 重构目标

本次重构采用“生产级 SaaS 渐进式重构路线”：保留已有可用业务成果，同时把核心系统逐步升级为可商用架构。

核心目标：

- 客户可以注册、登录、付费订阅、获得积分。
- 客户使用 AI 分析、生图、文案和导出时按积分扣费。
- 客户站只保留客户业务流程，不暴露 API Key、Provider、后台数据和系统配置。
- 开发者后台独立运营，仅管理员可访问。
- AI 生图从同步按钮升级为可追踪、可重试、可质检的任务流水线。
- 数据从本地 JSON 迁移到 PostgreSQL。
- 图片和导出包从本地文件迁移到对象存储。
- 支付从本地确认升级为 Stripe webhook 闭环。
- 每一次积分、支付、生成、导出和后台操作都可追踪。

## 3. 非目标

第一阶段不做以下内容：

- 不做开放给普通客户的 API Key 配置。
- 不做白标代理商系统。
- 不做复杂团队权限矩阵。
- 不做多供应商成本自动竞价。
- 不做 Shopify、WooCommerce 等店铺直连。
- 不做移动端 App。

这些能力可以在 MVP 稳定后进入第二或第三阶段。

## 4. 产品结构

系统拆成三个主要入口。

### 4.1 客户站

客户站面向跨境卖家，域名建议为 `app.sellercanvas.ai`。

客户站包含：

- 注册 / 登录 / OAuth
- 订阅购买
- 当前积分余额
- 商品项目
- 商品图上传
- AI 商品分析
- AI 图片方案
- 商品图生成
- Listing 文案生成
- 导出中心
- 历史记录
- 账单与发票

客户站不包含：

- API Key 配置
- AI Provider 配置
- OpenAI Key
- 系统健康检查
- 客户列表
- 全局用量
- 管理员审计日志
- 后台入口

### 4.2 开发者后台

开发者后台面向平台运营者，域名建议为 `admin.sellercanvas.ai`。

开发者后台包含：

- 管理员登录
- 客户管理
- 订阅状态
- 支付记录
- 发票记录
- 积分账户
- 积分流水
- AI 任务列表
- 生成失败记录
- Provider 配置
- API Key 管理
- API 调用统计
- 成本统计
- 审计日志
- 数据导出

普通客户账号访问后台必须返回 403 或跳转到无权限页。

### 4.3 后端 API

后端 API 面向客户站、开发者后台和内部 Worker。

职责：

- 鉴权与会话
- 用户与团队
- 项目数据
- 文件上传签名
- AI 任务创建
- 任务状态查询
- 积分冻结、扣除和退款
- 支付 checkout
- Stripe webhook
- 导出包生成
- 管理员后台数据

## 5. 推荐技术架构

第一阶段建议采用以下架构：

- Frontend: React 或 Next.js
- Backend: Node.js / NestJS
- Database: PostgreSQL
- ORM: Prisma
- Queue: Redis + BullMQ
- Storage: Cloudflare R2 或 AWS S3
- Payment: Stripe
- Auth: Email password + Google OAuth
- AI Provider: OpenAI Images + OpenAI Responses，保留 Provider 抽象
- Deployment: Docker Compose 起步，后续迁移到云托管

渐进式路线允许当前原型先继续运行，但新模块应按上述边界拆分，避免继续扩大单文件服务。

## 6. 核心业务流程

### 6.1 客户购买与积分发放

```text
客户选择套餐
-> Stripe Checkout
-> Stripe webhook 确认付款
-> 创建或更新订阅
-> 发放套餐月度积分
-> 写入积分流水
-> 客户站显示积分余额
```

### 6.2 AI 使用与积分扣费

```text
客户点击 AI 操作
-> 后端计算预计积分
-> 检查积分余额
-> 冻结积分
-> 创建 AI 任务
-> Worker 执行任务
-> 成功后正式扣除积分
-> 失败后自动解冻或退款
-> 写入任务记录与积分流水
```

### 6.3 商品图与 Listing 交付

```text
上传商品图
-> 图像事实识别
-> 商品理解
-> 买家心路分析
-> 平台规则适配
-> Prompt 反推
-> 生成多类型商品图
-> 视觉质检
-> Listing 文案生成
-> Listing Pack 导出
```

## 7. 积分计费设计

积分是 SellerCanvas AI 的核心商业计费单位。

### 7.1 套餐建议

| 套餐 | 月费 | 月度积分 | 适用对象 |
| --- | ---: | ---: | --- |
| Starter | 19 USD | 200 credits | 新手卖家 |
| Pro | 49 USD | 1200 credits | 日常运营卖家 |
| Business | 129 USD | 5000 credits | 小团队与外包团队 |

后续可增加一次性积分包：

- 500 credits
- 2000 credits
- 10000 credits

### 7.2 扣费建议

| 操作 | 扣费 |
| --- | ---: |
| AI 商品分析 | 5 credits |
| Prompt 方案生成 | 3 credits |
| Listing 文案生成 | 3 credits |
| 普通商品图 1 张 | 15 credits |
| 高清商品图 1 张 | 25 credits |
| 4 图套装 | 80 credits |
| Listing Pack 导出 | 2 credits |

### 7.3 积分流水

不能只在用户表保存余额。必须建立积分账户和积分流水。

每笔流水记录：

- 用户 ID
- 团队 ID
- 类型：grant、reserve、consume、refund、expire、admin_adjust
- 数量
- 关联任务 ID
- 关联支付 ID
- 操作前余额
- 操作后余额
- 创建时间

后台必须支持按客户、类型、时间、任务筛选积分流水。

## 8. AI 任务流水线

AI 不应作为同步长请求执行，而应进入任务队列。

任务类型：

- image_analysis
- prompt_generation
- image_generation
- image_quality_review
- listing_copy_generation
- export_packaging

任务状态：

- queued
- running
- succeeded
- failed
- refunded
- canceled

任务必须包含：

- 请求参数
- 预计积分
- 冻结积分 ID
- Provider
- 模型
- 输入图片
- 输出资产
- 错误信息
- 重试次数
- 成本估算

失败策略：

- Provider 超时：自动重试。
- 模型返回非法结果：重写 Prompt 后重试。
- 商品主体严重变形：质检失败并重试。
- 多次失败：任务失败并退回积分。

## 9. Prompt 反推底层逻辑

Prompt 生成必须服务转化，不只是描述图片。

每张商品图先提取：

- subject
- category
- material
- color
- structure
- shape
- scale
- packaging
- camera angle
- lighting
- background
- defects
- non-changeable facts

再生成商业策略：

- target buyer
- buyer pain point
- buyer desire
- first glance hook
- trust detail
- emotional anchor
- FAB
- AIDA
- platform compliance risk

最后输出不同资产类型 Prompt：

- 主图 Prompt
- 场景图 Prompt
- 尺寸图 Prompt
- 营销图 Prompt
- 社交内容图 Prompt

每个 Prompt 必须包含：

- 产品角色
- 品牌调性
- 场景叙事
- 构图
- 光线
- 色彩
- 质感
- 平台规格
- 安全区
- 情感触发点
- negative prompt

## 10. 数据模型

第一阶段需要的核心表：

- users
- sessions
- oauth_accounts
- teams
- team_members
- subscriptions
- payments
- invoices
- credit_accounts
- credit_ledger
- projects
- project_images
- image_analysis
- prompt_versions
- generation_jobs
- generated_assets
- listing_copy
- exports
- provider_configs
- api_keys
- api_usage
- admin_audit_logs

所有客户业务表必须带 `user_id` 或 `team_id`，管理员查询通过后台权限进入，客户查询必须强制 owner 隔离。

## 11. 权限设计

角色：

- customer
- admin
- owner，后续团队版使用
- member，后续团队版使用

权限原则：

- 客户只能访问自己的项目、图片、导出、发票和积分。
- 管理员可以访问后台数据。
- API Key 只允许管理员创建和吊销。
- Provider 配置只允许管理员查看和修改。
- Stripe webhook 不使用用户 session，必须校验 webhook signature。
- Worker 内部接口必须使用服务端密钥或队列权限。

## 12. 支付与订阅

第一阶段使用 Stripe。

必须实现：

- Checkout Session
- Customer ID 绑定
- Subscription ID 绑定
- checkout.session.completed webhook
- invoice.paid webhook
- invoice.payment_failed webhook
- customer.subscription.updated webhook
- customer.subscription.deleted webhook

订阅状态变化必须同步到用户订阅和积分账户。

付款成功发放积分，付款失败不发放积分。订阅取消后，已购买的额外积分不立即清零，月度积分可按策略到期。

## 13. 文件与导出

上传图、生成图和导出包不能长期存本地。

对象存储路径建议：

```text
teams/{teamId}/projects/{projectId}/uploads/{imageId}.png
teams/{teamId}/projects/{projectId}/assets/{assetId}.png
teams/{teamId}/projects/{projectId}/exports/{exportId}.zip
```

导出包内容：

- 原始商品图
- 生成商品图
- Prompt JSON
- Listing 文案
- 平台规格说明
- 项目元数据 JSON

## 14. 开发阶段

## 14.0 旧代码迁移策略

当前项目中的 `server.js`、`app.js`、`admin.js`、`styles.css`、`data/db.json` 和 `exports/` 属于可运行原型基线。它们不能在重构开始时直接删除或覆盖，因为这些文件包含已经验证过的业务流程、页面文案、Prompt 逻辑、Provider 调用、支付雏形和导出逻辑。

重构应采用“并行新架构 + 分阶段迁移 + 最后清理”的策略。

第一步：冻结旧代码职责。

- 旧客户站只作为功能参考，不继续新增复杂功能。
- 旧开发者后台只作为后台需求参考。
- 旧 `server.js` 只作为业务逻辑参考，不继续扩大。
- 旧 `data/db.json` 只作为本地样例数据，不作为生产数据源。

第二步：建立新目录结构。

建议新结构：

```text
apps/
  customer/        # 新客户站
  admin/           # 新开发者后台
  api/             # 新后端 API
workers/
  ai/              # AI 分析、生图、质检、导出 Worker
packages/
  shared/          # 共享类型、规则、平台配置
  billing/         # Stripe、积分和订阅逻辑
  ai-core/         # Prompt 反推、Provider 抽象、质量检查
prisma/
  schema.prisma    # PostgreSQL 数据模型
legacy/
  prototype/       # 旧原型代码最终归档位置
```

第三步：逐模块迁移。

- 先迁移数据模型和积分系统。
- 再迁移支付订阅。
- 再迁移项目、上传、AI 分析、生图、文案、导出。
- 再迁移开发者后台。
- 每迁移一个模块，都要有新测试和新页面验证。

第四步：切换入口。

- 新客户站稳定后，根路径 `/` 指向新客户站。
- 新后台稳定后，`/admin` 指向新后台。
- 旧入口可以临时保留为 `/legacy`，仅限本地开发或管理员访问。
- 生产部署不暴露 `/legacy`。

第五步：删除旧代码。

只有满足以下条件后，才删除或归档旧代码：

- 新客户站所有核心流程通过验收。
- 新开发者后台所有核心管理功能通过验收。
- 新 API 已覆盖旧 API 的必要能力。
- PostgreSQL 数据模型已替代 `data/db.json`。
- AI 任务队列已替代同步生成。
- Stripe webhook 已替代本地支付确认。
- 导出包已迁移到对象存储。
- `npm run check`、单元测试和关键端到端流程全部通过。

最终可以删除或归档：

- 根目录旧 `server.js`
- 根目录旧 `app.js`
- 根目录旧 `admin.js`
- 旧 `data/db.json`
- 旧本地 `exports/`
- 与旧原型绑定的 README 说明

但在删除前必须确认没有生产数据保存在本地目录中。

### 阶段 1：商用 MVP

目标：能真实收费、扣积分、生成、导出、后台可管理。

交付：

- 双站点分离
- 真实用户鉴权
- Stripe Checkout + webhook
- 积分账户与流水
- AI 操作扣积分
- 商品项目
- 上传图片
- AI 分析
- Prompt 反推
- 生成 4 图套装
- Listing 文案
- 导出 Listing Pack
- 管理后台客户、支付、积分、用量、Provider

### 阶段 2：生产稳定性

目标：可靠运行，能承载真实客户。

交付：

- PostgreSQL
- Prisma migration
- Redis + BullMQ
- 对象存储
- 任务重试
- 失败退款
- 日志与告警
- 数据备份

### 阶段 3：AI 质量增强

目标：提高客户满意度和复购。

交付：

- 多版本生成
- 视觉质检
- Prompt 自动修正
- 平台规则模板
- 历史风格复用
- 多语言 Listing

### 阶段 4：商业扩展

目标：扩大收入模型。

交付：

- 额外积分包
- 团队协作
- 批量商品上传
- 品牌模板库
- 白标和代理商后台
- 对外 API 商业化

## 15. 验收标准

商用 MVP 必须满足：

- 客户可以完成注册、登录、购买套餐。
- Stripe 付款成功后自动发放积分。
- 客户积分不足时不能创建 AI 任务。
- AI 任务失败时自动退回冻结积分。
- 客户可以上传商品图并生成 AI 分析。
- 系统可以反推 Prompt 并生成商品图。
- 系统可以生成 Listing 标题、五点和描述。
- 客户可以导出完整 Listing Pack。
- 客户只能看到自己的项目、账单、导出和积分。
- 客户站不出现 API Key、Provider、后台配置。
- 管理员可以在后台查看客户、订阅、支付、积分、任务、用量和日志。
- 普通客户访问后台返回无权限。
- 所有关键操作写入审计日志。
- 服务可以通过 Docker 部署。

## 16. 风险与应对

### AI 成本失控

应对：所有 AI 操作必须先检查积分并冻结积分；后台统计每个任务成本。

### 生图质量不稳定

应对：加入视觉质检、Prompt 重写、失败重试和人工可复用模板。

### 支付状态不一致

应对：以 Stripe webhook 为最终事实来源，不信任前端跳转结果。

### 客户数据串号

应对：所有查询强制 user/team 过滤；后台 API 单独鉴权。

### 任务长时间阻塞

应对：使用队列和 Worker，前端只轮询任务状态。

## 17. 推荐下一步

下一步应基于本设计文档拆分实施计划。计划应优先实现：

1. PostgreSQL + Prisma 数据模型。
2. 积分账户与积分流水。
3. Stripe webhook 订阅闭环。
4. AI 任务队列。
5. 客户站积分展示和扣费提示。
6. 开发者后台积分、任务和用量管理。

完成这些后，SellerCanvas AI 才具备真正可收费、可控成本、可追踪交付的 SaaS 基础。
