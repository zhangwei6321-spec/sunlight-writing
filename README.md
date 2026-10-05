# 日光写作 · AI 网文创作网站

一个纯前端 + 轻量本地服务的 AI 网文创作工具箱，包含：

- **AI 短篇**（`ai-short.html`）：选创作指令 → 输入故事想法 → 生成短篇/长篇，卡片式展示 + 右侧正文预览
- **创意工具箱**（`tools.html`）：13 个创作工具（脑洞生成、书名、人物、大纲、文案等），真实 AI 产出
- **书架**（`bookshelf.html` / `chapter.html`）：书籍与章节管理，双层持久化（localStorage + 服务端 JSON）
- **设置**（`settings.html`）：配置 AI 接口（apiBase / apiKey / model），自动保存

## 本地运行

```bash
python3 serve-daemon.py
```

默认地址 `http://127.0.0.1:8666`。也可以 `python3 -m http.server 8666` 快速预览，但 `/api/data` 持久化接口不可用。

## AI 接口配置

源码默认 `apiKey` 为占位符 `YOUR_API_KEY`。首次使用打开右上角「设置」页填写真实 Key（优先级高于源码）。默认对接智谱 GLM（`https://open.bigmodel.cn/api/paas/v4`，模型 `glm-4-flash`），也支持任意 OpenAI 兼容接口。

## 目录结构

- `*.html`：各功能页
- `assets/ai-short-prompts.js`：创作指令（提示词）库
- `assets/data.js`：书架数据持久化
- `assets/library-gen.js`：灵感库生成
- `theme.css`：全局样式
- `serve-daemon.py`：本地文件服务器（`/api/data` 读写、`/api/save-share` 分享页生成）

## 说明

- 运行数据（`data/`）、生成分享（`shares/`）、上传素材（`assets/uploads/`）等运行产物不纳入版本管理，详见 `.gitignore`。
- 纯前端项目，无构建步骤，无需 npm 依赖。
