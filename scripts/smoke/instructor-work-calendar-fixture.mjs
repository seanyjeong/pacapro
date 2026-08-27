export function makeMonthlyWorkSchedules(url) {
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));
  const monthText = String(month).padStart(2, '0');

  return {
    message: 'ok',
    instructor_id: 31,
    year_month: `${year}-${monthText}`,
    schedules: [
      { id: 901, work_date: `${year}-${monthText}-03`, time_slot: 'morning', scheduled_start_time: '09:00:00', scheduled_end_time: '12:00:00' },
      { id: 902, work_date: `${year}-${monthText}-03`, time_slot: 'afternoon', scheduled_start_time: '13:00:00', scheduled_end_time: '17:00:00' },
      { id: 903, work_date: `${year}-${monthText}-15`, time_slot: 'evening', scheduled_start_time: '18:00:00', scheduled_end_time: '21:00:00' },
    ],
  };
}
