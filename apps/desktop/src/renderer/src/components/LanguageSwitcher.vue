<template>
  <div ref="switcherRef" class="relative inline-flex font-mono text-[11px] tracking-[0.16em]">
    <button
      type="button"
      class="inline-flex h-8 items-center gap-2 border border-line bg-background px-3 uppercase text-muted-foreground transition-colors duration-300 hover:border-line-strong hover:text-foreground"
      :aria-label="t('language.label')"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      aria-controls="language-menu"
      @click="isOpen = !isOpen"
    >
      <Globe2 class="h-3.5 w-3.5" :stroke-width="1.5" aria-hidden="true" />
      <span>{{ currentLanguage.shortLabel }}</span>
    </button>

    <div
      v-if="isOpen"
      id="language-menu"
      class="absolute right-0 top-full z-50 mt-2 w-max border border-line bg-background py-1 text-muted-foreground"
      role="menu"
      :aria-label="t('language.label')"
    >
      <button
        v-for="option in languageOptions"
        :key="option.value"
        type="button"
        class="grid w-full grid-cols-[0.5rem_1fr] items-center gap-3 px-3 py-2.5 text-left transition-colors duration-300 hover:bg-card hover:text-foreground"
        :class="locale === option.value ? 'text-foreground' : 'text-muted-foreground'"
        role="menuitemradio"
        :aria-checked="locale === option.value"
        @click="switchLocale(option.value)"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="locale === option.value ? 'bg-blue' : 'bg-transparent'"
          aria-hidden="true"
        />
        <span class="font-sans text-xs tracking-normal">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe2 } from 'lucide-vue-next'
import { persistLocale, supportedLocales } from '../i18n'

const { locale, t } = useI18n()
const isOpen = ref(false)
const switcherRef = ref(null)

const languageDetails = {
  'zh-CN': {
    shortLabel: 'ZH',
    label: '中文'
  },
  'en-US': {
    shortLabel: 'EN',
    label: 'English'
  }
}

const languageOptions = computed(() => supportedLocales.map((value) => ({
  value,
  shortLabel: languageDetails[value]?.shortLabel ?? value.slice(0, 2).toUpperCase(),
  label: languageDetails[value]?.label ?? value
})))

const currentLanguage = computed(
  () => languageOptions.value.find((option) => option.value === locale.value) ?? languageOptions.value[0]
)

const switchLocale = (value) => {
  if (locale.value !== value) {
    locale.value = value
    persistLocale(value)
  }

  isOpen.value = false
}

const handlePointerDown = (event) => {
  if (switcherRef.value && !switcherRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    isOpen.value = false
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
