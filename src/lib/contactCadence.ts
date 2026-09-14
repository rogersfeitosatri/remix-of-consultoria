/** Personal support cadence is separate from the athlete's form schedule. */
export function contactCycleDays(serviceType?: string | null): number {
  return serviceType === 'training' || serviceType === 'both' ? 7 : 14;
}
