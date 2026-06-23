'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2,
    Clock,
    Wallet,
    CreditCard,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Loader2,
    PartyPopper,
    Users,
    UserCog,
    Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { onboardingAPI, OnboardingData, TuitionSettings } from '@/lib/api/onboarding';
import { toast } from 'sonner';

// 스텝 정의
const STEPS = [
    { id: 1, title: '학원 정보', description: '기본 정보를 입력해주세요', icon: Building2 },
    { id: 2, title: '수업 시간', description: '수업 시간대를 설정해주세요', icon: Clock },
    { id: 3, title: '학원비', description: '학원비를 설정해주세요', icon: Wallet },
    { id: 4, title: '급여 설정', description: '급여 지급일을 설정해주세요', icon: CreditCard },
    { id: 5, title: '완료', description: '설정을 확인해주세요', icon: CheckCircle },
];

// 폼 데이터 타입
interface FormData {
    // Step 1
    academy_name: string;
    phone: string;
    address: string;
    business_number: string;
    // Step 2
    morning_class_time: string;
    afternoon_class_time: string;
    evening_class_time: string;
    // Step 3
    tuition_settings: TuitionSettings;
    // Step 4
    salary_payment_day: number;
    salary_month_type: 'current' | 'next';
    tuition_due_day: number;
    // Step 5
    create_sample_data: boolean;
}

