const vectorService = require('../services/vectorService');
const llmService = require('../services/llmService');
const answerExtractor = require('../utils/answerExtractor');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { NotFoundError, ServiceUnavailableError } = require('../utils/errors');

exports.ask = async (req, res, next) => {
    const startTime = Date.now();
    const clientIp = req.ip || req.connection.remoteAddress;
    
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Validation failed', { ip: clientIp, errors: errors.array() });
            return res.status(400).json({ 
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: errors.array()
                }
            });
        }

        const { question } = req.body;
        logger.info('Query received', { ip: clientIp, question });

        // 1. Search relevant data (Retrieval) - optimized with caching
        const relevantDocs = await vectorService.search(question);
        
        if (relevantDocs.length === 0) {
            logger.info('No data found', { ip: clientIp, question });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.write("No data found in the database for your query.");
            res.end();
            return;
        }

        const context = relevantDocs.map(d => d.content).join('\n---\n');
        const retrievalTime = Date.now() - startTime;
        logger.info('Retrieval complete', { retrievalTime, docsFound: relevantDocs.length });

        // 2. Build optimized prompt
        const prompt = `You are a helpful travel agent database assistant. Answer questions about travel agents using ONLY the provided data.

RULES:
1. Extract information ONLY from the Context below
2. For company queries: List ALL agents/candidates from that company
3. For name queries: Provide the specific agent's details
4. For AgentID queries: Match the exact ID or pattern
5. If asking for "all candidates" or "all agents" from a company, list every person from that company
6. Be conversational and natural in your response
7. If no match found, say "No information found for that query"

Context:
${context}

User Question: ${question}

Answer (be specific and complete):`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 3. Generate with LLM (with fallback support)
        try {
            const result = await llmService.generate(prompt, res);
            const totalTime = Date.now() - startTime;
            logger.info('Query completed', { totalTime, service: result.service, ip: clientIp });
        } catch (err) {
            if (err.isOperational) throw err;
            logger.error('All LLM services failed, using answer extractor', { error: err.message, ip: clientIp });
            
            // Use simple answer extractor as last resort
            try {
                const answer = answerExtractor.extractAnswer(question, context);
                res.write(answer);
                res.end();
                logger.info('Answer extracted successfully', { ip: clientIp });
            } catch (extractError) {
                logger.error('Answer extractor failed', { error: extractError.message, ip: clientIp });
                res.write("Unable to process your query. Please try again.");
                res.end();
            }
        }

    } catch (error) {
        logger.error('Controller error', { error: error.message, stack: error.stack, ip: clientIp });
        next(error);
    }
};
