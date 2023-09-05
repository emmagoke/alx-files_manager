import { Router } from 'express';
import AppController from '../controllers/AppController';
import UserController from '../controllers/UsersController';

const router = Router();

router.route('/status').get(AppController.getStatus);
router.route('/stats').get(AppController.getStats);
router.route('/users').post(UserController.postNew);
// router.post('/users', UserController.postNew);

export default router;
