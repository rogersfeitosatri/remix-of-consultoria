/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as checkinLink } from './checkin-link.tsx'
import { template as bookingLink } from './booking-link.tsx'
import { template as consultationReminder } from './consultation-reminder.tsx'
import { template as consultationConfirmation } from './consultation-confirmation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'checkin-link': checkinLink,
  'booking-link': bookingLink,
  'consultation-reminder': consultationReminder,
  'consultation-confirmation': consultationConfirmation,
}
