const {
    reassignClassSchedules,
    reassignTrialSchedules,
    cleanupStatusSchedules,
} = require('./scheduleEffects');
const {
    updatePendingPayments,
    recalculateEnrollmentPayment,
    createActivationPayment,
    adjustPausedPayment,
    cleanupWithdrawal,
} = require('./paymentEffects');

async function applyStudentUpdateEffects(context) {
    const currentTimeSlot = context.timeSlot || context.oldTimeSlot;
    const sharedContext = { ...context, currentTimeSlot };

    const reassignResult = await reassignClassSchedules(sharedContext);
    await updatePendingPayments(sharedContext);
    const enrollmentDateRecalc = await recalculateEnrollmentPayment(sharedContext);
    const trialAssignResult = await reassignTrialSchedules(sharedContext);
    await createActivationPayment(sharedContext);
    const paymentAdjustment = await adjustPausedPayment(sharedContext);
    const withdrawalInfo = await cleanupWithdrawal(sharedContext);
    const scheduleCleanup = await cleanupStatusSchedules(sharedContext);

    return {
        reassignResult,
        trialAssignResult,
        paymentAdjustment,
        enrollmentDateRecalc,
        withdrawalInfo,
        ...scheduleCleanup,
    };
}

module.exports = { applyStudentUpdateEffects };
