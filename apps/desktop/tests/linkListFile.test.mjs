import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

test('native link picker accepts TXT/MD, reads the file, handles cancellation and rejects other or oversized files', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'media-link-list-'));
  t.after(() => rm(folder, {recursive:true, force:true}));
  const file = join(folder,'links.MD');
  await writeFile(file, '# Sources\nhttps://example.org/a');
  const source = await readFile(new URL('../src/main/index.ts', import.meta.url),'utf8');
  const fragment = source.slice(source.indexOf("ipcMain.handle('files:import-link-list'"), source.indexOf("ipcMain.handle('files:save-text'"));
  const handlers = new Map();
  let selection = {canceled:false, filePaths:[file]}, options;
  const parent = {isDestroyed:() => false};
  new Function('ipcMain','BrowserWindow','dialog','stat','readFile','extname','basename',ts.transpileModule(fragment,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(
    {handle:(key,handler) => handlers.set(key,handler)},
    {fromWebContents:() => parent},
    {showOpenDialog:async (window, config) => { assert.equal(window,parent);options=config;return selection; }},
    stat,readFile,extname,basename,
  );
  const read = () => handlers.get('files:import-link-list')({sender:{}});
  assert.deepEqual(await read(), {name:'links.MD',text:'# Sources\nhttps://example.org/a'});
  assert.deepEqual(options.filters[0].extensions, ['txt','md']);
  selection = {canceled:true,filePaths:[]};
  assert.equal(await read(), null);
  const unsupported = join(folder,'links.srt');
  await writeFile(unsupported,'text');selection={canceled:false,filePaths:[unsupported]};
  await assert.rejects(read,/TXT/);
  const large = join(folder,'large.txt');
  await writeFile(large,Buffer.alloc(2 * 1024 * 1024 + 1));selection.filePaths=[large];
  await assert.rejects(read,/2 MB/);
});
