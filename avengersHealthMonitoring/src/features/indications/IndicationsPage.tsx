import { indicationGroups } from './data/indicationGroups'

type IndicationsPageProps = {
  onLogout: () => void
}

function IndicationsPage({ onLogout }: IndicationsPageProps) {
  return (
    <div className="min-h-screen w-full bg-surface">
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
          <section key={group.id} className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-3 border-b border-slate-200 pb-2 text-lg font-semibold text-brand">
              {group.title}
            </h2>
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
