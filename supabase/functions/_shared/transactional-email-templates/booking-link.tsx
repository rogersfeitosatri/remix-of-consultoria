import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rogers Feitosa Sports Nutrition'

interface BookingLinkProps {
  name?: string
  link?: string
  isFollowup?: boolean
}

const BookingLinkEmail = ({ name, link, isFollowup }: BookingLinkProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{isFollowup ? 'Schedule your next consultation' : 'Schedule your consultation'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Hi ${name},` : 'Hi there,'}</Heading>
        <Text style={text}>
          {isFollowup
            ? 'It is time to schedule your next consultation. Please pick a time slot that works best for you.'
            : 'Welcome! Please pick a time slot to schedule your consultation.'}
        </Text>
        {link && (
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button style={button} href={link}>
              Schedule my consultation
            </Button>
          </Section>
        )}
        <Text style={text}>
          If the button does not work, copy and paste this link into your browser:
          <br />
          <span style={{ wordBreak: 'break-all', color: '#0f766e' }}>{link}</span>
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingLinkEmail,
  subject: (data: Record<string, any>) =>
    data?.isFollowup ? 'Schedule your next consultation' : 'Schedule your consultation',
  displayName: 'Booking link',
  previewData: {
    name: 'Claudia',
    link: 'https://rogersfeitosa.com.br/booking/example',
    isFollowup: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0f766e', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '30px 0 0' }
