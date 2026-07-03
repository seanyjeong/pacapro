const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
}));

jest.mock('../../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

const pool = require('../../../config/database');
const { resolveStudentPhotoPath, saveStudentPhotos } = require('../../../services/studentPhotoStorage');

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function makeApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    const router = express.Router();
    require('../../../routes/students/photo')(router);
    app.use('/paca/students', router);
    return app;
}

describe('students photo routes', () => {
    let uploadRoot;

    beforeEach(async () => {
        uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'paca-photo-route-test-'));
        process.env.PACA_UPLOAD_ROOT = uploadRoot;
        pool.execute.mockReset();
    });

    afterEach(async () => {
        delete process.env.PACA_UPLOAD_ROOT;
        await fs.rm(uploadRoot, { force: true, recursive: true });
    });

    test('POST /paca/students/:id/photo 는 academyId 격리 후 원본/썸네일을 저장한다', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 7,
                academy_id: 1,
                profile_image_key: null,
                profile_thumb_key: null,
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .post('/paca/students/7/photo')
            .send({ original_data_url: PNG_DATA_URL, thumbnail_data_url: PNG_DATA_URL });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: '학생 사진이 저장되었습니다.',
            photo: {
                profile_image_key: 'academies/1/students/7/profile-original.png',
                profile_image_mime_type: 'image/png',
                profile_image_url: '/students/7/photo/thumb',
                profile_thumb_key: 'academies/1/students/7/profile-thumb.png',
                profile_thumb_mime_type: 'image/png',
            },
        });
        expect(pool.execute.mock.calls[0][0]).toMatch(/WHERE id = \?\s+AND academy_id = \?/);
        expect(pool.execute.mock.calls[0][1]).toEqual([7, 1]);
        await expect(fs.stat(resolveStudentPhotoPath(res.body.photo.profile_thumb_key))).resolves.toBeTruthy();
    });

    test('GET /paca/students/:id/photo/thumb 는 다른 학원 학생을 찾지 못하면 404를 반환한다', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const res = await request(makeApp()).get('/paca/students/99/photo/thumb');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
            error: 'Not Found',
            message: '학생 사진을 찾을 수 없습니다.',
        });
        expect(pool.execute.mock.calls[0][0]).toMatch(/academy_id = \?/);
        expect(pool.execute.mock.calls[0][1]).toEqual([99, 1]);
    });

    test('GET /paca/students/:id/photo/thumb 는 인증된 학원의 썸네일 파일을 반환한다', async () => {
        const saved = await saveStudentPhotos({
            academyId: 1,
            studentId: 7,
            originalDataUrl: PNG_DATA_URL,
            thumbnailDataUrl: PNG_DATA_URL,
        });
        pool.execute.mockResolvedValueOnce([[{
            id: 7,
            profile_image_key: saved.originalKey,
            profile_thumb_key: saved.thumbKey,
            profile_image_mime_type: saved.originalMimeType,
            profile_thumb_mime_type: saved.thumbMimeType,
        }]]);

        const res = await request(makeApp()).get('/paca/students/7/photo/thumb');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/image\/png/);
        expect(res.headers['cache-control']).toBe('private, max-age=60');
    });

    test('DELETE /paca/students/:id/photo 는 DB 키를 비우고 저장 파일을 삭제한다', async () => {
        const saved = await saveStudentPhotos({
            academyId: 1,
            studentId: 7,
            originalDataUrl: PNG_DATA_URL,
            thumbnailDataUrl: PNG_DATA_URL,
        });
        pool.execute
            .mockResolvedValueOnce([[{
                id: 7,
                profile_image_key: saved.originalKey,
                profile_thumb_key: saved.thumbKey,
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp()).delete('/paca/students/7/photo');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: '학생 사진이 삭제되었습니다.' });
        const updateCall = pool.execute.mock.calls.find(([sql]) => /UPDATE students/.test(sql));
        expect(updateCall[0]).toMatch(/profile_image_key = NULL/);
        await expect(fs.stat(resolveStudentPhotoPath(saved.originalKey))).rejects.toThrow();
        await expect(fs.stat(resolveStudentPhotoPath(saved.thumbKey))).rejects.toThrow();
    });
});
