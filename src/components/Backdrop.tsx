import type { ReactNode } from 'react'

/**
 * One large, faint line drawing per tab, partly off the right edge of the
 * screen. Purely decorative: stroked in the text colour at
 * --backdrop-opacity, behind everything, and hidden from screen readers.
 *
 * All drawings share a 200x200 box. Strokes are non-scaling (see app.css), so
 * they stay a fine pen line however large the drawing is rendered.
 */

export type BackdropName = 'sun' | 'broom' | 'laurel' | 'key'

const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number) =>
  [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))] as const
const lerp = (a: readonly number[], b: readonly number[], t: number) =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const

/** An almond leaf pointing along +x from the origin. */
const LEAF = 'M0 0Q9 -7 18 0Q9 7 0 0Z'

function Sun() {
  return (
    <>
      <circle cx="100" cy="100" r="30" />
      <circle cx="100" cy="100" r="36" />
      {Array.from({ length: 32 }, (_, i) => {
        const deg = i * 11.25
        const long = i % 2 === 0
        const [x1, y1] = polar(100, 100, long ? 46 : 48, deg)
        const [x2, y2] = polar(100, 100, long ? 94 : 68, deg)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
    </>
  )
}

function BroomAndBucket() {
  // The broom leans along `dir`; `across` is perpendicular to it.
  const dir = [-0.487, 0.873]
  const across = [0.873, 0.487]
  const at = (c: readonly number[], along: number, side: number) =>
    [c[0] + dir[0] * along + across[0] * side, c[1] + dir[1] * along + across[1] * side] as const
  const bind = [104, 118]
  const topL = at(bind, 0, -12)
  const topR = at(bind, 0, 12)
  const bandL = at(bind, 8, -12.5)
  const bandR = at(bind, 8, 12.5)
  const footL = at(bind, 64, -32)
  const footR = at(bind, 66, 32)
  const footMid = at(bind, 70, 0)

  return (
    <>
      {/* broom */}
      <path d={`M162 14L${bind[0]} ${bind[1]}`} />
      <path
        d={`M${topL} Q${at(bind, 34, -24)} ${footL} Q${footMid} ${footR} Q${at(bind, 34, 24)} ${topR} Z`}
      />
      <path d={`M${topL}L${topR}M${bandL}L${bandR}`} />
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 1) / 8
        const from = lerp(bandL, bandR, t)
        const to = lerp(footL, footR, t)
        return <path key={i} d={`M${from}L${to}`} />
      })}
      {/* bucket */}
      <ellipse cx="152" cy="136" rx="28" ry="6" />
      <path d="M124 136L130 188Q152 196 174 188L180 136" />
      <path d="M126.5 154Q152 162 177.5 154M128.5 172Q152 180 175.5 172" />
      <path d="M126 137Q152 92 178 137" />
    </>
  )
}

function LaurelBranch() {
  const [x1, y1] = polar(100, 104, 66, 100)
  const [x2, y2] = polar(100, 104, 66, 256)
  const leaves: ReactNode[] = []
  for (let deg = 110; deg <= 246; deg += 14) {
    const [x, y] = polar(100, 104, 66, deg)
    leaves.push(
      <path key={`o${deg}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${deg + 55})`} />,
      <path key={`i${deg}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${deg + 125})`} />,
    )
  }
  return (
    <>
      <path d={`M${x1} ${y1}A66 66 0 0 1 ${x2} ${y2}`} />
      {leaves}
    </>
  )
}

function Laurel() {
  return (
    <>
      <LaurelBranch />
      <g transform="translate(200 0) scale(-1 1)">
        <LaurelBranch />
      </g>
      {/* the ribbon tying the two branches */}
      <path d="M100 170c-10-9-23-5-19 3 3 6 12 3 19-3Zm0 0c10-9 23-5 19 3-3 6-12 3-19-3Z" />
      <path d="M100 170l-9 18M100 170l9 18" />
    </>
  )
}

function Key() {
  return (
    <g transform="rotate(-35 100 100)">
      <circle cx="46" cy="100" r="26" />
      <circle cx="46" cy="100" r="15" />
      <circle cx="46" cy="100" r="4" />
      <path d="M72 96H176V104H72" />
      <path d="M80 91V109M86 91V109" />
      <path d="M150 104V128H158V119H165V128H172V104" />
    </g>
  )
}

const DRAWINGS: Record<BackdropName, () => ReactNode> = {
  sun: Sun,
  broom: BroomAndBucket,
  laurel: Laurel,
  key: Key,
}

export function Backdrop({ name }: { name: BackdropName }) {
  const Drawing = DRAWINGS[name]
  return (
    <svg
      // Keyed by name so switching tabs remounts it and replays the fade.
      key={name}
      className="backdrop"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Drawing />
    </svg>
  )
}
