const ExcelJS = require('exceljs');
const {
    pool,
    verifyToken,
    checkPermission,
    encrypt,
    logger
} = require('./_utils');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const HEADER_ALIASES = {
    name: ['이름', '학생명'],
    phone: ['연락처', '전화번호', '휴대폰'],
    school: ['학교'],
    gender: ['성별'],
    grade: ['학년'],
    enrollmentDate: ['등록일', '입학일'],
    admissionType: ['입시유형', '전형'],
    status: ['상태', '등록상태'],
};

const STATUS_BY_SHEET_NAME = {
    재원생: 'active',
    휴원생: 'paused',
    퇴원생: 'withdrawn',
    체험생: 'trial',
    미등록: 'pending',
};

const STATUS_BY_LABEL = {
    재원: 'active',
    재원생: 'active',
    active: 'active',
    휴원: 'paused',
    휴원생: 'paused',
    paused: 'paused',
    퇴원: 'withdrawn',
    퇴원생: 'withdrawn',
    withdrawn: 'withdrawn',
    체험: 'trial',
    체험생: 'trial',
    trial: 'trial',
    미등록: 'pending',
    pending: 'pending',
};

const GENDER_BY_LABEL = {
    남: 'male',
    남자: 'male',
    male: 'male',
    여: 'female',
    여자: 'female',
    female: 'female',
};

const ADMISSION_BY_LABEL = {
    정시: 'regular',
    regular: 'regular',
    수시: 'early',
    early: 'early',
    공무원: 'civil_service',
    civil_service: 'civil_service',
    군사관: 'military_academy',
    사관학교: 'military_academy',
    military_academy: 'military_academy',
    경찰대: 'police_university',
    police_university: 'police_university',
};

const VALID_GRADES = new Set(['고1', '고2', '고3', 'N수']);

function getCellText(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (cell.value instanceof Date) return formatDate(cell.value);
    return String(cell.text || cell.value).trim();
}

function normalizeEmpty(value) {
    const text = String(value || '').trim();
    return text === '-' ? '' : text;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
    const text = normalizeEmpty(value);
    if (!text) return new Date().toISOString().split('T')[0];

    const match = text.match(/^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
    if (!match) return new Date().toISOString().split('T')[0];

    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeGender(value) {
    return GENDER_BY_LABEL[normalizeEmpty(value).toLowerCase()] || null;
}

function normalizeAdmission(value) {
    return ADMISSION_BY_LABEL[normalizeEmpty(value).toLowerCase()] || 'regular';
}

function normalizeStatus(value) {
    return STATUS_BY_LABEL[normalizeEmpty(value).toLowerCase()] || null;
}

function normalizeGrade(value) {
    const grade = normalizeEmpty(value).toUpperCase() === 'N수' ? 'N수' : normalizeEmpty(value);
    return VALID_GRADES.has(grade) ? grade : null;
}

function getSheetStatus(sheetName) {
    return STATUS_BY_SHEET_NAME[sheetName] || 'active';
}

function findHeaderMap(sheet) {
    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const headerMap = {};

        row.eachCell((cell, colNumber) => {
            const label = getCellText(cell);
            Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
                if (aliases.includes(label)) headerMap[key] = colNumber;
            });
        });

        if (headerMap.name && headerMap.phone) {
            return { rowNumber, headerMap };
        }
    }
    return null;
}

function getMappedCellText(row, headerMap, key) {
    const columnNumber = headerMap[key];
    return columnNumber ? getCellText(row.getCell(columnNumber)) : '';
}

function extractWorkbookRows(workbook) {
    const rows = [];

    workbook.eachSheet((sheet) => {
        const header = findHeaderMap(sheet);
        if (!header) return;

        const sheetStatus = getSheetStatus(sheet.name);
        for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const name = normalizeEmpty(getMappedCellText(row, header.headerMap, 'name'));
            const phone = normalizeEmpty(getMappedCellText(row, header.headerMap, 'phone'));

            if (!name && !phone) continue;
            if (/^총\s*\d+명?$/.test(name)) continue;

            const status = normalizeStatus(getMappedCellText(row, header.headerMap, 'status')) || sheetStatus;

            rows.push({
                rowNumber,
                sheetName: sheet.name,
                name,
                phone,
                school: normalizeEmpty(getMappedCellText(row, header.headerMap, 'school')),
                gender: normalizeGender(getMappedCellText(row, header.headerMap, 'gender')),
                grade: normalizeGrade(getMappedCellText(row, header.headerMap, 'grade')),
                enrollmentDate: normalizeDate(getMappedCellText(row, header.headerMap, 'enrollmentDate')),
                admissionType: normalizeAdmission(getMappedCellText(row, header.headerMap, 'admissionType')),
                status,
                isTrial: status === 'trial',
            });
        }
    });

    return rows;
}

