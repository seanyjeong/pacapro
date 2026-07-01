'use client';

import { MessageCircle, UserRound } from 'lucide-react';
import { ConsultationButton } from '@/lib/api/notifications';

interface Props {
  academyName: string;
  templateContent: string;
  imageUrl?: string;
  buttons?: ConsultationButton[];
  replacements: Record<string, string>;
  timeLabel?: string;
}

export default function AlimtalkPreview({
  academyName,
  templateContent,
  imageUrl,
  buttons,
  replacements,
  timeLabel = '오전 9:00',
}: Props) {
  if (!templateContent) return null;

  const preview = buildPreview(templateContent, replacements);

  return (
    <div className="md:col-span-2">
      <p className="mb-2 text-sm font-medium text-foreground">미리보기</p>
      <section
        className="mx-auto max-w-sm rounded-md border border-slate-200 bg-slate-50 p-4 shadow-none dark:border-slate-800 dark:bg-slate-950/40"
        data-testid="alimtalk-preview-card"
        aria-label="알림톡 미리보기"
      >
        <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-100 text-yellow-800">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">알림톡</span>
        </div>

        <div className="flex gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 truncate text-xs text-slate-500">{academyName}</p>
            <div className="rounded-md rounded-tl-sm border border-slate-200 bg-white p-3 shadow-none dark:border-slate-800 dark:bg-slate-900">
              {imageUrl ? (
                <div
                  role="img"
                  aria-label="알림톡 이미지"
                  className="mb-2 h-32 rounded-md bg-slate-100 bg-cover bg-center dark:bg-slate-800"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100">{preview}</p>
              {buttons && buttons.length > 0 ? (
                <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-800">
                  {buttons.map((button, index) => (
                    <div
                      key={`${button.buttonName || 'button'}-${index}`}
                      className="rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-medium text-blue-700 dark:bg-slate-800 dark:text-blue-300"
                    >
                      {button.buttonName || '버튼'}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">{timeLabel}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildPreview(templateContent: string, replacements: Record<string, string>) {
  const preview = Object.entries(replacements).reduce((content, [key, value]) => {
    const escapedKey = key.replace(/[{}#]/g, (character) => `\\${character}`);
    return content.replace(new RegExp(escapedKey, 'g'), value);
  }, templateContent);

  return normalizeAttendanceDatePreview(preview, replacements);
}

function normalizeAttendanceDatePreview(content: string, replacements: Record<string, string>) {
  const month = trimKoreanDateUnit(replacements['#{월}'], '월');
  const day = trimKoreanDateUnit(replacements['#{일}'], '일');
  const weekday = trimWeekdayUnit(replacements['#{요일}']);

  if (!month || !day || !weekday) return content;

  const fullDate = `${month}월 ${day}일 ${weekday}요일`;
  const monthPattern = `${escapeRegExp(month)}(?:\\s*월)*`;
  const dayPattern = `${escapeRegExp(day)}(?:\\s*일)*`;
  const weekdayPattern = `${escapeRegExp(weekday)}(?:\\s*요일)*`;
  const splitDatePattern = new RegExp(`${monthPattern}\\s*${dayPattern}\\s*${weekdayPattern}`, 'g');

  return content.replace(splitDatePattern, fullDate);
}

function trimKoreanDateUnit(value: string | undefined, unit: '월' | '일') {
  return (value || '').trim().replace(new RegExp(`(?:\\s*${unit})+$`), '').trim();
}

function trimWeekdayUnit(value: string | undefined) {
  return (value || '').trim().replace(/(?:\s*요일)+$/, '').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
