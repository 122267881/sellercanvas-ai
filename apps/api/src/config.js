const DEFAULT_DATABASE_URL = "postgresql://sellercanvas:sellercanvas@localhost:5432/sellercanvas";
const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_PUBLIC_APP_URL = "http://localhost:4173";
const DEFAULT_WORKER_INTERNAL_SECRET = "dev-worker-internal-secret";

const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "REDIS_URL",
  "PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "WORKER_INTERNAL_SECRET",
  "STORAGE_PROVIDER"
];

function readEnv(env, key, fallback = "") {
  const value = env[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "");
}

function assertProductionEnv(env) {
  if (env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !readEnv(env, key));
  if (missing.length) {
    throw new Error(`Missing required production config: ${missing.join(", ")}`);
  }
}

function loadConfig(env = process.env) {
  assertProductionEnv(env);

  const storageProvider = readEnv(env, "STORAGE_PROVIDER", "local");
  const storageBucket = readEnv(env, "STORAGE_BUCKET", "sellercanvas-assets");

  return {
    env: readEnv(env, "NODE_ENV", "development"),
    databaseUrl: readEnv(env, "DATABASE_URL", DEFAULT_DATABASE_URL),
    redisUrl: readEnv(env, "REDIS_URL", DEFAULT_REDIS_URL),
    publicAppUrl: normalizeUrl(readEnv(env, "PUBLIC_APP_URL", DEFAULT_PUBLIC_APP_URL)),
    stripeSecretKey: readEnv(env, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: readEnv(env, "STRIPE_WEBHOOK_SECRET"),
    workerInternalSecret: readEnv(env, "WORKER_INTERNAL_SECRET", DEFAULT_WORKER_INTERNAL_SECRET),
    storage: {
      provider: storageProvider,
      bucket: storageBucket,
      publicBaseUrl: normalizeUrl(readEnv(env, "STORAGE_PUBLIC_BASE_URL")),
      r2: {
        accountId: readEnv(env, "R2_ACCOUNT_ID"),
        accessKeyId: readEnv(env, "R2_ACCESS_KEY_ID"),
        secretAccessKey: readEnv(env, "R2_SECRET_ACCESS_KEY")
      }
    }
  };
}

module.exports = {
  loadConfig
};
