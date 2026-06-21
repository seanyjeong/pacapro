'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConsultationDetailModal } from '@/components/students/consultation-detail-modal';
import apiClient from '@/lib/api/client';
import { InitialConsultationCard } from './initial-consultation-card';
import { StudentConsultationCard } from './student-consultation-card';
import type { InitialConsultation, StudentConsultation } from './student-consultation-types';
import { buildConsultationTimeline } from './student-consultation-utils';

interface StudentConsultationsComponentProps {
    studentId: number;
    studentName: string;
}

export function StudentConsultationsComponent({
    studentId,
    studentName,
}: StudentConsultationsComponentProps) {
    const [consultations, setConsultations] = useState<StudentConsultation[]>([]);
    const [initialConsultations, setInitialConsultations] = useState<InitialConsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedConsultation, setSelectedConsultation] = useState<StudentConsultation | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [academyName, setAcademyName] = useState('');

    const loadAcademyName = useCallback(async () => {
        try {
            const response = await apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy');
            if (response.settings?.academy_name) {
                setAcademyName(response.settings.academy_name);
            }
        } catch {
            // 학원명은 PDF 부가 정보라 실패해도 상담 기록 조회를 막지 않습니다.
        }
    }, []);

    const loadConsultations = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<{
                consultations: StudentConsultation[];
                initialConsultations?: InitialConsultation[];
            }>(`/student-consultations/${studentId}`);
            setConsultations(response.consultations || []);
            setInitialConsultations(response.initialConsultations || []);
        } catch (error) {
            console.error('상담 기록 로드 오류:', error);
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        void loadConsultations();
        void loadAcademyName();
    }, [loadAcademyName, loadConsultations]);

    const timeline = useMemo(
        () => buildConsultationTimeline(consultations, initialConsultations),
        [consultations, initialConsultations]
    );

    const toggleExpand = (key: string) => {
        setExpandedId((current) => (current === key ? null : key));
    };

    const openDetailModal = (consultation: StudentConsultation) => {
        setSelectedConsultation(consultation);
        setModalOpen(true);
    };

    const closeDetailModal = () => {
        setModalOpen(false);
        setSelectedConsultation(null);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    <span className="ml-2 text-muted-foreground">상담 기록 로딩 중...</span>
                </CardContent>
            </Card>
        );
    }

    if (timeline.length === 0) {
        return <StudentConsultationsEmptyState studentName={studentName} />;
    }

    const countLabel = initialConsultations.length > 0
        ? `재원 ${consultations.length}건 + 신규 ${initialConsultations.length}건`
        : `${consultations.length}건`;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">상담 기록 ({countLabel})</h3>
                <Link href="/consultations/enrolled">
                    <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        새 상담 등록
                    </Button>
                </Link>
            </div>

            <div className="space-y-3">
                {timeline.map((item) => {
                    const key = `${item.type}-${item.data.id}`;
                    if (item.type === 'student') {
                        return (
                            <StudentConsultationCard
                                key={key}
                                consultation={item.data}
                                isExpanded={expandedId === key}
                                onToggle={() => toggleExpand(key)}
                                onViewDetail={() => openDetailModal(item.data)}
                            />
                        );
                    }

                    return (
                        <InitialConsultationCard
                            key={key}
                            consultation={item.data}
                            isExpanded={expandedId === key}
                            onToggle={() => toggleExpand(key)}
                        />
                    );
                })}
            </div>

            <ConsultationDetailModal
                open={modalOpen}
                onClose={closeDetailModal}
                consultation={selectedConsultation}
                studentName={studentName}
                academyName={academyName}
            />
        </div>
    );
}

function StudentConsultationsEmptyState({ studentName }: { studentName: string }) {
    return (
        <Card>
            <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">상담 기록이 없습니다</h3>
                <p className="text-muted-foreground mb-4">
                    {studentName} 학생의 상담 기록을 재원생상담에서 등록할 수 있습니다.
                </p>
                <Link href="/consultations/enrolled">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        상담 등록하기
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
