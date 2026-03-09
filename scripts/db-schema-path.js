/**
 * 根据 DATABASE_URL 返回对应的 Prisma schema 路径
 * 供 db-generate、db-push 等脚本使用
 */
const path = require("path");
const fs = require("fs");

const prismaDir = path.join(__dirname, "..", "prisma");
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
// .env 优先（本地开发），process.env 用于部署覆盖
const url = env.DATABASE_URL || process.env.DATABASE_URL || "";
// 默认 SQLite：空或 file: 开头
const isSqlite = !url || url.startsWith("file:");
const schemaFile = isSqlite ? "schema.sqlite.prisma" : "schema.mysql.prisma";

module.exports = path.join(prismaDir, schemaFile);
