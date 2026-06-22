import { FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalariesHeaderProps {
  exporting: boolean;
  pdfExporting: boolean;
  pdfProgress: { current: number; total: number };
  disableExport: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onReload: () => void;
}

export function SalariesHeader({
  exporting,
  pdfExporting,
  pdfProgress,
  disableExport,
  onExportExcel,
  onExportPDF,
  onReload,
}: SalariesHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">급여 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">강사 출근 기록 기반 급여와 지급 상태를 확인합니다.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onExportPDF} disabled={pdfExporting || disableExport}>
          {pdfExporting ? `${pdfProgress.current}/${pdfProgress.total}` : <FileDown className="mr-2 h-4 w-4" />}
          PDF
        </Button>
        <Button type="button" variant="outline" onClick={onExportExcel} disabled={exporting}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {exporting ? '다운로드 중' : '엑셀'}
        </Button>
        <Button type="button" variant="outline" onClick={onReload}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>
    </header>
  );
}
