const vectorService = require('../services/vectorService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { NotFoundError, ServiceUnavailableError } = require('../utils/errors');

// Assuming Ollama is running at 127.0.0.1:11434
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

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
        const prompt = `You are an intelligent travel agent database assistant. Answer questions using the provided agent data.

IMPORTANT INSTRUCTIONS:
1. Use ONLY the information in the Context below
2. If the answer exists in the context, provide it clearly
3. If the context doesn't contain the answer, respond: "No data found"
4. For queries about AgentID patterns (ends with, starts with, contains), check ALL agents in the context
5. Be smart about matching - if user asks "whose agent id ends with 0453", look for any AgentID ending in 0453

Context (All matching agents):
${context}

User Question: ${question}

Answer:`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 3. Send to LLaMA (Generation with Streaming)
        try {
            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3.2:latest',
                    prompt: prompt,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new ServiceUnavailableError('AI service is currently unavailable');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                chunk.split('\n').filter(Boolean).forEach(line => {
                    try {
                        const json = JSON.parse(line);
                        if (json.response) res.write(json.response);
                        if (json.done) res.end();
                    } catch (e) {}
                });
            }
            
            const totalTime = Date.now() - startTime;
            logger.info('Query completed', { totalTime, ip: clientIp });

        } catch (err) {
            if (err.isOperational) throw err;
            logger.error('Ollama error', { error: err.message, ip: clientIp });
            res.write("AI service temporarily unavailable. Here's the database information:\n\n" + context);
            res.end();
        }

    } catch (error) {
        logger.error('Controller error', { error: error.message, stack: error.stack, ip: clientIp });
        next(error);
    }
};
