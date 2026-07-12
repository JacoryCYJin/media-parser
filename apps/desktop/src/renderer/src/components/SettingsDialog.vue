<template>
  <div class="window-no-drag fixed inset-0 z-[120] flex items-center justify-center bg-foreground/55 px-5 py-8" role="presentation" @pointerdown.self="emit('close')">
    <section
      class="settings-shell grid grid-cols-[220px_minmax(0,1fr)] overflow-hidden border border-line bg-background"
      role="dialog"
      aria-modal="true"
      :aria-label="t('settingsDialog.title')"
    >
      <aside class="overflow-hidden border-r border-line bg-muted px-3 py-6">
        <nav class="space-y-1" :aria-label="t('settingsDialog.title')">
          <button
            v-for="item in sections"
            :key="item.value"
            type="button"
            class="group flex h-10 w-full items-center gap-3 rounded px-3 text-left text-sm font-medium transition-colors"
            :class="activeSection === item.value ? 'text-blue' : 'text-muted-foreground hover:text-foreground'"
            @click="activeSection = item.value"
          >
            <component
              :is="item.icon"
              class="h-4 w-4 shrink-0"
              :class="activeSection === item.value ? 'text-blue' : 'text-muted-foreground group-hover:text-foreground'"
              :stroke-width="1.8"
              aria-hidden="true"
            />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <div class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header class="flex items-start justify-between gap-6 border-b border-line px-12 pb-6 pt-10">
          <div>
            <h3 class="text-2xl font-medium tracking-tight text-foreground">{{ activeMeta.label }}</h3>
          </div>
          <button type="button" class="text-muted-foreground transition-colors hover:text-foreground" :aria-label="t('settingsDialog.close')" @click="emit('close')">
            <X class="h-5 w-5" :stroke-width="1.7" />
          </button>
        </header>

        <div class="min-h-0 overflow-y-auto px-12">
          <section v-if="activeSection === 'general'" class="settings-section">
            <SettingBlock :title="t('settingsDialog.general.languageTitle')" :description="t('settingsDialog.general.languageDescription')">
              <LanguageSwitcher />
            </SettingBlock>
          </section>

          <section v-else-if="activeSection === 'downloads'" class="settings-section">
            <SettingBlock :title="t('settingsDialog.downloads.defaultTitle')" :description="t('settingsDialog.downloads.defaultDescription')">
              <PathControl
                :path="defaultDownloadDir || t('videoParser.notSet')"
                :button-label="savingSettings ? t('videoParser.saving') : t('videoParser.settings.change')"
                :disabled="savingSettings"
                @choose="emit('choose-default-folder')"
              />
            </SettingBlock>
            <SettingBlock :title="t('settingsDialog.downloads.temporaryTitle')" :description="t('videoParser.settings.temporaryDirectoryNote')">
              <PathControl
                :path="downloadDirOverride || t('videoParser.settings.useDefaultDirectory')"
                :button-label="t('videoParser.settings.change')"
                @choose="emit('choose-temporary-folder')"
              />
              <button
                v-if="downloadDirOverride"
                type="button"
                class="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-blue"
                @click="emit('update:downloadDirOverride', '')"
              >
                {{ t('videoParser.clearOneTimeDirectory') }}
              </button>
            </SettingBlock>
          </section>

          <section v-else-if="activeSection === 'cookies'" class="settings-section">
            <SettingBlock :title="t('videoParser.settings.mode')" :description="t('videoParser.settings.cookiesUsageNote')">
              <SegmentedControl
                :options="cookieModes.map((mode) => ({ value: mode, label: t(`videoParser.settings.cookieModes.${mode}`) }))"
                :model-value="cookieMode"
                @update:model-value="emit('update:cookieMode', $event)"
              />
            </SettingBlock>

            <SettingBlock :title="t('videoParser.settings.browserSource')" :description="t('settingsDialog.cookies.browserDescription')">
              <SegmentedControl
                :options="browserSources"
                :model-value="browserCookieSource"
                :disabled="cookieMode !== 'browser'"
                @update:model-value="emit('update:browserCookieSource', $event)"
              />
              <button type="button" class="settings-action mt-5" :disabled="savingCookieSettings" @click="emit('save-cookie-settings')">
                {{ savingCookieSettings ? t('videoParser.saving') : t('videoParser.saveUsage') }}
              </button>
            </SettingBlock>

            <SettingBlock :title="t('videoParser.settings.platformCookies')" :description="t('settingsDialog.cookies.platformDescription')">
              <div class="divide-y divide-line">
                <div v-for="platform in cookiePlatformRows" :key="platform.key" class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-3">
                      <span class="h-1.5 w-1.5 rounded-full" :class="platform.statusTone === 'active' ? 'bg-blue' : 'bg-haze'" />
                      <span class="font-medium text-foreground">{{ platform.label }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <button type="button" class="settings-link" @click="emit('edit-platform', platform.key)">{{ platform.actionLabel }}</button>
                    <button v-if="platform.hasManualCookies || platform.custom" type="button" class="settings-link" @click="emit('delete-platform', platform.key)">
                      {{ t('videoParser.settings.delete') }}
                    </button>
                  </div>
                </div>
              </div>
              <button type="button" class="settings-action mt-5" @click="emit('add-platform')">
                <Plus class="h-4 w-4" />
                {{ t('videoParser.settings.custom') }}
              </button>
            </SettingBlock>
          </section>

          <section v-else-if="activeSection === 'models'" class="settings-section">
            <SettingBlock :title="t('settingsDialog.models.providerTitle')" :description="t('settingsDialog.models.providerDescription')">
              <SegmentedControl
                :options="modelProviders.map((provider) => ({ value: provider, label: t(`settingsDialog.models.providers.${provider}`) }))"
                :model-value="modelProvider"
                @update:model-value="emit('update:modelProvider', $event)"
              />
            </SettingBlock>

            <SettingBlock :title="t('settingsDialog.models.apiTitle')" :description="t('settingsDialog.models.apiDescription')">
              <div class="grid gap-4">
                <LabeledInput :label="t('settingsDialog.models.baseUrl')" :model-value="analysisBaseUrl" @update:model-value="emit('update:analysisBaseUrl', $event)" />
                <LabeledInput :label="t('settingsDialog.models.apiKey')" :model-value="analysisApiKey" type="password" @update:model-value="emit('update:analysisApiKey', $event)" />
                <LabeledInput :label="t('settingsDialog.models.model')" :model-value="analysisModel" @update:model-value="emit('update:analysisModel', $event)" />
              </div>
              <button type="button" class="settings-action mt-5" :disabled="savingModelSettings" @click="emit('save-model-settings')">
                {{ savingModelSettings ? t('settingsDialog.saving') : t('settingsDialog.save') }}
              </button>
            </SettingBlock>
          </section>

          <section v-else class="settings-section">
            <SettingBlock title="MediaParser" :description="t('settingsDialog.about.description')">
              <dl class="grid gap-4 text-sm">
                <div class="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-line pb-3">
                  <dt class="tech">{{ t('settingsDialog.about.version') }}</dt>
                  <dd class="font-mono text-foreground">v0.2.1</dd>
                </div>
                <div class="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-line pb-3">
                  <dt class="tech">{{ t('settingsDialog.about.runtime') }}</dt>
                  <dd class="text-muted-foreground">{{ t('settingsDialog.about.runtimeValue') }}</dd>
                </div>
              </dl>
            </SettingBlock>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cookie, Download, Folder, Globe2, Info, Plus, Settings2, X } from 'lucide-vue-next'
