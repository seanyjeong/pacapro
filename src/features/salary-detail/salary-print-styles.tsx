export function SalaryPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-container {
          max-width: 100% !important;
          padding: 0 !important;
        }
        .print-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-compact {
          padding: 4px 8px !important;
          font-size: 11px !important;
        }
        .print-table td,
        .print-table th {
          padding: 2px 6px !important;
          font-size: 10px !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `}</style>
  );
}
