import { Router } from 'express';
import { createSession, listSessions } from '../controllers/sessionController.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', listSessions);
router.post('/', createSession);
export default router;
