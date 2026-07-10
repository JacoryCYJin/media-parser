<template>
  <main class="grain min-h-screen bg-background text-foreground">
    <section class="page-gutter pb-20 pt-28 md:pt-32">
      <div class="page-frame">
        <header class="relative border-b border-line pb-12 md:pb-16">
          <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
            <div>
              <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('podcastParser.sections.toolIndex') }}</p>
              <h1 class="mt-7 text-5xl font-medium leading-none tracking-tight text-foreground md:text-7xl">
                {{ t('podcastParser.hero.titleLead') }}
                <span class="italic text-blue">{{ t('podcastParser.hero.titleAccent') }}</span>
              </h1>
              <p class="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground">
                {{ t('podcastParser.hero.description') }}
              </p>
            </div>

            <div class="hidden justify-self-end border-r border-line pr-6 text-right lg:block">
              <p class="font-mono text-xs uppercase tracking-[0.18em] text-foreground">{{ t('podcastParser.hero.editionLabel') }}</p>
              <p class="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-foreground">MMXXVI / 02</p>
            </div>
          </div>
        </header>

        <section class="grid gap-5 border-b border-line py-10 md:grid-cols-[140px_minmax(0,1fr)]">
          <div>
            <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">02</p>
            <p class="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('podcastParser.sections.input') }}</p>
          </div>

          <div>
            <div class="border border-line bg-card sm:flex sm:min-h-14 sm:items-center">
              <div class="flex min-w-0 flex-1 items-center">
                <div class="flex h-14 w-14 shrink-0 items-center justify-center border-r border-line text-muted-foreground">
                  <LinkIcon class="h-4 w-4" />
                </div>
                <input
                  v-model="podcastUrl"
                  type="text"
                  :placeholder="t('podcastParser.input.placeholder')"
                  class="h-14 min-w-0 flex-1 bg-transparent px-5 font-mono text-sm text-foreground outline-none placeholder:text-haze"
                  @keypress.enter="parsePodcast"
                >
              </div>
              <button
                type="button"
                class="flex h-14 w-full shrink-0 items-center justify-center gap-3 border-t border-line px-7 font-mono text-xs uppercase tracking-[0.18em] text-blue transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-haze sm:w-auto sm:border-l sm:border-t-0"
                :disabled="loading || !podcastUrl.trim()"
                @click="parsePodcast"
              >
                {{ loading ? t('podcastParser.input.parsing') : t('podcastParser.input.parse') }}
                <ArrowRight class="h-4 w-4" />
              </button>
            </div>

          </div>
        </section>

        <section v-if="loading || error || podcastInfo" class="grid gap-5 py-10 md:grid-cols-[140px_minmax(0,1fr)]">
          <div>
            <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">03</p>
            <p class="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('podcastParser.sections.result') }}</p>
          </div>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-7 gap-y-2">
              <div class="flex items-center gap-4">
                <span
                  class="h-2 w-2 rounded-full"
                  :class="statusTone.dot"
                  aria-hidden="true"
                />
                <p class="font-mono text-xs uppercase tracking-[0.18em]" :class="statusTone.text">{{ resultStatusLabel }}</p>
              </div>
              <p class="font-mono text-xs lowercase tracking-[0.16em] text-muted-foreground">
                {{ resolverTrail }}
              </p>
            </div>

            <div v-if="error" class="mt-10 border border-line bg-card px-5 py-6">
              <p class="font-mono text-xs uppercase tracking-[0.18em] text-foreground">{{ t('podcastParser.status.failed') }}</p>
              <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ error }}</p>
            </div>

            <div v-else-if="loading" class="mt-10 border border-line bg-card px-5 py-6">
              <p class="font-mono text-xs uppercase tracking-[0.18em] text-foreground">{{ t('podcastParser.status.resolvingSource') }}</p>
              <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ t('podcastParser.messages.resolvingSource') }}</p>
            </div>

            <div v-else-if="podcastInfo" class="mt-10 grid gap-9 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
              <div class="grid gap-8 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
                <div>
                  <img
                    v-if="episode.thumbnail"
                    :src="episode.thumbnail"
                    :alt="episode.title || t('podcastParser.result.coverAlt')"
                    referrerpolicy="no-referrer"
                    class="aspect-square w-full border border-line object-cover"
                  >
                  <div v-else class="flex aspect-square w-full items-center justify-center border border-line bg-muted text-haze">
                    <Podcast class="h-10 w-10" />
                  </div>
                </div>

                <div class="min-w-0">
                  <h2 class="break-words text-2xl font-medium leading-snug tracking-tight text-foreground md:text-3xl">
                    {{ episode.title || t('podcastParser.result.untitledEpisode') }}
                  </h2>
                  <a
                    v-if="episode.show_title"
                    class="mt-4 inline-flex max-w-full items-center gap-2 break-words font-mono text-sm text-blue transition-colors hover:text-foreground"
                    :href="podcastInfo.source_url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ episode.show_title }}
                    <ExternalLink class="h-4 w-4 shrink-0" />
                  </a>

                  <div v-if="episodeMetaItems.length" class="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <template v-for="(item, index) in episodeMetaItems" :key="`${item}-${index}`">
                      <span v-if="index > 0">/</span>
                      <span>{{ item }}</span>
                    </template>
                  </div>

                  <div v-if="episode.description" class="mt-7 max-w-2xl">
                    <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {{ displayedDescription }}
                    </p>
                    <button
                      v-if="descriptionExpandable"
                      type="button"
                      class="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-blue transition-colors hover:text-foreground"
                      @click="descriptionExpanded = !descriptionExpanded"
                    >
                      {{ descriptionExpanded ? t('podcastParser.actions.showLess') : t('podcastParser.actions.showMore') }}
                    </button>
                  </div>

                  <div class="mt-9 border-t border-line pt-6">
                    <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ t('podcastParser.result.source') }}</p>
                    <a
                      class="mt-3 inline-flex max-w-full items-center gap-2 break-all font-mono text-sm text-blue transition-colors hover:text-foreground"
                      :href="podcastInfo.source_url"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ podcastInfo.source_url }}
                      <ExternalLink class="h-4 w-4 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>

              <aside class="min-w-0 border-t border-line pt-8 xl:border-l xl:border-t-0 xl:pl-9 xl:pt-0">
                <section>
                  <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ t('podcastParser.result.audio') }}</p>
                  <audio
                    v-if="episode.audio_url"
                    class="mt-4 block w-full"
                    :src="episode.audio_url"
                    controls
                    preload="metadata"
                    @loadedmetadata="handleAudioMetadata"
                  />
                  <div v-else class="mt-4 border border-line bg-card px-4 py-5 text-sm text-muted-foreground">
                    {{ t('podcastParser.messages.noAudio') }}
                  </div>
                </section>

                <section class="mt-8 border-b border-line pb-8">
                  <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ t('podcastParser.result.audioSource') }}</p>
                  <a
                    v-if="episode.audio_url"
                    class="mt-3 inline-flex max-w-full items-start gap-2 break-all font-mono text-sm text-blue transition-colors hover:text-foreground"
                    :href="episode.audio_url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ episode.audio_url }}
                    <ExternalLink class="mt-0.5 h-4 w-4 shrink-0" />
                  </a>
                  <p v-else class="mt-3 font-mono text-sm text-muted-foreground">{{ t('podcastParser.status.missing') }}</p>
                  <p v-if="formattedAudioSize" class="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {{ t('podcastParser.result.audioSize') }} / {{ formattedAudioSize }}
                  </p>
                </section>

                <section class="mt-8">
                  <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ t('podcastParser.result.transcript') }}</p>
                  <div class="mt-4 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                    <Info class="mt-0.5 h-4 w-4 shrink-0 text-haze" />
                    <p>{{ transcriptMessage }}</p>
                  </div>
                  <p v-if="transcriptPreview" class="mt-5 max-h-40 overflow-auto whitespace-pre-line border-l border-line pl-4 text-sm leading-relaxed text-muted-foreground">
                    {{ transcriptPreview }}
                  </p>
                  <div v-if="episode.audio_url" class="mt-5">
                    <div class="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        class="inline-flex h-10 items-center gap-2 border border-line px-4 font-mono text-xs uppercase tracking-[0.16em] text-blue transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-haze"
                        :disabled="localSttLoading"
                        @click="transcribeEpisode"
                      >
                        <FileText class="h-4 w-4" />
                        {{ localSttButtonLabel }}
                      </button>
                      <button
                        v-if="localSttOutputDir"
                        type="button"
                        class="inline-flex h-10 items-center gap-2 border border-line px-4 font-mono text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-muted"
                        @click="revealLocalSttOutput"
                      >
                        <FolderOpen class="h-4 w-4" />
                        {{ t('podcastParser.localStt.reveal') }}
                      </button>
                      <span
                        v-if="localSttProgressVisible"
                        class="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {{ localSttProgressLabel }}
                      </span>
                    </div>

                    <p v-if="localSttMessage" class="mt-4 text-sm leading-relaxed text-muted-foreground">{{ localSttMessage }}</p>
                    <p v-if="localSttError" class="mt-4 text-sm leading-relaxed text-foreground">{{ localSttError }}</p>
                  </div>
                </section>

              </aside>
            </div>
          </div>
        </section>
      </div>
    </section>

    <StatusToast
      :visible="Boolean(localSttToastMessage)"
      :message="localSttToastMessage"
      type="success"
    />
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from '../lib/apiClient'
import StatusToast from '../components/StatusToast.vue'
import { ArrowRight, ExternalLink, FileText, FolderOpen, Info, Link as LinkIcon, Podcast } from 'lucide-vue-next'

