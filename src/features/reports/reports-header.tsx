import { Banknote, ChevronDown, Download, FileSpreadsheet, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportExportType } from './reports-types';

interface ReportsHeaderProps {
  selectedMonth: string;
  exportMenuOpen: boolean;
  exportingType: ReportExportType | null;
  onMonthChange: (value: string) => void;
  onExportMenuChange: (open: boolean) => void;
  onExport: (type: ReportExportType) => void;
}

const EXPORT_OPTIONS: Array<{ type: ReportExportType; label: string; icon: typeof TrendingUp; tone: string }> = [
  { type: 'revenue', label: '수입 내역', icon: TrendingUp, tone: 'text-emerald-600' },
  { type: 'expenses', label: '지출 내역', icon: TrendingDown, tone: 'text-rose-600' },
  { type: 'payments', label: '납부 내역', icon: Banknote, tone: 'text-sky-600' },
  { type: 'financial', label: '연간 재무 리포트', icon: Download, tone: 'text-slate-700' },
];

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
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Report</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">리포트</h1>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="report-month">
          조회 월
        </label>
        <input
          id="report-month"
          type="month"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
        />

        <div className="relative">
          <Button
            aria-expanded={exportMenuOpen}
            className="w-full justify-center sm:w-auto"
            disabled={isExporting}
            type="button"
            variant="outline"
            onClick={() => onExportMenuChange(!exportMenuOpen)}
          >
            {isExporting ? (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            엑셀 다운로드
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>

          {exportMenuOpen ? (
            <>
              <button
                aria-label="다운로드 메뉴 닫기"
                className="fixed inset-0 z-10 cursor-default"
                type="button"
                onClick={() => onExportMenuChange(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-card py-1 shadow-sm">
                {EXPORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.type}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                      type="button"
                      onClick={() => onExport(option.type)}
                    >
                      <Icon className={`h-4 w-4 ${option.tone}`} />
                      {option.type === 'financial' ? `${selectedMonth.slice(0, 4)}년 ${option.label}` : option.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
