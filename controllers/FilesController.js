import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const ALLOWED = { folder: 'folder', file: 'file', image: 'image' };
const ROOT = 0;
const PAGE_SIZE = 20;

// Argument passed in must be a single String of 12 bytes or a string
// of 24 hex characters
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

export default class FilesController {
  static async getUser(req, res) {
    const authToken = req.headers['x-token'];

    const value = await redisClient.get(`auth_${authToken}`);

    if (!value) {
      res.status(401).json({ error: 'Unauthorized' });
      res.end();
      return null;
    }
    const user = await dbClient.getUserById(value);

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      res.end();
      return null;
    }
    return user;
  }

  static async getUserNew(req) {
    const authToken = req.headers['x-token'];
    const value = await redisClient.get(`auth_${authToken}`);

    if (!value) {
      return null;
    }
    const user = await dbClient.getUserById(value);

    if (!user) {
      console.log('Not user');
      return null;
    }
    return user;
  }

  static async postUpload(req, res) {
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const user = await FilesController.getUser(req, res);

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
    const user = await FilesController.getUser(req, res);

    const file = await dbClient.files.findOne({
      _id: new ObjectId(fileId.toString()),
      userId: user._id,
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

  static async getIndex(req, res) {
    const user = await FilesController.getUser(req, res);

    // this are search query
    const { parentId } = req.query;
    const page = req.query.page || '' ? Number.parseInt(req.query.page.toString(), 10) : 0;

    console.log(user);
    console.log(page);
    console.log(parentId);

    let search;

    if (!parentId) {
      search = {
        userId: user._id,
      };
    } else {
      search = {
        userId: user._id,
        parentId: new ObjectId(String(parentId)),
      };
    }

    const pipeline = [
      { $match: search },
      { $skip: page * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      // {
      //   $project: {
      //     _id: 0,
      //     id: '$_id',
      //     userId: '$userId',
      //     name: '$name',
      //     type: '$type',
      //     isPublic: '$isPublic',
      //     parentId: {
      //       $cond: {
      //         if: { $eq: ['$parentId', '0'] },
      //         then: 0,
      //         else: '$parentId',
      //       },
      //     },
      //   },
      // },
    ];

    const file = await dbClient.db
      .collection('files')
      .aggregate(pipeline)
      .toArray();
    console.log(file);
    // for await (const doc of file) {
    //   console.log(doc);
    // }
    res.status(200).json(file);
  }

  static async putPublish(req, res) {
    const user = await FilesController.getUser(req, res);
    const _id = req.params.id;

    const search = {
      _id: new ObjectId(isValidId(_id) ? _id : NULL_ID),
      userId: user._id,
    };
    const insert = { $set: { isPublic: true } };
    // const option = { returnOriginal: false };
    // dbClient.files.findOneAndUpdate(search, insert, option, (err, result)=> {}

    const file = await dbClient.files.findOne(search);
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.files.updateOne(search, insert);
    const response = {
      id: _id,
      userId: user._id.toString(),
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId.toString(),
    };
    res.status(200).json(response);
  }

  static async putUnpublish(req, res) {
    const user = await FilesController.getUser(req, res);
    const _id = req.params.id;

    const search = {
      _id: new ObjectId(isValidId(_id) ? _id : NULL_ID),
      userId: user._id,
    };
    const insert = { $set: { isPublic: false } };
    // const option = { returnOriginal: false };
    // dbClient.files.findOneAndUpdate(search, insert, option, (err, result)=> {}

    const file = await dbClient.files.findOne(search);
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.files.updateOne(search, insert);
    const response = {
      id: _id,
      userId: user._id.toString(),
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId.toString(),
    };
    res.status(200).json(response);
  }

  static async getFile(req, res) {
    // const user = await FilesController.getUser(req, res);
    const _id = req.params.id;

    const search = {
      _id: new ObjectId(isValidId(_id) ? _id : NULL_ID),
    };

    const file = await dbClient.files.findOne(search);
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (file.type === ALLOWED.folder) {
      res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (file.isPublic) {
      const { localPath } = file;
      if (fs.existsSync(localPath)) {
        fs.readFile(localPath, (err, data) => {
          if (!err) {
            const contentType = mime.contentType(file.name);
            // res.setHeader(('Content-Type', contentType));
            res.header('Content-Type', contentType);
            res.status(200).send(data);
          }
        });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } else {
      // If the file is not Public i.e file.isPublic is false
      // the user is the only allowed person to see the file
      const user = await FilesController.getUserNew(req);

      if (!user) {
        console.log('Not User');
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (file.userId.toString() !== user._id.toString()) {
        console.log('Not Owner');
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const { localPath } = file;
      if (fs.existsSync(localPath)) {
        fs.readFile(localPath, (err, data) => {
          if (!err) {
            const contentType = mime.contentType(file.name);
            // res.setHeader(('Content-Type', contentType));
            res.header('Content-Type', contentType);
            res.status(200).send(data);
          }
        });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    }
  }
}
