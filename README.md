# Moon Chat

这是一个**前后端一体化的 Cloudflare Worker 聊天系统**，功能包括：

* Material 3 风格 UI
* 多房间系统（通过 `?room=xxx` 切换房间）
* KV 保存聊天记录
* 单 PIN 登录（通过环境变量 `PASSWORD` 设置）
* AI 流式回答（整合 Cloudflare AI）

## 目录结构

```
project/
 ├─ worker.js       ← 主 Worker 代码（前后端合一）
 └─ wrangler.toml   ← Wrangler 配置文件
```

> 所有前端 HTML 和 JS 都在 `worker.js` 内，无需额外文件。

## 快速部署指南

### 1. 创建 KV Namespace

1. 打开 Cloudflare Dashboard → Workers → KV → Create Namespace
2. 命名，例如：`CHAT_HISTORY`
3. 创建成功后记下 **Namespace ID**（例如 `33810fe7e394400a9a9a28d3a4419888`）

### 2. 配置 Wrangler

在 `wrangler.toml` 中添加：

```toml
name = "chat-app"
main = "worker.js"
compatibility_date = "2025-11-15"

kv_namespaces = [
  { binding = "CHAT_HISTORY", id = "33810fe7e394400a9a9a28d3a4419888" }
]

[vars]
PASSWORD = "1839"
```

> `PASSWORD` 可以修改为你自己的 4 位 PIN

### 3. 部署 Worker

在项目根目录执行：

```bash
npx wrangler deploy
```

部署成功后，你会获得一个 Worker URL，例如：

```
https://chat-app.your-subdomain.workers.dev/?room=lobby
```

### 4. 使用方法

1. 打开 Worker URL，输入 PIN 登录
2. 默认房间是 `lobby`，可以通过 `?room=房间名` 切换房间
3. 输入消息发送，或者点击 AI 按钮向 AI 提问
4. 所有消息会存储在 KV，刷新页面也能看到历史

### 5. 支持功能

* **多房间**：`https://your-worker/?room=tech`
* **AI 回复**：消息输入 `/ask 你的问题` 或点击 AI 按钮
* **聊天历史**：自动保存在 KV，每个房间独立
* **PIN 登录**：通过 `PASSWORD` 环境变量设置

### 6. 注意事项

* KV 单 key 最大 10MB，总存储免费额度约 1GB
* KV 适合存文本、JSON 或小型 Base64 文件
* 大文件或视频请使用 Cloudflare R2 对象存储
* Worker 前端和后端都在 `worker.js`，不需要额外 HTML/CSS/JS 文件

### 7. 可选扩展

* 暗色模式 Material 3 UI
* 消息自毁功能
* Markdown 渲染
* 每房间独立 AI 小助手
* PIN 输入错误次数限制

---

此项目适合**快速搭建 Cloudflare 聊天系统**，并可通过 KV 和 AI 扩展更多功能。
