'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Award,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Loader2,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';

interface Student {
  id: number;
  name: string;
  school: string;
  grade: string;
  status: string;
}

interface JungsiMatchResult {
  paca: {
    id: number;
    name: string;
    school: string;
    grade: string;
  };
  jungsi: {
    student_id: number;
    student_name: string;
    school_name: string;
    grade: string;
    hasScores: boolean;
  } | null;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchMethod: string | null;
}

interface JungsiStatus {
  success: boolean;
  academyId: number;
  branchName: string | null;
  isConfigured: boolean;
  jungsiApi: {
    url: string;
    healthy: boolean;
  };
  examTypes: string[];
  defaultExam: string;
}

interface ScoreData {
  year: string;
  exam: string;
  국어?: SubjectScore;
  수학?: SubjectScore;
  영어?: { 원점수?: number; 등급?: string };
  한국사?: { 원점수?: number; 등급?: string };
  탐구1?: SubjectScore;
  탐구2?: SubjectScore;
}

interface SubjectScore {
  선택과목?: string;
  원점수?: number;
  표준점수?: number;
  백분위?: number;
  등급?: string;
}

const EXAM_TABS = ['내신', '3월', '6월', '9월', '수능'];

// 내신 과목 목록
const NAESIN_SUBJECTS = [
  '국어', '영어', '수학', '물리학', '화학', '생명과학', '지구과학',
  '한국사', '사회', '윤리', '경제', '정치', '음악', '미술', '체육'
];

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState('내신');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [jungsiStatus, setJungsiStatus] = useState<JungsiStatus | null>(null);
  const [matchResults, setMatchResults] = useState<JungsiMatchResult[]>([]);
  const [selectedStudentScores, setSelectedStudentScores] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

  // 내신 입력 상태
  const [naesinForm, setNaesinForm] = useState<{
    semester: string;
    grades: { [subject: string]: string };
  }>({
    semester: '1학기',
    grades: {}
  });

  // 정시엔진 상태 확인
  useEffect(() => {
    fetchJungsiStatus();
  }, []);

  // 학생 목록 로드
  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchJungsiStatus = async () => {
    try {
      setStatusLoading(true);
      const data = await apiClient.get<JungsiStatus>('/jungsi/status');
      if (data.success) {
        setJungsiStatus(data);
      }
    } catch (error) {
      console.error('정시엔진 상태 확인 실패:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiClient.get<{ students: Student[] }>('/students?status=active,paused');
      if (data.students) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error('학생 목록 조회 실패:', error);
    }
  };

  const fetchMatchPreview = async (exam: string) => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ success: boolean; results: JungsiMatchResult[] }>(
        `/jungsi/match-preview?exam=${encodeURIComponent(exam)}`
      );
      if (data.success) {
        setMatchResults(data.results);
      }
    } catch (error) {
      console.error('매칭 미리보기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentScores = async (studentId: number, exam: string) => {
    try {
      setScoresLoading(true);
      setSelectedStudentScores(null);
      const data = await apiClient.get<{ success: boolean; matched: boolean; scores: ScoreData }>(
        `/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`
      );
      if (data.success && data.matched) {
        setSelectedStudentScores(data.scores);
      } else {
        setSelectedStudentScores(null);
      }
    } catch (error) {
      console.error('성적 조회 실패:', error);
      setSelectedStudentScores(null);
    } finally {
      setScoresLoading(false);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab !== '내신' && jungsiStatus?.isConfigured) {
      fetchMatchPreview(activeTab);
    }
  }, [activeTab, jungsiStatus]);

  // 학생 선택 시 성적 조회
  useEffect(() => {
    if (selectedStudent && activeTab !== '내신') {
      fetchStudentScores(selectedStudent.id, activeTab);
    }
  }, [selectedStudent, activeTab]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.school?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.grade?.includes(searchQuery)
  );

  const renderNaesinTab = () => (
    <div className="space-y-6">
      {/* 학생 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            학생 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>학생 검색</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="이름, 학교, 학년으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={selectedStudent?.id?.toString() || ''}
              onValueChange={(value) => {
                const student = students.find(s => s.id === parseInt(value));
                setSelectedStudent(student || null);
              }}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="학생을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.slice(0, 50).map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    {student.name} ({student.grade} / {student.school || '미등록'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {selectedStudent.name} - 내신 성적 입력
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 학기 선택 */}
              <div className="flex gap-4 items-center">
                <Label>학기</Label>
                <Select
                  value={naesinForm.semester}
                  onValueChange={(value) => setNaesinForm(prev => ({ ...prev, semester: value }))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1학기">1학기</SelectItem>
                    <SelectItem value="2학기">2학기</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 과목별 등급 입력 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {NAESIN_SUBJECTS.map((subject) => (
                  <div key={subject}>
                    <Label className="text-sm">{subject}</Label>
                    <Select
                      value={naesinForm.grades[subject] || ''}
                      onValueChange={(value) => setNaesinForm(prev => ({
                        ...prev,
                        grades: { ...prev.grades, [subject]: value }
                      }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
                          <SelectItem key={grade} value={grade.toString()}>
                            {grade}등급
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setNaesinForm({ semester: '1학기', grades: {} })}>
                  초기화
                </Button>
                <Button onClick={() => {
                  // TODO: 내신 저장 API 호출
                  alert('내신 저장 기능은 추후 구현 예정입니다.');
                }}>
                  저장
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedStudent && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>학생을 선택하면 내신 성적을 입력할 수 있습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderMopyeongTab = (exam: string) => {
    if (!jungsiStatus?.isConfigured) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">정시엔진 연동 미설정</h3>
            <p className="text-gray-600">
              이 학원은 아직 정시엔진과 연동되지 않았습니다.
              <br />
              관리자에게 문의해주세요.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (!jungsiStatus.jungsiApi.healthy) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">정시엔진 연결 오류</h3>
            <p className="text-gray-600 mb-4">
              정시엔진 서버와 연결할 수 없습니다.
            </p>
            <Button onClick={fetchJungsiStatus} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 시도
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* 연동 상태 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">정시엔진 연결됨</span>
                </div>
                <Badge variant="outline">{jungsiStatus.branchName} 지점</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMatchPreview(exam)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                새로고침
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 학생 목록 & 성적 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              {exam} 모의고사 성적
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : matchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>매칭된 학생이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {matchResults.map((result) => (
                  <div
                    key={result.paca.id}
                    className={cn(
                      "border rounded-lg overflow-hidden",
                      expandedStudent === result.paca.id && "ring-2 ring-primary"
                    )}
                  >
                    {/* 학생 행 */}
                    <div
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50",
                        result.matched && "bg-green-50/50"
                      )}
                      onClick={() => {
                        if (expandedStudent === result.paca.id) {
                          setExpandedStudent(null);
                        } else {
                          setExpandedStudent(result.paca.id);
                          // 직접 성적 조회 (students 배열 의존성 제거)
                          fetchStudentScores(result.paca.id, activeTab);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{result.paca.name}</p>
                          <p className="text-sm text-gray-500">
                            {result.paca.grade} / {result.paca.school || '학교 미등록'}
                          </p>
                        </div>
                        {!result.matched && (
                          <Badge className="bg-gray-100 text-gray-800">미매칭</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {result.jungsi?.hasScores && (
                          <Badge className="bg-blue-100 text-blue-800">성적 있음</Badge>
                        )}
                        {expandedStudent === result.paca.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* 성적 상세 (확장) */}
                    {expandedStudent === result.paca.id && (
                      <div className="border-t bg-gray-50 p-4">
                        {selectedStudentScores ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {/* 국어 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">국어</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.국어?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {selectedStudentScores.국어?.선택과목}
                              </p>
                              <p className="text-xs text-gray-500">
                                표준: {selectedStudentScores.국어?.표준점수 || '-'} /
                                백분위: {selectedStudentScores.국어?.백분위 || '-'}
                              </p>
                            </div>
                            {/* 수학 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">수학</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.수학?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {selectedStudentScores.수학?.선택과목}
                              </p>
                              <p className="text-xs text-gray-500">
                                표준: {selectedStudentScores.수학?.표준점수 || '-'} /
                                백분위: {selectedStudentScores.수학?.백분위 || '-'}
                              </p>
                            </div>
                            {/* 영어 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">영어</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.영어?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                            </div>
                            {/* 한국사 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">한국사</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.한국사?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                            </div>
                            {/* 탐구1 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">탐구1</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.탐구1?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {selectedStudentScores.탐구1?.선택과목}
                              </p>
                              <p className="text-xs text-gray-500">
                                표준: {selectedStudentScores.탐구1?.표준점수 || '-'} /
                                백분위: {selectedStudentScores.탐구1?.백분위 || '-'}
                              </p>
                            </div>
                            {/* 탐구2 */}
                            <div className="bg-white p-3 rounded-lg border">
                              <p className="text-sm text-gray-500 mb-1">탐구2</p>
                              <p className="text-2xl font-bold">
                                {selectedStudentScores.탐구2?.등급 || '-'}
                                <span className="text-sm font-normal text-gray-500">등급</span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {selectedStudentScores.탐구2?.선택과목}
                              </p>
                              <p className="text-xs text-gray-500">
                                표준: {selectedStudentScores.탐구2?.표준점수 || '-'} /
                                백분위: {selectedStudentScores.탐구2?.백분위 || '-'}
                              </p>
                            </div>
                          </div>
                        ) : scoresLoading ? (
                          <div className="text-center py-4 text-gray-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            <p>성적 조회 중...</p>
                          </div>
                        ) : result.matched ? (
                          <div className="text-center py-4 text-gray-500">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                            <p>성적 데이터가 없습니다.</p>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                            <p>정시엔진에서 매칭된 학생이 없습니다.</p>
                            <p className="text-sm">이름, 학교, 학년 정보를 확인해주세요.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">성적관리</h1>
          <p className="text-gray-600 mt-1">내신 및 모의고사 성적 관리</p>
        </div>
        {statusLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">연결 확인 중...</span>
          </div>
        ) : jungsiStatus?.jungsiApi.healthy ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">정시엔진 연결됨</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">정시엔진 연결 안됨</span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {EXAM_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex items-center gap-2">
              {tab === '내신' ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <Award className="w-4 h-4" />
              )}
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="내신" className="mt-6">
          {renderNaesinTab()}
        </TabsContent>

        {['3월', '6월', '9월', '수능'].map((exam) => (
          <TabsContent key={exam} value={exam} className="mt-6">
            {renderMopyeongTab(exam)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
