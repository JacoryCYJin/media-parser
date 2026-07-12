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
      <PodcastParser v-else-if="activeTool === 'podcast'" />
      <section v-else class="min-h-screen px-6 py-24 md:px-14 lg:px-20">
        <div class="max-w-3xl border-y border-line py-12">
          <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('tools.downloadsList.kicker') }}</p>
          <h1 class="mt-6 text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-5xl">
            {{ t('tools.downloadsList.title') }}
          </h1>
          <p class="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {{ t('tools.downloadsList.description') }}
          </p>
        </div>
      </section>
    </div>

    <SettingsDialog
      v-if="settingsOpen"
      v-model:download-dir-override="downloadDirOverride"
      v-model:cookie-mode="cookieMode"
      v-model:browser-cookie-source="browserCookieSource"
      v-model:model-provider="modelProvider"
      v-model:analysis-base-url="analysisBaseUrl"
      v-model:analysis-api-key="analysisApiKey"
      v-model:analysis-model="analysisModel"
      :default-download-dir="defaultDownloadDir"
      :saving-settings="savingSettings"
      :cookie-modes="cookieModes"
      :browser-sources="browserSources"
      :saving-cookie-settings="savingCookieSettings"
      :cookie-platform-rows="cookiePlatformRows"
      :model-providers="modelProviders"
      :saving-model-settings="savingModelSettings"
      @close="settingsOpen = false"
      @choose-default-folder="chooseFolderAndSaveDefault"
      @choose-temporary-folder="chooseFolderForOnce"
      @save-cookie-settings="saveCookieSettings"
      @add-platform="showAddPlatform = true"
      @edit-platform="editPlatform"
      @delete-platform="deletePlatformCookies"
      @save-model-settings="saveModelSettings"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clapperboard, Download, Podcast } from 'lucide-vue-next'
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
  { value: 'podcast', label: t('tools.podcastParser.title'), icon: Podcast },
  { value: 'downloads', label: t('tools.downloadsList.title'), icon: Download }
])

const {
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
  addCustomPlatform
} = useVideoParserSettings({ axios, t, error: settingsError, success: settingsSuccess })

const openSettings = async () => {
  settingsOpen.value = true
  await Promise.all([loadSettings(), loadCookiesInfo()])
}

const settingsToastMessage = computed(() => cookieSettingsStatus.value?.message || settingsSuccess.value || settingsError.value)
const settingsToastType = computed(() => cookieSettingsStatus.value?.type || (settingsError.value ? 'error' : 'success'))
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
