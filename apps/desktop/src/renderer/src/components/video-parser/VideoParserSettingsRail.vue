<template>
  <aside class="settings-rail border-line xl:border-l xl:pl-8">
    <div class="sticky top-24 space-y-10">
      <section class="pb-9">
        <div class="mb-7 flex items-center justify-between">
          <p class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-blue">{{ t('videoParser.sections.cookiesSettings') }}</p>
          <button type="button" class="text-muted-foreground hover:text-foreground" @click="emit('close')">
            <X class="h-4 w-4" />
          </button>
        </div>

        <div>
          <div class="pb-7">
            <p class="tech">{{ t('videoParser.settings.mode') }}</p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                v-for="mode in cookieModes"
                :key="mode"
                type="button"
                class="settings-choice"
                :class="{ 'is-selected': cookieMode === mode }"
                @click="emit('update:cookieMode', mode)"
              >
                {{ t(`videoParser.settings.cookieModes.${mode}`) }}
              </button>
            </div>
          </div>

          <div class="space-y-7 border-t border-line py-7">
            <div>
              <p class="tech">{{ t('videoParser.settings.browserSource') }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <button
                  v-for="source in browserSources"
                  :key="source.value"
                  type="button"
                  class="settings-choice"
                  :class="{ 'is-selected': browserCookieSource === source.value }"
                  :disabled="cookieMode !== 'browser'"
                  @click="emit('update:browserCookieSource', source.value)"
                >
                  {{ source.label }}
                </button>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex h-10 items-center border border-line px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:bg-muted disabled:text-haze"
              :disabled="savingCookieSettings"
              @click="emit('save-cookie-settings')"
            >
              {{ savingCookieSettings ? t('videoParser.saving') : t('videoParser.saveUsage') }}
            </button>

            <p class="text-xs leading-relaxed text-muted-foreground">{{ t('videoParser.settings.cookiesUsageNote') }}</p>
          </div>

          <div class="border-t border-line pt-7">
            <div class="mb-3 flex items-center justify-between">
              <p class="tech">{{ t('videoParser.settings.platformCookies') }}</p>
              <button type="button" class="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:text-foreground" @click="emit('add-platform')">
                <Plus class="h-3.5 w-3.5" />
                {{ t('videoParser.settings.custom') }}
              </button>
            </div>
            <div>
              <div v-for="platform in cookiePlatformRows" :key="platform.key" class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="h-1.5 w-1.5 rounded-full" :class="platform.statusTone === 'active' ? 'bg-blue' : 'bg-haze'"></span>
                    <span class="font-medium text-foreground">{{ platform.label }}</span>
                  </div>
                  <p class="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {{ platform.statusLabel }}
                  </p>
                </div>
                <div class="flex items-center gap-4">
                  <button type="button" class="settings-link" @click="emit('edit-platform', platform.key)">
                    {{ platform.actionLabel }}
                  </button>
                  <button v-if="platform.hasManualCookies || platform.custom" type="button" class="settings-link" @click="emit('delete-platform', platform.key)">
                    {{ t('videoParser.settings.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-7">
          <p class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-blue">{{ t('videoParser.sections.directorySettings') }}</p>
        </div>
        <div class="space-y-6">
          <div>
            <p class="tech">{{ t('videoParser.settings.defaultDownloadDirectory') }}</p>
            <div class="mt-3 flex border border-line bg-card">
              <div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                <Folder class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="truncate font-mono text-xs text-foreground">{{ defaultDownloadDir || t('videoParser.notSet') }}</span>
              </div>
              <button type="button" class="border-l border-line px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:bg-muted disabled:text-haze" :disabled="savingSettings" @click="emit('choose-default-folder')">
                {{ t('videoParser.settings.change') }}
              </button>
            </div>
          </div>
          <div>
            <p class="tech">{{ t('videoParser.settings.temporaryDirectory') }}</p>
            <div class="mt-3 flex border border-line bg-card">
              <div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                <Folder class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="truncate font-mono text-xs text-foreground">{{ downloadDirOverride || t('videoParser.settings.useDefaultDirectory') }}</span>
              </div>
              <button type="button" class="border-l border-line px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-blue hover:bg-muted" @click="emit('choose-temporary-folder')">
                {{ t('videoParser.settings.change') }}
              </button>
            </div>
            <button v-if="downloadDirOverride" type="button" class="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-blue" @click="emit('update:downloadDirOverride', '')">
              {{ t('videoParser.clearOneTimeDirectory') }}
            </button>
            <p class="mt-3 text-xs leading-relaxed text-muted-foreground">{{ t('videoParser.settings.temporaryDirectoryNote') }}</p>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { Folder, Plus, X } from 'lucide-vue-next'

defineProps({
  cookieModes: { type: Array, required: true },
  cookieMode: { type: String, required: true },
  browserSources: { type: Array, required: true },
  browserCookieSource: { type: String, required: true },
  savingCookieSettings: { type: Boolean, required: true },
  cookiePlatformRows: { type: Array, required: true },
  defaultDownloadDir: { type: String, default: '' },
  downloadDirOverride: { type: String, default: '' },
  savingSettings: { type: Boolean, required: true }
})

const emit = defineEmits([
  'close',
  'update:cookieMode',
  'update:browserCookieSource',
  'save-cookie-settings',
  'add-platform',
  'edit-platform',
  'delete-platform',
  'choose-default-folder',
  'choose-temporary-folder',
  'update:downloadDirOverride'
])
const { t } = useI18n()
</script>

<style scoped>
.settings-choice {
  border-bottom: 1px solid transparent;
  padding: 0.35rem 0.25rem;
  font-family: theme("fontFamily.mono");
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  transition:
    color 200ms var(--ease-premium),
    border-color 200ms var(--ease-premium);
}

.settings-choice:hover,
.settings-choice.is-selected {
  border-color: var(--blue);
  color: var(--blue);
}

.settings-choice:disabled {
  cursor: not-allowed;
  border-color: transparent;
  color: var(--haze);
}

.settings-link {
  font-family: theme("fontFamily.mono");
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--blue);
  transition: color 200ms var(--ease-premium);
}

.settings-link:hover {
  color: var(--foreground);
}
</style>
