const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const REALTIME_PATH = '/paca/realtime/attendance';
const HEARTBEAT_MS = 30000;
const VALID_STATUSES = new Set(['present', 'absent', 'late', 'excused', 'makeup']);
const rooms = new Map();

function sendJson(socket, payload) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

function roomKey(academyId) {
    return String(Number(academyId));
}

function addToRoom(socket, academyId) {
    const key = roomKey(academyId);
    if (!rooms.has(key)) rooms.set(key, new Set());
    rooms.get(key).add(socket);
    socket.academyId = Number(academyId);
}

function removeFromRoom(socket) {
    if (!socket.academyId) return;
    const key = roomKey(socket.academyId);
    const room = rooms.get(key);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0) rooms.delete(key);
}

async function authenticateToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.query(
        `SELECT id, email, name, role, academy_id, is_active, approval_status
         FROM users
         WHERE id = ? AND deleted_at IS NULL`,
        [decoded.userId]
    );
    const user = users[0];
    if (!user || !user.is_active || user.approval_status !== 'approved') {
        throw new Error('unauthorized');
    }
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        academyId: user.academy_id
    };
}

function normalizeStatus(status) {
    if (!status || status === 'none') return null;
    return VALID_STATUSES.has(status) ? status : null;
}

function normalizeAttendanceEvent(event) {
    const academyId = Number(event?.academy_id ?? event?.academyId);
    const scheduleId = Number(event?.schedule_id ?? event?.scheduleId);
    if (!academyId || !scheduleId) return null;

    const records = Array.isArray(event.records) ? event.records : [];
    return {
        type: 'attendance-updated',
        academy_id: academyId,
        schedule_id: scheduleId,
        class_date: event.class_date || null,
        source: event.source || 'paca',
        records: records
            .filter((record) => record?.student_id)
            .map((record) => ({
                student_id: Number(record.student_id),
                attendance_status: normalizeStatus(record.attendance_status),
                makeup_date: record.makeup_date || null,
                notes: record.notes || ''
            }))
    };
}

function broadcastAttendanceUpdate(event) {
    const payload = normalizeAttendanceEvent(event);
    if (!payload) return 0;

    const room = rooms.get(roomKey(payload.academy_id));
    if (!room) return 0;

    let sent = 0;
    room.forEach((socket) => {
        sendJson(socket, payload);
        sent += 1;
    });
    return sent;
}

function setupAttendanceRealtime(server, { logger = console } = {}) {
    const wss = new WebSocket.Server({ server, path: REALTIME_PATH });

    const heartbeat = setInterval(() => {
        wss.clients.forEach((socket) => {
            if (socket.isAlive === false) {
                removeFromRoom(socket);
                socket.terminate();
                return;
            }
            socket.isAlive = false;
            socket.ping();
        });
    }, HEARTBEAT_MS);

    wss.on('connection', (socket) => {
        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });

        socket.on('message', async (raw) => {
            try {
                const message = JSON.parse(raw.toString());
                if (message.type !== 'auth' || !message.token) {
                    sendJson(socket, { type: 'error', message: 'Authentication required' });
                    socket.close(1008, 'authentication required');
                    return;
                }

                const user = await authenticateToken(message.token);
                removeFromRoom(socket);
                addToRoom(socket, user.academyId);
                sendJson(socket, { type: 'ready', academy_id: user.academyId });
            } catch (error) {
                logger.warn('[AttendanceRealtime] auth failed', { error: error.message });
                sendJson(socket, { type: 'error', message: 'Authentication failed' });
                socket.close(1008, 'authentication failed');
            }
        });

        socket.on('close', () => {
            removeFromRoom(socket);
        });
    });

    server.on('close', () => {
        clearInterval(heartbeat);
        wss.close();
    });

    logger.info(`[AttendanceRealtime] WebSocket path ${REALTIME_PATH}`);
    return wss;
}

module.exports = {
    REALTIME_PATH,
    broadcastAttendanceUpdate,
    normalizeAttendanceEvent,
    setupAttendanceRealtime
};
