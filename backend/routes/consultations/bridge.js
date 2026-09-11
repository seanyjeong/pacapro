const { ConsultationBridgeRepository } = require('../../repositories/consultationBridgeRepository');
const { ConsultationBridgeService, ConsultationBridgeError } = require('../../services/consultationBridgeService');

function registerConsultationBridge(router, { pool, verifyToken, decryptConsultationNames }) {
    const service = new ConsultationBridgeService(new ConsultationBridgeRepository(pool, decryptConsultationNames));
    router.get('/bridge-capabilities', verifyToken, (_req, res) => res.json({ success: true, commandCas: true }));
    for (const method of ['put', 'delete']) router[method]('/:id', verifyToken, async (req, res, next) => {
        const hash = req.headers['x-academy-bridge-before-hash'];
        if (hash === undefined) return next();
        try {
            await service.change(req.user.academy_id, req.params.id, hash, req.body, method === 'delete');
            res.json({ success: true });
        } catch (error) {
            const known = error instanceof ConsultationBridgeError;
            res.status(known ? error.status : 500).json({ error: known ? error.message : 'consultation_change_failed' });
        }
    });
}

module.exports = { registerConsultationBridge };
