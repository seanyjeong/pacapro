const DEFAULT_POLICY = {
  attendanceDays: 14,
  recordSampleSize: 5,
  minProblemRecordTypes: 2,
  consecutiveAbsenceThreshold: 2,
  plateauRatio: 0.02,
  plateauAbsolute: 0.5,
  standingLongJumpAvgThresholds: { male: 250, female: 200 },
  excusedKeywords: ['병원', '부상', '대회', '학교', '시험', '공결', '사전', '가족'],
};

function buildConsultationCandidates(input) {
  const policy = { ...DEFAULT_POLICY, ...(input.policy || {}) };
  const today = parseIsoDate(input.today) || todayKst();
  const attendanceDays = clampInt(input.attendanceDays, 1, 60, policy.attendanceDays);
  const limit = clampInt(input.limit, 1, 50, 10);
  const activeStudents = (input.students || []).filter((student) => student.status === 'active');
  const peakByPacaId = new Map((input.peakStudents || []).map((student) => [Number(student.paca_student_id), student]));
  const attendanceByStudent = groupBy(input.attendanceRows || [], (row) => Number(row.student_id));
  const recordsByPeakStudent = groupBy(input.recordRows || [], (row) => Number(row.peak_student_id || row.student_id));
  const candidates = [];

  for (const student of activeStudents) {
    const pacaStudentId = Number(student.id);
    const peakStudent = peakByPacaId.get(pacaStudentId);
    const attendanceSignals = analyzeAttendance(attendanceByStudent.get(pacaStudentId) || [], policy);
    const recordSignals = analyzeRecords(
      peakStudent ? recordsByPeakStudent.get(Number(peakStudent.id)) || [] : [],
      policy,
    );
    const candidate = buildCandidate(student, peakStudent, attendanceSignals, recordSignals, today, attendanceDays, policy);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort(compareCandidates);
  return {
    period: {
      end_date: formatDate(today),
      attendance_start_date: formatDate(addDays(today, -attendanceDays + 1)),
      attendance_days: attendanceDays,
      record_sample_size: policy.recordSampleSize,
    },
    policy: {
      consecutive_absence_threshold: policy.consecutiveAbsenceThreshold,
      min_problem_record_types: policy.minProblemRecordTypes,
    },
    candidates: candidates.slice(0, limit),
  };
}

function compareCandidates(a, b) {
  return b.score - a.score
    || b.signals.attendance.max_consecutive_absences - a.signals.attendance.max_consecutive_absences
    || b.signals.attendance.unexcused_absences - a.signals.attendance.unexcused_absences
    || b.signals.records.problem_count - a.signals.records.problem_count
    || b.signals.records.declining_count - a.signals.records.declining_count
    || a.student.name.localeCompare(b.student.name, 'ko');
}

function analyzeAttendance(rows, policy = DEFAULT_POLICY) {
  const sorted = [...rows].sort(compareAttendanceRows);
  let consecutiveAbsences = 0;
  let maxConsecutiveAbsences = 0;
  let unexcusedAbsences = 0;
  const recentAbsences = [];
  const summary = { present: 0, late: 0, absent: 0, excused: 0, unchecked: 0 };

  for (const row of sorted) {
    const status = normalizeAttendanceStatus(row.attendance_status);
    summary[status] = (summary[status] || 0) + 1;
    if (status === 'absent') {
      consecutiveAbsences += 1;
      maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
      const excused = isExcusedAbsence(row, policy.excusedKeywords);
      if (!excused) unexcusedAbsences += 1;
      recentAbsences.push({
        date: toDateText(row.class_date || row.date),
        time_slot: row.time_slot || '',
        notes: row.notes || '',
        excused,
      });
    } else if (status !== 'unchecked') {
      consecutiveAbsences = 0;
    }
  }

  return {
    summary,
    max_consecutive_absences: maxConsecutiveAbsences,
    unexcused_absences: unexcusedAbsences,
    recent_absences: recentAbsences.slice(-5),
  };
}

function analyzeRecords(rows, policy = DEFAULT_POLICY) {
  const grouped = groupBy(rows || [], recordGroupKey);
  const problemRecords = [];
  const recentRecords = [];

  for (const records of grouped.values()) {
    const trend = analyzeRecordTrend(records, policy);
    if (trend) recentRecords.push(trend);
    if (trend && ['declining', 'plateau'].includes(trend.trend)) {
      problemRecords.push(trend);
    }
  }

  problemRecords.sort((a, b) => trendPriority(b.trend) - trendPriority(a.trend));
  return {
    recent_records: recentRecords,
    problem_count: problemRecords.length,
    declining_count: problemRecords.filter((item) => item.trend === 'declining').length,
    plateau_count: problemRecords.filter((item) => item.trend === 'plateau').length,
    problem_records: problemRecords,
  };
}

function analyzeRecordTrend(records, policy = DEFAULT_POLICY) {
  const samples = [...records]
    .map(normalizeRecordSample)
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at) || b.id - a.id)
    .slice(0, policy.recordSampleSize);
  if (samples.length < policy.recordSampleSize) return null;

  const chronological = [...samples].reverse();
  const direction = samples[0].direction === 'lower' ? 'lower' : 'higher';
  let worseSteps = 0;
  for (let index = 1; index < chronological.length; index += 1) {
    if (isWorse(chronological[index].value, chronological[index - 1].value, direction)) {
      worseSteps += 1;
    }
  }

  const oldest = chronological[0].value;
  const latest = chronological[chronological.length - 1].value;
  const improved = improvementAmount(latest, oldest, direction);
  const range = Math.max(...samples.map((sample) => sample.value)) - Math.min(...samples.map((sample) => sample.value));
  const base = Math.max(1, Math.abs(oldest));
  const plateauBand = Math.max(policy.plateauAbsolute, base * policy.plateauRatio);
  const trend = worseSteps >= 3 || improved < -plateauBand
    ? 'declining'
    : Math.abs(improved) <= plateauBand && range <= plateauBand
      ? 'plateau'
      : 'stable';

  return {
    record_type_id: samples[0].record_type_id,
    event_name: samples[0].record_type_name,
    direction,
    trend,
    latest,
    oldest,
    average: roundMetric(samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length),
    unit: samples[0].unit || '',
    samples: chronological.map((sample) => ({
      measured_at: sample.measured_at,
      value: sample.value,
    })),
  };
}

