'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';

export interface ConsultationCounts {
    newInquiry: number;
    enrolled: number;
}

export function useAcademyName(): string {
    const [academyName, setAcademyName] = useState('');
    useEffect(() => {
        apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy')
            .then((response) => {
                if (response.settings?.academy_name) setAcademyName(response.settings.academy_name);
            })
            .catch(() => {
                // 로그인 안된 상태에서는 에러 무시
            });
    }, []);
    return academyName;
}

// 처리 대기 상담 수 (pending, scheduled 상태만)
export function useConsultationCounts(): ConsultationCounts {
    const [counts, setCounts] = useState<ConsultationCounts>({ newInquiry: 0, enrolled: 0 });
    useEffect(() => {
        Promise.all([
            apiClient.get<{ pagination: { total: number } }>('/consultations?consultationType=new_registration&status=pending,scheduled&limit=1'),
            apiClient.get<{ pagination: { total: number } }>('/consultations?consultationType=learning&status=pending,scheduled&limit=1'),
        ])
            .then(([newRes, enrolledRes]) => setCounts({
                newInquiry: newRes.pagination?.total || 0,
                enrolled: enrolledRes.pagination?.total || 0,
            }))
            .catch((error) => console.error('상담 카운트 로드 실패:', error));
    }, []);
    return counts;
}
