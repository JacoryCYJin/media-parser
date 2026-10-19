import { parseLinkList } from "../src/renderer/src/components/workbench/linkListInput.mjs";
import { createLinkQueue } from "../src/renderer/src/components/workbench/linkQueue.js";
import { recognizeVideoInput } from "../src/renderer/src/components/workbench/videoInput.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reactive, ref, computed } from 'vue';
const source = await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js', import.meta.url), 'utf8');
function setup(resolveParse, importFile = async () => null) {
  const calls=[];
  const api={post:async (url,body)=>{
    if (url.includes("/transcript/groups/")) return {data:{tasks:[]}};
    calls.push({url,body});
    if(url==='/api/transcript/resolve') return {data:{type:'video',url:body.url}};
    if(url==='/api/parse') return {data:await resolveParse()};
    return {data:{task_id:'new-task',status:'queued'}};
  }};
  const build=new Function('parseLinkList', 'window', 'createLinkQueue', 'recognizeVideoInput', 'reactive','ref','computed','onBeforeUnmount','api','createAudioQueue','setInterval','clearInterval',source.replace(/^import .*;\n/gm,'').replace('export function useWorkbench','function useWorkbench')+'\nreturn useWorkbench;');
  const use=build(parseLinkList, {mediaParser:{importLinkList:importFile}}, createLinkQueue, recognizeVideoInput, reactive,ref,computed,()=>{},api,()=>({}),()=>0,()=>{});
  const w=use({props:{},locale:ref('zh-CN'),w:k=>k});w.navigate('stt');
  Object.assign(w.state.value,{mode:'url',sourceType:'video',url:'https://example.org/video',language:'zh'});
  return {w,calls};
}
const audio={ext:'m4a',format_id:'audio-1',has_audio:true,has_video:false};
test('backend has_audio field selects valid M4A and creates video transcription',async()=>{
  const {w,calls}=setup(()=>({title:'Example',formats:[{ext:'mp4',has_audio:true},audio]}));
  await w.transcribe();
  assert.equal(calls.length,3);
  assert.deepEqual(calls[2],{url:'/api/transcript/local-stt/tasks/video',body:{language:'zh',export_locale:'zh-CN',output_group_id:w.state.value.linkOutputGroupId,url:'https://example.org/video',format_id:'audio-1',title:'Example'}});
  assert.equal(w.state.value.linkFiles[0].task.task_id,'new-task');
  assert.equal(w.state.value.error,'');
});
test('missing audio reports no formats without creating a task',async()=>{
  for(const formats of [[],[{...audio,has_audio:false}],[{ext:'mp4',has_audio:true}]]){
    const {w,calls}=setup(()=>({formats}));await w.transcribe();
    assert.equal(calls.length,2);assert.match(w.state.value.linkFiles[0].error,/No transcribable audio/);
    assert.equal(w.state.value.status,'failed');assert.equal(w.state.value.linkFiles[0].task,null);
  }
});
test('cancellation while parsing prevents task creation when valid audio arrives',async()=>{
  let resolve;
  const {w,calls}=setup(()=>new Promise(r=>resolve=r));
  const pending=w.transcribe();
  while(!resolve) await Promise.resolve();
  await w.cancelTranscript();
  resolve({title:'Example',formats:[audio]});await pending;
  assert.equal(calls.length,2);assert.equal(w.state.value.status,'cancelled');assert.equal(w.state.value.linkFiles[0].task,null);
});

test('multiline input normalizes links, skips duplicates and preserves the group in history', () => {
  const { w } = setup(() => ({}));
  w.state.value.url = 'https://www.bilibili.com/video/BV1HtHv64ENz?p=2&spm_id_from=333\nhttps://www.xiaoyuzhoufm.com/episode/example';
  assert.equal(w.addLinks(), true);
  assert.equal(w.state.value.linkFiles.length, 2);
  assert.equal(w.state.value.linkFiles[0].url, 'https://www.bilibili.com/video/BV1HtHv64ENz?p=2');
  w.state.value.url = 'https://www.xiaoyuzhoufm.com/episode/example';
  w.addLinks();
  assert.equal(w.state.value.linkFiles.length, 2);
  w.newTask();
  assert.equal(w.state.value.linkFiles.length, 0);
  w.restore(0);
  assert.equal(w.state.value.linkFiles.length, 2);
});

test('retry saving updates the selected row without starting a new transcription', async () => {
  const { w, calls } = setup(() => ({}));
  const row = { task:{task_id:'saved-task'}, result:{text:'Keep', saved:false} };
  await w.retrySave(row);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/transcript/local-stt/tasks/saved-task/save');
  assert.equal(row.saving, false);
  assert.equal(row.result.text, 'Keep');
});


test('import retains valid links in order, reports duplicate and invalid line numbers, and does not start jobs', async () => {
  const {w, calls} = setup(() => ({}), async () => ({name:'links.md', text:'# Collection\nhttps://example.org/a\n[Podcast](https://example.org/b.mp3)\nhttps://example.org/a\ninvalid\nhttps://example.org/a https://example.org/b'}));
  w.state.value.url = 'https://example.org/a';
  w.addLinks();
  w.state.value.url = 'unsubmitted draft';
  await w.importLinkList();
  assert.deepEqual(w.state.value.linkFiles.map(row => row.url), ['https://example.org/a', 'https://example.org/b.mp3']);
  assert.equal(w.state.value.url, 'unsubmitted draft');
  assert.equal(calls.length, 0);
  assert.deepEqual(w.state.value.linkImportReport, {name:'links.md', added:1, duplicates:[2,4], invalid:[{line:5, error:'invalidLinkLine'}, {line:6,error:'oneLinkPerLine'}]});
  assert.equal(w.state.value.importingLinks, false);
});

test('cancelled and failed imports preserve existing links and allow another import', async () => {
  let fail = false;
  const {w} = setup(() => ({}), async () => { if(fail) throw new Error('File unavailable'); return null; });
  w.state.value.url = 'https://example.org/a';w.addLinks();
  await w.importLinkList();
  assert.equal(w.state.value.linkFiles.length, 1);
  assert.equal(w.state.value.importingLinks, false);
  fail = true;
  await w.importLinkList();
  assert.equal(w.state.value.linkImportError, 'File unavailable');
  assert.equal(w.state.value.importingLinks, false);
  assert.equal(w.state.value.linkFiles.length, 1);
});

test('late file selection cannot append into a new task or a different input mode', async () => {
  let resolve;
  const {w} = setup(() => ({}), () => new Promise(r => resolve = r));
  const pending = w.importLinkList();
  w.newTask();
  resolve({name:'late.txt',text:'https://example.org/a'});
  await pending;
  assert.equal(w.state.value.linkFiles.length, 0);
  w.state.value.mode = 'url';
  const second = w.importLinkList();
  w.invalidate(w.state.value);w.state.value.mode='file';
  resolve({name:'late.txt',text:'https://example.org/a'});
  await second;
  assert.equal(w.state.value.linkFiles.length, 0);
  assert.equal(w.state.value.importingLinks, false);
});

test('empty and all-invalid files report zero added without starting a queue', async () => {
  let text = '# Title\n<!-- comment -->';
  const {w,calls} = setup(() => ({}), async () => ({name:'empty.md',text}));
  await w.importLinkList();
  assert.equal(w.state.value.linkImportReport.added, 0);
  assert.equal(w.state.value.linkImportReport.invalid.length, 0);
  text = 'bad line';await w.importLinkList();
  assert.equal(w.state.value.linkImportReport.invalid[0].line, 1);
  assert.equal(calls.length, 0);
});
