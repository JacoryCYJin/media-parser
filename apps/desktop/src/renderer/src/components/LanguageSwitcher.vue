<template>
  <select :value="locale" :aria-label="t('language.label')" class="language-select" @change="switchLocale($event.target.value)">
    <option value="zh-CN">简体中文</option><option value="en-US">English</option>
  </select>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
import { persistLocale } from '../i18n'
const { locale, t } = useI18n()
function switchLocale(value) { locale.value = value; persistLocale(value) }
</script>
<style scoped>
.language-select { min-width: 160px; height: 36px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-background); color: var(--color-text); font-size: 14px; }

.language-select { border-radius:10px; font-size:13px; border-color:var(--color-border); }

</style>
