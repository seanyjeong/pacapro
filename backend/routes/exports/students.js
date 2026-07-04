/**
 * exports/students — 학생 명단 엑셀 다운로드 (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/students
 *
 * 인증: verifyToken (단순 인증, checkPermission 미적용 — 원본 정책 보존)
 *
 * 쿼리: 없음 (학원 단위 전체 학생 export)
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리 (재원생/휴원생/퇴원생/체험생/미등록 시트별 분리)
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). academies + students 두 SELECT.
 * 보안: decrypt 시그니처 무변경 (ADR-007). 학생명 / 연락처 복호화는 decryptArray.
 *
 * 프론트 소비처: src/app/students/page.tsx (직접 fetch 호출, exportsApi 미사용).
 */

const {
    pool,
    verifyToken,
    logger,
    ExcelJS,
    decryptArray
} = require('./_utils');

const TEMPLATE_HEADERS = ['이름', '연락처', '학교', '성별', '학년', '등록일', '입시유형', '상태'];

function addStudentImportTemplateSheet(workbook) {
    const sheet = workbook.addWorksheet('학생등록양식');
    const headerRow = sheet.addRow(TEMPLATE_HEADERS);

    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1565C0' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    headerRow.height = 24;
    [15, 16, 20, 10, 10, 14, 12, 12].forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = 'A1:H1';
    return sheet;
}

module.exports = function(router) {
    router.get('/students', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academyId;

            // 학원 정보 조회
            const [academies] = await pool.execute(
                'SELECT name FROM academies WHERE id = ?',
                [academyId]
            );
            const academyName = academies.length > 0 ? academies[0].name : '학원';

            // 학생 목록 조회
            const [students] = await pool.execute(`
                SELECT
                    id, name, phone, school, gender, grade, enrollment_date,
                    admission_type, student_type, status, is_trial
                FROM students
                WHERE academy_id = ?
                ORDER BY name ASC
            `, [academyId]);

            // 이름 복호화
            const decryptedStudents = decryptArray(students);

            // 상태별 분류
            const statusGroups = {
                active: { name: '재원생', color: 'FF2E7D32', students: [] },
                paused: { name: '휴원생', color: 'FFFFA000', students: [] },
                withdrawn: { name: '퇴원생', color: 'FFC62828', students: [] },
                trial: { name: '체험생', color: 'FF1565C0', students: [] },
                pending: { name: '미등록', color: 'FF757575', students: [] }
            };

            decryptedStudents.forEach(student => {
                if (student.is_trial || student.status === 'trial') {
                    statusGroups.trial.students.push(student);
                } else if (student.status === 'pending') {
                    statusGroups.pending.students.push(student);
                } else if (statusGroups[student.status]) {
                    statusGroups[student.status].students.push(student);
                } else {
                    statusGroups.active.students.push(student);
                }
            });

            // 엑셀 워크북 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.company = academyName;
            workbook.created = new Date();
            workbook.modified = new Date();
            workbook.properties.date1904 = false;
            workbook.views = [{
                x: 0,
                y: 0,
                width: 10000,
                height: 20000,
                firstSheet: 0,
                activeTab: 0,
                visibility: 'visible'
            }];

            // 입시유형 라벨
            const admissionLabels = {
                regular: '정시',
                early: '수시',
                transfer: '편입',
                civil_service: '공무원',
                adult: '성인'
            };

            // 성별 라벨
            const genderLabels = {
                male: '남',
                female: '여'
            };

            addStudentImportTemplateSheet(workbook);

            // 각 상태별 시트 생성
            for (const group of Object.values(statusGroups)) {
                if (group.students.length === 0) continue;

                const sheet = workbook.addWorksheet(group.name);

                // ===== 타이틀 헤더 =====
                sheet.mergeCells('A1:H1');
                const titleCell = sheet.getCell('A1');
                titleCell.value = `${academyName} - ${group.name} 명단`;
                titleCell.font = { bold: true, size: 18, color: { argb: group.color } };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getRow(1).height = 35;

                sheet.mergeCells('A2:H2');
                const dateCell = sheet.getCell('A2');
                dateCell.value = `출력일: ${new Date().toLocaleDateString('ko-KR')} | 총 ${group.students.length}명`;
                dateCell.font = { size: 11, color: { argb: 'FF666666' } };
                dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getRow(2).height = 25;

                // 빈 행
                sheet.getRow(3).height = 10;

                // ===== 컬럼 헤더 =====
                const headerRow = sheet.getRow(4);
                const headers = ['No.', '이름', '연락처', '학교', '성별', '학년', '등록일', '입시유형'];
                headers.forEach((header, index) => {
                    const cell = headerRow.getCell(index + 1);
                    cell.value = header;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: group.color }
                    };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                headerRow.height = 28;

                // 컬럼 너비 설정
                sheet.getColumn(1).width = 8;   // No.
                sheet.getColumn(2).width = 15;  // 이름
                sheet.getColumn(3).width = 15;  // 연락처
                sheet.getColumn(4).width = 20;  // 학교
                sheet.getColumn(5).width = 8;   // 성별
                sheet.getColumn(6).width = 10;  // 학년
                sheet.getColumn(7).width = 14;  // 등록일
                sheet.getColumn(8).width = 12;  // 입시유형

                // ===== 데이터 행 =====
                let rowNum = 5;
                group.students.forEach((student, index) => {
                    const row = sheet.getRow(rowNum);

                    row.getCell(1).value = index + 1;  // No.
                    row.getCell(2).value = student.name || '-';
                    row.getCell(3).value = student.phone || '-';
                    row.getCell(4).value = student.school || '-';
                    row.getCell(5).value = genderLabels[student.gender] || '-';
                    row.getCell(6).value = student.grade || '-';
                    row.getCell(7).value = student.enrollment_date
                        ? student.enrollment_date.split('T')[0]
                        : '-';
                    row.getCell(8).value = admissionLabels[student.admission_type] || student.admission_type || '-';

                    // 스타일 적용
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                        };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        // 짝수 행 배경색
                        if (index % 2 === 1) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF8F9FA' }
                            };
                        }
                    });

                    row.height = 24;
                    rowNum++;
                });

                // 합계 행
                const totalRow = sheet.getRow(rowNum);
                sheet.mergeCells(`A${rowNum}:H${rowNum}`);
                totalRow.getCell(1).value = `총 ${group.students.length}명`;
                totalRow.getCell(1).font = { bold: true, size: 11, color: { argb: group.color } };
                totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                totalRow.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
                totalRow.getCell(1).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                totalRow.height = 28;
            }

            // 파일명 생성
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const filename = `학생명단_${today}.xlsx`;
            const fallbackFilename = `students_${today}.xlsx`;
            const workbookBuffer = await workbook.xlsx.writeBuffer();
            const fileBuffer = Buffer.isBuffer(workbookBuffer)
                ? workbookBuffer
                : Buffer.from(workbookBuffer);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
            );
            res.setHeader('Content-Length', String(fileBuffer.length));
            res.setHeader('Cache-Control', 'no-store');

            return res.send(fileBuffer);

        } catch (error) {
            logger.error('Error exporting students:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '학생 명단 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
