const testQuestions = require('./test-questions');

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const VLLM_URL = 'http://127.0.0.1:8000/v1/completions';

async function testOllama(question, context) {
    const prompt = `You are a data analyst. Answer based on the provided data.

Data:
${context}

Question: ${question}

Answer:`;

    const startTime = Date.now();
    
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:latest',
                prompt: prompt,
                stream: false
            })
        });

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        return {
            answer: data.response,
            duration: duration,
            model: 'Ollama LLaMA 3.2'
        };
    } catch (error) {
        return {
            answer: `Error: ${error.message}`,
            duration: Date.now() - startTime,
            model: 'Ollama LLaMA 3.2'
        };
    }
}

async function testVLLM(question, context) {
    const prompt = `You are a data analyst. Answer based on the provided data.

Data:
${context}

Question: ${question}

Answer:`;

    const startTime = Date.now();
    
    try {
        const response = await fetch(VLLM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'meta-llama/Llama-3.2-3B-Instruct',
                prompt: prompt,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        return {
            answer: data.choices[0].text,
            duration: duration,
            model: 'vLLM LLaMA 3.2'
        };
    } catch (error) {
        return {
            answer: `Error: ${error.message}`,
            duration: Date.now() - startTime,
            model: 'vLLM LLaMA 3.2'
        };
    }
}

async function runComparison() {
    const vectorService = require('./services/vectorService');
    
    console.log('='.repeat(80));
    console.log('LLM COMPARISON TEST: Ollama vs vLLM');
    console.log('='.repeat(80));
    console.log(`Testing ${testQuestions.length} questions\n`);

    const results = [];

    for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        console.log(`\n[${i + 1}/${testQuestions.length}] ${question}`);
        console.log('-'.repeat(80));

        // Get relevant context
        const docs = await vectorService.search(question);
        const context = docs.map(d => d.content).join('\n---\n').substring(0, 2000);

        // Test Ollama
        console.log('Testing Ollama...');
        const ollamaResult = await testOllama(question, context);
        console.log(`✓ Ollama: ${ollamaResult.duration}ms`);

        // Test vLLM
        console.log('Testing vLLM...');
        const vllmResult = await testVLLM(question, context);
        console.log(`✓ vLLM: ${vllmResult.duration}ms`);

        results.push({
            question,
            ollama: ollamaResult,
            vllm: vllmResult,
            speedDiff: ollamaResult.duration - vllmResult.duration
        });

        console.log(`\nOllama Answer: ${ollamaResult.answer.substring(0, 200)}...`);
        console.log(`vLLM Answer: ${vllmResult.answer.substring(0, 200)}...`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const ollamaAvg = results.reduce((sum, r) => sum + r.ollama.duration, 0) / results.length;
    const vllmAvg = results.reduce((sum, r) => sum + r.vllm.duration, 0) / results.length;

    console.log(`\nAverage Response Time:`);
    console.log(`  Ollama: ${ollamaAvg.toFixed(0)}ms`);
    console.log(`  vLLM:   ${vllmAvg.toFixed(0)}ms`);
    console.log(`  Winner: ${vllmAvg < ollamaAvg ? 'vLLM' : 'Ollama'} (${Math.abs(ollamaAvg - vllmAvg).toFixed(0)}ms faster)`);

    console.log(`\nTotal Time:`);
    console.log(`  Ollama: ${(results.reduce((sum, r) => sum + r.ollama.duration, 0) / 1000).toFixed(1)}s`);
    console.log(`  vLLM:   ${(results.reduce((sum, r) => sum + r.vllm.duration, 0) / 1000).toFixed(1)}s`);

    // Save results
    const fs = require('fs');
    fs.writeFileSync('llm-comparison-results.json', JSON.stringify(results, null, 2));
    console.log(`\n✓ Results saved to llm-comparison-results.json`);
}

runComparison().catch(console.error);
