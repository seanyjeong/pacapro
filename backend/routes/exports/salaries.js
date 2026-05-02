/**
 * exports/salaries — 급여 내역 엑셀 다운로드 (회사 스타일) (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/salaries
 *
 * 인증: verifyToken + checkPermission('reports', 'view') (endpoint 단위)
 *
 * 쿼리: { year, month, payment_status } — 모두 옵션
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리 (회사 헤더 + 급여 명세서 시트 + 급여 요약 시트)
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). academies + salary_records JOIN instructors 두 SELECT.
 * 보안: decrypt 시그니처 무변경 (ADR-007). 강사명 + 주민번호 복호화는 decryptArray.
 *      paca/salaries 본 라우터 (실제 결제 흐름) 미접촉 — 단순 read-only 엑셀 export.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    logger,
    ExcelJS,
    decryptArray,
    applyHeaderStyle,
    applyCellStyle
} = require('./_utils');

module.exports = function(router) {
    router.get('/salaries', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const { year, month, payment_status } = req.query;

            let dateFilter = '';
            const params = [req.user.academyId];

            if (year && month) {
                dateFilter = 'AND s.year_month = ?';
                params.push(`${year}-${String(month).padStart(2, '0')}`);
            } else if (year) {
                dateFilter = 'AND s.year_month LIKE ?';
                params.push(`${year}-%`);
            }

            let statusFilter = '';
            if (payment_status === 'paid') {
                statusFilter = "AND s.payment_status = 'paid'";
            }

            // 학원 정보 조회
            const [academyInfo] = await pool.execute(
                `SELECT name, phone, address FROM academies WHERE id = ?`,
                [req.user.academyId]
            );
            const academy = academyInfo[0] || { name: 'P-ACA', phone: '', address: '' };

            // 급여 내역 조회
            const [salariesRaw] = await pool.execute(`
                SELECT
                    s.id,
                    s.year_month,
                    i.name as instructor_name,
                    i.resident_number,
                    s.base_amount,
                    s.incentive_amount,
                    s.total_deduction,
                    s.tax_type,
                    s.tax_amount,
                    s.insurance_details,
                    s.net_salary,
                    s.payment_date,
                    s.payment_status
                FROM salary_records s
                JOIN instructors i ON s.instructor_id = i.id
                WHERE i.academy_id = ?
                ${dateFilter}
                ${statusFilter}
                ORDER BY s.year_month DESC, i.name ASC
            `, params);
            const salaries = decryptArray(salariesRaw);

            // Excel 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.created = new Date();

            // 급여 명세서 시트
            const sheet = workbook.addWorksheet('급여 명세서');

            // ========== 회사 헤더 ==========
            sheet.mergeCells('A1:H1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = academy.name || 'P-ACA';
            titleCell.font = { bold: true, size: 18, color: { argb: 'FF1F4E79' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getRow(1).height = 35;

            sheet.mergeCells('A2:H2');
            const subtitleCell = sheet.getCell('A2');
            const targetPeriod = year && month ? `${year}년 ${month}월` : year ? `${year}년` : '전체';
            subtitleCell.value = `급여 명세서 (${targetPeriod})`;
            subtitleCell.font = { size: 14, color: { argb: 'FF666666' } };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getRow(2).height = 25;

            sheet.mergeCells('A3:H3');
            const dateCell = sheet.getCell('A3');
            dateCell.value = `출력일: ${new Date().toLocaleDateString('ko-KR')}`;
            dateCell.font = { size: 10, color: { argb: 'FF999999' } };
            dateCell.alignment = { horizontal: 'right', vertical: 'middle' };

            // 빈 행
            sheet.getRow(4).height = 10;

            // ========== 컬럼 헤더 ==========
            const headerRow = sheet.getRow(5);
            const headers = ['월', '이름', '주민번호', '기본급', '인센티브', '공제액', '세금', '실수령액'];
            headers.forEach((header, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = header;
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F4E79' }
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
            sheet.getColumn(1).width = 12;  // 월
            sheet.getColumn(2).width = 15;  // 이름
            sheet.getColumn(3).width = 18;  // 주민번호
            sheet.getColumn(4).width = 14;  // 기본급
            sheet.getColumn(5).width = 14;  // 인센티브
            sheet.getColumn(6).width = 14;  // 공제액
            sheet.getColumn(7).width = 14;  // 세금
            sheet.getColumn(8).width = 15;  // 실수령액

            // ========== 데이터 행 ==========
            let totalBase = 0, totalIncentive = 0, totalDeduction = 0, totalTax = 0, totalNet = 0;
            let rowNum = 6;

            salaries.forEach((salary, index) => {
                const baseAmount = parseFloat(salary.base_amount) || 0;
                const incentiveAmount = parseFloat(salary.incentive_amount) || 0;
                const totalDeductionAmt = parseFloat(salary.total_deduction) || 0;
                const taxAmount = parseFloat(salary.tax_amount) || 0;
                const netSalary = parseFloat(salary.net_salary) || 0;

                totalBase += baseAmount;
                totalIncentive += incentiveAmount;
                totalDeduction += totalDeductionAmt;
                totalTax += taxAmount;
                totalNet += netSalary;

                const row = sheet.getRow(rowNum);

                // 월 표시 (YYYY-MM -> YYYY년 MM월)
                const [y, m] = salary.year_month.split('-');
                row.getCell(1).value = `${y}년 ${parseInt(m)}월`;
                row.getCell(2).value = salary.instructor_name;
                row.getCell(3).value = salary.resident_number || '-';
                row.getCell(4).value = baseAmount;
                row.getCell(5).value = incentiveAmount;
                row.getCell(6).value = totalDeductionAmt;
                row.getCell(7).value = taxAmount;
                row.getCell(8).value = netSalary;

                // 스타일 적용
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                    };
                    cell.alignment = {
                        horizontal: colNumber >= 4 ? 'right' : 'center',
                        vertical: 'middle'
                    };
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

            // ========== 합계 행 ==========
            const totalRow = sheet.getRow(rowNum);
            totalRow.getCell(1).value = '합계';
            totalRow.getCell(2).value = `${salaries.length}명`;
            totalRow.getCell(3).value = '';
            totalRow.getCell(4).value = totalBase;
            totalRow.getCell(5).value = totalIncentive;
            totalRow.getCell(6).value = totalDeduction;
            totalRow.getCell(7).value = totalTax;
            totalRow.getCell(8).value = totalNet;

            totalRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F4E79' }
                };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.border = {
                    top: { style: 'medium' },
                    left: { style: 'thin' },
                    bottom: { style: 'medium' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
            totalRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
            totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
            totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
            totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
            totalRow.height = 28;

            // 숫자 형식 (천단위 쉼표 + 원)
            [4, 5, 6, 7, 8].forEach(col => {
                sheet.getColumn(col).numFmt = '#,##0"원"';
            });

            // ========== 요약 정보 시트 ==========
            const summarySheet = workbook.addWorksheet('급여 요약');

            // 회사 헤더
            summarySheet.mergeCells('A1:C1');
            summarySheet.getCell('A1').value = `${academy.name} - 급여 요약`;
            summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
            summarySheet.getCell('A1').alignment = { horizontal: 'center' };
            summarySheet.getRow(1).height = 30;

            summarySheet.mergeCells('A2:C2');
            summarySheet.getCell('A2').value = targetPeriod;
            summarySheet.getCell('A2').font = { size: 12, color: { argb: 'FF666666' } };
            summarySheet.getCell('A2').alignment = { horizontal: 'center' };

            // 요약 테이블
            summarySheet.getRow(4).values = ['항목', '금액', '비고'];
            applyHeaderStyle(summarySheet.getRow(4));

            summarySheet.getColumn(1).width = 20;
            summarySheet.getColumn(2).width = 18;
            summarySheet.getColumn(3).width = 15;

            const summaryData = [
                { item: '총 기본급', amount: totalBase, note: '' },
                { item: '총 인센티브', amount: totalIncentive, note: '' },
                { item: '총 공제액', amount: totalDeduction, note: '4대보험 등' },
                { item: '총 세금', amount: totalTax, note: '소득세 등' },
                { item: '', amount: null, note: '' },
                { item: '총 지급액', amount: totalNet, note: `${salaries.length}명` }
            ];

            let summaryRowNum = 5;
            summaryData.forEach((item, index) => {
                const row = summarySheet.getRow(summaryRowNum);
                row.getCell(1).value = item.item;
                row.getCell(2).value = item.amount;
                row.getCell(3).value = item.note;

                if (item.item === '총 지급액') {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF1F4E79' }
                        };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
                    });
                } else if (item.item) {
                    row.eachCell((cell, colNumber) => {
                        applyCellStyle(cell, colNumber === 2);
                    });
                }

                summaryRowNum++;
            });

            summarySheet.getColumn(2).numFmt = '#,##0"원"';

            // 파일명 생성
            const periodStr = year && month ? `${year}년${month}월` : year ? `${year}년` : '전체';
            const filename = `급여명세서_${periodStr}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            logger.error('Error exporting salaries:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '급여 내역 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
