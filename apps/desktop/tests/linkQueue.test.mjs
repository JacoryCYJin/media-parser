import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive } from 'vue';
import { createLinkQueue } from '../src/renderer/src/components/workbench/linkQueue.js';
const audio = name => `https://example.org/${name}.${name === 'B' ? 'mp3' : 'm4a'}`;
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function setup() {
  const state = reactive({ linkFiles: [], activeLinkId: null, selectedLinkId: null, linkQueueRunning: false, linkRetryOnlyId: null, language: 'zh', mode: 'url', status: 'idle' });
  const created = [], tasks = new Map();
  const api = {
    async post(url, body) {
      if (url.includes("/transcript/groups/")) return {data:{tasks:[]}};
      if (url.endsWith('/cancel')) {
        const id = url.split('/').at(-2);
        tasks.set(id, { ...tasks.get(id), status: 'cancelled' });
        return { data: tasks.get(id) };
      }
      if (url === '/api/transcript/resolve') return { data: { type: body.url.includes('/B.') ? 'podcast' : 'video', url: body.url } };
      if (url === '/api/parse') return { data: { title: body.url, formats: [{ext:'m4a', has_audio:true, format_id:'a'}] } };
      if (url === '/api/podcast/parse') return { data: { episode: { title: body.url, audio_url: body.url } } };
      const id = String(created.length + 1);
      created.push(body.url || body.source_url);
      const data = { task_id: id, status: 'transcribing', progress: 0 };
      tasks.set(id, data);
      return { data };
    },
    async get(url) { return { data: tasks.get(url.split('/').at(-1)) }; },
  };
  const queue = createLinkQueue({ getState: () => state, api });
  const complete = async (status = 'completed') => {
    const row = state.linkFiles.find(row => row.id === state.activeLinkId);
    tasks.set(row.task.task_id, { task_id: row.task.task_id, status, progress: 100, result: status === 'completed' ? { text: row.url, segments: [] } : null, error: status === 'failed' ? 'Recognition failed' : '' });
    await queue.poll();
  };
  return { state, queue, api, created, tasks, complete };
}

test('multi-select, later append and duplicate paths preserve independent results and order', async () => {
  const { state, queue, created, complete } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  assert.deepEqual(created, [audio('A')]);
  assert.deepEqual(queue.append([audio('A'), audio('C')]), [audio('A')]);
  await queue.start(); // Repeated clicks cannot reserve a second slot.
  assert.equal(created.length, 1);
  await complete();
  assert.deepEqual(created, [audio('A'), audio('B')]);
  assert.equal(state.linkFiles[0].result.text, audio('A'));
  await complete();
  assert.equal(created[2], audio('C'));
  await complete();
  assert.equal(state.status, 'completed');
  assert.deepEqual(state.linkFiles.map(row => row.result.text), [audio('A'), audio('B'), audio('C')]);
  queue.append([audio('D')]);
  assert.equal(created.length, 3); // Adding after completion waits for another Start.
  assert.equal(state.linkFiles[0].result.text, audio('A'));
});

test('recognition failure advances to the next link', async () => {
  const { queue, created, complete, state } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await complete('failed');
  assert.equal(state.linkFiles[0].status, 'failed');
  assert.equal(created[1], audio('B'));
  await complete();
  assert.equal(state.linkFiles[1].result.text, audio('B'));
});

test('a rejected creation does not block later links', async () => {
  const { queue, api, created, state } = setup();
  const post = api.post;
  api.post = (url, body) => body?.url === audio('A') ? Promise.reject(new Error('Invalid link')) : post(url, body);
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  assert.equal(state.linkFiles[0].error, 'Invalid link');
  assert.deepEqual(created, [audio('B')]);
});

test('stop all pauses pending links; retry only restarts the chosen cancelled link', async () => {
  const { queue, state, created, complete } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await queue.stop();
  assert.equal(state.linkFiles[0].status, 'cancelled');
  assert.equal(state.linkFiles[1].status, 'waiting');
  assert.equal(created.length, 1);
  await queue.retry(audio('A'));
  assert.equal(created[1], audio('A'));
  await complete();
  assert.equal(created.length, 2);
  assert.equal(state.linkFiles.find(row => row.url === audio('B')).status, 'waiting');
  await queue.start();
  assert.equal(created[2], audio('B'));
});

test('stopping one link continues the group', async () => {
  const { queue, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  await queue.stop(audio('A'));
  assert.deepEqual(created, [audio('A'), audio('B')]);
});

test('stop during creation cancels the returned backend task before starting another', async () => {
  const { queue, api, state, created } = setup();
  const pending = deferred(), post = api.post;
  let cancelCount = 0;
  api.post = async (url, body) => {
    if (url.endsWith('/cancel')) { cancelCount++; return post(url, body); }
    if (!url.includes('/tasks')) return post(url, body);
    const result = await post(url, body);
    await pending.promise;
    return result;
  };
  queue.append([audio('A'), audio('B')]);
  const start = queue.start();
  while (!created.length) await Promise.resolve();
  await queue.stop();
  queue.append([audio('C')]);
  pending.resolve();
  await start;
  assert.equal(cancelCount, 1);
  assert.equal(created.length, 1);
  assert.equal(state.linkFiles[0].status, 'cancelled');
});

test('temporary polling errors keep the active slot; a missing task fails and advances', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  api.get = async () => { throw new Error('Offline'); };
  await queue.poll();
  assert.equal(created.length, 1);
  assert.equal(state.linkFiles[0].pollError, 'Offline');
  api.get = async () => { throw { response: { status: 404 }, message: 'Not found' }; };
  await queue.poll();
  assert.equal(state.linkFiles[0].status, 'failed');
  assert.equal(created.length, 2);
});

