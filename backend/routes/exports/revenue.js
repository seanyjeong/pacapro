/**
 * exports/revenue — 수입 내역 엑셀 다운로드 (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/revenue
 *
 * 인증: verifyToken + checkPermission('reports', 'view') (endpoint 단위)
 *
 * 쿼리: { start_date, end_date, year, month } — 모두 옵션
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리 (Content-Type:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
 *           Content-Disposition: attachment; filename*=UTF-8''<encodedName>)
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). student_payments + other_incomes 두 SELECT.
 * 보안: decrypt 시그니처 무변경 (ADR-007). 학생명 복호화는 decryptArray 사용.
 *
 * 응답 표면 보존 (ADR-013): 프론트 `src/lib/api/exports.ts` downloadRevenue 가
 * blob + Content-Disposition 직접 소비. 헤더/바이너리/파일명 형식 1:1 보존.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    logger,
    ExcelJS,
    decryptArray,
    PAYMENT_METHOD_LABELS,
    INCOME_CATEGORY_LABELS,
    applyHeaderStyle,
    applyCellStyle,
    applyTotalRowStyle
} = require('./_utils');

module.exports = function(router) {
    router.get('/revenue', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const { start_date, end_date, year, month } = req.query;

            let dateFilter = '';
            const params = [req.user.academyId];

            if (start_date && end_date) {
                dateFilter = 'AND (sp.paid_date BETWEEN ? AND ? OR oi.income_date BETWEEN ? AND ?)';
                params.push(start_date, end_date, start_date, end_date);
            } else if (year && month) {
                const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
                const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
                dateFilter = 'AND (sp.paid_date BETWEEN ? AND ? OR oi.income_date BETWEEN ? AND ?)';
                params.push(startOfMonth, endOfMonth, startOfMonth, endOfMonth);
            }

            // 학원비 수입 (student_payments) — sp.paid_date 만 사용 (oi 컬럼 제거)
            const tuitionParams = params.slice(0, start_date && end_date ? 3 : (year && month ? 3 : 1));
            const [tuitionPaymentsRaw] = await pool.execute(`
                SELECT
                    sp.paid_date as date,
                    '학원비' as category,
                    s.name as student_name,
                    sp.payment_type,
                    sp.paid_amount as amount,
                    sp.payment_method,
                    sp.description,
                    sp.notes
                FROM student_payments sp
                JOIN students s ON sp.student_id = s.id
                WHERE sp.academy_id = ?
                AND sp.payment_status = 'paid'
                AND sp.paid_date IS NOT NULL
                ${dateFilter ? dateFilter.replace(/oi\.income_date/g, 'sp.paid_date').replace('OR sp.paid_date BETWEEN ? AND ?', '') : ''}
                ORDER BY sp.paid_date DESC
            `, tuitionParams);
            const tuitionPayments = decryptArray(tuitionPaymentsRaw);

            // 기타 수입 (other_incomes)
            const incomeParams = [req.user.academyId];
            if (start_date && end_date) {
                incomeParams.push(start_date, end_date);
            } else if (year && month) {
                const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
                const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
                incomeParams.push(startOfMonth, endOfMonth);
            }

            const [otherIncomesRaw] = await pool.execute(`
                SELECT
                    oi.income_date as date,
                    oi.category,
                    COALESCE(s.name, '-') as student_name,
                    'other' as payment_type,
                    oi.amount,
                    oi.payment_method,
                    oi.description,
                    oi.notes
                FROM other_incomes oi
                LEFT JOIN students s ON oi.student_id = s.id
                WHERE oi.academy_id = ?
                ${start_date && end_date ? 'AND oi.income_date BETWEEN ? AND ?' : ''}
                ${year && month && !start_date ? 'AND oi.income_date BETWEEN ? AND ?' : ''}
                ORDER BY oi.income_date DESC
            `, incomeParams);
            const otherIncomes = decryptArray(otherIncomesRaw);

            // Excel 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.created = new Date();

            // 학원비 수입 시트
            const tuitionSheet = workbook.addWorksheet('학원비 수입');
            tuitionSheet.columns = [
                { header: '날짜', key: 'date', width: 12 },
                { header: '학생명', key: 'student_name', width: 15 },
                { header: '구분', key: 'payment_type', width: 12 },
                { header: '금액', key: 'amount', width: 15 },
                { header: '결제방법', key: 'payment_method', width: 12 },
                { header: '설명', key: 'description', width: 25 },
                { header: '메모', key: 'notes', width: 20 }
            ];

            applyHeaderStyle(tuitionSheet.getRow(1));

            let tuitionTotal = 0;
            tuitionPayments.forEach((payment, index) => {
                const amount = parseFloat(payment.amount) || 0;
                tuitionTotal += amount;

                const row = tuitionSheet.addRow({
                    date: payment.date ? new Date(payment.date).toLocaleDateString('ko-KR') : '-',
                    student_name: payment.student_name,
                    payment_type: payment.payment_type === 'monthly' ? '월회비' :
                                 payment.payment_type === 'season' ? '시즌비' : payment.payment_type,
                    amount: amount,
                    payment_method: PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-',
                    description: payment.description || '-',
                    notes: payment.notes || '-'
                });

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, colNumber === 4);
                });
            });

            // 합계 행
            const tuitionTotalRow = tuitionSheet.addRow({
                date: '합계',
                student_name: '',
                payment_type: '',
                amount: tuitionTotal,
                payment_method: '',
                description: '',
                notes: ''
            });
            applyTotalRowStyle(tuitionTotalRow);
            tuitionSheet.getCell(`D${tuitionSheet.rowCount}`).numFmt = '#,##0"원"';

            // 금액 형식
            tuitionSheet.getColumn('amount').numFmt = '#,##0"원"';

            // 기타 수입 시트
            const otherSheet = workbook.addWorksheet('기타 수입');
            otherSheet.columns = [
                { header: '날짜', key: 'date', width: 12 },
                { header: '카테고리', key: 'category', width: 12 },
                { header: '학생명', key: 'student_name', width: 15 },
                { header: '금액', key: 'amount', width: 15 },
                { header: '결제방법', key: 'payment_method', width: 12 },
                { header: '설명', key: 'description', width: 25 },
                { header: '메모', key: 'notes', width: 20 }
            ];

            applyHeaderStyle(otherSheet.getRow(1));

            let otherTotal = 0;
            otherIncomes.forEach((income) => {
                const amount = parseFloat(income.amount) || 0;
                otherTotal += amount;

                const row = otherSheet.addRow({
                    date: income.date ? new Date(income.date).toLocaleDateString('ko-KR') : '-',
                    category: INCOME_CATEGORY_LABELS[income.category] || income.category,
                    student_name: income.student_name,
                    amount: amount,
                    payment_method: PAYMENT_METHOD_LABELS[income.payment_method] || income.payment_method || '-',
                    description: income.description || '-',
                    notes: income.notes || '-'
                });

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, colNumber === 4);
                });
            });

            const otherTotalRow = otherSheet.addRow({
                date: '합계',
                category: '',
                student_name: '',
                amount: otherTotal,
                payment_method: '',
                description: '',
                notes: ''
            });
            applyTotalRowStyle(otherTotalRow);
            otherSheet.getColumn('amount').numFmt = '#,##0"원"';

            // 요약 시트
            const summarySheet = workbook.addWorksheet('수입 요약');
            summarySheet.columns = [
                { header: '구분', key: 'category', width: 20 },
                { header: '금액', key: 'amount', width: 18 }
            ];

            applyHeaderStyle(summarySheet.getRow(1));

            const summaryData = [
                { category: '학원비 수입', amount: tuitionTotal },
                { category: '기타 수입', amount: otherTotal },
                { category: '총 수입', amount: tuitionTotal + otherTotal }
            ];

            summaryData.forEach((item, index) => {
                const row = summarySheet.addRow(item);
                if (index === summaryData.length - 1) {
                    applyTotalRowStyle(row);
                } else {
                    row.eachCell((cell, colNumber) => {
                        applyCellStyle(cell, colNumber === 2);
                    });
                }
            });
            summarySheet.getColumn('amount').numFmt = '#,##0"원"';

            // 파일명 생성
            const dateStr = start_date && end_date
                ? `${start_date}_${end_date}`
                : year && month
                    ? `${year}년${month}월`
                    : new Date().toISOString().split('T')[0];
            const filename = `수입내역_${dateStr}.xlsx`;

            // 응답 헤더 설정
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            logger.error('Error exporting revenue:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '수입 내역 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
