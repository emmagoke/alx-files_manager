import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const ALLOWED = { folder: 'folder', file: 'file', image: 'image' };
const ROOT = 0;

export default class FilesController {
  static async postUpload(req, res) {
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const authToken = req.headers['x-token'];

    const value = await redisClient.get(`auth_${authToken}`);

    if (!value) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await dbClient.getUserById(value);

    const { name } = req.body;
    const { type } = req.body;
    const parentId = req.body.parentId || ROOT;
    const isPublic = req.body.isPublic || false;
    const { data } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (!type || !Object.values(ALLOWED).includes(type)) {
      res.status(400).send({ error: 'Missing type' });
      return;
    }

    if (!data && type !== ALLOWED.folder) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    if (parentId && parentId !== ROOT.toString()) {
      const file = await dbClient.getFileById(parentId);
      if (!file) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (file) {
        if (file.type !== 'folder') {
          res.status(400).json({ error: 'Parent is not a folder' });
          return;
        }
      }
    }

    const query = {
      userId: new ObjectId(user._id.toString()),
      name,
      type,
      isPublic,
      parentId:
        parentId === ROOT || parentId === ROOT.toString()
          ? '0'
          : new ObjectId(parentId),
    };

    if (type !== ALLOWED.folder) {
      const filename = uuidv4();
      const localPath = `${folderPath}/${filename}`;

      // If folderPath does not exist
      if (!fs.existsSync(folderPath)) {
        // creating a new folder
        await fs.mkdir(folderPath);
      }

      fs.writeFile(localPath, Buffer.from(data, 'base64'), (err) => {
        if (err) {
          console.log(err);
        }
      });
      query.localPath = localPath;
    }

    // console.log(query);
    const file = await dbClient.files.insertOne(query);
    const fileId = file.insertedId.toString();

    const response = {
      id: fileId,
      userId: user._id.toString(),
      name,
      type,
      isPublic,
      parentId,
    };
    res.status(201).json(response);
  }
}
