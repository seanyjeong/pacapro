import { Banknote, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import type { ReportExportType } from './reports-types';
import { getCurrentYearMonth, shiftReportMonth } from './reports-utils';

interface ReportsHeaderProps {
  selectedMonth: string;
  exportMenuOpen: boolean;
  exportingType: ReportExportType | null;
  onMonthChange: (value: string) => void;
  onExportMenuChange: (open: boolean) => void;
  onExport: (type: ReportExportType) => void;
}

const EXPORT_OPTIONS: Array<{ type: ReportExportType; label: string; icon: typeof TrendingUp; tone: string }> = [
  { type: 'revenue', label: '수입 내역', icon: TrendingUp, tone: 'bg-success-soft text-success' },
  { type: 'expenses', label: '지출 내역', icon: TrendingDown, tone: 'bg-destructive-soft text-destructive' },
  { type: 'payments', label: '납부 내역', icon: Banknote, tone: 'bg-primary-soft text-primary' },
  { type: 'financial', label: '연간 재무 리포트', icon: Download, tone: 'bg-muted text-secondary-foreground' },
];

export const REPORT_MONTH_INPUT_CLASS =
  'h-11 min-w-0 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10';

export function formatReportMonthLabel(selectedMonth: string) {
  const [year, month] = selectedMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}

export function ReportsHeader({
  selectedMonth,
  exportMenuOpen,
  exportingType,
  onMonthChange,
  onExportMenuChange,
  onExport,
}: ReportsHeaderProps) {
  const isExporting = exportingType !== null;

  return (
    <PageHeader
      title="리포트"
      description={`${formatReportMonthLabel(selectedMonth)} 손익과 수납 현황이에요.`}
      actions={(
        <>
          <div className="flex w-full items-center gap-1 sm:w-auto" role="group" aria-label="리포트 월 이동">
            <Button
              aria-label="이전 달"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => onMonthChange(shiftReportMonth(selectedMonth, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <label className="sr-only" htmlFor="report-month">
              조회 월
            </label>
            <input
              id="report-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => onMonthChange(event.target.value)}
              className={`${REPORT_MONTH_INPUT_CLASS} flex-1 sm:w-40 sm:flex-none`}
            />
            <Button
              aria-label="다음 달"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => onMonthChange(shiftReportMonth(selectedMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => onMonthChange(getCurrentYearMonth())}>
            이번 달
          </Button>

          <div className="relative">
            <Button
              aria-expanded={exportMenuOpen}
              disabled={isExporting}
              type="button"
              onClick={() => onExportMenuChange(!exportMenuOpen)}
            >
              {isExporting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              엑셀 다운로드
              <ChevronDown className="h-4 w-4" />
            </Button>

            {exportMenuOpen ? (
              <>
                <button
                  aria-label="다운로드 메뉴 닫기"
                  className="fixed inset-0 z-10 cursor-default"
                  type="button"
                  onClick={() => onExportMenuChange(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-border/60 bg-card p-1.5 shadow-lg">
                  {EXPORT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const label = option.type === 'financial' ? `${selectedMonth.slice(0, 4)}년 ${option.label}` : option.label;
                    return (
                      <button
                        key={option.type}
                        aria-label={`${option.label} 다운로드`}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-foreground hover:bg-muted"
                        type="button"
                        onClick={() => onExport(option.type)}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${option.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    />
  );
}
