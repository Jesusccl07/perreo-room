// 00:00 del 4 dic 2026 (hora de Madrid) = 23:00Z del 3 dic
export const TARGET = Date.parse('2026-12-03T23:00:00Z');

export function getRemaining(now, target = TARGET) {
  const diff = target - now;
  if (!Number.isFinite(diff) || diff <= 0) {
    return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const total = Math.floor(diff / 1000);
  return {
    done: false,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
