import type { ReactNode } from 'react'

/** The hanging-broom drawing for "nothing to do" -- the one place where the
 *  whimsy costs nothing and lands best. */
function TidyAtelier() {
  return (
    <svg
      viewBox="0 0 120 90"
      width="120"
      height="90"
      className="empty__art"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* a hook and a broom hung up for the day */}
      <path d="M18 8h84" />
      <path d="M60 8v6" />
      <path d="M57 14h6a2 2 0 0 1 2 2v2h-10v-2a2 2 0 0 1 2-2Z" />
      <path d="M60 18v34" />
      <path d="M52 52h16l-2.5 20a3 3 0 0 1-3 2.6h-5a3 3 0 0 1-3-2.6Z" />
      <path d="M53.4 62h13.2" opacity=".6" />
      {/* a moon and a couple of stars, because the work is done */}
      <path d="M96 30a7 7 0 1 0 4.2 9 5.6 5.6 0 0 1-4.2-9Z" />
      <path d="m26 34 .9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Z" />
      <path d="m34 56 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" opacity=".7" />
      <path d="m90 60 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" opacity=".7" />
    </svg>
  )
}

export function Empty({
  title,
  body,
  children,
  art = true,
}: {
  title: string
  body?: string
  children?: ReactNode
  art?: boolean
}) {
  return (
    <div className="empty">
      {art && <TidyAtelier />}
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {children}
    </div>
  )
}
