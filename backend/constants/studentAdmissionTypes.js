const STUDENT_ADMISSION_TYPES = Object.freeze([
    'regular',
    'early',
    'advance',
    'civil_service',
    'military_academy',
    'police_university',
]);

const STUDENT_ADMISSION_LABELS = Object.freeze({
    regular: '정시',
    early: '수시',
    advance: '선행반',
    civil_service: '공무원',
    military_academy: '사관학교',
    police_university: '경찰대',
});

const ADMISSION_TYPE_VALIDATION_MESSAGE = '입시유형을 다시 선택해주세요.';
const ADVANCE_ADMISSION_VALIDATION_MESSAGE = '선행반은 중1부터 고2까지의 입시생만 선택할 수 있습니다.';
const ADVANCE_ELIGIBLE_GRADES = Object.freeze(['중1', '중2', '중3', '고1', '고2']);

function isValidStudentAdmissionType(value) {
    return STUDENT_ADMISSION_TYPES.includes(value);
}

function isAdvanceAdmissionAllowed({ admissionType, grade, studentType }) {
    return admissionType !== 'advance'
        || (studentType === 'exam' && ADVANCE_ELIGIBLE_GRADES.includes(grade));
}

module.exports = {
    ADMISSION_TYPE_VALIDATION_MESSAGE,
    ADVANCE_ADMISSION_VALIDATION_MESSAGE,
    ADVANCE_ELIGIBLE_GRADES,
    STUDENT_ADMISSION_LABELS,
    STUDENT_ADMISSION_TYPES,
    isAdvanceAdmissionAllowed,
    isValidStudentAdmissionType,
};
