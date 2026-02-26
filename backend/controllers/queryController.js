const vectorService = require('../services/vectorService');
const llmService = require('../services/llmService');
const answerExtractor = require('../utils/answerExtractor');
const dataAnalyzer = require('../services/dataAnalyzer');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { NotFoundError, ServiceUnavailableError } = require('../utils/errors');

// QUERY TYPE DETECTION
function detectQueryType(question) {
    const q = question.toLowerCase();
    
    if (q.match(/most login|highest login|top.*login|login.*most/))   return 'TOP_LOGINS';
    if (q.match(/suspicious|bot|rapid|burst|security|flag/))          return 'SECURITY_ANALYSIS';
    if (q.match(/anomal|malform|error|typo|corrupt|bad data|quality/)) return 'DATA_QUALITY';
    if (q.match(/both document|cross.?ref|appear in both|match/))     return 'CROSS_DOCUMENT';
    if (q.match(/how many|count|total number/))                        return 'COUNT_QUERY';
    if (q.match(/earliest|latest|first login|last login/))             return 'DATE_RANGE_QUERY';
    return 'GENERAL';
}

// IMPROVED PROMPT BUILDER
function buildPrompt(question, agentContext, loginContext, preComputedContext = '') {
    return `You are an expert travel agent data analyst. Answer questions CONCISELY and DIRECTLY.

YOUR STRICT RULES:
1. Give SHORT, DIRECT answers (2-4 sentences maximum)
2. NO SQL queries, NO step-by-step explanations, NO verbose analysis
3. Start with the ANSWER immediately
4. Use bullet points ONLY if listing multiple items
5. For "relationship" questions: State if email exists in both documents, show name/company, show login count
6. For "most logins" questions: State agent email and exact count
7. Always include specific values: names, IDs, counts, dates

=== PRE-COMPUTED ANALYSIS ===
${preComputedContext || 'None'}

=== AGENT PROFILES ===
${agentContext || 'None'}

=== LOGIN RECORDS ===
${loginContext || 'None'}

=== QUESTION ===
${question}

=== ANSWER (BE CONCISE) ===`;
}

// FORMAT HELPERS
function formatAgent(agent) {
    return `AgentID: ${agent.AgentID}
Name: ${agent.Name}
Email: ${agent.UserName}
Company: ${agent.Comp_Name}
Nationality: ${agent.Nationality}
Created: ${agent.CreatedDate}
Last Login: ${agent.LastLogin || 'N/A'}
Established: ${agent.Date_establishment || 'N/A'}`;
}

function formatLogins(agentId, logins) {
    const loginList = logins
        .slice(0, 20)
        .map(l => `  - Login ID ${l.ID}: ${l.LOGINDATE}`)
        .join('\n');
    return `Login records for ${agentId} (${logins.length} total):\n${loginList}`;
}

// CROSS-DOCUMENT CONTEXT BUILDER
async function buildCrossDocumentContext(question) {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/gi;
    const agentIdRegex = /CHAGT\w+/gi;
    const emails = question.match(emailRegex) || [];
    const agentIds = question.match(agentIdRegex) || [];

    let agentContext = '';
    let loginContext = '';

    if (emails.length > 0 || agentIds.length > 0) {
        const identifiers = [...emails, ...agentIds];
        
        for (const id of identifiers) {
            const agent = await vectorService.findAgentByIdentifier(id);
            if (agent) {
                agentContext += formatAgent(agent) + '\n---\n';
            }
            
            const logins = await vectorService.findLoginsByIdentifier(id);
            if (logins && logins.length > 0) {
                loginContext += formatLogins(id, logins) + '\n---\n';
            }
        }
    }

    return { agentContext, loginContext };
}

// RESPONSE CLEANER - Remove verbose SQL/analysis
function cleanResponse(text) {
    // Remove SQL queries
    text = text.replace(/```sql[\s\S]*?```/gi, '');
    
    // Remove "Dataset A query:", "Dataset B query:", etc.
    text = text.replace(/Dataset [AB] query:[\s\S]*?(?=\n\n|$)/gi, '');
    
    // Remove "Result:" sections with tables
    text = text.replace(/Result:\s*\*[\s\S]*?(?=\n\n|\d\.)/gi, '');
    text = text.replace(/Result:\s*\|[\s\S]*?(?=\n\n|\d\.)/gi, '');
    
    // Remove step-by-step numbering if too verbose
    const lines = text.split('\n');
    if (lines.filter(l => l.match(/^\d+\./)).length > 3) {
        // Too many steps, extract just the final answer
        const finalAnswerMatch = text.match(/(?:final answer|answer)[:\s]+(.*?)(?:\n\n|$)/is);
        if (finalAnswerMatch) return finalAnswerMatch[1].trim();
    }
    
    return text.trim();
}

