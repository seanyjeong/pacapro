export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthDateRange(month: string): { start_date: string; end_date: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  return { start_date: `${month}-01`, end_date: localDateKey(new Date(year, monthNumber, 0)) };
}

export function moveMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return localDateKey(new Date(year, monthNumber - 1 + offset, 1)).slice(0, 7);
}

export function monthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const days = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((firstDay + days) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= days ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long',
  });
}
