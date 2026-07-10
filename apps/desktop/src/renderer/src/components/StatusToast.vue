<template>
  <Transition name="status-toast">
    <div
      v-if="visible"
      class="pointer-events-none fixed right-8 top-[5.5rem] z-[60] flex items-center gap-3 border border-line-strong bg-background px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dotClass" aria-hidden="true"></span>
      <span class="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
        {{ message }}
      </span>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['success', 'error', 'info'].includes(value)
  }
})

const dotClass = computed(() => {
  if (props.type === 'success') return 'bg-green-500'
  if (props.type === 'error') return 'bg-destructive'
  return 'bg-blue'
})
</script>

<style scoped>
.status-toast-enter-active,
.status-toast-leave-active {
  transition:
    opacity 320ms var(--ease-premium),
    transform 320ms var(--ease-premium);
}

.status-toast-enter-from,
.status-toast-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

@media (prefers-reduced-motion: reduce) {
  .status-toast-enter-active,
  .status-toast-leave-active {
    transition: opacity 120ms linear;
  }

  .status-toast-enter-from,
  .status-toast-leave-to {
    transform: none;
  }
}
</style>
