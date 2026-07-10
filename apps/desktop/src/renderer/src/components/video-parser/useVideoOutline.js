import { computed, onBeforeUnmount, ref } from 'vue'

const minTranscriptCompactLength = 100

export function useVideoOutline({ axios, t, locale, videoInfo, sourcePlatform, formatDuration, copyToClipboard }) {
  const outlineCopyStatus = ref('')
  const outlineGenerationState = ref('idle')
  const generatedOutline = ref(null)
  const outlineError = ref('')
  let outlineCopyTimer = 0

  const getTranscriptCompactLength = (transcript = '') => String(transcript || '').replace(/\s+/g, '').length
  const isUsableTranscript = (info) => {
    if (!info) return false
    const transcript = String(info.transcript || '').trim()
    if (!transcript) return false
    const compactLength = Number(info.transcript_compact_length || getTranscriptCompactLength(transcript))
    return info.transcript_is_valid === true && compactLength >= minTranscriptCompactLength
  }
  const hasOutlineTranscript = computed(() => isUsableTranscript(videoInfo.value))
  const hasCaptionMetadata = computed(() => {
    const info = videoInfo.value
    if (!info) return false
    return Boolean(
      info.has_subtitles ||
      info.has_automatic_captions ||
      info.subtitle_languages?.length ||
      info.automatic_caption_languages?.length
    )
  })
  const hasInsufficientTranscript = computed(() => {
    const info = videoInfo.value
    if (!info || hasOutlineTranscript.value) return false
    return info.transcript_status === 'insufficient' || hasCaptionMetadata.value
  })
  const outlineState = computed(() => {
    if (!videoInfo.value) return 'idle'
    if (outlineGenerationState.value === 'generating') return 'generating'
    if (outlineGenerationState.value === 'failed') return 'failed'
    if (outlineGenerationState.value === 'success') return 'success'
    if (hasOutlineTranscript.value) return 'subtitlesAvailable'
    if (hasInsufficientTranscript.value) return 'insufficient'
    return 'noSubtitles'
  })
  const outlineStateMeta = computed(() => {
    const key = outlineState.value
    return {
      title: t(`videoParser.outline.states.${key}.title`),
      description: t(`videoParser.outline.states.${key}.description`)
    }
  })
  const outlineNodes = computed(() => generatedOutline.value?.nodes || [])
  const outlineTitle = computed(() => generatedOutline.value?.title || t('videoParser.outline.root'))
  const outlineSummary = computed(() => generatedOutline.value?.summary || '')
  const outlineLanguage = computed(() => (String(locale.value).toLowerCase().startsWith('zh') ? 'zh' : 'en'))

  async function copyOutline() {
    if (outlineState.value !== 'success') return
    const text = outlineNodes.value
      .map((node) => {
        const children = node.children
          .map((child) => `- ${child.title}${child.summary ? `: ${child.summary}` : ''}`)
          .join('\n')
        return `${node.title}${node.summary ? `\n${node.summary}` : ''}${children ? `\n${children}` : ''}`
      })
      .join('\n\n')
    await copyToClipboard(`${outlineTitle.value}\n${outlineSummary.value}\n\n${text}`.trim())
    const message = t('videoParser.outline.copied')
    if (outlineCopyTimer) window.clearTimeout(outlineCopyTimer)
    outlineCopyStatus.value = message
    outlineCopyTimer = window.setTimeout(() => {
      if (outlineCopyStatus.value === message) outlineCopyStatus.value = ''
      outlineCopyTimer = 0
    }, 1800)
  }

  async function generateOutline() {
    const transcript = String(videoInfo.value?.transcript || '').trim()
    if (!isUsableTranscript(videoInfo.value)) {
      outlineError.value = t('videoParser.outline.states.insufficient.description')
      outlineGenerationState.value = 'idle'
      return
    }
    outlineGenerationState.value = 'generating'
    generatedOutline.value = null
    outlineError.value = ''
    try {
      const response = await axios.post('/api/video/outline', {
        title: videoInfo.value?.title || '',
        platform: sourcePlatform.value,
        duration: videoInfo.value?.duration ? formatDuration(videoInfo.value.duration) : '',
        language: outlineLanguage.value,
        transcript
      })
      if (!response.data?.success || !response.data?.outline) {
        throw new Error(response.data?.error || t('videoParser.errors.outlineFailed'))
      }
      generatedOutline.value = response.data.outline
      outlineGenerationState.value = 'success'
    } catch (err) {
      console.error('[VideoParser] Outline generation failed', {
        endpoint: '/api/video/outline',
        status: err.response?.status,
        response: err.response?.data,
        message: err.message,
        request: {
          title: videoInfo.value?.title || '',
          platform: sourcePlatform.value,
          duration: videoInfo.value?.duration ? formatDuration(videoInfo.value.duration) : '',
          language: outlineLanguage.value,
          transcriptLength: transcript.length
        }
      })
      outlineError.value = err.response?.data?.error || t('videoParser.errors.outlineFailed')
      outlineGenerationState.value = 'failed'
    }
  }

  function resetOutline() {
    outlineCopyStatus.value = ''
    outlineGenerationState.value = 'idle'
    generatedOutline.value = null
    outlineError.value = ''
  }

  onBeforeUnmount(() => {
    if (outlineCopyTimer) window.clearTimeout(outlineCopyTimer)
  })

  return {
    outlineCopyStatus,
    outlineError,
    outlineState,
    outlineStateMeta,
    outlineNodes,
    outlineTitle,
    outlineSummary,
    copyOutline,
    generateOutline,
    resetOutline
  }
}
