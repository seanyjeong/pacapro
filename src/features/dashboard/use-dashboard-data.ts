import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardAPI } from '@/lib/api/dashboard';
import { schedulesApi } from '@/lib/api/schedules';
import { getConsultations } from '@/lib/api/consultations';
import { studentsAPI } from '@/lib/api/students';
import { canEdit, canView, isAdmin, isOwner } from '@/lib/utils/permissions';
import { DashboardStats } from '@/lib/types';
import type { Consultation } from '@/lib/types/consultation';
import type { RestEndedStudent } from '@/components/students/student-resume-modal';
import type { DashboardPermissions, InstructorSlotMap } from './dashboard-types';
import {
    DASHBOARD_ERROR_MESSAGE,
    TODAY_DATA_ERROR_MESSAGE,
    getKoreanDateLabel,
    getLocalDateKey,
} from './dashboard-utils';

const emptySlots: InstructorSlotMap = { morning: [], afternoon: [], evening: [] };
const quietRequest = { suppressErrorToast: true };

function isUnauthorized(error: unknown): boolean {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status === 401;
}

function getPermissions(): DashboardPermissions {
    return {
        finance: isOwner() || isAdmin() || canView('dashboard_finance'),
        unpaid: isOwner() || isAdmin() || canView('dashboard_unpaid'),
        schedules: isOwner() || isAdmin() || canEdit('schedules'),
        consultations: isOwner() || isAdmin() || canView('consultations'),
    };
}

export function useDashboardData() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [todayDataError, setTodayDataError] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<DashboardPermissions>({
        finance: false,
        unpaid: false,
        schedules: false,
        consultations: false,
    });
    const [instructorsBySlot, setInstructorsBySlot] = useState<InstructorSlotMap>(emptySlots);
    const [todayConsultations, setTodayConsultations] = useState<Consultation[]>([]);
    const [restEndedStudents, setRestEndedStudents] = useState<RestEndedStudent[]>([]);
    const [todayLabel, setTodayLabel] = useState('');

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getStats(quietRequest);
            setStats(data);
            setError(null);
        } catch (loadError: unknown) {
            if (isUnauthorized(loadError)) return;
            setError(DASHBOARD_ERROR_MESSAGE);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTodayData = useCallback(async () => {
        const today = getLocalDateKey();
        const [instructorResult, consultationResult, restEndedResult] = await Promise.allSettled([
            schedulesApi.getInstructorAttendanceByDate(today, quietRequest),
            getConsultations({
                startDate: today,
                endDate: today,
                status: 'confirmed',
            }, quietRequest),
            studentsAPI.getRestEndedStudents(quietRequest),
        ]);

        let failed = 0;

        if (instructorResult.status === 'fulfilled') {
            const data = instructorResult.value;
            if (data.instructors_by_slot) {
                setInstructorsBySlot(data.instructors_by_slot);
            } else if (data.instructors) {
                setInstructorsBySlot({
                    morning: data.instructors,
                    afternoon: data.instructors,
                    evening: data.instructors,
                });
            }
        } else {
            failed += 1;
        }

        if (consultationResult.status === 'fulfilled') {
            setTodayConsultations(consultationResult.value.consultations || []);
        } else {
            failed += 1;
        }

        if (restEndedResult.status === 'fulfilled') {
            setRestEndedStudents(restEndedResult.value.students || []);
        } else {
            failed += 1;
        }

        setTodayDataError(failed > 0 ? TODAY_DATA_ERROR_MESSAGE : null);
    }, []);

    const refresh = useCallback(() => {
        void loadDashboard();
        void loadTodayData();
    }, [loadDashboard, loadTodayData]);

    useEffect(() => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            router.replace('/m');
            return;
        }

        setTodayLabel(getKoreanDateLabel());
        setPermissions(getPermissions());
        refresh();
    }, [refresh, router]);

    return {
        stats,
        loading,
        error,
        todayDataError,
        todayLabel,
        permissions,
        instructorsBySlot,
        todayConsultations,
        restEndedStudents,
        refresh,
    };
}
