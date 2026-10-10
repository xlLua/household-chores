/**
 * The avatars people can pick: every image in src/assets/avatars/, found at
 * build time. The file name without extension is the key stored in
 * profiles.avatar_key.
 */
const files = import.meta.glob('../assets/avatars/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export interface AvatarOption {
  key: string
  url: string
}

export const AVATARS: AvatarOption[] = Object.entries(files)
  .map(([path, url]) => ({ key: path.split('/').pop()!.replace(/\.[^.]+$/, ''), url }))
  .sort((a, b) => a.key.localeCompare(b.key, 'nl', { numeric: true }))

export const avatarUrl = (key: string | null | undefined) =>
  key ? AVATARS.find((a) => a.key === key)?.url : undefined
