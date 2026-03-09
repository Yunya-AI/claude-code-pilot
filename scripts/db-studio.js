/**
 * 根据 DATABASE_URL 选择 schema 并启动 prisma studio
 */
const { execSync } = require("child_process");
const path = require("path");
const schemaPath = require("./db-schema-path.js");

console.log(`[db-studio] 使用 schema: ${schemaPath}`);
execSync(`pnpm prisma studio --schema=${schemaPath}`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
