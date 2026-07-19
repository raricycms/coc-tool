# Coc-tools

在线 CoC 7e（《克苏鲁的呼唤》第七版）跑团工具，覆盖从调查员建卡、招募与报名，到实时跑团、判定和结算的完整流程。

> 当前版本为 `0.1.0` MVP。开发环境使用 SQLite；规划中的生产部署以 PostgreSQL 为目标。

## 功能概览

- **账号与认证**：本地注册/登录、图形验证码、HttpOnly Cookie 会话，以及可选的 raricy OAuth 登录
- **调查员管理**：基础属性、派生属性、技能、武器、装备、背景和退役状态
- **招募流程**：KP 发布招募，PL 使用调查员报名，KP 审核并开团
- **实时跑团**：OOC/IC 频道、在线状态、团内日志、HP 变更和游戏内时钟
- **CoC 判定**：普通/困难/极难判定、奖励骰与惩罚骰、SAN 检定、服务端权威掷骰
- **团后结算**：SAN 恢复、神话知识、技能成长、调查员退役与结算完成状态

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web | Next.js 15、React 19、Tailwind CSS |
| 实时服务 | Fastify、Socket.IO |
| 数据与校验 | Prisma、SQLite（开发）、Zod |
| 规则引擎 | TypeScript 纯函数包 |
| 认证 | JWT（HttpOnly Cookie）、raricy OAuth、本地账号 |
| 测试 | Vitest |

## 仓库结构

```text
.
├── apps/
│   ├── web/             # Next.js 页面、组件和 Route Handlers
│   └── realtime/        # Fastify + Socket.IO 实时服务
├── packages/
│   ├── coc-rules/       # CoC 属性、骰点、判定和技能成长规则
│   ├── db/              # Prisma schema 与客户端
│   └── shared/          # 前后端共享事件类型和 Zod schemas
├── docs/
│   ├── oauth.md         # raricy OAuth 协议说明
│   └── plan/            # 产品、架构和实现规划
├── .env.example
└── package.json         # npm workspaces 根配置
```

## 本地开发

### 环境要求

- Node.js `20` 或更高版本
- npm（依赖锁文件为 `package-lock.json`）

### 1. 安装依赖

```bash
git clone git@github.com:raricycms/coc-tool.git
cd coc-tool
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

至少应将 `SESSION_SECRET` 改成强随机值。开发时可用以下命令生成：

```bash
openssl rand -hex 32
```

项目不会自动读取根目录的 `.env`；在 Bash/Zsh 中启动命令前，将变量导入当前终端：

```bash
set -a
source .env
set +a
```

默认地址：

- Web：<http://localhost:7766>
- Realtime：<http://localhost:4000>
- Realtime 健康检查：<http://localhost:4000/health>

raricy OAuth 在本地开发中是可选的。留空 `RARICY_OAUTH_CLIENT_ID` 和 `RARICY_OAUTH_CLIENT_SECRET` 时，仍可使用本地账号注册与登录；需要 OAuth 时再填写 raricy 应用凭据。

### 3. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

默认的 `DATABASE_URL="file:./dev.db"` 会在 `packages/db/prisma/` 下创建本地 SQLite 数据库。数据库文件已被 Git 忽略。

### 4. 启动服务

建议使用两个终端，并在每个终端中先导入 `.env`。

终端一：

```bash
set -a; source .env; set +a
npm run dev:web
```

终端二：

```bash
set -a; source .env; set +a
npm run dev:realtime
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev:web` | 启动 Next.js 开发服务器（端口 7766） |
| `npm run dev:realtime` | 启动 Socket.IO 实时服务（默认端口 4000） |
| `npm run build` | 构建所有提供 build 脚本的 workspace |
| `npm test` | 运行所有提供 test 脚本的 workspace |
| `npm run test:coc` | 仅运行 CoC 规则包测试 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 将 Prisma schema 同步到开发数据库 |
| `npm run db:migrate` | 创建并应用开发迁移 |
| `npm run db:studio` | 打开 Prisma Studio |

## 文档

- [部署指南](docs/deployment.md)
- [项目总览与术语](docs/plan/00-README.md)
- [技术栈与决策](docs/plan/01-tech-stack.md)
- [系统架构](docs/plan/02-architecture.md)
- [数据库设计](docs/plan/03-database-schema.md)
- [认证设计](docs/plan/04-auth.md)
- [raricy OAuth 说明](docs/oauth.md)
- [实施阶段](docs/plan/10-implementation-phases.md)

## 安全提示

- 不要提交 `.env`、OAuth client secret、生产数据库 URL 或本地 SQLite 数据库。
- 部署前务必替换示例 `SESSION_SECRET`，并通过 HTTPS 提供 Web 与 WebSocket 服务。
- 当前验证码和限频状态存储在单进程内存中；多实例生产部署前应迁移到 Redis 等共享存储。
