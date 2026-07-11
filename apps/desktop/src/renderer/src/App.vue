<template>
  <div class="min-h-screen bg-background text-foreground">
    <aside class="fixed inset-y-0 left-0 z-[90] flex w-56 flex-col border-r border-line bg-muted px-3 pb-3 pt-16">
      <div class="mb-5 flex items-baseline gap-2 px-1">
        <p class="text-lg font-semibold text-haze">MediaParser</p>
        <p class="text-sm font-medium text-haze/70">v0.1.1</p>
      </div>

      <nav class="flex flex-1 flex-col gap-1.5" :aria-label="t('tools.sidebar.toolsLabel')">
        <button
          v-for="tool in tools"
          :key="tool.value"
          type="button"
          class="group flex h-10 w-full items-center gap-3 rounded px-3 text-sm font-medium transition-colors"
          :class="activeTool === tool.value ? 'text-blue' : 'text-muted-foreground hover:text-foreground'"
          :aria-label="tool.label"
          :title="tool.label"
          @click="activeTool = tool.value"
        >
          <component
            :is="tool.icon"
            class="h-4 w-4 shrink-0"
            :class="activeTool === tool.value ? 'text-blue' : 'text-muted-foreground group-hover:text-foreground'"
            :stroke-width="1.8"
            aria-hidden="true"
          />
          <span class="truncate">{{ tool.label }}</span>
        </button>
      </nav>

      <div ref="settingsRef" class="relative border-t border-line pt-3">
        <button
          type="button"
          class="flex h-10 w-full items-center gap-3 rounded px-3 text-sm font-medium transition-colors"
          :class="settingsOpen ? 'text-blue' : 'text-muted-foreground hover:text-foreground'"
          :aria-label="t('tools.sidebar.settingsLabel')"
          :aria-expanded="settingsOpen"
          aria-haspopup="dialog"
          @click="settingsOpen = !settingsOpen"
        >
          <Settings class="h-4 w-4 shrink-0" :class="settingsOpen ? 'text-blue' : ''" :stroke-width="1.8" aria-hidden="true" />
          <span class="truncate">{{ t('tools.sidebar.settingsLabel') }}</span>
        </button>

        <section
          v-if="settingsOpen"
          class="absolute bottom-0 left-full ml-3 w-56 border border-line bg-background p-4"
          role="dialog"
          :aria-label="t('tools.sidebar.settingsLabel')"
        >
          <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('tools.sidebar.settingsLabel') }}</p>
          <div class="mt-4 border-t border-line pt-4">
            <p class="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{{ t('language.label') }}</p>
            <LanguageSwitcher />
          </div>
        </section>
      </div>
    </aside>

    <div class="pl-56">
      <VideoParser v-if="activeTool === 'video'" />
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
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clapperboard, Download, Podcast, Settings } from 'lucide-vue-next'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import PodcastParser from './views/PodcastParser.vue'
import VideoParser from './views/VideoParser.vue'

const { t } = useI18n()
const activeTool = ref('video')
const settingsOpen = ref(false)
const settingsRef = ref(null)

const tools = computed(() => [
  { value: 'video', label: t('tools.videoParser.title'), icon: Clapperboard },
  { value: 'podcast', label: t('tools.podcastParser.title'), icon: Podcast },
  { value: 'downloads', label: t('tools.downloadsList.title'), icon: Download }
])

const handlePointerDown = (event) => {
  if (settingsRef.value && !settingsRef.value.contains(event.target)) {
    settingsOpen.value = false
  }
}

const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    settingsOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
