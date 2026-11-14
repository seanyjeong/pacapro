import { CheckCircle, FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface SalariesHeaderProps {
  exporting: boolean;
  pdfExporting: boolean;
  pdfProgress: { current: number; total: number };
  disableExport: boolean;
  bulkPaying: boolean;
  pendingCount: number;
  loading: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onBulkPay: () => void;
  onReload: () => void;
}

export function SalariesHeader({
  exporting,
  pdfExporting,
  pdfProgress,
  disableExport,
  bulkPaying,
  pendingCount,
  loading,
  onExportExcel,
  onExportPDF,
  onBulkPay,
  onReload,
}: SalariesHeaderProps) {
  return (
    <PageHeader
      title="급여 관리"
      description="강사 출근 기록으로 계산한 급여와 지급 상태를 확인해요."
      actions={(
        <>
          <Button type="button" variant="outline" onClick={onExportPDF} disabled={pdfExporting || disableExport}>
            <FileDown className="h-4 w-4" />
            {pdfExporting ? `${pdfProgress.current}/${pdfProgress.total}` : 'PDF'}
          </Button>
          <Button type="button" variant="outline" onClick={onExportExcel} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? '다운로드 중' : '엑셀'}
          </Button>
          <Button type="button" onClick={onBulkPay} disabled={bulkPaying || pendingCount === 0}>
            <CheckCircle className="h-4 w-4" />
            {bulkPaying ? '처리 중' : `모두 지급처리 (${pendingCount}건)`}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onReload} disabled={loading} aria-label="새로고침" title="새로고침">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        </>
      )}
    />
  );
}
