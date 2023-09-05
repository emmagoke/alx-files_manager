import { Router } from 'express';
import AppController from '../controllers/AppController';

const router = Router();

router.route('/status').get(AppController.getStatus);
router.route('/stats').get(AppController.getStats);

export default router;
