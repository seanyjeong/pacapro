const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const INVALID_START_DATE_MESSAGE = '유효한 청구 시작일이 필요합니다.';

function getKoreaDateText(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function resolveProratedPaymentDueDate(startDate) {
    if (typeof startDate !== 'string') {
        throw new TypeError(INVALID_START_DATE_MESSAGE);
    }

    const dateText = startDate.slice(0, 10);
    const match = ISO_DATE_PATTERN.exec(dateText);
    if (!match) {
        throw new TypeError(INVALID_START_DATE_MESSAGE);
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
        parsedDate.getUTCFullYear() !== year
        || parsedDate.getUTCMonth() !== month - 1
        || parsedDate.getUTCDate() !== day
    ) {
        throw new TypeError(INVALID_START_DATE_MESSAGE);
    }

    return dateText;
}

module.exports = { getKoreaDateText, resolveProratedPaymentDueDate };
