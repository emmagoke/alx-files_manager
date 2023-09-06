// This file holds the monogodb configuration settings
import { MongoClient } from 'mongodb';

const mongo = require('mongodb');

class DBClient {
  constructor() {
    // from the environment variable DB_HOST or default: localhost
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    // from the environment variable DB_DATABASE or default: files_manager
    this.database = process.env.DB_DATABASE || 'files_manager';

    this.connected = false;

    // this.url = `mongodb://${this.host}:${this.port}/${this.database}`;
    this.url = `mongodb://${this.host}:${this.port}`;
    this.mongoDb = new MongoClient(this.url, { useUnifiedTopology: true });
    // this.db = this.mongoDb(this.database);

    this.mongoDb
      .connect()
      .then(() => {
        this.connected = true;
      })
      .catch((err) => {
        console.log(err);
        this.connected = false;
      });
    // creating a new database
    this.db = this.mongoDb.db(this.database);

    this.users = this.db.collection('users');
    this.files = this.db.collection('files');
  }

  isAlive() {
    return this.connected;
  }

  async nbUsers() {
    const users = await this.users.estimatedDocumentCount();
    return users;
  }

  async nbFiles() {
    // this.db.collection('files').countDocuments()
    const files = await this.files.estimatedDocumentCount();
    return files;
  }

  async getFileById(id) {
    const searchId = new mongo.ObjectId(id);
    const file = await this.files.findOne({ _id: searchId });

    return file;
  }

  async getUserCountByEmail(email) {
    const query = { email };
    //   users.countDocuments(query) is a Promise
    const count = await this.users.countDocuments(query);
    return count;
  }

  async getUserById(id) {
    const searchId = new mongo.ObjectId(id);
    const user = await this.users.findOne({ _id: searchId });

    return user;
  }
}

const dbClient = new DBClient();
export default dbClient;
