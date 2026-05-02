/**
 * exports/financial — 월별 재무 리포트 엑셀 다운로드 (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/financial
 *
 * 인증: verifyToken + checkPermission('reports', 'view') (endpoint 단위)
 *
 * 쿼리: { year } — 옵션 (기본 = 현재 연도)
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). 3개 SELECT (수입 / 기타수입 / 지출).
 *     모두 GROUP BY MONTH(...) 로 월별 집계.
 * 보안: 학생/강사명 컬럼 X (집계 결과만 SELECT).
 */

const {
    pool,
    verifyToken,
    checkPermission,
    logger,
    ExcelJS,
    applyHeaderStyle,
    applyCellStyle,
    applyTotalRowStyle
} = require('./_utils');

module.exports = function(router) {
    router.get('/financial', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const { year } = req.query;
            const targetYear = year || new Date().getFullYear();

            // 월별 수입 데이터
            const [monthlyRevenue] = await pool.execute(`
                SELECT
                    MONTH(paid_date) as month,
                    SUM(CASE WHEN payment_type = 'monthly' THEN paid_amount ELSE 0 END) as tuition,
                    SUM(CASE WHEN payment_type = 'season' THEN paid_amount ELSE 0 END) as season_fee,
                    SUM(paid_amount) as total
                FROM student_payments
                WHERE academy_id = ?
                AND YEAR(paid_date) = ?
                AND payment_status = 'paid'
                GROUP BY MONTH(paid_date)
            `, [req.user.academyId, String(targetYear)]);

            // 월별 기타 수입
            const [monthlyOtherIncome] = await pool.execute(`
                SELECT
                    MONTH(income_date) as month,
                    SUM(amount) as total
                FROM other_incomes
                WHERE academy_id = ?
                AND YEAR(income_date) = ?
                GROUP BY MONTH(income_date)
            `, [req.user.academyId, String(targetYear)]);

            // 월별 지출 데이터
            const [monthlyExpenses] = await pool.execute(`
                SELECT
                    MONTH(expense_date) as month,
                    SUM(CASE WHEN category = 'salary' THEN amount ELSE 0 END) as salary,
                    SUM(CASE WHEN category = 'rent' THEN amount ELSE 0 END) as rent,
                    SUM(CASE WHEN category = 'utilities' THEN amount ELSE 0 END) as utilities,
                    SUM(CASE WHEN category NOT IN ('salary', 'rent', 'utilities') THEN amount ELSE 0 END) as other,
                    SUM(amount) as total
                FROM expenses
                WHERE academy_id = ?
                AND YEAR(expense_date) = ?
                GROUP BY MONTH(expense_date)
            `, [req.user.academyId, String(targetYear)]);

            // 데이터를 월별로 정리
            const revenueByMonth = {};
            monthlyRevenue.forEach(r => { revenueByMonth[r.month] = r; });

            const otherIncomeByMonth = {};
            monthlyOtherIncome.forEach(r => { otherIncomeByMonth[r.month] = r; });

            const expensesByMonth = {};
            monthlyExpenses.forEach(e => { expensesByMonth[e.month] = e; });

            // Excel 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.created = new Date();

            // 월별 재무 요약 시트
            const financialSheet = workbook.addWorksheet('월별 재무 현황');
            financialSheet.columns = [
                { header: '월', key: 'month', width: 8 },
                { header: '학원비', key: 'tuition', width: 15 },
                { header: '시즌비', key: 'season_fee', width: 15 },
                { header: '기타수입', key: 'other_income', width: 15 },
                { header: '총 수입', key: 'total_revenue', width: 15 },
                { header: '급여', key: 'salary', width: 15 },
                { header: '임대료', key: 'rent', width: 12 },
                { header: '공과금', key: 'utilities', width: 12 },
                { header: '기타지출', key: 'other_expense', width: 12 },
                { header: '총 지출', key: 'total_expense', width: 15 },
                { header: '순이익', key: 'net_income', width: 15 }
            ];

            applyHeaderStyle(financialSheet.getRow(1));

            let yearlyTotals = {
                tuition: 0, season_fee: 0, other_income: 0, total_revenue: 0,
                salary: 0, rent: 0, utilities: 0, other_expense: 0, total_expense: 0, net_income: 0
            };

            for (let month = 1; month <= 12; month++) {
                const rev = revenueByMonth[month] || { tuition: 0, season_fee: 0, total: 0 };
                const other = otherIncomeByMonth[month] || { total: 0 };
                const exp = expensesByMonth[month] || { salary: 0, rent: 0, utilities: 0, other: 0, total: 0 };

                const tuition = parseFloat(rev.tuition) || 0;
                const seasonFee = parseFloat(rev.season_fee) || 0;
                const otherIncome = parseFloat(other.total) || 0;
                const totalRevenue = tuition + seasonFee + otherIncome;

                const salary = parseFloat(exp.salary) || 0;
                const rent = parseFloat(exp.rent) || 0;
                const utilities = parseFloat(exp.utilities) || 0;
                const otherExpense = parseFloat(exp.other) || 0;
                const totalExpense = salary + rent + utilities + otherExpense;

                const netIncome = totalRevenue - totalExpense;

                // 연간 합계 누적
                yearlyTotals.tuition += tuition;
                yearlyTotals.season_fee += seasonFee;
                yearlyTotals.other_income += otherIncome;
                yearlyTotals.total_revenue += totalRevenue;
                yearlyTotals.salary += salary;
                yearlyTotals.rent += rent;
                yearlyTotals.utilities += utilities;
                yearlyTotals.other_expense += otherExpense;
                yearlyTotals.total_expense += totalExpense;
                yearlyTotals.net_income += netIncome;

                const row = financialSheet.addRow({
                    month: `${month}월`,
                    tuition,
                    season_fee: seasonFee,
                    other_income: otherIncome,
                    total_revenue: totalRevenue,
                    salary,
                    rent,
                    utilities,
                    other_expense: otherExpense,
                    total_expense: totalExpense,
                    net_income: netIncome
                });

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, colNumber > 1);
                    // 순이익이 음수면 빨간색
                    if (colNumber === 11 && netIncome < 0) {
                        cell.font = { color: { argb: 'FFFF0000' } };
                    }
                });
            }

            // 연간 합계 행
            const totalRow = financialSheet.addRow({
                month: '합계',
                tuition: yearlyTotals.tuition,
                season_fee: yearlyTotals.season_fee,
                other_income: yearlyTotals.other_income,
                total_revenue: yearlyTotals.total_revenue,
                salary: yearlyTotals.salary,
                rent: yearlyTotals.rent,
                utilities: yearlyTotals.utilities,
                other_expense: yearlyTotals.other_expense,
                total_expense: yearlyTotals.total_expense,
                net_income: yearlyTotals.net_income
            });
            applyTotalRowStyle(totalRow);

            // 숫자 형식 지정
            ['tuition', 'season_fee', 'other_income', 'total_revenue', 'salary', 'rent', 'utilities', 'other_expense', 'total_expense', 'net_income'].forEach(col => {
                financialSheet.getColumn(col).numFmt = '#,##0"원"';
            });

            // 연간 요약 시트
            const summarySheet = workbook.addWorksheet('연간 요약');
            summarySheet.columns = [
                { header: '구분', key: 'category', width: 20 },
                { header: '금액', key: 'amount', width: 18 }
            ];

            applyHeaderStyle(summarySheet.getRow(1));

            const summaryData = [
                { category: '【수입】', amount: null },
                { category: '  학원비', amount: yearlyTotals.tuition },
                { category: '  시즌비', amount: yearlyTotals.season_fee },
                { category: '  기타수입', amount: yearlyTotals.other_income },
                { category: '  수입 소계', amount: yearlyTotals.total_revenue },
                { category: '', amount: null },
                { category: '【지출】', amount: null },
                { category: '  급여', amount: yearlyTotals.salary },
                { category: '  임대료', amount: yearlyTotals.rent },
                { category: '  공과금', amount: yearlyTotals.utilities },
                { category: '  기타지출', amount: yearlyTotals.other_expense },
                { category: '  지출 소계', amount: yearlyTotals.total_expense },
                { category: '', amount: null },
                { category: '【순이익】', amount: yearlyTotals.net_income }
            ];

            summaryData.forEach((item) => {
                const row = summarySheet.addRow(item);
                if (item.category.includes('소계') || item.category.includes('순이익')) {
                    applyTotalRowStyle(row);
                    if (item.category.includes('순이익') && item.amount < 0) {
                        row.getCell(2).font = { bold: true, color: { argb: 'FFFF0000' } };
                    }
                } else if (item.category.startsWith('【')) {
                    row.getCell(1).font = { bold: true, size: 12 };
                }
            });
            summarySheet.getColumn('amount').numFmt = '#,##0"원"';

            // 파일명 생성
            const filename = `재무리포트_${targetYear}년.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            logger.error('Error exporting financial report:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '재무 리포트 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
