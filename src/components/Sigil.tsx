/**
 * The completion animation: an ink circle strokes itself onto the card, the
 * way a spell is drawn in Witch Hat Atelier, then settles into a gold stamp.
 *
 * One SVG and a stroke-dashoffset keyframe -- no animation library. This is
 * the interaction people repeat every single day, so it's the one worth the
 * effort. `prefers-reduced-motion` collapses the duration globally (theme.css),
 * which lands it on the finished state instantly rather than breaking it.
 */
export function Sigil({ playing }: { playing: boolean }) {
  if (!playing) return null
  return (
    <span className="sigil" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="sigil__svg">
        {/* Not a <circle>: two arcs that don't quite meet, so it reads as drawn. */}
        <path
          className="sigil__ring"
          d="M60 9c28.2 0 51 22.8 51 51s-22.8 51-51 51S9 88.2 9 60 31.5 9.6 59 9"
          pathLength={100}
        />
        <path
          className="sigil__ring sigil__ring--inner"
          d="M60 22c20.9 0 38 17.1 38 38s-17.1 38-38 38-38-17.1-38-38 16.6-37.6 36.5-38"
          pathLength={100}
        />
        {/* Rune ticks around the ring. */}
        <g className="sigil__runes">
          <path d="M60 9v13" pathLength={100} />
          <path d="M111 60H98" pathLength={100} />
          <path d="M60 111V98" pathLength={100} />
          <path d="M9 60h13" pathLength={100} />
          <path d="m96 24-9 9" pathLength={100} />
          <path d="m24 96 9-9" pathLength={100} />
        </g>
        <path className="sigil__check" d="m42 62 13 13 24-28" pathLength={100} />
      </svg>
    </span>
  )
}
