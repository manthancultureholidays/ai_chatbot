const fs = require('fs');
const path = require('path');

exports.getStats = async (req, res) => {
    try {
        const agentDataPath = path.join(__dirname, '..', 'data', 'agentData.json');
        const agentData = JSON.parse(fs.readFileSync(agentDataPath, 'utf8'));
        
        const stats = {
            totalAgents: agentData.length,
            companies: [...new Set(agentData.map(a => a.Comp_Name))].length,
            nationalities: [...new Set(agentData.map(a => a.Nationality))].length
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
};
