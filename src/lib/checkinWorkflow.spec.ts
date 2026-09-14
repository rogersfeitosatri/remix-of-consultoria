import { describe, expect, it } from 'vitest';
import { checkinWorkflow } from './checkinWorkflow';

describe('check-in delivery obligation', () => {
  it('keeps draft and approved feedback in the work queue', () => {
    expect(checkinWorkflow({}, { status: 'pending', publication_status: 'draft' }).resolved).toBe(false);
    expect(checkinWorkflow({ review_status: 'reviewed' }, { status: 'approved', publication_status: 'approved' }).resolved).toBe(false);
  });
  it('does not mistake a legacy sent label for evidence of sending', () => {
    expect(checkinWorkflow({}, { status: 'sent', publication_status: 'not_published' }).resolved).toBe(false);
  });
  it('recognizes explicit closure without claiming delivery', () => {
    expect(checkinWorkflow({ review_status: 'closed', closed_reason: 'reviewed_without_feedback' }, { status: 'pending', publication_status: 'not_published' })).toMatchObject({ resolved: true, label: 'Encerrado sem feedback' });
  });
  it('accepts recorded sending or publication, including older confirmed deliveries', () => {
    expect(checkinWorkflow({}, { status: 'sent', sent_at: '2026-09-14T19:00:00Z', publication_status: 'draft' }).resolved).toBe(true);
    expect(checkinWorkflow({}, { publication_status: 'published', published_at: '2026-09-14T19:00:00Z' }).resolved).toBe(true);
    expect(checkinWorkflow({}, { publication_status: 'published' }).resolved).toBe(false);
  });
});
