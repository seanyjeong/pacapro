const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatTabletClassDays(value: unknown): string {
  const days = parseClassDays(value);
  if (days.length === 0) return '-';
  return days.map((item) => DAY_LABELS[item.day] || '-').join(', ');
}

export function formatTabletWon(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0원';
  return `${amount.toLocaleString()}원`;
}

export function formatTabletPhone(value: string | null | undefined): string {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

function parseClassDays(value: unknown): Array<{ day: number }> {
  if (!value) return [];
  const source = typeof value === 'string' ? parseJsonArray(value) : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => (typeof item === 'number' ? { day: item } : { day: Number(item?.day) }))
    .filter((item) => Number.isInteger(item.day) && item.day >= 0 && item.day <= 6);
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
