<template>
  <div ref="workspaceElement" class="wb-app" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'is-resizing': dragging }" :style="{ '--sidebar-width': `${sidebarWidth}px`, '--sidebar-scale': sidebarCollapsed ? 56 / sidebarWidth : 1 }">
    <div class="sidebar-surface" aria-hidden="true" />
    <button
      class="sidebar-toggle"
      :title="w(sidebarCollapsed ? 'expandSidebar' : 'collapseSidebar')"
      :aria-label="w(sidebarCollapsed ? 'expandSidebar' : 'collapseSidebar')"
      :aria-expanded="!sidebarCollapsed"
      aria-controls="workspace-sidebar"
      @click="toggleSidebar(workspaceElement)"
    >
      <PanelLeft />
    </button>
    <aside id="workspace-sidebar" class="sidebar">
      <div class="brand" title="Media Parser"><Blocks /><span class="sidebar-label" :aria-hidden="sidebarCollapsed">Media Parser</span></div>
      <button
        class="nav-button active"
        :title="w('workspace')"
        :aria-label="w('workspace')"
        @click="navigate('home')"
      >
        <LayoutGrid /><span class="sidebar-label" :aria-hidden="sidebarCollapsed">{{ w("workspace") }}</span>
      </button>
      <div class="side-bottom">
        <button
          class="nav-button"
          :title="w('settings')"
          :aria-label="w('settings')"
          @click="$emit('settings')"
        >
          <Settings2 /><span class="sidebar-label" :aria-hidden="sidebarCollapsed">{{ w("settings") }}</span>
        </button>
      </div>
    </aside>
    <div v-if="!sidebarCollapsed" class="sidebar-divider" role="separator" tabindex="0"
      aria-orientation="vertical" :aria-label="locale === 'zh-CN' ? '调整侧栏宽度' : 'Resize sidebar'"
      aria-controls="workspace-sidebar" :aria-valuemin="minimum" :aria-valuemax="maximum" :aria-valuenow="sidebarWidth"
      @pointerdown="start" @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" @keydown="keydown" />
    <div class="shell">
      <header class="topbar">
        <div class="crumb">
          <span>{{ w(page === "home" ? "workspace" : page) }}</span>
        </div>
        <span class="badge">{{ w("live") }}</span>
      </header>
      <main class="main" :key="page">
        <div class="content" v-if="page === 'home'">
          <div class="home-head">
            <div>
              <h1>{{ w("welcome") }}</h1>
            </div>
          </div>
          <div class="module-grid">
            <button
              v-for="(tool, index) in tools"
              :key="tool.id"
              :class="['module', `tool-${tool.id}`]"
              @click="navigate(tool.id)"
            >
              <span class="module-icon"><component :is="tool.icon" /></span
              ><span class="blocks" aria-hidden="true"
                ><i
                  v-for="n in 6"
                  :key="n"
                  :class="{
                    blank: [
                      [1, 3],
                      [1, 2],
                      [3, 4],
                      [1, 6],
                    ][index].includes(n),
                  }"
              /></span>
              <h2>{{ w(tool.id) }}</h2>
              <p>{{ w(tool.id + "Desc") }}</p>
              <ArrowRight class="arrow" />
            </button>
          </div>
        </div>
        <div class="content tool-page" :class="`page-${page}`" v-else>
          <button class="back" @click="navigate('home')">
            <ArrowLeft />{{ w("back") }}
          </button>
          <header class="tool-head">
            <div class="tool-title">
              <component :is="tools.find((x) => x.id === page).icon" />
              <div>
                <h1>{{ w(page) }}</h1>
                <p class="sub">{{ w(page + "Desc") }}</p>
              </div>
            </div>
            <button class="btn" :disabled="busy(state)" @click="newTask">
              <Plus />{{ w("new") }}
            </button>
          </header>
          <template v-if="page === 'video' || page === 'podcast'">
            <section class="input-panel source-panel">
              <label class="field-label" for="media-source">{{ w("sourceLink") }}</label>
              <form class="input-row" @submit.prevent="parse(state, page)">
                <Link /><input
                  id="media-source"
                  v-model="state.url"
                  :aria-label="w('url')"
                  :placeholder="w('url')"
                  :disabled="busy(state)"
                  @input="invalidate(state, true)"
                /><button class="btn primary" :disabled="busy(state)">
                  {{ w("parse") }}<ArrowRight />
                </button>
              </form>
            </section>
            <section class="section" v-if="state.info">
              <div class="section-head">
                <h2>{{ w("resolved") }}</h2>
                <a
                  class="link"
                  :href="state.info.source_url || state.url"
                  target="_blank"
                  rel="noreferrer"
                  >{{ w("sourcePage") }}</a
                >
              </div>
              <div class="media-head" :class="{ 'podcast-media': page === 'podcast' }">
                <img
                  v-if="media.thumbnail"
                  class="thumb"
                  :src="media.thumbnail"
                  alt=""
                />
                <div class="cover" v-else><component :is="page === 'podcast' ? Podcast : Video" /></div>
                <div>
                  <h2>{{ media.title }}</h2>
                  <p>
                    {{ media.author
                    }}<span v-if="media.duration">
                      · {{ duration(media.duration) }}</span
                    ><span v-if="media.date"> · {{ media.date }}</span>
                  </p>
                </div>
              </div>
              <details v-if="media.description" class="source-description"><summary>{{ w("description") }}</summary><p>{{ media.description }}</p></details>
              <audio
                v-if="page === 'podcast' && state.info.episode?.audio_url"
                controls
                class="audio"
                :src="state.info.episode.audio_url"
                :aria-label="w('preview')"
              />
              <div class="controls download-toolbar">
                <div v-if="page === 'video'" class="tabs" style="margin: 0">
                  <button
                    :class="['tab', { on: state.audioKind === 'video' }]"
                    @click="state.audioKind = 'video'"
                  >
                    {{ w("videoOnly") }}</button
                  ><button
                    :class="['tab', { on: state.audioKind === 'audio' }]"
                    @click="state.audioKind = 'audio'"
                  >
                    {{ w("audioOnly") }}
                  </button>
                </div>
                <button class="control-label link" @click="$emit('settings')">
                  {{ w("saveAt") }} · {{ downloadDir || w("settings") }}
                </button>
              </div>
              <template v-if="page === 'video'"
                ><div
                  class="format"
                  v-for="format in formats"
                  :key="format.format_id"
                >
                  <FileAudio v-if="format.ext === 'm4a'" /><Video v-else />
                  <div class="grow">
                    <strong
                      >{{ format.ext.toUpperCase() }} ·
                      {{ format.resolution }}</strong
                    >
                    <p v-if="format.filesize_mb">{{ format.filesize_mb }} MB</p>
                  </div>
                  <button
                    class="btn"
                    :disabled="
                      state.creatingDownload ||
                      state.downloads.some(
                        (d) =>
                          d.format?.format_id === format.format_id &&
                          isDownloadActive(d),
                      )
                    "
                    @click="download(state, page, format)"
                  >
                    <Download />{{ w("download") }}
                  </button>
                </div>
                <p v-if="!formats.length" class="helper">
                  {{ w("noFormats") }}
                </p></template
              >
              <div v-else-if="state.info.episode?.audio_url" class="format">
                <FileAudio />
                <div class="grow">
                  <strong>{{
                    state.info.episode.audio_content_type || w("audioOnly")
                  }}</strong>
                  <p v-if="state.info.episode.audio_size_bytes">
                    {{ size(state.info.episode.audio_size_bytes) }}
                  </p>
                </div>
                <button
                  class="btn"
                  :disabled="
                    state.creatingDownload ||
                    state.downloads.some(isDownloadActive)
                  "
                  @click="download(state, page)"
                >
                  <Download />{{ w("downloadAudio") }}
                </button>
              </div>
              <details class="history" v-if="sourceText">
                <summary>{{ w("availableText") }}</summary>
                <p class="source-text">{{ sourceText }}</p>
                <button class="btn small" @click="copy(sourceText)">
                  {{ w("copy") }}
                </button>
              </details>
            </section>
            <div
              class="status-box download-task"
              :class="`status-${d.status.toLowerCase()}`"
              v-for="d in state.downloads"
              :key="d.task_id"
            >
              <div class="row">
                <span class="grow task-name">{{ d.name }}</span
                ><span
                  >{{ w(d.status)
                  }}<template v-if="isDownloadActive(d)">
                    · {{ d.progress || 0 }}%</template
                  ></span
                >
              </div>
              <div class="progress" role="progressbar" :aria-label="d.name" :aria-valuenow="d.progress || 0" aria-valuemin="0" aria-valuemax="100" v-if="isDownloadActive(d)">
                <i :style="{ width: (d.progress || 0) + '%' }" />
              </div>
              <p v-if="d.error || d.pollError" class="error">
                {{ d.error || d.pollError }}
              </p>
              <div class="row" style="margin-top: 12px">
                <button
                  v-if="d.status === 'DOWNLOADING' && canPause(d)"
                  class="btn small"
                  @click="controlDownload(state, d, 'pause')"
                >
                  {{ w("pause") }}</button
                ><button
                  v-if="d.status === 'PAUSED'"
                  class="btn small"
                  @click="controlDownload(state, d, 'resume')"
                >
                  {{ w("resume") }}</button
                ><button
                  v-if="isDownloadActive(d)"
                  class="btn small"
                  @click="controlDownload(state, d, 'cancel')"
                >
                  {{ w("stop") }}</button
                ><button
                  v-if="d.status === 'COMPLETE' && d.path"
                  class="btn small"
                  @click="reveal(d.path)"
                >
                  <Folder />{{ w("openFolder") }}</button
                ><button
                  v-if="['FAILED', 'CANCELLED'].includes(d.status)"
                  class="btn small"
                  @click="download(state, d.kind, d.format, d.request)"
                >
                  {{ w("retry") }}
                </button>
              </div>
            </div>
          </template>
          <div class="input-panel transcription-input" v-if="page === 'stt'">
            <div class="tabs">
              <button
                v-for="mode in ['file', 'url']"
                :key="mode"
                :class="['tab', { on: state.mode === mode }]"
                :disabled="busy(state)"
                @click="
                  invalidate(state);
                  state.mode = mode;
                "
              >
                {{ w(mode === "file" ? "audioFile" : "sourceLink") }}
              </button>
            </div>
            <button
              v-if="state.mode === 'file'"
              class="drop"
              :disabled="busy(state)"
              @click="chooseAudio()"
              @dragover.prevent
              @drop.prevent="chooseAudio($event.dataTransfer.files[0])"
            >
              <FileAudio v-if="state.file" /><Upload v-else /><strong>{{ state.file?.name || w("drop") }}</strong>
              <p>
                {{ state.file ? size(state.file.size) + " · " + w("change") : w("formats") }}
              </p></button
            ><template v-else
              ><label class="control-label"
                >{{ w("sourceType")
                }}<select
                  class="select"
                  v-model="state.sourceType"
                  :disabled="busy(state)"
                  @change="invalidate(state)"
                >
                  <option value="video">{{ w("videoLink") }}</option>
                  <option value="podcast">{{ w("podcastLink") }}</option>
                  <option value="audio">{{ w("directAudio") }}</option>
                </select></label
              >
              <div class="input-row" style="margin-top: 12px">
                <Link /><input
                  v-model="state.url"
                  :aria-label="w('url')"
                  :placeholder="w('url')"
                  :disabled="busy(state)"
                  @input="invalidate(state)"
                /></div
            ></template>
            <div class="controls">
              <label class="control-label"
                >{{ w("language")
                }}<select
                  class="select"
                  v-model="state.language"
                  :disabled="busy(state)"
                  @change="invalidate(state)"
                >
                  <option value="">{{ w("auto") }}</option>
                  <option value="zh">{{ w("zh") }}</option>
                  <option value="en">{{ w("en") }}</option>
                </select></label
              ><button
                class="btn primary"
                :disabled="busy(state)"
                @click="transcribe"
              >
                {{ w("start") }}<ArrowRight />
              </button>
            </div>
          </div>
          <div class="input-panel outline-input" v-if="page === 'outline'">
            <input
              class="title-input"
              v-model="state.title"
              :disabled="busy(state)"
              :placeholder="w('titlePlaceholder')"
              :aria-label="w('titlePlaceholder')"
              @input="invalidate(state)"
            /><div class="editor-heading"><label class="field-label" for="outline-source">{{ w("inputText") }}</label><span>{{ state.text.replace(/\s/g, "").length }} {{ w("characters") }}</span></div><textarea
              id="outline-source"
              class="text-input"
              v-model="state.text"
              :disabled="busy(state)"
              :placeholder="w('textPlaceholder')"
              @input="invalidate(state)"
            /><button
              class="btn small"
              style="margin-top: 12px"
              :disabled="busy(state)"
              @click="importText"
            >
              <FileText />{{ w("import") }}
            </button>
            <div class="controls">
              <label class="control-label"
                >{{ w("outputLanguage")
                }}<select
                  class="select"
                  v-model="state.outputLanguage"
                  :disabled="busy(state)"
                  @change="invalidate(state)"
                >
                  <option value="zh">{{ w("zh") }}</option>
                  <option value="en">{{ w("en") }}</option>
                </select></label
              ><button
                class="btn primary"
                :disabled="busy(state)"
                @click="generate"
              >
                {{ w("generate") }}<ArrowRight />
              </button>
            </div>
            <p class="helper">
              <button class="link" @click="$emit('settings')">
                {{
                  modelName ? w("model") + " · " + modelName : w("noneModel")
                }}
              </button>
            </p>
          </div>
          <div class="task-error" role="alert" v-if="state.error"><AlertCircle /><div><strong>{{ w("failed") }}</strong><p>{{ state.error }}</p></div></div>
          <div
            class="status-box processing-status"
            role="status"
            v-if="['running', 'stopping'].includes(state.status)"
          >
            <div class="row">
              <LoaderCircle class="processing-spinner" /><span class="grow">{{
                w(
                  state.status === "stopping"
                    ? "stopping"
                    : state.transcriptTask?.stage ||
                        (page === "outline"
                          ? "generating"
                          : state.operation === "parse"
                            ? "parsing"
                            : "working"),
                )
              }}</span
              ><span v-if="state.transcriptTask"
                >{{ state.transcriptTask.progress || 0 }}%</span
              ><button
                v-if="page === 'stt'"
                class="btn small"
                :disabled="state.status === 'stopping'"
                @click="cancelTranscript"
              >
                {{ w("stop") }}</button
              ><button
                v-if="page === 'outline'"
                class="btn small"
                @click="stopOutline"
              >
                {{ w("stop") }}
              </button>
            </div>
            <div v-if="state.transcriptTask" class="progress" role="progressbar" :aria-label="w('transcribing')" :aria-valuenow="state.transcriptTask.progress || 0" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: (state.transcriptTask.progress || 0) + '%' }" /></div>
            <p class="helper" v-if="state.status === 'stopping'">
              {{ w("cancelNote") }}
            </p>
          </div>
          <p class="helper" v-if="state.status === 'cancelled'">
            {{ w("cancelled") }}
          </p>
          <button
            class="btn"
            v-if="
              ['failed', 'cancelled'].includes(state.status) &&
              ['stt', 'outline'].includes(page)
            "
            @click="page === 'stt' ? transcribe() : generate()"
          >
            {{ w("retry") }}
          </button>
          <WorkbenchResult v-if="state.result" :result="state.result" :page="page" :view="state.resultView" :mock="state.mock" :w="w" :time="time"
            @update:view="state.resultView = $event" @copy="copy(outputText(state))" @export="save(state)" @export-srt="save(state, true)" @reveal="reveal(state.result.output_dir)" />
          <div
            class="empty"
            v-if="state.status === 'idle' && !state.info && !state.result"
          >
            <component :is="tools.find((x) => x.id === page).icon" />
            <h3>
              {{
                w(
                  page === "stt"
                    ? "emptyStt"
                    : page === "outline"
                      ? "emptyOutline"
                      : "emptyMedia",
                )
              }}
            </h3>
            <p>
              {{
                w(
                  page === "stt"
                    ? "emptySttDesc"
                    : page === "outline"
                      ? "emptyOutlineDesc"
                      : "emptyMediaDesc",
                )
              }}
            </p>
          </div>
          <details class="history" v-if="state.history.length">
            <summary>{{ w("history") }} · {{ state.history.length }}</summary>
            <div
              class="history-item"
              v-for="(entry, index) in state.history"
              :key="index"
            >
              <button :disabled="busy(state)" @click="restore(index)">
                {{
                  entry.title ||
                  entry.file?.name ||
                  entry.info?.title ||
                  entry.url ||
                  w(page)
                }}</button
              ><span>{{ w(entry.status) }}</span>
            </div>
            <p class="helper" v-if="!state.history.length">
              {{ w("historyEmpty") }}
            </p>
          </details>
        </div>
      </main>
    </div>
    <div class="toast" role="status" v-if="notice">{{ notice }}</div>
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import { useSidebar } from "../composables/useSidebar";
import { useI18n } from "vue-i18n";
import {
  AlertCircle,
  LoaderCircle,
  Blocks,
  PanelLeft,
  LayoutGrid,
  Settings2,
  Video,
  Podcast,
  AudioLines,
  ListTree,
  ArrowRight,
  ArrowLeft,
  Plus,
  Link,
  Download,
  Folder,
  FileAudio,
  FileText,
  Upload,
} from "lucide-vue-next";
import WorkbenchResult from "../components/workbench/WorkbenchResult.vue";
import messages from "../components/workbench/messages";
import { useWorkbench } from "../components/workbench/useWorkbench";
const props = defineProps({
  downloadDir: { type: String, default: "" },
  modelName: { type: String, default: "" },
});
defineEmits(["settings"]);
const { locale } = useI18n();
const workspaceElement = ref(null);
const { width: sidebarWidth, collapsed: sidebarCollapsed, dragging, minimum, maximum, start, move, stop, keydown, toggle: toggleSidebar } = useSidebar();
const w = (key) =>
  messages[locale.value.startsWith("en") ? "en" : "zh"][key] || key;
