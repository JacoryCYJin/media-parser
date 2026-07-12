import { computed, onBeforeUnmount, ref } from 'vue'

export function useVideoParserSettings({ axios, t, error, success }) {
  const defaultDownloadDir = ref('')
  const downloadDirOverride = ref('')
  const savingSettings = ref(false)
  const cookieMode = ref('browser')
  const browserCookieSource = ref('chrome')
  const savingCookieSettings = ref(false)
  const modelConnections = ref([])
  const activeModelConnectionId = ref('')
  const editingModelConnectionId = ref('')
  const modelConnectionForm = ref(createEmptyModelConnection())
  const showModelConnectionDialog = ref(false)
  const savingModelSettings = ref(false)
  const testingModelConnection = ref(false)
  const cookieSettingsStatus = ref(null)
  const showEditCookies = ref(false)
  const showAddPlatform = ref(false)
  const cookiesText = ref('')
  const savingCookies = ref(false)
  const cookiesStatus = ref(null)
  const editingPlatform = ref('')
  const newPlatformName = ref('')
  const customPlatforms = ref([])
  const cookiesInfo = ref({ youtube: {}, bilibili: {} })
  let cookieSettingsTimer = 0
  let cookiesDialogTimer = 0

  const cookieModes = ['browser', 'manual']
  const browserSources = [
    { value: 'chrome', label: 'Chrome' },
    { value: 'safari', label: 'Safari' },
    { value: 'firefox', label: 'Firefox' },
    { value: 'edge', label: 'Edge' }
  ]
  const activeModelConnection = computed(() => {
    return modelConnections.value.find((connection) => connection.id === activeModelConnectionId.value) || null
  })
  const browserSourceLabel = computed(() => {
    return browserSources.find((source) => source.value === browserCookieSource.value)?.label || browserCookieSource.value
  })
  const cookiePlatformRows = computed(() => {
    const rows = [
      { key: 'youtube', label: 'YouTube', custom: false },
      { key: 'bilibili', label: 'Bilibili', custom: false },
      ...customPlatforms.value.map((platform) => ({ key: platform, label: platform, custom: true }))
    ]

    return rows.map((platform) => {
      const hasManualCookies = Boolean(cookiesInfo.value[platform.key]?.has_cookies)
      const hasActiveCookies = cookieMode.value === 'browser' || hasManualCookies

      return {
        ...platform,
        hasManualCookies,
        statusTone: hasActiveCookies ? 'active' : 'muted',
        actionLabel: hasActiveCookies ? t('videoParser.settings.set') : t('videoParser.settings.notSet')
      }
    })
  })

  function clearCookieSettingsTimer() {
    if (!cookieSettingsTimer) return
    window.clearTimeout(cookieSettingsTimer)
    cookieSettingsTimer = 0
  }

  function setCookieSettingsStatus(status) {
    clearCookieSettingsTimer()
    cookieSettingsStatus.value = status
    if (status) {
      cookieSettingsTimer = window.setTimeout(() => {
        cookieSettingsStatus.value = null
        cookieSettingsTimer = 0
      }, 2200)
    }
  }

  async function loadSettings() {
    try {
      const response = await axios.get('/api/settings')
      defaultDownloadDir.value = response.data.default_download_dir || ''
      cookieMode.value = response.data.cookie_mode || 'browser'
      browserCookieSource.value = response.data.browser_cookie_source || 'chrome'
      modelConnections.value = Array.isArray(response.data.model_connections) ? response.data.model_connections : []
      activeModelConnectionId.value = response.data.active_model_connection_id || ''
      if (!modelConnectionForm.value.id && !editingModelConnectionId.value) {
        modelConnectionForm.value = createEmptyModelConnection()
      }
    } catch (err) {
      console.error(t('videoParser.errors.loadSettingsFailed'), err)
    }
  }

  async function saveDefaultDownloadDir() {
    if (!defaultDownloadDir.value.trim()) return
    savingSettings.value = true
    error.value = ''
    try {
      const response = await axios.post('/api/settings', {
        default_download_dir: defaultDownloadDir.value.trim()
      })
      defaultDownloadDir.value = response.data.default_download_dir || defaultDownloadDir.value
      success.value = t('videoParser.messages.defaultDirSaved', { path: defaultDownloadDir.value })
    } catch (err) {
      error.value = err.response?.data?.error || t('videoParser.errors.saveDefaultDirFailed')
    } finally {
      savingSettings.value = false
    }
  }

  async function saveCookieSettings() {
    savingCookieSettings.value = true
    setCookieSettingsStatus(null)
    try {
      await axios.post('/api/settings', {
        cookie_mode: cookieMode.value,
        browser_cookie_source: browserCookieSource.value
      })
      setCookieSettingsStatus({ type: 'success', message: t('videoParser.messages.cookieUsageSaved') })
    } catch (err) {
      setCookieSettingsStatus({ type: 'error', message: err.response?.data?.error || t('videoParser.errors.saveCookieSettingsFailed') })
    } finally {
      savingCookieSettings.value = false
    }
  }

  function createEmptyModelConnection() {
    return {
      id: '',
      name: '',
      type: 'openai-compatible',
      base_url: '',
      api_key: '',
      model: ''
    }
  }

  function normalizeConnectionForm(connection) {
    const baseUrl = String(connection.base_url || '').trim().replace(/\/+$/, '')
    const model = String(connection.model || '').trim()
    const fallbackName = model || baseUrl.replace(/^https?:\/\//, '').split('/')[0] || 'API'
    return {
      id: connection.id || `model-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: String(connection.name || '').trim() || fallbackName,
      type: 'openai-compatible',
      base_url: baseUrl,
      api_key: String(connection.api_key || '').trim(),
      model
    }
  }

  function updateModelConnectionFormField(field, value) {
    modelConnectionForm.value = {
      ...modelConnectionForm.value,
      [field]: value
    }
  }

  function beginAddModelConnection() {
    editingModelConnectionId.value = ''
    modelConnectionForm.value = createEmptyModelConnection()
    showModelConnectionDialog.value = true
  }

  function editModelConnection(connectionId) {
    const connection = modelConnections.value.find((item) => item.id === connectionId)
    if (!connection) return
    editingModelConnectionId.value = connectionId
    modelConnectionForm.value = { ...connection }
    showModelConnectionDialog.value = true
  }

  function cancelModelConnectionEdit() {
    editingModelConnectionId.value = ''
    modelConnectionForm.value = createEmptyModelConnection()
    showModelConnectionDialog.value = false
  }

  async function persistModelConnections(connections, activeConnectionId, message = '') {
    savingModelSettings.value = true
    setCookieSettingsStatus(null)
    try {
      const payloadConnections = JSON.parse(JSON.stringify(connections))
      const response = await axios.post('/api/settings', {
        model_connections: payloadConnections,
        active_model_connection_id: activeConnectionId
      })
      modelConnections.value = Array.isArray(response.data.model_connections) ? response.data.model_connections : []
      activeModelConnectionId.value = response.data.active_model_connection_id || ''
      if (message) {
        setCookieSettingsStatus({ type: 'success', message })
      }
      return true
    } catch (err) {
      setCookieSettingsStatus({ type: 'error', message: err.response?.data?.error || t('settingsDialog.models.saveFailed') })
      return false
    } finally {
      savingModelSettings.value = false
    }
  }

  async function saveModelConnection() {
    const connection = normalizeConnectionForm(modelConnectionForm.value)
    if (!connection.base_url || !connection.api_key || !connection.model) {
      setCookieSettingsStatus({ type: 'error', message: t('settingsDialog.models.incomplete') })
      return
    }

    const existingIndex = modelConnections.value.findIndex((item) => item.id === editingModelConnectionId.value)
    const nextConnections = [...modelConnections.value]
    if (existingIndex >= 0) {
      nextConnections.splice(existingIndex, 1, connection)
    } else {
      nextConnections.push(connection)
    }

    const nextActiveId = activeModelConnectionId.value || connection.id
    const saved = await persistModelConnections(nextConnections, nextActiveId, t('settingsDialog.models.saved'))
    if (saved) {
      editingModelConnectionId.value = ''
      modelConnectionForm.value = createEmptyModelConnection()
      showModelConnectionDialog.value = false
    }
  }

  async function selectModelConnection(connectionId) {
    if (!connectionId || connectionId === activeModelConnectionId.value) return
    await persistModelConnections(modelConnections.value, connectionId, t('settingsDialog.models.selected'))
  }

  async function deleteModelConnection(connectionId) {
    const connection = modelConnections.value.find((item) => item.id === connectionId)
    if (!connection) return
    if (!confirm(t('settingsDialog.models.confirmDelete', { name: connection.name }))) return

    const nextConnections = modelConnections.value.filter((item) => item.id !== connectionId)
    const deletedActive = connectionId === activeModelConnectionId.value
    const nextActiveId = deletedActive ? (nextConnections[0]?.id || '') : activeModelConnectionId.value
    const message = deletedActive && nextConnections.length
      ? t('settingsDialog.models.switched', { name: nextConnections[0].name })
      : t('settingsDialog.models.deleted')

    await persistModelConnections(nextConnections, nextActiveId, message)
    if (editingModelConnectionId.value === connectionId) {
      cancelModelConnectionEdit()
    }
  }

  async function testModelConnection(connection = modelConnectionForm.value) {
    const payload = normalizeConnectionForm(connection)
    if (!payload.base_url || !payload.api_key || !payload.model) {
      setCookieSettingsStatus({ type: 'error', message: t('settingsDialog.models.incomplete') })
      return
    }

    testingModelConnection.value = true
    setCookieSettingsStatus(null)
    try {
      await axios.post('/api/model-connections/test', payload)
      setCookieSettingsStatus({ type: 'success', message: t('settingsDialog.models.testPassed') })
    } catch (err) {
      setCookieSettingsStatus({ type: 'error', message: err.response?.data?.error || t('settingsDialog.models.testFailed') })
    } finally {
      testingModelConnection.value = false
    }
  }

  async function chooseFolderNative() {
    const response = await axios.post('/api/folder-dialog')
    if (response.data?.cancelled) return ''
    return response.data?.path || ''
  }

  async function chooseFolderAndSaveDefault() {
    try {
      const selected = await chooseFolderNative()
      if (!selected) return
      defaultDownloadDir.value = selected
      await saveDefaultDownloadDir()
    } catch (err) {
      error.value = err.response?.data?.error || t('videoParser.errors.folderDialogFailed')
    }
  }

  async function chooseFolderForOnce() {
    try {
      const selected = await chooseFolderNative()
      if (!selected) return
      downloadDirOverride.value = selected
    } catch (err) {
      error.value = err.response?.data?.error || t('videoParser.errors.folderDialogFailed')
    }
  }

  async function loadCookiesInfo() {
    try {
      const response = await axios.get('/api/cookies')
      cookiesInfo.value = response.data.platforms || {}
      customPlatforms.value = response.data.custom_platforms || []
    } catch (err) {
      console.error(t('videoParser.errors.loadCookiesFailed'), err)
    }
  }

  async function editPlatform(platform) {
    editingPlatform.value = platform
    cookiesStatus.value = null
    showEditCookies.value = true
    if (cookiesInfo.value[platform]?.has_cookies) {
      try {
        const response = await axios.get(`/api/cookies/${platform}`)
        cookiesText.value = response.data.cookies || ''
      } catch (_err) {
        cookiesText.value = ''
      }
    } else {
      cookiesText.value = ''
    }
  }

  async function saveCookies() {
    savingCookies.value = true
    cookiesStatus.value = null
    try {
      const response = await axios.post('/api/cookies', {
        cookies: cookiesText.value,
        platform: editingPlatform.value
      })
      cookiesStatus.value = { type: 'success', message: response.data.message }
      await loadCookiesInfo()
      if (cookiesDialogTimer) window.clearTimeout(cookiesDialogTimer)
      cookiesDialogTimer = window.setTimeout(() => {
        showEditCookies.value = false
        cookiesText.value = ''
        cookiesStatus.value = null
        cookiesDialogTimer = 0
      }, 1500)
    } catch (err) {
      cookiesStatus.value = { type: 'error', message: err.response?.data?.error || t('videoParser.errors.saveFailed') }
    } finally {
      savingCookies.value = false
    }
  }

  async function deletePlatformCookies(platform) {
    if (!confirm(t('videoParser.messages.confirmDeleteCookies', { platform }))) return
    try {
      await axios.delete(`/api/cookies/${platform}`)
      await loadCookiesInfo()
    } catch (_err) {
      alert(t('videoParser.errors.deleteFailed'))
    }
  }

  function addCustomPlatform() {
    const name = newPlatformName.value.trim().toLowerCase()
    if (!name) return
    if (customPlatforms.value.includes(name) || name === 'youtube' || name === 'bilibili') {
      alert(t('videoParser.errors.platformExists'))
      return
    }
    customPlatforms.value.push(name)
    newPlatformName.value = ''
    showAddPlatform.value = false
    editPlatform(name)
  }

  loadSettings()

  onBeforeUnmount(() => {
    clearCookieSettingsTimer()
    if (cookiesDialogTimer) window.clearTimeout(cookiesDialogTimer)
  })

  return {
    defaultDownloadDir,
    downloadDirOverride,
    savingSettings,
    cookieMode,
    browserCookieSource,
    savingCookieSettings,
    modelConnections,
    activeModelConnectionId,
    activeModelConnection,
    editingModelConnectionId,
    modelConnectionForm,
    showModelConnectionDialog,
    savingModelSettings,
    testingModelConnection,
    cookieSettingsStatus,
    showEditCookies,
    showAddPlatform,
    cookiesText,
    savingCookies,
    cookiesStatus,
    editingPlatform,
    newPlatformName,
    cookiesInfo,
    cookieModes,
    browserSources,
    cookiePlatformRows,
    loadSettings,
    loadCookiesInfo,
    saveCookieSettings,
    updateModelConnectionFormField,
    beginAddModelConnection,
    editModelConnection,
    cancelModelConnectionEdit,
    saveModelConnection,
    selectModelConnection,
    deleteModelConnection,
    testModelConnection,
    chooseFolderAndSaveDefault,
    chooseFolderForOnce,
    editPlatform,
    saveCookies,
    deletePlatformCookies,
    addCustomPlatform,
  }
}