test('late polling response after cancellation cannot overwrite a row or dispatch twice', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  const response = deferred();
  api.get = () => response.promise;
  const polling = queue.poll();
  await queue.stop(audio('A'));
  response.resolve({ data: { task_id: '1', status: 'transcribing', progress: 50 } });
  await polling;
  assert.equal(state.linkFiles[0].status, 'cancelled');
  assert.equal(state.activeLinkId, audio('B'));
  assert.equal(created.length, 2);
});

test('only waiting links can be removed, and a failed cancellation can be retried', async () => {
  const { queue, api, state, created } = setup();
  queue.append([audio('A'), audio('B'), audio('C')]);
  await queue.start();
  queue.remove(audio('A'));
  queue.remove(audio('B'));
  assert.equal(state.linkFiles.length, 2);
  const post = api.post;
  api.post = async () => { throw new Error('Offline'); };
  await queue.stop();
  assert.equal(state.linkFiles[0].stopRequested, false);
  assert.equal(created.length, 1);
  api.post = post;
  await queue.stop();
  assert.equal(state.linkFiles[0].status, 'cancelled');
  assert.equal(created.length, 1);
});


test('saving failure preserves first result and still advances to the next source', async () => {
  const { state, queue, tasks, created, complete } = setup();
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  tasks.set('1', { task_id:'1', status:'completed', result:{text:'Keep this', saved:false, save_error:'read only'} });
  await queue.poll();
  assert.equal(state.linkFiles[0].result.text, 'Keep this');
  assert.equal(state.linkFiles[0].result.saved, false);
  assert.equal(created[1], audio('B'));
  await complete();
});

test('stopping while resolving prevents recognition and keeps remaining links waiting', async () => {
  const { state, queue, api, created } = setup();
  const response = deferred(), post = api.post;
  api.post = (url, body) => url === '/api/transcript/resolve' ? response.promise : post(url, body);
  queue.append([audio('A'), audio('B')]);
  const start = queue.start();
  await queue.stop();
  response.resolve({ data:{ type:'video', url:audio('A') } });
  await start;
  assert.equal(created.length, 0);
  assert.equal(state.linkFiles[0].status, 'cancelled');
  assert.equal(state.linkFiles[1].status, 'waiting');
});

test('mixed source dispatch snapshots language and export locale for the whole queue', async () => {
  const { state, queue, api, complete } = setup();
  const calls = [], post = api.post;
  api.post = (url, body) => { calls.push({url, body}); return post(url, body); };
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  state.language = 'en';
  await complete();
  const jobs = calls.filter(call => call.url.includes('/tasks'));
  assert.equal(jobs[0].url, '/api/transcript/local-stt/tasks/video');
  assert.equal(jobs[1].url, '/api/transcript/local-stt/tasks');
  assert.equal(jobs[1].body.language, 'zh');
  assert.equal(jobs[1].body.export_locale, 'zh-CN');
});

test('a single link becomes a batch on later append and refreshes saved paths', async () => {
  const { state, queue, api, complete, tasks } = setup();
  const requests = [], post = api.post;
  api.post = async (url, body) => {
    if (!url.includes('/transcript/groups/')) return post(url, body);
    requests.push({url, batch:body.batch});
    if (body.batch) {
      for (const task of tasks.values()) {
        if (task.result) task.result = {...task.result, output_dir:'/downloads/timestamp', files:{txt:'/downloads/timestamp/first.txt'}};
      }
    }
    return {data:{tasks:[...tasks.values()]}};
  };
  queue.append([audio('A')]);
  await queue.start();
  const groupId = state.linkOutputGroupId;
  assert.equal(requests[0].batch, false);
  await complete();
  state.linkFiles[0].result.files = {txt:'/downloads/first.txt'};
  queue.append([audio('B')]);
  await queue.start();
  assert.equal(state.linkOutputGroupId, groupId);
  assert.equal(state.linkFiles[0].result.files.txt, '/downloads/timestamp/first.txt');
  assert.equal(requests.at(-1).batch, true);
  assert.ok(requests.every(request => request.url.endsWith(groupId)));
});

test('grouping failure does not start recognition; retry preserves the group identity', async () => {
  const {state, queue, api, created} = setup();
  const post = api.post;
  let failed = true;
  api.post = (url, body) => {
    if (url.includes('/transcript/groups/') && failed) return Promise.reject(new Error('folder unavailable'));
    return post(url, body);
  };
  queue.append([audio('A'), audio('B')]);
  await queue.start();
  assert.equal(created.length, 0);
  assert.equal(state.linkFiles[0].status, 'failed');
  const groupId = state.linkOutputGroupId;
  failed = false;
  await queue.retry(audio('A'));
  assert.equal(state.linkOutputGroupId, groupId);
  assert.deepEqual(created, [audio('A')]);
});
