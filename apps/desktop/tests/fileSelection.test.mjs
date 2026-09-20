import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reactive, ref, computed } from 'vue';
const source = await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js', import.meta.url), 'utf8');
const queueSource = await readFile(new URL('../src/renderer/src/components/workbench/audioQueue.js', import.meta.url), 'utf8');
const { createAudioQueue } = await import(`data:text/javascript;base64,${Buffer.from(queueSource).toString('base64')}`);
function setup() {
  const requests=[];
  const select=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
  const build = new Function('reactive','ref','computed','onBeforeUnmount','api','createAudioQueue','setInterval','clearInterval','window',source.replace(/^import .*;\n/gm,'').replace('export function useWorkbench','function useWorkbench')+'\nreturn useWorkbench;');
  const use=build(reactive,ref,computed,()=>{},{},createAudioQueue,()=>0,()=>{},{mediaParser:{selectAudioFiles:select,audioFilesFromDrop:select}});
  const w=use({props:{},locale:ref('zh-CN'),w:k=>k});w.navigate('stt');
  w.state.value.status='completed';
  w.state.value.audioFiles.push({id:'old',file:{name:'old.m4a',path:'/old'},status:'completed',result:{text:'preserved'}});
  return {w,requests};
}
const picked={files:[{path:'/new',name:'new.mp4',size:1}],errors:[]};
test('pending file choice does not lock completed task; new task ignores late return and preserves history',async()=>{
 const {w,requests}=setup(); const pending=w.chooseAudio();
 assert.equal(w.state.value.addingAudio,true);assert.equal(Boolean(w.busy(w.state.value)),false);
 w.newTask();requests[0].resolve(picked);await pending;
 assert.equal(w.state.value.audioFiles.length,0);
 assert.equal(w.state.value.history[0].audioFiles[0].result.text,'preserved');
 w.restore(0);assert.equal(w.state.value.addingAudio,false);
});
test('cancel permits another selection and stale completion cannot clear its waiting state',async()=>{
 const {w,requests}=setup();const first=w.chooseAudio();w.cancelAudioSelection();const second=w.chooseAudio();
 requests[0].resolve(picked);await first;
 assert.equal(w.state.value.addingAudio,true);assert.equal(w.state.value.audioFiles.length,1);
 requests[1].resolve(picked);await second;
 assert.equal(w.state.value.addingAudio,false);assert.equal(w.state.value.audioFiles.length,2);
});
test('mode switch rejects late selection even after switching back; cancellation and failure unlock',async()=>{
 const {w,requests}=setup();const first=w.chooseAudio();
 w.invalidate(w.state.value);w.state.value.mode='url';w.invalidate(w.state.value);w.state.value.mode='file';
 requests[0].reject(new Error('stale'));await first;assert.deepEqual(w.state.value.audioWarnings,[]);
 const second=w.chooseAudio();requests[1].resolve({files:[],errors:[]});await second;assert.equal(w.state.value.addingAudio,false);
 const third=w.chooseAudio();requests[2].reject(new Error('failed'));await third;assert.equal(w.state.value.addingAudio,false);assert.deepEqual(w.state.value.audioWarnings,['failed']);
});
test('active transcription remains protected while adding files can be cancelled independently',()=>{
 const {w}=setup();w.state.value.queueRunning=true;w.state.value.activeAudioId='old';w.state.value.addingAudio=true;
 w.cancelAudioSelection();assert.equal(Boolean(w.busy(w.state.value)),true);
 const old=w.state.value;w.newTask();assert.equal(w.state.value,old);
});
