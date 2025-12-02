'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, Users, User, UserCheck, Phone, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { smsAPI } from '@/lib/api/sms';
import { toast } from 'sonner';

type Target = 'all' | 'students' | 'parents' | 'custom';

export default function SMSPage() {
  const [target, setTarget] = useState<Target>('all');
  const [content, setContent] = useState('');
  const [customPhones, setCustomPhones] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientsCount, setRecipientsCount] = useState({ all: 0, students: 0, parents: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const handleSend = async () => {
    if (!content.trim()) {
      toast.error('문자 내용을 입력해주세요.');
      return;
    }

    if (target === 'custom' && !customPhones.trim()) {
      toast.error('전화번호를 입력해주세요.');
      return;
    }

    const recipientCount = target === 'custom'
      ? customPhones.split(/[\n,]/).filter(p => p.trim()).length
      : recipientsCount[target];

    if (recipientCount === 0) {
      toast.error('발송할 수신자가 없습니다.');
      return;
    }

    if (!confirm(`${recipientCount}명에게 문자를 발송하시겠습니까?\n\n※ 80byte 초과 시 LMS로 자동 전환됩니다.`)) {
      return;
    }

    setSending(true);
    try {
      const phones = target === 'custom'
        ? customPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
        : undefined;

      const result = await smsAPI.send({
        target,
        content,
        customPhones: phones,
      });

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
  const contentBytes = Buffer.from(content, 'utf8').length;
  const isLMS = contentBytes > 80;

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

        {/* 수신 대상 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">수신 대상</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setTarget('all')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'all'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users className={`w-6 h-6 mx-auto mb-2 ${target === 'all' ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">모두</div>
              <div className="text-xs text-gray-500">{recipientsCount.all}명</div>
            </button>

            <button
              type="button"
              onClick={() => setTarget('students')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'students'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className={`w-6 h-6 mx-auto mb-2 ${target === 'students' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">학생에게</div>
              <div className="text-xs text-gray-500">{recipientsCount.students}명</div>
            </button>

            <button
              type="button"
              onClick={() => setTarget('parents')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'parents'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <UserCheck className={`w-6 h-6 mx-auto mb-2 ${target === 'parents' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">학부모에게</div>
              <div className="text-xs text-gray-500">{recipientsCount.parents}명</div>
            </button>

            <button
              type="button"
              onClick={() => setTarget('custom')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'custom'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Phone className={`w-6 h-6 mx-auto mb-2 ${target === 'custom' ? 'text-orange-600' : 'text-gray-400'}`} />
              <div className="text-sm font-medium">직접 입력</div>
              <div className="text-xs text-gray-500">번호 직접 입력</div>
            </button>
          </div>
        </div>

        {/* 직접 입력 시 전화번호 입력 */}
        {target === 'custom' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 입력 (쉼표 또는 줄바꿈으로 구분)
            </label>
            <textarea
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="010-1234-5678, 010-9876-5432&#10;또는 줄바꿈으로 구분"
            />
          </div>
        )}

        {/* 문자 내용 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            문자 내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="안녕하세요, 파파체대입니다.&#10;&#10;내용을 입력해주세요..."
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
