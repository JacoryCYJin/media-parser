import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useSidebar() {
  const minimum = 180
  const viewport = ref(window.innerWidth)
  const maximum = computed(() => Math.max(minimum, Math.min(320, viewport.value - 640)))
  const clamp = (value) => Math.max(minimum, Math.min(maximum.value, value))
  let saved = 216
  try { const value = Number(localStorage.getItem('workspace-sidebar-width')); if (value >= minimum) saved = value } catch {}
  const width = ref(clamp(saved))
  const collapsed = ref(false)
  const dragging = ref(false)
  let capture = null
  let pointer = null
  const animations = new Set()
  let generation = 0
  const cancelMotion = () => {
    generation++
    for (const animation of animations) animation.cancel()
    animations.clear()
  }
  const toggle = async (root) => {
    if (!root) return
    // Batch both geometry reads. Only transforms run between the two layouts.
    const elements = [...root.querySelectorAll('.sidebar-surface, .sidebar-toggle, .sidebar .nav-button, .topbar .crumb, .main > .content')]
    const before = elements.map(element => element.getBoundingClientRect())
    cancelMotion()
    const current = generation
    collapsed.value = !collapsed.value
    await nextTick()
    if (current !== generation || !root.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const after = elements.map(element => element.getBoundingClientRect())
    elements.forEach((element, index) => {
      const from = before[index], to = after[index]
      const surface = element.classList.contains('sidebar-surface')
      const first = surface
        ? `scaleX(${from.width / width.value})`
        : `translate(${from.x - to.x}px, ${from.y - to.y}px)`
      const last = surface ? `scaleX(${collapsed.value ? 56 / width.value : 1})` : 'translate(0, 0)'
      const animation = element.animate([{ transform: first }, { transform: last }], {
        duration: 200, easing: 'cubic-bezier(.2, .7, .2, 1)'
      })
      animations.add(animation)
      animation.onfinish = () => animations.delete(animation)
    })
  }
  const stop = () => {
    const target = capture; const id = pointer
    capture = null; pointer = null; dragging.value = false
    if (target?.hasPointerCapture(id)) target.releasePointerCapture(id)
  }
  const start = (event) => {
    if (event.button !== 0) return
    cancelMotion()
    event.preventDefault()
    capture = event.currentTarget; pointer = event.pointerId
    capture.setPointerCapture(pointer); dragging.value = true
  }
  const move = (event) => {
    if (dragging.value && event.pointerId === pointer) width.value = clamp(event.clientX)
  }
  const keydown = (event) => {
    const values = { ArrowLeft: width.value - 8, ArrowRight: width.value + 8, Home: minimum, End: maximum.value }
    if (!(event.key in values)) return
    cancelMotion()
    event.preventDefault(); width.value = clamp(values[event.key])
  }
  const resize = () => { cancelMotion(); viewport.value = window.innerWidth; width.value = clamp(width.value) }
  watch(width, (value) => { try { localStorage.setItem('workspace-sidebar-width', String(value)) } catch {} })
  watch(collapsed, stop)
  onMounted(() => window.addEventListener('resize', resize))
  onBeforeUnmount(() => { cancelMotion(); stop(); window.removeEventListener('resize', resize) })
  return { width, collapsed, dragging, minimum, maximum, start, move, stop, keydown, toggle }
}