const defaultFormData: FormData = {
    academy_name: '',
    phone: '',
    address: '',
    business_number: '',
    morning_class_time: '09:30-12:00',
    afternoon_class_time: '14:00-18:00',
    evening_class_time: '18:30-21:00',
    tuition_settings: {
        exam_tuition: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 },
        adult_tuition: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 },
    },
    salary_payment_day: 10,
    salary_month_type: 'next',
    tuition_due_day: 5,
    create_sample_data: false,
};

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(defaultFormData);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // 기존 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await onboardingAPI.getData();
                setFormData(prev => ({
                    ...prev,
                    academy_name: data.academy.name || '',
                    phone: data.academy.phone || '',
                    address: data.academy.address || '',
                    business_number: data.academy.business_number || '',
                    morning_class_time: data.settings.morning_class_time || '09:30-12:00',
                    afternoon_class_time: data.settings.afternoon_class_time || '14:00-18:00',
                    evening_class_time: data.settings.evening_class_time || '18:30-21:00',
                    salary_payment_day: data.settings.salary_payment_day || 10,
                    salary_month_type: (data.settings.salary_month_type as 'current' | 'next') || 'next',
                    tuition_due_day: data.settings.tuition_due_day || 5,
                    tuition_settings: (() => {
                        if (!data.settings.settings) return defaultFormData.tuition_settings;
                        if (typeof data.settings.settings === 'object') return data.settings.settings;
                        try {
                            return JSON.parse(data.settings.settings);
                        } catch {
                            return defaultFormData.tuition_settings;
                        }
                    })(),
                }));
            } catch (error) {
                console.error('Failed to load onboarding data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // 폼 데이터 업데이트
    const updateFormData = (field: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // 다음 스텝
    const nextStep = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1);
        }
    };

    // 이전 스텝
    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // 온보딩 완료
    const handleComplete = async () => {
        setSubmitting(true);
        try {
            // 설정 저장
            await onboardingAPI.complete({
                academy_name: formData.academy_name,
                phone: formData.phone,
                address: formData.address,
                business_number: formData.business_number,
                morning_class_time: formData.morning_class_time,
                afternoon_class_time: formData.afternoon_class_time,
                evening_class_time: formData.evening_class_time,
                tuition_settings: formData.tuition_settings,
                salary_payment_day: formData.salary_payment_day,
                salary_month_type: formData.salary_month_type,
                tuition_due_day: formData.tuition_due_day,
            });

            // 샘플 데이터 생성
            if (formData.create_sample_data) {
                await onboardingAPI.createSampleData();
            }

            setCompleted(true);
            toast.success('설정이 완료되었습니다!');

            // 2초 후 대시보드로 이동
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
            toast.error('설정 저장에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    // 건너뛰기
    const handleSkip = async () => {
        try {
            await onboardingAPI.skip();
            router.push('/');
        } catch (error) {
            console.error('Failed to skip onboarding:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200 animate-bounce-in">
                        <PartyPopper className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">설정 완료!</h2>
                    <p className="text-muted-foreground">잠시 후 대시보드로 이동합니다...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-b z-50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-lg">P</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground">P-ACA 초기 설정</h1>
                            <p className="text-xs text-muted-foreground">학원 운영에 필요한 기본 설정을 완료해주세요</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleSkip}>
                        건너뛰기
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="fixed top-[73px] left-0 right-0 bg-card border-b z-40">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div
                                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                                        currentStep > step.id
                                            ? 'bg-green-500 text-white'
                                            : currentStep === step.id
                                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    {currentStep > step.id ? (
                                        <CheckCircle className="w-5 h-5" />
                                    ) : (
                                        <span className="text-sm font-medium">{step.id}</span>
                                    )}
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={`w-12 sm:w-24 h-1 mx-1 rounded transition-all duration-300 ${
                                            currentStep > step.id ? 'bg-green-500' : 'bg-muted'
                                        }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        {STEPS.map(step => (
                            <span key={step.id} className={`${currentStep === step.id ? 'text-indigo-600 font-medium' : ''}`}>
                                {step.title}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-40 pb-24 px-4">
                <div className="max-w-2xl mx-auto">
                    <div key={currentStep} className="transition-all duration-300">
                        {/* Step Content */}
                        {currentStep === 1 && (
                            <StepAcademy formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 2 && (
                            <StepClassTime formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 3 && (
                            <StepTuition formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 4 && (
                            <StepSalary formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 5 && (
                            <StepComplete formData={formData} updateFormData={updateFormData} />
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-card border-t">
                <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between">
                    <Button
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="flex items-center space-x-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>이전</span>
                    </Button>
                    {currentStep < STEPS.length ? (
                        <Button
                            onClick={nextStep}
                            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                        >
                            <span>다음</span>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleComplete}
                            disabled={submitting}
                            className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            <span>{submitting ? '저장 중...' : '시작하기'}</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================
// Step Components
// ============================================

// Step 1: 학원 기본 정보
function StepAcademy({ formData, updateFormData }: { formData: FormData; updateFormData: (field: keyof FormData, value: any) => void }) {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                    <Building2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">학원 정보</h2>
                <p className="text-muted-foreground mt-1">학원의 기본 정보를 입력해주세요</p>
            </div>

            <Card>
                <CardContent className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            학원명 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.academy_name}
                            onChange={(e) => updateFormData('academy_name', e.target.value)}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="예: 파파 체육입시학원"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">전화번호</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => updateFormData('phone', e.target.value)}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="예: 02-1234-5678"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">주소</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => updateFormData('address', e.target.value)}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="예: 서울시 강남구 역삼동 123-45"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">사업자등록번호</label>
                        <input
                            type="text"
                            value={formData.business_number}
                            onChange={(e) => updateFormData('business_number', e.target.value)}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="예: 123-45-67890"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Step 2: 수업 시간대 설정
function StepClassTime({ formData, updateFormData }: { formData: FormData; updateFormData: (field: keyof FormData, value: any) => void }) {
    const timeSlots = [
        { key: 'morning_class_time', label: '오전반', icon: '🌅', color: 'from-orange-400 to-amber-500' },
        { key: 'afternoon_class_time', label: '오후반', icon: '☀️', color: 'from-blue-400 to-cyan-500' },
        { key: 'evening_class_time', label: '저녁반', icon: '🌙', color: 'from-purple-400 to-indigo-500' },
    ];

    const parseTime = (timeString: string) => {
        const [start, end] = timeString.split('-');
        return { start, end };
    };

    const updateTime = (key: string, type: 'start' | 'end', value: string) => {
        const current = parseTime(formData[key as keyof FormData] as string);
        const newValue = type === 'start' ? `${value}-${current.end}` : `${current.start}-${value}`;
        updateFormData(key as keyof FormData, newValue);
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                    <Clock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">수업 시간대</h2>
                <p className="text-muted-foreground mt-1">각 시간대별 수업 시간을 설정해주세요</p>
            </div>

            <div className="space-y-4">
                {timeSlots.map(slot => {
                    const times = parseTime(formData[slot.key as keyof FormData] as string);
                    return (
                        <Card key={slot.key} className="overflow-hidden">
                            <div className={`h-2 bg-gradient-to-r ${slot.color}`} />
                            <CardContent className="p-6">
                                <div className="flex items-center space-x-3 mb-4">
                                    <span className="text-2xl">{slot.icon}</span>
                                    <h3 className="font-semibold text-foreground">{slot.label}</h3>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-muted-foreground mb-1">시작</label>
                                        <input
                                            type="time"
                                            value={times.start}
                                            onChange={(e) => updateTime(slot.key, 'start', e.target.value)}
                                            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <span className="text-muted-foreground pt-5">~</span>
                                    <div className="flex-1">
                                        <label className="block text-xs text-muted-foreground mb-1">종료</label>
                                        <input
                                            type="time"
                                            value={times.end}
                                            onChange={(e) => updateTime(slot.key, 'end', e.target.value)}
                                            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

// Step 3: 학원비 설정
function StepTuition({ formData, updateFormData }: { formData: FormData; updateFormData: (field: keyof FormData, value: any) => void }) {
    const [activeTab, setActiveTab] = useState<'exam' | 'adult'>('exam');

    const updateTuition = (type: 'exam' | 'adult', sessions: string, value: string) => {
        const key = type === 'exam' ? 'exam_tuition' : 'adult_tuition';
        const numValue = parseInt(value.replace(/,/g, '')) || 0;
        updateFormData('tuition_settings', {
            ...formData.tuition_settings,
            [key]: {
                ...formData.tuition_settings[key],
                [sessions]: numValue,
            },
        });
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

    const tabs = [
        { id: 'exam', label: '입시반', icon: '🎯' },
        { id: 'adult', label: '성인반', icon: '💼' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
                    <Wallet className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">학원비 설정</h2>
                <p className="text-muted-foreground mt-1">주당 수업 횟수별 학원비를 설정해주세요</p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 bg-muted p-1 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'exam' | 'adult')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tuition Grid */}
            <Card>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7].map(sessions => {
                            const key = activeTab === 'exam' ? 'exam_tuition' : 'adult_tuition';
                            const value = formData.tuition_settings[key]?.[sessions.toString()] || 0;
                            return (
                                <div key={sessions}>
                                    <label className="block text-xs text-muted-foreground mb-1">
                                        주 {sessions}회
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formatNumber(value)}
                                            onChange={(e) => updateTuition(activeTab, sessions.toString(), e.target.value)}
                                            className="w-full px-3 py-2 pr-8 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">원</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground text-center">
                나중에 설정 페이지에서 언제든 수정할 수 있어요
            </p>
        </div>
    );
}

// Step 4: 급여 설정
function StepSalary({ formData, updateFormData }: { formData: FormData; updateFormData: (field: keyof FormData, value: any) => void }) {
    const paymentDays = [1, 5, 10, 15, 20, 25, 0];
    const dueDays = Array.from({ length: 28 }, (_, i) => i + 1);

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
                    <CreditCard className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">급여 설정</h2>
                <p className="text-muted-foreground mt-1">급여 지급일과 정산 방식을 설정해주세요</p>
            </div>

            <div className="space-y-4">
                {/* 급여 지급일 */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">급여 지급일</h3>
                        <div className="flex flex-wrap gap-2">
                            {paymentDays.map(day => (
                                <button
                                    key={day}
                                    onClick={() => updateFormData('salary_payment_day', day)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        formData.salary_payment_day === day
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-muted text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {day === 0 ? '말일' : `${day}일`}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 정산 방식 */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">정산 방식</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => updateFormData('salary_month_type', 'current')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    formData.salary_month_type === 'current'
                                        ? 'border-indigo-600 bg-indigo-50'
                                        : 'border-border hover:border-border'
                                }`}
                            >
                                <div className="text-lg font-semibold text-foreground">당월 정산</div>
                                <div className="text-sm text-muted-foreground">11월 근무 → 11월 지급</div>
                            </button>
                            <button
                                onClick={() => updateFormData('salary_month_type', 'next')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    formData.salary_month_type === 'next'
                                        ? 'border-indigo-600 bg-indigo-50'
                                        : 'border-border hover:border-border'
                                }`}
                            >
                                <div className="text-lg font-semibold text-foreground">익월 정산</div>
                                <div className="text-sm text-muted-foreground">11월 근무 → 12월 지급</div>
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* 학원비 납부일 */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">학원비 기본 납부일</h3>
                        <select
                            value={formData.tuition_due_day}
                            onChange={(e) => updateFormData('tuition_due_day', parseInt(e.target.value))}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {dueDays.map(day => (
                                <option key={day} value={day}>매월 {day}일</option>
                            ))}
                        </select>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Step 5: 완료
function StepComplete({ formData, updateFormData }: { formData: FormData; updateFormData: (field: keyof FormData, value: any) => void }) {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
                    <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">설정 완료!</h2>
                <p className="text-muted-foreground mt-1">설정 내용을 확인하고 시작해주세요</p>
            </div>

            {/* 설정 요약 */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">학원명</span>
                        <span className="font-medium text-foreground">{formData.academy_name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">수업 시간대</span>
                        <span className="font-medium text-foreground">
                            오전 {formData.morning_class_time.split('-')[0]}~
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">급여 지급일</span>
                        <span className="font-medium text-foreground">
                            매월 {formData.salary_payment_day === 0 ? '말일' : `${formData.salary_payment_day}일`}
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">정산 방식</span>
                        <span className="font-medium text-foreground">
                            {formData.salary_month_type === 'current' ? '당월 정산' : '익월 정산'}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* 샘플 데이터 옵션 */}
            <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/50">
                <CardContent className="p-6">
                    <label className="flex items-start space-x-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.create_sample_data}
                            onChange={(e) => updateFormData('create_sample_data', e.target.checked)}
                            className="mt-1 w-5 h-5 rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                            <div className="font-semibold text-foreground flex items-center">
                                <Sparkles className="w-4 h-4 mr-2 text-indigo-600" />
                                테스트용 샘플 데이터 생성
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                시스템을 먼저 체험해보고 싶으시면 체크해주세요.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Users className="w-3 h-3 mr-1" />
                                    학생 3명
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    <UserCog className="w-3 h-3 mr-1" />
                                    강사 2명
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    시즌 1개
                                </span>
                            </div>
                        </div>
                    </label>
                </CardContent>
            </Card>
        </div>
    );
}
