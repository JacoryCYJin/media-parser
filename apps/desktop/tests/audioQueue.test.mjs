import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, stat, realpath, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import test from 'node:test';
import { reactive, ref, computed } from 'vue';

const source = await readFile(new URL('../src/renderer/src/components/workbench/audioQueue.js', import.meta.url), 'utf8');
const { createAudioQueue } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const audio = name => ({ name: `${name}.${name === 'B' ? 'mp4' : 'm4a'}`, path: `/audio/${name}.${name === 'B' ? 'mp4' : 'm4a'}`, size: 1024 });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

test('file selection enables multi-select and returns valid files even when another selection is invalid', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'media-audio-selection-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const paths = ['A.wav', 'B.MP4', 'invalid.txt'].map(name => join(folder, name));
  await Promise.all(paths.map(path => writeFile(path, 'file validation fixture')));
  const main = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8');
  const fragment = main.slice(main.indexOf('const audioExtensions ='), main.indexOf("ipcMain.handle('files:import-text'"));
  const handlers = new Map();
  let options, selection = { canceled: false, filePaths: paths };
  new Function('ipcMain', 'dialog', 'stat', 'realpath', 'extname', 'basename', 'BrowserWindow', ts.transpileModule(fragment, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { handle: (name, handler) => handlers.set(name, handler) },
    { showOpenDialog: async (parent, input) => { assert.equal(parent.isDestroyed(), false); options = input; return selection; } }, stat, realpath, extname, basename, { fromWebContents: () => ({ isDestroyed: () => false }) },
  );
  const result = await handlers.get('files:audios')({ sender: {} });
  assert.ok(options.properties.includes('multiSelections'));
  assert.ok(options.filters[0].extensions.includes('mp4'));
  const droppedVideo = await handlers.get('files:audio-append')(null, paths[1]);
  assert.equal(droppedVideo.name, 'B.MP4');
  assert.deepEqual(result.files.map(file => file.name), ['A.wav', 'B.MP4']);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /invalid.txt/);
  const dropped = await handlers.get('files:audio-append')(null, paths[0]);
  assert.equal(dropped.path, result.files[0].path);
  selection = { canceled: true, filePaths: [] };
  assert.deepEqual(await handlers.get('files:audios')({ sender: {} }), { files: [], errors: [] });
});

function setup() {
  const state = reactive({ audioFiles: [], activeAudioId: null, selectedAudioId: null, queueRunning: false, retryOnlyId: null, language: 'zh', mode: 'file', status: 'idle' });
  const created = [], tasks = new Map();
  const api = {
    async post(url, body) {
      if (url.endsWith('/cancel')) {
        const id = url.split('/').at(-2);
        tasks.set(id, { ...tasks.get(id), status: 'cancelled' });
        return { data: tasks.get(id) };
      }
      const id = String(created.length + 1);
      created.push(body.path);
      const data = { task_id: id, status: 'transcribing', progress: 0 };
      tasks.set(id, data);
      return { data };
    },
    async get(url) { return { data: tasks.get(url.split('/').at(-1)) }; },
  };
  const queue = createAudioQueue({ getState: () => state, api });
  const complete = async (status = 'completed') => {
    const row = state.audioFiles.find(row => row.id === state.activeAudioId);
    tasks.set(row.task.task_id, { task_id: row.task.task_id, status, progress: 100, result: status === 'completed' ? { text: row.file.name, segments: [] } : null, error: status === 'failed' ? 'Recognition failed' : '' });
    await queue.poll();
  };
  return { state, queue, api, created, tasks, complete };
}

test('multi-select, later append and duplicate paths preserve independent results and order', async () => {
  const { state, queue, created, complete } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  assert.deepEqual(created, [audio('A').path]);
  assert.deepEqual(queue.append([audio('A'), audio('C')]), ['A.m4a']);
  await queue.start(); // Repeated clicks cannot reserve a second slot.
  assert.equal(created.length, 1);
  await complete();
  assert.deepEqual(created, [audio('A').path, audio('B').path]);
  assert.equal(state.audioFiles[0].result.text, 'A.m4a');
  await complete();
  assert.equal(created[2], audio('C').path);
  await complete();
  assert.equal(state.status, 'completed');
  assert.deepEqual(state.audioFiles.map(row => row.result.text), ['A.m4a', 'B.mp4', 'C.m4a']);
  queue.append([audio('D')]);
  assert.equal(created.length, 3); // Adding after completion waits for another Start.
  assert.equal(state.audioFiles[0].result.text, 'A.m4a');
});

test('recognition failure advances to the next file', async () => {
  const { queue, created, complete, state } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await complete('failed');
  assert.equal(state.audioFiles[0].status, 'failed');
  assert.equal(created[1], audio('B').path);
  await complete();
  assert.equal(state.audioFiles[1].result.text, 'B.mp4');
});

test('a rejected creation does not block later files', async () => {
  const { queue, api, created, state } = setup();
  const post = api.post;
  api.post = (url, body) => body?.path === audio('A').path ? Promise.reject(new Error('Invalid file')) : post(url, body);
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  assert.equal(state.audioFiles[0].error, 'Invalid file');
  assert.deepEqual(created, [audio('B').path]);
});

