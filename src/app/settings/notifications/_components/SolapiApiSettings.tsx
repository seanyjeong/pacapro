'use client';

// Phase 4 #1 — 솔라피 API 설정 sub-component
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

export default function SolapiApiSettings({
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
        <Key className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-foreground">솔라피 API 설정</h2>
        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">공통</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
          <input
            type="text"
            value={settings.solapi_api_key}
            onChange={e => setSettings(prev => ({ ...prev, solapi_api_key: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="API Key"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">API Secret</label>
          <input
            type="password"
            value={settings.solapi_api_secret}
            onChange={e => setSettings(prev => ({ ...prev, solapi_api_secret: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder={settings.has_solapi_secret ? '저장됨 (변경하려면 새로 입력)' : 'API Secret'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">카카오 채널 ID (pfId)</label>
          <input
            type="text"
            value={settings.solapi_pfid}
            onChange={e => setSettings(prev => ({ ...prev, solapi_pfid: e.target.value }))}
            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="KA01PF..."
          />
          <p className="text-xs text-muted-foreground mt-1">솔라피 콘솔에서 확인 가능</p>
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
          colorScheme="purple"
          hint="* 솔라피에 등록된 발신번호를 추가하세요. 문자 보내기에서 발신번호를 선택할 수 있습니다."
        />
      </div>
    </div>
  );
}
