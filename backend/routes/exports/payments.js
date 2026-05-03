/**
 * exports/payments — 미납/납부 내역 엑셀 다운로드 (Phase 2 #6)
 *
 * Endpoint:
 *   GET /paca/exports/payments
 *
 * 인증: verifyToken + checkPermission('reports', 'view') (endpoint 단위)
 *
 * 쿼리: { status, year, month, start_date, end_date } — 모두 옵션
 *        status ∈ { pending, partial, paid, cancelled }
 * 응답:
 *   - 성공: ExcelJS workbook 바이너리
 *   - 5xx : { error: 'Server Error', message: '<한국어>' } — 응답 표면 보존 (ADR-013)
 *
 * DB: pool.execute (ADR-005). student_payments JOIN students 단일 SELECT.
 * 보안: decrypt 시그니처 무변경 (ADR-007). 학생명 복호화는 decryptArray 사용.
 *      payments 테이블 접촉이 아닌 student_payments (학사 청구) — 보안 영역 무관.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    logger,
    ExcelJS,
    decryptArray,
    PAYMENT_METHOD_LABELS,
    applyHeaderStyle,
    applyCellStyle,
    applyTotalRowStyle
} = require('./_utils');

module.exports = function(router) {
    router.get('/payments', verifyToken, checkPermission('reports', 'view'), async (req, res) => {
        try {
            const { status, year, month, start_date, end_date } = req.query;

            let dateFilter = '';
            const params = [req.user.academyId];

            if (start_date && end_date) {
                dateFilter = 'AND p.due_date BETWEEN ? AND ?';
                params.push(start_date, end_date);
            } else if (year && month) {
                dateFilter = 'AND p.year_month = ?';
                params.push(`${year}-${month.toString().padStart(2, '0')}`);
            }

            let statusFilter = '';
            if (status && ['pending', 'partial', 'paid', 'cancelled'].includes(status)) {
                statusFilter = 'AND p.payment_status = ?';
                params.push(status);
            }

            const [paymentsRaw] = await pool.execute(`
                SELECT
                    p.id,
                    p.year_month,
                    p.payment_type,
                    p.base_amount,
                    p.discount_amount,
                    p.additional_amount,
                    p.final_amount,
                    COALESCE(p.paid_amount, 0) as paid_amount,
                    p.due_date,
                    p.paid_date,
                    p.payment_status,
                    p.payment_method,
                    p.description,
                    s.name as student_name,
                    s.student_number,
                    s.grade
                FROM student_payments p
                JOIN students s ON p.student_id = s.id
                WHERE p.academy_id = ?
                ${dateFilter}
                ${statusFilter}
                ORDER BY p.due_date DESC, s.name
            `, params);
            const payments = decryptArray(paymentsRaw);

            // Excel 생성
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'P-ACA';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('납부 내역');
            sheet.columns = [
                { header: '학생명', key: 'student_name', width: 12 },
                { header: '학번', key: 'student_number', width: 10 },
                { header: '학년', key: 'grade', width: 8 },
                { header: '년월', key: 'year_month', width: 10 },
                { header: '구분', key: 'payment_type', width: 10 },
                { header: '청구액', key: 'final_amount', width: 12 },
                { header: '납부액', key: 'paid_amount', width: 12 },
                { header: '미납액', key: 'unpaid', width: 12 },
                { header: '납부일', key: 'paid_date', width: 12 },
                { header: '마감일', key: 'due_date', width: 12 },
                { header: '상태', key: 'status', width: 10 },
                { header: '결제방법', key: 'payment_method', width: 10 }
            ];

            applyHeaderStyle(sheet.getRow(1));

            const STATUS_LABELS = {
                pending: '미납',
                partial: '부분납부',
                paid: '완납',
                cancelled: '취소'
            };

            const PAYMENT_TYPE_LABELS = {
                monthly: '월회비',
                season: '시즌비'
            };

            let totalFinal = 0, totalPaid = 0, totalUnpaid = 0;

            payments.forEach((payment) => {
                const finalAmount = parseFloat(payment.final_amount) || 0;
                const paidAmount = parseFloat(payment.paid_amount) || 0;
                const unpaid = finalAmount - paidAmount;

                totalFinal += finalAmount;
                totalPaid += paidAmount;
                totalUnpaid += unpaid;

                const row = sheet.addRow({
                    student_name: payment.student_name,
                    student_number: payment.student_number || '-',
                    grade: payment.grade || '-',
                    year_month: payment.year_month,
                    payment_type: PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type,
                    final_amount: finalAmount,
                    paid_amount: paidAmount,
                    unpaid: unpaid,
                    paid_date: payment.paid_date ? new Date(payment.paid_date).toLocaleDateString('ko-KR') : '-',
                    due_date: payment.due_date ? new Date(payment.due_date).toLocaleDateString('ko-KR') : '-',
                    status: STATUS_LABELS[payment.payment_status] || payment.payment_status,
                    payment_method: PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '-'
                });

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, [6, 7, 8].includes(colNumber));
                    // 미납 상태면 빨간 배경
                    if (payment.payment_status === 'pending') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFCE4D6' }
                        };
                    }
                });
            });

            // 합계 행
            const totalRow = sheet.addRow({
                student_name: '합계',
                student_number: '',
                grade: '',
                year_month: '',
                payment_type: '',
                final_amount: totalFinal,
                paid_amount: totalPaid,
                unpaid: totalUnpaid,
                paid_date: '',
                due_date: '',
                status: '',
                payment_method: ''
            });
            applyTotalRowStyle(totalRow);

            // 숫자 형식
            ['final_amount', 'paid_amount', 'unpaid'].forEach(col => {
                sheet.getColumn(col).numFmt = '#,##0"원"';
            });

            // 파일명 생성
            const dateStr = start_date && end_date
                ? `${start_date}_${end_date}`
                : year && month
                    ? `${year}년${month}월`
                    : new Date().toISOString().split('T')[0];
            const statusStr = status ? `_${STATUS_LABELS[status] || status}` : '';
            const filename = `납부내역${statusStr}_${dateStr}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            logger.error('Error exporting payments:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '납부 내역 엑셀을 생성하지 못했습니다.'
            });
        }
    });
};
