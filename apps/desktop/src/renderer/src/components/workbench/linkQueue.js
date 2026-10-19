const terminal = new Set(["completed", "failed", "cancelled"]);
const errorText = (error) => error?.response?.data?.error || error?.message || String(error);

// The workspace owns the group; each row owns exactly one backend task and result.
export function createLinkQueue({ getState, api, getLocale = () => "zh-CN", isAlive = () => true }) {
  const current = (s) => isAlive() && getState() === s;
  const active = (s) => s.linkFiles.find((row) => row.id === s.activeLinkId);

  const groupRequests = new WeakMap();
  function syncGroup(s) {
    if (!s.linkOutputGroupId) s.linkOutputGroupId = globalThis.crypto?.randomUUID?.() || `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    // Serialize promotions with dispatch, including appends while a request is in flight.
    s.linkGroupingOutputs = true;
    const previous = groupRequests.get(s) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const { data } = await api.post(`/api/transcript/groups/${s.linkOutputGroupId}`, { batch: s.linkFiles.length > 1 });
      if (!current(s)) return;
      if (s.error === s.linkOutputGroupError) s.error = "";
      s.linkOutputGroupError = "";
      for (const task of data.tasks || []) {
        const row = s.linkFiles.find(entry => entry.task?.task_id === task.task_id);
        if (row?.result && task.result) row.result = task.result;
      }
    });
    const tracked = pending.finally(() => {
      if (groupRequests.get(s) === tracked) s.linkGroupingOutputs = false;
    });
    groupRequests.set(s, tracked);
    return tracked;
  }

  function settle(s) {
    if (s.activeLinkId) return;
    s.linkQueueRunning = false;
    s.linkRetryOnlyId = null;
    s.status = s.linkFiles.some((row) => row.status === "waiting")
      ? "ready"
      : s.linkFiles.some((row) => row.status === "failed")
        ? "failed"
        : s.linkFiles.some((row) => row.status === "cancelled") ? "cancelled" : "completed";
  }

  function applyTask(s, row, task) {
    row.task = task;
    row.progress = task.progress || 0;
    row.stage = task.stage;
    row.error = task.error || "";
    row.pollError = "";
    if (terminal.has(task.status)) {
      row.status = task.status;
      row.result = task.result || null;
      if (row.result && !s.linkFiles.find((entry) => entry.id === s.selectedLinkId)?.result) s.selectedLinkId = row.id;
      row.cancelling = false;
      s.activeLinkId = null;
    } else {
      row.status = task.status === "stopping" ? "stopping" : "running";
    }
  }

  async function requestStop(s, row) {
    if (!row.task || terminal.has(row.status) || row.cancelling) return;
    const taskId = row.task.task_id;
    row.cancelling = true;
    try {
      const { data } = await api.post(`/api/transcript/local-stt/tasks/${taskId}/cancel`);
      if (!current(s) || terminal.has(row.status) || row.task?.task_id !== taskId) return;
      applyTask(s, row, data);
      if (s.activeLinkId) s.status = "stopping";
      else await dispatch(s);
    } catch (error) {
      if (current(s) && !terminal.has(row.status)) {
        row.pollError = errorText(error);
        row.stopRequested = false;
        s.status = "running";
      }
    } finally {
      row.cancelling = false;
    }
  }

  async function dispatch(s) {
    if (!current(s) || s.activeLinkId) return;
    if (!s.linkQueueRunning) { settle(s); return; }
    const row = s.linkFiles.find((entry) => entry.status === "waiting" && (!s.linkRetryOnlyId || entry.id === s.linkRetryOnlyId));
    if (!row) { settle(s); return; }
    // Reserve before resolving so new links and repeated starts cannot create parallel work.
    s.activeLinkId = row.id;
    s.status = "running";
    row.status = "running";
    row.stage = "resolving";
    row.stopRequested = false;
    row.error = "";
    try {
      await syncGroup(s);
      if (!current(s)) return;
      if (row.stopRequested) {
        row.status = "cancelled";
        s.activeLinkId = null;
        await dispatch(s);
        return;
      }
      const { data: target } = await api.post("/api/transcript/resolve", { url: row.url });
      if (!current(s)) return;
      row.sourceType = target.type;
      let endpoint = "/api/transcript/local-stt/tasks";
      const body = { language: s.linkQueueLanguage, export_locale: s.linkQueueLocale, output_group_id: s.linkOutputGroupId };
      if (!row.stopRequested) {
        if (target.type === "video") {
          const { data: info } = await api.post("/api/parse", { url: target.url });
          row.title = info.title || row.url;
          const format = info.formats?.find(entry => entry.ext === "m4a" && entry.has_audio);
          if (!format) throw new Error("未找到可转写的音频 / No transcribable audio found");
          endpoint += "/video";
          Object.assign(body, { url: info.source_url || target.url, title: info.title, format_id: format.format_id });
        } else {
          const { data: info } = await api.post("/api/podcast/parse", { url: target.url });
          if (!info.episode?.audio_url) throw new Error("未找到单集音频 / Episode audio not found");
          row.title = info.episode.title || row.url;
          Object.assign(body, { source_url: info.episode.audio_url, title: info.episode.title, source: target.url });
        }
      }
      if (!current(s)) return;
      if (row.stopRequested) {
        row.status = "cancelled";
        s.activeLinkId = null;
        await dispatch(s);
        return;
      }
      const { data } = await api.post(endpoint, body);
      if (!current(s)) return;
      applyTask(s, row, data);
      if (row.stopRequested && !terminal.has(row.status)) await requestStop(s, row);
      if (!s.activeLinkId) await dispatch(s);
    } catch (error) {
      if (!current(s)) return;
      row.status = row.stopRequested ? "cancelled" : "failed";
      row.error = row.stopRequested ? "" : errorText(error);
      s.activeLinkId = null;
      await dispatch(s);
    }
  }

  function append(links) {
    const s = getState();
    const duplicates = [];
    let added = false;
    for (const url of links) {
      if (s.linkFiles.some((row) => row.url === url)) {
        duplicates.push(url);
        continue;
      }
      s.linkFiles.push({
        id: url, url, title: url, status: "waiting", progress: 0, stage: "",
        task: null, result: null, resultView: "full", error: "", pollError: "",
        stopRequested: false, cancelling: false,
      });
      added = true;
    }
    if (!added) return duplicates;
    if (s.linkOutputGroupId && s.linkFiles.length > 1) {
      void syncGroup(s).catch(error => { if (current(s)) s.error = s.linkOutputGroupError = errorText(error); });
    }
    if (!s.selectedLinkId) s.selectedLinkId = s.linkFiles[0]?.id || null;
    if (s.linkQueueRunning) void dispatch(s);
    else if (!s.activeLinkId && s.mode === "url") s.status = "ready";
    return duplicates;
  }

  async function start() {
    const s = getState();
    if (s.activeLinkId || s.linkQueueRunning || s.mode !== "url") return;
    if (!s.linkFiles.some((row) => row.status === "waiting")) return;
    s.linkQueueLanguage = s.language;
    s.linkQueueLocale = getLocale();
    s.linkRetryOnlyId = null;
    s.linkQueueRunning = true;
    s.error = "";
    await dispatch(s);
  }

  async function poll() {
    const s = getState(), row = active(s);
    if (!row?.task || terminal.has(row.status)) return;
    const taskId = row.task.task_id;
    try {
      const { data } = await api.get(`/api/transcript/local-stt/tasks/${taskId}`);
      if (!current(s) || s.activeLinkId !== row.id || row.task?.task_id !== taskId) return;
      applyTask(s, row, data);
    } catch (error) {
      if (!current(s) || s.activeLinkId !== row.id) return;
      row.pollError = errorText(error);
      if (error?.response?.status === 404) {
        row.status = "failed";
        row.error = row.pollError;
        s.activeLinkId = null;
      }
    }
    if (current(s) && !s.activeLinkId) await dispatch(s);
  }

  async function stop(id) {
    const s = getState(), row = active(s);
    if (!id) s.linkQueueRunning = false;
    if (!row || (id && row.id !== id)) { if (!id) settle(s); return; }
    row.stopRequested = true;
    s.status = "stopping";
    await requestStop(s, row);
  }

  function remove(id) {
    const s = getState(), row = s.linkFiles.find((entry) => entry.id === id);
    if (!row || row.status !== "waiting") return;
    s.linkFiles = s.linkFiles.filter((entry) => entry.id !== id);
    if (s.selectedLinkId === id) s.selectedLinkId = s.linkFiles[0]?.id || null;
    if (!s.linkFiles.length) s.status = "idle";
  }

  async function retry(id) {
    const s = getState(), row = s.linkFiles.find((entry) => entry.id === id);
    if (!row || !["failed", "cancelled"].includes(row.status)) return;
    Object.assign(row, { status: "waiting", task: null, progress: 0, result: null, error: "", pollError: "", stopRequested: false, cancelling: false });
    // Retry the chosen link without rerunning completed results.
    s.linkFiles = [...s.linkFiles.filter((entry) => entry.id !== id), row];
    if (!s.activeLinkId && !s.linkQueueRunning) {
      s.linkQueueLanguage = s.language;
      s.linkQueueLocale = getLocale();
      s.linkRetryOnlyId = id;
      s.linkQueueRunning = true;
    }
    await dispatch(s);
  }

  return { append, start, poll, stop, remove, retry };
}
