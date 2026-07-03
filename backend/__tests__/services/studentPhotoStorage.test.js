const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
    buildStudentPhotoKey,
    deleteStudentPhotoKeys,
    parseImageDataUrl,
    resolveStudentPhotoPath,
    saveStudentPhotos,
} = require('../../services/studentPhotoStorage');

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

describe('studentPhotoStorage', () => {
    let uploadRoot;

    beforeEach(async () => {
        uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'paca-photo-test-'));
        process.env.PACA_UPLOAD_ROOT = uploadRoot;
    });

    afterEach(async () => {
        delete process.env.PACA_UPLOAD_ROOT;
        await fs.rm(uploadRoot, { force: true, recursive: true });
    });

    test('data URL 이미지만 허용하고 MIME/Buffer를 분리한다', () => {
        const parsed = parseImageDataUrl(PNG_DATA_URL, { maxBytes: 1024 });

        expect(parsed.mimeType).toBe('image/png');
        expect(parsed.extension).toBe('png');
        expect(Buffer.isBuffer(parsed.buffer)).toBe(true);
        expect(parsed.buffer.length).toBeGreaterThan(0);
    });

    test('지원하지 않는 MIME과 용량 초과 이미지는 거절한다', () => {
        expect(() => parseImageDataUrl('data:text/plain;base64,SGVsbG8=', { maxBytes: 1024 }))
            .toThrow('지원하지 않는 이미지 형식입니다.');
        expect(() => parseImageDataUrl(PNG_DATA_URL, { maxBytes: 2 }))
            .toThrow('이미지 용량이 너무 큽니다.');
    });

    test('학생 사진 키는 academyId와 studentId로 격리된 경로만 만든다', () => {
        const key = buildStudentPhotoKey({ academyId: 2, studentId: 7, variant: 'thumb', extension: 'png' });

        expect(key).toBe('academies/2/students/7/profile-thumb.png');
        expect(resolveStudentPhotoPath(key).startsWith(uploadRoot)).toBe(true);
    });

    test('원본과 썸네일을 저장하고 기존 키 삭제는 멱등으로 처리한다', async () => {
        const saved = await saveStudentPhotos({
            academyId: 2,
            studentId: 7,
            originalDataUrl: PNG_DATA_URL,
            thumbnailDataUrl: PNG_DATA_URL,
        });

        expect(saved.originalKey).toBe('academies/2/students/7/profile-original.png');
        expect(saved.thumbKey).toBe('academies/2/students/7/profile-thumb.png');
        await expect(fs.stat(resolveStudentPhotoPath(saved.originalKey))).resolves.toBeTruthy();
        await expect(fs.stat(resolveStudentPhotoPath(saved.thumbKey))).resolves.toBeTruthy();

        await deleteStudentPhotoKeys([saved.originalKey, saved.thumbKey, saved.thumbKey, null]);

        await expect(fs.stat(resolveStudentPhotoPath(saved.originalKey))).rejects.toThrow();
        await expect(fs.stat(resolveStudentPhotoPath(saved.thumbKey))).rejects.toThrow();
    });
});
