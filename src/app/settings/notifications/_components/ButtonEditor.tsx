'use client';

// Phase 4 #1 — 알림톡 버튼 추가/수정/삭제 재사용 sub-component
import { Plus, Trash2 } from 'lucide-react';
import { ConsultationButton } from '@/lib/api/notifications';

interface Props {
  buttons: ConsultationButton[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof ConsultationButton, value: string) => void;
  colorScheme: 'orange' | 'green' | 'blue' | 'red' | 'purple';
  maxButtons?: number;
  providerName?: string;
}

const COLOR_MAP: Record<string, { btn: string; border: string }> = {
  orange: { btn: 'bg-warning hover:bg-warning/90', border: 'border-warning/30' },
  green:  { btn: 'bg-success hover:bg-success/90',   border: 'border-success/30' },
  blue:   { btn: 'bg-primary hover:bg-primary/90',     border: 'border-primary/30' },
  red:    { btn: 'bg-destructive hover:bg-destructive/90',       border: 'border-destructive/30' },
  purple: { btn: 'bg-purple-600 hover:bg-purple-700', border: 'border-purple-200 dark:border-purple-800' },
};

export default function ButtonEditor({ buttons, onAdd, onRemove, onUpdate, colorScheme, maxButtons = 5, providerName = '솔라피' }: Props) {
  const colors = COLOR_MAP[colorScheme];

  return (
    <div className="md:col-span-2 border-t border-border pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-foreground">버튼 설정</h4>
        <button
          type="button"
          onClick={onAdd}
          disabled={(buttons?.length || 0) >= maxButtons}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm ${colors.btn} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus className="w-4 h-4" />
          버튼 추가
        </button>
      </div>

      {(buttons?.length || 0) === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          버튼이 없습니다. 템플릿에 버튼이 있다면 위의 &quot;버튼 추가&quot; 버튼을 클릭하세요.
        </p>
      ) : (
        <div className="space-y-4">
          {buttons?.map((button, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">버튼 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="p-1 text-destructive hover:bg-destructive-soft rounded"
                >
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
                    <option value="WL">웹링크 (WL)</option>
                    <option value="AL">앱링크 (AL)</option>
                    <option value="BK">봇키워드 (BK)</option>
                    <option value="MD">메시지전달 (MD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">버튼 이름</label>
                  <input
                    type="text"
                    value={button.buttonName || ''}
                    onChange={(e) => onUpdate(index, 'buttonName', e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                    placeholder="버튼 이름"
                  />
                </div>
                {button.buttonType === 'WL' && (
                  <>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">모바일 링크</label>
                      <input
                        type="url"
                        value={button.linkMo || ''}
                        onChange={(e) => onUpdate(index, 'linkMo', e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">PC 링크 (선택)</label>
                      <input
                        type="url"
                        value={button.linkPc || ''}
                        onChange={(e) => onUpdate(index, 'linkPc', e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        * {providerName}에서 등록한 템플릿의 버튼과 동일하게 설정해야 합니다
      </p>
    </div>
  );
}
