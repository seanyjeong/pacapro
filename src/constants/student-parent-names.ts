export const STUDENT_PARENT_NAME_MAX_LENGTH = 100;
export const STUDENT_PARENT_NAME_FIELDS = [
  { field: 'father_name', label: '아버지 성함', phoneField: 'father_phone', phoneLabel: '아버지 전화번호' },
  { field: 'mother_name', label: '어머니 성함', phoneField: 'mother_phone', phoneLabel: '어머니 전화번호' },
] as const;
export const STUDENT_PARENT_INFO_SECTION_ID = 'parent-info';
