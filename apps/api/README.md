# SellerCanvas 后端 API

这个目录用于承载未来正式上线的生产后端。

后端 API 负责所有不能放在前端的业务能力：

- 注册、登录、会话和权限校验
- OAuth 回调处理
- 商品项目增删改查
- 上传签名和素材管理
- AI 任务创建
- AI 任务状态查询
- 积分冻结、扣减和失败退回
- Stripe 订阅支付
- Stripe Webhook 事件处理
- 导出文件生成
- 仅管理员可访问的数据接口

当前已经开始迁移到 `/api/v2`：

- 客户端余额查询：`GET /api/v2/credits/balance`
- 创建 AI 任务：`POST /api/v2/jobs`
- Worker 标记成功：`POST /api/v2/jobs/:id/succeed`
- Worker 标记失败：`POST /api/v2/jobs/:id/fail`

迁移期间，根目录的 `server.js` 仍然作为可运行后端保留，并逐步桥接到新的积分和任务服务。