import LanguageSwitcher from './LanguageSwitcher.vue'

const props = defineProps({
  defaultDownloadDir: { type: String, default: '' },
  downloadDirOverride: { type: String, default: '' },
  savingSettings: { type: Boolean, default: false },
  cookieModes: { type: Array, required: true },
  cookieMode: { type: String, required: true },
  browserSources: { type: Array, required: true },
  browserCookieSource: { type: String, required: true },
  savingCookieSettings: { type: Boolean, default: false },
  cookiePlatformRows: { type: Array, required: true },
  modelProviders: { type: Array, required: true },
  modelProvider: { type: String, required: true },
  analysisBaseUrl: { type: String, default: '' },
  analysisApiKey: { type: String, default: '' },
  analysisModel: { type: String, default: '' },
  savingModelSettings: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close',
  'update:downloadDirOverride',
  'update:cookieMode',
  'update:browserCookieSource',
  'update:modelProvider',
  'update:analysisBaseUrl',
  'update:analysisApiKey',
  'update:analysisModel',
  'choose-default-folder',
  'choose-temporary-folder',
  'save-cookie-settings',
  'add-platform',
  'edit-platform',
  'delete-platform',
  'save-model-settings'
])

const { t } = useI18n()
const activeSection = ref('general')

const sections = computed(() => [
  { value: 'general', index: '01', label: t('settingsDialog.sections.general'), eyebrow: 'GENERAL', icon: Globe2 },
  { value: 'downloads', index: '02', label: t('settingsDialog.sections.downloads'), eyebrow: 'DOWNLOADS', icon: Download },
  { value: 'cookies', index: '03', label: t('settingsDialog.sections.cookies'), eyebrow: 'COOKIES', icon: Cookie },
  { value: 'models', index: '04', label: t('settingsDialog.sections.models'), eyebrow: 'MODELS', icon: Settings2 },
  { value: 'about', index: '05', label: t('settingsDialog.sections.about'), eyebrow: 'ABOUT', icon: Info }
])

