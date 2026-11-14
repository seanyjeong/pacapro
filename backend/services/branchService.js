/**
 * 지점(branches) → 반(classes) 관리와 학생 배정.
 * 지점이 하나도 없는 학원은 이 기능을 쓰지 않는 학원이다.
 */
const repo = require('../repositories/branchRepository');
const { decrypt } = require('../utils/encryption');
const { parseClassTuition, resolveTuitionTable, weeklyTuitionAmount } = require('../utils/tuitionSettings');
const { truncateToThousands } = require('../utils/seasonCalculator');
const { pendingMonthlyFinal, updatePendingMonthlyTuition } = require('../repositories/pendingMonthlyTuitionRepository');

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const STATUSES = ['active', 'inactive'];
// branches.name·classes.class_name 이 VARCHAR(100) 이다. 넘으면 DB 가 말없이 자른다.
const NAME_MAX = 100;
const fail = (status, message) => ({ status, message });
const text = value => (typeof value === 'string' ? value.trim() : '');
// 반의 수업 요일: 0(일)~6(토). DB 에는 JSON 배열, 비어 있으면 NULL.
const parseDays = value => {
    const days = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(days) ? days : [];
};
const toDays = value => (Array.isArray(value) && value.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    ? [...new Set(value)].sort((a, b) => a - b) : null);
// 반 응답: 수업 요일 배열, 반 학원비 표(없으면 null = 학원 기본표).
const withDays = item => ({ ...item, class_days: parseDays(item.class_days), tuition_by_weekly: parseClassTuition(item.tuition_by_weekly) });
const toId = value => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
const toIds = value => (Array.isArray(value) ? [...new Set(value.map(toId))] : []);
// 반 학원비 표 {weekly_1..weekly_7}: 0 이상 정수(students.monthly_tuition DECIMAL(10,2) 안). 모두 0이면 받지 않는다.
const TUITION_MAX = 99999999;
const toTuition = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const table = {};
    for (let count = 1; count <= 7; count++) {
        const amount = value[`weekly_${count}`] ?? 0;
        if (!Number.isInteger(amount) || amount < 0 || amount > TUITION_MAX) return undefined;
        table[`weekly_${count}`] = amount;
    }
    return Object.values(table).some(amount => amount > 0) ? table : undefined;
};
// 할인 후 월 학원비: 월 자동 청구와 같은 순서(할인액 천원 절삭 → 빼고 천원 절삭).
const discountedTuition = (base, rate) => truncateToThousands(base - truncateToThousands(base * rate / 100));

async function getTree(academyId) {
    const { branches, classes, counts } = await repo.findTree(academyId);
    const count = match => counts.filter(match).reduce((sum, row) => ({
        student_count: sum.student_count + Number(row.student_count), active_count: sum.active_count + Number(row.active_count)
    }), { student_count: 0, active_count: 0 });
    return {
        branches: branches.map(branch => ({
            ...branch, ...count(row => row.branch_id === branch.id),
            classes: classes.filter(item => item.branch_id === branch.id)
                .map(item => ({
                    ...withDays(item),
                    instructor_name: item.instructor_name ? decrypt(item.instructor_name) : null,
                    ...count(row => row.class_id === item.id)
                }))
        })),
        unassigned: count(row => row.branch_id === null)
    };
}

async function createBranch(academyId, body) {
    const name = text(body.name);
    if (!name) return fail(400, '지점 이름을 입력해주세요.');
    if (name.length > NAME_MAX) return fail(400, `지점 이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`);
    if (await repo.findBranchByName(academyId, name)) return fail(409, '같은 이름의 지점이 이미 있습니다.');
    const id = await repo.insertBranch(academyId, name);
    return { status: 201, message: '지점을 만들었습니다.', branch: await repo.findBranch(id, academyId) };
}

