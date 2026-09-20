import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reactive, ref, computed } from 'vue';
const source = await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js', import.meta.url), 'utf8');
function setup(resolveParse) {
  const calls=[];
  const api={post:async (url,body)=>{
    calls.push({url,body});
    if(url==='/api/parse') return {data:await resolveParse()};
    return {data:{task_id:'new-task',status:'queued'}};
  }};
  const build=new Function('reactive','ref','computed','onBeforeUnmount','api','createAudioQueue','setInterval','clearInterval',source.replace(/^import .*;\n/gm,'').replace('export function useWorkbench','function useWorkbench')+'\nreturn useWorkbench;');
  const use=build(reactive,ref,computed,()=>{},api,()=>({}),()=>0,()=>{});
  const w=use({props:{},locale:ref('zh-CN'),w:k=>k});w.navigate('stt');
  Object.assign(w.state.value,{mode:'url',sourceType:'video',url:'https://example.org/video',language:'zh'});
  return {w,calls};
}
const audio={ext:'m4a',format_id:'audio-1',has_audio:true,has_video:false};
test('backend has_audio field selects valid M4A and creates video transcription',async()=>{
  const {w,calls}=setup(()=>({title:'Example',formats:[{ext:'mp4',has_audio:true},audio]}));
  await w.transcribe();
  assert.equal(calls.length,2);
  assert.deepEqual(calls[1],{url:'/api/transcript/local-stt/tasks/video',body:{language:'zh',url:'https://example.org/video',format_id:'audio-1',title:'Example'}});
  assert.equal(w.state.value.transcriptTask.task_id,'new-task');
  assert.equal(w.state.value.error,'');
});
test('missing audio reports no formats without creating a task',async()=>{
  for(const formats of [[],[{...audio,has_audio:false}],[{ext:'mp4',has_audio:true}]]){
    const {w,calls}=setup(()=>({formats}));await w.transcribe();
    assert.equal(calls.length,1);assert.equal(w.state.value.error,'noFormats');
    assert.equal(w.state.value.status,'failed');assert.equal(w.state.value.transcriptTask,null);
  }
});
test('cancellation while parsing prevents task creation when valid audio arrives',async()=>{
  let resolve;
  const {w,calls}=setup(()=>new Promise(r=>resolve=r));
  const pending=w.transcribe();await w.cancelTranscript();
  resolve({title:'Example',formats:[audio]});await pending;
  assert.equal(calls.length,1);assert.equal(w.state.value.status,'cancelled');assert.equal(w.state.value.transcriptTask,null);
});
