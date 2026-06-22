'use client';

// Phase 4 #1 — 서비스 선택 탭 + 가격 비교 모달 sub-component
import { DollarSign, X, ExternalLink } from 'lucide-react';
import { NotificationSettings } from '@/lib/api/notifications';
import { ServiceType } from '../_types';

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
            onClick={() => setShowPriceModal(true)}
            className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <DollarSign className="w-4 h-4" />
            가격 비교
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            aria-pressed={activeTab === 'sens'}
            onClick={() => onServiceTypeChange('sens')}
            className={`${baseServiceButton} ${activeTab === 'sens' ? selectedServiceButton : idleServiceButton}`}
          >
            네이버 SENS
            {activeTab === 'sens' ? selectedBadge : null}
          </button>
          <button
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
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">서비스별 가격 비교</h3>
              <button onClick={() => setShowPriceModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-foreground">메시지 유형</th>
                    <th className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">SENS</th>
                    <th className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">솔라피</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">단문 SMS (90byte)</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950">
                      <span className="text-green-600 dark:text-green-400 font-medium">50건 무료</span>
                      <br /><span className="text-muted-foreground text-xs">초과 시 9원</span>
                    </td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">18원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">장문 LMS (2,000byte)</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950">
                      <span className="text-green-600 dark:text-green-400 font-medium">10건 무료</span>
                      <br /><span className="text-muted-foreground text-xs">초과 시 30원</span>
                    </td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">45원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">사진 MMS</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">100원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">110원</td>
                  </tr>
                  <tr className="border-b border-border bg-yellow-50 dark:bg-yellow-950">
                    <td className="py-3 px-2 font-medium text-foreground">카카오 알림톡</td>
                    <td className="text-center py-3 px-2 font-semibold text-green-700 dark:text-green-300">7.5원</td>
                    <td className="text-center py-3 px-2 text-foreground">13원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">카카오 친구톡</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">~15원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">19원</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-2 font-medium text-foreground">친구톡 이미지</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">~25원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">29원</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="font-medium text-green-800 dark:text-green-200 mb-2">SENS 장단점</p>
                  <div className="text-xs space-y-1">
                    <p className="text-green-700 dark:text-green-300">✓ 저렴한 가격</p>
                    <p className="text-green-700 dark:text-green-300">✓ 네이버 클라우드 통합</p>
                    <p className="text-red-600 dark:text-red-400">✗ 가입 절차 복잡</p>
                    <p className="text-red-600 dark:text-red-400">✗ 설정이 다소 어려움</p>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="font-medium text-purple-800 dark:text-purple-200 mb-2">솔라피 장단점</p>
                  <div className="text-xs space-y-1">
                    <p className="text-green-700 dark:text-green-300">✓ 가입/설정 간편</p>
                    <p className="text-green-700 dark:text-green-300">✓ 직관적인 UI</p>
                    <p className="text-red-600 dark:text-red-400">✗ SENS 대비 비싼 가격</p>
                    <p className="text-red-600 dark:text-red-400">✗ 대량 발송 시 비용 부담</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  * 가격은 변동될 수 있으며, 대량 발송 시 할인이 적용될 수 있습니다.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  * 정확한 가격은 각 공식 사이트에서 확인하세요.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href="https://www.ncloud.com/product/applicationService/sens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  SENS 공식 사이트 <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://solapi.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  솔라피 공식 사이트 <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
