import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rogers Feitosa Sports Nutrition'

interface CheckinLinkProps {
  name?: string
  link?: string
  accessCode?: string
  dueHours?: string
}

const CheckinLinkEmail = ({ name, link, accessCode, dueHours }: CheckinLinkProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Time for your weekly check-in</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Hi ${name},` : 'Hi there,'}</Heading>
        <Text style={text}>
          It's time for your check-in! Please take a few minutes to share how
          your training, nutrition and recovery have been going this week.
        </Text>
        {link && (
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button style={button} href={link}>
              Open my check-in form
            </Button>
          </Section>
        )}
        {accessCode && (
          <Text style={text}>
            Your access code: <strong>{accessCode}</strong>
          </Text>
        )}
        {dueHours && (
          <Text style={text}>
            Please complete it within <strong>{dueHours}</strong> so we can
            adjust your plan in time.
          </Text>
        )}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CheckinLinkEmail,
  subject: 'Your weekly check-in is ready',
  displayName: 'Check-in link',
  previewData: {
    name: 'Claudia',
    link: 'https://rogersfeitosa.com.br/form/example',
    accessCode: '+1 (555) 123-4567',
    dueHours: '48h',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0f766e', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '30px 0 0' }
