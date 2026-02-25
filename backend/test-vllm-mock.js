const express = require('express');
const app = express();
app.use(express.json());

app.post('/v1/completions', (req, res) => {
    const prompt = req.body.prompt;
    console.log('Mock vLLM received request');
    
    // Extract context and question from prompt
    const contextMatch = prompt.match(/Context:[\s\S]*?User Question:/i);
    const questionMatch = prompt.match(/User Question:\s*(.+?)\s*Answer/i);
    
    if (!contextMatch || !questionMatch) {
        return res.json({
            choices: [{ text: 'Unable to process the query.', finish_reason: 'stop' }],
            model: req.body.model
        });
    }
    
    const context = contextMatch[0];
    const question = questionMatch[1].toLowerCase();
    
    // Simple pattern matching for common queries
    let answer = '';
    
    // Extract all agent names from context
    const nameMatches = context.match(/- Name: ([^\n]+)/g) || [];
    const names = nameMatches.map(m => m.replace('- Name: ', '').trim());
    
    // Extract company names
    const companyMatches = context.match(/- Company: ([^\n]+)/g) || [];
    const companies = companyMatches.map(m => m.replace('- Company: ', '').trim());
    
    // Check what user is asking for
    if (question.includes('candidate') || question.includes('name') || question.includes('who') || question.includes('employee') || question.includes('agent')) {
        if (names.length > 0) {
            const uniqueCompany = companies[0];
            answer = `Based on the database, here are the candidates from ${uniqueCompany}:\n\n`;
            names.forEach((name, idx) => {
                answer += `${idx + 1}. ${name}\n`;
            });
        } else {
            answer = 'No candidates found in the database for this query.';
        }
    } else if (question.includes('email')) {
        const emailMatches = context.match(/- Email: ([^\n]+)/g) || [];
        answer = emailMatches.map(m => m.replace('- Email: ', '')).join('\n');
    } else if (question.includes('agentid') || question.includes('agent id')) {
        const idMatches = context.match(/- AgentID: ([^\n]+)/g) || [];
        answer = idMatches.map(m => m.replace('- AgentID: ', '')).join('\n');
    } else {
        // Generic response with all info
        answer = `Here's the information from the database:\n\n${names.join('\n')}`;
    }
    
    res.json({
        choices: [{
            text: answer || 'No relevant information found.',
            finish_reason: 'stop'
        }],
        model: req.body.model
    });
});

app.listen(8000, () => {
    console.log('Mock vLLM server running on http://127.0.0.1:8000');
    console.log('This simulates a vLLM fallback service');
});
