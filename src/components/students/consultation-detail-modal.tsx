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

export function ConsultationDetailModal({ open, onClose, consultation, studentName, studentGrade }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;

    try {
      setDownloading(true);

      // html2canvas로 캡처
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // 고해상도
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // A4 사이즈 설정 (mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // 여백

      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // 이미지가 한 페이지에 들어가도록 조정
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

      // 파일명 생성
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

  // 모의고사 평균 계산
  const calculateAverage = (scores: Record<string, string | number>) => {
    const values = Object.values(scores).filter(v => v && v !== '' && v !== '-').map(Number);
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  // 실기 기록이 있는지 확인
  const hasPhysicalRecords = physicalRecords && Object.keys(physicalRecords).length > 0;
  // 모의고사 점수가 있는지 확인
  const hasMockTestScores = mockTestScores && Object.keys(mockTestScores).length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* 헤더 */}
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

        {/* PDF 영역 - A4 비율에 맞게 컴팩트하게 */}
        <div
          ref={printRef}
          className="bg-white"
          style={{
            width: '595px', // A4 width at 72dpi
            padding: '24px',
            margin: '0 auto',
          }}
        >
          {/* 문서 헤더 */}
          <div className="text-center mb-4 pb-3 border-b-2 border-gray-800">
            <h1 className="text-xl font-bold text-gray-900 mb-0.5">상담 기록서</h1>
            <p className="text-xs text-gray-400">P-ACA 학원관리시스템</p>
          </div>

          {/* 기본 정보 - 컴팩트 */}
          <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-gray-50 rounded">
            <div className="space-y-1.5">
              <div className="flex items-baseline">
                <span className="w-16 text-gray-500 text-xs leading-none">학생명</span>
                <span className="font-semibold text-gray-900 text-sm leading-none">{studentName}</span>
                {studentGrade && <span className="ml-1 text-gray-500 text-xs leading-none">({studentGrade})</span>}
              </div>
              <div className="flex items-baseline">
                <span className="w-16 text-gray-500 text-xs leading-none">상담유형</span>
                <span className="font-medium text-gray-900 text-xs leading-none">
                  {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline">
                <span className="w-16 text-gray-500 text-xs leading-none">상담일</span>
                <span className="font-semibold text-gray-900 text-xs leading-none">
                  {format(parseISO(consultation.consultation_date), 'yyyy.M.d (EEE)', { locale: ko })}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="w-16 text-gray-500 text-xs leading-none">입시전형</span>
                <span className="font-medium text-gray-900 text-xs leading-none">
                  {consultation.admission_type === 'early' ? '수시' :
                   consultation.admission_type === 'regular' ? '정시' :
                   consultation.admission_type === 'both' ? '수시/정시' : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 학업 성적 섹션 */}
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b flex items-center gap-2 leading-tight">
              <span className="w-1 h-4 bg-blue-500 rounded flex-shrink-0"></span>
              <span>학업 성적</span>
              {consultation.school_grade_avg && (
                <span className="ml-auto text-xs font-normal text-gray-500 leading-tight">
                  내신 평균: <span className="text-blue-600 font-semibold">{consultation.school_grade_avg}등급</span>
                </span>
              )}
            </h2>

            {/* 모의고사 테이블 - 컴팩트 */}
            {hasMockTestScores && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-1.5 px-2 text-left font-semibold text-gray-700 border border-gray-200 w-12">월</th>
                    {Object.keys(SUBJECT_LABELS).map(subject => (
                      <th key={subject} className="py-1.5 px-2 text-center font-semibold text-gray-700 border border-gray-200">
                        {SUBJECT_LABELS[subject]}
                      </th>
                    ))}
                    <th className="py-1.5 px-2 text-center font-semibold text-gray-700 border border-gray-200 bg-blue-50">평균</th>
                  </tr>
                </thead>
                <tbody>
                  {['march', 'june', 'september'].map((month) => {
                    const scores = mockTestScores[month] || {};
                    const hasScores = Object.values(scores).some((v: any) => v && v !== '');
                    const avg = hasScores ? calculateAverage(scores) : null;

                    return (
                      <tr key={month}>
                        <td className="py-1.5 px-2 font-medium text-gray-700 border border-gray-200 bg-gray-50">
                          {MONTH_LABELS[month]}
                        </td>
                        {Object.keys(SUBJECT_LABELS).map(subject => (
                          <td key={subject} className="py-1.5 px-2 text-center border border-gray-200">
                            {scores[subject] && scores[subject] !== '' ? (
                              <span className={`font-semibold ${
                                Number(scores[subject]) <= 3 ? 'text-green-600' :
                                Number(scores[subject]) <= 5 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {scores[subject]}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        ))}
                        <td className="py-1.5 px-2 text-center border border-gray-200 bg-blue-50">
                          {avg ? (
                            <span className="font-bold text-blue-600">{avg}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {consultation.academic_memo && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-700">
                {consultation.academic_memo}
              </div>
            )}
          </div>

          {/* 실기 기록 섹션 */}
          {hasPhysicalRecords && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b flex items-center gap-2 leading-tight">
                <span className="w-1 h-4 bg-orange-500 rounded flex-shrink-0"></span>
                <span>실기 기록</span>
                <span className="text-xs font-normal text-gray-500 leading-tight">
                  ({consultation.physical_record_type === 'latest' ? '최근' : '평균'})
                </span>
              </h2>

              <div className="grid grid-cols-4 gap-2">
                {Object.entries(physicalRecords).slice(0, 8).map(([name, record]: [string, any]) => (
                  <div key={name} className="bg-orange-50 rounded p-2 border border-orange-100">
                    <div className="text-xs text-gray-500 truncate leading-tight">{name}</div>
                    <div className="text-sm font-bold text-gray-900 leading-tight">
                      {record.value}<span className="text-xs font-normal text-gray-500 ml-0.5">{record.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {consultation.physical_memo && (
                <div className="mt-2 p-2 bg-orange-50 rounded text-xs text-gray-700 leading-relaxed">
                  {consultation.physical_memo}
                </div>
              )}
            </div>
          )}

          {/* 목표 대학 섹션 */}
          {(consultation.target_university_1 || consultation.target_university_2) && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b flex items-center gap-2 leading-tight">
                <span className="w-1 h-4 bg-purple-500 rounded flex-shrink-0"></span>
                <span>목표 대학</span>
              </h2>

              <div className="flex gap-3">
                {consultation.target_university_1 && (
                  <div className="flex-1 p-2 bg-purple-50 rounded border border-purple-100">
                    <div className="text-xs text-purple-600 font-medium leading-tight">1지망</div>
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{consultation.target_university_1}</div>
                  </div>
                )}
                {consultation.target_university_2 && (
                  <div className="flex-1 p-2 bg-gray-50 rounded border border-gray-200">
                    <div className="text-xs text-gray-500 font-medium leading-tight">2지망</div>
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{consultation.target_university_2}</div>
                  </div>
                )}
              </div>

              {consultation.target_memo && (
                <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-gray-700 leading-relaxed">
                  {consultation.target_memo}
                </div>
              )}
            </div>
          )}

          {/* 상담 내용 섹션 */}
          {consultation.general_memo && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b flex items-center gap-2 leading-tight">
                <span className="w-1 h-4 bg-green-500 rounded flex-shrink-0"></span>
                <span>상담 내용</span>
              </h2>

              <div className="p-3 bg-green-50 rounded border border-green-100">
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {consultation.general_memo}
                </p>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div className="mt-4 pt-2 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              작성: {format(parseISO(consultation.created_at), 'yyyy.M.d HH:mm', { locale: ko })} | P-ACA
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
