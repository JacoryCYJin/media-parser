<template>
  <Transition name="status-toast">
    <div
      v-if="visible && internalVisible"
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'

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
  },
  duration: {
    type: Number,
    default: 3200
  }
})

const TOAST_DOT_CLASSES = {
  success: 'bg-toast-success',
  info: 'bg-toast-info',
  error: 'bg-toast-error'
}

const getToastDotClass = (type) => TOAST_DOT_CLASSES[type] || TOAST_DOT_CLASSES.info

const internalVisible = ref(false)
let hideTimer = 0

const clearHideTimer = () => {
  if (!hideTimer) return
  window.clearTimeout(hideTimer)
  hideTimer = 0
}

watch(
  () => [props.visible, props.message, props.type, props.duration],
  ([visible, message, _type, duration]) => {
    clearHideTimer()
    internalVisible.value = Boolean(visible && message)
    if (!internalVisible.value || duration <= 0) return

    hideTimer = window.setTimeout(() => {
      internalVisible.value = false
      hideTimer = 0
    }, duration)
  },
  { immediate: true }
)

onBeforeUnmount(clearHideTimer)

const dotClass = computed(() => {
  return getToastDotClass(props.type)
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
