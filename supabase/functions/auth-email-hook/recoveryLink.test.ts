import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { emailActionUrl } from './recoveryLink.ts'

const verify = 'https://example.supabase.co/auth/v1/verify?token=abc%2B123&type=recovery&redirect_to=https://x'

Deno.test('recovery URL becomes the direct reset link', () => {
  assertEquals(
    emailActionUrl('recovery', verify),
    'https://loveworldmusickaraoke.com/reset-password?token_hash=abc%2B123&type=recovery',
  )
})

Deno.test('missing token falls back to the original URL', () => {
  const noToken = 'https://example.supabase.co/auth/v1/verify?type=recovery'
  assertEquals(emailActionUrl('recovery', noToken), noToken)
})

Deno.test('other email types are unchanged', () => {
  assertEquals(emailActionUrl('signup', verify), verify)
})
