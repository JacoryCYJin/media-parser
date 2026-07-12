<template>
  <main class="grain min-h-screen bg-background text-foreground">
    <section class="page-gutter pb-20 pt-16">
      <div class="page-frame">
        <header class="border-b border-line pb-9">
          <div class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="font-mono text-xs tracking-[0.18em] text-blue">№ 001 — VIDEO / LOCAL TOOL</p>
              <h1 class="mt-5 text-4xl font-medium leading-none tracking-tight text-foreground md:text-6xl">
                {{ t('videoParser.hero.titleLead') }}{{ t('videoParser.hero.titleSeparator') }}<span class="italic text-blue">{{ t('videoParser.hero.titleAccent') }}</span>
              </h1>
              <p class="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {{ t('videoParser.pageDescription') }}
              </p>
            </div>

            <div class="flex items-center gap-5">
              <button
                type="button"
                class="inline-flex h-10 items-center gap-3 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-line-strong hover:text-blue"
                :class="isCookiesRequiredError ? 'border-line-strong text-blue' : ''"
                @click="emit('open-settings')"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-blue"></span>
                {{ t('videoParser.ui.settings') }}
              </button>
              <span class="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                {{ t('videoParser.ui.cookiesDirectory') }}
              </span>
            </div>
          </div>
        </header>

        <div class="mt-10 grid gap-10">
          <div class="min-w-0">
            <section class="border-b border-line pb-10">
              <p class="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-blue">01 — {{ t('videoParser.sections.command') }}</p>
              <div class="border border-line bg-card sm:flex sm:min-h-14 sm:items-center">
                <div class="flex min-w-0 flex-1 items-center">
                  <div class="flex h-14 w-14 shrink-0 items-center justify-center border-r border-line text-muted-foreground">
                    <LinkIcon class="h-4.5 w-4.5" />
                  </div>
                  <input
                    v-model="videoUrl"
                    type="text"
                    :placeholder="t('videoParser.inputPlaceholder')"
                    class="h-14 min-w-0 flex-1 bg-transparent px-5 font-mono text-sm text-foreground outline-none placeholder:text-haze"
                    @keypress.enter="parseVideo"
                  />
                </div>
                <button
                  type="button"
                  class="flex h-14 w-full shrink-0 items-center justify-center gap-3 border-t border-line px-6 font-mono text-xs uppercase tracking-[0.18em] text-blue transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-haze sm:w-auto sm:border-l sm:border-t-0"
                  :disabled="loading || !videoUrl.trim()"
                  @click="parseVideo"
                >
                  {{ loading ? t('videoParser.parsing') : t('videoParser.parse') }}
                  <ArrowRight class="h-3.5 w-3.5" />
                </button>
              </div>
            </section>

            <VideoParserStatus
              v-if="showStatusSection"
              :status-rail="statusRail"
              :parser-state="parserState"
              :active-status-index="activeStatusIndex"
              :is-cookies-required-error="isCookiesRequiredError"
              :loading="loading"
              :error="error"
              :success="success"
            />

            <div v-if="showResolvedModules || showOutlineModule" class="border-b border-line">
              <div class="min-w-0">
                <section v-if="showResolvedModules" class="border-b border-line py-10">
                  <p class="mb-8 font-mono text-xs uppercase tracking-[0.18em] text-blue">03 — {{ t('videoParser.sections.videoInfo') }}</p>
                  <div>
                    <div v-if="videoInfo" class="video-info-resolved">
                      <img
                        v-if="videoInfo.thumbnail_proxy || videoInfo.thumbnail"
                        :src="videoInfo.thumbnail_proxy || videoInfo.thumbnail"
                        :alt="t('videoParser.thumbnailAlt')"
                        referrerpolicy="no-referrer"
                        crossorigin="anonymous"
                        class="video-info-thumb border border-line object-cover"
                      />
                      <div v-else class="video-info-thumb flex items-center justify-center border border-line bg-muted">
                        <Clapperboard class="h-6 w-6 text-haze" />
                      </div>

                      <div class="min-w-0">
                        <h2 class="video-info-title text-xl font-medium leading-snug tracking-tight text-foreground md:text-2xl">
                          {{ videoInfo.title || 'Untitled Video' }}
                        </h2>
                        <dl class="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <dt class="tech">{{ t('videoParser.info.source') }}</dt>
                            <dd class="mt-1 text-foreground">{{ sourcePlatform }}</dd>
                          </div>
                          <div>
                            <dt class="tech">{{ t('videoParser.info.duration') }}</dt>
                            <dd class="mt-1 text-foreground">{{ videoInfo.duration ? formatDuration(videoInfo.duration) : '--' }}</dd>
                          </div>
                          <div>
                            <dt class="tech">{{ t('videoParser.info.uploader') }}</dt>
                            <dd class="mt-1 text-foreground">{{ videoInfo.uploader || videoInfo.channel || '--' }}</dd>
                          </div>
                          <div>
                            <dt class="tech">{{ t('videoParser.info.pubDate') }}</dt>
                            <dd class="mt-1 text-foreground">{{ formatUploadDate(videoInfo.upload_date || videoInfo.release_date) }}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div v-else class="border border-line bg-card px-5 py-10">
                      <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ t('videoParser.info.awaitingUrl') }}</p>
                      <p class="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
                        {{ t('videoParser.info.awaitingDescription') }}
                      </p>
                    </div>
                  </div>
                </section>

                <VideoParserRegistry
                  v-if="showResolvedModules"
                  :registry-rows="registryRows"
                  :downloading="downloading"
                  :format-key="formatKey"
                  :format-label="formatLabel"
                  :row-status="rowStatus"
                  :row-status-label="rowStatusLabel"
                  :row-progress="rowProgress"
                  :row-status-class="rowStatusClass"
                  :row-action-label="rowActionLabel"
                  @download="downloadVideo"
                  @reveal="revealDownloaded"
                  @pause="pauseDownload"
                  @resume="resumeDownload"
                  @cancel="cancelDownload"
                />
              </div>

              <VideoOutlinePanel
                v-if="showOutlineModule"
                :outline-state="outlineState"
                :outline-state-meta="outlineStateMeta"
                :outline-nodes="outlineNodes"
                :outline-title="outlineTitle"
                :outline-summary="outlineSummary"
                :outline-error="outlineError"
                @copy="copyOutline"
                @generate="generateOutline"
              />
            </div>
          </div>

        </div>
      </div>
    </section>

    <StatusToast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :type="toastType"
    />

  </main>
