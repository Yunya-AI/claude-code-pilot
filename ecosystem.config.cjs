/**
 * PM2 生产环境配置
 * 使用: pnpm build && pm2 start ecosystem.config.cjs
 * 端口可通过环境变量 PORT、SOCKET_PORT 覆盖
 */
const PORT = process.env.PORT || 3040;
const SOCKET_PORT = process.env.SOCKET_PORT || 3041;

module.exports = {
  apps: [
    {
      name: "next",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: "production", PORT, SOCKET_PORT },
    },
    {
      name: "socket",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "socket/server.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: "production", PORT, SOCKET_PORT },
    },
  ],
};
