# SellerCanvas AI

SellerCanvas AI 是面向跨境卖家的 AI 商品图与 Listing 交付平台。目标不是做一个展示 Demo，而是做成可以部署上线、可以承载真实业务流程的电商素材生产工具：从商品上传、AI 分析、Prompt 生成、平台合规适配、批量生图、Listing 文案，到导出交付与历史追踪形成完整闭环。

## 2026-05-14 商用验收状态

当前仓库已经完成可部署 SaaS 基线，并通过本地接口验收：

- 客户端和开发者后台已经分离：客户访问 `/`，开发者/管理员访问 `/admin`。
- 客户端不提供 API Key 或 AI Provider 配置入口，客户只负责注册、付费、消耗积分和生成交付物。
- 管理后台提供客户、订阅支付、积分账户、AI 任务、AI 接口配置、对外 API Key、用量统计和审计日志。
- 注册用户会获得试用积分；分析、生成、文案和导出会按任务扣积分。
- 本地支付测试链路可完成订阅确认、发票记录、积分发放、生成和导出。
- 发票按钮已经改为真实下载 HTML 发票，并带有用户权限校验。
- Stripe Checkout 已写入 `userId`、`plan`、`paymentId` 和 `stripePriceId` metadata，便于 webhook 正确归属用户和发放积分。
- 订阅管理接口支持本地测试模式；当生产环境写入 `stripeCustomerId` 后可跳转 Stripe Billing Portal。
- OpenAI Provider 配置只在管理后台出现，API Key 保存在服务端本地 secrets 或环境变量中，不暴露给客户前端。
- GitHub 最新代码地址：[https://github.com/122267881/sellercanvas-ai](https://github.com/122267881/sellercanvas-ai)

上线前仍需要你配置真实生产资源：

- 填写真实 `OPENAI_API_KEY` 后，才能验证真实图片分析和真实生图效果。
- 填写 Stripe 真实密钥、Price ID 和 Webhook Secret 后，才能跑真实扣款和自动续费。
- 使用 Docker/PostgreSQL 部署时设置 `DATABASE_URL` 并执行 `npm run prisma:migrate`。
- 配置正式域名、HTTPS、反向代理和对象存储；当前本地模式仍使用 `data/` 和 `exports/`。
- 若要把后台和客户站部署成完全不同域名，可在反向代理层把客户域名指向 `/`，管理域名指向 `/admin`。

## 产品定位

一句话：让不会设计、不会提示词、不会 PS 的跨境卖家，也能快速生成高质量、平台适配、可直接用于 Listing 的商品图和文案。

目标平台：

- Amazon
- Temu
- TikTok Shop
- Etsy

目标用户：

- 跨境新手卖家
- Temu / Amazon 无货源卖家
- TikTok Shop 内容型卖家
- 小团队电商运营与设计外包团队

## 核心功能

- 项目工作台：创建商品项目、维护商品信息、跟踪进度
- 商品上传：支持商品主图上传、预览、替换和项目绑定
- AI 商品分析：识别品类、材质、卖点、目标平台和合规风险
- Prompt Studio：自动生成主图、场景图、尺寸图、营销图提示词，并支持人工编辑
- 多平台适配：按 Amazon、Temu、TikTok Shop、Etsy 输出不同尺寸、比例、规则和视觉策略
- AI 生图任务：生成主图、场景图、尺寸图、营销图四类核心资产
- Listing 文案：生成标题、五点描述、详情描述，并支持复制和保存
- 模板中心：通过行业模板快速创建新项目
- 生成历史：记录分析、生成、导出等操作，方便复盘和追踪
- 导出中心：导出 Listing Pack，包含图片资产、Prompt、文案和项目 JSON
- 设置中心：管理工作区、AI Provider、模型、团队、配额和安全选项
- 审计日志：记录关键业务动作，便于上线后排查问题

## 技术架构

当前项目采用零外部依赖的 Node.js 部署结构，便于本地运行、私有化部署和后续迁移到云服务。

```text
SellerCanvas AI/
├─ index.html                 # 应用入口
├─ styles.css                 # 全局 UI 样式
├─ app.js                     # 前端 SPA 业务逻辑
├─ server.js                  # Node.js HTTP 服务与 API
├─ package.json               # 启动与检查脚本
├─ data/
│  └─ db.json                 # 本地文件数据库，首次启动自动生成
├─ exports/                   # Listing Pack 导出目录
├─ 图/                        # 参考图与本地素材
└─ sellercanvas_ai_codex_dev_doc.md
```

后端模块：

- 静态资源服务
- 项目 CRUD API
- 模板 API
- 商品分析 API
- Prompt 保存 API
- 生成任务 API
- Listing 文案 API
- 导出 API
- 设置与定价 API
- 健康检查 API

## 本地运行

要求：

- Node.js 18 或更高版本
- Windows PowerShell / Terminal

启动：

```powershell
cd "D:\SellerCanvas AI"
npm.cmd start
```

访问：

```text
http://localhost:4173
```

如果 PowerShell 拦截 `npm`，请使用 `npm.cmd`，不要直接使用 `npm`。

默认管理员账号会在首次启动时自动创建：

```text
admin@sellercanvas.local
Admin123!ChangeMe
```

生产环境必须通过 `.env` 修改 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 后再初始化数据。

## 自检命令

```powershell
npm.cmd run check
```

该命令会检查服务端与前端 JavaScript 语法。

健康检查：

```text
http://localhost:4173/api/health
```

## 数据与持久化

首次启动时，服务会自动创建：

```text
data/db.json
exports/
```

`data/db.json` 保存：

- 项目
- 模板
- 生成历史
- 导出记录
- 工作区设置
- 订阅与发票模拟记录
- 审计日志

`exports/` 保存导出的 Listing Pack JSON 文件。

## AI Provider 接入说明

当前架构已经实现 Provider 抽象。默认使用本地商业规则引擎，方便无 API Key 时完整跑通业务闭环；当配置 `AI_PROVIDER=openai` 且存在 `OPENAI_API_KEY` 时，后端会优先调用真实 OpenAI API。

已接入的服务端链路：

- `/api/projects/:id/analyze`：商品图理解、商业分析、反推 Prompt、Listing 文案生成
- `/api/projects/:id/generate`：根据 Prompt 生成主图、场景图、尺寸图、营销图
- `/api/admin/test-provider`：后台测试 Provider 是否可用
- `/api/health`：查看 Provider 状态、模型、Key 来源和降级原因

建议环境变量：

```powershell
$env:AI_PROVIDER="openai"
$env:TEXT_MODEL="gpt-5.5"
$env:IMAGE_MODEL="gpt-image-2"
$env:OPENAI_API_KEY="你的 API Key"
npm.cmd start
```

真实上线时不要把 API Key 写入前端，也不要提交到仓库。所有 AI 调用应在 `server.js` 或独立后端服务中完成。

如果没有配置 Key，系统会自动降级为 `local-fallback`，后台管理页会明确显示当前不是实时 API 生图。

## Prompt 底层逻辑

SellerCanvas AI 的 Prompt 不是简单模板拼接。系统内置的角色是：全球顶尖视觉营销导演、跨境电商资深操盘手、顶级品牌策划人。它的使命是让不会设计、不会写提示词、不会 PS 的跨境卖家，也能生成高质量、平台适配、可直接用于 Listing 的商品图和营销文案。

核心原则：

- 导演思维：不是描述图片，而是导演一场让买家瞬间心动的视觉电影。
- AIDA：视觉必须完成注意、兴趣、欲望、行动的转化路径。
- FAB：每个卖点都要从特征、优势落到买家利益。
- 买家心路地图：先模拟买家第一眼、第二眼、信任建立、欲望触发和行动暗示。
- 买家审美优先：不做设计师自嗨，只做能提高点击率和转化率的视觉组合。

执行链路：

1. 视觉识别：分析商品图中的主体、材质、颜色、结构、角度、光线、背景和不可改动特征。
2. 商业抽象：提炼品类、目标用户、买家意图、核心卖点、转化阻力和平台合规风险。
3. 导演重构：为产品设定角色、品牌人格、场景叙事、情绪锚点、光影、构图和故事张力。
4. 反向推导：把图片事实拆成 subject、material texture、shape structure、camera angle、lighting、background、emotional anchor、negative prompt。
5. 资产分流：分别生成主图、场景图、尺寸图、营销图 Prompt。
6. 平台合规：套用 Amazon、Temu、TikTok Shop、Etsy 的比例、文字、主图和营销图约束。
7. 视觉总监质检：检查构图、质感、场景、卖点、合规和负面约束，不达标则修正 Prompt。

客户上传一张商品图后，理想链路是：

```text
上传图片
→ AI 视觉分析
→ 反推商品事实与可复现 Prompt
→ 生成平台适配图片
→ 生成 Listing 标题与五点描述
→ 导出 Listing Pack
```

后台管理页可验证 Provider 状态、模型配置、业务数据、审计日志和测试结果。

## 双站点架构

系统现在按两个独立站点运营：

- 客户站：`/`
  - 客户注册、登录、购买订阅、使用生图工具、管理自己的项目、导出交付包、查看账单。
  - 客户站不显示 API Key 配置、Provider 配置、客户列表、全局用量和后台数据。
- 开发者管理站：`/admin`
  - 仅管理员可登录。
  - 管理客户、订阅状态、支付记录、API Key、API 调用数据、Provider 配置、用量统计、审计日志。
  - 客户账号访问管理站会被拒绝。

## SaaS 商业模块

当前版本已经包含 SaaS 基线能力：

- 邮箱注册、登录、退出
- Session Cookie 鉴权
- 管理员与客户角色隔离
- 客户项目数据按 owner 隔离
- 开发者后台仅管理员可见
- 定价页与订阅计划
- Stripe Checkout 接入点
- 本地测试支付确认
- 发票与支付记录
- 订阅升级、管理、取消接口
- API Key 创建、吊销，仅限开发者管理站
- `/v1/generate` API 鉴权调用
- API 速率限制与用量记录
- 后台统计、支付记录、API 调用、审计日志

## API 调用

在开发者管理站 `/admin` 的“API 管理”页面生成 API Key 后调用。客户站不提供 API Key 配置入口。

```bash
curl -X POST http://localhost:4173/v1/generate \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name":"API Listing","platform":"amazon","generateImages":false}'
```

速率限制默认是每个 API Key 每分钟 60 次。调用会写入 `apiUsage`，可在开发者页面和后台管理查看。

## Docker 部署

复制环境变量：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

```text
PUBLIC_APP_URL
ADMIN_EMAIL
ADMIN_PASSWORD
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_*_PRICE_ID
```

启动：

```bash
docker compose up -d --build
```

生产目录挂载：

```text
./data     -> 数据库文件
./exports  -> 导出文件
```

建议使用 Nginx 或 Caddy 反向代理到 `http://127.0.0.1:4173`，并开启 HTTPS。

## 部署建议

适合的部署方式：

- VPS / 云服务器直接运行 Node 服务
- Docker 容器部署
- 私有化内网部署
- 后续迁移到 Next.js / Remix / NestJS / PostgreSQL 架构

生产环境建议：

- 使用反向代理，例如 Nginx 或 Caddy
- 开启 HTTPS
- 将 `data/` 和 `exports/` 挂载到持久化磁盘
- 配置访问认证
- 配置日志轮转
- 图片资产迁移到对象存储，例如 S3、R2、OSS
- 数据库迁移到 PostgreSQL 或 MySQL
- AI 生成任务改为队列模式，避免长请求阻塞

## 上线前检查清单

- 所有一级、二级、三级页面导航可访问
- 所有按钮均有明确业务动作或禁用态
- 项目创建、编辑、复制、删除可用
- 商品上传与替换可用
- AI 分析可用
- Prompt 编辑和保存可用
- 生成任务可用并写入历史
- 文案生成、编辑、复制可用
- 导出包可下载并包含完整项目数据
- 设置保存可用
- 定价方案选择有记录
- 错误提示清晰
- 刷新页面后数据不丢失
- 移动端、平板、桌面端布局可用
- API Key 不出现在前端代码中

## 当前交付标准

本项目按“可上线产品原型”推进，而不是静态展示页。允许本地规则引擎作为默认 AI Provider，但页面、按钮、数据流、导出流和部署结构必须完整可用。后续只需要替换真实 AI Provider 和生产数据库，即可进入商业化部署阶段。
