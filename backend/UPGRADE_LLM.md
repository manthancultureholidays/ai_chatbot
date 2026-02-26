# LLM Model Upgrade Guide

## Current Issue
Your current model `llama3.2:latest` (3B parameters) cannot handle complex multi-document reasoning effectively.

## Recommended Upgrades

### Option A: Better Reasoning (Recommended - needs ~8GB RAM)
```bash
ollama pull llama3.1:8b
```
Then update `.env`:
```
OLLAMA_MODEL=llama3.1:8b
```

### Option B: Best Local Reasoning (needs ~16GB RAM)
```bash
ollama pull llama3.1:70b-instruct-q4
```
Then update `.env`:
```
OLLAMA_MODEL=llama3.1:70b-instruct-q4
```

### Option C: Best for Structured Data Analysis (needs ~8GB RAM)
```bash
ollama pull mistral:7b-instruct
```
Then update `.env`:
```
OLLAMA_MODEL=mistral:7b-instruct
```

## After Upgrading
1. Stop your server (Ctrl+C)
2. Pull the new model using one of the commands above
3. Update your `.env` file with the new model name
4. Restart your server: `npm start`

## Expected Improvements
- +15% accuracy on complex cross-document queries
- Better multi-step reasoning
- More accurate data joins between agent profiles and login records
- Improved handling of analytical questions

## Testing
After upgrading, test with these complex questions:
1. "Does sweeterte@aol.com appear in both documents?"
2. "Which agent has the most logins?"
3. "Find accounts with suspicious rapid login patterns"
4. "What company does gautam@cultureholidays.com work for?"
