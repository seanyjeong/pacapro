const { verifyToken } = require('../../middleware/auth');
const { getInstructorCalendar } = require('../../services/instructorCalendarService');
const logger = require('../../utils/logger');

module.exports = function registerInstructorCalendar(router) {
    // 같은 학원의 로그인 사용자는 근무 예정 정보만 조회할 수 있다.
    router.get('/instructor-schedules/calendar', verifyToken, async (req, res) => {
        try {
            const result = await getInstructorCalendar(req.user.academyId, req.query);
            return res.status(result.status).json(result.data || { message: result.message });
        } catch (error) {
            logger.error('Error fetching instructor calendar:', error);
            return res.status(500).json({ message: '강사 근무 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
        }
    });
};
