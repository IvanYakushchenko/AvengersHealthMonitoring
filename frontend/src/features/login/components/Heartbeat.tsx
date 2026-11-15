import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

// True when the user asks the system to reduce motion. The heartbeat line is then drawn without animation.
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Heartbeat (ECG) line that draws itself and then loops, as a health-monitoring motif.
function Heartbeat() {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path || prefersReducedMotion()) return
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    const animation = animate(path, {
      strokeDashoffset: [length, 0],
      duration: 1600,
      ease: 'inOutSine',
      loop: true,
      loopDelay: 400,
    })
    return () => {
      animation.cancel()
    }
  }, [])

  return (
    <svg viewBox="0 0 240 40" className="h-10 w-full" aria-hidden="true">
      <path
        ref={pathRef}
        d="M0 22 H60 L70 22 L78 6 L88 36 L96 16 L102 22 H150 L158 22 L164 12 L172 30 L178 22 H240"
        fill="none"
        stroke="#5b8fd6"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default Heartbeat