async function updateBranch(id, academyId, body) {
    const branch = await repo.findBranch(id, academyId);
    if (!branch) return fail(404, '지점을 찾을 수 없습니다.');
    const name = body.name === undefined ? branch.name : text(body.name);
    if (!name) return fail(400, '지점 이름을 입력해주세요.');
    if (name.length > NAME_MAX) return fail(400, `지점 이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`);
    if (body.status !== undefined && !STATUSES.includes(body.status)) return fail(400, '상태 값이 올바르지 않습니다.');
    const duplicate = name === branch.name ? null : await repo.findBranchByName(academyId, name);
    if (duplicate) return fail(409, '같은 이름의 지점이 이미 있습니다.');
    await repo.updateBranch(id, academyId, { name, sort_order: Number.isInteger(body.sort_order) ? body.sort_order : branch.sort_order,
        status: body.status || branch.status });
    return { status: 200, message: '지점을 수정했습니다.', branch: await repo.findBranch(id, academyId) };
}

async function deleteBranch(id, academyId) {
    if (!await repo.findBranch(id, academyId)) return fail(404, '지점을 찾을 수 없습니다.');
    const usage = await repo.branchUsage(id, academyId);
    if (usage.classes > 0 || usage.students > 0) return fail(409, '반이나 학생이 있는 지점은 지울 수 없습니다. 먼저 옮기거나 사용 안 함으로 바꿔주세요.');
    // 지난 청구서가 이 지점에 고정돼 있다. 지우면 그 매출·미납을 어느 지점으로도 볼 수 없게 된다.
    if (usage.payments > 0) return fail(409, '학원비 청구서가 있는 지점은 지울 수 없습니다. 지난 매출·미납을 이 지점으로 볼 수 있게 남겨 둡니다.');
    // 지점 시즌이 남으면 그 시즌의 등록 후보·표시가 사라진 지점을 가리킨다.
    if (usage.seasons > 0) return fail(409, '이 지점 시즌이 있어 지울 수 없습니다. 시즌의 지점을 바꾸거나 전 지점으로 돌린 뒤 지워주세요.');
    await repo.deleteBranch(id, academyId);
    return { status: 200, message: '지점을 지웠습니다.' };
}

async function createClass(branchId, academyId, body) {
    if (!await repo.findBranch(branchId, academyId)) return fail(404, '지점을 찾을 수 없습니다.');
    const className = text(body.class_name);
    if (!className) return fail(400, '반 이름을 입력해주세요.');
    if (className.length > NAME_MAX) return fail(400, `반 이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`);
    const timeSlot = body.default_time_slot || 'afternoon';
    if (!TIME_SLOTS.includes(timeSlot)) return fail(400, '기본 시간대 값이 올바르지 않습니다.');
    if (await repo.findClassByName(academyId, branchId, className)) return fail(409, '이 지점에 같은 이름의 반이 이미 있습니다.');
    const id = await repo.insertClass(academyId, branchId, { class_name: className, default_time_slot: timeSlot });
    return { status: 201, message: '반을 만들었습니다.', class: withDays(await repo.findClass(id, academyId)) };
}

