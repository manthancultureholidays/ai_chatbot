const fs = require('fs');
const path = require('path');

class VectorService {
    constructor() {
        const agentDataPath = path.join(__dirname, '..', 'data', 'agentData.json');
        const agentLoginPath = path.join(__dirname, '..', 'data', 'agentLoginData.json');

        this.agentData = fs.existsSync(agentDataPath) ? JSON.parse(fs.readFileSync(agentDataPath, 'utf8')) : [];
        this.agentLoginData = fs.existsSync(agentLoginPath) ? JSON.parse(fs.readFileSync(agentLoginPath, 'utf8')) : [];

        this._buildIndexes();
        this.searchCache = new Map(); // Cache search results
    }

    _buildIndexes() {
        this.agentByEmail = new Map();
        this.agentByID = new Map();
        this.agentByName = new Map(); // Add name index
        this.loginsByIdentifier = new Map();
        this.searchIndex = new Map();

        this.agentData.forEach(agent => {
            if (agent.UserName) {
                this.agentByEmail.set(agent.UserName.toLowerCase(), agent);
            }
            if (agent.AgentID) {
                this.agentByID.set(agent.AgentID.toLowerCase(), agent);
            }
            if (agent.Name) {
                this.agentByName.set(agent.Name.toLowerCase(), agent);
            }

            const tokens = this._tokenize(`${agent.Name} ${agent.UserName} ${agent.AgentID} ${agent.Comp_Name}`);
            tokens.forEach(token => {
                if (!this.searchIndex.has(token)) {
                    this.searchIndex.set(token, new Set());
                }
                this.searchIndex.get(token).add(agent.AgentID);
            });
        });

        this.agentLoginData.forEach(login => {
            if (!login.AGENTID) return;
            const key = login.AGENTID.toLowerCase();
            if (!this.loginsByIdentifier.has(key)) {
                this.loginsByIdentifier.set(key, []);
            }
            this.loginsByIdentifier.get(key).push(login);
        });

        console.log(`Indexed ${this.agentByEmail.size} agents, ${this.searchIndex.size} keywords`);
    }

    _tokenize(text) {
        return text.toLowerCase()
            .split(/\s+/)
            .filter(t => t.length > 2);
    }

