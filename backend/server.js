require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const logger = require('./config/logger');
const apiRoutes = require('./routes/api');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const vectorService = require('./services/vectorService');
const cacheService = require('./services/cacheService');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize services
(async () => {
    try {
        await vectorService.init();
        logger.info('All services initialized');
    } catch (error) {
        logger.error('Service initialization failed:', error);
        process.exit(1);
    }
})(); 

// HTTP request logging
app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(cors());
app.use(bodyParser.json());
app.use('/api/', limiter);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('AI Travel Chatbot Backend is running.');
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await cacheService.disconnect();
    process.exit(0);
});
