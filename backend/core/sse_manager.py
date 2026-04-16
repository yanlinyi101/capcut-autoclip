import json
from typing import AsyncGenerator
from backend.tasks.background import iter_events


async def sse_event_generator(task_id: str) -> AsyncGenerator[dict, None]:
    """Convert background task events into SSE-formatted dicts."""
    async for event in iter_events(task_id):
        yield {
            "event": event["type"],
            "data": json.dumps(event["data"], ensure_ascii=False),
        }
