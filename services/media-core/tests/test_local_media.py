import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import av
import numpy as np
from faster_whisper.audio import decode_audio
from app.services.transcript.local_stt import validate_local_media, transcribe_local_audio
from app.routes.transcript import create_local_file_task


def make_mp4(path, with_audio):
    with av.open(str(path), 'w') as container:
        video = container.add_stream('mpeg4', rate=1)
        video.width, video.height, video.pix_fmt = 16, 16, 'yuv420p'
        audio = container.add_stream('aac', rate=16000) if with_audio else None
        frame = av.VideoFrame.from_ndarray(np.zeros((16, 16, 3), dtype=np.uint8), format='rgb24')
        for packet in video.encode(frame): container.mux(packet)
        for packet in video.encode(None): container.mux(packet)
        if audio:
            frame = av.AudioFrame.from_ndarray(np.zeros((1, 16000), dtype=np.float32), format='flt', layout='mono')
            frame.sample_rate = 16000
            for packet in audio.encode(frame): container.mux(packet)
            for packet in audio.encode(None): container.mux(packet)


class LocalMediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.video = Path(self.temp.name).resolve() / 'voice.MP4'
        self.silent = Path(self.temp.name).resolve() / 'silent.mp4'
        make_mp4(self.video, True)
        make_mp4(self.silent, False)

    def test_real_mp4_audio_decodes(self):
        self.assertEqual(validate_local_media(str(self.video)), self.video)
        self.assertGreater(len(decode_audio(str(self.video))), 0)

    def test_no_audio_and_corrupt_mp4_rejected(self):
        with self.assertRaisesRegex(ValueError, '此视频没有音轨'):
            validate_local_media(str(self.silent))
        corrupt = Path(self.temp.name) / 'corrupt.mp4'
        corrupt.write_bytes(b'not a media container')
        with self.assertRaisesRegex(ValueError, '无法读取此视频文件'):
            validate_local_media(str(corrupt))

    def test_route_accepts_mp4_and_rejects_video_without_audio(self):
        async def run(path):
            async def body(): return {'path': str(path)}
            return await create_local_file_task(SimpleNamespace(json=body, state=SimpleNamespace(client_id='test')))
        with patch('app.routes.transcript.create_transcript_task', return_value={'task_id': 'test'}) as create:
            self.assertEqual(asyncio.run(run(self.video)), {'task_id': 'test'})
            self.assertEqual(create.call_args.kwargs['source_type'], 'local')
            response = asyncio.run(run(self.silent))
            self.assertEqual(response.status_code, 400)
            self.assertIn('此视频没有音轨', response.body.decode())
            self.assertEqual(create.call_count, 1)

    def test_worker_checks_audio_before_loading_model(self):
        with patch('app.services.transcript.local_stt._load_model') as model:
            with self.assertRaisesRegex(ValueError, '此视频没有音轨'):
                transcribe_local_audio(str(self.silent), client_id='test')
            model.assert_not_called()

    def test_local_mp4_uses_existing_transcription_pipeline(self):
        transcript = {'text': 'test', 'duration': 1, 'segments': []}
        with patch('app.services.transcript.local_stt._transcribe_audio_path', return_value=(transcript, SimpleNamespace(language='en'))) as transcribe, patch('app.services.transcript.local_stt._save_transcript_files', side_effect=lambda result, **kwargs: result):
            result = transcribe_local_audio(str(self.video), client_id='test')
        self.assertEqual(transcribe.call_args.args[0], self.video)
        self.assertEqual(result['text'], 'test')

if __name__ == '__main__':
    unittest.main()
