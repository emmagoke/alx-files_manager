import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const ALLOWED = { folder: 'folder', file: 'file', image: 'image' };
const ROOT = 0;
// const PAGE_SIZE = 20;

export default class FilesController {
  static async getUser(req) {
    const authToken = req.headers['x-token'];

    const value = await redisClient.get(`auth_${authToken}`);

    if (!value) {
      return null;
    }
    const user = await dbClient.getUserById(value);
    if (!user) {
      return null;
    }
    return user;
  }

  static async postUpload(req, res) {
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
      userId: user._id,
      name,
      type,
      isPublic,
      parentId:
        parentId === ROOT || parentId === ROOT.toString()
          ? '0'
          : new ObjectId(parentId),
    };

    if (type === ALLOWED.folder) {
      // console.log(query);
      const file = await dbClient.files.insertOne(query);

      const response = {
        id: file.insertedId.toString(),
        userId: user._id.toString(),
        name,
        type,
        isPublic,
        parentId,
      };
      res.status(201).json(response);
    } else {
      const filename = uuidv4();
      const localPath = `${folderPath}/${filename}`;

      if (!fs.existsSync(folderPath)) {
        fs.mkdir(folderPath, (err) => {
          if (err) {
            console.log(err);
          }
        });
      }

      fs.writeFile(localPath, Buffer.from(data, 'base64'), (err) => {
        if (err) {
          console.log(err);
        }
      });
      query.localPath = localPath;

      const file = await dbClient.files.insertOne(query);

      const response = {
        id: file.insertedId.toString(),
        userId: user._id.toString(),
        name,
        type,
        isPublic,
        parentId,
      };
      res.status(201).json(response);
    }
  }

  static async getShow(req, res) {
    const fileId = req.params.id;
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const file = await dbClient.files.findOne({
      _id: new ObjectId(fileId.toString()),
      userId: ObjectId(user._id.toString()),
    });

    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const response = {
      id: file._id.toString(),
      userId: user._id.toString(),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId.toString(),
    };
    res.status(200).json(response);
  }

  // static async getIndex(req, res) {
  //   const user = await FilesController.getUser(req);
  //   if (!user) {
  //     res.status(401).json({ error: 'Unauthorized' });
  //     return;
  //   }

  //   // this are search query
  //   const parentId = req.query.parentId || ROOT.toString();
  //   const page = req.query.page || '' ? Number.parseInt(req.query.page.toString()) : 0;

  //   console.log(user);
  //   console.log(page);
  //   console.log(parentId);

  //   const search = {
  //     userId: user._id.toString(),
  //     parentId:
  //       parentId === ROOT.toString() ? parentId : new ObjectId(parentId),
  //   };

  //   const pipeline = [
  //     { $match: search },
  //     { $skip: page * PAGE_SIZE },
  //     { $limit: PAGE_SIZE },
  //     // {
  //     //   $project: {
  //     //     _id: 0,
  //     //     id: '$_id',
  //     //     userId: '$userId',
  //     //     name: '$name',
  //     //     type: '$type',
  //     //     isPublic: '$isPublic',
  //     //     parentId: {
  //     //       $cond: {
  //     //         if: { $eq: ['$parentId', '0'] },
  //     //         then: 0,
  //     //         else: '$parentId',
  //     //       },
  //     //     },
  //     //   },
  //     // },
  //   ];

  //   const file = dbClient.db.collection('files').aggregate(pipeline).toArray();
  //   console.log(file);
  //   for await (const doc of file) {
  //     console.log(doc);
  //   }
  //   // res.status(200).json(file);
  // }
}
