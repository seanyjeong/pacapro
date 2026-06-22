# Reports Page Split

## Scope

`/reports` keeps the existing finance report behavior while moving route logic into a feature slice.

## Preserved API Contract

- `GET /students`
- `GET /payments?year=:year&month=:month`
- `GET /payments?paid_year=:year&paid_month=:month&payment_status=paid`
- `GET /expenses?start_date=:yyyy-mm-01&end_date=:yyyy-mm-last`
- `GET /instructors`
- `GET /incomes?start_date=:yyyy-mm-01&end_date=:yyyy-mm-last`
- Export downloads:
  - `GET /exports/revenue?start_date=:date&end_date=:date`
  - `GET /exports/expenses?start_date=:date&end_date=:date`
  - `GET /exports/payments?year=:year&month=:month`
  - `GET /exports/financial?year=:year`

## UX Contract

- API load failures show `리포트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.`
- Export failures show `엑셀 파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.`
- Raw server messages, status codes, CORS labels, stack traces, and DB wording are not shown to users.
- The visual direction follows Operations Desk: compact header, summary strip, and dense report panels.