function buildCandidate(student, peakStudent, attendanceSignals, recordSignals, today, attendanceDays, policy) {
  const reasons = [];
  let score = 0;
  const lowStandingLongJump = standingLongJumpSignal(student, recordSignals, policy);

  if (attendanceSignals.max_consecutive_absences >= policy.consecutiveAbsenceThreshold) {
    score += 45;
    reasons.push(`최근 ${attendanceDays}일 안에 연속 결석 ${attendanceSignals.max_consecutive_absences}회`);
  }
  if (attendanceSignals.unexcused_absences > 0) {
    score += attendanceSignals.unexcused_absences * 12;
    reasons.push(`사유 미확인 결석 ${attendanceSignals.unexcused_absences}회`);
  }
  if (recordSignals.problem_count >= policy.minProblemRecordTypes) {
    score += 35 + (recordSignals.declining_count * 8);
    reasons.push(`최근 5개 기록 기준 하락/정체 종목 ${recordSignals.problem_count}개`);
  }
  if (lowStandingLongJump) {
    score += 40;
    reasons.push(lowStandingLongJump.reason);
  }

  if (score <= 0) return null;
  return {
    student: {
      paca_student_id: Number(student.id),
      peak_student_id: peakStudent ? Number(peakStudent.id) : null,
      name: student.name || '',
      school: student.school || '',
      grade: student.grade || '',
      gender: student.gender || null,
    },
    priority: score >= 80 ? 'high' : score >= 45 ? 'medium' : 'low',
    score,
    reasons,
    signals: {
      attendance: attendanceSignals,
      records: recordSignals,
      absolute_performance: {
        low_standing_long_jump: lowStandingLongJump,
      },
    },
    suggested_action: suggestedAction(attendanceSignals, recordSignals, policy),
    generated_at: formatDate(today),
  };
}

