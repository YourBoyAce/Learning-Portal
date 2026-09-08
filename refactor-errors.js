const fs = require('fs');
const path = require('path');

const ACTIONS_DIR = path.join(__dirname, 'app', 'actions');
const API_DIR = path.join(__dirname, 'app', 'api');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath, callback);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            callback(fullPath);
        }
    }
}

function processApi(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Handle `{ error: "Some prefix: " + err.message }`
    const regex = /\{\s*error:\s*['"`][^'"`]*['"`]\s*\+\s*([a-zA-Z0-9_]+)\.message\s*\}/g;
    content = content.replace(regex, (match, errVar) => {
        return `{ error: require("@/app/lib/error-handler").logError(${errVar}).message }`;
    });

    if (content !== original) {
        let importIdx = content.lastIndexOf('import ');
        if (!content.includes(`import { logError } from "@/app/lib/error-handler";`) && importIdx !== -1) {
            const endOfLine = content.indexOf('\n', importIdx);
            content = content.slice(0, endOfLine + 1) + `import { logError } from "@/app/lib/error-handler";` + '\n' + content.slice(endOfLine + 1);
        }
        content = content.replace(/require\("@\/app\/lib\/error-handler"\)\./g, '');
        fs.writeFileSync(filePath, content);
        console.log(`Updated string concat edge case: ${filePath}`);
    }
}

walkDir(API_DIR, processApi);
walkDir(ACTIONS_DIR, processApi);
console.log('Done fixing string concats.');
