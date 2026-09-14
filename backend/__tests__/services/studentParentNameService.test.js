process.env.DATA_ENCRYPTION_KEY = 'isolated-parent-name-test-key';
const crypto = require('crypto');
const { prepareStudentParentNames, decryptStudentParentNames, matchesStudentParentName,
    StudentParentNameValidationError, omitStudentParentNames } = require('../../services/studentParentNameService');

afterEach(() => jest.restoreAllMocks());

test('optional fields distinguish omission, clearing and trimmed encrypted names', () => {
    expect(prepareStudentParentNames({}).encrypted).toEqual({});
    expect(prepareStudentParentNames({ father_name: '  ', mother_name: null }).encrypted)
        .toEqual({ father_name: null, mother_name: null });
    const { encrypted } = prepareStudentParentNames({ father_name: '  김아버지 ', mother_name: '박어머니' });
    expect(encrypted.father_name).toMatch(/^ENC:/);
    expect(encrypted.father_name).not.toContain('김아버지');
    expect(decryptStudentParentNames(encrypted)).toEqual({ father_name: '김아버지', mother_name: '박어머니' });
    expect(prepareStudentParentNames({ father_name: '김아버지' }).encrypted.father_name)
        .not.toEqual(encrypted.father_name);
});

test.each([false, 123, {}, [], '가'.repeat(101), 'ENC:ciphertext', ' enc:value', '김\n아버지'])
('rejects invalid parent input %p', (value) => {
    expect(() => prepareStudentParentNames({ father_name: value })).toThrow(StudentParentNameValidationError);
});

test('maximum Korean name fits encrypted database storage and round trips', () => {
    const name = '가'.repeat(100);
    const { encrypted } = prepareStudentParentNames({ mother_name: name });
    expect(encrypted.mother_name.length).toBeLessThanOrEqual(512);
    expect(decryptStudentParentNames(encrypted).mother_name).toBe(name);
});

test('encryption failure cannot return plaintext for persistence', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(crypto, 'createCipheriv').mockImplementation(() => { throw new Error('fixture'); });
    expect(() => prepareStudentParentNames({ father_name: '김아버지' })).toThrow('encryption failed');
});

test('corrupt ciphertext fails closed instead of appearing in the response', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => decryptStudentParentNames({ father_name: 'ENC:corrupt' })).toThrow('decryption failed');
});

test('parent search ignores whitespace and matches siblings without choosing a student', () => {
    const students = [{ id: 1, father_name: '김아버지' }, { id: 2, father_name: '김아버지' }, { id: 3 }];
    expect(students.filter(student => matchesStudentParentName(student, ' 김 아버지 ')).map(s => s.id)).toEqual([1, 2]);
    expect(matchesStudentParentName({ mother_name: 'Jane Doe' }, 'janeDOE')).toBe(true);
});

test('legacy action responses omit parent ciphertext without mutating stored identity', () => {
    const row = { id: 1, father_name: 'ENC:secret', mother_name: 'ENC:other', status: 'paused' };
    expect(omitStudentParentNames(row)).toEqual({ id: 1, status: 'paused' });
    expect(row.father_name).toBe('ENC:secret');
});
