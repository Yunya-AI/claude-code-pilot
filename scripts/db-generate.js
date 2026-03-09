/**
 * 根据 DATABASE_URL 自动选择 SQLite 或 MySQL schema 并生成 Prisma Client
 * - file: 开头 -> SQLite（默认部署模式）
 * - mysql: 开头 -> MySQL
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const schemaPath = require("./db-schema-path.js");

if (!fs.existsSync(schemaPath)) {
  console.error(`[db-generate] 未找到 schema: ${schemaPath}`);
  process.exit(1);
}

const isSqlite = schemaPath.includes("sqlite");
console.log(`[db-generate] 使用 ${isSqlite ? "SQLite" : "MySQL"} schema`);
execSync(`pnpm prisma generate --schema=${schemaPath}`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
