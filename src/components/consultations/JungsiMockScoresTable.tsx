'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { jungsiAPI, type JungsiScoreData, type JungsiScoresResponse } from '@/lib/api/jungsi';

type MockExamKey = 'march' | 'june' | 'september';
type ExamName = '3월' | '6월' | '9월' | '수능';
type SubjectKey = 'korean' | 'math' | 'english' | 'exploration1' | 'exploration2';
type SubjectName = '국어' | '수학' | '영어' | '탐구1' | '탐구2';

type MockScores = Record<string, Record<string, string>>;

interface LearningFormWithScores {
  mockTestScores: MockScores;
}

interface Props<TForm extends LearningFormWithScores> {
  studentId?: number;
  learningForm: TForm;
  setLearningForm: Dispatch<SetStateAction<TForm>>;
}

const MOCK_EXAMS: Array<{ key: MockExamKey; exam: ExamName; label: string }> = [
  { key: 'march', exam: '3월', label: '3월 모평' },
  { key: 'june', exam: '6월', label: '6월 모평' },
  { key: 'september', exam: '9월', label: '9월 모평' },
];

const EXAMS_TO_FETCH: ExamName[] = ['3월', '6월', '9월', '수능'];

const SUBJECTS: Array<{ key: SubjectKey; scoreKey: SubjectName; label: string }> = [
  { key: 'korean', scoreKey: '국어', label: '국어' },
  { key: 'math', scoreKey: '수학', label: '수학' },
  { key: 'english', scoreKey: '영어', label: '영어' },
  { key: 'exploration1', scoreKey: '탐구1', label: '탐구1' },
  { key: 'exploration2', scoreKey: '탐구2', label: '탐구2' },
];

type JungsiScoresByExam = Record<'march' | 'june' | 'september' | 'suneung', JungsiScoreData | null>;

const emptyScores = (): JungsiScoresByExam => ({
  march: null,
  june: null,
  september: null,
  suneung: null,
});

function scoreToGrades(score?: JungsiScoreData | null) {
  return SUBJECTS.reduce<Record<string, string>>((acc, subject) => {
    const grade = score?.[subject.scoreKey]?.등급;
    acc[subject.key] = grade ? String(grade) : '';
    return acc;
  }, {});
}

function hasAnyValue(row?: Record<string, string>) {
  return SUBJECTS.some((subject) => Boolean(row?.[subject.key]));
}

function getSubjectChoice(score: JungsiScoreData | null | undefined, subjectName: SubjectName) {
  const subjectScore = score?.[subjectName];
  if (subjectScore && '선택과목' in subjectScore) {
    return subjectScore.선택과목 || '';
  }
  return '';
}

export default function JungsiMockScoresTable<TForm extends LearningFormWithScores>({
  studentId,
  learningForm,
  setLearningForm,
}: Props<TForm>) {
  const [scores, setScores] = useState<JungsiScoresByExam>(emptyScores);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadedStudentId, setLoadedStudentId] = useState<number | null>(null);

  const matchedCount = useMemo(
    () => Object.values(scores).filter(Boolean).length,
    [scores]
  );

  const loadScores = async () => {
    if (!studentId) {
      setScores(emptyScores());
      setLoadedStudentId(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    const next = emptyScores();

    await Promise.all(EXAMS_TO_FETCH.map(async (exam) => {
      try {
        const response: JungsiScoresResponse = await jungsiAPI.getScores(studentId, exam);
        if (response.success && response.matched && response.scores) {
          const key = exam === '3월'
            ? 'march'
            : exam === '6월'
              ? 'june'
              : exam === '9월'
                ? 'september'
                : 'suneung';
          next[key] = response.scores;
        }
      } catch {
        setErrorMessage('정시엔진 성적을 불러오지 못했습니다.');
      }
    }));

    setScores(next);
    setLoadedStudentId(studentId);
    setLoading(false);
  };

  useEffect(() => {
    loadScores();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!loadedStudentId || loadedStudentId !== studentId) return;

    setLearningForm((prev) => {
      let changed = false;
      const nextScores = { ...prev.mockTestScores };

      for (const exam of MOCK_EXAMS) {
        const jungsiScore = scores[exam.key];
        if (!jungsiScore) continue;

        const current = nextScores[exam.key] || {};
        if (hasAnyValue(current)) continue;

        const grades = scoreToGrades(jungsiScore);
        if (!hasAnyValue(grades)) continue;

        nextScores[exam.key] = { ...current, ...grades };
        changed = true;
      }

      return changed ? { ...prev, mockTestScores: nextScores } : prev;
    });
  }, [loadedStudentId, scores, setLearningForm, studentId]);

  const applyExamScore = (examKey: MockExamKey) => {
    const grades = scoreToGrades(scores[examKey]);
    setLearningForm((prev) => ({
      ...prev,
      mockTestScores: {
        ...prev.mockTestScores,
        [examKey]: {
          ...prev.mockTestScores[examKey],
          ...grades,
        },
      },
    }));
  };

  const updateManualScore = (examKey: MockExamKey, subjectKey: SubjectKey, value: string) => {
    setLearningForm((prev) => ({
      ...prev,
      mockTestScores: {
        ...prev.mockTestScores,
        [examKey]: {
          ...prev.mockTestScores[examKey],
          [subjectKey]: value,
        },
      },
    }));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">모의고사 성적 (등급)</Label>
        <div className="flex items-center gap-2">
          {studentId && matchedCount > 0 && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              정시엔진 {matchedCount}건
            </Badge>
          )}
          {studentId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadScores}
              disabled={loading}
              className="h-8 gap-1"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              새로고침
            </Button>
          )}
        </div>
      </div>

      {!studentId && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
          연결된 재원생이 없어 정시엔진 성적을 조회할 수 없습니다.
        </div>
      )}

      {studentId && (
        <div className="space-y-3">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm border border-border rounded-lg">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left font-medium">회차</th>
                  {SUBJECTS.map((subject) => (
                    <th key={subject.key} className="p-2 text-center font-medium">{subject.label}</th>
                  ))}
                  <th className="p-2 text-center font-medium">연동</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_EXAMS.map((exam) => {
                  const jungsiScore = scores[exam.key];

                  return (
                    <tr key={exam.key} className="border-t border-border">
                      <td className="p-2 font-medium">{exam.label}</td>
                      {SUBJECTS.map((subject) => (
                        <td key={subject.key} className="p-1 text-center">
                          <Input
                            type="number"
                            min="1"
                            max="9"
                            className="mx-auto h-8 w-12 text-center"
                            value={learningForm.mockTestScores[exam.key]?.[subject.key] || ''}
                            onChange={(event) => updateManualScore(exam.key, subject.key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        {jungsiScore ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => applyExamScore(exam.key)}
                            className="h-8 gap-1 text-emerald-700 dark:text-emerald-400"
                          >
                            <Download className="h-3.5 w-3.5" />
                            반영
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">없음</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {scores.suneung && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">수능 참고 성적</p>
                <Badge variant="info">정시엔진 연동</Badge>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {SUBJECTS.map((subject) => (
                  <div key={subject.key} className="rounded-md bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">{subject.label}</p>
                    <p className="text-lg font-bold">{scores.suneung?.[subject.scoreKey]?.등급 || '-'}</p>
                    {getSubjectChoice(scores.suneung, subject.scoreKey) && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {getSubjectChoice(scores.suneung, subject.scoreKey)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
