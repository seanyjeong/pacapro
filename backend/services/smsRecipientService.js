const { isValidPhoneNumber } = require('../utils/naverSens');

const TARGET_PHONE_FIELDS = Object.freeze({
    students: 'student_phone',
    parents: 'parent_phone',
    fathers: 'father_phone',
    mothers: 'mother_phone',
});

function getSmsRecipientPhone(student, target) {
    const fields = target === 'all'
        ? ['parent_phone', 'student_phone']
        : [TARGET_PHONE_FIELDS[target]];
    for (const field of fields) {
        const phone = field && student[field];
        if (isValidPhoneNumber(phone)) return phone;
    }
    return null;
}

function selectSmsRecipients(students, target) {
    const unique = new Map();
    for (const student of students) {
        const phone = getSmsRecipientPhone(student, target);
        if (!phone) continue;
        const normalized = phone.replace(/-/g, '');
        if (!unique.has(normalized)) {
            unique.set(normalized, { phone, name: student.name, studentId: student.id });
        }
    }
    return [...unique.values()];
}

function countSmsRecipients(students) {
    return {
        all: selectSmsRecipients(students, 'all').length,
        students: selectSmsRecipients(students, 'students').length,
        parents: selectSmsRecipients(students, 'parents').length,
        fathers: selectSmsRecipients(students, 'fathers').length,
        mothers: selectSmsRecipients(students, 'mothers').length,
    };
}

module.exports = { countSmsRecipients, selectSmsRecipients };
