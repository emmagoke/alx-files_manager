import { Router } from 'express';
import AppController from '../controllers/AppController';
import UserController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = Router();

router.route('/status').get(AppController.getStatus);
router.route('/stats').get(AppController.getStats);
router.route('/users').post(UserController.postNew);
router.route('/connect').get(AuthController.getConnect);
router.route('/disconnect').get(AuthController.getDisconnect);
router.get('/users/me', UserController.getMe);
router.post('/files', FilesController.postUpload);
// router.post('/users', UserController.postNew);

export default router;
