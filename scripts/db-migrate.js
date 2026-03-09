/**
 * 根据 DATABASE_URL 选择 schema 并执行 prisma migrate dev
 */
const { execSync } = require("child_process");
const path = require("path");
const schemaPath = require("./db-schema-path.js");

console.log(`[db-migrate] 使用 schema: ${schemaPath}`);
const args = process.argv.slice(2).join(" ");
execSync(`pnpm prisma migrate dev --schema=${schemaPath} ${args}`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