</template>

<script setup>
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from '../lib/apiClient'
import StatusToast from '../components/StatusToast.vue'
import VideoOutlinePanel from '../components/video-parser/VideoOutlinePanel.vue'
import VideoParserRegistry from '../components/video-parser/VideoParserRegistry.vue'
import VideoParserStatus from '../components/video-parser/VideoParserStatus.vue'
import { useVideoDownloads } from '../components/video-parser/useVideoDownloads'
import { useVideoOutline } from '../components/video-parser/useVideoOutline'
import { ArrowRight, Clapperboard, Link as LinkIcon } from 'lucide-vue-next'

const { t, locale } = useI18n()
const props = defineProps({
  downloadDirOverride: { type: String, default: '' }
})
const emit = defineEmits(['open-settings'])
const downloadDirOverride = toRef(props, 'downloadDirOverride')

const getClientId = () => {
  const key = 'jacory_client_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const generated = `u_${crypto.randomUUID().replace(/-/g, '')}`
  localStorage.setItem(key, generated)
  return generated
}

axios.defaults.headers.common['x-client-id'] = getClientId()

const videoUrl = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const videoInfo = ref(null)

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

const formatUploadDate = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return '--'
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw
}

const normalizeVideoUrlInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(BV[0-9A-Za-z]{10}|av\d+)$/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/:?#].*)?$/i.test(raw)) return `https://${raw}`
  return raw
}

const isValidVideoUrl = (value) => {
  if (/^(BV[0-9A-Za-z]{10}|av\d+)$/i.test(value)) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (_err) {
    return false
  }
}

