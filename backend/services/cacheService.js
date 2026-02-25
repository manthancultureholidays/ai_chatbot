const redis = require('redis');
const logger = require('../config/logger');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.defaultTTL = 3600; // 1 hour
    }

    async connect() {
        try {
            this.client = redis.createClient({
                socket: { host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379 },
                password: process.env.REDIS_PASSWORD || undefined
            });

            this.client.on('error', (err) => logger.error('Redis error:', err));
            this.client.on('connect', () => logger.info('Redis connected'));

            await this.client.connect();
            this.isConnected = true;
            logger.info('Redis cache initialized');
        } catch (error) {
            logger.warn('Redis unavailable, using in-memory fallback:', error.message);
            this.fallbackCache = new Map();
        }
    }

    async get(key) {
        if (!this.isConnected) return this.fallbackCache?.get(key);
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    async set(key, value, ttl = this.defaultTTL) {
        if (!this.isConnected) {
            this.fallbackCache?.set(key, value);
            return;
        }
        try {
            await this.client.setEx(key, ttl, JSON.stringify(value));
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    async del(key) {
        if (!this.isConnected) {
            this.fallbackCache?.delete(key);
            return;
        }
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error('Cache delete error:', error);
        }
    }

    async invalidatePattern(pattern) {
        if (!this.isConnected) {
            if (this.fallbackCache) {
                for (const key of this.fallbackCache.keys()) {
                    if (key.includes(pattern)) this.fallbackCache.delete(key);
                }
            }
            return;
        }
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) await this.client.del(keys);
        } catch (error) {
            logger.error('Cache invalidate error:', error);
        }
    }

    async disconnect() {
        if (this.isConnected) await this.client.quit();
    }
}

module.exports = new CacheService();
