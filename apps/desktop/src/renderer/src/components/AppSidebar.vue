<template>
  <aside class="window-drag fixed inset-y-0 left-0 z-[90] flex w-56 select-none flex-col border-r border-line bg-muted px-3 pb-3 pt-16">
    <div class="mb-5 flex items-baseline gap-2 px-1">
      <p class="text-lg font-semibold text-haze">MediaParser</p>
      <p class="text-sm font-medium text-haze/70">v0.2.1</p>
    </div>

    <nav class="flex flex-1 flex-col gap-1" :aria-label="toolsLabel">
      <button
        v-for="tool in tools"
        :key="tool.value"
        type="button"
        class="window-no-drag group flex h-10 w-full items-center gap-3 rounded px-3 text-sm font-medium transition-colors"
        :class="activeTool === tool.value ? 'text-blue' : 'text-muted-foreground hover:text-foreground'"
        :aria-label="tool.label"
        :title="tool.label"
        @click="emit('update:activeTool', tool.value)"
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

    <div class="border-t border-line pt-3">
      <button
        type="button"
        class="window-no-drag flex h-10 w-full items-center gap-3 rounded px-3 text-sm font-medium transition-colors"
        :class="settingsOpen ? 'text-blue' : 'text-muted-foreground hover:text-foreground'"
        :aria-label="settingsLabel"
        :aria-expanded="settingsOpen"
        aria-haspopup="dialog"
        @click="emit('open-settings')"
      >
        <Settings class="h-4 w-4 shrink-0" :class="settingsOpen ? 'text-blue' : ''" :stroke-width="1.8" aria-hidden="true" />
        <span class="truncate">{{ settingsLabel }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { Settings } from 'lucide-vue-next'

defineProps({
  tools: { type: Array, required: true },
  activeTool: { type: String, required: true },
  settingsOpen: { type: Boolean, default: false },
  toolsLabel: { type: String, required: true },
  settingsLabel: { type: String, required: true }
})

const emit = defineEmits(['update:activeTool', 'open-settings'])
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
