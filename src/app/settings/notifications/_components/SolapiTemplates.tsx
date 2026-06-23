'use client';

// Phase 4 #1 — 솔라피 템플릿 탭 + 5개 템플릿 폼 sub-component
import { DollarSign, AlertCircle, Bell, GraduationCap, Clock, Image, ClipboardCheck } from 'lucide-react';
import { NotificationSettings, ConsultationButton } from '@/lib/api/notifications';
import { TemplateType } from '../_types';
import AlimtalkPreview from './AlimtalkPreview';
import ButtonEditor from './ButtonEditor';

interface Props {
  settings: NotificationSettings;
  setSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  activeTemplate: TemplateType;
  setActiveTemplate: (t: TemplateType) => void;
  academyName: string;
  saving: boolean;
  onSave: () => void;
  // 테스트
  testing: boolean;
  testPhone: string;
  setTestPhone: (v: string) => void;
  onTest: () => void;
  sendingUnpaid: boolean;
  onSendUnpaid: () => void;
  testingConsultation: boolean;
  testPhoneConsultation: string;
  setTestPhoneConsultation: (v: string) => void;
  onTestConsultation: () => void;
  testingTrial: boolean;
  testPhoneTrial: string;
  setTestPhoneTrial: (v: string) => void;
  onTestTrial: () => void;
  testingOverdue: boolean;
  testPhoneOverdue: string;
  setTestPhoneOverdue: (v: string) => void;
  onTestOverdue: () => void;
  testingReminder: boolean;
  testPhoneReminder: string;
  setTestPhoneReminder: (v: string) => void;
  onTestReminder: () => void;
  testingAttendance: boolean;
  testPhoneAttendance: string;
  setTestPhoneAttendance: (v: string) => void;
  onTestAttendance: () => void;
  // 버튼 핸들러
  addUnpaidButton: () => void;
  removeUnpaidButton: (i: number) => void;
  updateUnpaidButton: (i: number, f: keyof ConsultationButton, v: string) => void;
  addConsultationButton: () => void;
  removeConsultationButton: (i: number) => void;
  updateConsultationButton: (i: number, f: keyof ConsultationButton, v: string) => void;
  addTrialButton: () => void;
  removeTrialButton: (i: number) => void;
  updateTrialButton: (i: number, f: keyof ConsultationButton, v: string) => void;
  addOverdueButton: () => void;
  removeOverdueButton: (i: number) => void;
  updateOverdueButton: (i: number, f: keyof ConsultationButton, v: string) => void;
  addReminderButton: () => void;
  removeReminderButton: (i: number) => void;
  updateReminderButton: (i: number, f: keyof ConsultationButton, v: string) => void;
}