const { t } = useI18n()

const getClientId = () => {
  const key = 'jacory_client_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const generated = `u_${crypto.randomUUID().replace(/-/g, '')}`
  localStorage.setItem(key, generated)
  return generated
}

axios.defaults.headers.common['x-client-id'] = getClientId()

const podcastUrl = ref('')
const loading = ref(false)
const error = ref('')
const podcastInfo = ref(null)
const detectedAudioDuration = ref(0)
const descriptionExpanded = ref(false)
const localSttLoading = ref(false)
const localSttResult = ref(null)
const localSttError = ref('')
const localSttMessage = ref('')
const localSttTaskId = ref('')
const localSttStatus = ref('')
const localSttProgress = ref(0)
const localSttToastMessage = ref('')
let localSttPoller = null
let localSttToastTimer = null

const episode = computed(() => podcastInfo.value?.episode || {})
const transcript = computed(() => podcastInfo.value?.transcript || {})

const normalizeUrlInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/:?#].*)?$/i.test(raw)) return `https://${raw}`
  return raw
}

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (_err) {
    return false
  }
}

const parsePodcast = async () => {
  const normalized = normalizeUrlInput(podcastUrl.value)
  if (!normalized) {
    error.value = t('podcastParser.errors.emptyUrl')
    return
  }
  if (!isValidUrl(normalized)) {
    error.value = t('podcastParser.errors.invalidUrl')
    return
  }

  podcastUrl.value = normalized
  loading.value = true
  error.value = ''
  podcastInfo.value = null
  detectedAudioDuration.value = 0
  descriptionExpanded.value = false
  resetLocalStt()

  try {
    const response = await axios.post('/api/podcast/parse', { url: normalized })
    podcastInfo.value = response.data
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || t('podcastParser.errors.parseFailed', { message: err.message })
  } finally {
    loading.value = false
  }
}

