/* Embedded by build-standalone.py. No credentials or applicant data are stored on the tablet. */
(() => {
  'use strict';
  const config = window.ILSAN_ADMISSION_CONFIG;
  const form = document.querySelector('form');
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('connection-status');
  const retry = document.getElementById('connection-retry');
  const success = document.getElementById('admission-success');
  const error = document.getElementById('admission-error');
  const inputs = [...form.querySelectorAll('input,select,textarea')];
  const date = document.getElementById('admission-date');
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date());
  let available = false, busy = false, submission = {body:'',key:''};
  date.min = today();
  const value = id => document.getElementById(id).value.trim();
  const selected = name => form.querySelector(`select[aria-label="${name}"]`).value;
  const fields = () => ({
    name:value('admission-name'), school:value('admission-school'), grade:selected('학년'), gender:selected('성별'),
    birth_six:value('admission-birth'), phone:value('admission-phone'), father_name:value('admission-father-name'),
    father_phone:value('admission-father-phone'), mother_name:value('admission-mother-name'),
    mother_phone:value('admission-mother-phone'), primary_parent:selected('학원 안내를 받을 보호자'),
    enrollment_date:value('admission-date'), consent:form.querySelector('input[type="checkbox"]').checked,
  });
  function uuid() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${config.apiBase}${path}`, {...options, mode:'cors', credentials:'omit',
        cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body.message === 'string' ? body.message
        : '접수 기능이 아직 열리지 않았거나 서버에 연결할 수 없습니다. 담당자에게 확인해 주세요.');
      return body;
    } catch (cause) {
      if (cause.name === 'AbortError' || cause instanceof TypeError) {
        throw new Error('접수 서버에 연결할 수 없습니다. 인터넷과 운영 연결 상태를 확인한 뒤 다시 시도해 주세요.');
      }
      throw cause;
    } finally { clearTimeout(timeout); }
  }
  function lock(locked) {
    busy = locked;
    inputs.forEach(input => {input.disabled = locked;});
    submit.disabled = locked || !available;
    submit.textContent = locked ? '접수 결과를 확인하고 있습니다…' : '입학원서 제출';
    retry.disabled = locked;
  }
  async function checkConnection() {
    if (busy) return;
    available = false; submit.disabled = true; retry.disabled = true;
    status.textContent = '일산 교육원 접수 연결을 확인하고 있습니다…';
    try {
      const result = await request('/availability');
      if (result?.available !== true || result.academy_name !== config.academyName) throw new Error('일산 교육원 연결을 확인하지 못했습니다. 담당자에게 확인해 주세요.');
      available = true;
      status.textContent = '일산 교육원 접수 연결됨 · 제출 후 담당자가 등록일과 학원비를 확정합니다.';
    } catch(cause) { status.textContent = `${cause.message} 현재는 원서가 저장되지 않습니다.`; }
    finally { submit.disabled = !available; retry.disabled = false; }
  }
  retry.addEventListener('click', () => { void checkConnection(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !available || !form.reportValidity()) return;
    error.textContent = '';
    const profile = fields();
    if (!profile.father_phone && !profile.mother_phone) {error.textContent = '보호자 전화번호를 한 분 이상 입력해 주세요.';return;}
    if (!profile[`${profile.primary_parent}_phone`]) {error.textContent = '안내를 받을 보호자 번호를 입력하거나 보호자를 변경해 주세요.';return;}
    const body = JSON.stringify(profile);
    if (submission.body !== body) submission = {body,key:uuid()};
    lock(true);
    try {
      const result = await request('/submit', {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':submission.key},body});
      if (result?.received !== true || result.receipt !== submission.key) throw new Error('접수 결과가 확인되지 않았습니다. 입력 내용을 유지한 채 다시 제출해 주세요.');
      document.getElementById('admission-receipt').textContent = `접수번호 ${result.receipt}`;
      form.reset(); inputs.forEach(input => {if(input.tagName === 'INPUT' && input.type !== 'checkbox') input.value = '';});
      submission = {body:'',key:''}; form.hidden = true; success.hidden = false; success.focus();
    } catch(cause) {error.textContent = `${cause.message} 완료 안내가 나오기 전에는 접수 여부가 확정되지 않습니다. 재시도 시 같은 접수번호로 확인합니다.`;}
    finally {lock(false);}
  });
  document.getElementById('admission-next').addEventListener('click', () => {
    error.textContent = ''; document.getElementById('admission-receipt').textContent = '';
    success.hidden = true; form.hidden = false; date.min = today();
    document.getElementById('admission-name').focus(); void checkConnection();
  });
  window.addEventListener('pageshow', event => {if(event.persisted){form.reset();submission={body:'',key:''};void checkConnection();}});
  void checkConnection();
})();
