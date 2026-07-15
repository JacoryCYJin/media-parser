# Jacory Space Media Core

用于配合 Media Parser 桌面端的本地媒体解析、下载、转写和结构化内容生成服务。

## 功能

- `POST /api/parse`: 兼容视频解析入口，返回可选分辨率
- `POST /api/video/parse`: 视频解析入口
- `POST /api/podcast/parse`: 播客解析入口骨架
- `POST /api/download`: 选择分辨率下载
- `GET/POST/DELETE /api/cookies`: 管理不同平台 cookies
- `GET/POST /api/settings`: 默认下载目录配置
- `POST /api/folder-dialog`: 打开系统原生文件夹选择窗口（macOS）

## 本地数据说明

- 服务通过请求头 `x-client-id` 区分本地数据空间（桌面端已自动生成并携带，无需登录）。
- Cookies 和设置会保存到本地数据目录，刷新页面或重启桌面端后仍可继续使用。
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
cd media-parser/services/media-core
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run dev
```

默认监听 `http://localhost:5011`。

## 下载目录

下载文件保存到：

- `services/media-core/downloads/`

桌面打包版本会把 media-core 运行数据写入 Electron `app.getPath("userData")` 下的 `media-core/` 目录。

## 说明

请确保你下载的内容符合平台服务条款与版权要求，仅用于你有权使用的内容。
