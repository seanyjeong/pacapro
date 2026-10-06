const { isValidStudentAdmissionType, STUDENT_ADMISSION_LABELS } = require('../../constants/studentAdmissionTypes');
const { validateStudentProfileFields } = require('../../services/studentProfileValidationService');
const { getPromotedStudentValues } = require('../../services/studentGradePromotionService');
test('both is a valid student admission type displayed consistently in exports', () => {
  expect(isValidStudentAdmissionType('both')).toBe(true);
  expect(STUDENT_ADMISSION_LABELS.both).toBe('수시+정시');
  expect(validateStudentProfileFields({ admissionType: 'both', studentType: 'exam', grade: '고3' }).error).toBeNull();
  expect(validateStudentProfileFields({ admissionType: 'invalid', studentType: 'exam', grade: '고3' }).error).toBeTruthy();
});
test('annual and manual grade promotion preserve the both admission type', () => {
  expect(getPromotedStudentValues({ grade: '고2', admission_type: 'both' })).toEqual({
    grade: '고3', admissionType: 'both', admissionTypeChanged: false,
  });
  expect(getPromotedStudentValues({ grade: '고3', admission_type: 'both' }).admissionType).toBe('both');
});
