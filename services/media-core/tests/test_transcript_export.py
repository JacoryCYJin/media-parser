import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services.transcript import local_stt, tasks
from app.services.transcript.export import save_transcript


class TranscriptExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        settings = patch('app.services.transcript.export.get_user_settings', return_value={'default_download_dir': str(self.folder)})
        settings.start()
        self.addCleanup(settings.stop)

    def test_links_save_the_same_title_and_body_as_manual_export(self):
        transcript = {'text': 'Recognized text', 'duration': 1, 'segments': []}
        with patch.object(local_stt, '_transcribe_audio_path', return_value=(transcript, SimpleNamespace(language='en'))), patch.object(local_stt, '_download_audio', return_value={'bytes': 10, 'content_type': 'audio/mpeg'}):
            stages = []
            result = local_stt.transcribe_audio_url('https://example.invalid/audio.mp3', client_id='test', title='Audio title', stage_callback=stages.append)
            self.assertTrue(result['saved'])
            self.assertEqual(Path(result['files']['txt']).read_text(), '标题: Audio title\n\n字幕:\nRecognized text')
            self.assertEqual(result['export_text'], Path(result['files']['txt']).read_text())
            self.assertEqual(stages[-1], 'saving')
            audio = self.folder / 'source.m4a'
            audio.write_bytes(b'audio')
            with patch.object(local_stt, 'get_ytdlp_args', return_value=[]), patch.object(local_stt, 'run_ytdlp', return_value={'stdout': str(audio)}):
                result = local_stt.transcribe_video_audio('https://example.invalid/video', client_id='test', format_id='audio', title='Video title', export_locale='en-US')
            self.assertEqual(Path(result['files']['txt']).read_text(), 'Title: Video title\n\nTranscript:\nRecognized text')

    def test_collision_does_not_overwrite_and_repeat_save_is_idempotent(self):
        result = {'title': '视频/播客:标题', 'text': 'First'}
        save_transcript(result, 'test')
        path = Path(result['files']['txt'])
        again = {'title': result['title'], 'text': 'Second', 'export_name': result['export_name']}
        save_transcript(again, 'test')
        self.assertNotEqual(again['files']['txt'], str(path))
        self.assertEqual(path.read_text(), result['export_text'])
        self.assertTrue(path.name.startswith('视频_播客_标题_'))
        save_transcript(result, 'test')
        self.assertEqual(len(list(self.folder.glob('*.txt'))), 2)

    def test_save_failure_retains_text_and_task_retries_without_model(self):
        result = {'title': 'Title', 'text': 'Keep this text'}
        with patch.object(Path, 'open', side_effect=PermissionError('read only')):
            save_transcript(result, 'test', 'en-US')
        self.assertFalse(result['saved'])
        self.assertEqual(result['text'], 'Keep this text')
        self.assertIn('read only', result['save_error'])
        task = {'task_id': 'save-test', 'client_id': 'test', 'export_locale': 'en-US', 'status': 'completed', 'result': result}
        with patch.dict(tasks._TASKS, {'save-test': task}, clear=True), patch.object(local_stt, '_load_model') as model:
            self.assertIsNone(tasks.retry_transcript_save('save-test', 'another-client'))
            saved = tasks.retry_transcript_save('save-test', 'test')
            tasks.retry_transcript_save('save-test', 'test')
            model.assert_not_called()
        self.assertTrue(saved['result']['saved'])
        self.assertEqual(Path(saved['result']['files']['txt']).read_text(), 'Title: Title\n\nTranscript:\nKeep this text')
        self.assertEqual(len(list(self.folder.glob('*.txt'))), 1)

    def test_unset_directory_uses_system_downloads_fallback(self):
        with patch('app.services.transcript.export.get_user_settings', return_value={}), patch('app.services.user_data.user_default_downloads_dir', return_value=self.folder) as fallback:
            result = save_transcript({'title': 'Default', 'text': 'body'}, 'test')
        fallback.assert_called_once_with('test')
        self.assertTrue(result['saved'])
        self.assertEqual(result['output_dir'], str(self.folder))

    def test_cancellation_before_saving_does_not_create_file(self):
        def stop(stage):
            if stage == 'saving':
                raise tasks.TranscriptCancelled()
        with self.assertRaises(tasks.TranscriptCancelled):
            local_stt._transcript_result({'text': 'text'}, title='Cancelled', source_url='https://example.org/a', client_id='test', export_locale='zh-CN', stage_callback=stop)
        self.assertEqual(list(self.folder.iterdir()), [])


