'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Trash2, Edit, User, CheckCircle, XCircle } from 'lucide-react';
import type { Staff } from '@/lib/types/staff';
import { PERMISSION_PAGES } from '@/lib/types/staff';

interface StaffListProps {
  staff: Staff[];
  loading: boolean;
  onEditPermission: (staff: Staff) => void;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
}

export function StaffList({ staff, loading, onEditPermission, onEdit, onDelete }: StaffListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-600">로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">등록된 직원이 없습니다</h3>
          <p className="text-gray-600">
            강사에게 관리 권한을 부여하려면 &quot;권한 부여&quot; 버튼을 클릭하세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 권한 요약 표시
  const getPermissionSummary = (permissions: Staff['permissions']) => {
    const viewCount = PERMISSION_PAGES.filter(
      (page) => permissions[page.key as keyof typeof permissions]?.view
    ).length;
    const editCount = PERMISSION_PAGES.filter(
      (page) => permissions[page.key as keyof typeof permissions]?.edit
    ).length;

    return `보기: ${viewCount}개, 수정: ${editCount}개`;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직원 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  권한 요약
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      {member.position || '미지정'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {getPermissionSummary(member.permissions)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircle className="w-3 h-3 mr-1" />
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditPermission(member)}
                        title="권한 설정"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(member)}
                        title="정보 수정"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(member)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