function standingLongJumpSignal(student, recordSignals, policy) {
  const gender = String(student.gender || '').trim().toLowerCase();
  const threshold = policy.standingLongJumpAvgThresholds[gender];
  if (!threshold) return null;
  const record = (recordSignals.recent_records || []).find((item) => item.event_name === '제자리멀리뛰기');
  if (!record || !Number.isFinite(record.average) || record.average > threshold) return null;
  const genderLabel = gender === 'female' ? '여자' : '남자';
  return {
    event_name: record.event_name,
    average: record.average,
    threshold,
    unit: record.unit || 'cm',
    sample_count: record.samples.length,
    reason: `제자리멀리뛰기 최근 ${record.samples.length}개 평균 ${formatMetric(record.average)}${record.unit || 'cm'} (${genderLabel} 기준 ${threshold}cm 이하)`,
  };
}

function suggestedAction(attendanceSignals, recordSignals, policy) {
  if (attendanceSignals.unexcused_absences > 0) {
    return '결석 사유와 다음 등원 가능일을 먼저 확인';
  }
  if (recordSignals.problem_count >= policy.minProblemRecordTypes) {
    return '최근 기록이 막힌 종목의 훈련 방향을 점검';
  }
  return '출결과 기록을 같이 확인';
}

function normalizeRecordSample(row) {
  return {
    id: Number(row.id || 0),
    peak_student_id: Number(row.peak_student_id || row.student_id || 0),
    record_type_id: Number(row.record_type_id || 0),
    record_type_name: String(row.record_type_name || row.name || ''),
    direction: String(row.direction || 'higher'),
    unit: String(row.unit || ''),
    measured_at: toDateText(row.measured_at),
    value: Number(row.value),
  };
}

function normalizeAttendanceStatus(value) {
  if (value === 'present' || value === 'late' || value === 'absent' || value === 'excused') return value;
  return 'unchecked';
}

function isExcusedAbsence(row, keywords) {
  if (normalizeAttendanceStatus(row.attendance_status) === 'excused') return true;
  const notes = String(row.notes || '').trim();
  if (!notes) return false;
  return keywords.some((keyword) => notes.includes(keyword));
}

function compareAttendanceRows(a, b) {
  const left = `${toDateText(a.class_date || a.date)} ${a.time_slot || ''}`;
  const right = `${toDateText(b.class_date || b.date)} ${b.time_slot || ''}`;
  return left.localeCompare(right);
}

function recordGroupKey(row) {
  return `${row.peak_student_id || row.student_id}:${row.record_type_id}:${row.record_type_name || row.name || ''}`;
}

function groupBy(rows, getKey) {
  const map = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key && key !== 0) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function isWorse(current, previous, direction) {
  return direction === 'lower' ? current > previous : current < previous;
}

function improvementAmount(latest, oldest, direction) {
  return direction === 'lower' ? oldest - latest : latest - oldest;
}

function trendPriority(trend) {
  return trend === 'declining' ? 2 : trend === 'plateau' ? 1 : 0;
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}

function formatMetric(value) {
  return Number.isInteger(value) ? String(value) : String(roundMetric(value));
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  return new Date(`${value}T00:00:00+09:00`);
}

function todayKst() {
  return parseIsoDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()));
}

function formatDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateText(value) {
  if (!value) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).slice(0, 10);
}

function addDays(value, days) {
  const copy = new Date(value.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = {
  DEFAULT_POLICY,
  analyzeAttendance,
  analyzeRecordTrend,
  analyzeRecords,
  buildConsultationCandidates,
};
