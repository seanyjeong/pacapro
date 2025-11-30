'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usersAPI, PendingUser } from '@/lib/api/users';
import { CheckCircle, XCircle, Clock, AlertCircle, Users, ShieldX } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsersPage() {
    const router = useRouter();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        checkAccess();
        loadPendingUsers();
    }, []);

    const checkAccess = () => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            router.push('/login');
            return;
        }

        const user = JSON.parse(userStr);

        // admin이 아니면 접근 거부
        if (user.role !== 'admin') {
            setAccessDenied(true);
            setLoading(false);
            return;
        }
    };

    const loadPendingUsers = async () => {
        try {
            setLoading(true);
            const data = await usersAPI.getPendingUsers();
            setPendingUsers(data.users);
            setError(null);
        } catch (err: any) {
            console.error('Failed to load pending users:', err);
            setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: number) => {
        if (!confirm('이 사용자를 승인하시겠습니까?')) return;

        try {
            setActionLoading(userId);
            await usersAPI.approveUser(userId);

            // 목록에서 제거
            setPendingUsers((prev) => prev.filter((user) => user.id !== userId));

            toast.success('사용자가 승인되었습니다.');
        } catch (err: any) {
            console.error('Approve failed:', err);
            toast.error(err.response?.data?.message || '승인에 실패했습니다.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (userId: number) => {
        if (!confirm('이 사용자를 거절하시겠습니까?')) return;

        try {
            setActionLoading(userId);
            await usersAPI.rejectUser(userId);

            // 목록에서 제거
            setPendingUsers((prev) => prev.filter((user) => user.id !== userId));

            toast.success('사용자가 거절되었습니다.');
        } catch (err: any) {
            console.error('Reject failed:', err);
            toast.error(err.response?.data?.message || '거절에 실패했습니다.');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 접근 거부 화면
    if (accessDenied) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center">
                        <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한 없음</h2>
                        <p className="text-gray-600 mb-6">
                            이 페이지는 관리자만 접근할 수 있습니다.
                            <br />
                            일반 사용자는 접근할 수 없습니다.
                        </p>
                        <Button onClick={() => router.push('/')}>
                            대시보드로 이동
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">사용자 승인 관리</h1>
                    <p className="text-gray-600 mt-1">회원가입 승인 대기 중인 사용자 목록</p>
                </div>

                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">로딩 중...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">사용자 승인 관리</h1>
                    <p className="text-gray-600 mt-1">회원가입 승인 대기 중인 사용자 목록</p>
                </div>

                <Card>
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={loadPendingUsers}>다시 시도</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">사용자 승인 관리</h1>
                    <p className="text-gray-600 mt-1">회원가입 승인 대기 중인 사용자 목록</p>
                </div>
                <Button onClick={loadPendingUsers} variant="outline">
                    새로고침
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-orange-100 rounded-xl">
                                <Clock className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-600">승인 대기</div>
                                <div className="text-2xl font-bold text-gray-900">{pendingUsers.length}명</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Users List */}
            {pendingUsers.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">승인 대기 중인 사용자가 없습니다</h3>
                        <p className="text-gray-600">새로운 회원가입 요청이 오면 여기에 표시됩니다.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>승인 대기 목록</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pendingUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                                >
                                    {/* User Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">
                                                    {user.name.charAt(0)}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{user.name}</div>
                                                <div className="text-sm text-gray-600">{user.email}</div>
                                            </div>
                                        </div>

                                        <div className="ml-13 grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500">학원명:</span>
                                                <span className="ml-2 text-gray-900 font-medium">
                                                    {user.academy_name || '없음'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">전화번호:</span>
                                                <span className="ml-2 text-gray-900">{user.phone || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">역할:</span>
                                                <span className="ml-2 text-gray-900">
                                                    {user.role === 'owner' ? '원장' : user.role}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">신청일:</span>
                                                <span className="ml-2 text-gray-900">{formatDate(user.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center space-x-2 ml-4">
                                        <Button
                                            size="sm"
                                            onClick={() => handleApprove(user.id)}
                                            disabled={actionLoading === user.id}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            {actionLoading === user.id ? (
                                                '처리 중...'
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    승인
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleReject(user.id)}
                                            disabled={actionLoading === user.id}
                                            className="text-red-600 border-red-600 hover:bg-red-50"
                                        >
                                            {actionLoading === user.id ? (
                                                '처리 중...'
                                            ) : (
                                                <>
                                                    <XCircle className="w-4 h-4 mr-1" />
                                                    거절
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900 mb-1">승인 안내</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• 승인된 사용자는 즉시 로그인할 수 있습니다.</li>
                                <li>• 거절된 사용자는 다시 회원가입을 시도해야 합니다.</li>
                                <li>• 신중하게 검토 후 승인/거절을 결정해주세요.</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