    _levenshtein(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                matrix[j][i] = b[j - 1] === a[i - 1] ? matrix[j - 1][i - 1] :
                    Math.min(matrix[j - 1][i - 1], matrix[j][i - 1], matrix[j - 1][i]) + 1;
            }
        }
        return matrix[b.length][a.length];
    }

    _fuzzyMatch(query, target, threshold = 0.7) {
        const distance = this._levenshtein(query.toLowerCase(), target.toLowerCase());
        const maxLen = Math.max(query.length, target.length);
        return 1 - (distance / maxLen) >= threshold;
    }

    _findAgentByIdentifier(identifier) {
        if (!identifier) return null;
        const lower = identifier.toLowerCase();
        return this.agentByEmail.get(lower) || this.agentByID.get(lower) || null;
    }

    _getLoginHistory(identifier) {
        if (!identifier) return [];
        return this.loginsByIdentifier.get(identifier.toLowerCase()) || [];
    }

    _extractIdentifiers(query) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        const agentIDRegex = /-?CHAGT\d+/gi;

        const emails = query.match(emailRegex) || [];
        const agentIDs = query.match(agentIDRegex) || [];

        return { emails, agentIDs };
    }

    async search(query) {
        const cacheKey = query.toLowerCase().trim();
        if (this.searchCache.has(cacheKey)) {
            return this.searchCache.get(cacheKey);
        }

        const { emails, agentIDs } = this._extractIdentifiers(query);
        const results = [];
        const foundAgentIDs = new Set();

        // 1. Direct lookup (O(1))
        [...emails, ...agentIDs].forEach(identifier => {
            const agent = this._findAgentByIdentifier(identifier);
            if (agent && !foundAgentIDs.has(agent.AgentID)) {
                foundAgentIDs.add(agent.AgentID);
                results.push({
                    id: agent.AgentID,
                    content: this._buildAgentContent(agent),
                    score: 100
                });
            } else {
                // Check if it's a login-only record
                const logins = this._getLoginHistory(identifier);
                if (logins.length > 0) {
                    const sorted = logins.sort((a, b) => new Date(b.LOGINDATE) - new Date(a.LOGINDATE));
                    const content = `Login Information for ${identifier}:
- Last Login Date: ${sorted[0].LOGINDATE}
- Total Logins: ${logins.length}
- Note: No agent profile found in database
`;
                    results.push({ id: identifier, content, score: 100 });
                }
            }
        });

        // 2. Inverted index search
        if (results.length === 0) {
            const tokens = this._tokenize(query).filter(t =>
                !['what', 'is', 'the', 'of', 'for', 'tell', 'me', 'whose', 'with', 'ends', 'starts', 'agent', 'details', 'give', 'all', 'last', 'login', 'date', 'full'].includes(t)
            );

            // Try exact name match first
            const queryName = tokens.join(' ');
            for (const [name, agent] of this.agentByName) {
                if (name.includes(queryName) || queryName.includes(name.split(' ')[0])) {
                    if (!foundAgentIDs.has(agent.AgentID)) {
                        foundAgentIDs.add(agent.AgentID);
                        results.push({
                            id: agent.AgentID,
                            content: this._buildAgentContent(agent),
                            score: 100
                        });
                    }
                }
            }

            // Fuzzy name matching for typos
            if (results.length === 0 && tokens.length > 0) {
                const fuzzyMatches = [];
                for (const [name, agent] of this.agentByName) {
                    const nameParts = name.split(' ');
                    let matchScore = 0;
                    tokens.forEach(token => {
                        nameParts.forEach(part => {
                            if (this._fuzzyMatch(token, part, 0.6)) matchScore++;
                        });
                    });
                    if (matchScore > 0) {
                        fuzzyMatches.push({ agent, score: matchScore });
                    }
                }
                fuzzyMatches.sort((a, b) => b.score - a.score).slice(0, 5).forEach(match => {
                    if (!foundAgentIDs.has(match.agent.AgentID)) {
                        foundAgentIDs.add(match.agent.AgentID);
                        results.push({
                            id: match.agent.AgentID,
                            content: this._buildAgentContent(match.agent),
                            score: 90
                        });
                    }
                });
            }

            // Fallback to token matching
            if (results.length === 0) {
                const agentScores = new Map();
                tokens.forEach(token => {
                    const matchingIDs = this.searchIndex.get(token);
                    if (matchingIDs) {
                        matchingIDs.forEach(agentID => {
                            agentScores.set(agentID, (agentScores.get(agentID) || 0) + 1);
                        });
                    }
                });

                Array.from(agentScores.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .forEach(([agentID, score]) => {
                        const agent = this.agentByID.get(agentID.toLowerCase());
                        if (agent) {
                            results.push({
                                id: agentID,
                                content: this._buildAgentContent(agent),
                                score: score * 20
                            });
                        }
                    });
            }
        }

        // Cache results
        if (this.searchCache.size > 100) {
            const firstKey = this.searchCache.keys().next().value;
            this.searchCache.delete(firstKey);
        }
        this.searchCache.set(cacheKey, results);

        return results;
    }

    _buildAgentContent(agent) {
        let content = `Agent Information:
- Name: ${agent.Name || 'N/A'}
- Email: ${agent.UserName || 'N/A'}
- AgentID: ${agent.AgentID || 'N/A'}
- Company: ${agent.Comp_Name || 'N/A'}
- Nationality: ${agent.Nationality || 'N/A'}
- Registration Date: ${agent.CreatedDate || 'N/A'}
`;

        const logins = [...(this._getLoginHistory(agent.UserName) || []), ...(this._getLoginHistory(agent.AgentID) || [])];
        if (logins.length > 0) {
            const sorted = logins.sort((a, b) => new Date(b.LOGINDATE) - new Date(a.LOGINDATE));
            content += `- Last Login Date: ${sorted[0].LOGINDATE}\n- Total Logins: ${logins.length}\n`;
        } else if (agent.LastLogin) {
            content += `- Last Login Date: ${agent.LastLogin}\n`;
        }

        return content;
    }
}

module.exports = new VectorService();
