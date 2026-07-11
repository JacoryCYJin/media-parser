<template>
  <aside class="border-t border-line py-10">
    <div class="flex items-center justify-between">
      <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">05 — {{ t('videoParser.sections.outlineMap') }}</p>
      <button
        v-if="outlineState === 'success'"
        type="button"
        class="font-mono text-[11px] uppercase tracking-[0.16em] text-blue transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:text-haze"
        @click="emit('copy')"
      >
        {{ t('videoParser.outline.copyOutline') }}
      </button>
      <button
        v-else-if="outlineState === 'subtitlesAvailable' || outlineState === 'failed'"
        type="button"
        class="font-mono text-[11px] uppercase tracking-[0.16em] text-blue transition-colors hover:text-foreground"
        @click="emit('generate')"
      >
        {{ outlineState === 'failed' ? t('videoParser.outline.retry') : t('videoParser.outline.generate') }}
      </button>
    </div>

    <div v-if="outlineState === 'success'" class="mt-7 overflow-x-auto pb-2">
      <div class="outline-map">
        <div class="outline-root">
          <span class="outline-root-kicker">ROOT</span>
          <span class="outline-root-title">{{ outlineTitle }}</span>
        </div>
        <div class="outline-trunk"></div>
        <div class="outline-branches">
          <article v-for="item in outlineNodes" :key="item.id" class="outline-branch">
            <div class="outline-node">
              <span class="outline-node-index">{{ item.id }}</span>
              <span class="outline-node-title">{{ item.title }}</span>
              <span v-if="item.summary" class="outline-node-summary">{{ item.summary }}</span>
            </div>
            <ul class="outline-children">
              <li v-for="child in item.children" :key="child.id">
                <span class="outline-child-index">{{ child.id }}</span>
                <span class="outline-child-content">
                  <span class="outline-child-title">{{ child.title }}</span>
                  <span v-if="child.summary" class="outline-child-summary">{{ child.summary }}</span>
                </span>
              </li>
            </ul>
          </article>
        </div>
      </div>
      <p v-if="outlineSummary" class="mt-5 border-l border-line-strong pl-4 text-sm leading-relaxed text-muted-foreground">
        {{ outlineSummary }}
      </p>
    </div>

    <div v-else class="outline-state-panel mt-7" :class="{ 'is-generating': outlineState === 'generating' }">
      <div>
        <p class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ outlineStateMeta.title }}</p>
        <p class="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          {{ outlineState === 'failed' && outlineError ? outlineError : outlineStateMeta.description }}
        </p>
        <div v-if="outlineState === 'generating'" class="outline-loading-system">
          <div class="outline-loading-meta">
            <span>TRANSCRIPT</span>
            <span>MODEL</span>
            <span>OUTLINE</span>
          </div>
          <div class="outline-scan-track"><span></span></div>
          <div class="outline-loading-grid" aria-hidden="true">
            <span v-for="index in 18" :key="index"></span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  outlineState: { type: String, required: true },
  outlineStateMeta: { type: Object, required: true },
  outlineNodes: { type: Array, required: true },
  outlineTitle: { type: String, required: true },
  outlineSummary: { type: String, default: '' },
  outlineError: { type: String, default: '' }
})

const emit = defineEmits(['copy', 'generate'])
const { t } = useI18n()
</script>

<style scoped>
.outline-map {
  --outline-map-top: 30px;
  --outline-root-width: 220px;
  --outline-trunk-width: 48px;
  --outline-branch-gutter: 34px;
  --outline-branch-gap: 18px;
  --outline-line-y: 25px;
  --outline-trunk-x: calc(var(--outline-root-width) - 1px);
  --outline-branch-x: calc(var(--outline-root-width) + var(--outline-trunk-width));
  --outline-line-absolute-y: calc(var(--outline-map-top) + var(--outline-line-y));
  position: relative;
  min-width: 680px;
  padding: var(--outline-map-top) 0 18px;
}

.outline-root {
  position: absolute;
  top: var(--outline-map-top);
  left: 0;
  z-index: 2;
  display: inline-grid;
  width: var(--outline-root-width);
  border: 1px solid var(--line-strong);
  background: var(--card);
  padding: 0.7rem 0.8rem;
}

