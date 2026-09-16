import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useSidebar() {
  const minimum = 56
  const collapseAt = 160
  const expandAt = 180
  const viewport = ref(window.innerWidth)
  const maximum = computed(() => Math.max(minimum, Math.min(320, viewport.value - 640)))
  const clamp = (value) => Math.max(minimum, Math.min(maximum.value, value))
  let saved = 216
  try { const value = Number(localStorage.getItem('workspace-sidebar-width')); if (value >= minimum) saved = value } catch {}
  const width = ref(clamp(saved))
  const collapsed = ref(width.value < expandAt)
  let expandedWidth = Math.max(expandAt, width.value)
  try {
    const remembered = Number(localStorage.getItem('workspace-sidebar-expanded-width'))
    if (remembered >= expandAt && Number.isFinite(remembered)) expandedWidth = remembered
    if (width.value > collapseAt && width.value < expandAt) {
      collapsed.value = localStorage.getItem('workspace-sidebar-collapsed') !== 'false'
    }
  } catch {}
  const dragging = ref(false)
  let capture = null
  let pointer = null
  let initialX = 0
  let initialWidth = 0
  const setWidth = (value) => {
    width.value = clamp(value)
    if (width.value <= collapseAt) collapsed.value = true
    else if (width.value >= expandAt) collapsed.value = false
    if (!collapsed.value && width.value >= expandAt) expandedWidth = width.value
  }
  const animations = new Set()
  let generation = 0
  const cancelMotion = () => {
    generation++
    for (const animation of animations) animation.cancel()
    animations.clear()
  }
  const toggle = async (root) => {
    if (!root) return
    stop()
    // Batch both geometry reads. Only transforms run between the two layouts.
    const elements = [...root.querySelectorAll('.sidebar-surface, .sidebar-toggle, .sidebar .nav-button, .topbar .crumb, .main > .content')]
    const before = elements.map(element => element.getBoundingClientRect())
    cancelMotion()
    const current = generation
    if (collapsed.value) setWidth(Math.max(expandAt, expandedWidth))
    else setWidth(minimum)
    await nextTick()
    if (current !== generation || !root.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const after = elements.map(element => element.getBoundingClientRect())
    elements.forEach((element, index) => {
      const from = before[index], to = after[index]
      const surface = element.classList.contains('sidebar-surface')
      const first = surface
        ? `scaleX(${from.width / width.value})`
        : `translate(${from.x - to.x}px, ${from.y - to.y}px)`
      const last = surface ? 'scaleX(1)' : 'translate(0, 0)'
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
    initialX = event.clientX; initialWidth = width.value
    capture = event.currentTarget; pointer = event.pointerId
    capture.setPointerCapture(pointer); dragging.value = true
  }
  const move = (event) => {
    if (dragging.value && event.pointerId === pointer) setWidth(initialWidth + event.clientX - initialX)
  }
  const keydown = (event) => {
    const values = { ArrowLeft: width.value - 8, ArrowRight: width.value + 8, Home: minimum, End: maximum.value }
    if (!(event.key in values)) return
    cancelMotion()
    event.preventDefault(); setWidth(values[event.key])
  }
  const resize = () => { cancelMotion(); viewport.value = window.innerWidth; setWidth(width.value) }
  watch([width, collapsed], ([value, compact]) => {
    try {
      localStorage.setItem('workspace-sidebar-width', String(value))
      localStorage.setItem('workspace-sidebar-expanded-width', String(expandedWidth))
      localStorage.setItem('workspace-sidebar-collapsed', String(compact))
    } catch {}
  })
  onMounted(() => window.addEventListener('resize', resize))
  onBeforeUnmount(() => { cancelMotion(); stop(); window.removeEventListener('resize', resize) })
  return { width, collapsed, dragging, minimum, maximum, start, move, stop, keydown, toggle }
}
