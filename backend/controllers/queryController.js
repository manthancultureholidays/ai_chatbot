const vectorService = require('../services/vectorService');
const llmService = require('../services/llmService');
const answerExtractor = require('../utils/answerExtractor');
const dataAnalyzer = require('../services/dataAnalyzer');
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

        // Check if this is a data quality/analysis question
        const analyticalAnswer = dataAnalyzer.analyzeQuery(question);
        if (analyticalAnswer) {
            logger.info('Analytical query answered', { ip: clientIp });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.write(analyticalAnswer);
            res.end();
            return;
        }

        // 1. Search relevant data (Retrieval) - optimized with caching
        const relevantDocs = await vectorService.search(question);
        
        if (relevantDocs.length === 0) {
            logger.info('No vector results, trying direct data access', { ip: clientIp, question });
            
            // Fallback: Load all agent data for queries that need full dataset
            const databaseService = require('../services/databaseService');
            const allAgents = await databaseService.getAllAgents();
            
            if (allAgents.length === 0) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.write("No data found in the database for your query.");
                res.end();
                return;
            }
            
            // Use all agents as context for queries like "oldest establishment date"
            relevantDocs.push({
                content: JSON.stringify(allAgents, null, 2)
            });
        }

        const context = relevantDocs.map(d => d.content).join('\n---\n');
        const retrievalTime = Date.now() - startTime;
        logger.info('Retrieval complete', { retrievalTime, docsFound: relevantDocs.length });

        // 2. Build optimized prompt
        const prompt = `You are an expert data analyst specializing in travel agent databases. Answer questions with precision and detail using ONLY the provided data.

RULES:
1. Extract information ONLY from the Context below
2. For data quality questions: Identify anomalies, malformed data, duplicates, typos
3. For company queries: List ALL agents from that company with their details
4. For pattern analysis: Identify login patterns, frequency, time ranges
5. For statistical queries: Count, aggregate, and analyze the data
6. Provide specific examples with IDs, names, and relevant details
7. Format answers clearly with bullet points or numbered lists when appropriate
8. If no match found, say "No information found for that query"

Context:
${context}

User Question: ${question}

Answer (be specific, detailed, and include examples with IDs):`;

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
