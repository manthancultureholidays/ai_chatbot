const fs = require('fs');
const path = require('path');

const agentDataPath = path.join(__dirname, 'data', 'agentData.json');
const agentData = JSON.parse(fs.readFileSync(agentDataPath, 'utf8'));

console.log(`Total agents loaded: ${agentData.length}`);

const searchEmail = 'ashish.bhasin@travelchacha.com';
const found = agentData.find(a => a.UserName && a.UserName.toLowerCase() === searchEmail.toLowerCase());

if (found) {
    console.log('\n✓ EMAIL FOUND:');
    console.log(JSON.stringify(found, null, 2));
} else {
    console.log('\n✗ EMAIL NOT FOUND');
    console.log('\nSearching for partial match...');
    const partial = agentData.filter(a => a.UserName && a.UserName.toLowerCase().includes('ashish'));
    console.log(`Found ${partial.length} partial matches:`);
    partial.forEach(a => console.log(`  - ${a.UserName}`));
}
