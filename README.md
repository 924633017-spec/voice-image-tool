## 图述

把一张图片、一段本人录音和实时字幕，收成一张可以直接分享的作品卡。

## 本地开发

1. 复制环境变量模板

```bash
cp .env.example .env
```

2. 把 `.env` 里的数据库地址改成你自己的本地或云端 Postgres

推荐开发也直接使用 Neon / Postgres，避免后面从 SQLite 再迁移一次。

3. 安装依赖并初始化数据库

```bash
npm install
npx prisma migrate dev
```

4. 启动开发环境

```bash
npm run dev
```

默认访问 [http://127.0.0.1:3001](http://127.0.0.1:3001)。

## 部署前必须配置

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST=true`
- `NEXT_PUBLIC_SITE_URL`

如果要正式分享作品链接和二维码，`NEXT_PUBLIC_SITE_URL` 必须是外部可访问的正式域名。

## 文件存储

- 开发环境：默认允许写入 `public/uploads`
- 生产环境：建议接入阿里云 OSS
- 如果生产环境不想使用本地磁盘，请不要开启 `ALLOW_LOCAL_UPLOADS`

需要配置：

- `OSS_ENDPOINT`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- 可选：`OSS_PUBLIC_URL`

## 字幕识别

当前默认使用阿里云语音识别：

- `ALIYUN_SPEECH_APP_KEY`
- `ALIYUN_SPEECH_ACCESS_KEY_ID`
- `ALIYUN_SPEECH_ACCESS_KEY_SECRET`

如果未配置，录音仍可保存，但服务端精细字幕识别不可用。

## 上线检查

```bash
npm run lint
npm run build
npm run deploy:check
```

## 推荐部署栈

- 前端：Vercel
- 数据库：Neon Postgres
- 文件：阿里云 OSS
- 语音识别：阿里云语音服务

## Vercel 部署变量

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST=true`
- `NEXT_PUBLIC_SITE_URL`
- `ALLOW_LOCAL_UPLOADS=false`
- `OSS_ENDPOINT`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_PUBLIC_URL` 可选
- `ALIYUN_SPEECH_APP_KEY`
- `ALIYUN_SPEECH_ACCESS_KEY_ID`
- `ALIYUN_SPEECH_ACCESS_KEY_SECRET`

## 数据库发布命令

首次上线前需要在正式数据库执行：

```bash
npm run db:migrate:deploy
```

如果 Vercel 负责构建，安装依赖时会自动执行：

```bash
npm run db:generate
```

## 部署自检接口

部署后可以直接访问：

```bash
/api/health
```

它会返回：

- 数据库环境变量是否齐全
- OSS 是否已接好
- 语音识别是否已接好
- 当前分享域名是否还是本地地址
- 当前项目是否还有正式上线阻塞项

## 🆓 零成本部署指南

使用以下三个免费服务，一分钱不花即可上线：

| 服务 | 免费额度 | 用途 |
|------|----------|------|
| Vercel (Hobby) | 无限部署 / 100 GB 带宽 | 托管 Next.js |
| Neon (Free) | 0.5 GB PostgreSQL | 数据库 |
| Cloudflare R2 | 10 GB 存储 / 无出口费 | 图片 & 音频文件 |
| 浏览器语音识别 | 免费 | 录音 + 实时字幕 |

### 第一步：注册账号

1. [github.com](https://github.com) — 把项目推到 GitHub（Vercel 从 GitHub 导入）
2. [vercel.com](https://vercel.com) — 用 GitHub 登录
3. [neon.tech](https://neon.tech) — 用 GitHub 登录
4. [cloudflare.com](https://dash.cloudflare.com) — 注册 Cloudflare 账号

### 第二步：Neon 创建数据库（1 分钟）

1. 进入 [Neon Console](https://console.neon.tech)
2. 点击 **"Create project"**
3. 记下给你生成的连接字符串，类似：
   ```
   postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
   ```
4. 你会用到 **两个** 地址：
   - `DATABASE_URL` → 用普通连接地址（支持连接池）
   - `DIRECT_URL` → 用同一地址去掉 `-pooler`（Prisma migrate 需要直连）

### 第三步：Cloudflare R2 创建存储桶（2 分钟）

1. 进入 [R2 控制台](https://dash.cloudflare.com/?to=/:account/r2)
2. 点击 **"Create bucket"**，名称随意，比如 `voice-image-tool`
3. 创建后进入 **"Manage R2 API Tokens"** → **"Create API token"**
4. 权限选 **"Object Read & Write"**，指定刚刚创建的 bucket
5. 记下：
   - `Access Key ID`
   - `Secret Access Key`
   - Endpoint: `https://<account-id>.r2.cloudflarestorage.com`（在 R2 概览页能看到）
6. **重要**：如需公开访问文件，在 bucket 设置里绑定一个自定义域名，或用 `r2.dev` 域名（在 bucket → Settings → Public access 开启）

### 第四步：部署到 Vercel（2 分钟）

1. 把项目推到 GitHub 仓库
2. 打开 [Vercel](https://vercel.com) → **"New Project"** → 导入你的 GitHub 仓库
3. **Framework** 自动识别为 Next.js，无需修改
4. 展开 **"Environment Variables"**，填入：

```
DATABASE_URL          = postgresql://...（Neon 连接池地址）
DIRECT_URL            = postgresql://...（Neon 直连地址）
AUTH_SECRET           = （运行 openssl rand -hex 32 生成一个）
AUTH_URL              = https://你的域名.vercel.app
AUTH_TRUST_HOST       = true
NEXT_PUBLIC_SITE_URL  = https://你的域名.vercel.app
S3_ENDPOINT           = https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET             = voice-image-tool
S3_REGION             = auto
S3_ACCESS_KEY_ID      = （R2 的 Access Key ID）
S3_ACCESS_KEY_SECRET  = （R2 的 Secret Access Key）
S3_PUBLIC_URL         = （你的 R2 公开访问域名，如 https://xxx.r2.dev）
```

5. 点击 **"Deploy"**

6. 部署完成后，执行数据库迁移：
   ```bash
   # 在你本地项目目录执行，会自动读取 Vercel 上的 DATABASE_URL
   npx prisma migrate deploy
   ```
   或者更方便：在 Vercel 项目设置里把 `DATABASE_URL` 和 `DIRECT_URL` 填好后，用 Neon 的 SQL Editor 直接执行迁移 SQL。

### 第五步：验证

部署完成后访问：
- 首页：`https://你的域名.vercel.app`
- 健康检查：`https://你的域名.vercel.app/api/health`

### 语音识别说明

- **浏览器语音识别**（免费）：编辑器里录音时，浏览器会自动把你说的话转成字幕。支持 Chrome、Edge、Safari。
- **阿里云语音识别**（付费）：如果想用服务端精细识别，才需要配 `ALIYUN_SPEECH_*` 变量。免费部署可跳过。

### 本地开发用 R2

如果本地开发也想用 R2 而不是本地磁盘，把上面的 `S3_*` 变量填到 `.env` 里即可。`saveToS3` 会自动接管上传。

## 推荐部署顺序（付费版）

1. 先配置正式域名和 `NEXT_PUBLIC_SITE_URL`
2. 再接 Neon Postgres
3. 再接 OSS
4. 再配置语音识别
5. 执行 `npm run db:migrate:deploy`
6. 最后跑 `build` 并正式发布
