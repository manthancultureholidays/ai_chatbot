const vectorService = require('../services/vectorService');
const { validationResult } = require('express-validator');

// Assuming Ollama is running at 127.0.0.1:11434
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

exports.ask = async (req, res) => {
    const startTime = Date.now();
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { question } = req.body;

        // 1. Search relevant data (Retrieval) - optimized with caching
        const relevantDocs = await vectorService.search(question);
        
        if (relevantDocs.length === 0) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.write("No data found in the database for your query.");
            res.end();
            return;
        }

        const context = relevantDocs.map(d => d.content).join('\n---\n');
        const retrievalTime = Date.now() - startTime;
        console.log(`Retrieval: ${retrievalTime}ms, Found: ${relevantDocs.length} docs`);

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
                throw new Error(`Ollama returned ${response.status}`);
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

        } catch (err) {
            console.error("Ollama error:", err.message);
            res.write("LLM offline. Database info:\n\n" + context);
            res.end();
        }

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).end("Internal Server Error");
    }
};
