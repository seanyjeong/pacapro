const repository = require('../repositories/trialStatusRepository');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TIME_SLOTS = new Set(['morning', 'afternoon', 'evening']);
const ATTENDED_STATUSES = new Set(['present', 'late']);

class TrialStatusValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TrialStatusValidationError';
    }
}

function getKoreaDateText(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateText(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseTrialDates(value, { strict = false } = {}) {
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            parsed = null;
        }
    }
    if (!Array.isArray(parsed)) {
        if (strict) {
            throw new TrialStatusValidationError('체험 일정을 다시 확인해주세요.');
        }
        return [];
    }

    const normalized = [];
    for (const item of parsed) {
        const timeSlot = item?.time_slot || item?.timeSlot;
        const valid = item
            && isValidDateText(item.date)
            && (strict ? VALID_TIME_SLOTS.has(timeSlot) : (!timeSlot || VALID_TIME_SLOTS.has(timeSlot)));
        if (!valid) {
            if (strict) {
                throw new TrialStatusValidationError('체험 날짜와 시간대를 다시 확인해주세요.');
            }
            continue;
        }
        normalized.push({
            date: item.date,
            time_slot: timeSlot || null,
            attended: item.attended === true,
        });
    }
    return normalized;
}

function resolveTrialState(value, { today = getKoreaDateText() } = {}) {
    const trialDates = parseTrialDates(value);
    const sortedDates = trialDates.map((item) => item.date).sort();
    const availableDates = trialDates.filter(
        (item) => !item.attended && item.date >= today
    );
    const isTrial = availableDates.length > 0;

    return {
        isTrial,
        lastTrialDate: sortedDates.at(-1) || null,
        status: isTrial ? 'trial' : 'pending',
        trialDates,
        trialRemaining: availableDates.length,
    };
}

function prepareTrialActivation(value, { today = getKoreaDateText() } = {}) {
    if (value == null || (Array.isArray(value) && value.length === 0)) {
        throw new TrialStatusValidationError(
            '오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.'
        );
    }
    const trialDates = parseTrialDates(value, { strict: true });
    const state = resolveTrialState(trialDates, { today });
    if (!state.isTrial) {
        throw new TrialStatusValidationError(
            '오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.'
        );
    }
    return {
        ...state,
        scheduleDates: state.trialDates.filter(
            (item) => !item.attended && item.date >= today
        ),
    };
}

function prepareStudentTrialUpdate({
    currentStudent,
    isTrial,
    status,
    trialDates,
    trialRemaining,
    today = getKoreaDateText(),
}) {
    const hasIsTrialRequest = isTrial !== undefined;
    const requestedIsTrial = isTrial === true || isTrial === 1;
    const currentIsTrial = Boolean(currentStudent.is_trial) && currentStudent.status === 'trial';
    const currentTrialLifecycle = Boolean(currentStudent.is_trial) || currentStudent.status === 'trial';
    const requestedTrialStatus = status === 'trial';
    const requestedNonTrialStatus = status !== undefined && status !== 'trial';

    if (
        (requestedTrialStatus && hasIsTrialRequest && !requestedIsTrial)
        || (requestedNonTrialStatus && requestedIsTrial)
    ) {
        throw new TrialStatusValidationError('체험생 상태를 다시 확인해주세요.');
    }

    const leavingTrial = currentTrialLifecycle
        && ((hasIsTrialRequest && !requestedIsTrial) || requestedNonTrialStatus);
    if (leavingTrial) {
        return {
            isTrial: false,
            status: requestedNonTrialStatus ? status : 'pending',
            trialDates,
            trialRemaining: 0,
        };
    }

    const requestingTrial = requestedIsTrial || requestedTrialStatus;
    const activating = requestingTrial && !currentIsTrial;
    const validatingDates = trialDates !== undefined
        && (requestingTrial || currentTrialLifecycle);
    const recalculatingRemaining = currentTrialLifecycle && trialRemaining !== undefined;
    if (!activating && !requestingTrial && !validatingDates && !recalculatingRemaining) {
        return { isTrial, status, trialDates, trialRemaining };
    }

    const datesToValidate = activating
        ? trialDates
        : (trialDates ?? currentStudent.trial_dates);
    const state = prepareTrialActivation(datesToValidate, { today });
    return {
        isTrial: true,
        status: 'trial',
        trialDates: state.trialDates,
        trialRemaining: state.trialRemaining,
        trialScheduleDates: state.scheduleDates,
    };
}

function getScheduleDateText(value) {
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    return '';
}

function matchesSchedule(trialDate, schedule) {
    if (trialDate.date !== getScheduleDateText(schedule.class_date)) return false;
    return !trialDate.time_slot || trialDate.time_slot === schedule.time_slot;
}

async function applyTrialAttendanceChange({
    attendanceStatus,
    connection,
    context,
    schedule,
    today = getKoreaDateText(),
}) {
    const { previousAttendanceStatus, student } = context;
    const trialDates = parseTrialDates(student.trial_dates);
    const isTrialLifecycle = Boolean(student.is_trial)
        || student.status === 'trial'
        || (student.status === 'pending' && trialDates.length > 0);
    if (!isTrialLifecycle) {
        return {
            isTrial: Boolean(student.is_trial),
            status: student.status,
            trialRemaining: student.trial_remaining,
        };
    }

    const wasAttended = ATTENDED_STATUSES.has(previousAttendanceStatus);
    const isAttended = ATTENDED_STATUSES.has(attendanceStatus);
    const updatedDates = trialDates.map((item) => (
        matchesSchedule(item, schedule)
            ? { ...item, attended: isAttended }
            : item
    ));
    const state = resolveTrialState(updatedDates, { today });
    const stateChanged = student.status !== state.status
        || Boolean(student.is_trial) !== state.isTrial
        || Number(student.trial_remaining || 0) !== state.trialRemaining;
    const attendanceChanged = wasAttended !== isAttended
        && trialDates.some((item) => matchesSchedule(item, schedule));

    if (stateChanged || attendanceChanged) {
        await repository.updateTrialState(connection, {
            academyId: student.academy_id,
            isTrial: state.isTrial,
            status: state.status,
            studentId: student.id,
            trialDates: updatedDates,
            trialRemaining: state.trialRemaining,
        });
    }
    return state;
}

async function getAttendanceContext({
    academyId,
    connection,
    scheduleId,
    studentId,
}) {
    return repository.findAttendanceContextForUpdate(connection, {
        academyId,
        scheduleId,
        studentId,
    });
}

async function expireTrialStudents({
    connection,
    today = getKoreaDateText(),
}) {
    const students = await repository.findTrialStudents(connection);
    const expiredStudents = [];

    for (const student of students) {
        const state = resolveTrialState(student.trial_dates, { today });
        if (state.isTrial) continue;
        await repository.updateTrialState(connection, {
            academyId: student.academy_id,
            isTrial: false,
            note: `[${today}] 체험 만료 → 미등록관리 자동전환`,
            status: 'pending',
            studentId: student.id,
            trialDates: state.trialDates,
            trialRemaining: 0,
        });
        expiredStudents.push(student.id);
    }

    return {
        checked: students.length,
        expired: expiredStudents.length,
        expiredStudents,
    };
}

module.exports = {
    TrialStatusValidationError,
    applyTrialAttendanceChange,
    expireTrialStudents,
    getAttendanceContext,
    getKoreaDateText,
    parseTrialDates,
    prepareTrialActivation,
    prepareStudentTrialUpdate,
    resolveTrialState,
};
