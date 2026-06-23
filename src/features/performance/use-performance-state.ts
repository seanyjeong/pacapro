import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJungsiStatus, fetchPerformanceStudents, fetchStudentExamScore } from './performance-api';
import type { JungsiStatus, PerformanceStudent, PerformanceTab, StudentAllScores } from './performance-types';
import {
  createEmptyScores,
  EXAM_TYPES,
  filterStudents,
  SCORES_LOAD_ERROR,
  STATUS_LOAD_ERROR,
  STUDENTS_LOAD_ERROR,
} from './performance-utils';

export function usePerformanceState() {
  const [activeTab, setActiveTab] = useState<PerformanceTab>('내신');
  const [students, setStudents] = useState<PerformanceStudent[]>([]);
  const [jungsiStatus, setJungsiStatus] = useState<JungsiStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [scoresError, setScoresError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [studentScores, setStudentScores] = useState<StudentAllScores | null>(null);
  const [scoresLoading, setScoresLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await fetchJungsiStatus();
      if (!data.success) {
        setStatusError(STATUS_LOAD_ERROR);
        setJungsiStatus(null);
        return;
      }
      setJungsiStatus(data);
    } catch {
      setStatusError(STATUS_LOAD_ERROR);
      setJungsiStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const data = await fetchPerformanceStudents();
      setStudents(data);
    } catch {
      setStudentsError(STUDENTS_LOAD_ERROR);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadStudents();
  }, [loadStatus, loadStudents]);

  const filteredStudents = useMemo(() => filterStudents(students, searchQuery), [searchQuery, students]);

  const openStudentScores = async (studentId: number) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      setStudentScores(null);
      setScoresError(null);
      return;
    }

    setExpandedStudentId(studentId);
    setScoresLoading(true);
    setScoresError(null);
    setStudentScores(null);

    const results = createEmptyScores();
    const settled = await Promise.all(
      EXAM_TYPES.map(async (exam) => {
        try {
          results[exam] = await fetchStudentExamScore(studentId, exam);
          return true;
        } catch {
          return false;
        }
      })
    );

    if (!settled.some(Boolean)) {
      setScoresError(SCORES_LOAD_ERROR);
    } else {
      setStudentScores(results);
    }
    setScoresLoading(false);
  };

  return {
    activeTab,
    expandedStudentId,
    filteredStudents,
    jungsiStatus,
    loadStatus,
    loadStudents,
    openStudentScores,
    scoresError,
    scoresLoading,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    statusError,
    statusLoading,
    studentScores,
    students,
    studentsError,
    studentsLoading,
  };
}
