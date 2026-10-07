const { decrypt, logAudit, getAuditInfoFromReq } = require('../_utils');

function logStudentUpdateAudit(req, context) {
    const {
        studentId, oldStudent, parentContacts, previousParents, oldClassDaysRaw,
        trialUpdate, autoStudentNumber, isScheduledClassDays,
    } = context;
    const {
        name, gender, student_type, phone, parent_phone, school, grade, age,
        admission_type, weekly_count, monthly_tuition, discount_rate, discount_reason,
        payment_due_day, enrollment_date, address, notes, memo, time_slot,
        rest_start_date, rest_end_date, rest_reason, class_days,
    } = req.body;
    const oldValues = {};
    const newValues = {};
    const auditFields = {
        student_number: autoStudentNumber, name, gender, student_type, phone, parent_phone,
        school, grade, age, admission_type, weekly_count, monthly_tuition,
        discount_rate, discount_reason, payment_due_day, enrollment_date,
        address, notes, memo, status: trialUpdate.status, time_slot,
        rest_start_date, rest_end_date, rest_reason,
        is_trial: trialUpdate.isTrial,
        trial_remaining: trialUpdate.trialRemaining,
    };
    const encryptedKeys = ['name', 'phone', 'parent_phone', 'address'];
    for (const [field, newVal] of Object.entries(auditFields)) {
        if (newVal === undefined) continue;
        let oldVal = oldStudent[field];
        if (encryptedKeys.includes(field) && oldVal) {
            try { oldVal = decrypt(oldVal); } catch { /* keep raw */ }
        }
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
            oldValues[field] = field === 'parent_phone' ? (oldVal ? '등록됨' : '미등록') : oldVal;
            newValues[field] = field === 'parent_phone' ? (newVal ? '연락처 변경' : '미등록') : newVal;
        }
    }
    // Parent contacts stay out of audit JSON; record only the presence/change marker.
    for (const [field, value] of Object.entries(parentContacts.values)) {
        if ((previousParents[field] || null) === value) continue;
        oldValues[field] = previousParents[field] ? '등록됨' : '미등록';
        newValues[field] = value ? (field.endsWith('_phone') ? '연락처 변경' : '성함 변경') : '미등록';
    }
    if (class_days !== undefined) {
        oldValues.class_days = oldClassDaysRaw;
        newValues.class_days = class_days;
    }
    if (trialUpdate.trialDates !== undefined) {
        oldValues.trial_dates = oldStudent.trial_dates
            ? (typeof oldStudent.trial_dates === 'string' ? JSON.parse(oldStudent.trial_dates) : oldStudent.trial_dates)
            : null;
        newValues.trial_dates = trialUpdate.trialDates;
    }
    if (Object.keys(newValues).length > 0) {
        logAudit({
            ...getAuditInfoFromReq(req),
            action: isScheduledClassDays ? 'schedule' : 'update',
            tableName: 'students',
            recordId: studentId,
            oldValues,
            newValues,
        });
    }
}

module.exports = { logStudentUpdateAudit };