const copyToClipboard = async (text) => {
  if (!text || text === t('videoParser.notSet')) return
  try {
    await navigator.clipboard.writeText(text)
  } catch (_err) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

const {
  downloading,
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
} = useVideoDownloads({ axios, t, videoInfo, videoUrl, downloadDirOverride, error, success })

const sourcePlatform = computed(() => {
  const raw = videoInfo.value?.source_url || videoUrl.value
  try {
    const host = new URL(raw).hostname.toLowerCase()
    if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube'
    if (host.includes('bilibili')) return 'Bilibili'
    return host.replace(/^www\./, '')
  } catch (_err) {
    return '--'
  }
})

const {
  outlineCopyStatus,
  outlineError,
  outlineState,
  outlineStateMeta,
  outlineNodes,
  outlineTitle,
  outlineSummary,
  copyOutline,
  generateOutline,
  resetOutline
} = useVideoOutline({ axios, t, locale, videoInfo, sourcePlatform, formatDuration, copyToClipboard })

const statusKeys = ['READY', 'PARSING', 'RESOLVED', 'DOWNLOADING', 'COMPLETE', 'FAILED']
const statusRail = computed(() =>
  statusKeys.map((key) => ({
    key,
    label: t(`videoParser.statusRail.${key}`)
  }))
)
const isCookiesRequiredError = computed(() => {
  const msg = error.value.toLowerCase()
  return msg.includes('cookie') || msg.includes('cookies') || msg.includes('登录') || msg.includes('sign in') || msg.includes('403')
})
const parserState = computed(() => {
  if (loading.value) return 'PARSING'
  if (hasActiveDownload.value) return 'DOWNLOADING'
  if (error.value) return 'FAILED'
  if (lastDownloadedPath.value) return 'COMPLETE'
  if (videoInfo.value) return 'RESOLVED'
  return 'READY'
})
const activeStatusIndex = computed(() => Math.max(0, statusKeys.indexOf(parserState.value)))
const showStatusSection = computed(() => parserState.value !== 'READY' || Boolean(error.value || success.value))
const showResolvedModules = computed(() => Boolean(videoInfo.value))
const showOutlineModule = computed(() => ['noSubtitles', 'insufficient', 'subtitlesAvailable', 'generating', 'success', 'failed'].includes(outlineState.value))
const toastMessage = computed(() => outlineCopyStatus.value || '')
const toastType = computed(() => 'success')

const parseVideo = async () => {
  const rawUrl = videoUrl.value.trim()
  if (!rawUrl) {
    error.value = t('videoParser.errors.emptyUrl')
    return
  }
  const url = normalizeVideoUrlInput(rawUrl)
  if (!isValidVideoUrl(url)) {
    error.value = t('videoParser.errors.invalidUrl')
    return
  }
  videoUrl.value = url
  loading.value = true
  error.value = ''
  success.value = ''
  videoInfo.value = null
  resetDownloads()
  resetOutline()
  try {
    const response = await axios.post('/api/parse', { url })
    videoInfo.value = response.data
    videoUrl.value = response.data?.source_url || url
    restoreDownloadTasks()
    console.info('[VideoParser] Transcript parsed', {
      transcriptStatus: response.data?.transcript_status,
      transcriptValid: response.data?.transcript_is_valid,
      transcriptLanguage: response.data?.transcript_language,
      transcriptSource: response.data?.transcript_source,
      transcriptFormat: response.data?.transcript_format,
      transcriptLength: response.data?.transcript_char_count,
      transcriptCompactLength: response.data?.transcript_compact_length,
      transcriptPreview: response.data?.transcript_preview
    })
  } catch (err) {
    if (err.response?.data?.code === 'NO_VISIBLE_FORMATS') {
      error.value = t('videoParser.errors.noVisibleFormats')
    } else {
      error.value = err.response?.data?.error || t('videoParser.errors.parseFailed', { message: err.message })
    }
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
.video-info-resolved {
  display: grid;
  grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
  gap: 1.75rem;
  align-items: start;
}

.video-info-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.video-info-title {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

@media (min-width: 1280px) {
  .video-info-resolved {
    grid-template-columns: minmax(190px, 240px) minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .video-info-resolved {
    grid-template-columns: 1fr;
  }
}

</style>
