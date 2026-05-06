const fs = require('fs');
const path = 'c:\\Users\\hverlee\\OneDrive - Progress Software Corporation\\Progress\\Development\\corticon-demos-marklogic\\Auto Insurance\\insurance-chatbot\\ui\\node_modules\\ml-fasttrack\\dist\\index.es.js';

try {
  const content = fs.readFileSync(path, 'utf8');
  const searchTerms = ['function NetworkGraph', 'const NetworkGraph', 'var NetworkGraph', 'NetworkGraph='];
  
  let found = false;
  for (const term of searchTerms) {
    const index = content.indexOf(term);
    if (index !== -1) {
      console.log(`Found "${term}" at index ${index}`);
      console.log('Context:');
      console.log(content.substring(Math.max(0, index - 100), Math.min(content.length, index + 1000)));
      found = true;
      break; // Stop after first match
    }
  }
  
  if (!found) {
      // Try searching for just "NetworkGraph" to see how it's exported
      const index = content.indexOf("NetworkGraph");
       if (index !== -1) {
            console.log(`Found "NetworkGraph" at index ${index}`);
            console.log(content.substring(Math.max(0, index - 100), Math.min(content.length, index + 1000)));
       } else {
           console.log('NetworkGraph not found');
       }
  }

} catch (e) {
  console.error(e);
}