test('stop all pauses pending files; retry only restarts the chosen cancelled file', async () => {
  const { queue, state, created, complete } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await queue.stop();
  assert.equal(state.audioFiles[0].status, 'cancelled');
  assert.equal(state.audioFiles[1].status, 'waiting');
  assert.equal(created.length, 1);
  await queue.retry(audio('A').path);
  assert.equal(created[1], audio('A').path);
  await complete();
  assert.equal(created.length, 2);
  assert.equal(state.audioFiles.find(row => row.file.name === 'B.mp4').status, 'waiting');
  await queue.start();
  assert.equal(created[2], audio('B').path);
});

test('stopping one file continues the group', async () => {
  const { queue, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await queue.stop(audio('A').path);
  assert.deepEqual(created, [audio('A').path, audio('B').path]);
});

test('stop during creation cancels the returned backend task before starting another', async () => {
  const { queue, api, state, created } = setup();
  const pending = deferred(), post = api.post;
  let cancelCount = 0;
  api.post = async (url, body) => {
    if (url.endsWith('/cancel')) { cancelCount++; return post(url, body); }
    const result = await post(url, body);
    await pending.promise;
    return result;
  };
  queue.append([audio('A'), audio('B')]);
  const start = queue.start();
  await queue.stop();
  queue.append([audio('C')]);
  pending.resolve();
  await start;
  assert.equal(cancelCount, 1);
  assert.equal(created.length, 1);
  assert.equal(state.audioFiles[0].status, 'cancelled');
});

test('temporary polling errors keep the active slot; a missing task fails and advances', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  api.get = async () => { throw new Error('Offline'); };
  await queue.poll();
  assert.equal(created.length, 1);
  assert.equal(state.audioFiles[0].pollError, 'Offline');
  api.get = async () => { throw { response: { status: 404 }, message: 'Not found' }; };
  await queue.poll();
  assert.equal(state.audioFiles[0].status, 'failed');
  assert.equal(created.length, 2);
});

test('late polling response after cancellation cannot overwrite a row or dispatch twice', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  const response = deferred();
  api.get = () => response.promise;
  const polling = queue.poll();
  await queue.stop(audio('A').path);
  response.resolve({ data: { task_id: '1', status: 'transcribing', progress: 50 } });
  await polling;
  assert.equal(state.audioFiles[0].status, 'cancelled');
  assert.equal(state.activeAudioId, audio('B').path);
  assert.equal(created.length, 2);
});

test('only waiting files can be removed, and a failed cancellation can be retried', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B'), audio('C')]);
  await queue.start();
  queue.remove(audio('A').path);
  queue.remove(audio('B').path);
  assert.equal(state.audioFiles.length, 2);
  const post = api.post;
  api.post = async () => { throw new Error('Offline'); };
  await queue.stop();
  assert.equal(state.audioFiles[0].stopRequested, false);
  assert.equal(created.length, 1);
  api.post = post;
  await queue.stop();
  assert.equal(state.audioFiles[0].status, 'cancelled');
  assert.equal(created.length, 1);
});

test('workspace new/restore keeps the entire group and exports the selected file independently', async () => {
  const workbenchSource = await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js', import.meta.url), 'utf8');
  const saved = [], timers = [];
  const build = new Function('reactive', 'ref', 'computed', 'onBeforeUnmount', 'api', 'createAudioQueue', 'setInterval', 'clearInterval', 'window',
    workbenchSource.replace(/^import .*;\n/gm, '').replace('export function useWorkbench', 'function useWorkbench') + '\nreturn useWorkbench;');
  const useWorkbench = build(reactive, ref, computed, () => {}, {}, createAudioQueue, callback => { timers.push(callback); return 0; }, () => {}, { mediaParser: { saveText: async value => { saved.push(value); return null; } } });
  const workspace = useWorkbench({ props: {}, locale: ref('zh-CN'), w: key => key });
  workspace.navigate('stt');
  workspace.audioQueue.append([audio('A'), audio('B')]);
  const row = workspace.states.stt.audioFiles[0];
  row.result = { text: 'A transcript', segments: [{ start: 0, end: 1.25, text: 'A subtitle' }] };
  row.status = 'completed';
  await workspace.save(row);
  await workspace.save(row, true);
  assert.match(saved[0].name, /^A_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/);
  assert.equal(saved[0].text, 'exportTitleLabel: A\n\nexportTranscriptLabel:\nA transcript');
  assert.equal(workspace.outputText(row), 'A transcript');
  assert.match(saved[1].name, /^A_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.srt$/);
  assert.match(saved[1].text, /00:00:01,250/);
  workspace.newTask();
  assert.equal(workspace.states.stt.audioFiles.length, 0);
  assert.equal(workspace.states.stt.history[0].audioFiles.length, 2);
  workspace.restore(0);
  assert.equal(workspace.states.stt.audioFiles[0].result.text, 'A transcript');
  assert.equal(workspace.states.stt.audioFiles[1].status, 'waiting');
});
