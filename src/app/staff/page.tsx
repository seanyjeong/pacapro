'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, UserPlus, Users, RefreshCw, Shield } from 'lucide-react';
import { staffApi } from '@/lib/api/staff';
import { StaffList } from '@/components/staff/staff-list';
import { StaffFormModal } from '@/components/staff/staff-form-modal';
import { PermissionModal } from '@/components/staff/permission-modal';
import type { Staff, AvailableInstructor } from '@/lib/types/staff';
import { toast } from 'sonner';

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<AvailableInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [staffRes, instructorsRes] = await Promise.all([
        staffApi.getStaffList(),
        staffApi.getAvailableInstructors(),
      ]);
      setStaffList(staffRes.staff);
      setAvailableInstructors(instructorsRes.instructors);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = () => {
    setSelectedStaff(null);
    setShowFormModal(true);
  };

  const handleEditPermission = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowPermissionModal(true);
  };

  const handleEditStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowFormModal(true);
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!confirm(`${staff.name}님의 계정을 삭제하시겠습니까?`)) return;

    try {
      await staffApi.deleteStaff(staff.id);
      toast.success('직원 계정이 삭제되었습니다.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleFormSubmit = async () => {
    setShowFormModal(false);
    loadData();
  };

  const handlePermissionSubmit = async () => {
    setShowPermissionModal(false);
    loadData();
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">직원 관리</h1>
          <p className="text-gray-600 mt-1">강사에게 관리 권한 부여</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCount = staffList.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">직원 관리</h1>
          <p className="text-gray-600 mt-1">등록된 강사에게 관리 권한을 부여합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={handleAddStaff} disabled={availableInstructors.length === 0}>
            <UserPlus className="w-4 h-4 mr-2" />
            권한 부여
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">등록된 직원</p>
                <p className="text-2xl font-bold text-gray-900">{staffList.length}명</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 계정</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}명</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">권한 부여 가능</p>
                <p className="text-2xl font-bold text-purple-600">{availableInstructors.length}명</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 안내 메시지 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">권한 관리 안내</h4>
              <p className="text-sm text-blue-700 mt-1">
                등록된 강사 중에서 관리 권한이 필요한 분에게 로그인 계정을 부여할 수 있습니다.
                각 페이지별로 보기/수정 권한을 개별 설정할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 직원 목록 */}
      <StaffList
        staff={staffList}
        loading={loading}
        onEditPermission={handleEditPermission}
        onEdit={handleEditStaff}
        onDelete={handleDeleteStaff}
      />

      {/* 직원 추가/수정 모달 */}
      {showFormModal && (
        <StaffFormModal
          staff={selectedStaff}
          availableInstructors={availableInstructors}
          onClose={() => setShowFormModal(false)}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* 권한 설정 모달 */}
      {showPermissionModal && selectedStaff && (
        <PermissionModal
          staff={selectedStaff}
          onClose={() => setShowPermissionModal(false)}
          onSubmit={handlePermissionSubmit}
        />
      )}
    </div>
  );
}
