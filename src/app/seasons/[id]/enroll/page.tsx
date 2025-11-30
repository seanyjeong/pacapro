'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Search, UserPlus, CheckCircle, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { seasonsApi } from '@/lib/api/seasons';
import apiClient from '@/lib/api/client';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS, formatSeasonFee } from '@/lib/types/season';

interface Student {
  id: number;
  name: string;
  phone: string;
  grade: string;
  grade_type: string;
  student_type?: string;
  is_season_registered: boolean;
  current_season_id: number | null;
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export default function SeasonEnrollPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = parseInt(params.id as string);

  const [season, setSeason] = useState<Season | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 시간대 선택 모달
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>(['evening']);

  // 고3/N수 학생인지 확인
  const isMultiTimeSlotStudent = (student: Student) => {
    return student.grade === '고3' || student.grade === 'N수' || student.student_type === 'n_soo';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 시즌 정보 조회
        const seasonResponse = await seasonsApi.getSeason(seasonId);
        setSeason(seasonResponse.season);

        // 학생 목록 조회 (고3, N수만 - 시즌 대상)
        const studentsResponse = await apiClient.get<{ students: Student[] }>('/students?grade_type=high');
        // 고3 또는 N수 학생만 필터링
        const eligibleStudents = studentsResponse.students.filter(
          s => s.grade === '고3' || s.grade === 'N수' || s.grade_type === 'n_su'
        );
        setStudents(eligibleStudents);
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (seasonId) {
      fetchData();
    }
  }, [seasonId]);

  // 등록 버튼 클릭 시 - 고3/N수는 시간대 선택 모달 표시
  const handleEnrollClick = (student: Student) => {
    if (isMultiTimeSlotStudent(student)) {
      setSelectedStudent(student);
      setSelectedTimeSlots(['evening']); // 기본값 저녁
      setShowTimeSlotModal(true);
    } else {
      // 다른 학년은 바로 등록 (저녁 시간대)
      handleEnroll(student.id, ['evening']);
    }
  };

  // 시간대 토글
  const toggleTimeSlot = (slot: TimeSlot) => {
    setSelectedTimeSlots(prev => {
      if (prev.includes(slot)) {
        // 최소 1개는 선택해야 함
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== slot);
      } else {
        return [...prev, slot];
      }
    });
  };

  // 모달에서 확인 버튼 클릭
  const handleConfirmEnroll = () => {
    if (selectedStudent && selectedTimeSlots.length > 0) {
      handleEnroll(selectedStudent.id, selectedTimeSlots);
      setShowTimeSlotModal(false);
      setSelectedStudent(null);
    }
  };

  const handleEnroll = async (studentId: number, timeSlots: TimeSlot[]) => {
    if (!season) return;

    try {
      setEnrolling(studentId);
      await seasonsApi.enrollStudent(seasonId, {
        student_id: studentId,
        season_fee: parseFloat(season.default_season_fee) || 0,
        time_slots: timeSlots,
      });

      // 학생 목록에서 등록 상태 업데이트
      setStudents(prev =>
        prev.map(s =>
          s.id === studentId
            ? { ...s, is_season_registered: true, current_season_id: seasonId }
            : s
        )
      );

      const slotLabels = timeSlots.map(ts => TIME_SLOT_LABELS[ts]).join(', ');
      toast.success(`학생이 시즌에 등록되었습니다.`, { description: `시간대: ${slotLabels}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setEnrolling(null);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.includes(searchTerm) || s.phone.includes(searchTerm)
  );

  const notEnrolledStudents = filteredStudents.filter(
    s => !s.is_season_registered || s.current_season_id !== seasonId
  );
  const enrolledStudents = filteredStudents.filter(
    s => s.is_season_registered && s.current_season_id === seasonId
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-500">{error || '시즌을 찾을 수 없습니다.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/seasons/${seasonId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학생 등록</h1>
          <p className="text-gray-600">
            {season.season_name} ({SEASON_TYPE_LABELS[season.season_type]}) -
            시즌비: {formatSeasonFee(season.default_season_fee)}
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="학생 이름 또는 전화번호 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Not Enrolled Students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">등록 가능한 학생 ({notEnrolledStudents.length}명)</CardTitle>
        </CardHeader>
        <CardContent>
          {notEnrolledStudents.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              {searchTerm ? '검색 결과가 없습니다.' : '등록 가능한 학생이 없습니다.'}
            </p>
          ) : (
            <div className="space-y-2">
              {notEnrolledStudents.map(student => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-sm text-gray-500">
                      {student.grade || student.grade_type} · {student.phone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleEnrollClick(student)}
                    disabled={enrolling === student.id}
                  >
                    {enrolling === student.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1" />
                        {isMultiTimeSlotStudent(student) ? '시간대 선택' : '등록'}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Already Enrolled */}
      {enrolledStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-700">
              이미 등록된 학생 ({enrolledStudents.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {enrolledStudents.map(student => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-sm text-gray-500">
                      {student.grade || student.grade_type} · {student.phone}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 시간대 선택 모달 (고3/N수 전용) */}
      {showTimeSlotModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">시간대 선택</h3>
                <p className="text-sm text-gray-500">
                  {selectedStudent.name} ({selectedStudent.grade})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTimeSlotModal(false);
                  setSelectedStudent(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                고3/N수 학생은 여러 시간대를 선택할 수 있습니다.
                <br />
                선택한 시간대에 수업 스케줄이 자동으로 생성됩니다.
              </p>

              <div className="space-y-3">
                {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map(slot => (
                  <button
                    key={slot}
                    onClick={() => toggleTimeSlot(slot)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                      selectedTimeSlots.includes(slot)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Clock className={`w-5 h-5 ${
                        selectedTimeSlots.includes(slot) ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <span className={`font-medium ${
                        selectedTimeSlots.includes(slot) ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {TIME_SLOT_LABELS[slot]}
                      </span>
                    </div>
                    {selectedTimeSlots.includes(slot) && (
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                선택된 시간대: {selectedTimeSlots.map(ts => TIME_SLOT_LABELS[ts]).join(', ')}
              </p>
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowTimeSlotModal(false);
                  setSelectedStudent(null);
                }}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmEnroll}
                disabled={selectedTimeSlots.length === 0 || enrolling === selectedStudent.id}
              >
                {enrolling === selectedStudent.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '등록하기'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
