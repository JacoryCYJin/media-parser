import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reactive, ref, computed } from 'vue';
const source = await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js', import.meta.url), 'utf8');
function setup(api) {
  const build = new Function('reactive', 'ref', 'computed', 'onBeforeUnmount', 'api', 'createAudioQueue', 'setInterval', 'clearInterval',
    source.replace(/^import .*;\n/gm, '').replace('export function useWorkbench', 'function useWorkbench') + '\nreturn useWorkbench;');
  const use = build(reactive, ref, computed, () => {}, api, () => ({}), () => 0, () => {});
  const work = use({ props: {}, locale: ref('zh-CN'), w: key => key });
  work.navigate('video');
  return work;
}
const video = { ext: 'mp4', format_id: '1080', resolution: '1080p' };
const audio = { ext: 'm4a', format_id: 'a', resolution: 'Audio' };
test('changing source hides old completion during parsing, retains records and selects video', async () => {
  let resolve;
  const work = setup({ post: () => new Promise(r => { resolve = r; }) });
  const s = work.state.value;
  Object.assign(s, { url: 'https://example.org/a', parsedInputUrl: 'https://example.org/a', info: { source_url: 'https://example.org/a' }, audioKind: 'audio', downloads: [{ status: 'COMPLETED', request: { url: 'https://example.org/a' } }] });
  assert.equal(work.visibleDownloads.value.length, 1);
  s.url = 'https://example.org/b'; work.invalidate(s, true);
  assert.equal(work.visibleDownloads.value.length, 0);
  const pending = work.parse(s, 'video');
  assert.equal(work.visibleDownloads.value.length, 0);
  resolve({ data: { source_url: s.url, formats: [video, audio] } }); await pending;
  assert.equal(s.audioKind, 'video');
  assert.equal(work.visibleDownloads.value.length, 0);
  assert.equal(s.downloads.length, 1);
  s.info.source_url = 'https://example.org/a';
  assert.equal(work.visibleDownloads.value.length, 1);
});
test('audio-only sources select audio; same-source mode survives unless unavailable; errors hide cards', async () => {
  let formats = [audio], failure = false;
  const work = setup({ post: async () => { if (failure) throw new Error('failed'); return { data: { source_url: 'https://example.org/a', formats } }; } });
  const s = work.state.value; s.url = 'https://example.org/a';
  await work.parse(s, 'video'); assert.equal(s.audioKind, 'audio');
  formats = [video, audio]; await work.parse(s, 'video'); assert.equal(s.audioKind, 'audio');
  formats = [video]; await work.parse(s, 'video'); assert.equal(s.audioKind, 'video');
  failure = true; await work.parse(s, 'video');
  assert.equal(s.status, 'failed'); assert.equal(work.visibleDownloads.value.length, 0);
});
test('download remembers canonical and submitted source; podcast retains its existing records', async () => {
  const work = setup({ post: async () => ({ data: { task_id: '1', status: 'COMPLETED' } }) });
  const s = work.state.value;
  s.parsedInputUrl = 'https://example.org/short'; s.info = { source_url: 'https://example.org/canonical' };
  await work.download(s, 'video', video);
  assert.equal(work.visibleDownloads.value.length, 1);
  s.info.source_url = 'https://example.org/alternate-canonical';
  assert.equal(work.visibleDownloads.value.length, 1);
  s.parsedInputUrl = 'https://example.org/other';
  assert.equal(work.visibleDownloads.value.length, 0);
  work.navigate('podcast'); work.state.value.downloads.push({ task_id: 'podcast' });
  assert.equal(work.visibleDownloads.value.length, 1);
});
