'use client';

// Phase 4 #1 — 서비스 선택 탭 + 가격 비교 모달 sub-component
import { DollarSign, X, ExternalLink } from 'lucide-react';
import { NotificationSettings } from '@/lib/api/notifications';
import { ServiceType } from '../_types';

const PRICE_ROWS = [
  { type: '단문 SMS (90byte)', sens: '50건 무료 / 초과 9원', solapi: '18원', highlight: false },
  { type: '장문 LMS (2,000byte)', sens: '10건 무료 / 초과 30원', solapi: '45원', highlight: false },
  { type: '사진 MMS', sens: '100원', solapi: '110원', highlight: false },
  { type: '카카오 알림톡', sens: '7.5원', solapi: '13원', highlight: true },
  { type: '카카오 친구톡', sens: '~15원', solapi: '19원', highlight: false },
  { type: '친구톡 이미지', sens: '~25원', solapi: '29원', highlight: false },
];

const SERVICE_NOTES = [
  {
    title: 'SENS 운영 포인트',
    items: ['단가가 낮아 대량 발송에 유리합니다.', '네이버 클라우드 설정 절차가 필요합니다.'],
  },
  {
    title: '솔라피 운영 포인트',
    items: ['가입과 설정 흐름이 비교적 간단합니다.', '대량 발송 기준 비용은 SENS보다 높을 수 있습니다.'],
  },
];

interface Props {
  settings: NotificationSettings;
  activeTab: ServiceType;
  showPriceModal: boolean;
  setShowPriceModal: (v: boolean) => void;
  onServiceTypeChange: (type: ServiceType) => void;
}

export default function ServiceTabSelector({ settings, activeTab, showPriceModal, setShowPriceModal, onServiceTypeChange }: Props) {
  const baseServiceButton = 'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors';
  const selectedServiceButton = 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500 dark:text-white';
  const idleServiceButton = 'border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground';
  const selectedBadge = <span aria-hidden="true" className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white">선택됨</span>;

  return (
    <>
      <div className="rounded-md border border-border bg-card p-5 shadow-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">서비스 선택</h2>
          <button
            type="button"
            onClick={() => setShowPriceModal(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <DollarSign className="w-4 h-4" />
            가격 비교
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" data-testid="notification-service-tabs">
          <button
            type="button"
            aria-pressed={activeTab === 'sens'}
            onClick={() => onServiceTypeChange('sens')}
            className={`${baseServiceButton} ${activeTab === 'sens' ? selectedServiceButton : idleServiceButton}`}
          >
            네이버 SENS
            {activeTab === 'sens' ? selectedBadge : null}
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'solapi'}
            onClick={() => onServiceTypeChange('solapi')}
            className={`${baseServiceButton} ${activeTab === 'solapi' ? selectedServiceButton : idleServiceButton}`}
          >
            솔라피 (Solapi)
            {activeTab === 'solapi' ? selectedBadge : null}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          현재 사용 중: <strong className="text-foreground">{settings.service_type === 'solapi' ? '솔라피' : '네이버 SENS'}</strong>
          {settings.service_type !== activeTab && (
            <span className="text-amber-600 ml-2">(변경 후 저장 필요)</span>
          )}
        </p>
      </div>

      {/* 가격 비교 모달 */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPriceModal(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-price-title"
            data-testid="notification-price-modal"
            className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-border bg-card shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Notification Cost</p>
                <h3 id="notification-price-title" className="mt-1 text-lg font-semibold text-foreground">발송 단가 비교</h3>
              </div>
              <button
                type="button"
                aria-label="가격 비교 닫기"
                onClick={() => setShowPriceModal(false)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">메시지 유형</th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">네이버 SENS</th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">솔라피</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PRICE_ROWS.map((row) => (
                      <tr key={row.type} className={row.highlight ? 'bg-amber-50/70 dark:bg-amber-950/30' : undefined}>
                        <td className="px-3 py-3 font-medium text-foreground">{row.type}</td>
                        <td className="px-3 py-3 text-foreground">{row.sens}</td>
                        <td className="px-3 py-3 text-foreground">{row.solapi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {SERVICE_NOTES.map((note) => (
                  <div key={note.title} className="rounded-md border border-border bg-muted/25 p-4">
                    <p className="font-medium text-foreground">{note.title}</p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                      {note.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                가격은 변동될 수 있고 대량 발송 할인 기준도 계정마다 다를 수 있습니다. 최종 비용은 각 공식 사이트에서 확인하세요.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href="https://www.ncloud.com/product/applicationService/sens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  SENS 공식 사이트 <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href="https://solapi.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  솔라피 공식 사이트 <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
