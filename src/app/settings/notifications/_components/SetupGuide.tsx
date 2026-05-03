'use client';

// Phase 4 #1 — 설정 가이드 (아코디언) sub-component
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { ServiceType } from '../_types';

interface Props {
  activeTab: ServiceType;
  openGuides: Record<string, boolean>;
  toggleGuide: (key: string) => void;
}

export default function SetupGuide({ activeTab, openGuides, toggleGuide }: Props) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">설정 가이드</h2>

      <div className="space-y-2">
        {activeTab === 'sens' && (
          <>
            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('naver')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">1. Naver Cloud Platform 가입 및 SENS 서비스 등록</span>
                {openGuides['naver'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['naver'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. <a href="https://www.ncloud.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Naver Cloud Platform <ExternalLink className="w-3 h-3" /></a> 접속 후 회원가입</p>
                  <p>2. 콘솔 → Products & Services → SENS 선택</p>
                  <p>3. 프로젝트 생성 후 Service ID 확인</p>
                  <p>4. 마이페이지 → 인증키 관리 → Access Key/Secret Key 발급</p>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('kakao')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">2. KakaoTalk 비즈니스 채널 생성</span>
                {openGuides['kakao'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['kakao'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. <a href="https://center-pf.kakao.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">카카오 비즈니스 센터 <ExternalLink className="w-3 h-3" /></a> 접속</p>
                  <p>2. 카카오톡 채널 생성 (비즈니스 채널)</p>
                  <p>3. 채널 ID 확인 (예: @학원이름)</p>
                  <p>4. Naver Cloud SENS에서 KakaoTalk 채널 연동</p>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('template')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">3. 알림톡 템플릿 등록 및 승인</span>
                {openGuides['template'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['template'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. Naver Cloud SENS 콘솔 → 알림톡 → 템플릿 관리</p>
                  <p>2. 새 템플릿 등록 (아래 예시 참고)</p>
                  <p>3. 카카오 심사 대기 (영업일 기준 2-3일 소요)</p>
                  <p>4. 승인 완료 후 템플릿 코드를 위 설정에 입력</p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap text-foreground">
{`[#{학원명}] 학원비 납부 안내

안녕하세요, #{이름} 학부모님.

#{월}월 학원비 #{교육비}원이 아직 납부되지 않았습니다.

납부일: #{날짜}

문의: #{학원전화}

※ 이미 납부하셨다면 이 메시지는 무시해주세요.`}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'solapi' && (
          <>
            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('solapi-signup')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">1. 솔라피 가입 및 API Key 발급</span>
                {openGuides['solapi-signup'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['solapi-signup'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. <a href="https://solapi.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">솔라피 <ExternalLink className="w-3 h-3" /></a> 접속 후 회원가입</p>
                  <p>2. 사업자등록증 인증 (알림톡 발송에 필요)</p>
                  <p>3. 콘솔 → API Key 메뉴에서 API Key/Secret 발급</p>
                  <p>4. 발신번호 등록 (문자 발송용)</p>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('solapi-channel')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">2. 카카오톡 채널 연동</span>
                {openGuides['solapi-channel'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['solapi-channel'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. 솔라피 콘솔 → 알림톡 → 채널 관리</p>
                  <p>2. 카카오톡 채널 연동 (카카오 비즈니스 채널 필요)</p>
                  <p>3. 채널 ID (pfId) 확인 후 위 설정에 입력</p>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg">
              <button onClick={() => toggleGuide('solapi-template')} className="w-full flex items-center justify-between p-4 text-left hover:bg-muted">
                <span className="font-medium text-foreground">3. 알림톡 템플릿 등록</span>
                {openGuides['solapi-template'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {openGuides['solapi-template'] && (
                <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                  <p>1. 솔라피 콘솔 → 알림톡 → 템플릿 관리</p>
                  <p>2. 새 템플릿 등록</p>
                  <p>3. 카카오 심사 대기 (영업일 기준 1-2일)</p>
                  <p>4. 승인 완료 후 템플릿 ID를 위 설정에 입력</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
