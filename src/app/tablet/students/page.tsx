'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  Search,
  User,
  Phone,
  GraduationCap,
  RefreshCw,
  ChevronRight,
  X
} from 'lucide-react';

interface Student {
  id: number;
  name: string;
  grade: string;
  gender: string;
  school: string;
  phone: string | null;
  parent_phone: string | null;
  status: string;
  is_trial: boolean;
  trial_remaining: number;
  student_type: string;
  class_days: number[];
  memo: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '재원', color: 'bg-green-100 text-green-700' },
  paused: { label: '휴원', color: 'bg-yellow-100 text-yellow-700' },
  withdrawn: { label: '퇴원', color: 'bg-red-100 text-red-700' },
  graduated: { label: '졸업', color: 'bg-blue-100 text-blue-700' },
  trial: { label: '체험', color: 'bg-purple-100 text-purple-700' },
  pending: { label: '대기', color: 'bg-gray-100 text-gray-700' },
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function TabletStudentsPage() {
  const orientation = useOrientation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    fetchStudents();
  }, [statusFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const res = await apiClient.get<{ students: Student[] }>('/students', {
        params
      });
      setStudents(res.students || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링 (클라이언트 사이드)
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;

    const searchLower = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(searchLower) ||
      s.school?.toLowerCase().includes(searchLower) ||
      s.grade?.toLowerCase().includes(searchLower)
    );
  }, [students, search]);

  const formatClassDays = (days: number[]) => {
    if (!days || days.length === 0) return '-';
    return days.map(d => DAY_LABELS[d]).join(', ');
  };

  return (
    <div className="space-y-4">
      {/* 검색바 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 이름, 학교로 검색"
            className="w-full pl-12 pr-12 py-3 bg-slate-100 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'active', label: '재원생' },
          { key: 'trial', label: '체험생' },
          { key: 'paused', label: '휴원' },
          { key: 'all', label: '전체' },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition ${
              statusFilter === filter.key
                ? 'bg-blue-500 text-white'
                : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* 결과 개수 */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-slate-500">
          {filteredStudents.length}명
          {search && ` (검색: "${search}")`}
        </p>
        <button
          onClick={fetchStudents}
          className="p-2 text-slate-400 active:text-blue-500"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 학생 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <User size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">
            {search ? '검색 결과가 없습니다' : '학생이 없습니다'}
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'
        }`}>
          {filteredStudents.map(student => (
            <Link
              key={student.id}
              href={`/tablet/students/${student.id}`}
              className="bg-white rounded-2xl p-4 shadow-sm active:bg-slate-50 transition flex items-center gap-4"
            >
              {/* 아바타 */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                student.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'
              }`}>
                {student.name.charAt(0)}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-slate-800 truncate">{student.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_LABELS[student.status]?.color || 'bg-gray-100 text-gray-700'
                  }`}>
                    {STATUS_LABELS[student.status]?.label || student.status}
                  </span>
                  {student.is_trial && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                      체험 {student.trial_remaining}회
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <GraduationCap size={14} />
                    {student.grade}
                  </span>
                  {student.school && (
                    <span className="truncate">{student.school}</span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  수업: {formatClassDays(student.class_days)}
                </p>
              </div>

              {/* 화살표 */}
              <ChevronRight size={20} className="text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