class TranscriptResolveTests(unittest.IsolatedAsyncioTestCase):
    async def test_supported_sources_are_classified_without_manual_type(self):
        from app.routes.transcript import resolve_transcript_source
        from unittest.mock import AsyncMock
        cases = [
            ('BV1HtHv64ENz', 'video'),
            ('https://youtu.be/TeVE4TQPEwM', 'video'),
            ('https://www.xiaoyuzhoufm.com/episode/example', 'podcast'),
            ('https://podcasts.apple.com/cn/podcast/example/id123?i=456', 'podcast'),
            ('https://example.org/feed.xml', 'podcast'),
            ('https://example.org/audio.mp3?token=keep', 'audio'),
        ]
        for url, kind in cases:
            result = await resolve_transcript_source(SimpleNamespace(json=AsyncMock(return_value={'url': url})))
            self.assertEqual(result['type'], kind)

    async def test_invalid_input_rejected(self):
        from app.routes.transcript import resolve_transcript_source
        from unittest.mock import AsyncMock
        for value in ['', 'javascript:alert(1)', 'https://example.org/a https://example.org/b']:
            response = await resolve_transcript_source(SimpleNamespace(json=AsyncMock(return_value={'url': value})))
            self.assertEqual(response.status_code, 400)


class BatchExportTests(unittest.TestCase):
    def setUp(self):
        from app.services.transcript.export import _GROUPS
        self.groups = _GROUPS
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name).resolve()
        settings = patch('app.services.transcript.export.get_user_settings', return_value={'default_download_dir': str(self.folder)})
        settings.start()
        self.addCleanup(settings.stop)
        groups = patch.dict(self.groups, {}, clear=True)
        groups.start()
        self.addCleanup(groups.stop)

    def test_single_file_stays_directly_in_default_folder(self):
        from app.services.transcript.export import configure_export_group
        configure_export_group('test', 'single', False)
        result = save_transcript({'title': 'One', 'text': 'first'}, 'test', group_id='single')
        self.assertEqual(Path(result['files']['txt']).parent, self.folder)
        self.assertFalse(any(path.is_dir() for path in self.folder.iterdir()))

    def test_multiple_files_share_timestamp_folder_and_separate_batches_do_not_mix(self):
        from app.services.transcript.export import configure_export_group
        from datetime import datetime
        with patch('app.services.transcript.export.datetime') as clock:
            clock.now.return_value = datetime(2026, 10, 18, 21, 30, 0)
            configure_export_group('test', 'batch-one', True)
            first = save_transcript({'title': 'One', 'text': 'first'}, 'test', group_id='batch-one')
            second = save_transcript({'title': 'Two', 'text': 'second'}, 'test', group_id='batch-one')
            configure_export_group('test', 'batch-two', True)
            third = save_transcript({'title': 'Three', 'text': 'third'}, 'test', group_id='batch-two')
        folder = Path(first['files']['txt']).parent
        self.assertEqual(folder.name, '2026-10-18_21-30-00')
        self.assertEqual(folder.parent, self.folder)
        self.assertEqual(Path(second['files']['txt']).parent, folder)
        self.assertEqual(Path(third['files']['txt']).parent.name, '2026-10-18_21-30-00_1')
        self.assertEqual(len(list(folder.glob('*.txt'))), 2)

    def test_append_after_completion_moves_only_this_groups_output_and_refreshes_task(self):
        from app.services.transcript.export import configure_export_group
        configure_export_group('test', 'append', False)
        first = save_transcript({'title': 'One', 'text': 'first'}, 'test', group_id='append')
        old_path = Path(first['files']['txt'])
        old_path.write_text('User edited text', encoding='utf-8')
        unrelated = save_transcript({'title': 'Other', 'text': 'keep'}, 'test')
        record = {'task_id': 'first', 'client_id': 'test', 'output_group_id': 'append', 'result': first}
        with patch.dict(tasks._TASKS, {'first': record}, clear=True):
            snapshot = tasks.configure_transcript_group('test', 'append', True)
        self.assertFalse(old_path.exists())
        new_path = Path(first['files']['txt'])
        self.assertEqual(new_path.read_text(), 'User edited text')
        self.assertEqual(snapshot['tasks'][0]['result']['files']['txt'], str(new_path))
        self.assertTrue(Path(unrelated['files']['txt']).is_file())
        self.assertEqual(Path(unrelated['files']['txt']).parent, self.folder)
        second = save_transcript({'title': 'Two', 'text': 'second'}, 'test', group_id='append')
        self.assertEqual(Path(second['files']['txt']).parent, new_path.parent)
        # A later false flag or repeated promotion never moves results back out.
        configure_export_group('test', 'append', False)
        configure_export_group('test', 'append', True)
        self.assertEqual(len(list(new_path.parent.glob('*.txt'))), 2)

    def test_group_retry_uses_original_directory_even_if_default_changes(self):
        from app.services.transcript.export import configure_export_group
        configure_export_group('test', 'retry', True)
        with patch.object(Path, 'open', side_effect=PermissionError('read only')):
            result = save_transcript({'title': 'One', 'text': 'first'}, 'test', group_id='retry')
        record = {'task_id':'retry-task', 'client_id':'test', 'output_group_id':'retry', 'status':'completed', 'result':result}
        with patch.dict(tasks._TASKS, {'retry-task':record}, clear=True), patch('app.services.transcript.export.get_user_settings', return_value={'default_download_dir':str(self.folder / 'other')}):
            saved = tasks.retry_transcript_save('retry-task', 'test')
        self.assertTrue(saved['result']['saved'])
        self.assertEqual(Path(saved['result']['files']['txt']).parent.parent, self.folder)
        self.assertFalse((self.folder / 'other').exists())

    def test_same_group_id_is_isolated_between_clients(self):
        from app.services.transcript.export import configure_export_group
        configure_export_group('owner', 'same', False)
        first = save_transcript({'title':'Owner', 'text':'first'}, 'owner', group_id='same')
        configure_export_group('another', 'same', True)
        self.assertEqual(Path(first['files']['txt']).parent, self.folder)
        with patch.dict(tasks._TASKS, {'owner-task': {'client_id':'owner', 'output_group_id':'same', 'result':first}}, clear=True):
            self.assertEqual(tasks.configure_transcript_group('another', 'same', True)['tasks'], [])

    def test_promotion_and_inflight_save_cannot_leave_file_outside_batch(self):
        import threading
        from concurrent.futures import ThreadPoolExecutor
        from app.services.transcript import export
        export.configure_export_group('test', 'race', False)
        entered, release = threading.Event(), threading.Event()
        write = export._write_unique
        def slow_write(*args):
            entered.set()
            if not release.wait(3):
                raise RuntimeError('test timed out')
            return write(*args)
        with ThreadPoolExecutor(max_workers=2) as pool, patch.object(export, '_write_unique', side_effect=slow_write):
            saving = pool.submit(save_transcript, {'title':'One', 'text':'first'}, 'test', 'zh-CN', 'race')
            self.assertTrue(entered.wait(3))
            grouping = pool.submit(export.configure_export_group, 'test', 'race', True)
            release.set()
            result = saving.result(timeout=3)
            grouping.result(timeout=3)
        self.assertTrue(result['saved'])
        self.assertNotEqual(Path(result['files']['txt']).parent, self.folder)
        self.assertEqual(list(self.folder.glob('*.txt')), [])

    def test_failed_move_preserves_original_and_can_be_retried(self):
        from app.services.transcript import export
        export.configure_export_group('test', 'move-retry', False)
        result = save_transcript({'title':'One', 'text':'first'}, 'test', group_id='move-retry')
        source = Path(result['files']['txt'])
        with patch.object(export, '_write_unique', side_effect=PermissionError('read only')):
            with self.assertRaises(PermissionError):
                export.configure_export_group('test', 'move-retry', True)
        self.assertTrue(source.is_file())
        self.assertEqual(result['files']['txt'], str(source))
        export.configure_export_group('test', 'move-retry', True)
        self.assertFalse(source.exists())
        self.assertTrue(Path(result['files']['txt']).is_file())


if __name__ == '__main__':
    unittest.main()
