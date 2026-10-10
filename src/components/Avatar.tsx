import { avatarUrl } from '../lib/avatars'
import type { Profile } from '../lib/types'

function initials(name: string | undefined): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * A person's avatar: the one assigned to them (profiles.avatar_key), else their
 * initials.
 * Google profile photos are deliberately never shown (or stored). Decorative
 * -- the name is always shown next to it -- so hidden from screen readers.
 */
export function Avatar({ profile, size = 32 }: { profile: Profile | null | undefined; size?: number }) {
  const src = avatarUrl(profile?.avatar_key)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }

  if (!src) {
    return (
      <span className="avatar avatar--initials" style={style} aria-hidden="true">
        {initials(profile?.display_name)}
      </span>
    )
  }
  return <img className="avatar" style={style} src={src} alt="" />
}