async function readRequestBuffer(req) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
            const error = new Error('UPLOAD_TOO_LARGE');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

function getNextStudentNumberFactory(lastStudentNumber) {
    const year = new Date().getFullYear();
    const lastNumber = String(lastStudentNumber || '');
    let sequence = lastNumber.startsWith(String(year))
        ? Number.parseInt(lastNumber.slice(-3), 10) || 0
        : 0;

    return () => {
        sequence += 1;
        return `${year}${String(sequence).padStart(3, '0')}`;
    };
}

async function getStudentNumberFactory(academyId) {
    const year = new Date().getFullYear();
    const [lastStudents] = await pool.execute(
        `SELECT student_number FROM students
         WHERE academy_id = ?
         AND student_number LIKE '${year}%'
         ORDER BY student_number DESC LIMIT 1`,
        [academyId]
    );

    return getNextStudentNumberFactory(lastStudents[0]?.student_number);
}

async function insertImportedStudent(row, academyId, nextStudentNumber) {
    if (!row.name || !row.phone) {
        return {
            status: 'failed',
            message: `${row.sheetName} ${row.rowNumber}행: 이름과 연락처를 모두 입력해주세요.`,
        };
    }

    const encryptedName = encrypt(row.name);
    const encryptedPhone = encrypt(row.phone);

    const [existing] = await pool.execute(
        `SELECT id FROM students
         WHERE academy_id = ?
         AND name = ?
         AND phone = ?
         AND deleted_at IS NULL
         LIMIT 1`,
        [academyId, encryptedName, encryptedPhone]
    );

    if (existing.length > 0) {
        return {
            status: 'skipped',
            message: `${row.name} 학생은 이미 등록되어 있어 건너뛰었습니다.`,
        };
    }

    await pool.execute(
        `INSERT INTO students (
            academy_id, student_number, name, gender, student_type, phone, parent_phone,
            school, grade, age, admission_type, class_days, weekly_count, monthly_tuition,
            discount_rate, discount_reason, payment_due_day, enrollment_date, address,
            notes, status, is_trial, trial_remaining, trial_dates, time_slot, memo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            academyId,
            nextStudentNumber(),
            encryptedName,
            row.gender,
            'exam',
            encryptedPhone,
            null,
            row.school || null,
            row.grade,
            null,
            row.admissionType,
            JSON.stringify([]),
            0,
            0,
            0,
            null,
            null,
            row.enrollmentDate,
            null,
            null,
            row.status,
            row.isTrial,
            row.isTrial ? 2 : null,
            row.isTrial ? JSON.stringify([]) : null,
            'evening',
            null,
        ]
    );

    return {
        status: 'created',
        message: `${row.name} 학생을 등록했습니다.`,
    };
}

module.exports = function(router) {
    router.post('/import', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
        try {
            const buffer = await readRequestBuffer(req);
            if (buffer.length === 0) {
                return res.status(400).json({
                    error: 'Missing File',
                    message: '업로드할 엑셀 파일을 선택해주세요.',
                });
            }

            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.load(buffer);
            } catch {
                return res.status(400).json({
                    error: 'Invalid Excel File',
                    message: '엑셀 파일을 읽지 못했습니다. 학생명단 엑셀 양식인지 확인해주세요.',
                });
            }

            const rows = extractWorkbookRows(workbook);
            if (rows.length === 0) {
                return res.status(400).json({
                    error: 'No Student Rows',
                    message: '등록할 학생 행을 찾지 못했습니다. 이름과 연락처가 있는지 확인해주세요.',
                });
            }

            const nextStudentNumber = await getStudentNumberFactory(req.user.academyId);
            const results = [];

            for (const row of rows) {
                try {
                    results.push(await insertImportedStudent(row, req.user.academyId, nextStudentNumber));
                } catch (error) {
                    logger.error('Student import row failed:', error);
                    results.push({
                        status: 'failed',
                        message: `${row.sheetName} ${row.rowNumber}행을 등록하지 못했습니다. 내용을 확인해주세요.`,
                    });
                }
            }

            const summary = {
                total: rows.length,
                created: results.filter(result => result.status === 'created').length,
                skipped: results.filter(result => result.status === 'skipped').length,
                failed: results.filter(result => result.status === 'failed').length,
            };

            return res.json({
                message: '학생 엑셀 업로드가 완료되었습니다.',
                summary,
                results,
            });
        } catch (error) {
            if (error.status === 413) {
                return res.status(413).json({
                    error: 'File Too Large',
                    message: '엑셀 파일은 5MB 이하로 업로드해주세요.',
                });
            }

            logger.error('Error importing students:', error);
            return res.status(500).json({
                error: 'Server Error',
                message: '학생 엑셀 업로드를 완료하지 못했습니다.',
            });
        }
    });
};
