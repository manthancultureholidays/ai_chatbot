const axios = require('axios');
const logger = require('../config/logger');

class LLMService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL;
        this.ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:latest';
        this.fallbackUrl = process.env.FALLBACK_LLM_URL;
        this.fallbackType = process.env.FALLBACK_LLM_TYPE || 'vllm';
        this.fallbackModel = process.env.FALLBACK_MODEL || 'meta-llama/Llama-2-7b-chat-hf';
        this.timeout = parseInt(process.env.LLM_TIMEOUT) || 30000;
        this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES) || 2;
    }

    async generateWithOllama(prompt, res) {
        if (!this.ollamaUrl) {
            throw new Error('Ollama URL not configured');
        }

        const response = await fetch(this.ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.ollamaModel,
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
    }

    async generateWithVLLM(prompt, res) {
        const response = await axios.post(this.fallbackUrl, {
            model: this.fallbackModel,
            prompt: prompt,
            max_tokens: 500,
            temperature: 0.7,
            stream: false
        }, {
            timeout: this.timeout,
            headers: { 'Content-Type': 'application/json' }
        });

        const text = response.data.choices[0].text;
        res.write(text);
        res.end();
    }

    async generate(prompt, res, retryCount = 0) {
        // If Ollama is configured, try it first
        if (this.ollamaUrl) {
            try {
                logger.info('Attempting LLM generation', { service: 'ollama', retry: retryCount });
                await this.generateWithOllama(prompt, res);
                return { success: true, service: 'ollama' };
            } catch (error) {
                logger.warn('Ollama failed', { error: error.message, retry: retryCount });

                if (retryCount < this.maxRetries) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    logger.info('Retrying Ollama', { delay, retry: retryCount + 1 });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.generate(prompt, res, retryCount + 1);
                }
            }
        } else {
            logger.info('Ollama not configured, using fallback directly');
        }

        // Try fallback LLM
        if (this.fallbackUrl) {
            try {
                logger.info('Switching to fallback LLM', { service: this.fallbackType });
                
                if (this.fallbackType === 'ollama') {
                    await this.generateWithOllamaFallback(prompt, res);
                } else {
                    await this.generateWithVLLM(prompt, res);
                }
                
                return { success: true, service: this.fallbackType };
            } catch (fallbackError) {
                logger.error('Fallback LLM failed', { error: fallbackError.message });
                throw new Error('All LLM services unavailable');
            }
        }

        throw new Error('No LLM service configured');
    }

    async generateWithOllamaFallback(prompt, res) {
        const response = await fetch(this.fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.fallbackModel,
                prompt: prompt,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Fallback Ollama returned ${response.status}`);
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
    }
}

module.exports = new LLMService();