const activeMeta = computed(() => sections.value.find((item) => item.value === activeSection.value) || sections.value[0])

const SettingBlock = defineComponent({
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' }
  },
  setup(blockProps, { slots }) {
    return () =>
      h('div', { class: 'grid gap-5 border-b border-line py-8 lg:grid-cols-[220px_minmax(0,1fr)]' }, [
        h('div', [
          h('p', { class: 'font-mono text-xs uppercase tracking-[0.18em] text-foreground' }, blockProps.title),
          blockProps.description ? h('p', { class: 'mt-3 text-xs leading-5 text-muted-foreground' }, blockProps.description) : null
        ]),
        h('div', { class: 'min-w-0' }, slots.default?.())
      ])
  }
})

const SegmentedControl = defineComponent({
  props: {
    options: { type: Array, required: true },
    modelValue: { type: String, required: true },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(controlProps, { emit: controlEmit }) {
    return () =>
      h('div', { class: 'flex flex-wrap items-center gap-2' }, controlProps.options.map((option) =>
        h(
          'button',
          {
            type: 'button',
            disabled: controlProps.disabled,
            class: [
              'settings-choice',
              controlProps.modelValue === option.value ? 'is-selected' : ''
            ],
            onClick: () => controlEmit('update:modelValue', option.value)
          },
          option.label
        )
      ))
  }
})

const PathControl = defineComponent({
  props: {
    path: { type: String, required: true },
    buttonLabel: { type: String, required: true },
    disabled: { type: Boolean, default: false }
  },
  emits: ['choose'],
  setup(pathProps, { emit: pathEmit }) {
    return () =>
      h('div', { class: 'flex border border-line bg-card' }, [
        h('div', { class: 'flex min-w-0 flex-1 items-center gap-3 px-3 py-3' }, [
          h(Folder, { class: 'h-4 w-4 shrink-0 text-muted-foreground' }),
          h('span', { class: 'truncate font-mono text-xs text-foreground' }, pathProps.path)
        ]),
        h(
          'button',
          {
            type: 'button',
            disabled: pathProps.disabled,
            class: 'border-l border-line px-3 font-mono text-xs uppercase tracking-[0.16em] text-blue transition-colors hover:bg-muted disabled:text-haze',
            onClick: () => pathEmit('choose')
          },
          pathProps.buttonLabel
        )
      ])
  }
})

const LabeledInput = defineComponent({
  props: {
    label: { type: String, required: true },
    modelValue: { type: String, default: '' },
    type: { type: String, default: 'text' }
  },
  emits: ['update:modelValue'],
  setup(inputProps, { emit: inputEmit }) {
    return () =>
      h('label', { class: 'block' }, [
        h('span', { class: 'tech' }, inputProps.label),
        h('input', {
          type: inputProps.type,
          value: inputProps.modelValue,
          class: 'mt-2 h-10 w-full border border-line bg-card px-3 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-haze focus:border-line-strong',
          onInput: (event) => inputEmit('update:modelValue', event.target.value)
        })
      ])
  }
})
</script>

<style scoped>
.window-no-drag,
.window-no-drag * {
  -webkit-app-region: no-drag;
}

.settings-shell {
  border-radius: 8px;
  width: min(1080px, calc(100vw - 2.5rem));
  height: min(660px, calc(100vh - 4rem));
}

.settings-section {
  padding-block: 0.5rem 1.5rem;
}

:deep(.settings-choice) {
  border: 1px solid var(--line);
  min-height: 2.25rem;
  padding-inline: 0.85rem;
  font-family: theme("fontFamily.mono");
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  transition:
    color 200ms var(--ease-premium),
    border-color 200ms var(--ease-premium),
    background-color 200ms var(--ease-premium);
}

:deep(.settings-choice.is-selected) {
  border-color: var(--blue);
  background: var(--card);
  color: var(--blue);
}

:deep(.settings-choice:hover) {
  border-color: var(--line-strong);
  background: var(--card);
  color: var(--blue);
}

:deep(.settings-choice:disabled) {
  cursor: not-allowed;
  border-color: var(--line);
  color: var(--haze);
}

:deep(.settings-choice:disabled.is-selected) {
  border-color: var(--line-strong);
  color: var(--muted-foreground);
}

.settings-action {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--line);
  padding-inline: 1rem;
  font-family: theme("fontFamily.mono");
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--blue);
  transition:
    background-color 200ms var(--ease-premium),
    color 200ms var(--ease-premium);
}

.settings-action:hover {
  background: var(--muted);
}

.settings-action:disabled {
  color: var(--haze);
}

.settings-link {
  font-family: theme("fontFamily.mono");
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--blue);
  transition: color 200ms var(--ease-premium);
}

.settings-link:hover {
  color: var(--foreground);
}
</style>
