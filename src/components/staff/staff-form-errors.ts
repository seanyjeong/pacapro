import { getSafeApiToastMessage } from '@/lib/api/error-message';

export type StaffFormErrorField = 'instructor_id' | 'email' | 'password' | 'submit';

type ApiError = {
  response?: {
    status?: number;
    data?: {
      error?: unknown;
      message?: unknown;
    };
  };
};

export function getStaffFormError(error: unknown): { field: StaffFormErrorField; message: string } {
  const apiError = error as ApiError;
  const rawMessage = apiError.response?.data?.message ?? apiError.response?.data?.error;
  const safeMessage = getSafeApiToastMessage(rawMessage);
  const status = apiError.response?.status;

  if (status === 409 && safeMessage.includes('이메일')) {
    return {
      field: 'email',
      message: '이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.',
    };
  }

  if (safeMessage.includes('강사는 이미 계정')) {
    return {
      field: 'instructor_id',
      message: '선택한 강사는 이미 로그인 계정이 있습니다. 기존 계정을 수정하거나 다른 강사를 선택해주세요.',
    };
  }

  if (safeMessage.includes('이메일')) return { field: 'email', message: safeMessage };
  if (safeMessage.includes('비밀번호')) return { field: 'password', message: safeMessage };
  if (safeMessage.includes('강사')) return { field: 'instructor_id', message: safeMessage };

  return { field: 'submit', message: safeMessage };
}
