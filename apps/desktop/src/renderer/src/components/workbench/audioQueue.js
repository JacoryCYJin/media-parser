const terminal = new Set(["completed", "failed", "cancelled"]);
const errorText = (error) => error?.response?.data?.error || error?.message || String(error);

// The workspace owns the group; each row owns exactly one backend task and result.
export function createAudioQueue({ getState, api, isAlive = () => true }) {
  const current = (s) => isAlive() && getState() === s;
  const active = (s) => s.audioFiles.find((row) => row.id === s.activeAudioId);

  function settle(s) {
    if (s.activeAudioId) return;
    s.queueRunning = false;
    s.retryOnlyId = null;
    s.status = s.audioFiles.some((row) => row.status === "waiting")
      ? "ready"
      : s.audioFiles.some((row) => row.status === "failed")
        ? "failed"
        : s.audioFiles.some((row) => row.status === "cancelled") ? "cancelled" : "completed";
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
      if (row.result && !s.audioFiles.find((entry) => entry.id === s.selectedAudioId)?.result) s.selectedAudioId = row.id;
      row.cancelling = false;
      s.activeAudioId = null;
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
      if (s.activeAudioId) s.status = "stopping";
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
    if (!current(s) || s.activeAudioId) return;
    if (!s.queueRunning) { settle(s); return; }
    const row = s.audioFiles.find((entry) => entry.status === "waiting" && (!s.retryOnlyId || entry.id === s.retryOnlyId));
    if (!row) { settle(s); return; }
    // Reserve the slot before any await, including when files are appended mid-request.
    s.activeAudioId = row.id;
    s.status = "running";
    row.status = "running";
    row.stage = "queued";
    row.stopRequested = false;
    row.error = "";
    try {
      const { data } = await api.post("/api/transcript/local-stt/tasks/local", {
        path: row.file.path, language: s.queueLanguage,
      });
      if (!current(s)) return;
      applyTask(s, row, data);
      if (row.stopRequested && !terminal.has(row.status)) await requestStop(s, row);
      if (!s.activeAudioId) await dispatch(s);
    } catch (error) {
      if (!current(s)) return;
      row.status = "failed";
      row.error = errorText(error);
      s.activeAudioId = null;
      await dispatch(s);
    }
  }

  function append(files) {
    const s = getState();
    const duplicates = [];
    let added = false;
    for (const file of files) {
      if (s.audioFiles.some((row) => row.file.path === file.path)) {
        duplicates.push(file.name);
        continue;
      }
      s.audioFiles.push({
        id: file.path, file, status: "waiting", progress: 0, stage: "",
        task: null, result: null, resultView: "full", error: "", pollError: "",
        stopRequested: false, cancelling: false,
      });
      added = true;
    }
    if (!added) return duplicates;
    if (!s.selectedAudioId) s.selectedAudioId = s.audioFiles[0]?.id || null;
    if (s.queueRunning) void dispatch(s);
    else if (!s.activeAudioId && s.mode === "file") s.status = "ready";
    return duplicates;
  }

  async function start() {
    const s = getState();
    if (s.activeAudioId || s.queueRunning || s.mode !== "file") return;
    if (!s.audioFiles.some((row) => row.status === "waiting")) return;
    s.queueLanguage = s.language;
    s.retryOnlyId = null;
    s.queueRunning = true;
    s.error = "";
    await dispatch(s);
  }

  async function poll() {
    const s = getState(), row = active(s);
    if (!row?.task || terminal.has(row.status)) return;
    const taskId = row.task.task_id;
    try {
      const { data } = await api.get(`/api/transcript/local-stt/tasks/${taskId}`);
      if (!current(s) || s.activeAudioId !== row.id || row.task?.task_id !== taskId) return;
      applyTask(s, row, data);
    } catch (error) {
      if (!current(s) || s.activeAudioId !== row.id) return;
      row.pollError = errorText(error);
      if (error?.response?.status === 404) {
        row.status = "failed";
        row.error = row.pollError;
        s.activeAudioId = null;
      }
    }
    if (current(s) && !s.activeAudioId) await dispatch(s);
  }

  async function stop(id) {
    const s = getState(), row = active(s);
    if (!id) s.queueRunning = false;
    if (!row || (id && row.id !== id)) { if (!id) settle(s); return; }
    row.stopRequested = true;
    s.status = "stopping";
    await requestStop(s, row);
  }

  function remove(id) {
    const s = getState(), row = s.audioFiles.find((entry) => entry.id === id);
    if (!row || row.status !== "waiting") return;
    s.audioFiles = s.audioFiles.filter((entry) => entry.id !== id);
    if (s.selectedAudioId === id) s.selectedAudioId = s.audioFiles[0]?.id || null;
    if (!s.audioFiles.length) s.status = "idle";
  }

  async function retry(id) {
    const s = getState(), row = s.audioFiles.find((entry) => entry.id === id);
    if (!row || !["failed", "cancelled"].includes(row.status)) return;
    Object.assign(row, { status: "waiting", task: null, progress: 0, result: null, error: "", pollError: "", stopRequested: false, cancelling: false });
    // Put retries at the end of the waiting order without rerunning completed rows.
    s.audioFiles = [...s.audioFiles.filter((entry) => entry.id !== id), row];
    if (!s.activeAudioId && !s.queueRunning) {
      s.queueLanguage = s.language;
      s.retryOnlyId = id;
      s.queueRunning = true;
    }
    await dispatch(s);
  }

  return { append, start, poll, stop, remove, retry };
}
