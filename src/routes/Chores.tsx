import { useEffect, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useBoardContext } from '../hooks/BoardProvider'
import {
  archiveChore,
  createChore,
  isPersonal,
  pointsLabel,
  unarchiveChore,
  updateChore,
} from '../lib/chores'
import { recurrenceLabel } from '../lib/recurrence'
import { ChoreForm } from '../components/ChoreForm'
import { Empty } from '../components/Empty'
import { PageHeader } from '../components/PageHeader'
import { Glyph } from '../components/glyphs'
import type { Chore, ChoreDraft } from '../lib/types'

export function Chores() {
  const { chores, reload } = useBoardContext()
  const [mode, setMode] = useState<{ kind: 'none' } | { kind: 'new' } | { kind: 'edit'; chore: Chore }>(
    { kind: 'none' },
  )
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const active = chores.filter((c) => !c.archived_at)
  const archived = chores.filter((c) => c.archived_at)

  async function save(draft: ChoreDraft) {
    try {
      if (mode.kind === 'edit') {
        await updateChore(mode.chore.id, draft)
        setToast('Taak bijgewerkt.')
      } else {
        await createChore(draft)
        setToast('Taak toegevoegd.')
      }
      setMode({ kind: 'none' })
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Opslaan is mislukt.')
    }
  }

  async function onArchive(chore: Chore) {
    try {
      await archiveChore(chore.id)
      setToast(`${chore.title} gearchiveerd. Eerder verdiende punten blijven staan.`)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Archiveren is mislukt.')
    }
  }

  async function onRestore(chore: Chore) {
    try {
      await unarchiveChore(chore.id)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Terugzetten is mislukt.')
    }
  }

  return (
    <>
      <PageHeader
        title="Taken"
        status={`${active.length} ${active.length === 1 ? 'actieve taak' : 'actieve taken'}`}
      />

      <main className="page">
        {mode.kind === 'none' && active.length > 0 && (
          <div className="page__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setMode({ kind: 'new' })}
            >
              <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
              Toevoegen
            </button>
          </div>
        )}
        {mode.kind !== 'none' && (
          <div className="section">
            <div className="section__head">
              <span className="label">
                {mode.kind === 'edit' ? 'Taak bewerken' : 'Nieuwe taak'}
              </span>
            </div>
            <ChoreForm
              initial={mode.kind === 'edit' ? mode.chore : undefined}
              onSave={save}
              onCancel={() => setMode({ kind: 'none' })}
            />
          </div>
        )}

        {mode.kind === 'none' && active.length === 0 && (
          <Empty
            title="Nog geen taken"
            body="Voeg de eerste taak toe. Die verschijnt dan voor iedereen bij Vandaag."
          >
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: '1.25rem' }}
              onClick={() => setMode({ kind: 'new' })}
            >
              <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
              Taak toevoegen
            </button>
          </Empty>
        )}

        {active.length > 0 && (
          <section className="section">
            <div className="section__head">
              <span className="label">Actief</span>
              <span className="section__count">{active.length}</span>
            </div>
            <div className="cards">
              {active.map((chore) => (
                <article className="card" key={chore.id}>
                  <span className="card__glyph">
                    <Glyph name={chore.glyph} />
                  </span>
                  <div className="card__body">
                    <h3 className="card__title">{chore.title}</h3>
                    <p className="card__meta">
                      <span>{recurrenceLabel(chore)}</span>
                      <span className="sep" aria-hidden="true">·</span>
                      {isPersonal(chore) ? (
                        <span>Persoonlijk</span>
                      ) : (
                        <span className="points">{pointsLabel(chore.points)}</span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setMode({ kind: 'edit', chore })}
                      aria-label={`${chore.title} bewerken`}
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => void onArchive(chore)}
                      aria-label={`${chore.title} archiveren`}
                    >
                      <Archive size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {archived.length > 0 && (
          <section className="section">
            <div className="section__head">
              <span className="label">Gearchiveerd</span>
              <span className="section__count">{archived.length}</span>
            </div>
            <div className="cards">
              {archived.map((chore) => (
                <article className="card card--done" key={chore.id}>
                  <span className="card__glyph">
                    <Glyph name={chore.glyph} />
                  </span>
                  <div className="card__body">
                    <h3 className="card__title">{chore.title}</h3>
                    <p className="card__meta">
                      <span>Gearchiveerd</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void onRestore(chore)}
                    aria-label={`${chore.title} terugzetten`}
                  >
                    <RotateCcw size={16} strokeWidth={1.8} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
