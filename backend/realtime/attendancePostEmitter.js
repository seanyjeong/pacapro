const { broadcastAttendanceUpdate } = require('./attendanceHub');
const axios = require('axios');

const ATTENDANCE_POST_PATH = /^\/paca\/schedules\/\d+\/attendance\/?$/;

function isAttendancePostRequest(req) {
    return req.method === 'POST' && ATTENDANCE_POST_PATH.test(req.path || '');
}

function buildAttendanceEvent({ academyId, responseBody }) {
    if (!academyId || !responseBody?.schedule_id) return null;

    const records = Array.isArray(responseBody.attendance_records)
        ? responseBody.attendance_records
        : [];

    return {
        source: 'paca',
        academy_id: Number(academyId),
        schedule_id: Number(responseBody.schedule_id),
        class_date: responseBody.class_date || null,
        records: records.map((record) => ({
            student_id: Number(record.student_id),
            attendance_status: record.attendance_status || null,
            makeup_date: record.makeup_date || null,
            notes: record.notes || ''
        }))
    };
}

async function postPeakBridgeEvent(
    event,
    {
        url = process.env.PEAK_ATTENDANCE_EVENT_URL,
        key = process.env.ATTENDANCE_REALTIME_BRIDGE_KEY
    } = {}
) {
    if (!url || !key) return { sent: false };

    await axios.post(url, event, {
        timeout: 2500,
        headers: { 'x-internal-key': key }
    });
    return { sent: true };
}

function createAttendancePostEmitter({ broadcast = broadcastAttendanceUpdate, logger = console } = {}) {
    return (req, res, next) => {
        if (!isAttendancePostRequest(req)) return next();

        const originalJson = res.json.bind(res);
        let responseBody = null;

        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };

        res.on('finish', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return;
            const academyId = req.user?.academyId ?? req.user?.academy_id;
            const event = buildAttendanceEvent({ academyId, responseBody });
            if (!event) return;

            const sent = broadcast(event);
            postPeakBridgeEvent(event).catch((error) => {
                logger.warn('[AttendanceRealtime] peak bridge failed', { error: error.message });
            });
            logger.info('[AttendanceRealtime] attendance event emitted', {
                academyId: event.academy_id,
                scheduleId: event.schedule_id,
                records: event.records.length,
                clients: sent
            });
        });

        next();
    };
}

module.exports = {
    buildAttendanceEvent,
    createAttendancePostEmitter,
    isAttendancePostRequest,
    postPeakBridgeEvent
};
