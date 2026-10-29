import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { emailActionUrl } from './recoveryLink.ts'

const verify = (type: string) =>
  `https://example.supabase.co/auth/v1/verify?token=abc%2B123&type=${type}&redirect_to=https://x`

Deno.test('recovery URL becomes the direct reset link', () => {
  assertEquals(
    emailActionUrl('recovery', verify('recovery')),
    'https://loveworldmusickaraoke.com/reset-password?token_hash=abc%2B123&type=recovery',
  )
})

Deno.test('signup URL becomes the direct confirm link', () => {
  assertEquals(
    emailActionUrl('signup', verify('signup')),
    'https://loveworldmusickaraoke.com/auth/confirm?token_hash=abc%2B123&type=signup',
  )
})

Deno.test('missing token falls back to the original URL', () => {
  const noToken = 'https://example.supabase.co/auth/v1/verify?type=signup'
  assertEquals(emailActionUrl('signup', noToken), noToken)
  assertEquals(emailActionUrl('recovery', 'not a url'), 'not a url')
})

Deno.test('other email types are unchanged', () => {
  assertEquals(emailActionUrl('magiclink', verify('magiclink')), verify('magiclink'))
  assertEquals(emailActionUrl('email_change', verify('email_change')), verify('email_change'))
})
