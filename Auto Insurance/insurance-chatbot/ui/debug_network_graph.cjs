const fs = require('fs');
const path = 'c:\\Users\\hverlee\\OneDrive - Progress Software Corporation\\Progress\\Development\\corticon-demos-marklogic\\Auto Insurance\\insurance-chatbot\\ui\\node_modules\\ml-fasttrack\\dist\\index.es.js';

try {
  const content = fs.readFileSync(path, 'utf8');
  // Search for the component definition. It usually looks like "const NetworkGraph =" or "function NetworkGraph" or inside the export list.
  // Since it's minified/bundled, looking for the string "NetworkGraph" might give us where it's defined or exported.
  // We look for "var NetworkGraph" or "const NetworkGraph" or "function NetworkGraph"
  
  const regex = /(var|const|function)\s+NetworkGraph\s*=/g;
  let match;
  let found = false;
  
  while ((match = regex.exec(content)) !== null) {
      console.log(`Found "${match[0]}" at index ${match.index}`);
      console.log('Context:');
      console.log(content.substring(Math.max(0, match.index - 100), Math.min(content.length, match.index + 1000)));
      found = true;
  }

  if (!found) {
     // fallback: find where "NetworkGraph" is mentioned
     const idx = content.indexOf("NetworkGraph");
     if (idx !== -1) {
         console.log(`Found "NetworkGraph" at index ${idx}`);
         console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 1000)));
     }
  }

} catch (e) {
  console.error(e);
}
