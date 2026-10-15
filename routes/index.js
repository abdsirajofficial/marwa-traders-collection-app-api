import express from 'express';
import v1Routes from './v1/index.js';

const router = express.Router();

// Mount API V1 routes
router.use('/v1', v1Routes);

// For backwards compatibility with existing clients calling /api/... directly:
router.use('/', v1Routes);

export default router;
