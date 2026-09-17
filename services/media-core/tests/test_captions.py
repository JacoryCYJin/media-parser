import unittest
from unittest.mock import patch
from app.services.transcript.captions import fetch_transcript_from_info, evaluate_transcript, parse_subtitle_text

MANIFEST = '\ufeff  #EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-TARGETDURATION:600\n#EXTINF:306,\nhttps://example.invalid/subtitle.vtt\n#EXT-X-ENDLIST'
TEXT = 'This is a complete subtitle about imagination, creativity and learning. The speaker describes how people can build new worlds through stories and thoughtful observation.'
VTT = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n' + TEXT

class CaptionTests(unittest.TestCase):
    def test_manifest_rejected_even_when_labelled_vtt(self):
        self.assertFalse(evaluate_transcript(parse_subtitle_text(MANIFEST, 'vtt'))['isValid'])
        with patch('app.services.transcript.captions.fetch_text', return_value=MANIFEST):
            result = fetch_transcript_from_info({'subtitles': {'en': [{'url': 'https://example.invalid/a', 'ext': 'vtt'}]}})
        self.assertFalse(result['transcript_is_valid'])
        self.assertEqual(result['transcript'], '')
        self.assertEqual(result['transcript_preview'], '')

    def test_manifest_falls_through_to_real_subtitle(self):
        info = {'subtitles': {'en': [{'url': 'https://example.invalid/a', 'ext': 'vtt'}, {'url': 'https://example.invalid/b', 'ext': 'vtt'}]}}
        with patch('app.services.transcript.captions.fetch_text', side_effect=[MANIFEST, VTT]) as fetch:
            result = fetch_transcript_from_info(info)
        self.assertEqual(fetch.call_count, 2)
        self.assertTrue(result['transcript_is_valid'])
        self.assertEqual(result['transcript'], TEXT)

    def test_normal_vtt_and_json3_still_work(self):
        self.assertEqual(parse_subtitle_text(VTT, 'vtt'), TEXT)
        self.assertEqual(parse_subtitle_text('{"events":[{"segs":[{"utf8":"Hello world"}]}]}', 'json3'), 'Hello world')
        self.assertTrue(evaluate_transcript(TEXT)['isValid'])

if __name__ == '__main__':
    unittest.main()
