import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();
    const response = { redis: redisStatus, db: dbStatus };

    res.status(200).json(response);
  }

  //   static async getStats(req, res) {
  //     const userCount = await dbClient.nbUsers();
  //     const fileCount = await dbClient.nbFiles();
  //     const response = { users: userCount, files: fileCount };

  //     res.writeHead(200);
  //     res.json(response);
  //   }
  static getStats(req, res) {
    Promise.all([dbClient.nbUsers(), dbClient.nbFiles()]).then(
      ([userCount, fileCount]) => {
        const response = { users: userCount, files: fileCount };
        res.status(200).json(response);
      },
    );
  }
}

export default AppController;
