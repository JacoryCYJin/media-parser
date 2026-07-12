import { computed, onBeforeUnmount, ref } from 'vue'

export function useVideoParserSettings({ axios, t, error, success }) {
  const defaultDownloadDir = ref('')
  const downloadDirOverride = ref('')
  const savingSettings = ref(false)
  const cookieMode = ref('browser')
  const browserCookieSource = ref('chrome')
  const savingCookieSettings = ref(false)
  const modelProvider = ref('api')
  const analysisBaseUrl = ref('https://api.siliconflow.cn/v1')
  const analysisApiKey = ref('')
  const analysisModel = ref('')
  const savingModelSettings = ref(false)
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
  const modelProviders = ['api']
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
      const statusLabel =
        cookieMode.value === 'browser'
          ? t('videoParser.settings.usingBrowserCookies', { browser: browserSourceLabel.value })
          : hasManualCookies
            ? t('videoParser.settings.set')
            : t('videoParser.settings.notSet')

      return {
        ...platform,
        hasManualCookies,
        statusLabel,
        statusTone: cookieMode.value === 'browser' || hasManualCookies ? 'active' : 'muted',
        actionLabel: hasManualCookies ? t('videoParser.settings.edit') : t('videoParser.settings.set')
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
      modelProvider.value = response.data.model_provider || 'api'
      analysisBaseUrl.value = response.data.analysis_base_url || 'https://api.siliconflow.cn/v1'
      analysisApiKey.value = response.data.analysis_api_key || ''
      analysisModel.value = response.data.analysis_model || ''
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

  async function saveModelSettings() {
    savingModelSettings.value = true
    setCookieSettingsStatus(null)
    try {
      await axios.post('/api/settings', {
        model_provider: modelProvider.value,
        analysis_base_url: analysisBaseUrl.value,
        analysis_api_key: analysisApiKey.value,
        analysis_model: analysisModel.value
      })
      setCookieSettingsStatus({ type: 'success', message: t('settingsDialog.models.saved') })
    } catch (err) {
      setCookieSettingsStatus({ type: 'error', message: err.response?.data?.error || t('settingsDialog.models.saveFailed') })
    } finally {
      savingModelSettings.value = false
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
    modelProvider,
    analysisBaseUrl,
    analysisApiKey,
    analysisModel,
    savingModelSettings,
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
    modelProviders,
    cookiePlatformRows,
    loadSettings,
    loadCookiesInfo,
    saveCookieSettings,
    saveModelSettings,
    chooseFolderAndSaveDefault,
    chooseFolderForOnce,
    editPlatform,
    saveCookies,
    deletePlatformCookies,
    addCustomPlatform,
  }
}
