/**
 * exports/expenses — 지출 내역 엑셀 다운로드 (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/expenses
 *
 * 인증: verifyToken + checkPermission('reports', 'view') (endpoint 단위)
 *
 * 쿼리: { start_date, end_date, year, month } — 모두 옵션
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리 (Content-Type:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). expenses LEFT JOIN instructors 단일 SELECT.
 * 보안: decrypt 시그니처 무변경 (ADR-007). 강사명 복호화는 decryptArray 사용.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    logger,
    ExcelJS,
    decryptArray,
    PAYMENT_METHOD_LABELS,
    EXPENSE_CATEGORY_LABELS,
    applyHeaderStyle,
    applyCellStyle,
    applyTotalRowStyle
} = require('./_utils');

module.exports = function(router) {
    router.get('/expenses', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const { start_date, end_date, year, month } = req.query;

            let dateFilter = '';
            const params = [req.user.academyId];

            if (start_date && end_date) {
                dateFilter = 'AND e.expense_date BETWEEN ? AND ?';
                params.push(start_date, end_date);
            } else if (year && month) {
                const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
                const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
                dateFilter = 'AND e.expense_date BETWEEN ? AND ?';
                params.push(startOfMonth, endOfMonth);
            }

            const [expensesRaw] = await pool.execute(`
                SELECT
                    e.expense_date,
                    e.category,
                    e.amount,
                    e.description,
                    e.payment_method,
                    e.notes,
                    i.name as instructor_name
                FROM expenses e
                LEFT JOIN instructors i ON e.instructor_id = i.id
                WHERE e.academy_id = ?
                ${dateFilter}
                ORDER BY e.expense_date DESC
            `, params);
            const expenses = decryptArray(expensesRaw);

            // Excel 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.created = new Date();

            // 지출 내역 시트
            const expenseSheet = workbook.addWorksheet('지출 내역');
            expenseSheet.columns = [
                { header: '날짜', key: 'date', width: 12 },
                { header: '카테고리', key: 'category', width: 12 },
                { header: '금액', key: 'amount', width: 15 },
                { header: '설명', key: 'description', width: 30 },
                { header: '결제방법', key: 'payment_method', width: 12 },
                { header: '관련 강사', key: 'instructor_name', width: 15 },
                { header: '메모', key: 'notes', width: 20 }
            ];

            applyHeaderStyle(expenseSheet.getRow(1));

            // 카테고리별 합계 계산용
            const categoryTotals = {};
            let grandTotal = 0;

            expenses.forEach((expense) => {
                const amount = parseFloat(expense.amount) || 0;
                grandTotal += amount;

                const category = expense.category;
                categoryTotals[category] = (categoryTotals[category] || 0) + amount;

                const row = expenseSheet.addRow({
                    date: expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('ko-KR') : '-',
                    category: EXPENSE_CATEGORY_LABELS[expense.category] || expense.category,
                    amount: amount,
                    description: expense.description || '-',
                    payment_method: PAYMENT_METHOD_LABELS[expense.payment_method] || expense.payment_method || '-',
                    instructor_name: expense.instructor_name || '-',
                    notes: expense.notes || '-'
                });

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, colNumber === 3);
                });
            });

            // 합계 행
            const totalRow = expenseSheet.addRow({
                date: '합계',
                category: '',
                amount: grandTotal,
                description: '',
                payment_method: '',
                instructor_name: '',
                notes: ''
            });
            applyTotalRowStyle(totalRow);
            expenseSheet.getColumn('amount').numFmt = '#,##0"원"';

            // 카테고리별 요약 시트
            const summarySheet = workbook.addWorksheet('카테고리별 요약');
            summarySheet.columns = [
                { header: '카테고리', key: 'category', width: 15 },
                { header: '금액', key: 'amount', width: 18 },
                { header: '비율', key: 'ratio', width: 12 }
            ];

            applyHeaderStyle(summarySheet.getRow(1));

            Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .forEach(([category, amount]) => {
                    const row = summarySheet.addRow({
                        category: EXPENSE_CATEGORY_LABELS[category] || category,
                        amount: amount,
                        ratio: grandTotal > 0 ? (amount / grandTotal * 100).toFixed(1) + '%' : '0%'
                    });
                    row.eachCell((cell, colNumber) => {
                        applyCellStyle(cell, colNumber === 2);
                    });
                });

            const summaryTotalRow = summarySheet.addRow({
                category: '합계',
                amount: grandTotal,
                ratio: '100%'
            });
            applyTotalRowStyle(summaryTotalRow);
            summarySheet.getColumn('amount').numFmt = '#,##0"원"';

            // 파일명 생성
            const dateStr = start_date && end_date
                ? `${start_date}_${end_date}`
                : year && month
                    ? `${year}년${month}월`
                    : new Date().toISOString().split('T')[0];
            const filename = `지출내역_${dateStr}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            logger.error('Error exporting expenses:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '지출 내역 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
