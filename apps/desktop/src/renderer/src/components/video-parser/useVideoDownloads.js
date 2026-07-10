import { computed, onBeforeUnmount, reactive, ref } from 'vue'

const ACTIVE_DOWNLOAD_STATUSES = new Set(['QUEUED', 'DOWNLOADING', 'PAUSED'])
const DOWNLOAD_TASK_STORAGE_KEY = 'jacory_video_download_tasks'

export function useVideoDownloads({ axios, t, videoInfo, videoUrl, downloadDirOverride, error, success }) {
  const downloading = reactive({})
  const downloadRows = reactive({})
  const downloadPollers = new Map()
  const lastDownloadedPath = ref('')

  const registryRows = computed(() =>
    (videoInfo.value?.formats || []).filter((format) => {
      const ext = String(format?.ext || '').toLowerCase()
      return ['mp4', 'm4a'].includes(ext)
    })
  )

  const formatKey = (format) => format?.format_id || format?.resolution || 'unknown'
  const formatLabel = (format) => {
    const ext = String(format?.ext || 'file').toUpperCase()
    if (ext === 'M4A') return ext
    return ext
  }
  const rowData = (format) => downloadRows[formatKey(format)] || null
  const activeRowValues = () => Object.values(downloadRows).filter((row) => ACTIVE_DOWNLOAD_STATUSES.has(row?.status))
  const rowStatus = (format) => {
    const row = rowData(format)
    if (row?.status) return row.status
    if (!format?.format_id && !format?.resolution) return 'UNAVAILABLE'
    return 'READY'
  }
  const rowStatusLabel = (format) => t(`videoParser.registry.rowStatus.${rowStatus(format)}`)
  const rowProgress = (format) => rowData(format)?.progress || 0
  const rowStatusClass = (format) => {
    const status = rowStatus(format)
    if (status === 'COMPLETE') return { dot: 'bg-green-500', text: 'text-green-700' }
    if (status === 'FAILED' || status === 'CANCELLED') return { dot: 'bg-red-500', text: 'text-red-700' }
    if (status === 'DOWNLOADING' || status === 'PAUSED' || status === 'READY') {
      return { dot: 'bg-blue', text: 'text-blue' }
    }
    return { dot: 'bg-haze', text: 'text-muted-foreground' }
  }
  const rowActionLabel = (format) => {
    const status = rowStatus(format)
    if (status === 'DOWNLOADING') return t('videoParser.registry.actions.pause')
    if (status === 'PAUSED') return t('videoParser.registry.actions.resume')
    if (status === 'COMPLETE') return t('videoParser.registry.actions.reveal')
    if (status === 'FAILED') return t('videoParser.registry.actions.retry')
    if (status === 'CANCELLED') return t('videoParser.registry.actions.retry')
    if (status === 'UNAVAILABLE') return '--'
    return t('videoParser.registry.actions.download')
  }

  const hasActiveDownload = computed(() => activeRowValues().length > 0)

  function readStoredTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DOWNLOAD_TASK_STORAGE_KEY) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch (_err) {
      return []
    }
  }

  function writeStoredTasks(tasks) {
    localStorage.setItem(DOWNLOAD_TASK_STORAGE_KEY, JSON.stringify(tasks))
  }

  function upsertStoredTask(task) {
    const tasks = readStoredTasks().filter((item) => item.taskId !== task.taskId && !(item.sourceUrl === task.sourceUrl && item.key === task.key))
    tasks.push(task)
    writeStoredTasks(tasks)
  }

  function removeStoredTask(taskId) {
    if (!taskId) return
    writeStoredTasks(readStoredTasks().filter((item) => item.taskId !== taskId))
  }

  function clearDownloadPoller(key) {
    const poller = downloadPollers.get(key)
    if (poller) window.clearInterval(poller)
    downloadPollers.delete(key)
  }

  async function refreshDownloadTask(key, resolution, taskId) {
    const response = await axios.get(`/api/download/tasks/${taskId}`)
    const task = response.data || {}
    const progress = Math.max(0, Math.min(100, Number(task.progress || 0)))

    if (task.status === 'COMPLETE') {
      clearDownloadPoller(key)
      removeStoredTask(taskId)
      downloading[resolution] = false
      lastDownloadedPath.value = task.path || task.output_dir || ''
      downloadRows[key] = { status: 'COMPLETE', progress: 100, path: lastDownloadedPath.value, taskId }
      success.value = t('videoParser.messages.downloadComplete', { path: lastDownloadedPath.value })
      return
    }

    if (task.status === 'FAILED') {
      clearDownloadPoller(key)
      removeStoredTask(taskId)
      downloading[resolution] = false
      downloadRows[key] = { status: 'FAILED', progress, taskId }
      error.value = task.error || t('videoParser.errors.downloadFailed', { message: '' })
      success.value = ''
      return
    }

    if (task.status === 'CANCELLED') {
      clearDownloadPoller(key)
      removeStoredTask(taskId)
      downloading[resolution] = false
      downloadRows[key] = { status: 'CANCELLED', progress, taskId }
      success.value = ''
      return
    }

    const status = task.status === 'PAUSED' ? 'PAUSED' : 'DOWNLOADING'
    downloading[resolution] = true
    downloadRows[key] = { status, progress, taskId }
  }

  function startDownloadPolling(key, resolution, taskId) {
    clearDownloadPoller(key)
    const poller = window.setInterval(async () => {
      try {
        await refreshDownloadTask(key, resolution, taskId)
      } catch (err) {
        clearDownloadPoller(key)
        downloading[resolution] = false
        downloadRows[key] = { status: 'FAILED', progress: rowData({ format_id: key })?.progress || 0, taskId }
        error.value = err.response?.data?.error || t('videoParser.errors.downloadFailed', { message: err.message })
        success.value = ''
      }
    }, 3000)
    downloadPollers.set(key, poller)
  }

  async function downloadVideo(format) {
    const resolution = format?.resolution || ''
    const key = formatKey(format)
    if (['DOWNLOADING', 'PAUSED'].includes(rowStatus(format))) return
    downloading[resolution] = true
    downloadRows[key] = { status: 'DOWNLOADING', progress: 0 }
    error.value = ''
    success.value = t('videoParser.messages.downloadingResolution', { resolution })
    try {
      const response = await axios.post('/api/download', {
        url: videoUrl.value,
        resolution,
        format_id: format?.format_id || '',
        output_dir: downloadDirOverride.value.trim() || undefined
      })
      const taskId = response.data?.task_id
      if (!taskId) throw new Error(t('videoParser.errors.downloadFailed', { message: 'missing task id' }))
      downloadRows[key] = { status: 'DOWNLOADING', progress: Number(response.data?.progress || 0), taskId }
      upsertStoredTask({ sourceUrl: videoUrl.value, key, resolution, taskId })
      startDownloadPolling(key, resolution, taskId)
      await refreshDownloadTask(key, resolution, taskId)
    } catch (err) {
      clearDownloadPoller(key)
      downloadRows[key] = { status: 'FAILED' }
      error.value = err.response?.data?.error || t('videoParser.errors.downloadFailed', { message: err.message })
      success.value = ''
      downloading[resolution] = false
    }
  }

  async function controlDownloadTask(format, action) {
    const key = formatKey(format)
    const row = rowData(format)
    const taskId = row?.taskId
    const resolution = format?.resolution || ''
    if (!taskId) return
    error.value = ''
    try {
      await axios.post(`/api/download/tasks/${taskId}/${action}`)
      await refreshDownloadTask(key, resolution, taskId)
      if (action === 'resume') startDownloadPolling(key, resolution, taskId)
      if (action === 'pause') clearDownloadPoller(key)
    } catch (err) {
      error.value = err.response?.data?.error || t('videoParser.errors.downloadFailed', { message: err.message })
      success.value = ''
    }
  }

  const pauseDownload = (format) => controlDownloadTask(format, 'pause')
  const resumeDownload = (format) => controlDownloadTask(format, 'resume')
  const cancelDownload = (format) => controlDownloadTask(format, 'cancel')

  async function revealDownloaded(format) {
    const key = formatKey(format)
    const path = rowData(format)?.path || lastDownloadedPath.value
    if (!path) return
    error.value = ''
    try {
      const response = await axios.post('/api/reveal', { path })
      success.value = response.data?.message || t('videoParser.messages.revealComplete')
    } catch (err) {
      error.value = err.response?.data?.error || t('videoParser.errors.revealFailed')
      downloadRows[key] = { ...downloadRows[key], status: 'COMPLETE', path }
    }
  }

  function resetDownloads() {
    lastDownloadedPath.value = ''
    downloadPollers.forEach((poller) => window.clearInterval(poller))
    downloadPollers.clear()
    Object.keys(downloadRows).forEach((key) => delete downloadRows[key])
    Object.keys(downloading).forEach((key) => delete downloading[key])
  }

  function restoreDownloadTasks() {
    const rowsByKey = new Map(registryRows.value.map((format) => [formatKey(format), format]))
    readStoredTasks()
      .filter((task) => task.sourceUrl === videoUrl.value && rowsByKey.has(task.key))
      .forEach((task) => {
        const format = rowsByKey.get(task.key)
        downloadRows[task.key] = { status: 'DOWNLOADING', progress: 0, taskId: task.taskId }
        downloading[task.resolution] = true
        startDownloadPolling(task.key, task.resolution, task.taskId)
        refreshDownloadTask(task.key, task.resolution, task.taskId).catch(() => {
          clearDownloadPoller(task.key)
          removeStoredTask(task.taskId)
          downloading[task.resolution] = false
          downloadRows[task.key] = { status: 'FAILED', progress: rowProgress(format), taskId: task.taskId }
        })
      })
  }

  onBeforeUnmount(() => {
    downloadPollers.forEach((poller) => window.clearInterval(poller))
    downloadPollers.clear()
  })

  return {
    downloading,
    downloadRows,
    lastDownloadedPath,
    registryRows,
    hasActiveDownload,
    formatKey,
    formatLabel,
    rowStatus,
    rowStatusLabel,
    rowProgress,
    rowStatusClass,
    rowActionLabel,
    downloadVideo,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    revealDownloaded,
    resetDownloads,
    restoreDownloadTasks
  }
}
