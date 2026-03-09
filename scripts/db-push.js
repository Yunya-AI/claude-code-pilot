/**
 * 根据 DATABASE_URL 选择 schema 并执行 prisma db push
 */
const { execSync } = require("child_process");
const path = require("path");
const schemaPath = require("./db-schema-path.js");

console.log(`[db-push] 使用 schema: ${schemaPath}`);
execSync(`pnpm prisma db push --schema=${schemaPath}`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
