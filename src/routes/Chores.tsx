import { useEffect, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useBoardContext } from '../hooks/BoardProvider'
import {
  archiveChore,
  createChore,
  unarchiveChore,
  updateChore,
} from '../lib/chores'
import { recurrenceLabel } from '../lib/recurrence'
import { ChoreForm } from '../components/ChoreForm'
import { Empty } from '../components/Empty'
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
        setToast('Chore updated.')
      } else {
        await createChore(draft)
        setToast('Chore added to the ledger.')
      }
      setMode({ kind: 'none' })
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Could not save that.')
    }
  }

  async function onArchive(chore: Chore) {
    try {
      await archiveChore(chore.id)
      setToast(`${chore.title} retired. Past points are kept.`)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Could not retire that chore.')
    }
  }

  async function onRestore(chore: Chore) {
    try {
      await unarchiveChore(chore.id)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Could not restore that chore.')
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Chores</h1>
          <p className="topbar__sub">What the household keeps on the list.</p>
        </div>
        {mode.kind === 'none' && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setMode({ kind: 'new' })}
          >
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            Add
          </button>
        )}
      </header>

      <main className="page">
        {mode.kind !== 'none' && (
          <div className="section">
            <div className="section__head">
              <span className="label">
                {mode.kind === 'edit' ? 'Edit chore' : 'New chore'}
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
            title="An empty ledger"
            body="Add the first chore and it will start appearing on Today for everyone."
          >
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: '1.25rem' }}
              onClick={() => setMode({ kind: 'new' })}
            >
              <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
              Add a chore
            </button>
          </Empty>
        )}

        {active.length > 0 && (
          <section className="section">
            <div className="section__head">
              <span className="label">On the list</span>
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
                      <span aria-hidden="true">·</span>
                      <span className="points">{chore.points} pts</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setMode({ kind: 'edit', chore })}
                      aria-label={`Edit ${chore.title}`}
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => void onArchive(chore)}
                      aria-label={`Retire ${chore.title}`}
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
              <span className="label">Retired</span>
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
                      <span>Retired</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void onRestore(chore)}
                    aria-label={`Restore ${chore.title}`}
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
