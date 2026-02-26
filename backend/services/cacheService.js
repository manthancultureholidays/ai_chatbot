const logger = require('../config/logger');

class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 3600000; // 1 hour in ms
    }

    async connect() {
        logger.info('In-memory cache initialized');
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl * 1000
        });
    }

    async del(key) {
        this.cache.delete(key);
    }

    async invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) this.cache.delete(key);
        }
    }

    async disconnect() {
        this.cache.clear();
    }
}

module.exports = new CacheService();
