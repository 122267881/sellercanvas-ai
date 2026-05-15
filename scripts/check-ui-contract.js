const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function collectActions(content) {
  return unique([...content.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]));
}

function collectHandledActions(content) {
  return unique([...content.matchAll(/action === "([^"]+)"/g)].map((match) => match[1]));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[ui-contract] ${message}`);
    failed = true;
  }
}

let failed = false;

const app = read("app.js");
const admin = read("admin.js");
const css = read("styles.css");
const index = read("index.html");
const adminHtml = read("admin.html");

for (const [name, content] of [
  ["app.js", app],
  ["admin.js", admin],
]) {
  const rendered = collectActions(content);
  const handled = collectHandledActions(content);
  const missing = rendered.filter((action) => !handled.includes(action));
  assert(!missing.length, `${name} renders unhandled actions: ${missing.join(", ")}`);
}

assert(index.includes('id="app"'), "index.html must mount the customer app.");
assert(adminHtml.includes('id="admin-app"'), "admin.html must mount the developer admin app.");
assert(app.includes("customer-main"), "customer app must use an isolated customer layout shell.");
assert(admin.includes("admin-main-shell"), "admin app must use an isolated admin layout shell.");
assert(app.includes("data-upload"), "customer upload flow must be rendered.");
assert(app.includes("event.target.closest(\"[data-upload]\")"), "customer upload flow must have a submit handler.");
assert(app.includes("data-auth-tab"), "customer auth tabs must be rendered.");
assert(app.includes("data-plan"), "customer billing plans must be selectable.");
assert(admin.includes("#provider-form"), "admin provider configuration form must be rendered.");
assert(admin.includes("data-filter"), "admin list filters must be rendered.");
assert(admin.includes("#admin-login"), "admin login form must be rendered.");
assert(css.includes("Layout stabilization QA layer"), "CSS must include the layout stabilization layer.");
assert(css.includes(".customer-main .two-column"), "customer workflow grid must have customer-specific rules.");
assert(css.includes(".admin-main-shell .row-card.admin-row"), "admin data rows must have admin-specific rules.");

if (failed) process.exit(1);
console.log("UI contract OK");
