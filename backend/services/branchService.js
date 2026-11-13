/**
 * 지점(branches) → 반(classes) 관리와 학생 배정.
 * 지점이 하나도 없는 학원은 이 기능을 쓰지 않는 학원이다.
 */
const repo = require('../repositories/branchRepository');
const { decrypt } = require('../utils/encryption');

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
const withDays = item => ({ ...item, class_days: parseDays(item.class_days) });
const toId = value => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);

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
        status: body.status || current.status
    };
    if (!fields.class_name) return fail(400, '반 이름을 입력해주세요.');
    if (fields.class_name.length > NAME_MAX) return fail(400, `반 이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`);
    if (!TIME_SLOTS.includes(fields.default_time_slot)) return fail(400, '기본 시간대 값이 올바르지 않습니다.');
    if (!fields.class_days) return fail(400, '수업 요일 값이 올바르지 않습니다.');
    if (!STATUSES.includes(fields.status)) return fail(400, '상태 값이 올바르지 않습니다.');
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

// 반을 주면 지점은 그 반의 지점으로 정한다. 둘 다 비우면 배정 해제.
async function assignStudents(academyId, body) {
    const studentIds = Array.isArray(body.student_ids) ? [...new Set(body.student_ids.map(toId))] : [];
    if (studentIds.length === 0 || studentIds.includes(null)) return fail(400, '옮길 학생을 선택해주세요.');
    let branchId = body.branch_id == null ? null : toId(body.branch_id);
    const classId = body.class_id == null ? null : toId(body.class_id);
    if (classId) {
        const target = await repo.findClass(classId, academyId);
        if (!target) return fail(404, '반을 찾을 수 없습니다.');
        branchId = target.branch_id;
    } else if (branchId && !await repo.findBranch(branchId, academyId)) {
        return fail(404, '지점을 찾을 수 없습니다.');
    }
    const updated = await repo.assignStudents(academyId, studentIds, branchId, classId);
    return { status: 200, message: `학생 ${studentIds.length}명의 지점·반을 바꿨습니다.`, updated };
}

module.exports = { getTree, createBranch, updateBranch, deleteBranch, createClass, updateClass, deleteClass, assignStudents };
