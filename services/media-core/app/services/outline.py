import json
import time
import urllib.error
import urllib.request

from app.config import (
    SILICONFLOW_MOCK_OUTLINE,
)
from app.errors import ApiError
from app.services.transcript import evaluate_transcript, transcript_preview
from app.services.user_data import active_model_connection, get_user_settings


def build_outline_prompt(payload: dict) -> str:
    return f"""
## Identity
你是一个视频内容结构化助手，擅长根据视频字幕提取内容层级，并生成适合思维导图展示的视频大纲。

## Task
根据输入的视频标题、平台、时长、输出语言和字幕文本，生成一个严格 JSON 格式的视频大纲。

## Instructions
- 只能根据字幕内容生成，不要编造字幕中没有的信息。
- 节点顺序必须按照字幕内容出现顺序。
- 节点标题要短，适合 UI 展示。
- 字幕内容充足时，一级节点控制在 4 到 6 个。
- 字幕内容充足时，每个一级节点包含 2 到 4 个二级节点。
- 字幕内容不足时，不要为了满足节点数量而编造；代码层会尽量提前拦截无效字幕。
- 不要输出空话、套话或泛泛总结。
- 如果字幕信息不足，请生成保守大纲，并在 summary 中说明信息有限。
- 如果某些信息无法从字幕中判断，不要猜测，使用中性表达。
- 输出语言必须跟随 language 参数。
- 必须只输出 JSON，不要输出 Markdown，不要输出代码块，不要输出解释文字。

## Context
视频标题：
{payload.get("title")}

视频平台：
{payload.get("platform")}

视频时长：
{payload.get("duration")}

输出语言：
{payload.get("language")}

字幕内容：
{payload.get("transcript")}

## Output
请严格输出一个 JSON object，结构如下：

{{
  "title": "视频大纲标题",
  "summary": "一句话概括整个视频",
  "nodes": [
    {{
      "id": "1",
      "title": "一级节点标题",
      "summary": "这一部分的简短概括",
      "children": [
        {{
          "id": "1.1",
          "title": "二级节点标题",
          "summary": "子节点简短说明"
        }}
      ]
    }}
  ]
}}
""".strip()


def extract_json_object(text: str = "") -> dict:
    trimmed = str(text or "").strip()
    if not trimmed:
        raise ValueError("empty model response")
    if trimmed.startswith("```"):
        trimmed = trimmed.strip("`")
        trimmed = trimmed.removeprefix("json").strip()
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("model response is not JSON")
    return json.loads(trimmed[start : end + 1])


def normalize_outline(outline: dict) -> dict:
    nodes = outline.get("nodes") if isinstance(outline.get("nodes"), list) else []
    normalized_nodes = []
    for index, node in enumerate(nodes):
        node_id = str((node or {}).get("id") or index + 1)
        children = (node or {}).get("children") if isinstance((node or {}).get("children"), list) else []
        normalized_children = [
            {
                "id": str((child or {}).get("id") or f"{node_id}.{child_index + 1}"),
                "title": str((child or {}).get("title") or "").strip(),
                "summary": str((child or {}).get("summary") or "").strip(),
            }
            for child_index, child in enumerate(children)
        ]
        normalized_children = [child for child in normalized_children if child["title"] or child["summary"]]
        normalized_node = {
            "id": node_id,
            "title": str((node or {}).get("title") or f"Part {index + 1}").strip(),
            "summary": str((node or {}).get("summary") or "").strip(),
            "children": normalized_children,
        }
        if normalized_node["title"] or normalized_node["summary"] or normalized_node["children"]:
            normalized_nodes.append(normalized_node)

    return {
        "title": str(outline.get("title") or "Video Outline").strip(),
        "summary": str(outline.get("summary") or "").strip(),
        "nodes": normalized_nodes,
    }


def build_mock_outline(title: str, language: str) -> dict:
    is_english = str(language or "").lower().startswith("en")
    if is_english:
        return {
            "title": f"Mock Outline: {title}" if title else "Mock Video Outline",
            "summary": "This is a local mock outline for UI testing. No SiliconFlow API call was made.",
            "nodes": [
                {"id": "1", "title": "Opening Context", "summary": "Introduces the theme and the core premise of the video.", "children": [{"id": "1.1", "title": "Main topic", "summary": "Frames what the video is about."}, {"id": "1.2", "title": "Initial hook", "summary": "Sets up why the topic matters."}]},
                {"id": "2", "title": "Core Ideas", "summary": "Collects the central arguments into a readable structure.", "children": [{"id": "2.1", "title": "First insight", "summary": "Summarizes the first important point."}, {"id": "2.2", "title": "Second insight", "summary": "Summarizes the next supporting idea."}]},
                {"id": "3", "title": "Examples", "summary": "Represents the examples or stories used to support the message.", "children": [{"id": "3.1", "title": "Example one", "summary": "A concrete illustration from the content."}, {"id": "3.2", "title": "Example two", "summary": "Another reference that supports the theme."}]},
                {"id": "4", "title": "Takeaways", "summary": "Concludes with practical lessons and next steps.", "children": [{"id": "4.1", "title": "Key lesson", "summary": "The main idea to remember."}, {"id": "4.2", "title": "Next action", "summary": "A possible follow-up or application."}]},
            ],
        }

    return {
        "title": f"测试大纲：{title}" if title else "测试视频大纲",
        "summary": "这是用于本地界面测试的 Mock 大纲，没有调用硅基流动 API。",
        "nodes": [
            {"id": "1", "title": "开场背景", "summary": "概括视频开头提出的主题和问题。", "children": [{"id": "1.1", "title": "核心主题", "summary": "说明视频主要讨论的方向。"}, {"id": "1.2", "title": "问题引入", "summary": "解释为什么这个主题值得关注。"}]},
            {"id": "2", "title": "主要观点", "summary": "整理视频中的关键论点和内容层次。", "children": [{"id": "2.1", "title": "观点一", "summary": "总结第一个重要观点。"}, {"id": "2.2", "title": "观点二", "summary": "总结第二个支撑观点。"}]},
            {"id": "3", "title": "案例说明", "summary": "模拟视频中用于支撑主题的例子或故事。", "children": [{"id": "3.1", "title": "案例一", "summary": "呈现一个具体说明。"}, {"id": "3.2", "title": "案例二", "summary": "补充另一个辅助说明。"}]},
            {"id": "4", "title": "结论启发", "summary": "收束视频内容，提炼可以带走的结论。", "children": [{"id": "4.1", "title": "关键收获", "summary": "总结最值得记住的信息。"}, {"id": "4.2", "title": "后续行动", "summary": "给出下一步思考或实践方向。"}]},
        ],
    }


