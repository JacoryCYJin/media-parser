"""Independent workspace regression tests. All files and settings use a temporary root."""
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

ROOT = tempfile.TemporaryDirectory(prefix="media-workbench-tests-")
os.environ.update(MEDIA_CORE_LOAD_ENV="0", MEDIA_CORE_DATA_DIR=ROOT.name + "/data", MEDIA_CORE_DOWNLOADS_DIR=ROOT.name + "/downloads")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/media-core"))
from fastapi.testclient import TestClient
from app.main import app
from app.services.download_tasks import audio_download_worker, create_download_task, read_download_task, control_download_task, update_download_task
from app.services.transcript import tasks
from app.services.outline import build_outline_prompt

CLIENT = "workbench_test_user"
client = TestClient(app, headers={"x-client-id": CLIENT})
PAYLOAD = b"RIFF" + b"a" * (512 * 1024)

class AudioHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", len(PAYLOAD))
        self.end_headers()
        try:
            for start in range(0, len(PAYLOAD), 8192):
                self.wfile.write(PAYLOAD[start:start + 8192])
                self.wfile.flush()
                time.sleep(0.005)
        except (BrokenPipeError, ConnectionResetError):
            pass
    def log_message(self, *_):
        pass

class WorkbenchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), AudioHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/audio.wav"
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
    def wait(self, condition):
        limit = time.monotonic() + 5
        while not condition():
            if time.monotonic() > limit:
                self.fail("Task did not reach expected state")
            time.sleep(0.01)
    def test_stream_publishes_complete_file(self):
        output = Path(ROOT.name) / "success"
        output.mkdir()
        task = create_download_task(CLIENT)
        audio_download_worker(task, self.url, "episode", output)
        result = read_download_task(task)
        self.assertEqual(result["status"], "COMPLETE")
        self.assertEqual(Path(result["path"]).read_bytes(), PAYLOAD)
        self.assertEqual(list(output.glob("*.part")), [])
    def test_pause_resume_and_cancel_clean_partial(self):
        output = Path(ROOT.name) / "cancel"
        output.mkdir()
        task = create_download_task(CLIENT)
        update_download_task(task, kind="audio")
        worker = threading.Thread(target=audio_download_worker, args=(task, self.url, "episode", output))
        worker.start()
        self.wait(lambda: read_download_task(task)["status"] == "DOWNLOADING")
        self.assertEqual(control_download_task(task, "pause")[1], "")
        time.sleep(0.08)
        self.assertEqual(read_download_task(task)["status"], "PAUSED")
        self.assertEqual(control_download_task(task, "resume")[1], "")
        self.assertEqual(control_download_task(task, "cancel")[1], "")
        worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(read_download_task(task)["status"], "CANCELLED")
        self.assertEqual(list(output.iterdir()), [])
    def test_rejects_invalid_local_file(self):
        result = client.post("/api/transcript/local-stt/tasks/local", json={"path": ROOT.name + "/missing.wav"})
        self.assertEqual(result.status_code, 400)
    def test_cancellation_waits_for_worker_acknowledgement(self):
        entered, release = threading.Event(), threading.Event()
        def transcribe(*_, **kwargs):
            entered.set()
            release.wait(3)
            kwargs["stage_callback"]("saving")
            return {"text": "must not become a completed result"}
        with patch.object(tasks, "transcribe_local_audio", side_effect=transcribe):
            task = tasks.create_transcript_task(client_id=CLIENT, source_url="/fixture.wav", source_type="local")
            self.assertTrue(entered.wait(3))
            result = tasks.cancel_transcript_task(task["task_id"], CLIENT)
            self.assertEqual(result["status"], "stopping")
            self.assertIsNone(tasks.cancel_transcript_task(task["task_id"], "another_user"))
            release.set()
            self.wait(lambda: tasks.read_transcript_task(task["task_id"], CLIENT)["status"] == "cancelled")
            self.assertIsNone(tasks.read_transcript_task(task["task_id"], CLIENT)["result"])
    def test_outline_accepts_independent_text_and_legacy_route(self):
        outline = {"title": "Notes", "summary": "Summary", "nodes": [{"id": "1", "title": "Topic", "summary": "", "children": []}]}
        text = "Focus is a useful practice. A short uninterrupted session helps us finish one task. " * 5
        with patch("app.services.outline.call_model_outline", return_value=outline):
            for route in ["/api/outline", "/api/video/outline"]:
                response = client.post(route, json={"transcript": text, "language": "en"})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["outline"], outline)
        self.assertNotIn("视频内容结构化助手", build_outline_prompt({"transcript": text}))
    def test_outline_rejects_short_input(self):
        self.assertEqual(client.post("/api/outline", json={"transcript": "short"}).status_code, 400)

if __name__ == "__main__":
    unittest.main()
