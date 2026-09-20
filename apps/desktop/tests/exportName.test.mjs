import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { reactive, ref, computed } from 'vue';
const source=await readFile(new URL('../src/renderer/src/components/workbench/useWorkbench.js',import.meta.url),'utf8');
test('exports use local filename or source title and current local timestamp; contents stay intact',async()=>{
 const saved=[];
 let instant=new Date(2026,8,19,9,4,5);
 class Clock extends Date { constructor(){super(instant.getTime());} }
 const build=new Function('reactive','ref','computed','onBeforeUnmount','api','createAudioQueue','setInterval','clearInterval','window','Date',source.replace(/^import .*;\n/gm,'').replace('export function useWorkbench','function useWorkbench')+'\nreturn useWorkbench;');
 const use=build(reactive,ref,computed,()=>{},{},()=>({}),()=>0,()=>{},{mediaParser:{saveText:async input=>{saved.push(input);return null;}}},Clock);
 const w=use({props:{},locale:ref('zh-CN'),w:k=>k==='transcriptResult'?'转写文稿':k});w.navigate('stt');
 const s={file:{name:'我的录音.final.MP4'},result:{title:'其他标题',text:'正文',segments:[{start:0,end:1,text:'字幕'}]}};
 await w.save(s);assert.equal(saved.at(-1).name,'我的录音.final_2026-09-19_09-04-05.txt');
 instant=new Date(2026,8,19,9,5,6);await w.save(s,true);
 assert.equal(saved.at(-1).name,'我的录音.final_2026-09-19_09-05-06.srt');
 assert.equal(saved.at(-1).text,'1\n00:00:00,000 --> 00:00:01,000\n字幕');
 delete s.file;s.result.title='视频/播客:标题';await w.save(s);
 assert.equal(saved.at(-1).name,'视频_播客_标题_2026-09-19_09-05-06.txt');
 s.result.title='';s.info={episode:{title:'播客单集'}};await w.save(s);
 assert.equal(saved.at(-1).name,'播客单集_2026-09-19_09-05-06.txt');
 delete s.info;await w.save(s);assert.equal(saved.at(-1).name,'转写文稿_2026-09-19_09-05-06.txt');
 w.navigate('outline');await w.save(s);assert.equal(saved.at(-1).name,'result.txt');assert.equal(saved.at(-1).text,'正文');
});
