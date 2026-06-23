import Link from 'next/link';
import { Banknote, Download, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportComputedStats, ReportExportType, ReportStats } from './reports-types';
import { formatReportAmount, getCurrentYearMonth } from './reports-utils';

interface ReportsOperationsBoardProps {
  computed: ReportComputedStats;
  exportingType: ReportExportType | null;
  selectedMonth: string;
  stats: ReportStats;
  onExport: (type: ReportExportType) => void;
  onMonthChange: (value: string) => void;
}

const EXPORT_ACTIONS: Array<{ type: ReportExportType; label: string; shortLabel: string; icon: typeof TrendingUp }> = [
  { type: 'revenue', label: '수입 내역 다운로드', shortLabel: '수입', icon: TrendingUp },
  { type: 'expenses', label: '지출 내역 다운로드', shortLabel: '지출', icon: TrendingDown },
  { type: 'payments', label: '납부 내역 다운로드', shortLabel: '납부', icon: Banknote },
  { type: 'financial', label: '연간 재무 리포트 다운로드', shortLabel: '연간', icon: Download },
];

export function ReportsOperationsBoard({
  computed,
  exportingType,
  selectedMonth,
  stats,
  onExport,
  onMonthChange,
}: ReportsOperationsBoardProps) {
  const profitPrefix = computed.netProfit >= 0 ? '+' : '';
  const quickLinks = [
    { label: '미수납 관리', meta: `${stats.payments.unpaid}건`, href: '/payments?payment_status=pending', icon: Banknote },
    { label: '수입 내역', meta: `기타 ${stats.otherIncomes.total}건`, href: '/incomes', icon: TrendingUp },
    { label: '지출 내역', meta: `${stats.expenses.total}건`, href: '/expenses', icon: TrendingDown },
    { label: '학생 관리', meta: `재원생 ${stats.students.active}명`, href: '/students', icon: Users },
  ];

  return (
    <aside
      aria-label="리포트 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="reports-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">리포트 작업 보드</h2>
        <p className="text-sm text-slate-600">월별 손익, 미수납, 다운로드를 한곳에서 처리합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="순이익" testId="reports-metric-net-profit" value={`${profitPrefix}${formatReportAmount(computed.netProfit)}원`} />
        <Metric label="수납률" testId="reports-metric-collection" value={`${computed.collectionRate}%`} />
        <Metric label="미수납" testId="reports-metric-unpaid" value={`${formatReportAmount(computed.unpaidAmount)}원`} />
        <Metric label="운영 인원" testId="reports-metric-people" value={`${stats.students.active}명 / ${stats.instructors.active}명`} />
      </div>

      <div className="space-y-2">
        <input
          aria-label="작업 보드 리포트 조회 월"
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-500/20"
          type="month"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
        />
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={() => onMonthChange(getCurrentYearMonth())}>
          <RefreshCw className="h-4 w-4" />
          이번 달
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {EXPORT_ACTIONS.map((action) => {
          const Icon = action.icon;
          const exporting = exportingType === action.type;
          return (
            <Button
              key={action.type}
              aria-label={action.label}
              className="w-full justify-center gap-2"
              disabled={exportingType !== null}
              type="button"
              variant="outline"
              onClick={() => onExport(action.type)}
            >
              <Icon className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
              {exporting ? '진행 중' : action.shortLabel}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              className="flex min-h-16 flex-col justify-between rounded-md border border-slate-200 bg-slate-50 p-3 text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
              href={link.href}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate font-medium text-slate-950">{link.label}</span>
              </span>
              <span className="text-xs text-slate-600">{link.meta}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function Metric({ label, testId, value }: { label: string; testId: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
