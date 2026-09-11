const { ConsultationBridgeService } = require('../../services/consultationBridgeService');
const { consultationSnapshot } = require('../../utils/consultationBridgeSnapshot');

const hash = `sha256:${'a'.repeat(64)}`;
describe('consultation bridge guarded writes', () => {
    test('memo and time changes call the scoped repository without unrelated fields', async () => {
        const repository = { change: jest.fn().mockResolvedValue('applied') };
        await new ConsultationBridgeService(repository).change(5, '9', hash, { preferredTime: '09:30', adminNotes: null }, false);
        expect(repository.change).toHaveBeenCalledWith(5, 9, hash, { preferredTime: '09:30', adminNotes: null }, false);
    });
    test.each([{ status: 'confirmed' }, { studentName: 'other' }, { academyId: 7 }, {},
        { preferredDate: '2026-02-30' }, { preferredTime: '25:00' }])('rejects unsupported or invalid change %p before persistence', async (changes) => {
        const repository = { change: jest.fn() };
        await expect(new ConsultationBridgeService(repository).change(5, 9, hash, changes, false)).rejects.toMatchObject({ status: 400 });
        expect(repository.change).not.toHaveBeenCalled();
    });
    test.each([['not_found', 404], ['changed', 409]])('does not claim success for %s', async (state, status) => {
        const service = new ConsultationBridgeService({ change: async () => state });
        await expect(service.change(5, 9, hash, {}, true)).rejects.toMatchObject({ status });
    });
    test('snapshot binds every source field while normalizing JSON and excluding derived display joins', () => {
        const row = { id: 9, academy_id: 5, academic_scores: { schoolGradeAvg: null }, checklist: [] };
        const expected = consultationSnapshot(row);
        expect(consultationSnapshot({ ...row, academic_scores: JSON.stringify(row.academic_scores),
            checklist: '[]', academicScores: row.academic_scores, linked_student_name: 'display-only' })).toBe(expected);
        expect(consultationSnapshot({ ...row, academy_id: 7 })).not.toBe(expected);
        expect(consultationSnapshot({ ...row, admin_notes: 'concurrent edit' })).not.toBe(expected);
    });
});
