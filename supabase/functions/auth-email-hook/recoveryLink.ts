const SITE = 'https://loveworldmusickaraoke.com'

/** Emails whose link opens a page on our own site instead of the backend verify address. */
const DIRECT_PAGES: Record<string, string> = {
  recovery: `${SITE}/reset-password`,
  signup: `${SITE}/auth/confirm`,
}

/**
 * Recovery and sign-up emails link straight to our pages with the hashed token;
 * the page verifies it only after the person taps a button, so email link
 * scanners can't use up the one-time token. Other types keep the original URL.
 */
export function emailActionUrl(actionType: string, url: string): string {
  const page = DIRECT_PAGES[actionType]
  if (!page) return url
  try {
    const token = new URL(url).searchParams.get('token')
    if (!token) return url
    return `${page}?token_hash=${encodeURIComponent(token)}&type=${actionType}`
  } catch {
    return url
  }
}
