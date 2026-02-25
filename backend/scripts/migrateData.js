const fs = require('fs');
const path = require('path');
const databaseService = require('../services/databaseService');
const logger = require('../config/logger');

async function migrateData() {
    try {
        logger.info('Starting data migration...');
        await databaseService.connect();

        const agentDataPath = path.join(__dirname, '..', 'data', 'agentData.json');
        const loginDataPath = path.join(__dirname, '..', 'data', 'agentLoginData.json');

        if (fs.existsSync(agentDataPath)) {
            const agents = JSON.parse(fs.readFileSync(agentDataPath, 'utf8'));
            logger.info(`Migrating ${agents.length} agents...`);
            for (const agent of agents) {
                await databaseService.insertAgent(agent);
            }
            logger.info('Agents migrated successfully');
        }

        if (fs.existsSync(loginDataPath)) {
            const logins = JSON.parse(fs.readFileSync(loginDataPath, 'utf8'));
            logger.info(`Migrating ${logins.length} login records...`);
            for (const login of logins) {
                await databaseService.insertLogin(login);
            }
            logger.info('Logins migrated successfully');
        }

        logger.info('Data migration completed');
        process.exit(0);
    } catch (error) {
        logger.error('Migration error:', error);
        process.exit(1);
    }
}

migrateData();
