'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Users, User, Phone, CheckCircle, XCircle, Clock, AlertCircle, Search, X } from 'lucide-react';
import { smsAPI } from '@/lib/api/sms';
import apiClient from '@/lib/api/client';
import { toast } from 'sonner';
import { debounce } from 'lodash';

type SendMode = 'all' | 'individual' | 'custom';
type RecipientType = 'student' | 'parent';

interface Student {
  id: number;
  name: string;
  phone: string | null;
  parent_phone: string | null;
}

export default function SMSPage() {
  // 발송 모드: 모두 / 개별 / 직접입력
  const [sendMode, setSendMode] = useState<SendMode>('all');
  // 수신자 타입: 학생 / 학부모
  const [recipientType, setRecipientType] = useState<RecipientType>('parent');

  const [content, setContent] = useState('');
  const [customPhones, setCustomPhones] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientsCount, setRecipientsCount] = useState({ all: 0, students: 0, parents: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 개별 선택 관련
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadRecipientsCount();
    loadLogs();
  }, []);

  const loadRecipientsCount = async () => {
    try {
      const data = await smsAPI.getRecipientsCount();
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

    if (!confirm(`${recipientCount}명에게 문자를 발송하시겠습니까?\n\n※ 80byte 초과 시 LMS로 자동 전환됩니다.`)) {
      return;
    }

    setSending(true);
    try {
      let result;

      if (sendMode === 'custom') {
        // 직접입력
        const phones = customPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
        result = await smsAPI.send({
          target: 'custom',
          content,
          customPhones: phones,
        });
      } else if (sendMode === 'individual') {
        // 개별 발송
        const targetPhone = recipientType === 'student' ? selectedStudent!.phone : selectedStudent!.parent_phone;
        result = await smsAPI.send({
          target: 'custom',
          content,
          customPhones: [targetPhone!],
        });
      } else {
        // 모두 (학생 또는 학부모)
        result = await smsAPI.send({
          target: recipientType === 'student' ? 'students' : 'parents',
          content,
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
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> 발송</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> 실패</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> 대기</span>;
    }
  };

  // 글자 수 (byte) 계산
  const contentBytes = new TextEncoder().encode(content).length;
  const isLMS = contentBytes > 80;

  // 모드 변경 시 초기화
  const handleModeChange = (mode: SendMode) => {
    setSendMode(mode);
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">문자 보내기</h1>
          <p className="text-gray-500">학생/학부모에게 공지, 안내 문자를 발송합니다</p>
        </div>
      </div>

      {/* 문자 발송 폼 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">문자 작성</h2>

        {/* STEP 1: 발송 대상 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. 발송 대상</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleModeChange('all')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'all'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'all' ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">모두</div>
              <div className="text-xs text-gray-500">전체 발송</div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('individual')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'individual'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'individual' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">개별</div>
              <div className="text-xs text-gray-500">학생 선택</div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sendMode === 'custom'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Phone className={`w-6 h-6 mx-auto mb-2 ${sendMode === 'custom' ? 'text-orange-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">직접 입력</div>
              <div className="text-xs text-gray-500">번호 직접 입력</div>
            </button>
          </div>
        </div>

        {/* STEP 2: 개별 선택 시 학생 검색 */}
        {sendMode === 'individual' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">2. 학생 선택</label>

            {/* 선택된 학생 */}
            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                <div>
                  <span className="font-medium text-blue-900">{selectedStudent.name}</span>
                  <div className="text-xs text-blue-600 mt-1">
                    학생: {selectedStudent.phone || '미등록'} / 학부모: {selectedStudent.parent_phone || '미등록'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* 검색 입력 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="학생 이름으로 검색..."
                  />
                </div>

                {/* 검색 결과 */}
                {searchQuery && (
                  <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                    {searching ? (
                      <div className="p-3 text-center text-gray-500">검색 중...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-center text-gray-500">검색 결과가 없습니다</div>
                    ) : (
                      searchResults.map(student => (
                        <button
                          key={student.id}
                          onClick={() => {
                            setSelectedStudent(student);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-0"
                        >
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-gray-500">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {sendMode === 'all' ? '2' : '3'}. 수신자 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecipientType('student')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  recipientType === 'student'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">학생에게</div>
                {sendMode === 'all' && (
                  <div className="text-xs text-gray-500">{recipientsCount.students}명</div>
                )}
                {sendMode === 'individual' && selectedStudent && (
                  <div className="text-xs text-gray-500">
                    {selectedStudent.phone || '전화번호 미등록'}
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('parent')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  recipientType === 'parent'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">학부모에게</div>
                {sendMode === 'all' && (
                  <div className="text-xs text-gray-500">{recipientsCount.parents}명</div>
                )}
                {sendMode === 'individual' && selectedStudent && (
                  <div className="text-xs text-gray-500">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. 전화번호 입력 (쉼표 또는 줄바꿈으로 구분)
            </label>
            <textarea
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="010-1234-5678, 010-9876-5432&#10;또는 줄바꿈으로 구분"
            />
            <p className="text-xs text-gray-500 mt-1">
              * 전화번호는 하이픈(-)을 포함하여 입력해주세요 (예: 010-1234-5678)
            </p>
          </div>
        )}

        {/* 문자 내용 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {sendMode === 'custom' ? '3' : sendMode === 'individual' && selectedStudent ? '4' : '3'}. 문자 내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="안녕하세요, OO학원입니다.&#10;&#10;내용을 입력해주세요..."
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              {isLMS && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">
                  <AlertCircle className="w-3 h-3" />
                  LMS 전환 (80byte 초과)
                </span>
              )}
            </div>
            <span className={`text-sm ${isLMS ? 'text-orange-600' : 'text-gray-500'}`}>
              {contentBytes} / {isLMS ? '2000' : '80'} byte
            </span>
          </div>
        </div>

        {/* 발송 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
            {sending ? '발송 중...' : '문자 발송'}
          </button>
        </div>
      </div>

      {/* 발신번호 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">발신번호 안내</p>
            <p className="text-sm text-blue-700 mt-1">
              문자는 <strong>설정 &gt; 학원 기본 정보</strong>에 등록된 전화번호로 발송됩니다.
              발신번호는 Naver Cloud SENS에 사전 등록되어 있어야 합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 최근 발송 내역 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">최근 발송 내역</h2>

        {logsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">발송 내역이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">발송시간</th>
                  <th className="text-left py-2 px-2">수신자</th>
                  <th className="text-left py-2 px-2">전화번호</th>
                  <th className="text-left py-2 px-2">내용</th>
                  <th className="text-left py-2 px-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2 px-2">{log.recipient_name || '-'}</td>
                    <td className="py-2 px-2">{log.recipient_phone}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={log.message_content}>
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
