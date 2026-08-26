const {
    ADMISSION_TYPE_VALIDATION_MESSAGE,
    ADVANCE_ADMISSION_VALIDATION_MESSAGE,
    isAdvanceAdmissionAllowed,
    isValidStudentAdmissionType,
} = require('../constants/studentAdmissionTypes');
const {
    getAdmissionTypeAfterGradeChange,
} = require('./studentGradePromotionService');

const VALID_STUDENT_TYPES = Object.freeze(['exam', 'adult']);
const VALID_GRADES = Object.freeze(['중1', '중2', '중3', '고1', '고2', '고3', 'N수']);
const VALID_TIME_SLOTS = Object.freeze(['morning', 'afternoon', 'evening']);

function validateStudentProfileFields({
    admissionType,
    currentStudent,
    grade,
    studentType,
    timeSlot,
}) {
    if (studentType && !VALID_STUDENT_TYPES.includes(studentType)) {
        return { error: '학생 유형을 다시 선택해주세요.' };
    }
    if (grade && !VALID_GRADES.includes(grade)) {
        return { error: '학년을 다시 선택해주세요.' };
    }
    if (admissionType && !isValidStudentAdmissionType(admissionType)) {
        return { error: ADMISSION_TYPE_VALIDATION_MESSAGE };
    }
    if (timeSlot && !VALID_TIME_SLOTS.includes(timeSlot)) {
        return { error: '수업 시간대를 다시 선택해주세요.' };
    }

    const resolvedStudentType = studentType !== undefined
        ? studentType
        : currentStudent?.student_type || 'exam';
    const resolvedGrade = grade !== undefined ? grade : currentStudent?.grade;
    const admissionTypeAfterGradeChange = currentStudent
        ? getAdmissionTypeAfterGradeChange({
            fromGrade: currentStudent.grade,
            toGrade: resolvedGrade,
            admissionType: currentStudent.admission_type,
        })
        : admissionType;
    const resolvedAdmissionType = admissionType !== undefined
        ? admissionType
        : admissionTypeAfterGradeChange;
    if (!isAdvanceAdmissionAllowed({
        admissionType: resolvedAdmissionType,
        grade: resolvedGrade,
        studentType: resolvedStudentType,
    })) {
        return { error: ADVANCE_ADMISSION_VALIDATION_MESSAGE };
    }

    return { admissionTypeAfterGradeChange, error: null };
}

module.exports = {
    VALID_GRADES,
    validateStudentProfileFields,
};
