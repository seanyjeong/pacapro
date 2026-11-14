'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, User, LogOut, Users, UserCog, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { authAPI } from '@/lib/api/auth';
import apiClient from '@/lib/api/client';

// 역할을 한글로 변환
const getRoleLabel = (role: string, position?: string): string => {
    // position이 있으면 우선 표시 (staff의 직급)
    if (position) return position;

    switch (role) {
        case 'owner': return '원장';
        case 'admin': return '시스템 관리자';
        case 'staff': return '직원';
        case 'teacher': return '강사';
        default: return '사용자';
    }
};

interface SearchResult {
    id: number;
    type: 'student' | 'instructor';
    name: string;
    subtext: string;
    phone?: string;
    status: string;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function TopNav() {
    const router = useRouter();
    const [user, setUser] = useState<{ name?: string; email?: string; role?: string; position?: string } | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searching, setSearching] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const currentUser = authAPI.getCurrentUser();
        setUser(currentUser);

        // PWA 설치 상태 체크
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        // beforeinstallprompt 이벤트 리스닝
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    // 로그인 안 했거나 이미 설치됐으면 설치 버튼 안 보임
    // standalone 모드(PWA로 실행 중)면 isInstalled가 true
    const showInstallButton = !isInstalled && user;

    // 검색 실행 (debounce)
    useEffect(() => {
        if (searchQuery.trim().length < 1) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                const data = await apiClient.get<{ results: SearchResult[] }>('/search', {
                    params: { q: searchQuery }
                });
                setSearchResults(data.results || []);
                setShowResults(true);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // 외부 클릭 시 검색 결과 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleResultClick = (result: SearchResult) => {
        if (result.type === 'student') {
            router.push(`/students/${result.id}`);
        } else if (result.type === 'instructor') {
            router.push(`/instructors/${result.id}`);
        }
        setSearchQuery('');
        setShowResults(false);
    };

    const handleLogout = () => {
        authAPI.logout();
    };

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setIsInstalled(true);
            }
            setDeferredPrompt(null);
        } else {
            toast.info('브라우저 메뉴에서 앱 설치를 선택해주세요.', {
                description: 'Chrome은 메뉴 > 앱 설치, Edge는 메뉴 > 앱 > 이 사이트를 앱으로 설치를 사용합니다.',
            });
        }
    };

    return (
        <header className="no-print sticky top-0 z-30 shrink-0 bg-background/85 backdrop-blur-md">
            <div className="flex h-16 items-center gap-3 px-4 md:h-[72px] md:px-8">
                {/* 휴대폰: 로고 */}
                <Link href="/" className="shrink-0 md:hidden" aria-label="대시보드로 가기">
                    <Image src="/icons/icon-96x96.png" alt="P-ACA" width={32} height={32} className="rounded-xl" />
                </Link>

                {/* 검색 */}
                <div className="relative w-full max-w-md flex-1" ref={searchRef}>
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowResults(true)}
                        placeholder="학생·강사·전화번호 검색"
                        aria-label="학생·강사·전화번호 검색"
                        className="h-11 w-full rounded-xl border border-transparent bg-card pl-11 pr-4 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    />

                    {/* 검색 결과 */}
                    {showResults && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-150">
                            {searching ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">검색 중...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">검색 결과가 없습니다</div>
                            ) : (
                                <ul>
                                    {searchResults.map((result) => (
                                        <li key={`${result.type}-${result.id}`}>
                                            <button
                                                onClick={() => handleResultClick(result)}
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted"
                                            >
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                    result.type === 'student' ? 'bg-primary-soft text-primary' : 'bg-success-soft text-success'
                                                }`}>
                                                    {result.type === 'student' ? <Users className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-foreground">{result.name}</span>
                                                        <span className="text-xs font-medium text-muted-foreground">{result.type === 'student' ? '학생' : '강사'}</span>
                                                        {result.status !== 'active' && (
                                                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                                                                {result.status === 'paused' ? '휴원' : result.status === 'withdrawn' ? '퇴원' : result.status === 'trial' ? '체험' : result.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="truncate text-sm text-muted-foreground">
                                                        {result.subtext}
                                                        {result.phone && ` · ${result.phone}`}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
                    {showInstallButton && (
                        <button
                            onClick={handleInstallClick}
                            className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft sm:flex"
                            title="바탕화면에 앱 설치"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden lg:inline">앱 설치</span>
                        </button>
                    )}

                    <ThemeToggle />

                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            aria-label="내 계정"
                            className="flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-card md:pr-3"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                                <User className="h-[18px] w-[18px] text-primary" />
                            </div>
                            <div className="hidden text-left md:block">
                                <div className="text-sm font-semibold leading-tight text-foreground">{user?.name || '사용자'}</div>
                                <div className="text-xs text-muted-foreground">{user ? getRoleLabel(user.role || '', user.position) : '사용자'}</div>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
                                >
                                    <LogOut className="h-4 w-4 text-muted-foreground" />
                                    로그아웃
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
