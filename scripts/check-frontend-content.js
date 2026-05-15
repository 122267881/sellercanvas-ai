const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = ["app.js", "admin.js", "index.html", "admin.html", "styles.css"];

const mojibakeMarkers = [
  "鎬",
  "鐧",
  "瀹",
  "绠",
  "鏀",
  "绉",
  "鍥",
  "椤",
  "鍚",
  "鏆",
  "銆",
  "锛",
  "鉁",
];

const required = [
  ["index.html", "SellerCanvas AI 客户端"],
  ["admin.html", 'id="admin-app"'],
  ["app.js", "客户使用端"],
  ["app.js", "客户端不会暴露这些入口"],
  ["admin.js", 'document.querySelector("#admin-app")'],
  ["admin.js", "AI 接口配置"],
  ["admin.js", "这是给系统集成或客户服务端调用 SellerCanvas 对外 API 的 Key，不是 OpenAI API Key。"],
  ["admin.js", "请输入管理员密码"],
  ["styles.css", ".auth-shell"],
  ["styles.css", ".main-shell"],
  ["styles.css", "Premium AI workbench visual system"],
  ["styles.css", ".main-shell::before"],
  ["styles.css", ".admin-sidebar-clean"],
  ["styles.css", ".pricing-card.featured"],
];

let failed = false;

for (const file of files) {
  const absolute = path.join(root, file);
  const content = fs.readFileSync(absolute, "utf8");
  const found = mojibakeMarkers.filter((marker) => content.includes(marker));
  if (found.length) {
    failed = true;
    console.error(`[frontend-content] ${file} contains mojibake markers: ${found.join(", ")}`);
  }
}

for (const [file, needle] of required) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (!content.includes(needle)) {
    failed = true;
    console.error(`[frontend-content] ${file} is missing required content: ${needle}`);
  }
}

const appContent = fs.readFileSync(path.join(root, "app.js"), "utf8");
if (appContent.includes("sc_token") || appContent.includes("Authorization")) {
  failed = true;
  console.error("[frontend-content] customer app must use HttpOnly cookie sessions, not localStorage bearer tokens.");
}

if (appContent.includes("platform.safeZone") || appContent.includes("platform.imageSize")) {
  failed = true;
  console.error("[frontend-content] platform specs must use server fields: ratio, size, and rule.");
}

const cssContent = fs.readFileSync(path.join(root, "styles.css"), "utf8");
if (!cssContent.includes("Readability and workflow repair after visual QA")) {
  failed = true;
  console.error("[frontend-content] missing readability repair layer.");
}

if (failed) process.exit(1);
console.log("Frontend content OK");
