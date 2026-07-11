<template>
  <section class="border-b border-line py-10">
    <p class="mb-8 font-mono text-xs uppercase tracking-[0.18em] text-blue">02 — {{ t('videoParser.sections.status') }}</p>
    <div>
      <div class="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div class="min-w-0 flex-1 overflow-x-auto pb-2">
          <div class="grid min-w-[760px] grid-cols-6 gap-y-6">
            <div
              v-for="(item, index) in statusRail"
              :key="item.key"
              class="status-step relative min-w-0 pr-4"
              :class="{
                'is-active': parserState === item.key,
                'is-reached': index <= activeStatusIndex,
                'is-failed': parserState === 'FAILED' && item.key === 'FAILED'
              }"
            >
              <span class="status-dot"></span>
              <p class="mt-4 whitespace-nowrap text-sm text-muted-foreground">{{ item.label }}</p>
            </div>
          </div>
        </div>
      </div>
      <p v-if="isCookiesRequiredError" class="mt-4 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted-foreground">
        {{ t('videoParser.cookieEntry.hint') }}
      </p>
      <p v-else-if="loading" class="mt-4 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted-foreground">
        {{ t('videoParser.messages.readingMetadata') }}
      </p>
      <p v-if="error" class="mt-6 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted-foreground">{{ error }}</p>
      <p v-else-if="success" class="mt-6 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted-foreground">{{ success }}</p>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  statusRail: { type: Array, required: true },
  parserState: { type: String, required: true },
  activeStatusIndex: { type: Number, required: true },
  isCookiesRequiredError: { type: Boolean, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
  success: { type: String, default: '' }
})

const { t } = useI18n()
</script>

<style scoped>
.status-step {
  color: var(--muted-foreground);
}

.status-step::before,
.status-step::after {
  position: absolute;
  top: 3px;
  right: 0;
  left: 0;
  height: 1px;
  content: "";
}

.status-step::before {
  background: var(--line-strong);
}

.status-step::after {
  background: var(--blue);
  transform: scaleX(0);
  transform-origin: left center;
}

.status-step.is-reached::after {
  transform: scaleX(1);
}

.status-step.is-active::after {
  transform: scaleX(0);
}

.status-step:last-child::after,
.status-step:last-child::before {
  display: none;
}

.status-dot {
  position: relative;
  z-index: 1;
  display: block;
  width: 9px;
  height: 9px;
  border: 1px solid var(--haze);
  border-radius: 9999px;
  background: var(--background);
}

.status-step.is-reached,
.status-step.is-active,
.status-step.is-reached p,
.status-step.is-active p {
  color: var(--blue);
}

.status-step.is-reached .status-dot,
.status-step.is-active .status-dot {
  border-color: var(--blue);
  background: var(--blue);
}

.status-step.is-active .status-dot {
  box-shadow: 0 0 0 3px rgb(14 102 200 / 0.12);
}

.status-step.is-failed .status-dot {
  border-color: var(--destructive);
  background: var(--destructive);
  box-shadow: 0 0 0 3px rgb(231 0 11 / 0.1);
}

.status-step.is-failed p {
  color: var(--destructive);
}
</style>