export default function SolapiTemplates({
  settings, setSettings, activeTemplate, setActiveTemplate, academyName,
  saving, onSave,
  testing, testPhone, setTestPhone, onTest, sendingUnpaid, onSendUnpaid,
  testingConsultation, testPhoneConsultation, setTestPhoneConsultation, onTestConsultation,
  testingTrial, testPhoneTrial, setTestPhoneTrial, onTestTrial,
  testingOverdue, testPhoneOverdue, setTestPhoneOverdue, onTestOverdue,
  testingReminder, testPhoneReminder, setTestPhoneReminder, onTestReminder,
  testingAttendance, testPhoneAttendance, setTestPhoneAttendance, onTestAttendance,
  addUnpaidButton, removeUnpaidButton, updateUnpaidButton,
  addConsultationButton, removeConsultationButton, updateConsultationButton,
  addTrialButton, removeTrialButton, updateTrialButton,
  addOverdueButton, removeOverdueButton, updateOverdueButton,
  addReminderButton, removeReminderButton, updateReminderButton,
}: Props) {
  return (
    <>
      {/* 템플릿 선택 탭 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">알림톡 템플릿 설정</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveTemplate('unpaid')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'unpaid' ? 'bg-orange-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <DollarSign className="w-4 h-4" />납부 안내 알림톡
            {settings.solapi_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'unpaid' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
          <button onClick={() => setActiveTemplate('overdue')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'overdue' ? 'bg-red-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <AlertCircle className="w-4 h-4" />미납자 알림톡
            {settings.solapi_overdue_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'overdue' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
          <button onClick={() => setActiveTemplate('consultation')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'consultation' ? 'bg-green-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <Bell className="w-4 h-4" />상담확정 알림톡
            {settings.solapi_consultation_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'consultation' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
          <button onClick={() => setActiveTemplate('trial')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'trial' ? 'bg-blue-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <GraduationCap className="w-4 h-4" />체험수업 알림톡
            {settings.solapi_trial_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'trial' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
          <button onClick={() => setActiveTemplate('reminder')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'reminder' ? 'bg-purple-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <Clock className="w-4 h-4" />상담 리마인드
            {settings.solapi_reminder_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'reminder' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
          <button onClick={() => setActiveTemplate('attendance')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTemplate === 'attendance' ? 'bg-teal-600 text-white' : 'bg-muted text-foreground hover:bg-muted/80'}`}>
            <ClipboardCheck className="w-4 h-4" />출결관리 알림톡
            {settings.solapi_attendance_template_id && <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'attendance' ? 'bg-card/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>}
          </button>
        </div>
      </div>

      {/* 납부 안내 */}
      {activeTemplate === 'unpaid' && (
        <div className="bg-card rounded-lg shadow-sm border border-orange-200 dark:border-orange-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.solapi_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_template_content: e.target.value }))}
                rows={10} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                placeholder={`안녕하세요, 맥스체대입시입니다.\n#{이름} 학생의 #{월}월 학원비가 미납되었습니다.\n금액: #{금액}원`} />
            </div>
            <div className="md:col-span-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[['#{이름}','학생명'],['#{월}','청구 월'],['#{교육비}','교육비'],['#{날짜}','납부일'],['#{학원명}','학원 이름'],['#{학원전화}','학원 전화']].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{code}</code><span className="text-muted-foreground">{label}</span></div>
                ))}
              </div>
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.solapi_image_url || ''} onChange={e => setSettings(prev => ({ ...prev, solapi_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="https://example.com/image.jpg" />
              <p className="text-xs text-muted-foreground mt-1">솔라피 콘솔에서 이미지 업로드 후 URL을 입력하세요. 이미지 알림톡 템플릿인 경우에만 필요합니다.</p>
            </div>
            <ButtonEditor buttons={settings.solapi_buttons || []} onAdd={addUnpaidButton} onRemove={removeUnpaidButton} onUpdate={updateUnpaidButton} colorScheme="orange" />
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_template_content} imageUrl={settings.solapi_image_url} buttons={settings.solapi_buttons}
              replacements={{'#{이름}':'홍길동','#{월}':'12','#{교육비}':'300,000','#{날짜}':'10일','#{학원명}':academyName,'#{학원전화}':'010-0000-0000'}} />
            {/* 테스트 및 수동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">테스트 및 수동 발송</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">테스트 발송</label>
                  <div className="flex gap-3">
                    <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                      className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="010-1234-5678" />
                    <button onClick={onTest} disabled={testing || !settings.solapi_enabled}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed">
                      {testing ? '발송 중...' : '테스트'}
                    </button>
                  </div>
                  {!settings.solapi_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 활성화해야 테스트 발송이 가능합니다</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">미납자 수동 발송</label>
                  <button onClick={onSendUnpaid} disabled={sendingUnpaid || !settings.solapi_enabled}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {sendingUnpaid ? '발송 중...' : `${new Date().getMonth() + 1}월 미납자에게 즉시 발송`}
                  </button>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '납부 안내 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담확정 */}
      {activeTemplate === 'consultation' && (
        <div className="bg-card rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_consultation_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_consultation_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.solapi_consultation_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_consultation_template_content: e.target.value }))}
                rows={10} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                placeholder={`안녕하세요, 맥스체대입시입니다.\n#{이름}님의 상담 예약이 확정되었습니다.\n■ 상담 일시: #{날짜} #{시간}\n■ 예약번호: #{예약번호}\n일정 변경이 필요하시면 아래 버튼을 눌러주세요.`} />
            </div>
            <div className="md:col-span-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[['#{이름}','학생명'],['#{날짜}','상담일'],['#{시간}','상담시간'],['#{예약번호}','예약번호']].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-green-700 dark:text-green-300">{code}</code><span className="text-muted-foreground">{label}</span></div>
                ))}
              </div>
            </div>
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_consultation_template_content} imageUrl={settings.solapi_consultation_image_url} buttons={settings.solapi_consultation_buttons}
              replacements={{'#{이름}':'홍길동','#{날짜}':'12월 20일','#{시간}':'14:00','#{예약번호}':'C20251215001','#{학원명}':academyName}} />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.solapi_consultation_image_url || ''} onChange={e => setSettings(prev => ({ ...prev, solapi_consultation_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)" />
              <p className="text-xs text-muted-foreground mt-1">솔라피 콘솔에서 이미지 업로드 후 URL을 입력하세요. 이미지 알림톡 템플릿인 경우에만 필요합니다.</p>
            </div>
            <ButtonEditor buttons={settings.solapi_consultation_buttons || []} onAdd={addConsultationButton} onRemove={removeConsultationButton} onUpdate={updateConsultationButton} colorScheme="green" />
            <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200"><strong>자동 발송:</strong> 상담 예약을 &apos;확정&apos;으로 변경하면 자동으로 발송됩니다.</p>
            </div>
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">테스트 발송</h4>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneConsultation} onChange={e => setTestPhoneConsultation(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="010-1234-5678" />
                <button onClick={onTestConsultation} disabled={testingConsultation || !settings.solapi_enabled || !settings.solapi_consultation_template_id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {testingConsultation ? '발송 중...' : '테스트'}
                </button>
              </div>
              {!settings.solapi_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
              {settings.solapi_enabled && !settings.solapi_consultation_template_id && <p className="text-sm text-amber-600 mt-1">템플릿 ID를 먼저 설정해야 테스트 발송이 가능합니다</p>}
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '상담확정 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 체험수업 */}
      {activeTemplate === 'trial' && (
        <div className="bg-card rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_trial_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_trial_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.solapi_trial_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_trial_template_content: e.target.value }))}
                rows={10} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder={`안녕하세요, #{학원명}입니다.\n#{이름}님의 체험수업 일정을 안내드립니다.\n■ 체험수업 일시\n#{체험일정}\n일정 변경은 카카오톡 채널로 문의해주세요.`} />
            </div>
            <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">사용 가능한 변수</p>
              <div className="space-y-2 text-xs">
                {[['#{이름}','홍길동'],['#{학원명}',academyName],['#{체험일정}','✓ 1회차: 12/18(수) 18:30\n2회차: 12/20(금) 18:30']].map(([code, ex]) => (
                  <div key={code} className="flex items-start gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300 shrink-0">{code}</code><span className="text-muted-foreground">→</span><span className="text-foreground font-medium whitespace-pre-line">{ex}</span></div>
                ))}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">* 체험일정은 학생의 실제 체험 날짜로 자동 생성됩니다</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">* 완료된 회차는 ✓ 체크 표시가 붙습니다</p>
            </div>
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_trial_template_content} imageUrl={settings.solapi_trial_image_url} buttons={settings.solapi_trial_buttons}
              replacements={{'#{이름}':'홍길동','#{학원명}':academyName,'#{체험일정}':'✓ 1회차: 12/18(수) 18:30\n2회차: 12/20(금) 18:30'}} />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.solapi_trial_image_url || ''} onChange={e => setSettings(prev => ({ ...prev, solapi_trial_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)" />
            </div>
            <ButtonEditor buttons={settings.solapi_trial_buttons || []} onAdd={addTrialButton} onRemove={removeTrialButton} onUpdate={updateTrialButton} colorScheme="blue" />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">자동 발송 설정</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-foreground">자동 발송</p><p className="text-sm text-muted-foreground">체험수업이 있는 날 지정 시간에 자동 발송</p></div>
                  <button onClick={() => setSettings(prev => ({ ...prev, solapi_trial_auto_enabled: !prev.solapi_trial_auto_enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.solapi_trial_auto_enabled ? 'bg-blue-600' : 'bg-muted'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${settings.solapi_trial_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">자동 발송 시간</label>
                  <div className="flex items-center gap-3">
                    <select value={settings.solapi_trial_auto_hour ?? 9} onChange={e => setSettings(prev => ({ ...prev, solapi_trial_auto_hour: parseInt(e.target.value) }))}
                      className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      {[...Array(24)].map((_, h) => <option key={h} value={h}>{h.toString().padStart(2,'0')}:00</option>)}
                    </select>
                    <span className="text-sm text-muted-foreground">체험수업 당일 {(settings.solapi_trial_auto_hour ?? 9).toString().padStart(2,'0')}시에 발송</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200"><strong>발송 대상:</strong> 오늘 체험수업이 예정된 체험생</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">테스트 발송</h4>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneTrial} onChange={e => setTestPhoneTrial(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="010-1234-5678" />
                <button onClick={onTestTrial} disabled={testingTrial || !settings.solapi_enabled || !settings.solapi_trial_template_id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {testingTrial ? '발송 중...' : '테스트'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '체험수업 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미납자 */}
      {activeTemplate === 'overdue' && (
        <div className="bg-card rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_overdue_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_overdue_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.solapi_overdue_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_overdue_template_content: e.target.value }))}
                rows={10} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm"
                placeholder={`안녕하세요 #{학원명}입니다.\n#{이름} 학생의 #{월}월 납부일이 #{날짜}입니다.\n#{교육비}원이 미납되어 알려드립니다.\n바쁘시겠지만, 납부 부탁드립니다.`} />
            </div>
            <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[['#{이름}','학생명'],['#{월}','청구 월'],['#{교육비}','교육비'],['#{날짜}','납부일'],['#{학원명}','학원 이름'],['#{학원전화}','학원 전화']].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-red-700 dark:text-red-300">{code}</code><span className="text-muted-foreground">{label}</span></div>
                ))}
              </div>
            </div>
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_overdue_template_content} imageUrl={settings.solapi_overdue_image_url} buttons={settings.solapi_overdue_buttons}
              replacements={{'#{이름}':'홍길동','#{월}':'12','#{교육비}':'300,000','#{날짜}':'10일','#{학원명}':academyName,'#{학원전화}':'010-0000-0000'}} />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.solapi_overdue_image_url || ''} onChange={e => setSettings(prev => ({ ...prev, solapi_overdue_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)" />
            </div>
            <ButtonEditor buttons={settings.solapi_overdue_buttons || []} onAdd={addOverdueButton} onRemove={removeOverdueButton} onUpdate={updateOverdueButton} colorScheme="red" />
            {/* 발송 안내 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">발송 안내</h4>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200"><strong>발송 대상:</strong> 해당 월 두 번째 수업일부터 미납 상태인 학생</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">* 첫 수업일에는 &apos;납부 안내 알림톡&apos;이 발송됩니다</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200"><strong>발송 시간:</strong> 납부 안내 알림톡과 동일한 시간에 발송됩니다</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-3">테스트 발송</h4>
              <div className="flex gap-2">
                <input type="tel" value={testPhoneOverdue} onChange={e => setTestPhoneOverdue(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={onTestOverdue} disabled={testingOverdue || !settings.solapi_enabled || !settings.solapi_overdue_template_id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                  {testingOverdue ? '발송 중...' : '테스트'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '미납자 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담 리마인드 */}
      {activeTemplate === 'reminder' && (
        <div className="bg-card rounded-lg shadow-sm border border-purple-200 dark:border-purple-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_reminder_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_reminder_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.solapi_reminder_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_reminder_template_content: e.target.value }))}
                rows={10} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                placeholder={`안녕하세요, #{학원명}입니다.\n#{이름}님, 예약하신 상담이 #{남은시간} 후로 예정되어 있습니다.\n■ 상담 일정\n#{날짜} #{시간}\n문의사항은 카카오톡 채널로 연락주세요.`} />
            </div>
            <div className="md:col-span-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[['#{이름}','학생/학부모명'],['#{날짜}','상담 날짜'],['#{시간}','상담 시간'],['#{남은시간}','1시간, 2시간 등'],['#{예약번호}','상담 예약번호'],['#{학원명}','학원 이름']].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-purple-700 dark:text-purple-300">{code}</code><span className="text-muted-foreground">{label}</span></div>
                ))}
              </div>
            </div>
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_reminder_template_content} imageUrl={settings.solapi_reminder_image_url} buttons={settings.solapi_reminder_buttons}
              replacements={{'#{이름}':'홍길동','#{학원명}':academyName,'#{날짜}':'1월 15일(수)','#{시간}':'14:00','#{남은시간}':'1시간','#{예약번호}':'C2025011501'}}
              timeLabel="오전 10:00" />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.solapi_reminder_image_url || ''} onChange={e => setSettings(prev => ({ ...prev, solapi_reminder_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)" />
            </div>
            <ButtonEditor buttons={settings.solapi_reminder_buttons || []} onAdd={addReminderButton} onRemove={removeReminderButton} onUpdate={updateReminderButton} colorScheme="purple" />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">자동 발송 설정</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-foreground">자동 발송</p><p className="text-sm text-muted-foreground">상담 N시간 전에 자동으로 리마인드 알림톡 발송</p></div>
                  <button onClick={() => setSettings(prev => ({ ...prev, solapi_reminder_auto_enabled: !prev.solapi_reminder_auto_enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.solapi_reminder_auto_enabled ? 'bg-purple-600' : 'bg-muted'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${settings.solapi_reminder_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">발송 시점 (상담 몇 시간 전)</label>
                  <div className="flex items-center gap-3">
                    <select value={settings.solapi_reminder_hours ?? 1} onChange={e => setSettings(prev => ({ ...prev, solapi_reminder_hours: parseInt(e.target.value) }))}
                      className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      <option value={1}>1시간 전</option><option value={2}>2시간 전</option><option value={3}>3시간 전</option>
                      <option value={6}>6시간 전</option><option value={12}>12시간 전</option><option value={24}>24시간 전 (하루 전)</option>
                    </select>
                    <span className="text-sm text-muted-foreground">상담 {settings.solapi_reminder_hours ?? 1}시간 전에 발송</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-800 dark:text-purple-200"><strong>발송 대상:</strong> 확정(confirmed) 상태의 상담 예약</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">테스트 발송</h4>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneReminder} onChange={e => setTestPhoneReminder(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="010-1234-5678" />
                <button onClick={onTestReminder} disabled={testingReminder || !settings.solapi_enabled || !settings.solapi_reminder_template_id}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {testingReminder ? '발송 중...' : '테스트'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '상담 리마인드 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 출결관리 */}
      {activeTemplate === 'attendance' && (
        <div className="bg-card rounded-lg shadow-sm border border-teal-200 dark:border-teal-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">출결 알림톡 발송</p>
                <p className="text-sm text-muted-foreground">출결 기록 시 보호자에게 자동으로 알림톡 발송</p>
              </div>
              <button onClick={() => setSettings(prev => ({ ...prev, attendance_alimtalk_enabled: !prev.attendance_alimtalk_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.attendance_alimtalk_enabled ? 'bg-teal-600' : 'bg-muted'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${settings.attendance_alimtalk_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input type="text" value={settings.solapi_attendance_template_id} onChange={e => setSettings(prev => ({ ...prev, solapi_attendance_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="KA01TP..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용 · 솔라피 승인본과 동일하게)</label>
              <textarea value={settings.solapi_attendance_template_content} onChange={e => setSettings(prev => ({ ...prev, solapi_attendance_template_content: e.target.value }))}
                rows={6} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                placeholder={`안녕하세요. #{학원명}입니다.\n#{이름} 학생이 #{월}월 #{일}일 #{요일}요일 수업 #{출결상태}하였습니다.`} />
            </div>
            <div className="md:col-span-2 p-3 bg-teal-50 dark:bg-teal-950 rounded-lg border border-teal-200 dark:border-teal-800">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[['#{학원명}','학원 이름'],['#{이름}','학생명'],['#{월}','월'],['#{일}','일'],['#{요일}','요일'],['#{출결상태}','출석/지각/결석']].map(([code, label]) => (
                  <div key={code} className="flex items-center gap-2"><code className="bg-card px-2 py-1 rounded border border-border text-teal-700 dark:text-teal-300">{code}</code><span className="text-muted-foreground">{label}</span></div>
                ))}
              </div>
            </div>
            <AlimtalkPreview academyName={academyName} templateContent={settings.solapi_attendance_template_content} imageUrl="" buttons={[]}
              replacements={{'#{학원명}':academyName,'#{이름}':'홍길동','#{월}':'5월','#{일}':'18일','#{요일}':'월','#{출결상태}':'출석'}} />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-foreground mb-4">테스트 발송</h4>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneAttendance} onChange={e => setTestPhoneAttendance(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="010-1234-5678" />
                <button onClick={onTestAttendance} disabled={testingAttendance || !settings.solapi_enabled || !settings.solapi_attendance_template_id}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {testingAttendance ? '발송 중...' : '테스트'}
                </button>
              </div>
              {!settings.solapi_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
              {settings.solapi_enabled && !settings.solapi_attendance_template_id && <p className="text-sm text-amber-600 mt-1">템플릿 ID를 먼저 설정해야 테스트 발송이 가능합니다</p>}
            </div>
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '출결관리 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
