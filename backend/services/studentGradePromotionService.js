const { ADVANCE_ELIGIBLE_GRADES } = require('../constants/studentAdmissionTypes');

const GRADE_PROMOTION_MAP = Object.freeze({
    '중1': '중2',
    '중2': '중3',
    '중3': '고1',
    '고1': '고2',
    '고2': '고3',
    '고3': 'N수',
    'N수': 'N수',
});

const GRADE_PROMOTION_ORDER = Object.freeze([
    { from: '고3', to: 'N수' },
    { from: '고2', to: '고3' },
    { from: '고1', to: '고2' },
    { from: '중3', to: '고1' },
    { from: '중2', to: '중3' },
    { from: '중1', to: '중2' },
]);

function getAdmissionTypeAfterGradeChange({ fromGrade, toGrade, admissionType }) {
    const finishesAdvanceClass = admissionType === 'advance'
        && fromGrade !== toGrade
        && !ADVANCE_ELIGIBLE_GRADES.includes(toGrade);

    return finishesAdvanceClass ? 'regular' : admissionType;
}

function getPromotedStudentValues(student) {
    const promotedGrade = GRADE_PROMOTION_MAP[student.grade] || student.grade;
    const promotedAdmissionType = getAdmissionTypeAfterGradeChange({
        fromGrade: student.grade,
        toGrade: promotedGrade,
        admissionType: student.admission_type,
    });

    return {
        grade: promotedGrade,
        admissionType: promotedAdmissionType,
        admissionTypeChanged: promotedAdmissionType !== student.admission_type,
    };
}

module.exports = {
    GRADE_PROMOTION_MAP,
    GRADE_PROMOTION_ORDER,
    getAdmissionTypeAfterGradeChange,
    getPromotedStudentValues,
};
