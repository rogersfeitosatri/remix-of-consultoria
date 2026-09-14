import { describe, expect, it } from 'vitest';
import { ADMIN_NAVIGATION, getAdminArea, SECONDARY_TOOLS } from './adminNavigation';
import { contactCycleDays } from './contactCadence';

describe('five work areas', () => {
  it('keeps manual booking and response details in the correct area', () => {
    expect(ADMIN_NAVIGATION.map(item => item.label)).toEqual(['Hoje', 'Atletas', 'Check-ins', 'Consultas', 'Financeiro']);
    expect(getAdminArea('/appointments/example')).toBe('/calendar');
    expect(getAdminArea('/scheduling/periodicity')).toBe('/calendar');
    expect(getAdminArea('/checkin-review/example')).toBe('/checkin-hub');
    expect(getAdminArea('/clients/example/history')).toBe('/clients');
    expect(getAdminArea('/tasks')).toBe('/admin');
  });
  it('keeps secondary tools reachable and avoids matching unrelated prefixes', () => {
    expect(SECONDARY_TOOLS.some(item => item.to === '/meal-plans')).toBe(true);
    expect(SECONDARY_TOOLS.some(item => item.to === '/forms')).toBe(true);
    expect(getAdminArea('/scheduling-links')).toBe('/settings');
  });
  it('separates support cadence from check-in frequency', () => {
    expect(contactCycleDays('training')).toBe(7);
    expect(contactCycleDays('both')).toBe(7);
    expect(contactCycleDays('nutrition')).toBe(14);
  });
});
