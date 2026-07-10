<template>
  <div class="min-h-screen bg-background text-foreground">
    <aside class="fixed inset-y-0 left-0 z-[90] flex w-16 flex-col items-center border-r border-line bg-background">
      <div class="flex h-16 w-full items-center justify-center border-b border-line">
        <span class="h-2 w-2 rounded-full bg-blue" aria-hidden="true"></span>
      </div>

      <nav class="flex flex-1 flex-col items-center gap-2 py-4" :aria-label="t('tools.sidebar.toolsLabel')">
        <button
          v-for="tool in tools"
          :key="tool.value"
          type="button"
          class="group flex h-11 w-11 items-center justify-center border border-transparent transition-colors hover:border-line hover:bg-card"
          :class="activeTool === tool.value ? 'border-line-strong bg-card text-blue' : 'text-muted-foreground'"
          :aria-label="tool.label"
          :title="tool.label"
          @click="activeTool = tool.value"
        >
          <component :is="tool.icon" class="h-4.5 w-4.5" :stroke-width="1.7" aria-hidden="true" />
        </button>
      </nav>

      <div ref="settingsRef" class="relative w-full border-t border-line p-2">
        <button
          type="button"
          class="flex h-12 w-full items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-line hover:bg-card hover:text-foreground"
          :class="settingsOpen ? 'border-line-strong bg-card text-blue' : ''"
          :aria-label="t('tools.sidebar.settingsLabel')"
          :aria-expanded="settingsOpen"
          aria-haspopup="dialog"
          @click="settingsOpen = !settingsOpen"
        >
          <Settings class="h-4.5 w-4.5" :stroke-width="1.7" aria-hidden="true" />
        </button>

        <section
          v-if="settingsOpen"
          class="absolute bottom-2 left-full ml-3 w-56 border border-line bg-background p-4"
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

    <div class="pl-16">
      <VideoParser v-if="activeTool === 'video'" />
      <PodcastParser v-else />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clapperboard, Podcast, Settings } from 'lucide-vue-next'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import PodcastParser from './views/PodcastParser.vue'
import VideoParser from './views/VideoParser.vue'

const { t } = useI18n()
const activeTool = ref('video')
const settingsOpen = ref(false)
const settingsRef = ref(null)

const tools = computed(() => [
  { value: 'video', label: t('tools.videoParser.title'), icon: Clapperboard },
  { value: 'podcast', label: t('tools.podcastParser.title'), icon: Podcast }
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
