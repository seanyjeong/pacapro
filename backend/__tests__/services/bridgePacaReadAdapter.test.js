const http = require('http');
const { afterEach, describe, expect, test } = require('@jest/globals');
const {
    createPacaBridgeReadHandler,
    isLoopbackAddress,
    loadPacaTenants,
} = require('../../services/bridgePacaReadAdapter');

const adapterKey = 'paca-bridge-ilsan-test-key-at-least-32-bytes';
const adapterPath = '/v1/paca/ilsan/summary';
const ilsanAcademyId = loadPacaTenants({ PACA_BRIDGE_ILSAN_READ_KEY: adapterKey }).ilsan.academyId;
let server;

async function startHandler({ db, env = {}, remoteAddress } = {}) {
    const handler = createPacaBridgeReadHandler({
        db,
        env: { PACA_BRIDGE_ILSAN_READ_KEY: adapterKey, ...env },
        logger: { info: jest.fn(), error: jest.fn() },
    });
    server = http.createServer((req, res) => {
        if (remoteAddress) Object.defineProperty(req.socket, 'remoteAddress', { value: remoteAddress });
        handler(req, res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    server = undefined;
});

describe('Paca Bridge Ilsan read adapter', () => {
    test('recognizes loopback forms only', () => {
        expect(isLoopbackAddress('127.0.0.1')).toBe(true);
        expect(isLoopbackAddress('::1')).toBe(true);
        expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
        expect(isLoopbackAddress('10.0.0.4')).toBe(false);
    });

    test('returns only allowlisted aggregate DTOs for the fixed Ilsan academy', async () => {
        const db = {
            execute: jest.fn()
                .mockResolvedValueOnce([[{ status: 'active', count: 3 }, { status: 'paused', count: 1 }]])
                .mockResolvedValueOnce([[{ attendance_status: 'present', count: 8 }]]),
        };
        const base = await startHandler({ db });
        const response = await fetch(`${base}${adapterPath}`, {
            headers: { 'x-academy-bridge-adapter-key': adapterKey },
        });

        expect(response.status).toBe(200);
        const raw = await response.text();
        expect(JSON.parse(raw)).toEqual({
            ok: true,
            source: 'paca',
            academy: 'ilsan',
            readOnly: true,
            dto: {
                students: { total: 4, byStatus: { active: 3, paused: 1 } },
                attendanceCurrentMonth: { byStatus: { present: 8 } },
            },
        });
        expect(db.execute).toHaveBeenCalledTimes(2);
        expect(db.execute.mock.calls[0][1]).toEqual([ilsanAcademyId]);
        expect(db.execute.mock.calls[1][1]).toEqual([ilsanAcademyId]);
        expect(raw).not.toContain('student_id');
    });

    test('rejects missing service credential and never queries data', async () => {
        const db = { execute: jest.fn() };
        const base = await startHandler({ db });
        const response = await fetch(`${base}${adapterPath}`);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ ok: false, error: 'invalid_service_credential' });
        expect(db.execute).not.toHaveBeenCalled();
    });

    test('rejects writes, unallowlisted paths, and non-loopback callers', async () => {
        const db = { execute: jest.fn() };
        const base = await startHandler({ db, remoteAddress: '10.0.0.4' });
        const external = await fetch(`${base}${adapterPath}`, {
            headers: { 'x-academy-bridge-adapter-key': adapterKey },
        });
        expect(external.status).toBe(403);
        expect(db.execute).not.toHaveBeenCalled();

        await new Promise((resolve) => server.close(resolve));
        server = undefined;
        const localBase = await startHandler({ db });
        const write = await fetch(`${localBase}${adapterPath}`, {
            method: 'POST',
            headers: { 'x-academy-bridge-adapter-key': adapterKey },
        });
        expect(write.status).toBe(405);
        const invalidPath = await fetch(`${localBase}/v1/paca/ilsan/unapproved`, {
            headers: { 'x-academy-bridge-adapter-key': adapterKey },
        });
        expect(invalidPath.status).toBe(404);
        expect(db.execute).not.toHaveBeenCalled();
    });
});
