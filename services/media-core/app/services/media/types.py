from typing import Literal, TypedDict


MediaType = Literal["video", "podcast", "audio", "unknown"]


class MediaParseTarget(TypedDict):
    type: MediaType
    platform: str
    url: str
