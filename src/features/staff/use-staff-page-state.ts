'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { staffApi } from '@/lib/api/staff';
import type { AvailableInstructor, Staff } from '@/lib/types/staff';
import { buildStaffSummary } from './staff-page-utils';

const SILENT_CONFIG = { suppressErrorToast: true };
const LOAD_ERROR_TEXT = '직원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useStaffPageState() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<AvailableInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [staffRes, instructorsRes] = await Promise.all([
        staffApi.getStaffList(SILENT_CONFIG),
        staffApi.getAvailableInstructors(SILENT_CONFIG),
      ]);
      setStaffList(staffRes.staff);
      setAvailableInstructors(instructorsRes.instructors);
    } catch {
      setError(LOAD_ERROR_TEXT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo(
    () => buildStaffSummary(staffList, availableInstructors),
    [availableInstructors, staffList]
  );

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

  const handleDeleteStaff = (staff: Staff) => {
    setDeleteTarget(staff);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (deleteLoading) return;
    setDeleteDialogOpen(open);
  };

  const confirmDeleteStaff = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      await staffApi.deleteStaff(deleteTarget.id, SILENT_CONFIG);
      toast.success('직원 계정이 삭제되었습니다.');
      setDeleteDialogOpen(false);
      await loadData();
    } catch {
      toast.error('직원 계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFormSubmit = async () => {
    setShowFormModal(false);
    await loadData();
  };

  const handlePermissionSubmit = async () => {
    setShowPermissionModal(false);
    await loadData();
  };

  return {
    availableInstructors,
    deleteDialogOpen,
    deleteLoading,
    deleteTarget,
    error,
    loading,
    selectedStaff,
    showFormModal,
    showPermissionModal,
    staffList,
    summary,
    confirmDeleteStaff,
    handleAddStaff,
    handleDeleteDialogOpenChange,
    handleDeleteStaff,
    handleEditPermission,
    handleEditStaff,
    handleFormSubmit,
    handlePermissionSubmit,
    loadData,
    setShowFormModal,
    setShowPermissionModal,
  };
}
