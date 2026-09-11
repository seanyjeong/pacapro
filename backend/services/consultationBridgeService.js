const FIELDS = new Set(['preferredDate', 'preferredTime', 'adminNotes', 'consultationMemo']);
class ConsultationBridgeError extends Error {
    constructor(status, code) { super(code); this.status = status; }
}
class ConsultationBridgeService {
    constructor(repository) { this.repository = repository; }

    async change(academyId, rawId, expectedHash, changes, remove) {
        if (!/^[1-9][0-9]*$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId))
            || !Number.isSafeInteger(Number(academyId)) || Number(academyId) <= 0
            || !/^sha256:[a-f0-9]{64}$/.test(expectedHash || '')
            || !changes || typeof changes !== 'object' || Array.isArray(changes)
            || Object.keys(changes).some((key) => !FIELDS.has(key))
            || (!remove && Object.keys(changes).length === 0) || (remove && Object.keys(changes).length !== 0)) invalid();
        if (changes.preferredDate !== undefined && !validDate(changes.preferredDate)) invalid();
        if (changes.preferredTime !== undefined && (typeof changes.preferredTime !== 'string'
            || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(changes.preferredTime))) invalid();
        for (const key of ['adminNotes', 'consultationMemo']) {
            if (changes[key] !== undefined && changes[key] !== null
                && (typeof changes[key] !== 'string' || changes[key].length > 1000)) invalid();
        }
        const result = await this.repository.change(Number(academyId), Number(rawId), expectedHash, changes, remove);
        if (result === 'not_found') throw new ConsultationBridgeError(404, 'consultation_not_found');
        if (result === 'changed') throw new ConsultationBridgeError(409, 'before_snapshot_changed');
        if (result !== 'applied') throw new Error('consultation_change_failed');
    }
}
function invalid() { throw new ConsultationBridgeError(400, 'invalid_consultation_change'); }
function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
module.exports = { ConsultationBridgeService, ConsultationBridgeError };
