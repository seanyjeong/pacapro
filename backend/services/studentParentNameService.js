const { encrypt, decrypt } = require('../utils/encryption');
const {
    STUDENT_PARENT_NAME_FIELDS, STUDENT_PARENT_NAME_MAX_LENGTH, STUDENT_PARENT_NAME_LABELS,
} = require('../constants/studentParentNames');

class StudentParentNameValidationError extends Error {}

function prepareStudentParentNames(input) {
    const values = {};
    const encrypted = {};
    for (const field of STUDENT_PARENT_NAME_FIELDS) {
        const value = input[field];
        // Omitted keys preserve existing names when older clients update another field.
        if (value === undefined) continue;
        if (value !== null && (typeof value !== 'string'
            || value.trim().length > STUDENT_PARENT_NAME_MAX_LENGTH
            || /^ENC:/i.test(value.trim()) || /[\u0000-\u001f\u007f]/.test(value))) {
            throw new StudentParentNameValidationError(
                `${STUDENT_PARENT_NAME_LABELS[field]}은 ${STUDENT_PARENT_NAME_MAX_LENGTH}자 이내로 입력해주세요.`);
        }
        values[field] = value === null ? null : value.trim() || null;
        encrypted[field] = values[field] === null ? null : encrypt(values[field]);
        // The legacy encryption helper returns plaintext on failure; never persist that fallback here.
        if (values[field] !== null && !encrypted[field]?.startsWith('ENC:')) {
            throw new Error('Student parent name encryption failed');
        }
    }
    return { values, encrypted };
}

function decryptStudentParentNames(record) {
    if (!record) return record;
    const result = { ...record };
    for (const field of STUDENT_PARENT_NAME_FIELDS) {
        if (result[field] == null) continue;
        result[field] = decrypt(result[field]);
        if (typeof result[field] !== 'string' || /^ENC:/i.test(result[field])) {
            throw new Error('Student parent name decryption failed');
        }
    }
    return result;
}

function matchesStudentParentName(student, query) {
    const normalized = query.replace(/\s+/g, '').toLocaleLowerCase('ko');
    return STUDENT_PARENT_NAME_FIELDS.some(field => typeof student[field] === 'string'
        && student[field].replace(/\s+/g, '').toLocaleLowerCase('ko').includes(normalized));
}

function omitStudentParentNames(record) {
    // Legacy action responses return SELECT * rows; identity is reloaded through student detail.
    const result = { ...record };
    for (const field of STUDENT_PARENT_NAME_FIELDS) delete result[field];
    return result;
}

module.exports = {
    prepareStudentParentNames, decryptStudentParentNames, matchesStudentParentName, omitStudentParentNames, StudentParentNameValidationError,
};
