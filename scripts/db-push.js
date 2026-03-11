/**
 * 根据 DATABASE_URL 选择 schema 并执行 prisma db push
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const schemaPath = require("./db-schema-path.js");

// 读取 .env 并注入到子进程环境（Prisma CLI 需要 DATABASE_URL）
const envPath = path.join(__dirname, "..", ".env");
const extraEnv = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      extraEnv[key] = val;
    }
  }
}

console.log(`[db-push] 使用 schema: ${schemaPath}`);
execSync(`pnpm prisma db push --schema=${schemaPath}`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, ...extraEnv },
});
