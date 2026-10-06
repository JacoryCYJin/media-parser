<template>
  <div class="audio-file-list" v-if="files.length">
    <div class="audio-list-summary"><span>{{ w('taskFiles') }} · {{ files.length }}</span><span>{{ w('completed') }} {{ files.filter(file => file.status === 'completed').length }} / {{ files.length }}</span></div>
    <ul>
      <li v-for="row in files" :key="row.id" :class="{ selected: selectedId === row.id && row.result }">
        <div class="audio-file-info">
          <strong :title="row.file.path">{{ row.file.name }}</strong>
          <span class="audio-file-meta">{{ (row.file.size / 1024 / 1024).toFixed(1) }} MB · {{ w(row.status === 'waiting' ? 'waitingAudio' : row.status === 'running' ? 'transcribing' : row.status) }}<template v-if="['running', 'stopping'].includes(row.status)"> · {{ row.progress }}%</template></span>
          <div v-if="['running', 'stopping'].includes(row.status)" class="audio-file-progress" role="progressbar" :aria-label="row.file.name" :aria-valuenow="row.progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: row.progress + '%' }" /></div>
          <p v-if="row.error || row.pollError" class="audio-file-error" role="alert">{{ row.error || row.pollError }}</p>
        </div>
        <div class="audio-file-actions">
          <button v-if="row.result" type="button" :aria-pressed="selectedId === row.id" @click="$emit('select', row.id)">{{ w('viewResult') }}</button>
          <button v-if="row.status === 'waiting'" type="button" @click="$emit('remove', row.id)">{{ w('removeAudio') }}</button>
          <button v-if="['running', 'stopping'].includes(row.status)" type="button" :disabled="row.stopRequested || row.cancelling" @click="$emit('stop', row.id)">{{ w(row.stopRequested ? 'stopping' : 'stop') }}</button>
          <button v-if="['failed', 'cancelled'].includes(row.status)" type="button" @click="$emit('retry', row.id)">{{ w('retry') }}</button>
        </div>
      </li>
    </ul>
  </div>
</template>
<script setup>
defineProps({ files: { type: Array, required: true }, selectedId: String, w: Function });
defineEmits(['select', 'remove', 'stop', 'retry']);
</script>
<style scoped>
.audio-file-list { margin:16px 0 20px; font-size:13px; }
.audio-list-summary { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; color:var(--color-text-muted); padding-bottom:10px; border-bottom:1px solid var(--color-border); }
ul { list-style:none; padding:0; margin:0; }
li { display:flex; align-items:center; gap:16px; padding:14px 4px; border-bottom:1px solid var(--color-border); }
li.selected { background:var(--color-surface); }
.audio-file-info { flex:1; min-width:0; }
strong { display:block; font-weight:500; overflow-wrap:anywhere; }
.audio-file-meta { display:block; margin-top:5px; color:var(--color-text-muted); }
.audio-file-actions { display:flex; flex-wrap:wrap; gap:8px; flex-shrink:0; }
button { padding:6px 10px; min-height:32px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-background); color:var(--color-text); font:inherit; cursor:pointer; }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible { outline:2px solid var(--color-focus-ring); outline-offset:2px; }
.audio-file-progress { height:4px; margin-top:10px; background:var(--color-border); overflow:hidden; }
.audio-file-progress i { display:block; height:100%; background:var(--color-accent); }
.audio-file-error { color:var(--color-danger); margin:8px 0 0; overflow-wrap:anywhere; }
@media(max-width:600px) { li { align-items:flex-start; flex-direction:column; gap:10px; } }

li { border-radius:10px; padding:14px 10px; }
li.selected { background:var(--color-accent-soft); }
button { border-radius:9px; font-size:12px; }
button[aria-pressed=true] { color:var(--color-accent); border-color:var(--color-accent); }
.audio-file-progress { border-radius:4px; background:var(--color-progress-track); }
.audio-file-progress i { background:var(--color-accent); }

</style>
