export const LEARNING_CONSULTATION_ERROR_MESSAGES = {
  missingGrade: '학생의 학년 정보가 없어 상담을 등록할 수 없습니다. 학생정보에서 학년을 입력한 뒤 다시 시도해 주세요.',
  requiredFields: '학생, 날짜, 시간, 상담유형은 필수입니다.',
  studentNotFound: '학생을 찾을 수 없습니다. 학생 목록을 새로 불러온 뒤 다시 선택해 주세요.',
  fallback: '재원생 상담을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.',
} as const;
