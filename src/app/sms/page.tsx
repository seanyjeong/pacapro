'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Users, User, Phone, CheckCircle, XCircle, Clock, AlertCircle, Search, X, Image, GraduationCap, UserPlus } from 'lucide-react';
import { smsAPI } from '@/lib/api/sms';
import apiClient from '@/lib/api/client';
import { toast } from 'sonner';
import { debounce } from 'lodash';

type SendMode = 'all' | 'individual' | 'custom';
type RecipientType = 'student' | 'parent';
type StatusFilter = 'active' | 'pending';
type GradeFilter = 'all' | 'junior' | 'senior';

interface Student {
  id: number;
  name: string;
  phone: string | null;
  parent_phone: string | null;
}

interface ImageFile {
  name: string;
  data: string;  // base64
  preview: string;  // URL for preview
}

interface SenderNumber {
  id: number;
  service_type: 'solapi' | 'sens';
  phone: string;
  label: string | null;
  is_default: number;
}

export default function SMSPage() {
  // 발송 모드: 모두 / 개별 / 직접입력
  const [sendMode, setSendMode] = useState<SendMode>('all');
  // 수신자 타입: 학생 / 학부모
  const [recipientType, setRecipientType] = useState<RecipientType>('parent');
  // 상태 필터: 재원생 / 미등록관리
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  // 학년 필터: 전체 / 선행반 / 3학년
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');

  const [content, setContent] = useState('');
  const [customPhones, setCustomPhones] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientsCount, setRecipientsCount] = useState({ all: 0, students: 0, parents: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 이미지 첨부 (MMS)
  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 개별 선택 관련
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 발신번호 관련
  const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<'solapi' | 'sens'>('sens');

  useEffect(() => {
    loadRecipientsCount();
    loadLogs();
    loadServiceTypeAndSenderNumbers();
  }, []);

  const loadServiceTypeAndSenderNumbers = async () => {
    try {
      // 알림톡 설정에서 service_type 가져오기
      const settingsResponse = await apiClient.get<{ settings: { service_type?: string } }>('/notifications/settings');
      const svcType = (settingsResponse.settings?.service_type || 'sens') as 'solapi' | 'sens';
      setServiceType(svcType);

      // 해당 서비스의 발신번호 목록 가져오기
      const { senderNumbers: numbers } = await smsAPI.getSenderNumbers(svcType);
      setSenderNumbers(numbers);

      // 기본 발신번호 선택
      const defaultSender = numbers.find(n => n.is_default === 1);
      if (defaultSender) {
        setSelectedSenderId(defaultSender.id);
      } else if (numbers.length > 0) {
        setSelectedSenderId(numbers[0].id);
      }
    } catch (error) {
      console.error('발신번호 로드 실패:', error);
    }
  };

  // 필터 변경 시 수신자 수 다시 로드
  useEffect(() => {
    if (sendMode === 'all') {
      loadRecipientsCount();
    }
  }, [statusFilter, gradeFilter, sendMode]);

  const loadRecipientsCount = async () => {
    try {
      const data = await smsAPI.getRecipientsCount(statusFilter, gradeFilter);
      setRecipientsCount(data);
    } catch (error) {
      console.error('수신자 수 조회 실패:', error);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await smsAPI.getLogs({ limit: 20 });
      setLogs(data.logs);
    } catch (error) {
      console.error('발송 내역 조회 실패:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // 학생 검색 (디바운스)
  const searchStudents = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const response = await apiClient.get<{ students: Student[] }>('/students', {
          params: { search: query, limit: 10, status: 'active' }
        });
        setSearchResults(response.students || []);
      } catch (error) {
        console.error('학생 검색 실패:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchStudents(searchQuery);
  }, [searchQuery, searchStudents]);

  // 이미지 파일 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 300 * 1024; // 300KB

    Array.from(files).forEach(file => {
      if (images.length >= 3) {
        toast.error('이미지는 최대 3장까지 첨부 가능합니다.');
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        toast.error('JPG, PNG 이미지만 첨부 가능합니다.');
        return;
      }

      if (file.size > maxSize) {
        toast.error('이미지 크기는 300KB 이하여야 합니다.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImages(prev => [...prev, {
          name: file.name,
          data: base64,
          preview: URL.createObjectURL(file)
        }]);
      };
      reader.readAsDataURL(file);
    });

    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 삭제
  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSend = async () => {
    if (!content.trim()) {
      toast.error('문자 내용을 입력해주세요.');
      return;
    }

    // 직접입력 모드에서 전화번호 검증
    if (sendMode === 'custom') {
      if (!customPhones.trim()) {
        toast.error('전화번호를 입력해주세요.');
        return;
      }
      const phones = customPhones.split(/[\n,]/).filter(p => p.trim());
      const invalidPhones = phones.filter(p => !/^\d{3}-\d{3,4}-\d{4}$/.test(p.trim()));
      if (invalidPhones.length > 0) {
        toast.error('전화번호는 하이픈(-)을 포함한 형식으로 입력해주세요.\n예: 010-1234-5678');
        return;
      }
    }

    // 개별 모드에서 학생 선택 검증
    if (sendMode === 'individual') {
      if (!selectedStudent) {
        toast.error('학생을 선택해주세요.');
        return;
      }
      const targetPhone = recipientType === 'student' ? selectedStudent.phone : selectedStudent.parent_phone;
      if (!targetPhone) {
        toast.error(`${recipientType === 'student' ? '학생' : '학부모'} 전화번호가 등록되어 있지 않습니다.`);
        return;
      }
    }

    // 수신자 수 계산
    let recipientCount = 0;
    if (sendMode === 'custom') {
      recipientCount = customPhones.split(/[\n,]/).filter(p => p.trim()).length;
    } else if (sendMode === 'individual') {
      recipientCount = 1;
    } else {
      recipientCount = recipientType === 'student' ? recipientsCount.students : recipientsCount.parents;
    }

    if (recipientCount === 0) {
      toast.error('발송할 수신자가 없습니다.');
      return;
    }

    const messageType = images.length > 0 ? 'MMS' : (contentBytes > 80 ? 'LMS' : 'SMS');
    if (!confirm(`${recipientCount}명에게 ${messageType}를 발송하시겠습니까?${images.length > 0 ? `\n\n이미지 ${images.length}장 첨부` : ''}`)) {
      return;
    }

    setSending(true);
    try {
      let result;
      const imageData = images.length > 0 ? images.map(img => ({ name: img.name, data: img.data })) : undefined;

      if (sendMode === 'custom') {
        // 직접입력
        const phones = customPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
        result = await smsAPI.send({
          target: 'custom',
          content,
          customPhones: phones,
          images: imageData,
          senderNumberId: selectedSenderId || undefined,
        });
      } else if (sendMode === 'individual') {
        // 개별 발송
        const targetPhone = recipientType === 'student' ? selectedStudent!.phone : selectedStudent!.parent_phone;
        result = await smsAPI.send({
          target: 'custom',
          content,
          customPhones: [targetPhone!],
          images: imageData,
          senderNumberId: selectedSenderId || undefined,
        });
      } else {
        // 모두 (학생 또는 학부모)
        result = await smsAPI.send({
          target: recipientType === 'student' ? 'students' : 'parents',
          content,
          images: imageData,
          statusFilter,
          gradeFilter,
          senderNumberId: selectedSenderId || undefined,
        });
      }

      toast.success(result.message);
      loadLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '문자 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"><CheckCircle className="w-3 h-3" /> 발송</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"><XCircle className="w-3 h-3" /> 실패</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"><Clock className="w-3 h-3" /> 대기</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const typeUpper = type?.toUpperCase() || 'SMS';
    const colors: Record<string, string> = {
      SMS: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      LMS: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      MMS: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    };
    return <span className={`px-1.5 py-0.5 rounded text-xs ${colors[typeUpper] || colors.SMS}`}>{typeUpper}</span>;
  };

  // 글자 수 (byte) 계산
  const contentBytes = new TextEncoder().encode(content).length;
  const isMMS = images.length > 0;
  const isLMS = !isMMS && contentBytes > 80;

  // 모드 변경 시 초기화
  const handleModeChange = (mode: SendMode) => {
    setSendMode(mode);
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    if (mode !== 'all') {
      setGradeFilter('all');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-green-600 dark:text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">문자 보내기</h1>
          <p className="text-muted-foreground">학생/학부모에게 공지, 안내 문자를 발송합니다</p>
        </div>
      </div>

      {/* 문자 발송 폼 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">문자 작성</h2>

        {/* STEP 1: 발송 대상 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">1. 발송 대상</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleModeChange('all')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'all'
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Users className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'all' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              <div className="text-sm font-medium text-foreground">모두</div>
              <div className="text-xs text-muted-foreground">전체 발송</div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('individual')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'individual'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <User className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'individual' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
              <div className="text-sm font-medium text-foreground">개별</div>
              <div className="text-xs text-muted-foreground">학생 선택</div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'custom'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Phone className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'custom' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`} />
              <div className="text-sm font-medium text-foreground">직접 입력</div>
              <div className="text-xs text-muted-foreground">번호 직접 입력</div>
            </button>
          </div>
        </div>

        {/* 발신번호 선택 */}
        {senderNumbers.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              발신번호 선택
            </label>
            <select
              value={selectedSenderId || ''}
              onChange={(e) => setSelectedSenderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {senderNumbers.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.phone}{sender.label ? ` (${sender.label})` : ''}{sender.is_default ? ' [기본]' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              * 발신번호는 설정 &gt; 알림톡 및 SMS 설정에서 관리할 수 있습니다.
            </p>
          </div>
        )}

        {/* 모두 선택 시 상태/학년 필터 */}
        {sendMode === 'all' && (
          <div className="mb-6 space-y-4">
            {/* 상태 필터: 재원생 / 미등록관리 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <UserPlus className="w-4 h-4 inline mr-1" />
                학생 상태
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    statusFilter === 'active'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                      : 'border-border hover:border-muted-foreground text-foreground'
                  }`}
                >
                  재원생
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    statusFilter === 'pending'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                      : 'border-border hover:border-muted-foreground text-foreground'
                  }`}
                >
                  미등록관리
                </button>
              </div>
            </div>

            {/* 학년 필터: 전체 / 1-2학년 / 3학년 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <GraduationCap className="w-4 h-4 inline mr-1" />
                학년 필터
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setGradeFilter('all')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    gradeFilter === 'all'
                      ? 'border-gray-500 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                      : 'border-border hover:border-muted-foreground text-foreground'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setGradeFilter('junior')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    gradeFilter === 'junior'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'border-border hover:border-muted-foreground text-foreground'
                  }`}
                >
                  1-2학년
                </button>
                <button
                  type="button"
                  onClick={() => setGradeFilter('senior')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    gradeFilter === 'senior'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : 'border-border hover:border-muted-foreground text-foreground'
                  }`}
                >
                  3학년·N수
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 개별 선택 시 학생 검색 */}
        {sendMode === 'individual' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">2. 학생 선택</label>

            {/* 선택된 학생 */}
            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
                <div>
                  <span className="font-medium text-blue-900 dark:text-blue-100">{selectedStudent.name}</span>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    학생: {selectedStudent.phone || '미등록'} / 학부모: {selectedStudent.parent_phone || '미등록'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* 검색 입력 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="학생 이름으로 검색..."
                  />
                </div>

                {/* 검색 결과 */}
                {searchQuery && (
                  <div className="mt-2 border border-border rounded-lg max-h-48 overflow-y-auto bg-card">
                    {searching ? (
                      <div className="p-3 text-center text-muted-foreground">검색 중...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground">검색 결과가 없습니다</div>
                    ) : (
                      searchResults.map(student => (
                        <button
                          key={student.id}
                          onClick={() => {
                            setSelectedStudent(student);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-muted border-b border-border last:border-0"
                        >
                          <div className="font-medium text-foreground">{student.name}</div>
                          <div className="text-xs text-muted-foreground">
                            학생: {student.phone || '미등록'} / 학부모: {student.parent_phone || '미등록'}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 2/3: 수신자 타입 (모두/개별 선택 시) */}
        {(sendMode === 'all' || (sendMode === 'individual' && selectedStudent)) && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              {sendMode === 'all' ? '2' : '3'}. 수신자 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecipientType('student')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  recipientType === 'student'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="text-sm font-medium text-foreground">학생에게</div>
                {sendMode === 'all' && (
                  <div className="text-xs text-muted-foreground">{recipientsCount.students}명</div>
                )}
                {sendMode === 'individual' && selectedStudent && (
                  <div className="text-xs text-muted-foreground">
                    {selectedStudent.phone || '전화번호 미등록'}
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('parent')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  recipientType === 'parent'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="text-sm font-medium text-foreground">학부모에게</div>
                {sendMode === 'all' && (
                  <div className="text-xs text-muted-foreground">{recipientsCount.parents}명</div>
                )}
                {sendMode === 'individual' && selectedStudent && (
                  <div className="text-xs text-muted-foreground">
                    {selectedStudent.parent_phone || '전화번호 미등록'}
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 직접 입력 시 전화번호 입력 */}
        {sendMode === 'custom' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1">
              2. 전화번호 입력 (쉼표 또는 줄바꿈으로 구분)
            </label>
            <textarea
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="010-1234-5678, 010-9876-5432&#10;또는 줄바꿈으로 구분"
            />
            <p className="text-xs text-muted-foreground mt-1">
              * 전화번호는 하이픈(-)을 포함하여 입력해주세요 (예: 010-1234-5678)
            </p>
          </div>
        )}

        {/* 문자 내용 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-1">
            {sendMode === 'custom' ? '3' : sendMode === 'individual' && selectedStudent ? '4' : '3'}. 문자 내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="안녕하세요, OO학원입니다.&#10;&#10;내용을 입력해주세요..."
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              {isMMS && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                  <Image className="w-3 h-3" />
                  MMS (이미지 첨부)
                </span>
              )}
              {isLMS && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                  <AlertCircle className="w-3 h-3" />
                  LMS (80byte 초과)
                </span>
              )}
            </div>
            <span className={`text-sm ${isMMS ? 'text-purple-600 dark:text-purple-400' : isLMS ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
              {contentBytes} / {isMMS ? '2000' : isLMS ? '2000' : '80'} byte
            </span>
          </div>
        </div>

        {/* 이미지 첨부 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            이미지 첨부 (선택, 최대 3장)
          </label>

          {/* 첨부된 이미지 미리보기 */}
          {images.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {images.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 이미지 추가 버튼 */}
          {images.length < 3 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted"
              >
                <Image className="w-4 h-4" />
                이미지 추가
              </button>
            </>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            * JPG, PNG 형식, 300KB 이하 | 이미지 첨부 시 MMS로 발송됩니다
          </p>
        </div>

        {/* 발송 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
            {sending ? '발송 중...' : isMMS ? 'MMS 발송' : 'SMS 발송'}
          </button>
        </div>
      </div>

      {/* 발신번호 안내 */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">발신번호 안내</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              문자는 <strong>설정 &gt; 알림톡 및 SMS 설정</strong>에서 선택한 서비스로 발송됩니다.
            </p>
            <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1">
              <li>• <strong>SENS</strong>: 학원 기본 정보의 전화번호가 Naver Cloud SENS에 등록되어 있어야 합니다.</li>
              <li>• <strong>솔라피</strong>: 솔라피 설정의 발신번호로 발송됩니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 최근 발송 내역 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">최근 발송 내역</h2>

        {logsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">발송 내역이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-foreground">발송시간</th>
                  <th className="text-left py-2 px-2 text-foreground">유형</th>
                  <th className="text-left py-2 px-2 text-foreground">수신자</th>
                  <th className="text-left py-2 px-2 text-foreground">전화번호</th>
                  <th className="text-left py-2 px-2 text-foreground">내용</th>
                  <th className="text-left py-2 px-2 text-foreground">상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2 px-2">{getTypeBadge(log.message_type)}</td>
                    <td className="py-2 px-2 text-foreground">{log.recipient_name || '-'}</td>
                    <td className="py-2 px-2 text-foreground">{log.recipient_phone}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate text-foreground" title={log.message_content}>
                      {log.message_content}
                    </td>
                    <td className="py-2 px-2">{getStatusBadge(log.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
