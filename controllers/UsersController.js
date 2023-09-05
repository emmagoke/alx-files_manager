import sha1 from 'sha1';
import dbClient from '../utils/db';

export default class UserController {
  static async postNew(req, res) {
    // req.params is for url query parameters e.g users/1
    const { email, password } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      //   res.end();
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      //   res.end();
      return;
    }

    if (email) {
      const userCount = await dbClient.getUserCountByEmail(email);
      if (userCount) {
        res.status(400).json({ error: 'Already exist' });
        // res.end();
        return;
      }
    }

    const hashedPassword = sha1(password);

    const doc = { email, password: hashedPassword };
    const result = await dbClient.users.insertOne(doc);

    res.status(201).send({ id: result.insertedId, email });
    // dbClient.close();
  }
}