def analysis_model_settings(client_id: str = "") -> dict:
    user_settings = get_user_settings(client_id) if client_id else {"model_connections": [], "active_model_connection_id": ""}
    connection = active_model_connection(user_settings)
    if not connection:
        return {
            "base_url": "",
            "api_key": "",
            "model": "",
            "connection_id": "",
            "connection_name": "",
        }

    return {
        "base_url": (connection.get("base_url") or "").rstrip("/"),
        "api_key": connection.get("api_key") or "",
        "model": connection.get("model") or "",
        "connection_id": connection.get("id") or "",
        "connection_name": connection.get("name") or "",
    }


def call_model_outline(payload: dict, *, client_id: str = "") -> dict:
    settings = analysis_model_settings(client_id)
    if not settings["base_url"]:
        raise ApiError("缺少分析模型 API 连接，请在软件设置中新增并选中一个 API。", status_code=500)
    if not settings["api_key"]:
        raise ApiError("缺少分析模型 API Key，请在软件设置中配置。", status_code=500)
    if not settings["model"]:
        raise ApiError("缺少分析模型名称，请在软件设置中配置。", status_code=500)

    body = json.dumps(
        {
            "model": settings["model"],
            "messages": [{"role": "user", "content": build_outline_prompt(payload)}],
            "temperature": 0.2,
            "enable_thinking": False,
            "max_tokens": 3000,
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings['base_url']}/chat/completions",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings['api_key']}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
            message = parsed.get("error", {}).get("message") or f"模型 API 请求失败: HTTP {error.code}"
        except Exception:
            message = f"模型 API 请求失败: HTTP {error.code}"
        raise ApiError(message, status_code=502) from error
    except TimeoutError as error:
        raise ApiError("模型 API 请求超时", status_code=504) from error

    content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    try:
        parsed = extract_json_object(content)
    except Exception as error:
        print("[video-outline] 模型返回内容不是合法 JSON:", content)
        raise ApiError("模型返回内容不是合法 JSON", status_code=502) from error

    outline = normalize_outline(parsed)
    if not outline["nodes"]:
        raise ApiError("模型返回的大纲为空", status_code=502)
    return outline


def create_outline(title: str, platform: str, duration: str, language: str, transcript: str, client_id: str = "") -> dict:
    transcript_quality = evaluate_transcript(transcript)
    print(
        "[video-outline] 收到大纲请求:",
        {
            "title": title,
            "platform": platform,
            "duration": duration,
            "language": language,
            "transcript_length": transcript_quality["charCount"],
            "transcript_compact_length": transcript_quality["compactLength"],
            "transcript_valid": transcript_quality["isValid"],
            "transcript_reason": transcript_quality["reason"],
            "transcript_preview": transcript_preview(transcript),
        },
    )

    if not transcript:
        raise ApiError("缺少字幕文本", status_code=400)

    if not transcript_quality["isValid"]:
        raise ApiError(
            "字幕内容不足，无法生成大纲",
            status_code=400,
            code="INSUFFICIENT_TRANSCRIPT",
            transcript_reason=transcript_quality["reason"],
            transcript_char_count=transcript_quality["charCount"],
            transcript_compact_length=transcript_quality["compactLength"],
        )

    if SILICONFLOW_MOCK_OUTLINE:
        print("[video-outline] 使用 Mock 大纲，跳过硅基流动 API 调用。")
        time.sleep(5)
        return {
            "mock": True,
            "outline": build_mock_outline(title or "Untitled Video", language or "zh"),
        }

    return {
        "outline": call_model_outline(
            {
                "title": title or "Untitled Video",
                "platform": platform or "Unknown",
                "duration": duration or "Unknown",
                "language": language or "zh",
                "transcript": transcript,
            },
            client_id=client_id,
        )
    }


def outline_service_meta(client_id: str = "") -> dict:
    settings = analysis_model_settings(client_id)
    return {
        "hasApiKey": bool(settings["api_key"]),
        "hasModel": bool(settings["model"]),
        "baseUrl": settings["base_url"],
        "connectionId": settings["connection_id"],
        "connectionName": settings["connection_name"],
    }
