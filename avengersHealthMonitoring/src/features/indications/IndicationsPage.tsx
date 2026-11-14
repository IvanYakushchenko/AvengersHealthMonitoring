import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import { indicationGroups } from './data/indicationGroups'

type IndicationsPageProps = {
  onLogout: () => void
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function IndicationsPage({ onLogout }: IndicationsPageProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Page entrance: fade in the whole screen, then stagger the group cards
  // and grow each group's underline.
  useEffect(() => {
    if (prefersReducedMotion() || !rootRef.current) return
    const root = rootRef.current
    const animations = [
      animate(root, { opacity: [0, 1], duration: 400, ease: 'outCubic' }),
      animate(root.querySelectorAll('[data-group]'), {
        opacity: [0, 1],
        translateY: [24, 0],
        duration: 500,
        ease: 'outExpo',
        delay: stagger(100, { start: 150 }),
      }),
      animate(root.querySelectorAll('[data-underline]'), {
        scaleX: [0, 1],
        duration: 600,
        ease: 'outCubic',
        delay: stagger(100, { start: 300 }),
      }),
    ]
    return () => {
      animations.forEach((a) => a.cancel())
    }
  }, [])

  return (
    <div ref={rootRef} className="min-h-screen w-full bg-surface">
      <header className="flex items-center justify-between border-b-4 border-brand bg-ink px-6 py-4 text-white">
        <h1 className="text-xl font-semibold">Astronaut Medical Indications</h1>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-white/60 px-3 py-1 text-sm hover:bg-brand"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        {indicationGroups.map((group) => (
          <section key={group.id} data-group className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-brand">
              {group.title}
            </h2>
            <span
              data-underline
              aria-hidden="true"
              className="mb-3 block h-0.5 origin-left bg-brand-light"
            />
            <ul className="flex flex-col gap-3">
              {group.indications.map((indication) => (
                <li key={indication.id}>
                  <p className="font-medium text-slate-800">{indication.name}</p>
                  <p className="text-sm text-slate-600">{indication.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}

export default IndicationsPage
