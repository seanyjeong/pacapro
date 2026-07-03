const {
    deleteStudentPhotoKeys,
    resolveStudentPhotoPath,
    saveStudentPhotos,
} = require('../../services/studentPhotoStorage');
const pool = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const STUDENT_PHOTO_COLUMNS = `
    SELECT
        id,
        academy_id,
        profile_image_key,
        profile_thumb_key,
        profile_image_mime_type,
        profile_thumb_mime_type
    FROM students
    WHERE id = ?
    AND academy_id = ?
    AND deleted_at IS NULL
`;

module.exports = function(router) {
    router.post('/:id/photo', verifyToken, async (req, res) => {
        const studentId = parseStudentId(req.params.id, res);
        if (!studentId) return;

        try {
            const student = await findStudentPhotoRow(studentId, req.user.academyId);
            if (!student) return sendPhotoNotFound(res);

            const saved = await saveStudentPhotos({
                academyId: req.user.academyId,
                studentId,
                originalDataUrl: req.body?.original_data_url,
                thumbnailDataUrl: req.body?.thumbnail_data_url,
            });

            try {
                await pool.execute(
                    `UPDATE students
                     SET profile_image_url = ?,
                         profile_image_key = ?,
                         profile_thumb_key = ?,
                         profile_image_mime_type = ?,
                         profile_thumb_mime_type = ?,
                         profile_image_updated_at = NOW(),
                         updated_at = NOW()
                     WHERE id = ?
                     AND academy_id = ?`,
                    [
                        `/students/${studentId}/photo/thumb`,
                        saved.originalKey,
                        saved.thumbKey,
                        saved.originalMimeType,
                        saved.thumbMimeType,
                        studentId,
                        req.user.academyId,
                    ]
                );
            } catch (error) {
                await deleteStudentPhotoKeys([saved.originalKey, saved.thumbKey]);
                throw error;
            }

            await deleteStudentPhotoKeys(getReplacedPhotoKeys(student, saved));

            res.json({
                message: '학생 사진이 저장되었습니다.',
                photo: {
                    profile_image_key: saved.originalKey,
                    profile_image_mime_type: saved.originalMimeType,
                    profile_image_url: `/students/${studentId}/photo/thumb`,
                    profile_thumb_key: saved.thumbKey,
                    profile_thumb_mime_type: saved.thumbMimeType,
                },
            });
        } catch (error) {
            handlePhotoError(res, error, '학생 사진을 저장하지 못했습니다.');
        }
    });

    router.get('/:id/photo/:variant', verifyToken, async (req, res) => {
        const studentId = parseStudentId(req.params.id, res);
        if (!studentId) return;
        if (!['thumb', 'original'].includes(req.params.variant)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '사진 종류가 올바르지 않습니다.',
            });
        }

        try {
            const student = await findStudentPhotoRow(studentId, req.user.academyId);
            if (!student) return sendPhotoNotFound(res);

            const isThumb = req.params.variant === 'thumb';
            const key = isThumb ? student.profile_thumb_key : student.profile_image_key;
            const mimeType = isThumb ? student.profile_thumb_mime_type : student.profile_image_mime_type;
            if (!key) return sendPhotoNotFound(res);

            res.set('Cache-Control', 'private, max-age=60');
            res.type(mimeType || 'application/octet-stream');
            res.sendFile(resolveStudentPhotoPath(key), (error) => {
                if (!error) return;
                logger.warn('Student photo file not found', { error: error.message, key, studentId });
                if (!res.headersSent) sendPhotoNotFound(res);
            });
        } catch (error) {
            handlePhotoError(res, error, '학생 사진을 불러오지 못했습니다.');
        }
    });

    router.delete('/:id/photo', verifyToken, async (req, res) => {
        const studentId = parseStudentId(req.params.id, res);
        if (!studentId) return;

        try {
            const student = await findStudentPhotoRow(studentId, req.user.academyId);
            if (!student) return sendPhotoNotFound(res);

            await deleteStudentPhotoKeys([student.profile_image_key, student.profile_thumb_key]);
            await pool.execute(
                `UPDATE students
                 SET profile_image_url = NULL,
                     profile_image_key = NULL,
                     profile_thumb_key = NULL,
                     profile_image_mime_type = NULL,
                     profile_thumb_mime_type = NULL,
                     profile_image_updated_at = NULL,
                     updated_at = NOW()
                 WHERE id = ?
                 AND academy_id = ?`,
                [studentId, req.user.academyId]
            );

            res.json({ message: '학생 사진이 삭제되었습니다.' });
        } catch (error) {
            handlePhotoError(res, error, '학생 사진을 삭제하지 못했습니다.');
        }
    });
};

function getReplacedPhotoKeys(student, saved) {
    const currentKeys = new Set([saved.originalKey, saved.thumbKey]);
    return [student.profile_image_key, student.profile_thumb_key].filter((key) => key && !currentKeys.has(key));
}

function parseStudentId(rawId, res) {
    const studentId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(studentId) || studentId <= 0) {
        res.status(400).json({
            error: 'Validation Error',
            message: '학생 ID가 올바르지 않습니다.',
        });
        return null;
    }
    return studentId;
}

async function findStudentPhotoRow(studentId, academyId) {
    const [students] = await pool.execute(STUDENT_PHOTO_COLUMNS, [studentId, academyId]);
    return students[0] || null;
}

function sendPhotoNotFound(res) {
    return res.status(404).json({
        error: 'Not Found',
        message: '학생 사진을 찾을 수 없습니다.',
    });
}

function handlePhotoError(res, error, fallbackMessage) {
    if (error.statusCode === 400) {
        return res.status(400).json({
            error: 'Validation Error',
            message: error.message,
        });
    }

    logger.error(fallbackMessage, error);
    return res.status(500).json({
        error: 'Server Error',
        message: fallbackMessage,
    });
}
