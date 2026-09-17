<template>
  <section class="output-document">
    <header class="output-toolbar">
      <h2>{{ title || w(page === 'stt' ? 'transcriptResult' : 'outlineResult') }}</h2>
      <div class="output-actions">
        <button @click="$emit('copy')"><Copy />{{ w('copy') }}</button>
        <button @click="$emit('export')"><Download />{{ w('export') }}</button>
        <button v-if="page === 'stt'" @click="$emit('export-srt')">{{ w('exportSrt') }}</button>
      </div>
    </header>
    <template v-if="page === 'stt'">
      <nav class="output-views" :aria-label="w('transcriptResult')">
        <button :aria-pressed="view === 'full'" @click="$emit('update:view', 'full')">{{ w('full') }}</button>
        <button :aria-pressed="view === 'segments'" @click="$emit('update:view', 'segments')">{{ w('segments') }}</button>
      </nav>
      <div class="document-body">
        <p v-if="view === 'full'" class="transcript-text">{{ result.text }}</p>
        <ol v-else class="transcript-segments">
          <li v-for="segment in result.segments" :key="segment.id">
            <span class="timestamp">{{ time(segment.start) }}<span>{{ time(segment.end) }}</span></span>
            <p>{{ segment.text }}</p>
          </li>
        </ol>
      </div>
      <footer v-if="result.output_dir"><button @click="$emit('reveal')"><Folder />{{ w('openFolder') }}</button></footer>
    </template>
    <article v-else class="document-body outline-document">
      <p v-if="mock" class="output-warning" role="status">{{ w('modelMock') }}</p>
      <h3>{{ result.title }}</h3>
      <section class="outline-overview"><h4>{{ w('overview') }}</h4><p>{{ result.summary }}</p></section>
      <details v-for="(node, index) in result.nodes" :key="node.id" open>
        <summary><span class="chapter-number">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ node.title }}</span><ChevronDown /></summary>
        <div class="chapter-body"><p>{{ node.summary }}</p>
          <ul v-if="node.children?.length"><li v-for="child in node.children" :key="child.id"><h4>{{ child.title }}</h4><p>{{ child.summary }}</p></li></ul>
        </div>
      </details>
    </article>
  </section>
</template>
<script setup>
import { Copy, Download, Folder, ChevronDown } from 'lucide-vue-next'
defineProps({ result: { type: Object, required: true }, title: String, page: String, view: String, mock: Boolean, w: Function, time: Function })
defineEmits(['copy', 'export', 'export-srt', 'reveal', 'update:view'])
</script>
<style scoped>
.output-document { margin-top:24px; border:1px solid #e3e3df; border-radius:10px; background:white; overflow:hidden; }
.output-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:16px 20px; border-bottom:1px solid #e3e3df; }
h2 { font-size:15px; font-weight:600; min-width:0; overflow-wrap:anywhere; }
.output-actions { display:flex; flex-wrap:wrap; gap:8px; }
button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:32px; padding:5px 10px; border:1px solid #deded9; border-radius:6px; color:#343431; font:inherit; font-size:13px; background:white; cursor:pointer; }
button:hover { background:#f3f3f0; }
button:focus-visible, summary:focus-visible { outline:2px solid #547b96; outline-offset:2px; }
svg { width:16px; height:16px; flex-shrink:0; }
.output-views { display:flex; gap:20px; padding:0 24px; border-bottom:1px solid #e3e3df; }
.output-views button { min-height:42px; padding:6px 0; border:0; border-bottom:2px solid transparent; border-radius:0; color:#686864; }
.output-views button[aria-pressed=true] { border-bottom-color:#343431; color:#292927; }
.document-body { padding:24px; color:#343431; font-size:14px; line-height:1.85; overflow-wrap:anywhere; }
.transcript-text { white-space:pre-wrap; margin:0; max-width:76ch; }
.transcript-segments { padding:0; margin:0; list-style:none; }
.transcript-segments li { display:grid; grid-template-columns:76px minmax(0,1fr); gap:16px; padding:16px 0; border-bottom:1px solid #eeeee9; }
.transcript-segments li:first-child { padding-top:0; }
.transcript-segments li:last-child { border-bottom:0; padding-bottom:0; }
.timestamp { font-size:12px; font-variant-numeric:tabular-nums; color:#686864; line-height:1.8; }
.timestamp span { display:block; }
p { margin:0; }
footer { padding:12px 20px; border-top:1px solid #e3e3df; }
h3 { font-size:21px; line-height:1.5; font-weight:600; margin:0 0 20px; }
.outline-overview { padding:16px 18px; background:#f6f6f3; border-radius:8px; margin-bottom:24px; }
h4 { font-weight:600; font-size:14px; margin:0 0 6px; }
details { border-top:1px solid #e3e3df; }
summary { display:flex; align-items:baseline; gap:12px; cursor:pointer; list-style:none; padding:16px 0; font-weight:600; }
summary::-webkit-details-marker { display:none; }
summary svg { margin-left:auto; align-self:center; color:#686864; transition:transform .15s; }
details:not([open]) summary svg { transform:rotate(-90deg); }
.chapter-number { color:#686864; font-size:12px; font-variant-numeric:tabular-nums; font-weight:400; }
.chapter-body { padding:0 0 20px 28px; }
.chapter-body ul { list-style:none; border-left:2px solid #e3e3df; margin:16px 0 0; padding:0 0 0 16px; }
.chapter-body li + li { margin-top:16px; }
.chapter-body li p { color:#5c5c57; }
.output-warning { padding:12px; background:#fff5df; margin-bottom:16px; border-radius:6px; }
@media (prefers-reduced-motion:reduce) { summary svg { transition:none; } }
</style>
