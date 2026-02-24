const fs = require('fs');
const path = require('path');

function aggressiveRecover(filePath) {
    console.log(`Aggressively recovering ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Basic character fixes first
    content = content.replace(/"LOGINDA TE"/g, '"LOGINDATE"');
    content = content.replace(/"AGEN TID"/g, '"AGENTID"');
    content = content.replace(/(\d{4}-\d{2}-\d{2}T\d{2}):\s*(\d{2}):\s*(\d{2}\.?\d*)/g, '$1:$2:$3');

    // 2. Try to find all segments that look like { ... }
    // This is useful if the file is a mess of partial objects
    const matches = content.match(/\{[^{}]+\}/g);

    if (!matches) {
        console.error(`No valid segments found in ${filePath}`);
        return;
    }

    const validObjects = [];
    matches.forEach(segment => {
        try {
            // Clean up internal newlines/spaces in the segment
            let cleanSegment = segment.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ");
            // Fix trailing commas inside the segment if any
            cleanSegment = cleanSegment.replace(/,\s*}/g, '}');

            const obj = JSON.parse(cleanSegment);
            validObjects.push(obj);
        } catch (e) {
            // Segment was still invalid, skip it
        }
    });

    if (validObjects.length > 0) {
        fs.writeFileSync(filePath, JSON.stringify(validObjects, null, 2), 'utf8');
        console.log(`Recovered ${validObjects.length} objects for ${filePath}`);
    } else {
        console.error(`Failed to recover any valid objects for ${filePath}`);
    }
}

const dataDir = path.join(__dirname, 'backend', 'data');
aggressiveRecover(path.join(dataDir, 'agentData.json'));
aggressiveRecover(path.join(dataDir, 'agentLoginData.json'));
