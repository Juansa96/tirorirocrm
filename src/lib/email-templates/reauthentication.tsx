import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
  siteName?: string
}

export const ReauthenticationEmail = ({
  token,
  siteName = 'Tiroriro Home CRM',
}: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Hr style={hr} />
        <Heading style={h1}>Confirma tu identidad</Heading>
        <Text style={text}>Usa el código siguiente para verificar tu identidad:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código caducará en breve. Si no solicitaste esto, puedes ignorar este mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#000000', letterSpacing: '0.5px', margin: '0' }
const hr = { borderColor: '#e5e7eb', margin: '12px 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
