import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { ReactNode } from 'react'

/**
 * The page title in the script, with today's date and a short status under
 * it. The rule beneath doubles as a progress bar when `progress` is given
 * (0..1): it fills with gold and the bead rides the end of the fill.
 */
export function PageHeader({
  title,
  status,
  progress,
}: {
  title: string
  status?: ReactNode
  progress?: number | null
}) {
  const date = format(new Date(), 'EEEE d MMMM', { locale: nl })
  const filled = progress == null ? null : Math.min(1, Math.max(0, progress))

  return (
    <header className="header">
      <h1 className="header__title">{title}</h1>
      <p className="header__sub">
        <span>{date}</span>
        {status && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{status}</span>
          </>
        )}
      </p>
      <div className="header__rule" aria-hidden="true">
        {filled != null && (
          <span className="header__fill" style={{ width: `${filled * 100}%` }} />
        )}
        <span
          className={filled != null ? 'header__bead header__bead--lit' : 'header__bead'}
          style={{ left: `${filled == null ? 50 : filled * 100}%` }}
        />
      </div>
    </header>
  )
}
