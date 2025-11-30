'use client';

console.log('=== LOGIN PAGE LOADED ===');

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/lib/api/auth';
import { onboardingAPI } from '@/lib/api/onboarding';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        console.log('=== FORM SUBMITTED ===');
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.login({ email, password });

            // 토큰과 사용자 정보 저장
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));

            console.log('[LOGIN] User role:', response.user.role);
            console.log('[LOGIN] Is owner?', response.user.role === 'owner');

            // 원장(owner)인 경우 온보딩 상태 확인
            if (response.user.role === 'owner') {
                console.log('[LOGIN] Checking onboarding status...');
                try {
                    const onboardingStatus = await onboardingAPI.getStatus();
                    console.log('[LOGIN] Onboarding status:', onboardingStatus);
                    if (!onboardingStatus.onboarding_completed) {
                        // 온보딩 미완료 → 온보딩 페이지로 이동
                        console.log('[LOGIN] Redirecting to onboarding...');
                        window.location.href = '/onboarding';
                        return;
                    }
                } catch (err) {
                    // 온보딩 상태 확인 실패 시 대시보드로 이동
                    console.error('[LOGIN] Failed to check onboarding status:', err);
                }
            }

            // 대시보드로 이동 (전체 페이지 새로고침으로 사이드바 메뉴 업데이트)
            window.location.href = '/';
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.response?.data?.message || '로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    {/* Logo */}
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mb-4">
                        <span className="text-white font-bold text-3xl">P</span>
                    </div>
                    <CardTitle className="text-2xl font-bold">P-ACA</CardTitle>
                    <CardDescription>체육입시 학원관리시스템</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-gray-700">
                                이메일
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="test@example.com"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-gray-700">
                                비밀번호
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? '로그인 중...' : '로그인'}
                        </Button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            계정이 없으신가요?{' '}
                            <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                                회원가입
                            </Link>
                        </p>
                    </div>

                    {/* Test Account Info */}
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-800 font-medium mb-2">테스트 계정</p>
                        <p className="text-xs text-blue-700">
                            이메일: test@example.com
                            <br />
                            비밀번호: password123
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
