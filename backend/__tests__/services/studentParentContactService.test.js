process.env.DATA_ENCRYPTION_KEY = 'isolated-parent-contact-test-key';
const crypto = require('crypto');
const {
    prepareStudentParentContacts, decryptStudentParentContacts, StudentParentContactValidationError,
} = require('../../services/studentParentContactService');
const { omitStudentParentNames } = require('../../services/studentParentNameService');

afterEach(() => jest.restoreAllMocks());

test('both parents round-trip independently with encrypted phones and existing names', () => {
    const prepared = prepareStudentParentContacts({
        father_name: ' 김아버지 ', mother_name: '박어머니',
        father_phone: ' 01011112222 ', mother_phone: '010-3333-4444',
    });
    expect(prepared.encrypted.father_phone).toMatch(/^ENC:/);
    expect(prepared.encrypted.mother_phone).toMatch(/^ENC:/);
    expect(decryptStudentParentContacts(prepared.encrypted)).toEqual({
        father_name: '김아버지', mother_name: '박어머니',
        father_phone: '010-1111-2222', mother_phone: '010-3333-4444',
    });
});

test('omitted contacts are preserved and explicit blanks or null clear only the supplied fields', () => {
    expect(prepareStudentParentContacts({ memo: '연락 예정' })).toEqual({ values: {}, encrypted: {} });
    expect(prepareStudentParentContacts({ father_phone: ' ', mother_phone: null })).toEqual({
        values: { father_phone: null, mother_phone: null },
        encrypted: { father_phone: null, mother_phone: null },
    });
    expect(prepareStudentParentContacts({ father_phone: '010-123-4567' }).values).toEqual({ father_phone: '010-123-4567' });
});

test.each([123, {}, ['010-1234-5678'], '010-123', '010-1234-56789', 'ENC:forged', '010-1234-5678\n'])(
    'invalid parent phone %p is rejected before persistence', (father_phone) => {
        expect(() => prepareStudentParentContacts({ father_phone })).toThrow(StudentParentContactValidationError);
    },
);

test('existing parent-name validation remains a client validation error', () => {
    expect(() => prepareStudentParentContacts({ mother_name: 42 })).toThrow(StudentParentContactValidationError);
});

test('encryption and decryption failures never expose plaintext or ciphertext as a contact', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(crypto, 'createCipheriv').mockImplementation(() => { throw new Error('fixture'); });
    expect(() => prepareStudentParentContacts({ father_phone: '010-1234-5678' })).toThrow('encryption failed');
    expect(() => decryptStudentParentContacts({ mother_phone: 'ENC:corrupt' })).toThrow('decryption failed');
});

test('legacy action responses omit both new phone fields without altering the original row', () => {
    const row = { id: 1, father_name: 'ENC:name', father_phone: 'ENC:father', mother_phone: 'ENC:mother', parent_phone: 'legacy' };
    expect(omitStudentParentNames(row)).toEqual({ id: 1, parent_phone: 'legacy' });
    expect(row.father_phone).toBe('ENC:father');
});
