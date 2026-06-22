'use client';

import React from 'react';
import { DollarSign, AlertCircle, Bell, GraduationCap, Clock, Image, Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { NotificationSettings, ConsultationButton } from '@/lib/api/notifications';
import type { TemplateType } from '../_types';

interface SensTemplatesProps {
  activeTab: string;
  activeSensTemplate: TemplateType;
  setActiveSensTemplate: (t: TemplateType) => void;
  settings: NotificationSettings;
  setSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  saving: boolean;
  testing: boolean;
  testPhone: string;
  setTestPhone: (v: string) => void;
  testingSensConsultation: boolean;
  testingSensTrial: boolean;
  testingSensOverdue: boolean;
  testingSensReminder: boolean;
  testingSensAttendance: boolean;
  testPhoneSensConsultation: string;
  setTestPhoneSensConsultation: (v: string) => void;
  testPhoneSensTrial: string;
  setTestPhoneSensTrial: (v: string) => void;
  testPhoneSensOverdue: string;
  setTestPhoneSensOverdue: (v: string) => void;
  testPhoneSensReminder: string;
  setTestPhoneSensReminder: (v: string) => void;
  testPhoneSensAttendance: string;
  setTestPhoneSensAttendance: (v: string) => void;
  handleSave: () => void;
  handleTest: () => void;
  handleTestSensConsultation: () => void;
  handleTestSensTrial: () => void;
  handleTestSensOverdue: () => void;
  handleTestSensReminder: () => void;
  handleTestSensAttendance: () => void;
  addSensUnpaidButton: () => void;
  removeSensUnpaidButton: (i: number) => void;
  updateSensUnpaidButton: (i: number, field: keyof ConsultationButton, value: string) => void;
  addSensConsultationButton: () => void;
  removeSensConsultationButton: (i: number) => void;
  updateSensConsultationButton: (i: number, field: keyof ConsultationButton, value: string) => void;
  addSensTrialButton: () => void;
  removeSensTrialButton: (i: number) => void;
  updateSensTrialButton: (i: number, field: keyof ConsultationButton, value: string) => void;
  addSensOverdueButton: () => void;
  removeSensOverdueButton: (i: number) => void;
  updateSensOverdueButton: (i: number, field: keyof ConsultationButton, value: string) => void;
  addSensReminderButton: () => void;
  removeSensReminderButton: (i: number) => void;
  updateSensReminderButton: (i: number, field: keyof ConsultationButton, value: string) => void;
}

const BUTTON_OPTIONS = [
  { value: 'WL', label: '웹링크 (WL)' },
  { value: 'AL', label: '앱링크 (AL)' },
  { value: 'BK', label: '봇키워드 (BK)' },
  { value: 'MD', label: '메시지전달 (MD)' },
];

function ButtonList({
  buttons,
  onAdd,
  onRemove,
  onUpdate,
  addColor,
}: {
  buttons: ConsultationButton[] | undefined;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: keyof ConsultationButton, value: string) => void;
  addColor: string;
}) {
  return (
    <div className="md:col-span-2 border-t border-border pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-foreground">버튼 설정</h4>
        <button
          type="button"
          onClick={onAdd}
          disabled={(buttons?.length || 0) >= 5}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm ${addColor} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus className="w-4 h-4" />버튼 추가
        </button>
      </div>
      {(buttons?.length || 0) === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">버튼이 없습니다. 템플릿에 버튼이 있다면 위의 &quot;버튼 추가&quot; 버튼을 클릭하세요.</p>
      ) : (
        <div className="space-y-4">
          {buttons?.map((button, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">버튼 {index + 1}</span>
                <button type="button" onClick={() => onRemove(index)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">버튼 타입</label>
                  <select
                    value={button.buttonType}
                    onChange={(e) => onUpdate(index, 'buttonType', e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                  >
                    {BUTTON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">버튼 이름</label>
                  <input
                    type="text"
                    value={button.buttonName || ''}
                    onChange={(e) => onUpdate(index, 'buttonName', e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                    placeholder="버튼 텍스트"
                  />
                </div>
                {button.buttonType === 'WL' && (
                  <>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">모바일 링크</label>
                      <input type="url" value={button.linkMo || ''} onChange={(e) => onUpdate(index, 'linkMo', e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">PC 링크</label>
                      <input type="url" value={button.linkPc || ''} onChange={(e) => onUpdate(index, 'linkPc', e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm" placeholder="https://..." />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SensTemplates({
  activeTab,
  activeSensTemplate,
  setActiveSensTemplate,
  settings,
  setSettings,
  saving,
  testing,
  testPhone,
  setTestPhone,
  testingSensConsultation,
  testingSensTrial,
  testingSensOverdue,
  testingSensReminder,
  testingSensAttendance,
  testPhoneSensConsultation,
  setTestPhoneSensConsultation,
  testPhoneSensTrial,
  setTestPhoneSensTrial,
  testPhoneSensOverdue,
  setTestPhoneSensOverdue,
  testPhoneSensReminder,
  setTestPhoneSensReminder,
  testPhoneSensAttendance,
  setTestPhoneSensAttendance,
  handleSave,
  handleTest,
  handleTestSensConsultation,
  handleTestSensTrial,
  handleTestSensOverdue,
  handleTestSensReminder,
  handleTestSensAttendance,
  addSensUnpaidButton,
  removeSensUnpaidButton,
  updateSensUnpaidButton,
  addSensConsultationButton,
  removeSensConsultationButton,
  updateSensConsultationButton,
  addSensTrialButton,
  removeSensTrialButton,
  updateSensTrialButton,
  addSensOverdueButton,
  removeSensOverdueButton,
  updateSensOverdueButton,
  addSensReminderButton,
  removeSensReminderButton,
  updateSensReminderButton,
}: SensTemplatesProps) {
  if (activeTab !== 'sens') return null;

  return (
    <>
      {/* SENS 템플릿 선택 탭 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">SENS 알림톡 템플릿 설정</h2>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'unpaid' as TemplateType, label: '납부 안내', icon: <DollarSign className="w-4 h-4" />, activeColor: 'bg-orange-600', setCode: settings.template_code },
            { key: 'overdue' as TemplateType, label: '미납자', icon: <AlertCircle className="w-4 h-4" />, activeColor: 'bg-red-600', setCode: settings.sens_overdue_template_code },
            { key: 'consultation' as TemplateType, label: '상담확정', icon: <Bell className="w-4 h-4" />, activeColor: 'bg-green-600', setCode: settings.sens_consultation_template_code },
            { key: 'trial' as TemplateType, label: '체험수업', icon: <GraduationCap className="w-4 h-4" />, activeColor: 'bg-blue-600', setCode: settings.sens_trial_template_code },
            { key: 'reminder' as TemplateType, label: '상담 리마인드', icon: <Clock className="w-4 h-4" />, activeColor: 'bg-purple-600', setCode: settings.sens_reminder_template_code },
            { key: 'attendance' as TemplateType, label: '출결관리', icon: <ClipboardCheck className="w-4 h-4" />, activeColor: 'bg-teal-600', setCode: settings.sens_attendance_template_code },
          ].map(({ key, label, icon, activeColor, setCode }) => (
            <button
              key={key}
              onClick={() => setActiveSensTemplate(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeSensTemplate === key ? `${activeColor} text-white` : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {icon}
              {label}
              {setCode && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeSensTemplate === key ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SENS 납부안내 템플릿 */}
      {activeSensTemplate === 'unpaid' && (
        <div className="bg-card rounded-lg shadow-sm border border-orange-200 dark:border-orange-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input
                type="text"
                value={settings.template_code}
                onChange={e => setSettings(prev => ({ ...prev, template_code: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="템플릿 코드 (SENS 콘솔에서 확인)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea
                value={settings.template_content}
                onChange={e => setSettings(prev => ({ ...prev, template_content: e.target.value }))}
                rows={8}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                placeholder={`[#{학원명}] 학원비 납부 안내\n\n안녕하세요, #{이름} 학부모님.\n#{월}월 학원비 #{교육비}원이 아직 납부되지 않았습니다.`}
              />
            </div>
            {/* 사용 가능한 변수 */}
            <div className="md:col-span-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[['#{이름}', '학생명'], ['#{월}', '청구 월'], ['#{교육비}', '교육비'], ['#{날짜}', '납부일'], ['#{학원명}', '학원 이름'], ['#{학원전화}', '학원 전화']].map(([code, desc]) => (
                  <div key={code} className="flex items-center gap-2">
                    <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{code}</code>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Image className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-foreground">이미지 설정 (선택)</h4>
              </div>
              <input
                type="url"
                value={settings.sens_image_url || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, sens_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground mt-1">SENS 콘솔에서 이미지 업로드 후 URL을 입력하세요. 이미지 알림톡 템플릿인 경우에만 필요합니다.</p>
            </div>
            {/* 버튼 */}
            <ButtonList
              buttons={settings.sens_buttons}
              onAdd={addSensUnpaidButton}
              onRemove={removeSensUnpaidButton}
              onUpdate={updateSensUnpaidButton}
              addColor="bg-orange-600 hover:bg-orange-700"
            />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-foreground">수업일 자동 발송</p>
                  <p className="text-sm text-muted-foreground">학생의 수업이 있는 날에만 자동 발송</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, sens_auto_enabled: !prev.sens_auto_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sens_auto_enabled ? 'bg-orange-600' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.sens_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {settings.sens_auto_enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-foreground">발송 시간:</label>
                  <select
                    value={settings.sens_auto_hour}
                    onChange={e => setSettings(prev => ({ ...prev, sens_auto_hour: parseInt(e.target.value) }))}
                    className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {[...Array(24)].map((_, hour) => (
                      <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">납부안내 테스트 발송</label>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="테스트 전화번호 (예: 01012345678)"
                />
                <button
                  onClick={handleTest}
                  disabled={testing || !settings.is_enabled || !settings.template_code}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {testing ? '발송 중...' : '테스트'}
                </button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
              {settings.is_enabled && !settings.template_code && <p className="text-sm text-amber-600 mt-1">템플릿 코드를 먼저 설정해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {saving ? '저장 중...' : '납부안내 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENS 미납자 템플릿 */}
      {activeSensTemplate === 'overdue' && (
        <div className="bg-card rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input type="text" value={settings.sens_overdue_template_code} onChange={e => setSettings(prev => ({ ...prev, sens_overdue_template_code: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" placeholder="템플릿 코드 (SENS 콘솔에서 확인)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.sens_overdue_template_content} onChange={e => setSettings(prev => ({ ...prev, sens_overdue_template_content: e.target.value }))} rows={8} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm" placeholder={`[#{학원명}] 미납 안내\n\n#{이름} 학생의 학원비가 미납되었습니다.`} />
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.sens_overdue_image_url || ''} onChange={(e) => setSettings(prev => ({ ...prev, sens_overdue_image_url: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" placeholder="https://example.com/image.jpg" />
            </div>
            {/* 버튼 */}
            <ButtonList
              buttons={settings.sens_overdue_buttons}
              onAdd={addSensOverdueButton}
              onRemove={removeSensOverdueButton}
              onUpdate={updateSensOverdueButton}
              addColor="bg-red-600 hover:bg-red-700"
            />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-medium text-foreground">미납자 수업일 자동 발송</p><p className="text-sm text-muted-foreground">미납 학생의 수업이 있는 날에만 자동 발송</p></div>
                <button onClick={() => setSettings(prev => ({ ...prev, sens_overdue_auto_enabled: !prev.sens_overdue_auto_enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sens_overdue_auto_enabled ? 'bg-red-600' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.sens_overdue_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {settings.sens_overdue_auto_enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-foreground">발송 시간:</label>
                  <select value={settings.sens_overdue_auto_hour} onChange={e => setSettings(prev => ({ ...prev, sens_overdue_auto_hour: parseInt(e.target.value) }))} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500">
                    {[...Array(24)].map((_, hour) => (<option key={hour} value={hour}>{hour.toString().padStart(2, '0')}:00</option>))}
                  </select>
                </div>
              )}
            </div>
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">미납자 테스트 발송</label>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneSensOverdue} onChange={e => setTestPhoneSensOverdue(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-red-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={handleTestSensOverdue} disabled={testingSensOverdue || !settings.is_enabled || !settings.sens_overdue_template_code} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{testingSensOverdue ? '발송 중...' : '테스트'}</button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">{saving ? '저장 중...' : '미납자 설정 저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SENS 상담확정 템플릿 */}
      {activeSensTemplate === 'consultation' && (
        <div className="bg-card rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input type="text" value={settings.sens_consultation_template_code} onChange={e => setSettings(prev => ({ ...prev, sens_consultation_template_code: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="템플릿 코드 (SENS 콘솔에서 확인)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.sens_consultation_template_content} onChange={e => setSettings(prev => ({ ...prev, sens_consultation_template_content: e.target.value }))} rows={8} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm" placeholder={`[#{학원명}] 상담 확정 안내\n\n#{이름}님, 상담이 확정되었습니다.`} />
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.sens_consultation_image_url || ''} onChange={(e) => setSettings(prev => ({ ...prev, sens_consultation_image_url: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="https://example.com/image.jpg" />
            </div>
            {/* 버튼 */}
            <ButtonList
              buttons={settings.sens_consultation_buttons}
              onAdd={addSensConsultationButton}
              onRemove={removeSensConsultationButton}
              onUpdate={updateSensConsultationButton}
              addColor="bg-green-600 hover:bg-green-700"
            />
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">상담확정 테스트 발송</label>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneSensConsultation} onChange={e => setTestPhoneSensConsultation(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={handleTestSensConsultation} disabled={testingSensConsultation || !settings.is_enabled || !settings.sens_consultation_template_code} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{testingSensConsultation ? '발송 중...' : '테스트'}</button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">{saving ? '저장 중...' : '상담확정 설정 저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SENS 체험수업 템플릿 */}
      {activeSensTemplate === 'trial' && (
        <div className="bg-card rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input type="text" value={settings.sens_trial_template_code} onChange={e => setSettings(prev => ({ ...prev, sens_trial_template_code: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="템플릿 코드 (SENS 콘솔에서 확인)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.sens_trial_template_content} onChange={e => setSettings(prev => ({ ...prev, sens_trial_template_content: e.target.value }))} rows={8} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm" placeholder={`[#{학원명}] 체험수업 안내\n\n#{이름}님, 오늘 체험수업이 있습니다.`} />
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.sens_trial_image_url || ''} onChange={(e) => setSettings(prev => ({ ...prev, sens_trial_image_url: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/image.jpg" />
            </div>
            {/* 버튼 */}
            <ButtonList
              buttons={settings.sens_trial_buttons}
              onAdd={addSensTrialButton}
              onRemove={removeSensTrialButton}
              onUpdate={updateSensTrialButton}
              addColor="bg-blue-600 hover:bg-blue-700"
            />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-medium text-foreground">체험수업 당일 자동 발송</p><p className="text-sm text-muted-foreground">체험수업 예정일에 자동 발송</p></div>
                <button onClick={() => setSettings(prev => ({ ...prev, sens_trial_auto_enabled: !prev.sens_trial_auto_enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sens_trial_auto_enabled ? 'bg-blue-600' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.sens_trial_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {settings.sens_trial_auto_enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-foreground">발송 시간:</label>
                  <select value={settings.sens_trial_auto_hour} onChange={e => setSettings(prev => ({ ...prev, sens_trial_auto_hour: parseInt(e.target.value) }))} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500">
                    {[...Array(24)].map((_, hour) => (<option key={hour} value={hour}>{hour.toString().padStart(2, '0')}:00</option>))}
                  </select>
                </div>
              )}
            </div>
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">체험수업 테스트 발송</label>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneSensTrial} onChange={e => setTestPhoneSensTrial(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={handleTestSensTrial} disabled={testingSensTrial || !settings.is_enabled || !settings.sens_trial_template_code} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{testingSensTrial ? '발송 중...' : '테스트'}</button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">{saving ? '저장 중...' : '체험수업 설정 저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SENS 상담 리마인드 템플릿 */}
      {activeSensTemplate === 'reminder' && (
        <div className="bg-card rounded-lg shadow-sm border border-purple-200 dark:border-purple-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input type="text" value={settings.sens_reminder_template_code} onChange={e => setSettings(prev => ({ ...prev, sens_reminder_template_code: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="템플릿 코드 (SENS 콘솔에서 확인)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea value={settings.sens_reminder_template_content} onChange={e => setSettings(prev => ({ ...prev, sens_reminder_template_content: e.target.value }))} rows={8} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm" placeholder={`[#{학원명}] 상담 리마인드\n\n#{이름}님, 상담 #{남은시간} 전입니다.\n\n일시: #{날짜} #{시간}\n\n문의: #{학원전화}`} />
              <p className="text-xs text-muted-foreground mt-1">사용 가능 변수: #{`{이름}`}, #{`{날짜}`}, #{`{시간}`}, #{`{남은시간}`}, #{`{예약번호}`}, #{`{학원명}`}, #{`{학원전화}`}</p>
            </div>
            {/* 이미지 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3"><Image className="w-4 h-4 text-muted-foreground" /><h4 className="font-medium text-foreground">이미지 설정 (선택)</h4></div>
              <input type="url" value={settings.sens_reminder_image_url || ''} onChange={(e) => setSettings(prev => ({ ...prev, sens_reminder_image_url: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="https://example.com/image.jpg" />
            </div>
            {/* 버튼 */}
            <ButtonList
              buttons={settings.sens_reminder_buttons}
              onAdd={addSensReminderButton}
              onRemove={removeSensReminderButton}
              onUpdate={updateSensReminderButton}
              addColor="bg-purple-600 hover:bg-purple-700"
            />
            {/* 자동 발송 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-medium text-foreground">상담 리마인드 자동 발송</p><p className="text-sm text-muted-foreground">상담 N시간 전에 자동 발송</p></div>
                <button onClick={() => setSettings(prev => ({ ...prev, sens_reminder_auto_enabled: !prev.sens_reminder_auto_enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sens_reminder_auto_enabled ? 'bg-purple-600' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.sens_reminder_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {settings.sens_reminder_auto_enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-foreground">발송 시점:</label>
                  <select value={settings.sens_reminder_hours} onChange={e => setSettings(prev => ({ ...prev, sens_reminder_hours: parseInt(e.target.value) }))} className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value={1}>1시간 전</option>
                    <option value={2}>2시간 전</option>
                    <option value={3}>3시간 전</option>
                    <option value={6}>6시간 전</option>
                    <option value={12}>12시간 전</option>
                    <option value={24}>24시간 전 (하루 전)</option>
                  </select>
                </div>
              )}
            </div>
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">리마인드 테스트 발송</label>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneSensReminder} onChange={e => setTestPhoneSensReminder(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={handleTestSensReminder} disabled={testingSensReminder || !settings.is_enabled || !settings.sens_reminder_template_code} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{testingSensReminder ? '발송 중...' : '테스트'}</button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">{saving ? '저장 중...' : '상담 리마인드 설정 저장'}</button>
            </div>
          </div>
        </div>
      )}
      {/* SENS 출결관리 템플릿 */}
      {activeSensTemplate === 'attendance' && (
        <div className="bg-card rounded-lg shadow-sm border border-teal-200 dark:border-teal-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">출결 알림톡 발송</p>
                <p className="text-sm text-muted-foreground">출결 기록 시 보호자에게 자동으로 알림톡 발송</p>
              </div>
              <button onClick={() => setSettings(prev => ({ ...prev, attendance_alimtalk_enabled: !prev.attendance_alimtalk_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.attendance_alimtalk_enabled ? 'bg-teal-600' : 'bg-muted'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.attendance_alimtalk_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 코드</label>
              <input type="text" value={settings.sens_attendance_template_code} onChange={e => setSettings(prev => ({ ...prev, sens_attendance_template_code: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="템플릿 코드 (SENS 콘솔에서 확인)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용 · SENS 승인본과 동일하게)</label>
              <textarea value={settings.sens_attendance_template_content} onChange={e => setSettings(prev => ({ ...prev, sens_attendance_template_content: e.target.value }))} rows={6} className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm" placeholder={`안녕하세요. #{학원명}입니다.\n#{이름} 학생이 #{월}월 #{일}일 #{요일}요일 수업 #{출결상태}하였습니다.`} />
              <p className="text-xs text-muted-foreground mt-1">사용 가능 변수: #{`{학원명}`}, #{`{이름}`}, #{`{월}`}, #{`{일}`}, #{`{요일}`}, #{`{출결상태}`}(출석/지각/결석)</p>
            </div>
            {/* 테스트 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <label className="block text-sm font-medium text-foreground mb-2">출결 테스트 발송</label>
              <div className="flex gap-3">
                <input type="tel" value={testPhoneSensAttendance} onChange={e => setTestPhoneSensAttendance(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="테스트 전화번호 (예: 01012345678)" />
                <button onClick={handleTestSensAttendance} disabled={testingSensAttendance || !settings.is_enabled || !settings.sens_attendance_template_code} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">{testingSensAttendance ? '발송 중...' : '테스트'}</button>
              </div>
              {!settings.is_enabled && <p className="text-sm text-amber-600 mt-1">알림톡을 먼저 활성화해야 테스트 발송이 가능합니다</p>}
            </div>
            {/* 저장 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">{saving ? '저장 중...' : '출결관리 설정 저장'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
