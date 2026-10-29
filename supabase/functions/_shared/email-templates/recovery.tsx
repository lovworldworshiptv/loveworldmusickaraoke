/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={card}>
        <Section style={header}>
          <Img src="https://loveworldmusickaraoke.com/icon-512.png" width="88" height="88" alt="Loveworld Music+" style={{ borderRadius: '20px', margin: '0 auto', display: 'block' }} />
          <Text style={brand}>Loveworld Music+</Text>
        </Section>
        <Section style={container}>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const card = { maxWidth: '520px', margin: '24px auto', borderRadius: '20px', overflow: 'hidden', border: '1px solid #ead9a0', backgroundColor: '#fffdf6' }
const header = { background: 'linear-gradient(135deg, #dab823 0%, #b88e12 100%)', backgroundColor: '#c9a020', padding: '32px 20px 20px', textAlign: 'center' as const }
const brand = { color: '#0a1a3a', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '0.5px', margin: '12px 0 0', fontFamily: 'Georgia, serif' }
const container = { padding: '28px 30px 30px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0a1a3a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#c9a020',
  color: '#0a1a3a',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  border: '1px solid #b88e12',
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #c9a020 !important; color: #0a1a3a !important; }
  }
  [data-ogsc] .dm-btn { background-color: #c9a020 !important; color: #0a1a3a !important; }
  [data-ogsb] .dm-btn { background-color: #c9a020 !important; color: #0a1a3a !important; }
`