const handleAudioMetadata = (event) => {
  const duration = Number(event?.target?.duration || 0)
  if (Number.isFinite(duration) && duration > 0) {
    detectedAudioDuration.value = duration
  }
}

const resultStatusLabel = computed(() => {
  if (loading.value) return t('podcastParser.status.resolving')
  if (error.value) return t('podcastParser.status.failedShort')
  if (podcastInfo.value?.episode?.audio_url) return t('podcastParser.status.resolved')
  if (podcastInfo.value) return t('podcastParser.status.partial')
  return t('podcastParser.status.ready')
})

const statusTone = computed(() => {
  if (error.value) return { dot: 'bg-foreground', text: 'text-foreground' }
  if (loading.value) return { dot: 'bg-blue animate-pulse', text: 'text-blue' }
  return { dot: 'bg-blue', text: 'text-blue' }
})

const resolverTrail = computed(() => {
  if (loading.value) return t('podcastParser.trail.loading')
  if (error.value) return t('podcastParser.trail.failed')
  const platform = podcastInfo.value?.platform || 'source'
  const type = podcastInfo.value?.type || 'podcast'
  const audio = podcastInfo.value?.episode?.audio_url ? t('podcastParser.trail.audioFound') : t('podcastParser.trail.audioMissing')
  return `${platform} / ${type} / ${audio}`
})

const formattedDuration = computed(() => {
  const seconds = Number(episode.value.duration || detectedAudioDuration.value || 0)
  if (!seconds) return ''
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
})

