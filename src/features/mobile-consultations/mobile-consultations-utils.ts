import type { ConsultationStatus } from '@/lib/types/consultation';

export function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i += 1) days.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) days.push(new Date(year, month, day));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function formatTime(time: string | null | undefined) {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
}

export function formatGrade(grade: string | null | undefined) {
  if (!grade) return '';
  const gradeNum = Number.parseInt(grade, 10);
  if (gradeNum >= 1 && gradeNum <= 3) return `고${gradeNum}`;
  if (grade === 'N') return 'N수생';
  return grade;
}

export function isFinishedStatus(status: ConsultationStatus) {
  return ['completed', 'cancelled', 'no_show'].includes(status);
}

export function getSelectedDateLabel(selectedDate: Date, today: Date) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${selectedDate.getMonth() + 1}/${selectedDate.getDate()} ${weekdays[selectedDate.getDay()]}`;
  if (toLocalDateStr(selectedDate) === toLocalDateStr(today)) return `오늘 (${dateLabel})`;
  return `${selectedDate.getFullYear()}. ${selectedDate.getMonth() + 1}. ${selectedDate.getDate()}. (${weekdays[selectedDate.getDay()]})`;
}
