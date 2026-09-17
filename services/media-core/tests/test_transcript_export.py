import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from app.services.transcript import local_stt


class ManualExportTests(unittest.TestCase):
    def test_link_transcription_returns_title_without_creating_result_files(self):
        transcript = {'text': 'Recognized text', 'duration': 1, 'segments': []}
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            # Any former automatic directory creation or JSON write fails this test.
            with patch.object(local_stt, '_transcribe_audio_path', return_value=(transcript, SimpleNamespace(language='en'))), patch.object(local_stt, '_download_audio', return_value={'bytes': 10, 'content_type': 'audio/mpeg'}), patch.object(Path, 'mkdir', side_effect=AssertionError('Unexpected output directory')), patch.object(Path, 'write_text', side_effect=AssertionError('Unexpected text file')):
                result = local_stt.transcribe_audio_url('https://example.invalid/audio.mp3', client_id='test', title='Audio title')
                self.assertEqual(result['title'], 'Audio title')
                self.assertFalse(result['saved'])
                self.assertNotIn('files', result)
                self.assertNotIn('output_dir', result)
                audio = base / 'source.m4a'
                audio.write_bytes(b'mocked audio')
                with patch.object(local_stt, 'get_ytdlp_args', return_value=[]), patch.object(local_stt, 'run_ytdlp', return_value={'stdout': str(audio)}):
                    result = local_stt.transcribe_video_audio('https://example.invalid/video', client_id='test', format_id='audio', title='Video title')
                self.assertEqual(result['title'], 'Video title')
                self.assertFalse(result['saved'])
                self.assertNotIn('files', result)
                self.assertNotIn('output_dir', result)
            self.assertEqual([p.name for p in base.iterdir()], ['source.m4a'])

if __name__ == '__main__':
    unittest.main()
