<template>
  <section class="grid gap-5 py-10 md:grid-cols-[96px_minmax(0,1fr)]">
    <div>
      <p class="font-mono text-xs uppercase tracking-[0.18em] text-blue">04</p>
      <p class="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-blue">{{ t('videoParser.sections.downloadRegistry') }}</p>
    </div>
    <div class="min-w-0">
      <div class="mb-3 flex items-center">
        <span class="tech">{{ t('videoParser.registry.items', { count: registryRows.length }) }}</span>
      </div>
      <div class="overflow-x-auto border border-line">
        <table class="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col class="w-[8%]" />
            <col class="w-[18%]" />
            <col class="w-[16%]" />
            <col class="w-[16%]" />
            <col class="w-[18%]" />
            <col class="w-[24%]" />
          </colgroup>
          <thead class="border-b border-line bg-muted/40">
            <tr class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th class="px-3 py-3 font-medium">№</th>
              <th class="px-3 py-3 font-medium">{{ t('videoParser.registry.resolution') }}</th>
              <th class="px-3 py-3 font-medium">{{ t('videoParser.registry.format') }}</th>
              <th class="px-3 py-3 font-medium">{{ t('videoParser.registry.size') }}</th>
              <th class="px-3 py-3 font-medium">{{ t('videoParser.registry.status') }}</th>
              <th class="px-3 py-3 text-right font-medium">{{ t('videoParser.registry.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(format, index) in registryRows" :key="formatKey(format)" class="border-b border-line last:border-b-0">
              <td class="px-3 py-4 font-mono text-xs text-blue">{{ String(index + 1).padStart(2, '0') }}</td>
              <td class="px-3 py-4 font-mono text-sm text-foreground">{{ format.resolution }}</td>
              <td class="truncate px-3 py-4 font-mono text-xs text-muted-foreground" :title="formatLabel(format)">{{ formatLabel(format) }}</td>
              <td class="truncate px-3 py-4 font-mono text-xs text-muted-foreground">{{ format.filesize_mb || '--' }} MB</td>
              <td class="px-3 py-4">
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="rowStatusClass(format).dot"></span>
                  <span class="font-mono text-[11px] uppercase tracking-[0.14em]" :class="rowStatusClass(format).text">{{ rowStatusLabel(format) }}</span>
                  <template v-if="rowStatus(format) === 'DOWNLOADING'">
                    <span class="font-mono text-[11px] text-muted-foreground">{{ rowProgress(format) }}%</span>
                  </template>
                </div>
              </td>
              <td class="px-3 py-4">
                <div class="flex justify-end gap-4 whitespace-nowrap">
                  <template v-if="rowStatus(format) === 'DOWNLOADING'">
                    <button type="button" class="registry-action text-blue hover:text-foreground" @click="emit('pause', format)">
                      {{ t('videoParser.registry.actions.pause') }}
                      <Pause class="h-3.5 w-3.5" />
                    </button>
                    <button type="button" class="registry-action text-muted-foreground hover:text-foreground" @click="emit('cancel', format)">
                      {{ t('videoParser.registry.actions.cancel') }}
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  <template v-else-if="rowStatus(format) === 'PAUSED'">
                    <button type="button" class="registry-action text-blue hover:text-foreground" @click="emit('resume', format)">
                      {{ t('videoParser.registry.actions.resume') }}
                      <Play class="h-3.5 w-3.5" />
                    </button>
                    <button type="button" class="registry-action text-muted-foreground hover:text-foreground" @click="emit('cancel', format)">
                      {{ t('videoParser.registry.actions.cancel') }}
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  <template v-else-if="rowStatus(format) === 'COMPLETE'">
                    <button type="button" class="registry-action text-green-700 hover:text-foreground" @click="emit('reveal', format)">
                      {{ t('videoParser.registry.actions.reveal') }}
                      <ExternalLink class="h-3.5 w-3.5" />
                    </button>
                    <button type="button" class="registry-action text-blue hover:text-foreground" @click="emit('download', format)">
                      {{ t('videoParser.registry.actions.redownload') }}
                      <RefreshCw class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    :class="[
                      'registry-action disabled:cursor-not-allowed disabled:text-haze',
                      ['FAILED', 'CANCELLED'].includes(rowStatus(format)) ? 'text-red-700 hover:text-foreground' : 'text-blue hover:text-foreground'
                    ]"
                    :disabled="rowStatus(format) === 'UNAVAILABLE'"
                    @click="emit('download', format)"
                  >
                    {{ rowActionLabel(format) }}
                    <RefreshCw v-if="['FAILED', 'CANCELLED'].includes(rowStatus(format))" class="h-3.5 w-3.5" />
                    <ArrowRight v-else class="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!registryRows.length">
              <td colspan="6" class="px-3 py-10 text-base text-muted-foreground">{{ t('videoParser.registry.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ArrowRight, ExternalLink, Pause, Play, RefreshCw, X } from 'lucide-vue-next'

defineProps({
  registryRows: { type: Array, required: true },
  downloading: { type: Object, required: true },
  formatKey: { type: Function, required: true },
  formatLabel: { type: Function, required: true },
  rowStatus: { type: Function, required: true },
  rowStatusLabel: { type: Function, required: true },
  rowProgress: { type: Function, required: true },
  rowStatusClass: { type: Function, required: true },
  rowActionLabel: { type: Function, required: true }
})

const emit = defineEmits(['download', 'reveal', 'pause', 'resume', 'cancel'])
const { t } = useI18n()
</script>

<style scoped>
.registry-action {
  @apply inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] transition-colors;
}
</style>
