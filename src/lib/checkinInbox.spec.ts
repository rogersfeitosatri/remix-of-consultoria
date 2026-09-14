import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, operations, result } = vi.hoisted(() => ({
  from: vi.fn(),
  operations: [] as Array<{ table: string; name: string; args: unknown[] }>,
  result: { resolve: (_table: string, _offset: number): unknown => ({ data: [], error: null }) },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { fetchCheckinPage, fetchOpenCheckins } from './checkinInbox';

const row = (id: string, frozen = false) => ({
  id, client_id: `client-${id}`, submitted_at: '2026-09-14T12:00:00Z',
  review_status: 'received', closed_reason: null, checkin_forms: null,
  clients: { id: `client-${id}`, name: id, is_active: true, is_frozen: frozen, end_date: null },
});

beforeEach(() => {
  operations.length = 0;
  from.mockImplementation((table: string) => {
    let offset = 0;
    const builder: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'range', 'or', 'ilike', 'in']) {
      builder[name] = (...args: unknown[]) => {
        operations.push({ table, name, args });
        if (name === 'range') offset = args[0] as number;
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => void) => Promise.resolve(result.resolve(table, offset)).then(resolve);
    return builder;
  });
});

describe('check-in inbox data contract', () => {
  it('keeps an approved draft and an older obligation beyond the first 500 rows, excluding frozen and delivered responses', async () => {
    result.resolve = (table, offset) => ({ data: table === 'checkin_feedbacks'
      ? [{ checkin_response_id: 'draft', status: 'approved', publication_status: 'approved' }, { checkin_response_id: 'delivered', status: 'sent', sent_at: '2026-09-14T13:00:00Z' }]
      : offset === 0 ? [row('draft'), row('delivered'), ...Array.from({ length: 498 }, (_, i) => row(`frozen-${i}`, true))] : [row('older')], error: null });
    expect((await fetchOpenCheckins('owner-1')).map(r => r.id)).toEqual(['draft', 'older']);
    expect(operations.filter(op => op.name === 'range').map(op => op.args)).toEqual([[0, 499], [500, 999]]);
    expect(operations.filter(op => op.table === 'checkin_responses' && op.name === 'eq').every(op => op.args[0] === 'clients.user_id' && op.args[1] === 'owner-1')).toBe(true);
  });

  it('does not convert a failed feedback lookup into an empty or invented pending state', async () => {
    result.resolve = table => table === 'checkin_feedbacks' ? { data: null, error: new Error('lookup failed') } : { data: [row('one')], error: null };
    await expect(fetchOpenCheckins('owner-1')).rejects.toThrow('lookup failed');
  });

  it('scopes athlete history on the server while retaining resolved responses', async () => {
    result.resolve = () => ({ data: [], error: null });
    await fetchCheckinPage('owner-1', 50, 50, false, 'athlete-1', 'Ana');
    expect(operations).toContainEqual({ table: 'checkin_responses', name: 'eq', args: ['client_id', 'athlete-1'] });
    expect(operations).toContainEqual({ table: 'checkin_responses', name: 'ilike', args: ['clients.name', '%Ana%'] });
    expect(operations.some(op => op.name === 'or')).toBe(false);
  });
});
