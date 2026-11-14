// supertest 는 시험 서버를 app.listen(0)(모든 주소, 이 맥에선 IPv6 '::')으로 띄우고
// http://127.0.0.1:<포트> 로 요청한다. 127.0.0.1 에 같은 포트 번호를 잡은 다른 프로그램이 있으면 요청이
// 그쪽으로 가서 401 같은 엉뚱한 응답이 가끔 섞였다. 서버가 IPv6 로 떴으면 같은 주소 체계(::1)로 요청한다.
const { Server: HttpsServer } = require('https');
const Test = require('supertest/lib/test');

Test.prototype.serverAddress = function serverAddress(app, path) {
    if (!app.address()) this._server = app.listen(0);
    const { port, family } = app.address();
    const protocol = app instanceof HttpsServer ? 'https' : 'http';
    const host = family === 'IPv6' ? '[::1]' : '127.0.0.1';
    return `${protocol}://${host}:${port}${path}`;
};
