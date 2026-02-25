class AnswerExtractor {
    extractAnswer(question, context) {
        const questionLower = question.toLowerCase().trim();
        const agents = this._parseAgents(context);
        
        if (agents.length === 0) {
            return "No information found in the database.";
        }
        
        // Priority order for query detection
        if (this._isCountQuery(questionLower)) {
            return this._answerCountQuery(questionLower, agents);
        }
        if (this._isLoginQuery(questionLower)) {
            return this._answerLoginQuery(questionLower, agents);
        }
        if (this._isCompanyQuery(questionLower)) {
            return this._answerCompanyQuery(questionLower, agents);
        }
        if (this._isEmailQuery(questionLower)) {
            return this._answerEmailQuery(questionLower, agents);
        }
        if (this._isAgentIDQuery(questionLower)) {
            return this._answerAgentIDQuery(questionLower, agents);
        }
        if (this._isNationalityQuery(questionLower)) {
            return this._answerNationalityQuery(questionLower, agents);
        }
        if (this._isListQuery(questionLower)) {
            return this._answerListQuery(questionLower, agents);
        }
        
        // Default: show basic info
        return this._formatAgentInfo(agents[0]);
    }
    
    _parseAgents(context) {
        const agentBlocks = context.split('---').map(b => b.trim());
        return agentBlocks.map(block => {
            const agent = {};
            block.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                if (line.includes('- Name:')) agent.name = value;
                if (line.includes('- Email:')) agent.email = value;
                if (line.includes('- AgentID:')) agent.agentID = value;
                if (line.includes('- Company:')) agent.company = value;
                if (line.includes('- Nationality:')) agent.nationality = value;
                if (line.includes('- Last Login Date:')) agent.lastLogin = value;
                if (line.includes('- Total Logins:')) agent.totalLogins = value;
                if (line.includes('- Registration Date:')) agent.regDate = value;
            });
            return agent;
        }).filter(a => a.name);
    }
    
    _isCountQuery(q) {
        return /total|count|how many|number of|all candidates|all agents/i.test(q);
    }
    
    _isLoginQuery(q) {
        return /login|last\s*login|login\s*time|login\s*date|when.*log/i.test(q);
    }
    
    _isCompanyQuery(q) {
        return /company|work.*at|works.*at|employed|organization|firm/i.test(q);
    }
    
    _isEmailQuery(q) {
        return /email|contact|mail|reach/i.test(q);
    }
    
    _isAgentIDQuery(q) {
        return /agent\s*id|agentid|id\s*is|identification/i.test(q);
    }
    
    _isNationalityQuery(q) {
        return /nationality|country|from\s*where|origin/i.test(q);
    }
    
    _isListQuery(q) {
        return /list|all|show.*all|give.*all|candidates|employees|agents|people|members/i.test(q);
    }
    
    _answerCountQuery(q, agents) {
        // If asking about total in entire database
        if (/total.*database|all.*database|how many.*total|entire database/i.test(q)) {
            const fs = require('fs');
            const path = require('path');
            try {
                const agentDataPath = path.join(__dirname, '..', 'data', 'agentData.json');
                const allAgents = JSON.parse(fs.readFileSync(agentDataPath, 'utf8'));
                return `Total candidates in the database: ${allAgents.length}`;
            } catch (error) {
                return `Unable to count total database records. Found ${agents.length} matching your query.`;
            }
        }
        
        // Count for specific company
        const company = agents[0].company;
        const allSameCompany = agents.every(a => a.company === company);
        
        if (allSameCompany) {
            return `There are ${agents.length} agent(s) from ${company}.`;
        }
        
        return `Found ${agents.length} agent(s) matching your query.`;
    }
    
    _answerLoginQuery(q, agents) {
        if (agents.length === 1) {
            const a = agents[0];
            if (a.lastLogin) {
                return `${a.name} last logged in on ${a.lastLogin}.${a.totalLogins ? ` Total logins: ${a.totalLogins}` : ''}`;
            }
            return `No login information available for ${a.name}. Login records may not be linked to AgentID ${a.agentID}.`;
        }
        return agents.map(a => `${a.name}: ${a.lastLogin || 'No login data'}`).join('\n');
    }
    
    _answerCompanyQuery(q, agents) {
        const nameInQuery = this._extractNameFromQuery(q);
        
        if (nameInQuery && agents.length > 1) {
            const match = agents.find(a => 
                a.name.toLowerCase().includes(nameInQuery) ||
                nameInQuery.split(' ').every(part => a.name.toLowerCase().includes(part))
            );
            if (match) {
                return `${match.name} works at ${match.company}.`;
            }
        }
        
        if (agents.length === 1) {
            return `${agents[0].name} works at ${agents[0].company}.`;
        }
        
        // Multiple agents - group by company
        const byCompany = {};
        agents.forEach(a => {
            if (!byCompany[a.company]) byCompany[a.company] = [];
            byCompany[a.company].push(a.name);
        });
        
        if (Object.keys(byCompany).length === 1) {
            const company = Object.keys(byCompany)[0];
            return `Agents from ${company}:\n\n` + byCompany[company].map((n, i) => `${i + 1}. ${n}`).join('\n');
        }
        
        return agents.map((a, i) => `${i + 1}. ${a.name} - ${a.company}`).join('\n');
    }
    
    _answerEmailQuery(q, agents) {
        if (agents.length === 1) {
            return `${agents[0].name}'s email: ${agents[0].email}`;
        }
        return agents.map(a => `${a.name}: ${a.email}`).join('\n');
    }
    
    _answerAgentIDQuery(q, agents) {
        if (agents.length === 1) {
            return `${agents[0].name}'s AgentID: ${agents[0].agentID}`;
        }
        return agents.map(a => `${a.name}: ${a.agentID}`).join('\n');
    }
    
    _answerNationalityQuery(q, agents) {
        if (agents.length === 1) {
            return `${agents[0].name} is from ${agents[0].nationality}.`;
        }
        return agents.map(a => `${a.name}: ${a.nationality}`).join('\n');
    }
    
    _answerListQuery(q, agents) {
        if (agents.length === 1) {
            return this._formatAgentInfo(agents[0]);
        }
        
        const company = agents[0].company;
        const allSameCompany = agents.every(a => a.company === company);
        
        if (allSameCompany) {
            return `Agents from ${company}:\n\n` + agents.map((a, i) => `${i + 1}. ${a.name}`).join('\n');
        }
        
        return `Found ${agents.length} agents:\n\n` + agents.map((a, i) => `${i + 1}. ${a.name} (${a.company})`).join('\n');
    }
    
    _extractNameFromQuery(q) {
        const stopWords = ['what', 'is', 'the', 'of', 'for', 'company', 'name', 'candidate', 
                          'work', 'at', 'works', 'given', 'this', 'tell', 'me', 'about',
                          'who', 'where', 'when', 'how', 'does', 'do', 'can', 'will'];
        const words = q.split(/\s+/).filter(w => !stopWords.includes(w.toLowerCase()));
        return words.join(' ');
    }
    
    _extractCompanyFromQuery(q) {
        const companyWords = ['company', 'firm', 'organization'];
        const words = q.split(/\s+/);
        const companyIndex = words.findIndex(w => companyWords.includes(w.toLowerCase()));
        if (companyIndex > 0) {
            return words.slice(0, companyIndex).join(' ');
        }
        return null;
    }
    
    _formatAgentInfo(agent) {
        let info = `Name: ${agent.name}\n`;
        info += `Company: ${agent.company}\n`;
        info += `Email: ${agent.email}\n`;
        info += `AgentID: ${agent.agentID}\n`;
        if (agent.nationality) info += `Nationality: ${agent.nationality}\n`;
        if (agent.lastLogin) info += `Last Login: ${agent.lastLogin}\n`;
        return info.trim();
    }
}

module.exports = new AnswerExtractor();
