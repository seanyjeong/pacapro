'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, User, LogOut, Menu, Users, UserCog, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 md:left-64 z-10 no-print">
            <div className="h-full px-4 md:px-6 flex items-center justify-between">
                {/* Left: Mobile Menu + Search */}
                <div className="flex items-center space-x-4 flex-1">
                    {/* Mobile Menu Button */}
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="w-5 h-5" />
                    </Button>

                    {/* Search Bar */}
                    <div className="relative max-w-md w-full" ref={searchRef}>
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchResults.length > 0 && setShowResults(true)}
                            placeholder="학생, 강사, 전화번호 검색..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />

                        {/* 검색 결과 드롭다운 */}
                        {showResults && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                {searching ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        검색 중...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        검색 결과가 없습니다
                                    </div>
                                ) : (
                                    <ul>
                                        {searchResults.map((result) => (
                                            <li key={`${result.type}-${result.id}`}>
                                                <button
                                                    onClick={() => handleResultClick(result)}
                                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                                >
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                        result.type === 'student' ? 'bg-blue-100' : 'bg-green-100'
                                                    }`}>
                                                        {result.type === 'student' ? (
                                                            <Users className="w-5 h-5 text-blue-600" />
                                                        ) : (
                                                            <UserCog className="w-5 h-5 text-green-600" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{result.name}</span>
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                                result.type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                            }`}>
                                                                {result.type === 'student' ? '학생' : '강사'}
                                                            </span>
                                                            {result.status !== 'active' && (
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                                    {result.status === 'paused' ? '휴원' : result.status === 'withdrawn' ? '퇴원' : result.status === 'trial' ? '체험' : result.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-gray-500 truncate">
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
                </div>

                {/* Right: Notifications + User */}
                <div className="flex items-center space-x-2 md:space-x-4">
                    {/* Install App Button */}
                    {!isInstalled && deferredPrompt && (
                        <button
                            onClick={handleInstallClick}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="바탕화면에 앱 설치"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden md:inline">앱 설치</span>
                        </button>
                    )}

                    {/* Notifications */}
                    <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="hidden md:block text-left">
                                <div className="text-sm font-medium text-gray-900">
                                    {user?.name || '사용자'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {user ? getRoleLabel(user.role || '', user.position) : '사용자'}
                                </div>
                            </div>
                        </button>

                        {/* User Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>로그아웃</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
