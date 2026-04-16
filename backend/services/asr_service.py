import asyncio
import logging
import os
from pathlib import Path
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# Check bcut-asr availability
try:
    from bcut_asr import BcutASR
    from bcut_asr.orm import ResultStateEnum

    BCUT_AVAILABLE = True
except ImportError:
    BCUT_AVAILABLE = False

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".webm"}


def find_video_file(directory: str) -> str | None:
    """Find the first video file in a directory."""
    for f in os.listdir(directory):
        if Path(f).suffix.lower() in VIDEO_EXTS:
            return os.path.join(directory, f)
    return None


def find_srt_file(directory: str) -> str | None:
    """Find the first SRT file in a directory."""
    for f in os.listdir(directory):
        if f.lower().endswith(".srt"):
            return os.path.join(directory, f)
    return None


async def extract_audio(
    video_path: str, output_dir: str, ffmpeg_path: str = "ffmpeg"
) -> str:
    """Extract audio from video as 16kHz mono WAV."""
    wav_path = os.path.join(output_dir, Path(video_path).stem + "_audio.wav")

    if os.path.exists(wav_path):
        return wav_path

    proc = await asyncio.create_subprocess_exec(
        ffmpeg_path,
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-y",
        wav_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 音频提取失败: {stderr.decode()}")

    return wav_path


def _recognize_bcut_sync(wav_path: str, output_srt: str) -> str:
    """Run bcut-asr recognition (blocking)."""
    if not BCUT_AVAILABLE:
        raise RuntimeError("bcut-asr 未安装，请运行: pip install bcut-asr")

    asr = BcutASR(wav_path)
    asr.upload()
    asr.create_task()

    import time

    for attempt in range(120):
        result = asr.result()
        if result.state == ResultStateEnum.COMPLETE:
            break
        if result.state == ResultStateEnum.FAILED:
            raise RuntimeError("bcut-asr 识别失败")
        time.sleep(3)
    else:
        raise RuntimeError("bcut-asr 识别超时")

    subtitle = result.parse()
    if not subtitle.has_data():
        raise RuntimeError("bcut-asr 未识别到有效内容")

    srt_content = subtitle.to_srt()
    with open(output_srt, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return output_srt


def _recognize_whisper_sync(
    wav_path: str, output_srt: str, model_name: str = "base", language: str = "zh"
) -> str:
    """Run Whisper recognition (blocking)."""
    try:
        import whisper as _whisper
    except ImportError:
        raise RuntimeError("whisper 未安装，请运行: pip install openai-whisper")

    model = _whisper.load_model(model_name)
    kwargs = {}
    if language and language != "auto":
        kwargs["language"] = language

    result = model.transcribe(wav_path, **kwargs)

    with open(output_srt, "w", encoding="utf-8") as f:
        for i, seg in enumerate(result["segments"], start=1):

            def fmt_ts(t: float) -> str:
                h = int(t // 3600)
                m = int((t % 3600) // 60)
                s = int(t % 60)
                ms = int((t - int(t)) * 1000)
                return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

            f.write(
                f"{i}\n{fmt_ts(seg['start'])} --> {fmt_ts(seg['end'])}\n{seg['text'].strip()}\n\n"
            )

    return output_srt


async def generate_srt(
    video_path: str,
    output_dir: str,
    method: str = "bcut",
    whisper_model: str = "base",
    language: str = "zh",
    ffmpeg_path: str = "ffmpeg",
) -> AsyncGenerator[dict, None]:
    """
    Generate SRT from video, yielding progress events.

    Events:
      {"stage": "extracting_audio", "message": "..."}
      {"stage": "recognizing", "message": "...", "method": "bcut"|"whisper"}
      {"stage": "completed", "srt_path": "..."}
      {"stage": "failed", "error": "..."}
    """
    srt_path = os.path.join(output_dir, Path(video_path).stem + ".srt")

    try:
        # Step 1: extract audio
        yield {"stage": "extracting_audio", "message": "正在从视频提取音频..."}
        wav_path = await extract_audio(video_path, output_dir, ffmpeg_path)
        yield {"stage": "audio_ready", "message": "音频提取完成"}

        # Step 2: ASR
        actual_method = method

        if method == "bcut":
            if not BCUT_AVAILABLE:
                logger.warning("bcut-asr 不可用，回退到 whisper")
                actual_method = "whisper"

        yield {
            "stage": "recognizing",
            "message": f"正在进行语音识别 ({actual_method})...",
            "method": actual_method,
        }

        if actual_method == "bcut":
            await asyncio.to_thread(_recognize_bcut_sync, wav_path, srt_path)
        else:
            await asyncio.to_thread(
                _recognize_whisper_sync, wav_path, srt_path, whisper_model, language
            )

        # Clean up wav
        try:
            os.remove(wav_path)
        except OSError:
            pass

        yield {"stage": "completed", "srt_path": srt_path, "message": "字幕生成完成"}

    except Exception as e:
        logger.error(f"ASR 失败: {e}")
        yield {"stage": "failed", "error": str(e)}
