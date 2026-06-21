'use client';

import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2 } from 'lucide-react';

interface StudentConsultation {
  id: number;
  student_id: number;
  consultation_date: string;
  consultation_type: string;
  admission_type: string;
  school_grade_avg: number | null;
  mock_test_scores: string | null;
  academic_memo: string | null;
  physical_record_type: string;
  physical_records: string | null;
  physical_memo: string | null;
  target_university_1: string | null;
  target_university_2: string | null;
  target_memo: string | null;
  general_memo: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  consultation: StudentConsultation | null;
  studentName: string;
  studentGrade?: string;
  academyName?: string;
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  regular: '정기상담',
  admission: '진학상담',
  parent: '학부모상담',
  counseling: '고민상담'
};

const SUBJECT_LABELS: Record<string, string> = {
  korean: '국어',
  math: '수학',
  english: '영어',
  exploration1: '탐구1',
  exploration2: '탐구2'
};

const MONTH_LABELS: Record<string, string> = {
  march: '3월',
  june: '6월',
  september: '9월'
};

// PDF용 인라인 스타일 (html2canvas 호환)
// 핵심: lineHeight를 픽셀 단위로 명시, 폰트 크기의 약 1.6~1.8배
const pdfStyles = {
  container: {
    width: '595px',
    padding: '28px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box' as const,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #1f2937',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#111827',
    margin: '0 0 4px 0',
    lineHeight: '32px',  // 22px * 1.45
    display: 'block',
  },
  subtitle: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
    lineHeight: '18px',  // 12px * 1.5
    display: 'block',
  },
  infoBox: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '20px',
    padding: '14px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  infoLabel: {
    width: '60px',
    fontSize: '11px',
    color: '#6b7280',
    lineHeight: '18px',  // 11px * 1.6
    display: 'inline-block',
    verticalAlign: 'top',
  },
  infoValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
    lineHeight: '20px',  // 13px * 1.5
    display: 'inline-block',
    verticalAlign: 'top',
  },
  infoValueSmall: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#111827',
    lineHeight: '18px',  // 12px * 1.5
    display: 'inline-block',
    verticalAlign: 'top',
  },
  section: {
    marginBottom: '18px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '10px',
    paddingBottom: '6px',
    borderBottom: '1px solid #e5e7eb',
    lineHeight: '22px',  // 14px * 1.57
  },
  colorBar: (color: string) => ({
    width: '4px',
    height: '16px',
    backgroundColor: color,
    borderRadius: '2px',
    flexShrink: 0,
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
  },
  th: {
    padding: '8px 6px',
    textAlign: 'center' as const,
    verticalAlign: 'middle' as const,
    fontWeight: '600',
    color: '#374151',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    lineHeight: '20px',  // 12px * 1.67
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  },
  td: {
    padding: '8px 6px',
    textAlign: 'center' as const,
    verticalAlign: 'middle' as const,
    border: '1px solid #e5e7eb',
    lineHeight: '20px',  // 12px * 1.67
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  card: {
    padding: '10px',
    backgroundColor: '#fff7ed',
    borderRadius: '6px',
    border: '1px solid #fed7aa',
  },
  cardLabel: {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '4px',
    lineHeight: '16px',  // 11px * 1.45
    display: 'block',
  },
  cardValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: '22px',  // 14px * 1.57
    display: 'block',
  },
  cardUnit: {
    fontSize: '11px',
    fontWeight: 'normal',
    color: '#6b7280',
    marginLeft: '2px',
  },
  universityBox: {
    display: 'flex',
    gap: '12px',
  },
  universityCard: (isPrimary: boolean) => ({
    flex: 1,
    padding: '12px',
    backgroundColor: isPrimary ? '#faf5ff' : '#f9fafb',
    borderRadius: '6px',
    border: `1px solid ${isPrimary ? '#e9d5ff' : '#e5e7eb'}`,
  }),
  universityLabel: (isPrimary: boolean) => ({
    fontSize: '11px',
    fontWeight: '500',
    color: isPrimary ? '#9333ea' : '#6b7280',
    marginBottom: '4px',
    lineHeight: '16px',  // 11px * 1.45
    display: 'block',
  }),
  universityName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    lineHeight: '22px',  // 14px * 1.57
    display: 'block',
  },
  memoBox: (color: string) => ({
    marginTop: '10px',
    padding: '10px',
    backgroundColor: color,
    borderRadius: '6px',
    fontSize: '12px',
    color: '#374151',
    lineHeight: '20px',  // 12px * 1.67
  }),
  contentBox: {
    padding: '14px',
    backgroundColor: '#f0fdf4',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
  },
  contentText: {
    fontSize: '12px',
    color: '#374151',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: '20px',  // 12px * 1.67
    margin: 0,
  },
  footer: {
    marginTop: '20px',
    paddingTop: '10px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '11px',
    color: '#9ca3af',
    margin: 0,
    lineHeight: '16px',  // 11px * 1.45
    display: 'block',
  },
};