async function updateClass(id, academyId, body) {
    const current = await repo.findClass(id, academyId);
    if (!current) return fail(404, '반을 찾을 수 없습니다.');
    const fields = {
        branch_id: body.branch_id === undefined ? current.branch_id : toId(body.branch_id),
        class_name: body.class_name === undefined ? current.class_name : text(body.class_name),
        default_time_slot: body.default_time_slot || current.default_time_slot,
        class_days: body.class_days === undefined ? parseDays(current.class_days) : toDays(body.class_days),
        // 담당 강사(표시용). null 이면 안 정함.
        instructor_id: body.instructor_id === undefined ? current.instructor_id : toId(body.instructor_id),
        sort_order: Number.isInteger(body.sort_order) ? body.sort_order : current.sort_order,
        status: body.status || current.status,
        // 반 학원비 표. null = 학원 기본표 그대로. 바꿔도 학생 학원비는 "반 학원비 적용"을 눌러야 바뀐다.
        tuition_by_weekly: body.tuition_by_weekly === undefined ? parseClassTuition(current.tuition_by_weekly)
            : body.tuition_by_weekly === null ? null : toTuition(body.tuition_by_weekly)
    };
    // 표가 바뀌면 바로 전 표를 남긴다(적용 미리보기가 예전 표대로 낸 학생과 개별 금액 학생을 가른다).
    const currentTable = parseClassTuition(current.tuition_by_weekly);
    fields.tuition_by_weekly_before = JSON.stringify(fields.tuition_by_weekly ?? null) === JSON.stringify(currentTable)
        ? parseClassTuition(current.tuition_by_weekly_before) : currentTable;
    if (!fields.class_name) return fail(400, '반 이름을 입력해주세요.');
    if (fields.class_name.length > NAME_MAX) return fail(400, `반 이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`);
    if (!TIME_SLOTS.includes(fields.default_time_slot)) return fail(400, '기본 시간대 값이 올바르지 않습니다.');
    if (!fields.class_days) return fail(400, '수업 요일 값이 올바르지 않습니다.');
    if (!STATUSES.includes(fields.status)) return fail(400, '상태 값이 올바르지 않습니다.');
    if (fields.tuition_by_weekly === undefined) return fail(400, '반 학원비는 주1~7회 중 하나 이상을 0원 넘게, 원 단위 숫자로 입력해주세요.');
    if (body.instructor_id != null && !(fields.instructor_id && await repo.instructorExists(fields.instructor_id, academyId))) {
        return fail(404, '강사를 찾을 수 없습니다.');
    }
    if (!fields.branch_id || !await repo.findBranch(fields.branch_id, academyId)) return fail(404, '지점을 찾을 수 없습니다.');
    const duplicate = await repo.findClassByName(academyId, fields.branch_id, fields.class_name);
    if (duplicate && duplicate.id !== current.id) return fail(409, '이 지점에 같은 이름의 반이 이미 있습니다.');
    await repo.withTransaction(connection => repo.updateClass(connection, id, academyId, fields));
    return { status: 200, message: '반을 수정했습니다.', class: withDays(await repo.findClass(id, academyId)) };
}

async function deleteClass(id, academyId) {
    if (!await repo.findClass(id, academyId)) return fail(404, '반을 찾을 수 없습니다.');
    if (await repo.classStudentCount(id, academyId) > 0) return fail(409, '학생이 있는 반은 지울 수 없습니다. 먼저 다른 반으로 옮겨주세요.');
    await repo.deleteClass(id, academyId);
    return { status: 200, message: '반을 지웠습니다.' };
}

// 그 표(반 표, 없으면 학원 표)에서 이 학생의 주N회 금액. 없으면 null.
function tableAmount(student, settings, classTuition) {
    const found = weeklyTuitionAmount(resolveTuitionTable(settings, student.student_type || 'exam', classTuition), Number(student.weekly_count) || 0);
    return found === null ? null : Number(found);
}

/**
 * 학원비 다시 계산: classTuition 표(없으면 학원 표)로 학생의 주 수업 횟수 금액을 찾는다. 표에 금액이 없으면 바꾸지 않는다.
 * - previousTables: 예전 표들. 지금 금액이 이 표들(과 학원 표)의 금액과 다르면 개별로 정한 금액(individual) — 화면이 처음엔 고르지 않는다.
 * - pending_bills: 같이 바뀌는 이번 달부터의 미납 월 청구(학생 수정과 같은 식). 휴원 학생은 복귀 때 맞추므로 없다.
 * 할인율은 그대로 둔다.
 */
function planTuition(student, settings, classTuition, previousTables, bills) {
    const current = Number(student.monthly_tuition) || 0;
    const next = tableAmount(student, settings, classTuition);
    const discountRate = Number(student.discount_rate) || 0;
    const changed = next !== null && next !== current;
    const references = [null, ...previousTables].map(table => tableAmount(student, settings, table));
    const pendingBills = changed && student.status !== 'paused'
        ? bills.filter(bill => bill.student_id === student.id).map(bill => ({
            id: bill.id, year_month: bill.year_month, current_amount: Number(bill.final_amount),
            new_amount: Math.max(pendingMonthlyFinal(next, discountRate)
                + Number(bill.additional_amount || 0) - Number(bill.carryover_amount || 0), 0)
        }))
        : [];
    return {
        student_id: student.id, name: decrypt(student.name), status: student.status, weekly_count: Number(student.weekly_count) || 0,
        current_tuition: current, new_tuition: next, discount_rate: discountRate,
        new_final_tuition: next === null ? null : discountedTuition(next, discountRate),
        changed, individual: changed && !references.includes(current), pending_bills: pendingBills
    };
}

