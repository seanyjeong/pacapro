const { generateStudentNumber } = require('../../utils/studentNumberGenerator');

describe('generateStudentNumber', () => {
    // 기본 생성
    test('첫 학번은 {년도}001', () => {
        expect(generateStudentNumber(null, 2026)).toBe('2026001');
    });

    test('마지막 학번 다음 번호 생성', () => {
        expect(generateStudentNumber('2026005', 2026)).toBe('2026006');
    });

    test('연속 번호 정상 증가', () => {
        expect(generateStudentNumber('2026099', 2026)).toBe('2026100');
    });

    // 경계값
    test('3자리 최대값 999 → 1000 (4자리)', () => {
        expect(generateStudentNumber('2026999', 2026)).toBe('20261000');
    });

    test('0 패딩 유지', () => {
        expect(generateStudentNumber('2026001', 2026)).toBe('2026002');
    });

    // null/undefined 처리
    test('lastStudentNumber가 undefined면 001부터', () => {
        expect(generateStudentNumber(undefined, 2026)).toBe('2026001');
    });

    test('lastStudentNumber가 빈 문자열이면 001부터', () => {
        expect(generateStudentNumber('', 2026)).toBe('2026001');
    });

    // 연도 미지정 시 현재 연도 사용
    test('연도 미지정 시 현재 연도', () => {
        const currentYear = new Date().getFullYear();
        const result = generateStudentNumber(null);
        expect(result).toBe(`${currentYear}001`);
    });

    // 비정상 학번 처리
    test('학번 뒷자리가 숫자가 아니면 001부터', () => {
        expect(generateStudentNumber('2026abc', 2026)).toBe('2026001');
    });
});