.outline-root-kicker,
.outline-node-index,
.outline-child-index {
  font-family: theme("fontFamily.mono");
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  color: var(--blue);
}

.outline-root-title {
  margin-top: 0.3rem;
  font-size: 0.82rem;
  line-height: 1.2;
  color: var(--foreground);
}

.outline-trunk {
  position: absolute;
  top: var(--outline-line-absolute-y);
  left: var(--outline-trunk-x);
  width: calc(var(--outline-trunk-width) + 2px);
  height: 1px;
  background: var(--line-strong);
}

.outline-branches {
  position: relative;
  display: grid;
  gap: var(--outline-branch-gap);
  margin-left: var(--outline-branch-x);
  padding-left: var(--outline-branch-gutter);
}

.outline-branch {
  position: relative;
  display: grid;
  grid-template-columns: minmax(150px, 190px) minmax(250px, 1fr);
  gap: 24px;
  align-items: start;
}

.outline-branch::before {
  position: absolute;
  top: var(--outline-line-y);
  left: calc((var(--outline-branch-gutter) * -1) - 1px);
  width: calc(var(--outline-branch-gutter) + 2px);
  height: 1px;
  content: "";
  background: var(--line-strong);
}

.outline-branch:not(:last-child)::after {
  position: absolute;
  top: var(--outline-line-y);
  left: calc(var(--outline-branch-gutter) * -1);
  width: 1px;
  height: calc(100% + var(--outline-branch-gap));
  content: "";
  background: var(--line-strong);
}

.outline-node {
  display: grid;
  gap: 0.35rem;
  border: 1px solid var(--line);
  background: var(--card);
  padding: 0.62rem 0.72rem;
  transition:
    border-color 220ms var(--ease-premium),
    color 220ms var(--ease-premium);
}

.outline-branch:hover .outline-node {
  border-color: var(--line-strong);
}

.outline-node-title {
  font-size: 0.8rem;
  line-height: 1.25;
  color: var(--foreground);
}

.outline-node-summary {
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--muted-foreground);
}

.outline-children {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0.2rem 0 0;
  list-style: none;
}

.outline-children li {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 9px;
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--muted-foreground);
}

.outline-children li:first-child {
  border-top-color: transparent;
  padding-top: 0;
}

.outline-child-index {
  color: var(--haze);
}

.outline-child-content {
  display: grid;
  gap: 0.2rem;
}

.outline-child-title {
  color: var(--foreground);
}

.outline-child-summary {
  color: var(--haze);
}

.outline-state-panel {
  position: relative;
  display: flex;
  min-height: 430px;
  align-items: center;
  border: 1px solid var(--line);
  background: var(--card);
  padding: 2.5rem 2rem;
}

.outline-state-panel > div {
  max-width: 460px;
}

.outline-state-panel.is-generating {
  align-items: flex-start;
  justify-content: center;
}

.outline-state-panel.is-generating > div {
  position: absolute;
  top: 42%;
  left: 50%;
  width: clamp(380px, 72%, 460px);
  max-width: calc(100% - 4rem);
  transform: translate(-50%, -50%);
}

.outline-loading-system {
  margin-top: 1.65rem;
  width: 100%;
}

.outline-loading-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  font-family: theme("fontFamily.mono");
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  color: var(--muted-foreground);
}

.outline-scan-track {
  position: relative;
  margin-top: 0.75rem;
  height: 1px;
  overflow: hidden;
  background: var(--line);
}

.outline-scan-track span {
  position: absolute;
  inset-block: 0;
  left: 0;
  display: block;
  width: 72px;
  background: var(--blue);
  animation: outline-scan 2.6s var(--ease-premium) infinite;
}

.outline-loading-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 1rem;
}

.outline-loading-grid span {
  height: 1px;
  background: var(--line);
}

@keyframes outline-scan {
  0% { transform: translateX(-80px); opacity: 0; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  100% { transform: translateX(370px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .outline-scan-track span {
    animation: none;
  }
}

@media (max-width: 1023px) {
  .outline-map {
    min-width: 520px;
  }
}
</style>
