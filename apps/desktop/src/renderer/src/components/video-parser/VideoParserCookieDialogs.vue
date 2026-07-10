<template>
  <div v-if="showAddPlatform" class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4" @click.self="emit('update:showAddPlatform', false)">
    <div class="w-full max-w-md border border-line bg-card p-6">
      <h3 class="font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('videoParser.addPlatformTitle') }}</h3>
      <input
        :value="newPlatformName"
        type="text"
        :placeholder="t('videoParser.platformPlaceholder')"
        class="mt-5 h-12 w-full border border-line bg-transparent px-4 font-mono text-sm outline-none focus:border-line-strong"
        @input="emit('update:newPlatformName', $event.target.value)"
        @keypress.enter="emit('add-platform')"
      />
      <div class="mt-5 flex gap-3">
        <button type="button" class="h-10 flex-1 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:bg-muted disabled:text-haze" :disabled="!newPlatformName.trim()" @click="emit('add-platform')">
          {{ t('videoParser.actions.add') }}
        </button>
        <button type="button" class="h-10 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted" @click="emit('update:showAddPlatform', false)">
          {{ t('videoParser.actions.cancel') }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="showEditCookies" class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4" @click.self="emit('update:showEditCookies', false)">
    <div class="w-full max-w-2xl border border-line bg-card p-6">
      <div class="mb-5 flex items-center justify-between">
        <h3 class="font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('videoParser.setCookiesTitle', { platform: editingPlatform }) }}</h3>
        <button type="button" class="text-muted-foreground hover:text-foreground" @click="emit('update:showEditCookies', false)">
          <X class="h-4 w-4" />
        </button>
      </div>
      <p class="mb-4 border-l border-line-strong pl-3 text-xs leading-relaxed text-muted-foreground">{{ t('videoParser.cookiesSavedTip') }}</p>
      <textarea
        :value="cookiesText"
        :placeholder="t('videoParser.cookiesPlaceholder', { platform: editingPlatform })"
        class="h-64 w-full border border-line bg-transparent px-4 py-3 font-mono text-sm outline-none focus:border-line-strong"
        @input="emit('update:cookiesText', $event.target.value)"
      ></textarea>
      <div class="mt-5 flex gap-3">
        <button type="button" class="h-10 flex-1 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:bg-muted disabled:text-haze" :disabled="!cookiesText.trim() || savingCookies" @click="emit('save-cookies')">
          {{ savingCookies ? t('videoParser.saving') : t('videoParser.actions.save') }}
        </button>
        <button type="button" class="h-10 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted" @click="emit('update:showEditCookies', false)">
          {{ t('videoParser.actions.cancel') }}
        </button>
      </div>
      <p v-if="cookiesStatus" class="mt-4 border-l border-line-strong pl-3 text-xs leading-relaxed text-muted-foreground">{{ cookiesStatus.message }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'

defineProps({
  showAddPlatform: { type: Boolean, required: true },
  newPlatformName: { type: String, default: '' },
  showEditCookies: { type: Boolean, required: true },
  editingPlatform: { type: String, default: '' },
  cookiesText: { type: String, default: '' },
  savingCookies: { type: Boolean, required: true },
  cookiesStatus: { type: Object, default: null }
})

const emit = defineEmits([
  'update:showAddPlatform',
  'update:newPlatformName',
  'add-platform',
  'update:showEditCookies',
  'update:cookiesText',
  'save-cookies'
])
const { t } = useI18n()
</script>