const {
  page,
  state,
  busy,
  notice,
  navigate,
  newTask,
  restore,
  invalidate,
  parse,
  download,
  controlDownload,
  reveal,
  chooseAudio,
  importText,
  transcribe,
  cancelTranscript,
  generate,
  stopOutline,
  outputText,
  copy,
  save,
  time,
} = useWorkbench({ props, locale, w });
const tools = [
  { id: "video", icon: Video },
  { id: "podcast", icon: Podcast },
  { id: "stt", icon: AudioLines },
  { id: "outline", icon: ListTree },
];
const formats = computed(() =>
  (state.value?.info?.formats || []).filter((f) =>
    state.value.audioKind === "audio" ? f.ext === "m4a" : f.ext === "mp4",
  ),
);
const sourceText = computed(() => {
  const info = state.value?.info;
  return page.value === "video"
    ? info?.transcript || ""
    : info?.transcript?.text || info?.transcript?.preview || "";
});
const media = computed(() => {
  const info = state.value?.info || {},
    episode = info.episode || {};
  return page.value === "video"
    ? {
        title: info.title,
        thumbnail: info.thumbnail_proxy || info.thumbnail,
        duration: info.duration,
        author: info.uploader,
        date: info.upload_date,
      }
    : {
        title: episode.title,
        thumbnail: episode.thumbnail,
        duration: episode.duration,
        author: episode.show_title,
        date: episode.published_at,
        description: episode.description,
      };
});
const size = (n) => `${(Number(n) / 1024 / 1024).toFixed(1)} MB`;
const duration = (n) =>
  `${Math.floor(Number(n) / 60)}:${String(Math.floor(Number(n) % 60)).padStart(2, "0")}`;
const isDownloadActive = (d) =>
  ["QUEUED", "DOWNLOADING", "PAUSED"].includes(d.status);
const canPause = (d) => d.kind === "podcast" || !/Win/.test(navigator.platform);
</script>
<style scoped src="../components/workbench/workbench.css"></style>
