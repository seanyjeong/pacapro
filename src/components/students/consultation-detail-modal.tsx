'use client';

import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

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

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `상담기록_${studentName}_${consultation?.consultation_date || ''}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* 헤더 (프린트 시 숨김) */}
        <DialogHeader className="p-4 border-b print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle>상담 기록 상세</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePrint()}>
                <Download className="h-4 w-4 mr-2" />
                PDF 저장
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 프린트 영역 */}
        <div ref={printRef} className="p-6 bg-white">
          {/* 문서 헤더 */}
          <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">상담 기록서</h1>
            <p className="text-sm text-gray-500">P-ACA 학원관리시스템</p>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <div className="flex">
                <span className="w-20 text-gray-500 text-sm">학생명</span>
                <span className="font-semibold text-gray-900">{studentName}</span>
                {studentGrade && <span className="ml-2 text-gray-500">({studentGrade})</span>}
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 text-sm">상담유형</span>
                <span className="font-medium text-gray-900">
                  {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex">
                <span className="w-20 text-gray-500 text-sm">상담일</span>
                <span className="font-semibold text-gray-900">
                  {format(parseISO(consultation.consultation_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </span>
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 text-sm">입시전형</span>
                <span className="font-medium text-gray-900">
                  {consultation.admission_type === 'early' ? '수시' :
                   consultation.admission_type === 'regular' ? '정시' :
                   consultation.admission_type === 'both' ? '수시/정시' : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 학업 성적 섹션 */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded"></span>
              학업 성적
            </h2>

            {/* 내신 */}
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-500">내신 평균</span>
                <span className="text-xl font-bold text-blue-600">
                  {consultation.school_grade_avg ? `${consultation.school_grade_avg}등급` : '-'}
                </span>
              </div>
            </div>

            {/* 모의고사 테이블 */}
            {mockTestScores && Object.keys(mockTestScores).length > 0 && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-3 text-left font-semibold text-gray-700 w-16">월</th>
                      {Object.keys(SUBJECT_LABELS).map(subject => (
                        <th key={subject} className="py-2 px-3 text-center font-semibold text-gray-700">
                          {SUBJECT_LABELS[subject]}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-center font-semibold text-gray-700 bg-blue-50">평균</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['march', 'june', 'september'].map((month, idx) => {
                      const scores = mockTestScores[month] || {};
                      const hasScores = Object.values(scores).some((v: any) => v && v !== '');
                      const avg = hasScores ? calculateAverage(scores) : null;

                      return (
                        <tr key={month} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-2 px-3 font-medium text-gray-700">
                            {MONTH_LABELS[month]}
                          </td>
                          {Object.keys(SUBJECT_LABELS).map(subject => (
                            <td key={subject} className="py-2 px-3 text-center">
                              {scores[subject] && scores[subject] !== '' ? (
                                <span className={`font-semibold ${
                                  Number(scores[subject]) <= 3 ? 'text-green-600' :
                                  Number(scores[subject]) <= 5 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {scores[subject]}등급
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-center bg-blue-50">
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
              </div>
            )}

            {/* 학업 메모 */}
            {consultation.academic_memo && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">{consultation.academic_memo}</p>
              </div>
            )}
          </div>

          {/* 실기 기록 섹션 */}
          {physicalRecords && Object.keys(physicalRecords).length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
                <span className="w-1 h-5 bg-orange-500 rounded"></span>
                실기 기록
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({consultation.physical_record_type === 'latest' ? '최근 기록' : '평균 기록'})
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(physicalRecords).map(([name, record]: [string, any]) => (
                  <div key={name} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
                    <div className="text-xs text-gray-500 mb-1">{name}</div>
                    <div className="text-lg font-bold text-gray-900">
                      {record.value} <span className="text-sm font-normal text-gray-500">{record.unit}</span>
                    </div>
                    {record.measured_at && (
                      <div className="text-xs text-gray-400 mt-1">
                        {format(parseISO(record.measured_at), 'M/d')} 측정
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {consultation.physical_memo && (
                <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-700">{consultation.physical_memo}</p>
                </div>
              )}
            </div>
          )}

          {/* 목표 대학 섹션 */}
          {(consultation.target_university_1 || consultation.target_university_2 || consultation.target_memo) && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
                <span className="w-1 h-5 bg-purple-500 rounded"></span>
                목표 대학
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {consultation.target_university_1 && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="text-xs text-purple-600 font-medium mb-1">1지망</div>
                    <div className="font-semibold text-gray-900">{consultation.target_university_1}</div>
                  </div>
                )}
                {consultation.target_university_2 && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 font-medium mb-1">2지망</div>
                    <div className="font-semibold text-gray-900">{consultation.target_university_2}</div>
                  </div>
                )}
              </div>

              {consultation.target_memo && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-700">{consultation.target_memo}</p>
                </div>
              )}
            </div>
          )}

          {/* 상담 내용 섹션 */}
          {consultation.general_memo && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
                <span className="w-1 h-5 bg-green-500 rounded"></span>
                상담 내용
              </h2>

              <div className="p-4 bg-green-50 rounded-lg border border-green-100 min-h-[100px]">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {consultation.general_memo}
                </p>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              작성일: {format(parseISO(consultation.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
              {' | '}P-ACA 학원관리시스템
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
