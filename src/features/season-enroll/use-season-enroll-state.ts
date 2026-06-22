import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Season, TimeSlot } from '@/lib/types/season';
import { fetchSeasonEligibleStudents, fetchSeasonForEnrollment, registerSeasonStudent } from './season-enroll-api';
import type { SeasonEnrollStudent } from './season-enroll-types';
import {
  filterEligibleStudents,
  filterStudents,
  formatTimeSlots,
  getDefaultTimeSlots,
  parseSeasonFee,
  SEASON_ENROLL_EMPTY_ERROR,
  SEASON_ENROLL_LOAD_ERROR,
  SEASON_ENROLL_SUBMIT_ERROR,
  splitStudentsByEnrollment,
  toggleTimeSlot,
} from './season-enroll-utils';

export function useSeasonEnrollState(seasonId: number | null) {
  const [season, setSeason] = useState<Season | null>(null);
  const [students, setStudents] = useState<SeasonEnrollStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SeasonEnrollStudent | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>(['evening']);
  const [discountAmount, setDiscountAmount] = useState(0);

  const reload = useCallback(async () => {
    if (!seasonId) {
      setError(SEASON_ENROLL_LOAD_ERROR);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [seasonResponse, allStudents] = await Promise.all([
        fetchSeasonForEnrollment(seasonId),
        fetchSeasonEligibleStudents(),
      ]);
      setSeason(seasonResponse.season);
      setStudents(filterEligibleStudents(allStudents));
    } catch {
      setError(SEASON_ENROLL_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredStudents = useMemo(() => filterStudents(students, searchTerm), [searchTerm, students]);
  const groupedStudents = useMemo(
    () => (seasonId ? splitStudentsByEnrollment(filteredStudents, seasonId) : { available: [], enrolled: [] }),
    [filteredStudents, seasonId]
  );

  const beginEnrollment = (student: SeasonEnrollStudent) => {
    setSelectedStudent(student);
    setSelectedTimeSlots(getDefaultTimeSlots(season, student));
    setDiscountAmount(0);
  };

  const closeDialog = () => {
    if (enrollingId) return;
    setSelectedStudent(null);
    setDiscountAmount(0);
  };

  const changeTimeSlot = (slot: TimeSlot) => {
    setSelectedTimeSlots((current) => toggleTimeSlot(current, slot));
  };

  const confirmEnrollment = async () => {
    if (!seasonId || !season || !selectedStudent || selectedTimeSlots.length === 0) {
      toast.error(SEASON_ENROLL_EMPTY_ERROR);
      return;
    }

    try {
      setEnrollingId(selectedStudent.id);
      const baseFee = parseSeasonFee(season);
      await registerSeasonStudent(seasonId, {
        student_id: selectedStudent.id,
        season_fee: baseFee,
        discount_amount: discountAmount,
        time_slots: selectedTimeSlots,
      });
      setStudents((current) =>
        current.map((student) =>
          student.id === selectedStudent.id
            ? { ...student, is_season_registered: true, current_season_id: seasonId }
            : student
        )
      );
      toast.success('시즌 등록이 완료되었습니다.', { description: `시간대: ${formatTimeSlots(selectedTimeSlots)}` });
      setSelectedStudent(null);
      setDiscountAmount(0);
    } catch {
      toast.error(SEASON_ENROLL_SUBMIT_ERROR);
    } finally {
      setEnrollingId(null);
    }
  };

  return {
    availableStudents: groupedStudents.available,
    beginEnrollment,
    changeTimeSlot,
    closeDialog,
    confirmEnrollment,
    discountAmount,
    enrolledStudents: groupedStudents.enrolled,
    enrollingId,
    error,
    loading,
    reload,
    searchTerm,
    season,
    selectedStudent,
    selectedTimeSlots,
    setDiscountAmount,
    setSearchTerm,
    totalEligibleCount: students.length,
  };
}