export function ConsultationDetailModal({ open, onClose, consultation, studentName, studentGrade, academyName }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;

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
          // 복제된 DOM에서 폰트 렌더링 안정화
          const clonedElement = clonedDoc.body.querySelector('[data-pdf-content]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.transform = 'none';
            (clonedElement as HTMLElement).style.overflow = 'visible';
          }
        },
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      if (imgHeight > pageHeight - (margin * 2)) {
        finalHeight = pageHeight - (margin * 2);
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const x = (pageWidth - finalWidth) / 2;
      const y = margin;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

      const fileName = `상담기록_${studentName}_${consultation?.consultation_date || ''}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF 생성 실패:', error);
      alert('PDF 생성에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  if (!consultation) return null;

  const parseJSON = (val: string | null | object) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return null; }
  };

  const mockTestScores = parseJSON(consultation.mock_test_scores);
  const physicalRecords = parseJSON(consultation.physical_records);

  const calculateAverage = (scores: Record<string, string | number>) => {
    const values = Object.values(scores).filter(v => v && v !== '' && v !== '-').map(Number);
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  const hasPhysicalRecords = physicalRecords && Object.keys(physicalRecords).length > 0;
  const hasMockTestScores = mockTestScores && Object.keys(mockTestScores).length > 0;

  const getScoreColor = (score: number) => {
    if (score <= 3) return '#16a34a';
    if (score <= 5) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <DialogTitle>상담 기록 상세</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={downloading}
              >
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
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF 영역 - 인라인 스타일 사용 */}
        <div ref={printRef} data-pdf-content style={pdfStyles.container}>
          {/* 문서 헤더 */}
          <div style={pdfStyles.header}>
            <h1 style={pdfStyles.title}>상담 기록</h1>
            <p style={pdfStyles.subtitle}>{academyName || '학원'}</p>
          </div>

          {/* 기본 정보 */}
          <div style={pdfStyles.infoBox}>
            <div>
              <div style={pdfStyles.infoRow}>
                <span style={pdfStyles.infoLabel}>학생명</span>
                <span style={pdfStyles.infoValue}>
                  {studentName}
                  {studentGrade && <span style={{ ...pdfStyles.infoValueSmall, marginLeft: '4px', color: '#6b7280' }}>({studentGrade})</span>}
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
                <span style={pdfStyles.infoValueSmall}>
                  {consultation.admission_type === 'early' ? '수시' :
                   consultation.admission_type === 'regular' ? '정시' :
                   consultation.admission_type === 'both' ? '수시/정시' : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 학업 성적 섹션 */}
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

            {hasMockTestScores && (
              <table style={pdfStyles.table}>
                <thead>
                  <tr>
                    <th style={{ ...pdfStyles.th, width: '50px', textAlign: 'left' }}>월</th>
                    {Object.keys(SUBJECT_LABELS).map(subject => (
                      <th key={subject} style={pdfStyles.th}>
                        {SUBJECT_LABELS[subject]}
                      </th>
                    ))}
                    <th style={{ ...pdfStyles.th, backgroundColor: '#dbeafe' }}>평균</th>
                  </tr>
                </thead>
                <tbody>
                  {['march', 'june', 'september'].map((month) => {
                    const scores = mockTestScores[month] || {};
                    const hasScores = Object.values(scores).some((v: any) => v && v !== '');
                    const avg = hasScores ? calculateAverage(scores) : null;

                    return (
                      <tr key={month}>
                        <td style={{ ...pdfStyles.td, textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: '500' }}>
                          {MONTH_LABELS[month]}
                        </td>
                        {Object.keys(SUBJECT_LABELS).map(subject => (
                          <td key={subject} style={pdfStyles.td}>
                            {scores[subject] && scores[subject] !== '' ? (
                              <span style={{ fontWeight: '600', color: getScoreColor(Number(scores[subject])) }}>
                                {scores[subject]}
                              </span>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>-</span>
                            )}
                          </td>
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
            )}

            {consultation.academic_memo && (
              <div style={pdfStyles.memoBox('#dbeafe')}>
                {consultation.academic_memo}
              </div>
            )}
          </div>

          {/* 실기 기록 섹션 */}
          {hasPhysicalRecords && (
            <div style={pdfStyles.section}>
              <div style={pdfStyles.sectionHeader}>
                <span style={pdfStyles.colorBar('#f97316')}></span>
                <span>실기 기록</span>
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6b7280' }}>
                  ({consultation.physical_record_type === 'latest' ? '최근' : '평균'})
                </span>
              </div>

              <div style={pdfStyles.cardGrid}>
                {Object.entries(physicalRecords).slice(0, 8).map(([name, record]: [string, any]) => (
                  <div key={name} style={pdfStyles.card}>
                    <div style={pdfStyles.cardLabel}>{name}</div>
                    <div style={pdfStyles.cardValue}>
                      {record.value}
                      <span style={pdfStyles.cardUnit}>{record.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {consultation.physical_memo && (
                <div style={pdfStyles.memoBox('#ffedd5')}>
                  {consultation.physical_memo}
                </div>
              )}
            </div>
          )}

          {/* 목표 대학 섹션 */}
          {(consultation.target_university_1 || consultation.target_university_2) && (
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
          )}

          {/* 상담 내용 섹션 */}
          {consultation.general_memo && (
            <div style={pdfStyles.section}>
              <div style={pdfStyles.sectionHeader}>
                <span style={pdfStyles.colorBar('#22c55e')}></span>
                <span>상담 내용</span>
              </div>

              <div style={pdfStyles.contentBox}>
                <p style={pdfStyles.contentText}>
                  {consultation.general_memo}
                </p>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div style={pdfStyles.footer}>
            <p style={pdfStyles.footerText}>
              작성: {format(parseISO(consultation.created_at), 'yyyy.M.d HH:mm', { locale: ko })} | {academyName || '학원'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
