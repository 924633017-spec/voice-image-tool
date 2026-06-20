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

只需两个免费服务，不需要绑卡：

| 服务 | 免费额度 | 用途 |
|------|----------|------|
| Vercel (Hobby) | 无限部署 + 1 GB Blob 存储 | 托管 + 文件存储 |
| Neon (Free) | 0.5 GB PostgreSQL | 数据库 |
| 浏览器语音识别 | 免费 | 录音 + 实时字幕 |

### 第一步：Neon 创建数据库

1. 打开 [neon.tech](https://neon.tech)，用 GitHub 登录
2. 创建项目，拿到连接字符串，类似：
   ```
   postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
   ```
3. 记下两个地址：
   - `DATABASE_URL` → 用连接池地址（带 `-pooler`）
   - `DIRECT_URL` → 用直连地址

### 第二步：部署到 Vercel

1. 把项目推到 GitHub
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
3. **"New Project"** → 导入你的仓库
4. 展开 **Environment Variables**，填入：

```
DATABASE_URL            = postgresql://...（Neon 连接池地址）
DIRECT_URL              = postgresql://...（Neon 直连地址）
AUTH_SECRET             = （运行 openssl rand -hex 32 生成）
AUTH_URL                = https://你的项目名.vercel.app
AUTH_TRUST_HOST         = true
NEXT_PUBLIC_SITE_URL    = https://你的项目名.vercel.app
BLOB_READ_WRITE_TOKEN   = （稍后在第三步获取）
```

5. 先不要点 Deploy，先去做第三步拿 Blob token

### 第三步：获取 Vercel Blob Token

1. 回到 Vercel 项目页面，点顶部 **"Storage"** 标签
2. 点 **"Create Database"** → 选 **"Blob"**
3. 创建后会自动生成 `BLOB_READ_WRITE_TOKEN` 环境变量
4. 把这个 token 填到上一步的环境变量里

### 第四步：发布

1. 环境变量全部填好后，点 **"Deploy"**
2. 部署完成后，执行数据库迁移：
   ```bash
   npx prisma migrate deploy
   ```

### 第五步：验证

- 首页：`https://你的域名.vercel.app`
- 健康检查：`/api/health`

### 语音识别说明

- **浏览器语音识别（免费）**：编辑器录音时自动转字幕。支持 Chrome、Edge、Safari。
- 阿里云语音识别（付费）：配 `ALIYUN_SPEECH_*` 变量可用，免费部署跳过即可。
