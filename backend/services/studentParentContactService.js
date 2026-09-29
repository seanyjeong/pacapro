const { encrypt, decrypt } = require('../utils/encryption');
const {
    prepareStudentParentNames, decryptStudentParentNames, StudentParentNameValidationError,
} = require('./studentParentNameService');
const {
    STUDENT_PARENT_PHONE_FIELDS, STUDENT_PARENT_PHONE_LABELS,
    STUDENT_PARENT_PHONE_PATTERN, STUDENT_PARENT_PHONE_DIGITS_PATTERN,
} = require('../constants/studentParentPhones');

class StudentParentContactValidationError extends Error {}

function prepareStudentParentContacts(input) {
    let names;
    try {
        names = prepareStudentParentNames(input);
    } catch (error) {
        if (error instanceof StudentParentNameValidationError) {
            throw new StudentParentContactValidationError(error.message);
        }
        throw error;
    }
    const values = { ...names.values };
    const encrypted = { ...names.encrypted };
    for (const field of STUDENT_PARENT_PHONE_FIELDS) {
        const value = input[field];
        // Older clients omit these keys when updating unrelated student information.
        if (value === undefined) continue;
        const normalized = typeof value === 'string'
            ? value.trim().replace(STUDENT_PARENT_PHONE_DIGITS_PATTERN, '$1-$2-$3') : value;
        if (value !== null && (typeof value !== 'string'
            || /[\u0000-\u001f\u007f]/.test(value)
            || (normalized && !STUDENT_PARENT_PHONE_PATTERN.test(normalized)))) {
            throw new StudentParentContactValidationError(
                `${STUDENT_PARENT_PHONE_LABELS[field]}를 올바르게 입력해주세요. (예: 010-1234-5678)`);
        }
        values[field] = normalized || null;
        encrypted[field] = values[field] === null ? null : encrypt(values[field]);
        // Do not accept the legacy encryption helper's plaintext fallback.
        if (values[field] !== null && !encrypted[field]?.startsWith('ENC:')) {
            throw new Error('Student parent phone encryption failed');
        }
    }
    return { values, encrypted };
}

function decryptStudentParentContacts(record) {
    const result = decryptStudentParentNames(record);
    if (!result) return result;
    for (const field of STUDENT_PARENT_PHONE_FIELDS) {
        if (result[field] == null) continue;
        result[field] = decrypt(result[field]);
        if (typeof result[field] !== 'string' || /^ENC:/i.test(result[field])) {
            throw new Error('Student parent phone decryption failed');
        }
    }
    return result;
}

module.exports = {
    prepareStudentParentContacts, decryptStudentParentContacts, StudentParentContactValidationError,
};
