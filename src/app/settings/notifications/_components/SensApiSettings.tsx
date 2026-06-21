'use client';

// Phase 4 #1 — SENS API 설정 sub-component
import { Key } from 'lucide-react';
import { NotificationSettings } from '@/lib/api/notifications';
import { SenderNumber } from '../_types';
import SenderNumberManager from './SenderNumberManager';

interface Props {
  settings: NotificationSettings;
  setSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  senderNumbers: SenderNumber[];
  newSenderPhone: string;
  setNewSenderPhone: (v: string) => void;
  newSenderLabel: string;
  setNewSenderLabel: (v: string) => void;
  addingSender: boolean;
  onAddSender: () => void;
  onSetDefaultSender: (id: number) => void;
  onDeleteSender: (id: number) => void;
}

export default function SensApiSettings({
  settings,
  setSettings,
  senderNumbers,
  newSenderPhone,
  setNewSenderPhone,
  newSenderLabel,
  setNewSenderLabel,
  addingSender,
  onAddSender,
  onSetDefaultSender,
  onDeleteSender,
}: Props) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-green-600" />
        <h2 className="text-lg font-semibold text-foreground">네이버 SENS API 설정</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Naver Cloud Access Key</label>
          <input
            type="text"
            value={settings.naver_access_key}
            onChange={e => setSettings(prev => ({ ...prev, naver_access_key: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Access Key ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Naver Cloud Secret Key</label>
          <input
            type="password"
            value={settings.naver_secret_key}
            onChange={e => setSettings(prev => ({ ...prev, naver_secret_key: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder={settings.has_secret_key ? '저장됨 (변경하려면 새로 입력)' : 'Secret Key'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">알림톡 Service ID</label>
          <input
            type="text"
            value={settings.naver_service_id}
            onChange={e => setSettings(prev => ({ ...prev, naver_service_id: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="ncp:kkobizmsg:kr:..."
          />
          <p className="text-xs text-muted-foreground mt-1">알림톡 전용 (SENS &gt; 알림톡 &gt; 프로젝트)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">SMS Service ID</label>
          <input
            type="text"
            value={settings.sms_service_id}
            onChange={e => setSettings(prev => ({ ...prev, sms_service_id: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="ncp:sms:kr:..."
          />
          <p className="text-xs text-muted-foreground mt-1">SMS 전용 (SENS &gt; SMS &gt; 프로젝트)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">KakaoTalk 채널 ID</label>
          <input
            type="text"
            value={settings.kakao_channel_id}
            onChange={e => setSettings(prev => ({ ...prev, kakao_channel_id: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="@채널ID"
          />
        </div>

        <SenderNumberManager
          senderNumbers={senderNumbers}
          newSenderPhone={newSenderPhone}
          setNewSenderPhone={setNewSenderPhone}
          newSenderLabel={newSenderLabel}
          setNewSenderLabel={setNewSenderLabel}
          addingSender={addingSender}
          onAdd={onAddSender}
          onSetDefault={onSetDefaultSender}
          onDelete={onDeleteSender}
          colorScheme="green"
          hint="* SENS에 등록된 발신번호를 추가하세요. 문자 보내기에서 발신번호를 선택할 수 있습니다."
        />
      </div>

      <p className="text-sm text-muted-foreground mt-4">
        ※ 템플릿 코드와 본문은 아래 &apos;알림톡 템플릿 설정&apos; 섹션의 각 템플릿 탭에서 설정합니다.
      </p>
    </div>
  );
}
