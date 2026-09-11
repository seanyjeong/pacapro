const { verifyToken } = require('../../middleware/auth');
const { getAttendanceState } = require('../../services/attendanceStateService');
const logger = require('../../utils/logger');

module.exports = function registerAttendanceState(router) {
    router.get('/:id/attendance-state', verifyToken, async (req, res) => {
        const scheduleId = Number(req.params.id);
        if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0) {
            return res.status(400).json({ error: 'Validation Error', message: '수업 번호를 확인해주세요.' });
        }
        try {
            const result = await getAttendanceState(req.user.academyId, scheduleId);
            if (!result) return res.status(404).json({ error: 'Not Found', message: '수업을 찾을 수 없습니다.' });
            return res.json(result);
        } catch (error) {
            logger.error('Error reading attendance state:', error);
            return res.status(500).json({ error: 'Server Error', message: '출석 정보를 불러오지 못했습니다.' });
        }
    });
};
