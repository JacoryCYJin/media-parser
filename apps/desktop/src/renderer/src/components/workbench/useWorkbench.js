import { reactive, ref, computed, onBeforeUnmount } from "vue";
import api from "../../lib/apiClient";
import { createAudioQueue } from "./audioQueue";
import { createLinkQueue } from "./linkQueue";
import { recognizeVideoInput } from "./videoInput.mjs";
import { parseLinkList } from "./linkListInput.mjs";

const activeDownload = new Set(["QUEUED", "DOWNLOADING", "PAUSED"]);
const fresh = () => ({
  url: "",
  title: "",
  text: "",
  file: null,
  audioFiles: [],
  linkFiles: [],
  importingLinks: false,
  linkImportReport: null,
  linkImportError: "",
  audioOutputGroupId: "",
  audioGroupingOutputs: false,
  linkGroupingOutputs: false,
  linkOutputGroupId: "",
  selectedLinkId: null,
  activeLinkId: null,
  linkQueueRunning: false,
  selectedAudioId: null,
  activeAudioId: null,
  queueRunning: false,
  queueLanguage: "",
  retryOnlyId: null,
  addingAudio: false,
  audioWarnings: [],
  mode: "file",
  sourceType: "video",
  language: "",
  outputLanguage: "zh",
  status: "idle",
  error: "",
  info: null,
  result: null,
  resultView: "full",
  audioKind: "video",
  parsedInputUrl: "",
  downloads: [],
  creatingDownload: false,
  transcriptTask: null,
  history: [],
  revision: 0,
  operation: "",
});
export function useWorkbench({ props, locale, w }) {
  const page = ref("home");
  const states = reactive({
    video: fresh(),
    podcast: fresh(),
    stt: fresh(),
    outline: fresh(),
  });
  for (const s of Object.values(states)) {
    s.outputLanguage = locale.value.startsWith("en") ? "en" : "zh";
  }
  const notice = ref("");
  let alive = true,
    polling = false,
    toastTimer;
  let audioSelectionId = 0, linkImportId = 0;
  function cancelAudioSelection() {
    audioSelectionId++;
    states.stt.addingAudio = false;
    linkImportId++;
    states.stt.importingLinks = false;
  }
  const state = computed(() => states[page.value]);
  const visibleDownloads = computed(() => {
    const s = state.value;
    if (!s) return [];
    if (page.value !== "video") return s.downloads;
    if (!s.info || (s.operation === "parse" && s.status === "running")) return [];
    return s.downloads.filter((d) =>
      (d.sourceUrl || d.request?.url) === (s.info.source_url || s.parsedInputUrl) ||
      (d.sourceInputUrl && d.sourceInputUrl === s.parsedInputUrl),
    );
  });
  const busy = (s) =>
    s &&
    (s.creatingDownload || s.audioGroupingOutputs || s.linkGroupingOutputs || s.queueRunning || s.activeAudioId || s.linkQueueRunning || s.activeLinkId ||
      ["running", "stopping"].includes(s.status) ||
      s.downloads.some((d) => activeDownload.has(d.status)));
  const message = (e) => e?.response?.data?.error || e?.message || String(e);
  const toast = (text) => {
    notice.value = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (notice.value = ""), 4500);
  };
  const fail = (s, e) => {
    s.error = message(e);
    s.status = "failed";
  };
  const validUrl = (url) => {
    try {
      return ["http:", "https:"].includes(new URL(url.trim()).protocol);
    } catch {
      return false;
    }
  };
  function navigate(k) {
    if (k !== page.value) cancelAudioSelection();
    page.value = k;
  }
  function newTask() {
    const s = state.value;
    if (!s || busy(s)) return;
    if (page.value === "stt") cancelAudioSelection();
    const history = [...s.history];
    if (s.url || s.text || s.file || s.audioFiles.length || s.linkFiles.length)
      history.unshift(JSON.parse(JSON.stringify({ ...s, history: [] })));
    states[page.value] = {
      ...fresh(),
      history: history.slice(0, 10),
      outputLanguage: locale.value.startsWith("en") ? "en" : "zh",
    };
  }
  function restore(i) {
    const s = state.value;
    if (!s || busy(s)) return;
    if (page.value === "stt") cancelAudioSelection();
    const record = JSON.parse(JSON.stringify(s.history[i]));
    if (!record) return;
    const history = [...s.history];
    if (s.url || s.text || s.file || s.audioFiles.length || s.linkFiles.length)
      history.push(JSON.parse(JSON.stringify({ ...s, history: [] })));
    Object.assign(s, record, {
      addingAudio: false,
      importingLinks: false,
      history: history.slice(0, 10),
      revision: s.revision + 1,
    });
  }
  function invalidate(s, source = false) {
    if (busy(s)) return;
    if (s === states.stt) cancelAudioSelection();
    s.result = null;
    s.error = "";
    s.status = "idle";
    s.revision++;
    if (source) s.info = null;
  }
  async function parse(s, kind) {
    if (busy(s)) return;
    const source = kind === "video" ? recognizeVideoInput(s.url) : { url: s.url.trim() };
    if (source.error || (kind !== "video" && !validUrl(source.url))) {
      s.error = w(source.error || "invalidUrl");
      return;
    }
    const inputUrl = source.url;
    const changedSource = s.parsedInputUrl !== inputUrl;
    s.operation = "parse";
    s.status = "running";
    s.error = "";
    s.info = null;
    try {
      const { data } = await api.post(
        kind === "video" ? "/api/parse" : "/api/podcast/parse",
        { url: inputUrl },
      );
      s.info = data;
      s.parsedInputUrl = inputUrl;
      if (kind === "video") {
        const formats = data.formats || [];
        const hasVideo = formats.some((f) => f.ext === "mp4");
        const hasAudio = formats.some((f) => f.ext === "m4a");
        if (changedSource || (s.audioKind === "audio" ? !hasAudio : !hasVideo))
          s.audioKind = hasVideo || !hasAudio ? "video" : "audio";
      }
      s.status = "ready";
    } catch (e) {
      fail(s, e);
    }
  }
  async function download(s, kind, format, request) {
    if (s.creatingDownload || (!request && !s.info)) return;
    s.creatingDownload = true;
    s.error = "";
    try {
      const body =
        request ||
        (kind === "video"
          ? {
              url: s.info.source_url || s.url,
              format_id: format.format_id,
              resolution: format.ext === "m4a" ? "audio" : format.resolution,
              output_dir: props.downloadDir,
            }
          : {
              url: s.info.episode.audio_url,
              title: s.info.episode.title,
              output_dir: props.downloadDir,
            });
      const { data } = await api.post(
        kind === "video" ? "/api/download" : "/api/download/audio",
        body,
      );
      s.downloads.unshift({
        ...data,
        task_id: data.task_id,
        status: data.status || "QUEUED",
        name:
          kind === "video"
            ? `${format.ext.toUpperCase()} · ${format.resolution}`
            : body.title,
        request: { ...body },
        sourceUrl: body.url,
        sourceInputUrl: request ? "" : s.parsedInputUrl,
        kind,
        format,
        progress: 0,
      });
    } catch (e) {
      s.error = message(e);
    } finally {
      s.creatingDownload = false;
    }
  }
  async function controlDownload(s, d, action) {
    try {
      const { data } = await api.post(
        `/api/download/tasks/${d.task_id}/${action}`,
      );
      Object.assign(d, data);
    } catch (e) {
      s.error = message(e);
    }
  }
  async function reveal(path) {
    try {
      await api.post("/api/reveal", { path });
    } catch (e) {
      toast(message(e));
    }
  }
  const audioQueue = createAudioQueue({ getState: () => states.stt, api, getLocale: () => locale.value, isAlive: () => alive });
  const linkQueue = createLinkQueue({ getState: () => states.stt, api, getLocale: () => locale.value, isAlive: () => alive });
  async function chooseAudio(files) {
    const s = states.stt;
    if (s.addingAudio || s.mode !== "file") return;
    const selectionId = ++audioSelectionId;
    const isCurrent = () => alive && states.stt === s && s.mode === "file" && selectionId === audioSelectionId;
    s.addingAudio = true;
    s.audioWarnings = [];
    try {
      const chosen = files
        ? await window.mediaParser.audioFilesFromDrop(Array.from(files))
        : await window.mediaParser.selectAudioFiles();
      if (!isCurrent()) return;
      const duplicates = audioQueue.append(chosen.files);
      s.audioWarnings = [...chosen.errors, ...duplicates.map(name => `${w("duplicateAudio")}: ${name}`)];
    } catch (e) {
      if (isCurrent()) s.audioWarnings = [message(e)];
    } finally {
      if (isCurrent()) s.addingAudio = false;
    }
  }
  async function importText() {
    const s = states.outline;
    if (busy(s)) return;
    try {
      const result = await window.mediaParser.importText();
      if (result) {
        invalidate(s);
        s.text = result.text;
        s.title = result.name.replace(/\.[^.]+$/, "");
      }
    } catch (e) {
      s.error = message(e);
    }
  }
  async function importLinkList() {
    const s = states.stt;
    if (s.mode !== "url" || s.importingLinks) return;
    const id = ++linkImportId;
    const isCurrent = () => alive && states.stt === s && s.mode === "url" && id === linkImportId;
    s.importingLinks = true;
    s.linkImportError = "";
    try {
      const file = await window.mediaParser.importLinkList();
      if (!isCurrent() || !file) return;
      const { entries, invalid } = parseLinkList(file.text);
      const known = new Set(s.linkFiles.map(row => row.url));
      const urls = [], duplicates = [];
      for (const entry of entries) {
        if (known.has(entry.url)) duplicates.push(entry.line);
        else { known.add(entry.url); urls.push(entry.url); }
      }
      if (urls.length) linkQueue.append(urls);
      s.linkImportReport = { name: file.name, added: urls.length, duplicates, invalid };
    } catch (error) {
      if (isCurrent()) s.linkImportError = message(error);
    } finally {
      if (isCurrent()) s.importingLinks = false;
    }
  }
  function addLinks() {
    const s = states.stt;
    const lines = s.url.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (!lines.length) return true;
    const urls = [];
    for (const line of lines) {
      const target = recognizeVideoInput(line);
      if (target.error) { s.error = w(target.error); return false; }
      urls.push(target.url);
    }
    const duplicates = linkQueue.append(urls);
    s.url = "";
    s.error = "";
    if (duplicates.length) toast(w("duplicateLinks"));
    return true;
  }
  async function transcribe() {
    const s = states.stt;
    if (busy(s)) return;
    if (s.mode === "file") { await audioQueue.start(); return; }
    if (addLinks()) await linkQueue.start();
  }
  async function cancelTranscript() {
    if (states.stt.mode === "file") await audioQueue.stop();
    else await linkQueue.stop();
  }
  async function retrySave(row) {
    if (!row?.task || row.saving) return;
    row.saving = true;
    try {
      const { data } = await api.post(`/api/transcript/local-stt/tasks/${row.task.task_id}/save`);
      row.result = data.result || row.result;
    } catch (e) {
      row.result.save_error = message(e);
    } finally {
      row.saving = false;
    }
  }
  async function generate() {
    const s = states.outline;
    if (busy(s)) return;
    if (s.text.replace(/\s/g, "").length < 100) {
      s.error = w("textMin");
      return;
    }
    s.status = "running";
    s.operation = "outline";
    s.error = "";
    s.result = null;
    const revision = ++s.revision;
    try {
      const { data } = await api.post("/api/outline", {
        title: s.title.trim(),
        transcript: s.text,
        language: s.outputLanguage,
      });
      if (!alive || revision !== s.revision) return;
      s.result = data.outline;
      s.mock = Boolean(data.mock);
      s.status = "completed";
    } catch (e) {
      if (alive && revision === s.revision) fail(s, e);
    }
  }
  function stopOutline() {
    const s = states.outline;
    s.revision++;
    s.status = "cancelled";
    s.error = "";
    toast(w("waitingStopped"));
  }
  function outputText(s) {
    if (!s.result) return "";
    if (s.result.text !== undefined) return s.result.text;
    return [
      s.result.title,
      s.result.summary,
      ...(s.result.nodes || []).flatMap((n) => [
        n.title,
        n.summary,
        ...(n.children || []).map(
          (c) => `- ${c.title}${c.summary ? ": " + c.summary : ""}`,
        ),
      ]),
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(w("copyDone"));
    } catch {
      toast(w("copyFallback"));
    }
  }
  const time = (seconds) => {
    const n = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    return `${String(Math.floor(n / 3600000)).padStart(2, "0")}:${String(Math.floor(n / 60000) % 60).padStart(2, "0")}:${String(Math.floor(n / 1000) % 60).padStart(2, "0")},${String(n % 1000).padStart(3, "0")}`;
  };
  async function save(s, srt = false) {
    let name = s.file?.name ? `${s.file.name.replace(/\.[^.]+$/, "")}.${srt ? "srt" : "txt"}` : srt ? "transcript.srt" : "result.txt";
    if (page.value === "stt") {
      const title = [s.file?.name?.replace(/\.[^.]+$/, ""), s.result?.title,
        s.info?.episode?.title, s.info?.title, s.title]
        .find((value) => typeof value === "string" && value.trim());
      const stem = (title || w("transcriptResult")).trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "")
        .slice(0, 60) || w("transcriptResult");
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      name = `${stem}_${stamp}.${srt ? "srt" : "txt"}`;
    }
    const text = srt
      ? (s.result.segments || [])
          .map(
            (v, i) =>
              `${i + 1}\n${time(v.start)} --> ${time(v.end)}\n${v.text}`,
          )
          .join("\n\n")
      : page.value === "stt"
        ? s.result.export_text ?? `${w("exportTitleLabel")}: ${s.result.title || s.file?.name?.replace(/\.[^.]+$/, "") || s.info?.title || s.title || w("transcriptResult")}\n\n${w("exportTranscriptLabel")}:\n${outputText(s)}`
        : outputText(s);
    try {
      const result = await window.mediaParser.saveText({
        name,
        text,
      });
      if (result) toast(w("saved"));
    } catch (e) {
      toast(message(e));
    }
  }
  const poller = setInterval(async () => {
    if (!alive || polling) return;
    polling = true;
    try {
      await Promise.all(
        Object.values(states).flatMap((s) =>
          s.downloads
            .filter((d) => activeDownload.has(d.status))
            .map(async (d) => {
              try {
                const { data } = await api.get(
                  `/api/download/tasks/${d.task_id}`,
                );
                if (alive) {
                  Object.assign(d, data);
                  d.pollError = "";
                }
              } catch (e) {
                d.pollError = message(e);
                if (e?.response?.status === 404) d.status = "FAILED";
              }
            }),
        ),
      );
      await audioQueue.poll();
      await linkQueue.poll();
    } finally {
      polling = false;
    }
  }, 1000);
  onBeforeUnmount(() => {
    alive = false;
    clearInterval(poller);
    clearTimeout(toastTimer);
  });
  return {
    page,
    states,
    state,
    visibleDownloads,
    busy,
    notice,
    navigate,
    newTask,
    restore,
    invalidate,
    parse,
    download,
    controlDownload,
    reveal,
    chooseAudio,
    cancelAudioSelection,
    audioQueue,
    linkQueue,
    addLinks,
    importLinkList,
    retrySave,
    importText,
    transcribe,
    cancelTranscript,
    generate,
    stopOutline,
    outputText,
    copy,
    save,
    time,
  };
}
