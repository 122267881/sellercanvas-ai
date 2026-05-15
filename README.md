# SellerCanvas AI

SellerCanvas AI 是面向跨境卖家的 AI 商品图与 Listing 交付平台。目标不是展示 Demo，而是提供一套可以部署、可以登录、可以付费、可以扣积分、可以生成交付物的 SaaS 工具。

仓库地址：[https://github.com/122267881/sellercanvas-ai](https://github.com/122267881/sellercanvas-ai)

开源协议：MIT。协作说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全说明见 [SECURITY.md](SECURITY.md)。

## 访问地址

本地启动后访问：

- 客户使用网站：`http://localhost:4173`
- 开发者管理后台：`http://localhost:4173/admin`
- 健康检查接口：`http://localhost:4173/api/health`

默认管理员账号：

```text
admin@sellercanvas.local
Admin123!ChangeMe
```

生产环境必须在 `.env` 里修改 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`，不要使用默认账号上线。

## 两个网站的分工

客户网站 `/` 面向付费客户：

- 邮箱注册、登录、退出
- Google / GitHub OAuth 登录入口
- 查看定价和订阅套餐
- 购买套餐并获得积分
- 查看当前可用积分
- 创建商品项目
- 上传商品图
- AI 商品分析
- 反推导演级 Prompt
- 批量生成商品图
- 生成和编辑 Listing 文案
- 导出 Listing Pack
- 下载发票
- 查看历史记录和导出记录

管理后台 `/admin` 只给开发者和管理员使用：

- 客户列表
- 订阅和支付记录
- 发票记录
- 积分账户和积分流水
- AI 任务状态
- AI Provider 配置
- OpenAI API Key 配置
- 对外 API Key 创建和吊销
- API 调用用量
- 审计日志
- CSV 数据导出

客户网站不会出现 OpenAI API Key、AI Provider、客户列表、全局用量、审计日志等管理功能。

## 当前功能状态

已经跑通的核心闭环：

- 注册用户获得 50 试用积分
- AI 分析扣 5 积分
- Starter 订阅本地测试确认后发放 200 积分
- 批量生成 4 张商品图扣 80 积分
- Listing 文案生成扣 3 积分
- Listing Pack 导出扣 2 积分
- 发票可下载，并限制只能下载自己的发票
- 管理后台可查看客户、支付、积分、任务、Provider 和 API 用量
- 管理后台可以创建对外 API Key
- `/v1/generate` 支持用 API Key 调用
- OpenAI Provider 配置只在后台保存和测试

需要真实生产配置后才能完整验收的部分：

- 真实 OpenAI 视觉分析和生图：需要 `OPENAI_API_KEY`
- 真实 Stripe 扣款和自动续费：需要 Stripe Secret、Price ID、Webhook Secret
- Google / GitHub OAuth：需要对应 OAuth Client ID 和 Secret
- 生产数据库：建议使用 Docker Compose 自带 PostgreSQL 或外部 PostgreSQL
- 生产文件存储：当前本地使用 `exports/`，上线建议接 S3 / R2 / OSS

## 本地运行

要求：

- Node.js 18 或更高版本
- Windows PowerShell / Terminal

安装依赖：

```powershell
cd "D:\SellerCanvas AI"
npm.cmd install
```

启动：

```powershell
npm.cmd start
```

如果 PowerShell 拦截 `npm`，请使用 `npm.cmd`。

## 功能验收

静态检查：

```powershell
npm.cmd run check
```

前端文案和入口检查：

```powershell
node scripts/check-frontend-content.js
```

这个脚本会检查客户站、开发者后台、挂载节点、中文文案、API 配置入口隔离，以及客户站是否误用前端 Bearer Token。

商业闭环验收。需要先启动服务：

```powershell
npm.cmd start
```

另开一个 PowerShell 运行：

```powershell
npm.cmd run check:commercial
```

`check:commercial` 会实际跑一遍：

- 健康检查
- 客户注册
- 积分余额查询
- 创建项目
- AI 分析扣积分
- 本地订阅支付确认
- 发放订阅积分
- 批量生成 4 张图
- 生成 Listing 文案
- 导出 Listing Pack
- 下载发票
- 后台登录
- 后台 Provider 配置读取
- 后台 API Key 创建
- `/v1/generate` 对外 API 调用
- API Key 吊销

看到下面输出表示核心商业流程通过：

```text
Commercial flow OK
```

## AI 接口配置

后台地址：

```text
http://localhost:4173/admin#/providers
```

配置项：

- `AI Provider`：选择 `OpenAI API`
- `OpenAI API Key`：填写你的 OpenAI Key
- `Base URL`：默认 `https://api.openai.com/v1`
- `文本/分析模型`
- `生图模型`

客户网站不能配置 API Key。客户只负责付费和使用工具。

没有配置 OpenAI Key 时，系统会使用本地备用模式，业务流程可以跑通，但不是真实 AI 生图。

## 对外 API

后台地址：

```text
http://localhost:4173/admin#/api
```

管理员可以创建 SellerCanvas 自己的对外 API Key。这个 Key 是给外部系统调用 SellerCanvas API 用的，不是 OpenAI Key。

调用示例：

```bash
curl -X POST http://localhost:4173/v1/generate \
  -H "Authorization: Bearer your_sellercanvas_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"API Listing","platform":"amazon","generateImages":false}'
```

## 环境变量

复制示例文件：

```bash
cp .env.example .env
```

至少要配置：

```text
PUBLIC_APP_URL=https://your-domain.com
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=change_this_password
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_BUSINESS_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
DATABASE_URL=postgresql://user:password@postgres:5432/sellercanvas
WORKER_INTERNAL_SECRET=change_this_secret
```

不要把 `.env` 提交到 GitHub。项目已经在 `.gitignore` 里忽略 `.env`、`data/`、`exports/` 和 `data/provider-secrets.json`。

## Docker 部署

复制环境变量：

```bash
cp .env.example .env
```

修改 `.env` 里的管理员账号、OpenAI、Stripe、数据库密码和域名。

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f sellercanvas
```

生产建议：

- 使用 Nginx 或 Caddy 反向代理到 `http://127.0.0.1:4173`
- 开启 HTTPS
- 给客户站绑定主域名，例如 `https://sellercanvas.com`
- 给后台绑定独立域名或路径，例如 `https://admin.sellercanvas.com` 或 `/admin`
- 定期备份 PostgreSQL
- 不要把真实密钥写进代码或 README

## 开源协作安全说明

可以公开仓库让别人帮你完善代码，但不要公开任何真实密钥。

不能提交：

- `.env`
- OpenAI API Key
- Stripe Secret Key
- Stripe Webhook Secret
- GitHub Token
- SSH 私钥
- 服务器登录密码
- 数据库真实密码
- `data/provider-secrets.json`
- `data/`
- `exports/`

协作建议：

- 让别人 Fork 仓库
- 修改后提交 Pull Request
- 不要给别人你的 GitHub 密码
- 不要给别人服务器密码
- 不要给别人 OpenAI 或 Stripe 密钥

## 项目结构

```text
SellerCanvas AI/
├─ index.html                 # 客户网站入口
├─ admin.html                 # 管理后台入口
├─ app.js                     # 客户网站 SPA
├─ admin.js                   # 管理后台 SPA
├─ server.js                  # Node.js HTTP 服务和主业务 API
├─ styles.css                 # 全局样式
├─ apps/api/                  # 新架构 API、积分、任务、Stripe、Prisma 适配
├─ packages/ai-core/          # Prompt 底层逻辑
├─ packages/billing/          # 积分账本
├─ packages/shared/           # 平台和积分价格配置
├─ workers/ai/                # AI 任务类型
├─ prisma/                    # Prisma schema 和迁移
├─ scripts/                   # 自动检查脚本
├─ Dockerfile
├─ docker-compose.yml
└─ .env.example
```

## 当前限制和下一步

当前版本已经具备 SaaS 商业基线，但要达到正式大规模商用，还建议继续升级：

- 把上传图片和生成图片迁移到对象存储
- 把 AI 生图改成异步队列和 Worker
- 接入真实 Stripe Webhook 并写入 `stripeCustomerId`
- 增加邮件验证和找回密码
- 增加团队成员和权限管理
- 增加更细的管理员筛选、分页和导出
- 增加 Playwright 端到端浏览器测试
- 增加生产日志、错误监控和告警

这个仓库当前适合作为可部署、可验证、可继续协作开发的 SellerCanvas AI SaaS 基线。
