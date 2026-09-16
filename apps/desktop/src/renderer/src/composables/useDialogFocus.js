import { watch, nextTick, onBeforeUnmount } from 'vue'

const stack = []
export function useDialogFocus(element, close) {
  let previous = null
  const token = {}
  const focusable = () => [...(element.value?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])].filter(node => node.getClientRects().length && !node.closest('[inert]'))
  const release = () => {
    const index = stack.indexOf(token)
    if (index < 0) return
    const wasTop = index === stack.length - 1
    stack.splice(index, 1)
    if (wasTop && previous?.isConnected) nextTick(() => previous.focus())
  }
  const key = (event) => {
    if (stack.at(-1) !== token || !element.value) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return }
    if (event.key !== 'Tab') return
    const nodes = focusable(); const first = nodes[0]; const last = nodes.at(-1)
    if (!nodes.length) { event.preventDefault(); element.value.focus(); return }
    if (event.shiftKey && (document.activeElement === first || !element.value.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || !element.value.contains(document.activeElement))) { event.preventDefault(); first.focus() }
  }
  watch(element, async (node) => {
    if (!node) { release(); return }
    previous = document.activeElement; stack.push(token)
    await nextTick()
    if (element.value === node) (focusable()[0] || node).focus()
  }, { flush: 'post' })
  document.addEventListener('keydown', key)
  onBeforeUnmount(() => { document.removeEventListener('keydown', key); release() })
}
