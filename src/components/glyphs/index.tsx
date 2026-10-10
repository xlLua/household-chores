import type { ReactNode } from 'react'
import type { GlyphName } from '../../lib/types'

/* Hand-drawn category marks. Deliberately a little irregular -- a perfect
   circle reads as a UI icon, a slightly wobbly one reads as ink. All share a
   1.5 stroke weight so they sit alongside Lucide icons without clashing. */

const PATHS: Record<GlyphName, ReactNode> = {
  broom: (
    <>
      <path d="M16.8 2.9c-.7.9-4.3 6.3-6.1 8.9" />
      <path d="M7.6 9.6 13.4 14.4" />
      <path d="M6.1 11.4 11.9 16.2" />
      <path d="M6.1 11.4 3.2 20.1" />
      <path d="M11.9 16.2 10.1 21.3" />
      <path d="M3.2 20.1c2.8 1.1 5 1.3 6.9.9" />
      <path d="M6.4 15.6 5.2 20.6" opacity=".55" />
      <path d="M8.6 17.4 7.9 21.1" opacity=".55" />
    </>
  ),
  kettle: (
    <>
      <path d="M5.2 10.6h12.1c.6 0 1 .5 1 1.1v1.9a5.4 5.4 0 0 1-5.4 5.4H9.6a5.4 5.4 0 0 1-5.4-5.4v-1.9c0-.6.4-1.1 1-1.1Z" />
      <path d="M18.3 12.1c1-.6 2-1.3 2.9-2.2" />
      <path d="M8.4 10.5c.3-2.4 5-2.4 5.4 0" />
      <path d="M11.1 7.9V6.3" />
      <path d="M7.5 19v1.8" />
      <path d="M14.9 19v1.8" />
    </>
  ),
  mushroom: (
    <>
      <path d="M3.6 11.8c0-4.3 3.9-7.6 8.4-7.6s8.4 3.3 8.4 7.6c0 .5-.5.9-1.1.9H4.7c-.6 0-1.1-.4-1.1-.9Z" />
      <path d="M9.7 12.7v4.9a2.3 2.3 0 0 0 4.6 0v-4.9" />
      <circle cx="8.3" cy="9.1" r="1.1" opacity=".6" />
      <circle cx="14.6" cy="8.4" r="1.4" opacity=".6" />
      <circle cx="11.8" cy="6.2" r=".8" opacity=".6" />
    </>
  ),
  leaf: (
    <>
      <path d="M4.6 19.4C4.4 10.6 9.8 4.2 19.3 3.1c.4 9-4.6 15.3-14.7 16.3Z" />
      <path d="M4.6 19.4C8.7 14.4 13.6 8.9 19.3 3.1" />
      <path d="M8.2 11.3c1.6.2 3 .1 4.4-.4" opacity=".55" />
      <path d="M11.4 7.6c1.3.3 2.6.3 3.8 0" opacity=".55" />
      <path d="M3.4 21.1c.3-.7.7-1.3 1.2-1.7" />
    </>
  ),
  moon: (
    <>
      <path d="M15.1 3.4a8.8 8.8 0 1 0 5.2 11.4 7.1 7.1 0 0 1-5.2-11.4Z" />
      <path d="m19.4 4 .6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" />
      <path d="m15.9 8.9.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4Z" opacity=".6" />
    </>
  ),
  washtub: (
    <>
      <path d="M3.2 9.9h17.6l-1.7 9.6a2.2 2.2 0 0 1-2.2 1.8H7.1a2.2 2.2 0 0 1-2.2-1.8Z" />
      <path d="M2.4 9.9h19.2" />
      <circle cx="9.4" cy="6.4" r="1.7" opacity=".6" />
      <circle cx="14.3" cy="4.9" r="1.2" opacity=".6" />
      <circle cx="12.6" cy="7.6" r=".8" opacity=".6" />
    </>
  ),
}

export const GLYPH_NAMES = Object.keys(PATHS) as GlyphName[]

export function Glyph({
  name,
  size = 22,
  className,
}: {
  name: GlyphName
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.broom}
    </svg>
  )
}
