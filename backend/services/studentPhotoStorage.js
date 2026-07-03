const fs = require('fs/promises');
const path = require('path');

const ORIGINAL_MAX_BYTES = 5 * 1024 * 1024;
const THUMBNAIL_MAX_BYTES = 512 * 1024;
const SUPPORTED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function makeUserError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function getUploadRoot() {
    return process.env.PACA_UPLOAD_ROOT || path.join(process.cwd(), 'uploads');
}

function parseImageDataUrl(dataUrl, options = {}) {
    if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
        throw makeUserError('이미지 데이터가 없습니다.');
    }

    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) {
        throw makeUserError('지원하지 않는 이미지 형식입니다.');
    }

    const mimeType = match[1].toLowerCase();
    const extension = SUPPORTED_IMAGE_TYPES[mimeType];
    if (!extension) {
        throw makeUserError('지원하지 않는 이미지 형식입니다.');
    }

    const base64 = match[2];
    if (base64.length % 4 !== 0) {
        throw makeUserError('이미지 데이터가 올바르지 않습니다.');
    }

    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = options.maxBytes || ORIGINAL_MAX_BYTES;
    if (buffer.length > maxBytes) {
        throw makeUserError('이미지 용량이 너무 큽니다.');
    }
    if (detectMimeType(buffer) !== mimeType) {
        throw makeUserError('이미지 데이터가 올바르지 않습니다.');
    }

    return { buffer, extension, mimeType };
}

function detectMimeType(buffer) {
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (
        buffer.length >= 8
        && buffer[0] === 0x89
        && buffer[1] === 0x50
        && buffer[2] === 0x4e
        && buffer[3] === 0x47
        && buffer[4] === 0x0d
        && buffer[5] === 0x0a
        && buffer[6] === 0x1a
        && buffer[7] === 0x0a
    ) {
        return 'image/png';
    }
    if (
        buffer.length >= 12
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'image/webp';
    }
    return null;
}

function assertPositiveInteger(value, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw makeUserError(`${label} 값이 올바르지 않습니다.`);
    }
    return parsed;
}

function buildStudentPhotoKey({ academyId, studentId, variant, extension }) {
    const safeAcademyId = assertPositiveInteger(academyId, 'academyId');
    const safeStudentId = assertPositiveInteger(studentId, 'studentId');
    if (!['original', 'thumb'].includes(variant)) {
        throw makeUserError('사진 종류가 올바르지 않습니다.');
    }
    if (!['jpg', 'png', 'webp'].includes(extension)) {
        throw makeUserError('이미지 확장자가 올바르지 않습니다.');
    }

    return `academies/${safeAcademyId}/students/${safeStudentId}/profile-${variant}.${extension}`;
}

function resolveStudentPhotoPath(key) {
    if (typeof key !== 'string' || key.includes('\0') || path.isAbsolute(key)) {
        throw makeUserError('사진 경로가 올바르지 않습니다.');
    }

    const root = path.resolve(getUploadRoot());
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
        throw makeUserError('사진 경로가 올바르지 않습니다.');
    }
    return target;
}

async function writePhotoFile(key, buffer) {
    const filePath = resolveStudentPhotoPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
}

async function saveStudentPhotos({ academyId, studentId, originalDataUrl, thumbnailDataUrl }) {
    const original = parseImageDataUrl(originalDataUrl, { maxBytes: ORIGINAL_MAX_BYTES });
    const thumbnail = parseImageDataUrl(thumbnailDataUrl, { maxBytes: THUMBNAIL_MAX_BYTES });
    const originalKey = buildStudentPhotoKey({
        academyId,
        studentId,
        variant: 'original',
        extension: original.extension,
    });
    const thumbKey = buildStudentPhotoKey({
        academyId,
        studentId,
        variant: 'thumb',
        extension: thumbnail.extension,
    });

    await writePhotoFile(originalKey, original.buffer);
    await writePhotoFile(thumbKey, thumbnail.buffer);

    return {
        originalKey,
        originalMimeType: original.mimeType,
        thumbKey,
        thumbMimeType: thumbnail.mimeType,
    };
}

async function deleteStudentPhotoKeys(keys) {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    await Promise.all(uniqueKeys.map(async (key) => {
        try {
            await fs.unlink(resolveStudentPhotoPath(key));
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }));
}

module.exports = {
    ORIGINAL_MAX_BYTES,
    THUMBNAIL_MAX_BYTES,
    buildStudentPhotoKey,
    deleteStudentPhotoKeys,
    parseImageDataUrl,
    resolveStudentPhotoPath,
    saveStudentPhotos,
};
