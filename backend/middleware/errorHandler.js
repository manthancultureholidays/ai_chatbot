const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.isOperational ? err.message : 'Something went wrong';

    logger.error('Error occurred', {
        code,
        message: err.message,
        stack: err.stack,
        ip: req.ip,
        path: req.path,
        method: req.method
    });

    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message
        }
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found'
        }
    });
};

module.exports = { errorHandler, notFoundHandler };
