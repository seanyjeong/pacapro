const {
    getAdmissionTypeAfterGradeChange,
    getPromotedStudentValues,
} = require('../../services/studentGradePromotionService');

describe('studentGradePromotionService', () => {
    test('고2 선행반은 고3 승급과 함께 정시로 전환한다', () => {
        expect(getPromotedStudentValues({
            grade: '고2',
            admission_type: 'advance',
        })).toEqual({
            grade: '고3',
            admissionType: 'regular',
            admissionTypeChanged: true,
        });
    });

    test.each([
        ['고1', 'advance', '고2', 'advance'],
        ['고2', 'early', '고3', 'early'],
        ['N수', 'advance', 'N수', 'advance'],
    ])('%s/%s 승급은 입시유형을 임의로 바꾸지 않는다', (
        grade,
        admissionType,
        expectedGrade,
        expectedAdmissionType,
    ) => {
        expect(getPromotedStudentValues({
            grade,
            admission_type: admissionType,
        })).toEqual({
            grade: expectedGrade,
            admissionType: expectedAdmissionType,
            admissionTypeChanged: false,
        });
    });

    test('고3에 남은 선행반도 N수 승급 때 정시로 정리한다', () => {
        expect(getPromotedStudentValues({
            grade: '고3',
            admission_type: 'advance',
        })).toEqual({
            grade: 'N수',
            admissionType: 'regular',
            admissionTypeChanged: true,
        });
    });

    test('수동 진급도 고3 이상으로 이동할 때만 선행반을 종료한다', () => {
        expect(getAdmissionTypeAfterGradeChange({
            fromGrade: '중3',
            toGrade: '고1',
            admissionType: 'advance',
        })).toBe('advance');
        expect(getAdmissionTypeAfterGradeChange({
            fromGrade: '고2',
            toGrade: 'N수',
            admissionType: 'advance',
        })).toBe('regular');
        expect(getAdmissionTypeAfterGradeChange({
            fromGrade: '고2',
            toGrade: null,
            admissionType: 'advance',
        })).toBe('regular');
    });
});
