# Jacory Space Media Backend

用于配合 `jacory-space-frontend` 的媒体解析/下载后端。

## 功能

- `POST /api/parse`: 兼容视频解析入口，返回可选分辨率
- `POST /api/video/parse`: 视频解析入口
- `POST /api/podcast/parse`: 播客解析入口骨架
- `POST /api/download`: 选择分辨率下载
- `GET/POST/DELETE /api/cookies`: 管理不同平台 cookies
- `GET/POST /api/settings`: 默认下载目录配置
- `POST /api/folder-dialog`: 打开系统原生文件夹选择窗口（macOS）

## 多用户说明

- 服务通过请求头 `x-client-id` 区分用户数据（前端已自动生成并携带，无需登录）。
- 每个用户的 cookies 和设置会保存到独立目录，刷新页面不会丢失。
- 下载目录支持：
  - 默认目录（持久化）
  - 本次下载目录（单次覆盖）

## 运行前准备

1. 安装 Python 3.11+
2. 安装 `yt-dlp`
3. 建议安装 `ffmpeg`（用于音视频合并）

macOS（Homebrew）示例：

```bash
brew install yt-dlp ffmpeg
```

## 启动

```bash
cd jacory-space-backend/media-backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run dev
```

默认监听 `http://localhost:5001`。

## 下载目录

下载文件保存到：

- `jacory-space-backend/media-backend/downloads/`

## 说明

请确保你下载的内容符合平台服务条款与版权要求，仅用于你有权使用的内容。
