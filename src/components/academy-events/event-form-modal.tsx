'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, AlertCircle } from 'lucide-react';
import type { AcademyEvent, AcademyEventFormData, AcademyEventType } from '@/lib/types/academyEvent';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types/academyEvent';
import { formatDate } from '@/lib/utils/format';

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
        event_date: selectedDate || formatDate(new Date()),
        start_time: '',
        end_time: '',
        is_all_day: true,
        is_holiday: false,
        block_consultation: false,
        color: EVENT_TYPE_COLORS.academy,
    });
    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                description: event.description || '',
                event_type: event.event_type,
                event_date: event.event_date,
                start_time: event.start_time?.slice(0, 5) || '',
                end_time: event.end_time?.slice(0, 5) || '',
                is_all_day: Boolean(event.is_all_day),
                is_holiday: Boolean(event.is_holiday),
                block_consultation: Boolean(event.block_consultation),
                color: event.color,
            });
        } else {
            setFormData({
                title: '',
                description: '',
                event_type: 'academy',
                event_date: selectedDate || formatDate(new Date()),
                start_time: '',
                end_time: '',
                is_all_day: true,
                is_holiday: false,
                block_consultation: false,
                color: EVENT_TYPE_COLORS.academy,
            });
        }
        setSubmitError(null);
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
        if (formData.block_consultation && !formData.is_all_day && !formData.is_holiday && (
            !formData.start_time || !formData.end_time || formData.start_time.slice(0, 5) >= formData.end_time.slice(0, 5)
        )) {
            setSubmitError('상담을 차단할 시작 시간과 종료 시간을 확인해주세요.');
            return;
        }
        setLoading(true);
        setSubmitError(null);
        try {
            await onSubmit(formData);
            onClose();
        } catch {
            setSubmitError('학원 일정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
            <div
                aria-labelledby="academy-event-form-title"
                aria-modal="true"
                className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:pb-0"
                role="dialog"
            >
                <div className="flex items-center justify-between px-6 pb-1 pt-5">
                    <h2 id="academy-event-form-title" className="text-[19px] font-bold tracking-tight text-foreground">
                        {event ? '일정 수정' : '일정 등록'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={event ? '일정 수정 닫기' : '일정 등록 닫기'}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 pt-3">
                    {/* 일정 타입 선택 */}
                    <div>
                        <label className="mb-2 block text-[13px] font-semibold text-secondary-foreground">일정 타입</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(Object.keys(EVENT_TYPE_LABELS) as AcademyEventType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleEventTypeChange(type)}
                                    className={`min-h-11 whitespace-nowrap rounded-xl px-2 py-2 text-sm font-semibold transition-colors
                                        ${formData.event_type === type
                                            ? 'text-white'
                                            : 'bg-muted text-secondary-foreground hover:text-foreground'
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
                        <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">제목 *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
                            placeholder="일정 제목"
                            required
                        />
                    </div>

                    {/* 날짜 */}
                    <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">날짜 *</label>
                        <input
                            type="date"
                            value={formData.event_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                            className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
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
                    {!Boolean(formData.is_all_day) && (
                        <div className="space-y-3">
                            {/* 빠른 시간 선택 버튼 */}
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-secondary-foreground">빠른 선택</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: '오전', start: '09:00', end: '12:00' },
                                        { label: '오후', start: '13:00', end: '18:00' },
                                        { label: '저녁', start: '18:00', end: '21:00' },
                                    ].map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                start_time: preset.start,
                                                end_time: preset.end
                                            }))}
                                            className={`h-11 rounded-xl px-3 text-sm font-semibold transition-colors
                                                ${formData.start_time === preset.start && formData.end_time === preset.end
                                                    ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/40'
                                                    : 'bg-muted text-secondary-foreground hover:text-foreground'
                                                }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 세부 시간 선택 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">시작 시간</label>
                                    <select
                                        value={formData.start_time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                        className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
                                    >
                                        <option value="">선택</option>
                                        {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
                                            <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                                                {hour < 12 ? `오전 ${hour}시` : hour === 12 ? '오후 12시' : `오후 ${hour - 12}시`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">종료 시간</label>
                                    <select
                                        value={formData.end_time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                        className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
                                    >
                                        <option value="">선택</option>
                                        {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
                                            <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                                                {hour < 12 ? `오전 ${hour}시` : hour === 12 ? '오후 12시' : `오후 ${hour - 12}시`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 설명 */}
                    <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">설명</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full rounded-xl border border-transparent bg-muted px-3 py-2.5 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
                            rows={3}
                            placeholder="일정 설명 (선택)"
                        />
                    </div>

                    <div className="rounded-xl bg-destructive-soft p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="is_holiday"
                                checked={formData.is_holiday}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_holiday: e.target.checked }))}
                                className="w-4 h-4 rounded border-destructive/30"
                            />
                            <label htmlFor="is_holiday" className="text-sm font-medium text-destructive">
                                휴일 지정
                            </label>
                        </div>
                        {Boolean(formData.is_holiday) && (
                            <div className="flex items-start gap-2 text-xs text-destructive">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>해당 날짜의 수업이 휴강 처리됩니다. 상담 예약도 막으려면 상담 차단을 켜주세요.</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-xl bg-muted p-3">
                        <div className="space-y-1">
                            <label htmlFor="block_consultation" className="cursor-pointer text-sm font-medium">
                                상담 차단
                            </label>
                            <p id="block-consultation-help" className="text-xs text-muted-foreground">
                                {!formData.block_consultation
                                    ? '일정만 등록하고 상담 예약은 그대로 받습니다.'
                                    : formData.is_all_day || formData.is_holiday
                                      ? '해당 날짜의 상담 예약을 하루 동안 막습니다.'
                                      : '일정이 포함된 오전·오후·저녁 시간대의 상담 예약을 막습니다.'}
                            </p>
                        </div>
                        <Switch
                            id="block_consultation"
                            checked={formData.block_consultation}
                            onCheckedChange={checked => setFormData(prev => ({ ...prev, block_consultation: checked }))}
                            aria-describedby="block-consultation-help"
                            disabled={loading}
                            className="shrink-0"
                        />
                    </div>

                    {submitError && (
                        <div
                            className="rounded-xl bg-warning-soft p-4 text-warning"
                            role="alert"
                        >
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold">저장 실패</h3>
                                    <p className="text-sm">{submitError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                            취소
                        </Button>
                        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                            {loading ? '처리 중...' : event ? '수정' : '등록'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
