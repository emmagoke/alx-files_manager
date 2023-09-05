import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const base64Encode = req.headers.authorization.split(' ')[1];
    const value = Buffer.from(base64Encode, 'base64').toString('ascii');
    const email = value.split(':')[0];
    const password = value.split(':')[1];

    const user = await dbClient.users.findOne({ email });
    if (!user) {
      // user does not exist
      res.status(401).json({ error: 'Unauthorized' });
      //   res.end()
      return;
    }

    if (user) {
      if (user.password !== sha1(password)) {
        // wrong password
        res.status(401).json({ error: 'Unauthorized' });
        //   res.end()
      } else {
        const token = uuidv4();
        const key = `auth_${token}`;

        // duration = 24 hours
        const hour = 24 * 60 * 60;
        await redisClient.set(key, user._id.toString(), hour);
        res.status(200).json({ token });
      }
    }
  }

  static async getDisconnect(req, res) {
    const authToken = req.headers['x-token'];

    const value = await redisClient.get(`auth_${authToken}`);
    if (!value) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await redisClient.del(`auth_${authToken}`);
    res.status(204).end();
  }
}
