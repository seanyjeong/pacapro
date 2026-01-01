'use client';

import { useState, useEffect } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  MessageSquare,
  Calendar,
  Clock,
  User,
  Phone,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface Consultation {
  id: number;
  student_name: string;
  student_phone: string;
  parent_phone: string;
  grade: string;
  school: string;
  consultation_date: string;
  consultation_time: string;
  status: string;
  notes: string | null;
  inquiry_type: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: '확정', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-700' },
  no_show: { label: '노쇼', color: 'bg-gray-100 text-gray-700' },
};

export default function TabletConsultationsPage() {
  const orientation = useOrientation();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchConsultations();
  }, [selectedDate]);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ consultations: Consultation[] }>('/consultations', {
        params: { date: selectedDate }
      });
      setConsultations(res.consultations || []);
    } catch (error) {
      console.error('Failed to fetch consultations:', error);
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* 날짜 선택 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">{formatDate(selectedDate)}</p>
            {isToday && (
              <span className="text-sm text-blue-500 font-medium">오늘</span>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-800">{consultations.length}</p>
          <p className="text-xs text-slate-500">전체</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {consultations.filter(c => c.status === 'pending').length}
          </p>
          <p className="text-xs text-yellow-600">대기</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-600">
            {consultations.filter(c => c.status === 'confirmed').length}
          </p>
          <p className="text-xs text-blue-600">확정</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">
            {consultations.filter(c => c.status === 'completed').length}
          </p>
          <p className="text-xs text-green-600">완료</p>
        </div>
      </div>

      {/* 상담 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : consultations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">예정된 상담이 없습니다</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'
        }`}>
          {consultations.map(consultation => {
            const statusConfig = STATUS_CONFIG[consultation.status] || STATUS_CONFIG.pending;

            return (
              <div
                key={consultation.id}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">{consultation.consultation_time}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* 학생 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <span className="font-bold text-slate-800">{consultation.student_name}</span>
                    <span className="text-sm text-slate-500">{consultation.grade}</span>
                  </div>

                  {consultation.school && (
                    <p className="text-sm text-slate-500 pl-6">{consultation.school}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-600">{consultation.parent_phone || consultation.student_phone || '-'}</span>
                  </div>

                  {consultation.inquiry_type && (
                    <p className="text-sm text-blue-500">문의: {consultation.inquiry_type}</p>
                  )}

                  {consultation.notes && (
                    <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-2 mt-2">
                      {consultation.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
