import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('says how long ago a past time was', () => {
    expect(formatDate('2026-10-26T11:30:00Z')).toBe("לפני 30 דק'");
    expect(formatDate('2026-10-26T07:00:00Z')).toBe("לפני 5 שע'");
    expect(formatDate('2026-10-23T12:00:00Z')).toBe('לפני 3 ימים');
  });

  it('says how long until a future time, such as a vote that closes later', () => {
    expect(formatDate('2026-10-26T12:45:00Z')).toBe("בעוד 45 דק'");
    expect(formatDate('2026-10-26T20:00:00Z')).toBe("בעוד 8 שע'");
    expect(formatDate('2026-10-29T12:00:00Z')).toBe('בעוד 3 ימים');
  });
});