// 화면이 보여 준 지금 금액·새 금액과 다시 계산한 금액이 같아야 바꾼다. 그 사이 하나라도 바뀌었으면 아무것도 안 바꾼다.
function confirmedPlans(plans, changes) {
    const expected = new Map((Array.isArray(changes) ? changes : []).map(item => [toId(item?.student_id), item]));
    expected.delete(null);
    if (expected.size === 0) return { plans: [] };
    const chosen = plans.filter(plan => expected.has(plan.student_id));
    const stale = plan => {
        const item = expected.get(plan.student_id);
        return !plan.changed || plan.new_tuition !== Number(item.new_tuition) || plan.current_tuition !== Number(item.current_tuition);
    };
    if (chosen.length !== expected.size || chosen.some(stale)) {
        return { error: fail(409, '학원비가 그사이 바뀌었어요. 미리보기를 다시 확인해주세요.') };
    }
    return { plans: chosen };
}

// 학생 학원비와 이번 달부터의 미납 월 청구를 같은 트랜잭션에서 바꾼다(휴원 학생 청구는 그대로 — 학생 수정과 같음).
async function applyTuitionPlans(connection, academyId, plans) {
    for (const plan of plans) {
        await repo.updateStudentTuition(connection, academyId, plan.student_id, plan.new_tuition, plan.new_final_tuition);
        if (plan.status !== 'paused') {
            await updatePendingMonthlyTuition(connection, {
                studentId: plan.student_id, academyId, tuition: plan.new_tuition, discountRate: plan.discount_rate
            });
        }
    }
}

const idFilter = ids => `s.id IN (${ids.map(() => '?').join(',')})`;

// 학원비를 다시 계산할 학생과 그 학생들의 미납 월 청구
async function tuitionStudents(academyId, filter, params) {
    const students = await repo.findTuitionStudents(academyId, filter, params);
    const bills = await repo.pendingMonthlyBills(academyId, students.map(student => student.id));
    return { students, bills };
}

// 반 이동 전에 묻기: 새 반(또는 지금 반)에 따로 정한 학원비 표가 있을 때만, 새 금액이 지금과 다른 학생.
// 양쪽 다 학원 기본표면 묻지 않는다(지금과 같음). 예전 표 = 지금 반의 표.
async function previewMoveTuition(academyId, body) {
    const studentIds = toIds(body.student_ids);
    if (studentIds.length === 0 || studentIds.includes(null)) return fail(400, '옮길 학생을 선택해주세요.');
    const classId = body.class_id == null ? null : toId(body.class_id);
    const target = classId ? await repo.findClass(classId, academyId) : null;
    if (classId && !target) return fail(404, '반을 찾을 수 없습니다.');
    const newTable = target ? parseClassTuition(target.tuition_by_weekly) : null;
    const { students, bills } = await tuitionStudents(academyId, idFilter(studentIds), studentIds);
    const moving = students.filter(student => (student.class_id ?? null) !== classId && (newTable || parseClassTuition(student.class_tuition)));
    if (moving.length === 0) return { status: 200, changes: [] };
    const settings = await repo.academySettings(academyId);
    return {
        status: 200,
        changes: moving.map(student => planTuition(student, settings, newTable, [student.class_tuition], bills)).filter(plan => plan.changed)
    };
}

