/** Run Express routing and JSON over HTTP message objects without opening a socket. */
const { IncomingMessage, ServerResponse } = require('node:http');
const { Duplex } = require('node:stream');

function sendJson(app, method, url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
        socket.remoteAddress = '127.0.0.1';
        const payload = Buffer.from(JSON.stringify(body));
        const req = new IncomingMessage(socket);
        req.method = method; req.url = url; req.httpVersion = '1.1';
        req.httpVersionMajor = 1; req.httpVersionMinor = 1;
        req.headers = { 'content-type': 'application/json', 'content-length': String(payload.length), connection: 'close', ...headers };
        req._read = () => {};
        const res = new ServerResponse(req);
        res.assignSocket(socket);
        const timer = setTimeout(() => reject(new Error('Express handler did not finish')), 3000);
        res.once('error', reject);
        res.once('finish', () => {
            clearTimeout(timer);
            const raw = Buffer.concat(chunks).toString('utf8');
            const text = raw.slice(raw.indexOf('\r\n\r\n') + 4);
            let value;
            try { value = JSON.parse(text); } catch { value = text; }
            resolve({ status: res.statusCode, statusCode: res.statusCode, headers: res.getHeaders(), body: value });
            res.detachSocket(socket); socket.destroy();
        });
        // An actual HTTP parser marks a fully received request complete before ending it.
        req.complete = true;
        req.push(payload); req.push(null);
        app.handle(req, res, error => {
            if (error) { clearTimeout(timer); reject(error); }
        });
    });
}

function requestWithoutSocket(app) {
    return Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map(method => [method,
        url => ({ send: body => sendJson(app, method.toUpperCase(), url, body),
            then: (resolve, reject) => sendJson(app, method.toUpperCase(), url, {}).then(resolve, reject) })]));
}

module.exports = { sendJson, requestWithoutSocket };