const formattedDate = computed(() => {
  const raw = String(episode.value.published_at || '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toISOString().slice(0, 10).replaceAll('-', '.')
})

const episodeMetaItems = computed(() => [formattedDate.value, formattedDuration.value].filter(Boolean))
const transcriptStatus = computed(() => transcript.value.status || 'missing')
const transcriptPreview = computed(() => transcript.value.preview || '')
const localSttOutputDir = computed(() => localSttResult.value?.output_dir || '')
const localSttButtonLabel = computed(() => {
  if (localSttLoading.value) return t('podcastParser.localStt.transcribing')
  if (localSttResult.value) return t('podcastParser.localStt.retry')
  return t('podcastParser.localStt.action')
})
const localSttProgressVisible = computed(() => localSttLoading.value && localSttProgress.value > 0)
const localSttProgressLabel = computed(() => `${Math.max(0, Math.min(100, Math.round(localSttProgress.value)))}%`)

const formattedAudioSize = computed(() => {
  const bytes = Number(episode.value.audio_size_bytes || 0)
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = unitIndex === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
})

const descriptionText = computed(() => String(episode.value.description || '').trim())
const descriptionExpandable = computed(() => descriptionText.value.length > 180)
const displayedDescription = computed(() => {
  const text = descriptionText.value
  if (!descriptionExpandable.value || descriptionExpanded.value) return text
  return `${text.slice(0, 180)}...`
})

const transcriptMessage = computed(() => {
  const status = transcriptStatus.value
  if (status === 'available') return t('podcastParser.messages.transcriptAvailable')
  if (status === 'marker_only') return t('podcastParser.messages.transcriptMarkerOnly')
  if (status === 'insufficient') return t('podcastParser.messages.transcriptInsufficient')
  return t('podcastParser.messages.transcriptMissing')
})

const resetLocalStt = () => {
  stopLocalSttPolling()
  clearLocalSttToast()
  localSttLoading.value = false
  localSttResult.value = null
  localSttError.value = ''
  localSttMessage.value = ''
  localSttTaskId.value = ''
  localSttStatus.value = ''
  localSttProgress.value = 0
}

const stopLocalSttPolling = () => {
  if (localSttPoller) {
    window.clearInterval(localSttPoller)
    localSttPoller = null
  }
}

const clearLocalSttToast = () => {
  if (localSttToastTimer) {
    window.clearTimeout(localSttToastTimer)
    localSttToastTimer = null
  }
  localSttToastMessage.value = ''
}

const showLocalSttToast = (message) => {
  clearLocalSttToast()
  localSttToastMessage.value = message
  localSttToastTimer = window.setTimeout(() => {
    localSttToastMessage.value = ''
    localSttToastTimer = null
  }, 3200)
}

const refreshLocalSttTask = async () => {
  if (!localSttTaskId.value) return
  const response = await axios.get(`/api/transcript/local-stt/tasks/${localSttTaskId.value}`)
  const task = response.data || {}
  localSttStatus.value = task.status || task.stage || ''
  localSttProgress.value = Number(task.progress || 0)

  if (task.status === 'completed') {
    stopLocalSttPolling()
    localSttResult.value = task.result
    localSttLoading.value = false
    localSttProgress.value = 100
    localSttMessage.value = ''
    showLocalSttToast(t('podcastParser.localStt.complete'))
    return
  }

  if (task.status === 'failed') {
    stopLocalSttPolling()
    localSttLoading.value = false
    localSttError.value = task.error || t('podcastParser.errors.localSttFailed', { message: '' })
    localSttMessage.value = ''
    return
  }

  localSttMessage.value = ''
}

const startLocalSttPolling = () => {
  stopLocalSttPolling()
  localSttPoller = window.setInterval(() => {
    refreshLocalSttTask().catch((err) => {
      stopLocalSttPolling()
      localSttLoading.value = false
      localSttError.value = err.response?.data?.error || t('podcastParser.errors.localSttFailed', { message: err.message })
      localSttMessage.value = ''
    })
  }, 3000)
}

const transcribeEpisode = async () => {
  if (!episode.value.audio_url || localSttLoading.value) return
  localSttLoading.value = true
  localSttError.value = ''
  localSttMessage.value = ''
  localSttResult.value = null
  localSttStatus.value = 'queued'
  localSttProgress.value = 0

  try {
    const response = await axios.post('/api/transcript/local-stt/tasks', {
      source_url: episode.value.audio_url,
      title: episode.value.title || podcastInfo.value?.title || t('podcastParser.result.untitledEpisode'),
      source: podcastInfo.value?.title || '',
      language: 'zh',
      model: 'small',
      source_type: 'podcast'
    })
    localSttTaskId.value = response.data?.task_id || ''
    localSttStatus.value = response.data?.status || 'queued'
    localSttProgress.value = Number(response.data?.progress || 0)
    startLocalSttPolling()
    await refreshLocalSttTask()
  } catch (err) {
    localSttError.value = err.response?.data?.error || t('podcastParser.errors.localSttFailed', { message: err.message })
    localSttMessage.value = ''
    localSttLoading.value = false
  }
}

const revealLocalSttOutput = async () => {
  if (!localSttOutputDir.value) return
  localSttError.value = ''
  try {
    const response = await axios.post('/api/reveal', { path: localSttOutputDir.value })
    localSttMessage.value = response.data?.message || t('podcastParser.localStt.revealComplete')
  } catch (err) {
    localSttError.value = err.response?.data?.error || t('podcastParser.errors.revealFailed')
  }
}

onBeforeUnmount(() => {
  stopLocalSttPolling()
  clearLocalSttToast()
})
</script>