// 반을 주면 지점은 그 반의 지점으로 정한다. 둘 다 비우면 배정 해제.
// tuition_changes([{ student_id, current_tuition, new_tuition }])를 같이 주면 그 학생만 새 반 기준 학원비로 바꾼다(묻고 고른 경우).
async function assignStudents(academyId, body) {
    const studentIds = toIds(body.student_ids);
    if (studentIds.length === 0 || studentIds.includes(null)) return fail(400, '옮길 학생을 선택해주세요.');
    let branchId = body.branch_id == null ? null : toId(body.branch_id);
    const classId = body.class_id == null ? null : toId(body.class_id);
    let target = null;
    if (classId) {
        target = await repo.findClass(classId, academyId);
        if (!target) return fail(404, '반을 찾을 수 없습니다.');
        branchId = target.branch_id;
    } else if (branchId && !await repo.findBranch(branchId, academyId)) {
        return fail(404, '지점을 찾을 수 없습니다.');
    }
    const tuitionIds = toIds((Array.isArray(body.tuition_changes) ? body.tuition_changes : []).map(item => item?.student_id))
        .filter(id => studentIds.includes(id));
    if (tuitionIds.length === 0) {
        const updated = await repo.assignStudents(academyId, studentIds, branchId, classId);
        return { status: 200, message: `학생 ${studentIds.length}명의 지점·반을 바꿨습니다.`, updated };
    }
    const settings = await repo.academySettings(academyId);
    const newTable = target ? parseClassTuition(target.tuition_by_weekly) : null;
    const { students, bills } = await tuitionStudents(academyId, idFilter(tuitionIds), tuitionIds);
    const planned = students.map(student => planTuition(student, settings, newTable, [student.class_tuition], bills));
    const { plans, error } = confirmedPlans(planned, body.tuition_changes.filter(item => tuitionIds.includes(toId(item?.student_id))));
    if (error) return error;
    const updated = await repo.withTransaction(async connection => {
        const count = await repo.assignStudents(academyId, studentIds, branchId, classId, connection);
        await applyTuitionPlans(connection, academyId, plans);
        return count;
    });
    return {
        status: 200, message: `학생 ${studentIds.length}명의 지점·반을 바꾸고 ${plans.length}명의 학원비를 바꿨습니다.`,
        updated, tuition_updated: plans.length
    };
}

// 반 학원비 적용 미리보기: 그 반 학생별 지금 금액 → 새 금액(반 표, 없으면 학원 표). 예전 표 = 바로 전 반 표.
async function previewClassTuition(classId, academyId) {
    const cls = await repo.findClass(classId, academyId);
    if (!cls) return fail(404, '반을 찾을 수 없습니다.');
    const table = parseClassTuition(cls.tuition_by_weekly);
    const settings = await repo.academySettings(academyId);
    const { students, bills } = await tuitionStudents(academyId, 's.class_id = ?', [cls.id]);
    return {
        status: 200,
        class: { id: cls.id, class_name: cls.class_name, tuition_by_weekly: table },
        students: students.map(student => planTuition(student, settings, table, [cls.tuition_by_weekly_before], bills))
    };
}

// 반 학원비 적용: 미리보기에서 확인한 학생만, 확인한 금액 그대로 한꺼번에.
// 이번 달부터의 미납 월 청구도 같이 맞추고, 낸 청구·일할 청구는 그대로 둔다.
async function applyClassTuition(classId, academyId, body) {
    const cls = await repo.findClass(classId, academyId);
    if (!cls) return fail(404, '반을 찾을 수 없습니다.');
    const ids = toIds((Array.isArray(body.changes) ? body.changes : []).map(item => item?.student_id)).filter(Boolean);
    if (ids.length === 0) return fail(400, '학원비를 바꿀 학생을 선택해주세요.');
    const settings = await repo.academySettings(academyId);
    const table = parseClassTuition(cls.tuition_by_weekly);
    const { students, bills } = await tuitionStudents(academyId, `s.class_id = ? AND ${idFilter(ids)}`, [cls.id, ...ids]);
    const planned = students.map(student => planTuition(student, settings, table, [cls.tuition_by_weekly_before], bills));
    const { plans, error } = confirmedPlans(planned, body.changes);
    if (error) return error;
    await repo.withTransaction(connection => applyTuitionPlans(connection, academyId, plans));
    const billCount = plans.reduce((sum, plan) => sum + plan.pending_bills.length, 0);
    return {
        status: 200,
        message: `학생 ${plans.length}명의 학원비${billCount ? `와 미납 월 청구 ${billCount}건` : ''}을 바꿨습니다. 낸 청구·일할 청구는 그대로예요.`,
        updated: plans.length, students: plans
    };
}

module.exports = {
    getTree, createBranch, updateBranch, deleteBranch, createClass, updateClass, deleteClass, assignStudents,
    previewMoveTuition, previewClassTuition, applyClassTuition
};
