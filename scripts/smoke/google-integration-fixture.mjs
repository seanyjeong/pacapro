// Browser-only synthetic fixture. Blocks every remote API request; no production authentication.
export function installGoogleFixture(version) {
  const user = { id: 1, academy_id: 7, email: 'owner@example.invalid', name: '합성 원장', role: 'owner', academy: { id: 7, name: '합성 교육원' }, permissions: {} };
  localStorage.setItem('token', 'synthetic-only'); localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('app_version', version); sessionStorage.setItem('version_reload_attempt', version);
  document.cookie = 'paca_auth=1; path=/';
  const state = { configured: true, worker_enabled: true, connected: true, email: 'calendar@example.invalid',
    last_error: null, last_synced_at: null,
    services: Object.fromEntries(['calendar', 'drive', 'sheets'].map(key => [key, { enabled: false, granted: true, implemented: key === 'calendar' }])) };
  window.__googleFixture = { state, hits: [], fail: false };
  function reply(method, input, data) {
    const path = new URL(input, location.origin).pathname.replace(/^\/paca/, '');
    window.__googleFixture.hits.push(`${method} ${path}`);
    if (path.startsWith('/google-integration')) {
      if (window.__googleFixture.fail) return [503, { error: '합성 오류' }];
      if (method === 'PUT') state.services[path.split('/').pop()].enabled = JSON.parse(data).enabled;
      if (method === 'DELETE') { state.connected = false; for (const s of Object.values(state.services)) s.enabled = false; }
      return [200, state];
    }
    if (path === '/auth/me') return [200, { user }];
    if (path.startsWith('/settings')) return [200, { settings: { academy_name: '합성 교육원', tuition_due_day: 5,
      salary_payment_day: 10, salary_month_type: 'next', morning_class_time: '09:00-12:00', afternoon_class_time: '-', evening_class_time: '-',
      exam_tuition: {}, adult_tuition: {}, season_fees: {} } }];
    return [200, { version, notifications: [], count: 0 }];
  }
  class FakeXHR extends EventTarget {
    upload = new EventTarget(); readyState = 0; responseType = ''; timeout = 0;
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    setRequestHeader() {} getAllResponseHeaders() { return 'content-type: application/json\r\n'; }
    getResponseHeader() { return 'application/json'; } abort() {}
    send(data) {
      setTimeout(() => {
        const [status, body] = reply(this.method, this.url, data);
        this.status = status; this.statusText = status === 200 ? 'OK' : 'Unavailable'; this.readyState = 4;
        this.responseURL = this.url; this.responseText = JSON.stringify(body); this.response = this.responseText;
        this.onreadystatechange?.(new Event('readystatechange')); this.onloadend?.(new Event('loadend'));
        this.dispatchEvent(new Event('loadend'));
      }, 10);
    }
  }
  window.XMLHttpRequest = FakeXHR;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if (url.origin === location.origin) return originalFetch(input, options);
    const [status, body] = reply(options.method || 'GET', url, options.body);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  };
}
