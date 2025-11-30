'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/lib/api/auth';
import { CheckCircle } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        academyName: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError('비밀번호는 최소 8자 이상이어야 합니다.');
            setLoading(false);
            return;
        }

        if (!formData.academyName.trim()) {
            setError('학원명을 입력해주세요.');
            setLoading(false);
            return;
        }

        try {
            await authAPI.register({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                phone: formData.phone,
                academyName: formData.academyName,
            });

            setSuccess(true);

            // 3초 후 로그인 페이지로 이동
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.response?.data?.message || '회원가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">회원가입 완료!</h2>
                        <p className="text-gray-600 mb-4">
                            관리자 승인 후 로그인이 가능합니다.
                            <br />
                            승인까지 조금만 기다려주세요.
                        </p>
                        <p className="text-sm text-gray-500">잠시 후 로그인 페이지로 이동합니다...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    {/* Logo */}
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mb-4">
                        <span className="text-white font-bold text-3xl">P</span>
                    </div>
                    <CardTitle className="text-2xl font-bold">P-ACA 회원가입</CardTitle>
                    <CardDescription>체육입시 학원관리시스템</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Academy Name */}
                        <div className="space-y-2">
                            <label htmlFor="academyName" className="text-sm font-medium text-gray-700">
                                학원명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="academyName"
                                name="academyName"
                                type="text"
                                value={formData.academyName}
                                onChange={handleChange}
                                placeholder="OO체대입시학원"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium text-gray-700">
                                이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="홍길동"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-gray-700">
                                이메일 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="academy@example.com"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                전화번호
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="010-1234-5678"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-gray-700">
                                비밀번호 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="최소 8자 이상"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                                비밀번호 확인 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="비밀번호 재입력"
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
                            {loading ? '가입 중...' : '회원가입'}
                        </Button>

                        {/* Login Link */}
                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                이미 계정이 있으신가요?{' '}
                                <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                                    로그인
                                </Link>
                            </p>
                        </div>
                    </form>

                    {/* Info */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-800 font-medium mb-1">안내사항</p>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>• 회원가입 후 관리자 승인이 필요합니다.</li>
                            <li>• 승인 완료 시 이메일로 안내드립니다.</li>
                            <li>• 학원명은 신중하게 입력해주세요.</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
