import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rogers Feitosa Sports Nutrition'

interface ConfirmationProps {
  name?: string
  date?: string
  time?: string
  meetLink?: string
}

const ConsultationConfirmationEmail = ({ name, date, time, meetLink }: ConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your consultation is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Hi ${name},` : 'Hi there,'}</Heading>
        <Text style={text}>Your consultation is confirmed.</Text>
        {(date || time) && (
          <Text style={text}>
            <strong>{[date, time].filter(Boolean).join(' at ')}</strong>
          </Text>
        )}
        {meetLink && (
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button style={button} href={meetLink}>
              Join Google Meet
            </Button>
          </Section>
        )}
        <Text style={text}>
          See you soon! If you need to reschedule, please reply to this email.
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsultationConfirmationEmail,
  subject: 'Your consultation is confirmed',
  displayName: 'Consultation confirmation',
  previewData: {
    name: 'Claudia',
    date: 'Mon, Apr 27',
    time: '10:00 AM',
    meetLink: 'https://meet.google.com/abc-defg-hij',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0f766e', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '30px 0 0' }
