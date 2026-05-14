# Security Policy

## 密钥安全

请不要把以下内容提交到仓库、Issue、Pull Request 或截图里：

- OpenAI API Key
- Stripe Secret Key
- Stripe Webhook Secret
- GitHub Token
- SSH 私钥
- 服务器登录密码
- 数据库真实密码
- `.env`
- `data/provider-secrets.json`

仓库只允许提交 `.env.example` 这类示例配置。

## 发现安全问题

如果你发现密钥泄露、越权访问、支付绕过、积分绕过、发票越权下载、后台权限绕过等问题，请不要公开贴出可利用细节。

建议反馈内容：

- 问题发生的位置
- 复现步骤
- 影响范围
- 建议修复方式

## 当前安全边界

- 客户站 `/` 和管理后台 `/admin` 已做角色隔离。
- 管理后台接口要求管理员登录。
- 发票下载要求登录，并校验发票归属。
- 对外 API 使用 Bearer API Key 鉴权。
- `.gitignore` 已忽略本地数据、导出文件和密钥文件。

生产上线前必须开启 HTTPS，并使用真实强密码和安全的环境变量管理方式。
