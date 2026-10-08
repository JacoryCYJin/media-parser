import json
import unittest
from pathlib import Path

from app.errors import ApiError
from app.services.video.input import normalize_video_input


class VideoInputTests(unittest.TestCase):
    def test_shared_cases(self):
        cases = json.loads(Path(__file__).with_name('video_input_cases.json').read_text())
        codes = {'invalidVideoInput': 'INVALID_VIDEO_INPUT', 'multipleVideoSources': 'MULTIPLE_VIDEO_SOURCES'}
        for case in cases:
            with self.subTest(input=case['input']):
                if case.get('error') == 'missing':
                    self.assertEqual(normalize_video_input(case['input']), '')
                elif 'error' in case:
                    with self.assertRaises(ApiError) as caught:
                        normalize_video_input(case['input'])
                    self.assertEqual(caught.exception.status_code, 400)
                    self.assertEqual(caught.exception.code, codes[case['error']])
                else:
                    self.assertEqual(normalize_video_input(case['input']), case['url'])


class VideoInputRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_multiple_sources_rejected_before_extractor(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from app.routes.video import parse_video

        request = SimpleNamespace(json=AsyncMock(return_value={'url': 'BV1HtHv64ENz av170001'}))
        with patch('app.routes.video.run_ytdlp') as extractor:
            response = await parse_video(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(json.loads(response.body)['code'], 'MULTIPLE_VIDEO_SOURCES')
        extractor.assert_not_called()

    async def test_bv_number_reaches_extractor_as_url(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from app.routes.video import parse_video

        request = SimpleNamespace(json=AsyncMock(return_value={'url': 'BV1HtHv64ENz'}), state=SimpleNamespace(client_id='test'))
        source = 'https://www.bilibili.com/video/BV1HtHv64ENz'
        with patch('app.routes.video.get_ytdlp_args', return_value=['probe']) as args, \
             patch('app.routes.video.run_ytdlp', return_value={'stdout': '{"title":"video"}'}), \
             patch('app.routes.video.to_unique_formats', return_value=[{'format_id': 'test'}]), \
             patch('app.routes.video.get_subtitle_info', return_value={}), \
             patch('app.routes.video.fetch_transcript_from_info', return_value={}):
            response = await parse_video(request)
        self.assertEqual(response['source_url'], source)
        args.assert_called_once_with('test', source, ['-J'])


    async def test_transcription_rejects_multiple_sources_without_starting_task(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from app.routes.transcript import create_video_local_stt_task

        request = SimpleNamespace(json=AsyncMock(return_value={'url': 'BV1HtHv64ENz av170001', 'format_id': 'audio'}))
        with patch('app.routes.transcript.create_transcript_task') as task:
            response = await create_video_local_stt_task(request)
        self.assertEqual(response.status_code, 400)
        task.assert_not_called()


if __name__ == '__main__':
    unittest.main()
