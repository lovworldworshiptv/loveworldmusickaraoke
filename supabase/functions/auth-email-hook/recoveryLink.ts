const RESET_PAGE = 'https://loveworldmusickaraoke.com/reset-password'

/** Recovery emails link straight to our reset page; other types keep the original URL. */
export function emailActionUrl(actionType: string, url: string): string {
  if (actionType !== 'recovery') return url
  try {
    const token = new URL(url).searchParams.get('token')
    if (!token) return url
    return `${RESET_PAGE}?token_hash=${encodeURIComponent(token)}&type=recovery`
  } catch {
    return url
  }
}
