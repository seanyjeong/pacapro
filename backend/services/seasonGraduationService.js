const { graduateDueStudents } = require('../repositories/seasonGraduationRepository');
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');
const { isDateText } = require('./seasonAftercarePolicy');

async function graduateDueSeasonStudents(dateText = getKoreaDateText()) {
    if (!isDateText(dateText)) throw new TypeError('유효한 졸업 처리 기준일이 필요합니다.');
    return graduateDueStudents(dateText);
}

module.exports = { graduateDueSeasonStudents };
