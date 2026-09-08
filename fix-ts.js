const fs = require('fs');

const fixDuplicates = (pathStr) => {
    let content = fs.readFileSync(pathStr, 'utf-8');
    const importRegex1 = /import \{ apiErrorResponse, logError \} from "@\/app\/lib\/error-handler";\n/g;
    const importRegex2 = /import \{ apiErrorResponse \} from "@\/app\/lib\/error-handler";\n/g;
    const importRegex3 = /import \{ logError \} from "@\/app\/lib\/error-handler";\n/g;
    
    // Clean all imports
    content = content.replace(importRegex1, '');
    content = content.replace(importRegex2, '');
    content = content.replace(importRegex3, '');
    
    // Add one master import at the top (after other imports)
    const masterImport = 'import { apiErrorResponse, logError } from "@/app/lib/error-handler";\n';
    let importIdx = content.lastIndexOf('import ');
    if (importIdx !== -1) {
        const endOfLine = content.indexOf('\n', importIdx);
        content = content.slice(0, endOfLine + 1) + masterImport + content.slice(endOfLine + 1);
    } else {
        content = masterImport + content;
    }
    fs.writeFileSync(pathStr, content);
}

fixDuplicates('d:/automate-learning-portal/app/api/admin/courses/route.ts');
fixDuplicates('d:/automate-learning-portal/app/api/admin/products/route.ts');
fixDuplicates('d:/automate-learning-portal/app/api/mentor-planner/generate-meet/route.ts');

const fixChat = (pathStr) => {
    let content = fs.readFileSync(pathStr, 'utf-8');
    content = content.replace(/, errorId: logError\(err\)\.id/g, '');
    fs.writeFileSync(pathStr, content);
}

fixChat('d:/automate-learning-portal/app/actions/community-chat.ts');
