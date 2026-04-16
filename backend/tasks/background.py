import asyncio
import uuid
from typing import Any

# task_id -> { "status": str, "events": list, "done": asyncio.Event }
_tasks: dict[str, dict[str, Any]] = {}


def create_task() -> str:
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {
        "status": "running",
        "events": [],
        "done": asyncio.Event(),
    }
    return task_id


def push_event(task_id: str, event: dict):
    task = _tasks.get(task_id)
    if task:
        task["events"].append(event)


def mark_done(task_id: str):
    task = _tasks.get(task_id)
    if task:
        task["status"] = "completed"
        task["done"].set()


def get_task(task_id: str) -> dict | None:
    return _tasks.get(task_id)


async def iter_events(task_id: str):
    """Async generator to yield events as they arrive."""
    task = _tasks.get(task_id)
    if not task:
        return

    cursor = 0
    while True:
        while cursor < len(task["events"]):
            yield task["events"][cursor]
            cursor += 1

        if task["done"].is_set() and cursor >= len(task["events"]):
            break

        await asyncio.sleep(0.2)
