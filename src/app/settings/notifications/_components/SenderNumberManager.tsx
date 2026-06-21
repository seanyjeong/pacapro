'use client';

// Phase 4 #1 — 발신번호 관리 재사용 sub-component (SENS/솔라피 공통)
import { Star, Trash2, Plus, Phone } from 'lucide-react';
import { SenderNumber } from '../_types';

interface Props {
  senderNumbers: SenderNumber[];
  newSenderPhone: string;
  setNewSenderPhone: (v: string) => void;
  newSenderLabel: string;
  setNewSenderLabel: (v: string) => void;
  addingSender: boolean;
  onAdd: () => void;
  onSetDefault: (id: number) => void;
  onDelete: (id: number) => void;
  colorScheme: 'green' | 'purple';
  hint: string;
}

export default function SenderNumberManager({
  senderNumbers,
  newSenderPhone,
  setNewSenderPhone,
  newSenderLabel,
  setNewSenderLabel,
  addingSender,
  onAdd,
  onSetDefault,
  onDelete,
  colorScheme,
  hint,
}: Props) {
  const isGreen = colorScheme === 'green';
  const ringCls = isGreen ? 'focus:ring-green-500 focus:border-green-500' : 'focus:ring-purple-500 focus:border-purple-500';
  const btnCls = isGreen
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-purple-600 hover:bg-purple-700';
  const defaultBgCls = isGreen
    ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700'
    : 'bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700';
  const starCls = isGreen
    ? 'text-green-600 dark:text-green-400'
    : 'text-purple-600 dark:text-purple-400';
  const defaultBadgeCls = isGreen
    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
  const setDefaultBtnCls = isGreen
    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950'
    : 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950';

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-foreground mb-2">
        <Phone className="w-4 h-4 inline mr-1" />
        발신번호 관리
      </label>

      {senderNumbers.length > 0 && (
        <div className="mb-3 space-y-2">
          {senderNumbers.map((sender) => (
            <div
              key={sender.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                sender.is_default === 1 ? defaultBgCls : 'bg-background border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                {sender.is_default === 1 && (
                  <Star className={`w-4 h-4 ${starCls} fill-current`} />
                )}
                <span className="font-medium text-foreground">{sender.phone}</span>
                {sender.label && (
                  <span className="text-xs text-muted-foreground">({sender.label})</span>
                )}
                {sender.is_default === 1 && (
                  <span className={`text-xs px-2 py-0.5 rounded ${defaultBadgeCls}`}>기본</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sender.is_default !== 1 && (
                  <button
                    onClick={() => onSetDefault(sender.id)}
                    className={`text-xs px-2 py-1 rounded border ${setDefaultBtnCls}`}
                  >
                    기본으로 설정
                  </button>
                )}
                <button
                  onClick={() => onDelete(sender.id)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newSenderPhone}
          onChange={e => setNewSenderPhone(e.target.value)}
          className={`flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 ${ringCls}`}
          placeholder="010-1234-5678"
        />
        <input
          type="text"
          value={newSenderLabel}
          onChange={e => setNewSenderLabel(e.target.value)}
          className={`w-32 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 ${ringCls}`}
          placeholder="라벨 (선택)"
        />
        <button
          onClick={onAdd}
          disabled={addingSender || !newSenderPhone.trim()}
          className={`px-4 py-2 ${btnCls} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
        >
          <Plus className="w-4 h-4" />
          {addingSender ? '추가 중...' : '추가'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{hint}</p>
    </div>
  );
}
