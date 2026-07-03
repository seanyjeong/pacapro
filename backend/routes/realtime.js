const express = require('express');
const { broadcastAttendanceUpdate } = require('../realtime/attendanceHub');

const router = express.Router();

function requireBridgeKey(req, res, next) {
    const expected = process.env.ATTENDANCE_REALTIME_BRIDGE_KEY;
    if (!expected) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: '실시간 브리지 키가 설정되지 않았습니다.'
        });
    }

    if (req.headers['x-internal-key'] !== expected) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: '인증되지 않은 내부 요청입니다.'
        });
    }

    next();
}

router.post('/attendance-event', requireBridgeKey, (req, res) => {
    const clients = broadcastAttendanceUpdate({
        ...req.body,
        source: req.body.source || 'bridge'
    });

    res.json({
        success: true,
        clients
    });
});

module.exports = router;
