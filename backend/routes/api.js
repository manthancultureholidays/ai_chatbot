const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const queryController = require('../controllers/queryController'); 
const statsController = require('../controllers/statsController');

router.post('/ask', [ 
    body('question')
        .trim()
        .notEmpty().withMessage('Question is required')
        .isLength({ min: 1, max: 1000 }).withMessage('Question must be 1-1000 characters')
        .matches(/^[a-zA-Z0-9\s.,?!@#\-_()+"':;/\\]+$/).withMessage('Invalid characters in question')
], queryController.ask); 

router.get('/stats', statsController.getStats);

module.exports = router;  
