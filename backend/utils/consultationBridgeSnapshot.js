const crypto = require('node:crypto');
const DERIVED = new Set(['academicScores', 'referralSources', 'linked_student_name',
    'linked_student_grade', 'linked_student_is_trial']);
const JSON_FIELDS = new Set(['academic_scores', 'referral_sources', 'checklist']);

function consultationSnapshot(row) {
    const value = Object.fromEntries(Object.entries(row).filter(([key]) => !DERIVED.has(key)).map(([key, value]) => {
        if (JSON_FIELDS.has(key) && typeof value === 'string') {
            try { value = JSON.parse(value); } catch { /* Preserve invalid source data in the comparison. */ }
        }
        return [key, value];
    }));
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex')}`;
}
function sorted(value) {
    if (Array.isArray(value)) return value.map(sorted);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

module.exports = { consultationSnapshot };
