const EventEmitter = require('events');

jest.mock('../../config/database', () => ({
    query: jest.fn()
}));
jest.mock('axios', () => ({
    post: jest.fn()
}));

const {
    buildAttendanceEvent,
    buildInstructorAttendanceEvent,
    createAttendancePostEmitter,
    isInstructorAttendancePostRequest,
    isAttendancePostRequest,
    postPeakBridgeEvent
} = require('../../realtime/attendancePostEmitter');
const { normalizeAttendanceEvent, normalizeInstructorAttendanceEvent } = require('../../realtime/attendanceHub');
const axios = require('axios');

describe('attendance realtime event helpers', () => {
    test('detects only PACA attendance POST requests', () => {
        expect(isAttendancePostRequest({ method: 'POST', path: '/paca/schedules/3/attendance' })).toBe(true);
        expect(isAttendancePostRequest({ method: 'GET', path: '/paca/schedules/3/attendance' })).toBe(false);
        expect(isAttendancePostRequest({ method: 'POST', path: '/paca/students' })).toBe(false);
    });

    test('detects only PACA instructor attendance POST requests', () => {
        expect(isInstructorAttendancePostRequest({ method: 'POST', path: '/paca/schedules/date/2026-07-05/instructor-attendance' })).toBe(true);
        expect(isInstructorAttendancePostRequest({ method: 'POST', path: '/paca/schedules/3/instructor-attendance' })).toBe(true);
        expect(isInstructorAttendancePostRequest({ method: 'GET', path: '/paca/schedules/date/2026-07-05/instructor-attendance' })).toBe(false);
        expect(isInstructorAttendancePostRequest({ method: 'POST', path: '/paca/schedules/3/attendance' })).toBe(false);
    });

    test('builds academy-scoped attendance events from route response bodies', () => {
        const event = buildAttendanceEvent({
            academyId: 2,
            responseBody: {
                schedule_id: 3,
                class_date: '2026-07-03',
                attendance_records: [
                    { student_id: 10, attendance_status: 'present', notes: 'ok' },
                    { student_id: 11, attendance_status: null, cleared: true }
                ]
            }
        });

        expect(event).toEqual({
            source: 'paca',
            academy_id: 2,
            schedule_id: 3,
            class_date: '2026-07-03',
            records: [
                { student_id: 10, attendance_status: 'present', makeup_date: null, notes: 'ok' },
                { student_id: 11, attendance_status: null, makeup_date: null, notes: '' }
            ]
        });
    });

    test('normalizes unknown and none statuses to unchecked', () => {
        const event = normalizeAttendanceEvent({
            academy_id: 2,
            schedule_id: 3,
            records: [
                { student_id: 10, attendance_status: 'none' },
                { student_id: 11, attendance_status: 'strange' }
            ]
        });

        expect(event.records).toEqual([
            { student_id: 10, attendance_status: null, makeup_date: null, notes: '' },
            { student_id: 11, attendance_status: null, makeup_date: null, notes: '' }
        ]);
    });

    test('builds academy-scoped instructor attendance events from route response bodies', () => {
        const event = buildInstructorAttendanceEvent({
            academyId: 2,
            responseBody: {
                date: '2026-07-05',
                attendance_records: [
                    { instructor_id: 7, time_slot: 'evening', attendance_status: 'present', check_in_time: '18:05', check_out_time: null },
                    { instructor_id: 8, time_slot: 'evening', attendance_status: null, cleared: true }
                ]
            }
        });

        expect(event).toEqual({
            source: 'paca',
            academy_id: 2,
            class_date: '2026-07-05',
            records: [
                { instructor_id: 7, time_slot: 'evening', attendance_status: 'present', check_in_time: '18:05', check_out_time: null },
                { instructor_id: 8, time_slot: 'evening', attendance_status: null, check_in_time: null, check_out_time: null }
            ]
        });
    });

    test('normalizes instructor attendance realtime payloads', () => {
        const event = normalizeInstructorAttendanceEvent({
            academy_id: 2,
            class_date: '2026-07-05',
            records: [
                { instructor_id: 7, time_slot: 'evening', attendance_status: 'present', check_in_time: '18:05' },
                { instructor_id: 8, time_slot: 'morning', attendance_status: 'none' },
                { instructor_id: 9, time_slot: 'strange', attendance_status: 'present' }
            ]
        });

        expect(event).toEqual({
            type: 'instructor-attendance-updated',
            academy_id: 2,
            class_date: '2026-07-05',
            source: 'paca',
            records: [
                { instructor_id: 7, time_slot: 'evening', attendance_status: 'present', check_in_time: '18:05', check_out_time: null },
                { instructor_id: 8, time_slot: 'morning', attendance_status: null, check_in_time: null, check_out_time: null }
            ]
        });
    });

    test('middleware emits only after successful attendance responses', (done) => {
        const broadcast = jest.fn(() => 1);
        const logger = { info: jest.fn() };
        const middleware = createAttendancePostEmitter({ broadcast, logger });
        const req = {
            method: 'POST',
            path: '/paca/schedules/3/attendance',
            user: { academyId: 2 }
        };
        const res = new EventEmitter();
        res.statusCode = 200;
        res.json = jest.fn((body) => body);

        middleware(req, res, () => {
            res.json({
                schedule_id: 3,
                attendance_records: [{ student_id: 10, attendance_status: 'present' }]
            });
            res.emit('finish');

            expect(broadcast).toHaveBeenCalledWith({
                source: 'paca',
                academy_id: 2,
                schedule_id: 3,
                class_date: null,
                records: [{ student_id: 10, attendance_status: 'present', makeup_date: null, notes: '' }]
            });
            done();
        });
    });

    test('middleware emits instructor attendance events after successful responses', (done) => {
        const broadcast = jest.fn(() => 1);
        const logger = { info: jest.fn(), warn: jest.fn() };
        const middleware = createAttendancePostEmitter({ broadcastInstructor: broadcast, logger });
        const req = {
            method: 'POST',
            path: '/paca/schedules/date/2026-07-05/instructor-attendance',
            user: { academyId: 2 }
        };
        const res = new EventEmitter();
        res.statusCode = 200;
        res.json = jest.fn((body) => body);

        middleware(req, res, () => {
            res.json({
                date: '2026-07-05',
                attendance_records: [{ instructor_id: 7, time_slot: 'evening', attendance_status: 'present' }]
            });
            res.emit('finish');

            expect(broadcast).toHaveBeenCalledWith({
                source: 'paca',
                academy_id: 2,
                class_date: '2026-07-05',
                records: [{ instructor_id: 7, time_slot: 'evening', attendance_status: 'present', check_in_time: null, check_out_time: null }]
            });
            done();
        });
    });

    test('peak bridge is disabled until url and key are configured', async () => {
        await expect(postPeakBridgeEvent({ schedule_id: 3 }, { url: '', key: 'k' }))
            .resolves.toEqual({ sent: false });
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('peak bridge sends the internal key header when configured', async () => {
        axios.post.mockResolvedValueOnce({ data: { success: true } });

        await expect(postPeakBridgeEvent(
            { schedule_id: 3 },
            { url: 'https://supermax.kr/peak/attendance/internal/paca-event', key: 'secret' }
        )).resolves.toEqual({ sent: true });

        expect(axios.post).toHaveBeenCalledWith(
            'https://supermax.kr/peak/attendance/internal/paca-event',
            { schedule_id: 3 },
            {
                timeout: 2500,
                headers: { 'x-internal-key': 'secret' }
            }
        );
    });
});
