<template>
  <div class="min-h-screen bg-background text-foreground">
    <AppSidebar
      v-model:active-tool="activeTool"
      :tools="tools"
      :settings-open="settingsOpen"
      :tools-label="t('tools.sidebar.toolsLabel')"
      :settings-label="t('tools.sidebar.settingsLabel')"
      @open-settings="openSettings"
    />

    <div class="window-drag fixed left-56 right-0 top-0 z-[80] h-12 select-none" aria-hidden="true"></div>

    <div class="pl-56">
      <VideoParser v-if="activeTool === 'video'" :download-dir-override="downloadDirOverride" @open-settings="openSettings" />
      <PodcastParser v-else />
    </div>

    <SettingsDialog
      v-if="settingsOpen"
      v-model:download-dir-override="downloadDirOverride"
      v-model:cookie-mode="cookieMode"
      v-model:browser-cookie-source="browserCookieSource"
      :default-download-dir="defaultDownloadDir"
      :saving-settings="savingSettings"
      :cookie-modes="cookieModes"
      :browser-sources="browserSources"
      :saving-cookie-settings="savingCookieSettings"
      :cookie-platform-rows="cookiePlatformRows"
      :model-connections="modelConnections"
      :active-model-connection-id="activeModelConnectionId"
      :active-model-connection="activeModelConnection"
      :editing-model-connection-id="editingModelConnectionId"
      :model-connection-form="modelConnectionForm"
      :show-model-connection-dialog="showModelConnectionDialog"
      :model-connection-status="cookieSettingsStatus"
      :saving-model-settings="savingModelSettings"
      :testing-model-connection="testingModelConnection"
      @close="settingsOpen = false"
      @choose-default-folder="chooseFolderAndSaveDefault"
      @choose-temporary-folder="chooseFolderForOnce"
      @save-cookie-settings="saveCookieSettings"
      @add-platform="showAddPlatform = true"
      @edit-platform="editPlatform"
      @delete-platform="deletePlatformCookies"
      @update-model-connection-field="updateModelConnectionFormField"
      @add-model-connection="beginAddModelConnection"
      @edit-model-connection="editModelConnection"
      @cancel-model-connection-edit="cancelModelConnectionEdit"
      @save-model-connection="saveModelConnection"
      @select-model-connection="selectModelConnection"
      @delete-model-connection="deleteModelConnection"
      @test-model-connection="testModelConnection"
    />

    <VideoParserCookieDialogs
      v-model:show-add-platform="showAddPlatform"
      v-model:new-platform-name="newPlatformName"
      v-model:show-edit-cookies="showEditCookies"
      v-model:cookies-text="cookiesText"
      :editing-platform="editingPlatform"
      :saving-cookies="savingCookies"
      :cookies-status="cookiesStatus"
      @add-platform="addCustomPlatform"
      @save-cookies="saveCookies"
    />

    <StatusToast
      :visible="Boolean(settingsToastMessage)"
      :message="settingsToastMessage"
      :type="settingsToastType"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clapperboard, Podcast } from 'lucide-vue-next'
import axios from './lib/apiClient'
import AppSidebar from './components/AppSidebar.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import StatusToast from './components/StatusToast.vue'
import VideoParserCookieDialogs from './components/video-parser/VideoParserCookieDialogs.vue'
import { useVideoParserSettings } from './components/video-parser/useVideoParserSettings'
import PodcastParser from './views/PodcastParser.vue'
import VideoParser from './views/VideoParser.vue'

const { t } = useI18n()
const activeTool = ref('video')
const settingsOpen = ref(false)
const settingsError = ref('')
const settingsSuccess = ref('')

const getClientId = () => {
  const key = 'jacory_client_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const generated = `u_${crypto.randomUUID().replace(/-/g, '')}`
  localStorage.setItem(key, generated)
  return generated
}

axios.defaults.headers.common['x-client-id'] = getClientId()

const tools = computed(() => [
  { value: 'video', label: t('tools.videoParser.title'), icon: Clapperboard },
  { value: 'podcast', label: t('tools.podcastParser.title'), icon: Podcast }
])

const {
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
  addCustomPlatform
} = useVideoParserSettings({ axios, t, error: settingsError, success: settingsSuccess })

const openSettings = async () => {
  settingsOpen.value = true
  await Promise.all([loadSettings(), loadCookiesInfo()])
}

const settingsToastMessage = computed(() => cookieSettingsStatus.value?.message || settingsSuccess.value || settingsError.value)
const settingsToastType = computed(() => cookieSettingsStatus.value?.type || (settingsError.value ? 'error' : 'success'))

let settingsToastTimer = 0

const clearSettingsToastTimer = () => {
  if (!settingsToastTimer) return
  window.clearTimeout(settingsToastTimer)
  settingsToastTimer = 0
}

watch(
  settingsToastMessage,
  (message) => {
    clearSettingsToastTimer()
    if (!message) return

    const activeMessage = message
    settingsToastTimer = window.setTimeout(() => {
      if (settingsToastMessage.value !== activeMessage) return
      cookieSettingsStatus.value = null
      settingsSuccess.value = ''
      settingsError.value = ''
      settingsToastTimer = 0
    }, 3200)
  },
  { immediate: true }
)

onBeforeUnmount(clearSettingsToastTimer)
</script>

<style scoped>
.window-drag {
  -webkit-app-region: drag;
}

.window-no-drag,
.window-no-drag * {
  -webkit-app-region: no-drag;
}
</style>
