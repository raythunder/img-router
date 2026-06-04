# ImgRouter

> 🎨 智能AI 图像生成网关 — 基于 Deno 构建的高性能 OpenAI 兼容服务，聚合多平台 AI
> 绘图能力，提供智能路由、Key 池管理和完整的可视化运维方案。

[![Deno](https://img.shields.io/badge/Deno-2.x-000000?logo=deno)](https://deno.land/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lianwusuoai/img-router)

## 📖 项目概述

ImgRouter 是一个生产就绪的 AI 图像生成网关服务，旨在将多家 AI 图像服务平台（豆包/火山引擎、Gitee
模力方舟、ModelScope 魔搭、HuggingFace、Pollinations、ApiMart）聚合到统一的 OpenAI
兼容接口，为开发者提供：

### 🎯 核心价值

- **🔌 统一接口**：完全兼容 OpenAI API 规范，支持 `/v1/chat/completions`、`/v1/images/*`
  等标准端点，零成本接入现有生态
- **🚀 智能路由**：
  - **中转模式**：自动识别 API Key 格式（`hf_*`、`ms-*`、UUID 等），智能路由到对应平台
  - **后端模式**：基于权重的级联故障转移，从 Key 池自动选择可用渠道
  - **模型映射**：支持自定义模型 ID 映射，实现统一入口的灵活调度
- **💼 多功能**：
  - Web 管理面板（渠道配置、Key 池管理、提示词优化、实时日志、图片画廊）
  - 本地存储 + S3/R2 兼容对象存储双重持久化
  - 完整的请求链路追踪（RequestId）与日志系统
  - 内置 SSRF 防护与 URL 安全校验
- **⚡ 高性能架构**：
  - 基于 Deno 运行时，原生 TypeScript，零配置部署
  - Docker/Docker Compose 一键启动
  - 支持流式响应（SSE）与异步任务
  - 智能图床上传，Base64 与 URL 格式自动转换

## 特性

- **三种图片生成方式** - 文生图（文字生图）+ 图片编辑（图片+文字生图） +
  融合生图（带上下文进行生图/改图）
- **双模式运行** - 中转模式（Provider Key 透传）/ 后端模式（Global Key + Key 池路由）
- **智能路由** - API Key 格式识别 + 权重级联路由 + 模型映射（modelMap）
- **多渠道支持** -
  豆包（火山引擎）、Gitee（模力方舟）、ModelScope（魔搭）、HuggingFace、Pollinations、ApiMart
- **OpenAI 完全兼容** - 支持
  `/v1/chat/completions`、`/v1/images/generations`、`/v1/images/edits`、`/v1/images/blend`、`/v1/models`
- **流式响应** - Chat Completions 支持 `stream=true`（SSE）；管理端支持 `/api/logs/stream`（SSE）
- **图片落盘与画廊** - 自动保存生成结果到 `data/storage/`，并提供 `/storage/*` 与 `/api/gallery`
- **图床上传** - 在需要 URL 的场景下可将 Base64 上传到图床（由 `imageBed`
  配置驱动），默认自带图床，可改
- **安全防护** - 内置 URL 安全校验与 SSRF 防护策略
- **详细日志** - 请求/响应全链路日志（含 RequestId），并提供实时日志流订阅

## 🏗️ 架构设计

![架构设计](docs/介绍/架构设计.png)

### WebUi

![仪表盘](docs/介绍/仪表盘.jpg) ![系统设置](docs/介绍/系统设置.jpg)
![渠道设置](docs/介绍/渠道设置.jpg) ![key池管理](docs/介绍/key池管理.jpg)
![图片画廊](docs/介绍/图片画廊.jpg) ![提示词优化器](docs/介绍/提示词优化器.jpg)
![检查更新](docs/介绍/检查更新.jpg)

### 🔑 API Key 自动识别规则（中转模式）

| Key 格式         | 识别规则               | Provider           | 示例                |
| ---------------- | ---------------------- | ------------------ | ------------------- |
| **HuggingFace**  | `hf_` 开头             | HuggingFace 抱抱脸 | `hf_xxxxx...`       |
| **ModelScope**   | `ms-` 开头             | ModelScope 魔搭    | `ms-xxxxx...`       |
| **Pollinations** | `pk_*` 或 `sk_*` 开头  | Pollinations       | `pk_xxxxx...`       |
| **Doubao**       | UUID 格式 (8-4-4-4-12) | 火山引擎/豆包      | `12345678-1234-...` |
| **Gitee**        | 30-60 位字母数字       | 模力方舟           | `abcd1234efgh...`   |
| **ApiMart**      | 不做裸 Key 自动识别    | ApiMart            | 通过后端 Key 池配置 |

### 运行模式说明

- **中转模式（Relay）**：客户端直接携带 Provider Key，系统根据 Key 格式识别渠道并透传请求。
- **后端模式（Backend）**：客户端携带系统 GlobalAccessKey；系统根据模型/任务类型生成执行计划，并从
  Key 池中选择 Provider Key 执行。

> 默认模式：Relay=开启，Backend=关闭（以实际运行时配置为准）。

### 各渠道数据流（摘要）

| 渠道             | 文生图                         | 图生图/编辑                                | 融合生图                                   | 备注                             |
| ---------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------ | -------------------------------- |
| **Doubao**       | JSON(prompt) → URL/b64_json    | JSON(images) → URL/b64_json                | JSON(messages/images) → URL/b64_json       | 内置尺寸校验与自动修正           |
| **Gitee**        | JSON(prompt) → b64_json        | FormData/JSON → b64_json                   | 复用编辑模型 → b64_json                    | 强制 b64_json（策略约束）        |
| **ModelScope**   | JSON → 异步轮询 → URL/b64_json | JSON → 异步轮询 → URL/b64_json             | JSON → 异步轮询 → URL/b64_json             | 原生多为单张，通过并发模拟多张   |
| **HuggingFace**  | Space API → URL/b64_json       | Space API → URL/b64_json                   | Space API → URL/b64_json                   | 支持 HF 模型映射到不同 Space     |
| **Pollinations** | GET/参数 → 图片流 → b64_json   | GET/参数（需要 URL）                       | GET/参数                                   | Base64 输入会先上传图床换短 URL  |
| **ApiMart**      | JSON → 异步轮询 → URL/b64_json | JSON(image_urls) → 异步轮询 → URL/b64_json | JSON(image_urls) → 异步轮询 → URL/b64_json | `gpt-image-2`，支持 `resolution` |

## 核心功能

### 1) 功能模块

- **OpenAI 兼容 API**：对外统一提供 `/v1/*` 标准接口。
- **管理 API**：对内提供配置、Key 池、日志、画廊、更新检查等接口（`/api/*`）。
- **Web 管理面板**：SPA
  路由（`/admin`、`/setting`、`/channel`、`/keys`、`/pic`、`/prompt-optimizer`、`/update`）。
- **本地存储与画廊**：自动保存生成结果（不阻塞主响应），支持列表与删除。

### 2) 技术实现亮点

- **权重级联路由**：根据 `providers.{name}.{task}.weight` 生成执行序列，并在失败时自动尝试下一渠道。
- **模型映射（modelMap）**：可将“自定义模型 ID”映射到指定渠道的真实模型，实现统一入口与灵活调度。
- **运行时配置热更新**：运行时配置写入 `data/runtime-config.json`，管理面板调用
  `/api/runtime-config` 生效。
- **图床上传与 SSRF 防护**：当上游需要 URL 且输入为 Base64 时，自动上传图床并做 URL 安全校验。

### 3) 性能指标与基准测试

当前版本未内置固定的基准测试脚本与官方基准数据（避免文档与环境差异导致误导）。推荐使用以下方式获取真实数据：

- **接口维度**：结合请求日志与 RequestId 统计 P50/P95 延迟、错误率。
- **Key 池维度**：调用 `/api/dashboard/stats` 获取各 Provider 的 Key 池成功率与调用量聚合。
- **容量维度**：服务端请求体大小上限默认 `20MB`，超时默认 `60s`（可配置）。

## 部署指南

### 环境要求与依赖项

- Docker 20.10+
- Docker Compose 2.0+
- 默认端口：`10001`

### 📦 Docker 镜像仓库

ImgRouter 提供预构建的 Docker 镜像，支持多平台（linux/amd64、linux/arm64）：

#### 🌏 国内用户（推荐使用阿里云镜像）

```bash
# 拉取最新版本
docker pull crpi-yfnrhqcn81ace83g.cn-beijing.personal.cr.aliyuncs.com/lianwusuoai/img-router:latest
# 拉取指定版本
docker pull crpi-yfnrhqcn81ace83g.cn-beijing.personal.cr.aliyuncs.com/lianwusuoai/img-router:1.9.0
```

#### 🌍 国外用户（使用 Docker Hub）

```bash
# 拉取最新版本
docker pull lianwusuoai/img-router:latest
# 拉取指定版本
docker pull lianwusuoai/img-router:1.9.0
```

**可用标签**：

- `latest` - 最新稳定版本
- `main` - 主分支最新构建
- `x.y.z` - 特定版本号（如 1.9.0）

### 分步部署流程

#### 方式一：使用 Docker Compose（推荐）

```bash
git clone https://github.com/lianwusuoai/img-router.git
cd img-router
docker-compose up -d
```

#### 方式二：直接使用 Docker 运行

**国内用户**：

```bash
docker run -d \
--name img-router \
-p 10001:10001 \
-v $(pwd)/data:/app/data \
crpi-yfnrhqcn81ace83g.cn-beijing.personal.cr.aliyuncs.com/lianwusuoai/img-router:latest
```

**国外用户**：

```bash
docker run -d \
--name img-router \
-p 10001:10001 \
-v $(pwd)/data:/app/data \
lianwusuoai/img-router:latest
```

访问管理面板：`http://localhost:10001/admin`

### 配置参数说明

配置来源优先级：**环境变量 > 运行时配置（data/runtime-config.json）> 默认配置**。

可复制 `.env.example` 为 `.env`，用于 Docker Compose 环境变量插值；本地 Deno 启动可使用
`deno task start:env` 或 `deno task dev:env` 自动加载 `.env`。

**常用环境变量**（与实现保持一致）：

- `PORT`：服务端口（默认 10001）
- `API_TIMEOUT_MS`：上游请求超时（默认 60000）
- `LOG_LEVEL`：日志等级（默认 info）
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：管理端登录账号和密码；两者同时非空时启用管理页登录保护
- `DOUBAO_DEFAULT_COUNT`：Doubao 默认生成张数（默认 1）
- `PROMPT_OPTIMIZER_BASE_URL` / `PROMPT_OPTIMIZER_API_KEY` /
  `PROMPT_OPTIMIZER_MODEL`：提示词优化器（OpenAI 兼容）
- `IMAGE_BED_BASE_URL` / `IMAGE_BED_AUTH_CODE` / `IMAGE_BED_UPLOAD_FOLDER` /
  `IMAGE_BED_UPLOAD_CHANNEL`：图床上传（若启用）

**运行时配置文件**：`data/runtime-config.json`

- `system.globalAccessKey`：全局访问密钥（后端模式鉴权）
- `system.modes.relay / system.modes.backend`：运行模式开关
- `providers.{Provider}.enabled`：Provider 启用/禁用
- `providers.{Provider}.{task}`：任务默认值与路由权重（task ∈ text/edit/blend）
- `providers.ApiMart.{task}.resolution`：ApiMart 输出分辨率档位（`1k` / `2k` / `4k`）
- `promptOptimizer`：提示词优化器配置
- `hfModelMap`：HuggingFace 模型 → Space URL 映射
- `storage.s3`：S3/R2 兼容存储配置（endpoint/bucket/accessKey/secretKey/region/publicUrl）

**管理登录与 API 鉴权**：

- 管理登录由 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 控制，只保护 Web 管理页和管理 API。
- `system.globalAccessKey` 只用于后端模式下保护 OpenAI 兼容生图接口。
- `/v1/images/*` 和 `/v1/chat/completions` 不要求管理登录 Cookie，仍按 `Global Access Key` 或
  Provider Key 访问。

## 使用说明

### API 接口文档（对外）

#### 1) Chat Completions（推荐）

```
POST /v1/chat/completions
```

- 用于“对话式生图”（返回内容为 Markdown 图片链接，可能是 URL 或 data URI）
- 支持 `stream=true`（SSE）

示例：

```bash
curl -X POST http://localhost:10001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的Key>" \
  -d '{
    "model": "auto",
    "messages": [{"role":"user","content":"一只赛博朋克猫"}],
    "stream": false
  }'
```

#### 2) Images Generations（OpenAI 标准）

```
POST /v1/images/generations
```

- `response_format`：
  - `url`（默认）：可能返回上游 URL；当上游返回 Base64 时，会以 data URI 形式放入 `url` 字段
  - `b64_json`：尽量返回 Base64（若 URL 转换失败会回退为 URL）

示例：

```bash
curl -X POST http://localhost:10001/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的Key>" \
  -d '{
    "prompt": "A futuristic city skyline at night",
    "model": "auto",
    "n": 1,
    "size": "1024x1024",
    "response_format": "b64_json"
  }'
```

#### 3) Images Edits（图片编辑）

```
POST /v1/images/edits
```

支持 `multipart/form-data` 与 JSON 两种输入形态。

#### 4) Images Blend（多图融合）

```
POST /v1/images/blend
```

用于多图融合生成，返回格式与 Images API 一致。

#### 5) Models（模型列表）

```
GET /v1/models
```

聚合当前启用 Provider 的模型列表。

### 管理面板与管理 API（对内）

- 管理面板（SPA）：`/admin`、`/setting`、`/channel`、`/keys`、`/pic`、`/prompt-optimizer`、`/update`
- 健康检查：`GET /health`（受配置 `healthCheck` 开关影响）
- 系统信息：`GET /api/info`
- 配置快照：`GET /api/config`
- 运行时配置：`GET/POST /api/runtime-config`
- Key 池管理：`GET/POST /api/key-pool?provider=<Provider>`
- 仪表盘统计：`GET /api/dashboard/stats`
- 实时日志：`GET /api/logs/stream?level=INFO`
- 画廊：`GET/DELETE /api/gallery`；图片访问：`/storage/<filename>`
- 更新检查：`GET /api/update/check`
- HF 映射：`GET/POST /api/config/hf-map`

## 开发

```bash
# 开发模式（监听文件变化）
deno task dev

# 生产启动
deno task start
```

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lianwusuoai/img-router&type=Date)](https://star-history.com/#lianwusuoai/img-router&Date)
