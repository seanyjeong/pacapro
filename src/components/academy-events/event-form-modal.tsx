'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import type { AcademyEvent, AcademyEventFormData, AcademyEventType } from '@/lib/types/academyEvent';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types/academyEvent';

interface EventFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AcademyEventFormData) => Promise<void>;
    event?: AcademyEvent | null;
    selectedDate?: string;
}

export function EventFormModal({ isOpen, onClose, onSubmit, event, selectedDate }: EventFormModalProps) {
    const [formData, setFormData] = useState<AcademyEventFormData>({
        title: '',
        description: '',
        event_type: 'academy',
        event_date: selectedDate || new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
        is_all_day: true,
        is_holiday: false,
        color: EVENT_TYPE_COLORS.academy,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                description: event.description || '',
                event_type: event.event_type,
                event_date: event.event_date,
                start_time: event.start_time || '',
                end_time: event.end_time || '',
                is_all_day: event.is_all_day,
                is_holiday: event.is_holiday,
                color: event.color,
            });
        } else {
            setFormData({
                title: '',
                description: '',
                event_type: 'academy',
                event_date: selectedDate || new Date().toISOString().split('T')[0],
                start_time: '',
                end_time: '',
                is_all_day: true,
                is_holiday: false,
                color: EVENT_TYPE_COLORS.academy,
            });
        }
    }, [event, selectedDate, isOpen]);

    const handleEventTypeChange = (type: AcademyEventType) => {
        setFormData(prev => ({
            ...prev,
            event_type: type,
            color: EVENT_TYPE_COLORS[type],
            is_holiday: type === 'holiday' ? true : prev.is_holiday,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">
                        {event ? '일정 수정' : '일정 등록'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 일정 타입 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">일정 타입</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(EVENT_TYPE_LABELS) as AcademyEventType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleEventTypeChange(type)}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border
                                        ${formData.event_type === type
                                            ? 'text-white border-transparent'
                                            : 'bg-background text-foreground border-border hover:bg-muted'
                                        }`}
                                    style={formData.event_type === type ? { backgroundColor: EVENT_TYPE_COLORS[type] } : {}}
                                >
                                    {EVENT_TYPE_LABELS[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 제목 */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">제목 *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                            placeholder="일정 제목"
                            required
                        />
                    </div>

                    {/* 날짜 */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">날짜 *</label>
                        <input
                            type="date"
                            value={formData.event_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                            required
                        />
                    </div>

                    {/* 종일 여부 */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_all_day"
                            checked={formData.is_all_day}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_all_day: e.target.checked }))}
                            className="w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="is_all_day" className="text-sm text-foreground">종일</label>
                    </div>

                    {/* 시간 (종일이 아닐 때만) */}
                    {!formData.is_all_day && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">시작 시간</label>
                                <input
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">종료 시간</label>
                                <input
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                                />
                            </div>
                        </div>
                    )}

                    {/* 설명 */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">설명</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                            rows={3}
                            placeholder="일정 설명 (선택)"
                        />
                    </div>

                    {/* 휴일 여부 */}
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-900">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="is_holiday"
                                checked={formData.is_holiday}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_holiday: e.target.checked }))}
                                className="w-4 h-4 rounded border-red-300"
                            />
                            <label htmlFor="is_holiday" className="text-sm font-medium text-red-700 dark:text-red-300">
                                휴일 지정
                            </label>
                        </div>
                        {formData.is_holiday && (
                            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>휴일로 지정하면 해당 날짜의 상담 예약이 차단되고, 수업이 휴강 처리됩니다.</span>
                            </div>
                        )}
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            취소
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? '처리 중...' : event ? '수정' : '등록'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
