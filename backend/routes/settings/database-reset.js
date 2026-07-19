const { verifyToken, requireRole } = require('../../middleware/auth');
const {
    DATABASE_RESET_SUCCESS_MESSAGE,
    DATABASE_RESET_CONFIRMATION_MESSAGE,
    DATABASE_RESET_FAILURE_MESSAGE,
} = require('../../constants/database-reset');
const {
    DatabaseResetValidationError,
    resetAcademyData,
} = require('../../services/databaseResetService');
const logger = require('../../utils/logger');

module.exports = function registerDatabaseResetRoute(router) {
    router.post('/reset-database', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const result = await resetAcademyData({
                academyId: req.user.academyId,
                confirmation: req.body.confirmation,
            });

            logger.info('Academy data reset completed', {
                academyId: req.user.academyId,
                userId: req.user.id,
                deletedRows: result.deletedRows,
            });
            return res.json({ message: DATABASE_RESET_SUCCESS_MESSAGE, ...result });
        } catch (error) {
            if (error instanceof DatabaseResetValidationError) {
                return res.status(400).json({ message: DATABASE_RESET_CONFIRMATION_MESSAGE });
            }

            logger.error('Academy data reset failed', {
                academyId: req.user?.academyId,
                userId: req.user?.id,
                error: error.message,
            });
            return res.status(500).json({ message: DATABASE_RESET_FAILURE_MESSAGE });
        }
    });
};
