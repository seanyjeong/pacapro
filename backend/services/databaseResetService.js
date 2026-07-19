const { DATABASE_RESET_CONFIRMATION } = require('../constants/database-reset');
const databaseResetRepository = require('../repositories/databaseResetRepository');

class DatabaseResetValidationError extends Error {}

async function resetAcademyData({ academyId, confirmation }) {
    if (confirmation !== DATABASE_RESET_CONFIRMATION) {
        throw new DatabaseResetValidationError('confirmation');
    }

    if (!Number.isInteger(academyId) || academyId <= 0) {
        throw new DatabaseResetValidationError('academyId');
    }

    return databaseResetRepository.resetAcademyData(academyId);
}

module.exports = { DatabaseResetValidationError, resetAcademyData };
