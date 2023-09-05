// This file contains class that handles redis operations
import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.redis = createClient();
    this.connected = true;
    this.redis.on('error', (err) => {
      if (err) {
        this.connected = false;
      }
    });

    this.redis.on('connect', () => {
      this.connected = true;
    });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    // const value = await this.redis.get(key);
    // return value;
    const getValue = promisify(this.redis.get).bind(this.redis);
    const value = await getValue(key);
    return value;
  }

  async set(key, value, duration) {
    // setex takes in expiration(in this case duration) argument
    // await this.redis.setex(key, duration, value);
    const setValue = promisify(this.redis.set).bind(this.redis);
    await setValue(key, value, 'EX', duration);
  }

  async del(key) {
    // await this.redis.del(key);
    const delValue = promisify(this.redis.del).bind(this.redis);
    await delValue(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