exports.ask = async (req, res, next) => {
    const startTime = Date.now();
    const clientIp = req.ip || req.connection.remoteAddress;
    
    try {
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

        // Check if this is a data quality/analysis question (existing analyzer)
        const analyticalAnswer = dataAnalyzer.analyzeQuery(question);
        if (analyticalAnswer) {
            logger.info('Analytical query answered', { ip: clientIp });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.write(analyticalAnswer);
            res.end();
            return;
        }

        // SMART QUERY ROUTING WITH PRE-COMPUTATION
        const queryType = detectQueryType(question);
        let preComputedContext = '';
        
        switch(queryType) {
            case 'TOP_LOGINS':
                const top = dataAnalyzer.analyzeTopLoginAgents(10);
                preComputedContext = `PRE-COMPUTED TOP LOGIN AGENTS:\n${JSON.stringify(top, null, 2)}`;
                break;
                
            case 'SECURITY_ANALYSIS':
                const suspicious = dataAnalyzer.detectRapidLogins(120, 5);
                preComputedContext = `PRE-COMPUTED SUSPICIOUS ACCOUNTS:\n${JSON.stringify(suspicious, null, 2)}`;
                break;
                
            case 'DATA_QUALITY':
                const anomalies = dataAnalyzer.detectDataAnomalies();
                preComputedContext = `PRE-COMPUTED ANOMALIES FOUND:\n${JSON.stringify(anomalies.slice(0, 50), null, 2)}`;
                break;
                
            case 'CROSS_DOCUMENT':
                const matched = dataAnalyzer.crossMatchDocuments();
                preComputedContext = `PRE-COMPUTED CROSS-DOCUMENT MATCHES:\n${JSON.stringify(matched.slice(0, 30), null, 2)}`;
                break;
        }

        // BUILD CROSS-DOCUMENT CONTEXT (Fix 2 - Most Critical)
        const { agentContext: crossAgentCtx, loginContext: crossLoginCtx } = await buildCrossDocumentContext(question);
        
        // FALLBACK: Vector search if no direct identifiers found
        let agentContext = crossAgentCtx;
        let loginContext = crossLoginCtx;
        
        if (!agentContext && !loginContext) {
            const relevantDocs = await vectorService.search(question);
            
            if (relevantDocs.length === 0) {
                logger.info('No vector results, trying direct data access', { ip: clientIp });
                const databaseService = require('../services/databaseService');
                const allAgents = await databaseService.getAllAgents();
                
                if (allAgents.length === 0) {
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.write("No data found in the database for your query.");
                    res.end();
                    return;
                }
                
                agentContext = allAgents.slice(0, 50).map(formatAgent).join('\n---\n');
            } else {
                agentContext = relevantDocs.map(d => d.content).join('\n---\n');
            }
        }

        const retrievalTime = Date.now() - startTime;
        logger.info('Context built', { retrievalTime, queryType });

        // BUILD OPTIMIZED PROMPT (Fix 1)
        const prompt = buildPrompt(question, agentContext, loginContext, preComputedContext);
        
        logger.info('Prompt built', { 
            hasPreComputed: !!preComputedContext, 
            hasAgentCtx: !!agentContext, 
            hasLoginCtx: !!loginContext 
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Buffer response for cleaning
        let responseBuffer = '';
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        
        res.write = (chunk) => {
            responseBuffer += chunk;
            return true; // Don't send yet
        };
        
        res.end = () => {
            // Clean the complete response
            const cleaned = cleanResponse(responseBuffer);
            originalWrite(cleaned);
            originalEnd();
        };

        try {
            const result = await llmService.generate(prompt, res);
            const totalTime = Date.now() - startTime;
            logger.info('Query completed', { totalTime, service: result.service, ip: clientIp });
        } catch (err) {
            if (err.isOperational) throw err;
            logger.error('All LLM services failed, using answer extractor', { error: err.message, ip: clientIp });
            
            try {
                const answer = answerExtractor.extractAnswer(question, agentContext + '\n' + loginContext);
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
