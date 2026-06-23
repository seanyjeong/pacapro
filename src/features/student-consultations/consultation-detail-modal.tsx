'use client';

import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AlertCircle, Download, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { StudentConsultation } from './student-consultation-types';
import { consultationDetailPdfStyles as pdfStyles } from './consultation-detail-pdf-styles';
import { CONSULTATION_TYPE_LABELS, isRecord, parseJsonRecord } from './student-consultation-utils';

interface ConsultationDetailModalProps {
  open: boolean;
  onClose: () => void;
  consultation: StudentConsultation | null;
  studentName: string;
  studentGrade?: string;
  academyName?: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  korean: '국어',
  math: '수학',
  english: '영어',
  exploration1: '탐구1',
  exploration2: '탐구2',
};

const MONTH_LABELS: Record<string, string> = {
  march: '3월',
  june: '6월',
  september: '9월',
};

const MOCK_MONTHS = ['march', 'june', 'september'];

export function ConsultationDetailModal({
  open,
  onClose,
  consultation,
  studentName,
  studentGrade,
  academyName,
}: ConsultationDetailModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownloadPDF = async () => {
    setPdfError(null);

    if (!printRef.current) {
      setPdfError('PDF를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      setDownloading(true);
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowHeight: printRef.current.scrollHeight,
        height: printRef.current.scrollHeight,
        onclone: (clonedDoc: Document) => {
          const clonedElement = clonedDoc.body.querySelector('[data-pdf-content]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.transform = 'none';
            (clonedElement as HTMLElement).style.overflow = 'visible';
          }
        },
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const fitsInPage = imgHeight <= pageHeight - margin * 2;
      const finalHeight = fitsInPage ? imgHeight : pageHeight - margin * 2;
      const finalWidth = fitsInPage ? imgWidth : (canvas.width * finalHeight) / canvas.height;
      const x = (pageWidth - finalWidth) / 2;
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', x, margin, finalWidth, finalHeight);
      pdf.save(`상담기록_${studentName}_${consultation?.consultation_date || ''}.pdf`);
    } catch {
      setPdfError('PDF를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDownloading(false);
    }
  };

  if (!consultation) return null;

  const handleClose = () => {
    setPdfError(null);
    onClose();
  };

  const mockTestScores = parseJsonRecord(consultation.mock_test_scores);
  const physicalRecords = parseJsonRecord(consultation.physical_records);
  const hasPhysicalRecords = physicalRecords && Object.keys(physicalRecords).length > 0;
  const hasMockTestScores = mockTestScores && Object.keys(mockTestScores).length > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) handleClose();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <DialogTitle>상담 기록 상세</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloading}>
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    PDF 저장
                  </>
                )}
              </Button>
              <Button aria-label="상담 상세 닫기" variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {pdfError ? (
          <div role="alert" className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">{pdfError}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto pb-4">
          <div ref={printRef} data-pdf-content style={pdfStyles.container}>
            <ConsultationPdfHeader academyName={academyName} />
            <ConsultationInfoBox consultation={consultation} studentName={studentName} studentGrade={studentGrade} />
            <AcademicSection consultation={consultation} mockTestScores={mockTestScores} hasMockTestScores={!!hasMockTestScores} />
            <PhysicalSection consultation={consultation} physicalRecords={physicalRecords} hasPhysicalRecords={!!hasPhysicalRecords} />
            <TargetUniversitySection consultation={consultation} />
            <GeneralMemoSection memo={consultation.general_memo} />
            <ConsultationFooter consultation={consultation} academyName={academyName} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsultationPdfHeader({ academyName }: { academyName?: string }) {
  return (
    <div style={pdfStyles.header}>
      <h1 style={pdfStyles.title}>상담 기록</h1>
      <p style={pdfStyles.subtitle}>{academyName || '학원'}</p>
    </div>
  );
}

function ConsultationInfoBox({
  consultation,
  studentName,
  studentGrade,
}: {
  consultation: StudentConsultation;
  studentName: string;
  studentGrade?: string;
}) {
  return (
    <div style={pdfStyles.infoBox}>
      <div>
        <div style={pdfStyles.infoRow}>
          <span style={pdfStyles.infoLabel}>학생명</span>
          <span style={pdfStyles.infoValue}>
            {studentName}
            {studentGrade && (
              <span style={{ ...pdfStyles.infoValueSmall, marginLeft: '4px', color: '#6b7280' }}>
                ({studentGrade})
              </span>
            )}
          </span>
        </div>
        <div style={pdfStyles.infoRow}>
          <span style={pdfStyles.infoLabel}>상담유형</span>
          <span style={pdfStyles.infoValueSmall}>
            {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
          </span>
        </div>
      </div>
      <div>
        <div style={pdfStyles.infoRow}>
          <span style={pdfStyles.infoLabel}>상담일</span>
          <span style={pdfStyles.infoValueSmall}>
            {format(parseISO(consultation.consultation_date), 'yyyy.M.d (EEE)', { locale: ko })}
          </span>
        </div>
        <div style={pdfStyles.infoRow}>
          <span style={pdfStyles.infoLabel}>입시전형</span>
          <span style={pdfStyles.infoValueSmall}>{getAdmissionTypeLabel(consultation.admission_type)}</span>
        </div>
      </div>
    </div>
  );
}

function AcademicSection({
  consultation,
  mockTestScores,
  hasMockTestScores,
}: {
  consultation: StudentConsultation;
  mockTestScores: Record<string, unknown> | null;
  hasMockTestScores: boolean;
}) {
  return (
    <div style={pdfStyles.section}>
      <div style={pdfStyles.sectionHeader}>
        <span style={pdfStyles.colorBar('#3b82f6')}></span>
        <span>학업 성적</span>
        {consultation.school_grade_avg && (
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 'normal', color: '#6b7280' }}>
            내신 평균: <span style={{ color: '#2563eb', fontWeight: '600' }}>{consultation.school_grade_avg}등급</span>
          </span>
        )}
      </div>

      {hasMockTestScores && mockTestScores && <MockScoreTable mockTestScores={mockTestScores} />}

      {consultation.academic_memo && (
        <div style={pdfStyles.memoBox('#dbeafe')}>
          {consultation.academic_memo}
        </div>
      )}
    </div>
  );
}

function MockScoreTable({ mockTestScores }: { mockTestScores: Record<string, unknown> }) {
  return (
    <table style={pdfStyles.table}>
      <thead>
        <tr>
          <th style={{ ...pdfStyles.th, width: '50px', textAlign: 'left' }}>월</th>
          {Object.keys(SUBJECT_LABELS).map((subject) => (
            <th key={subject} style={pdfStyles.th}>
              {SUBJECT_LABELS[subject]}
            </th>
          ))}
          <th style={{ ...pdfStyles.th, backgroundColor: '#dbeafe' }}>평균</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_MONTHS.map((month) => {
          const scores = getMonthScores(mockTestScores, month);
          const avg = hasScoreValues(scores) ? calculateAverage(scores) : null;

          return (
            <tr key={month}>
              <td style={{ ...pdfStyles.td, textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: '500' }}>
                {MONTH_LABELS[month]}
              </td>
              {Object.keys(SUBJECT_LABELS).map((subject) => (
                <MockScoreCell key={subject} score={scores[subject]} />
              ))}
              <td style={{ ...pdfStyles.td, backgroundColor: '#dbeafe' }}>
                {avg ? (
                  <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{avg}</span>
                ) : (
                  <span style={{ color: '#d1d5db' }}>-</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MockScoreCell({ score }: { score: unknown }) {
  const numericScore = toNumericScore(score);

  return (
    <td style={pdfStyles.td}>
      {numericScore !== null ? (
        <span style={{ fontWeight: '600', color: getScoreColor(numericScore) }}>
          {String(score)}
        </span>
      ) : (
        <span style={{ color: '#d1d5db' }}>-</span>
      )}
    </td>
  );
}

function PhysicalSection({
  consultation,
  physicalRecords,
  hasPhysicalRecords,
}: {
  consultation: StudentConsultation;
  physicalRecords: Record<string, unknown> | null;
  hasPhysicalRecords: boolean;
}) {
  if (!hasPhysicalRecords || !physicalRecords) return null;

  return (
    <div style={pdfStyles.section}>
      <div style={pdfStyles.sectionHeader}>
        <span style={pdfStyles.colorBar('#f97316')}></span>
        <span>실기 기록</span>
        <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6b7280' }}>
          ({consultation.physical_record_type === 'latest' ? '최근' : '평균'})
        </span>
      </div>

      <div style={pdfStyles.cardGrid}>
        {Object.entries(physicalRecords).slice(0, 8).map(([name, record]) => (
          <PhysicalRecordCard key={name} name={name} record={record} />
        ))}
      </div>

      {consultation.physical_memo && (
        <div style={pdfStyles.memoBox('#ffedd5')}>
          {consultation.physical_memo}
        </div>
      )}
    </div>
  );
}

function PhysicalRecordCard({ name, record }: { name: string; record: unknown }) {
  const value = isRecord(record) ? record.value : null;
  const unit = isRecord(record) ? record.unit : null;

  return (
    <div style={pdfStyles.card}>
      <div style={pdfStyles.cardLabel}>{name}</div>
      <div style={pdfStyles.cardValue}>
        {formatUnknown(value)}
        <span style={pdfStyles.cardUnit}>{formatUnknown(unit)}</span>
      </div>
    </div>
  );
}

function TargetUniversitySection({ consultation }: { consultation: StudentConsultation }) {
  if (!consultation.target_university_1 && !consultation.target_university_2) return null;

  return (
    <div style={pdfStyles.section}>
      <div style={pdfStyles.sectionHeader}>
        <span style={pdfStyles.colorBar('#a855f7')}></span>
        <span>목표 대학</span>
      </div>

      <div style={pdfStyles.universityBox}>
        {consultation.target_university_1 && (
          <div style={pdfStyles.universityCard(true)}>
            <div style={pdfStyles.universityLabel(true)}>1지망</div>
            <div style={pdfStyles.universityName}>{consultation.target_university_1}</div>
          </div>
        )}
        {consultation.target_university_2 && (
          <div style={pdfStyles.universityCard(false)}>
            <div style={pdfStyles.universityLabel(false)}>2지망</div>
            <div style={pdfStyles.universityName}>{consultation.target_university_2}</div>
          </div>
        )}
      </div>

      {consultation.target_memo && (
        <div style={pdfStyles.memoBox('#f3e8ff')}>
          {consultation.target_memo}
        </div>
      )}
    </div>
  );
}

function GeneralMemoSection({ memo }: { memo: string | null }) {
  if (!memo) return null;

  return (
    <div style={pdfStyles.section}>
      <div style={pdfStyles.sectionHeader}>
        <span style={pdfStyles.colorBar('#22c55e')}></span>
        <span>상담 내용</span>
      </div>

      <div style={pdfStyles.contentBox}>
        <p style={pdfStyles.contentText}>{memo}</p>
      </div>
    </div>
  );
}

function ConsultationFooter({
  consultation,
  academyName,
}: {
  consultation: StudentConsultation;
  academyName?: string;
}) {
  return (
    <div style={pdfStyles.footer}>
      <p style={pdfStyles.footerText}>
        작성: {format(parseISO(consultation.created_at), 'yyyy.M.d HH:mm', { locale: ko })} | {academyName || '학원'}
      </p>
    </div>
  );
}

function getAdmissionTypeLabel(admissionType: string) {
  if (admissionType === 'early') return '수시';
  if (admissionType === 'regular') return '정시';
  if (admissionType === 'both') return '수시/정시';
  return '-';
}

function getMonthScores(mockTestScores: Record<string, unknown>, month: string) {
  const scores = mockTestScores[month];
  return isRecord(scores) ? scores : {};
}

function hasScoreValues(scores: Record<string, unknown>) {
  return Object.values(scores).some((value) => toNumericScore(value) !== null);
}

function calculateAverage(scores: Record<string, unknown>) {
  const values = Object.values(scores)
    .map(toNumericScore)
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function toNumericScore(score: unknown) {
  if (score === null || score === undefined || score === '' || score === '-') return null;
  const numericScore = Number(score);
  return Number.isNaN(numericScore) ? null : numericScore;
}

function getScoreColor(score: number) {
  if (score <= 3) return '#16a34a';
  if (score <= 5) return '#ca8a04';
  return '#dc2626';
}

function formatUnknown(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}
