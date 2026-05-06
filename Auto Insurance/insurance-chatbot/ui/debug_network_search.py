import os

path = r'c:\Users\hverlee\OneDrive - Progress Software Corporation\Progress\Development\corticon-demos-marklogic\Auto Insurance\insurance-chatbot\ui\node_modules\ml-fasttrack\dist\index.es.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    term = "NetworkGraph"
    start = 0
    while True:
        idx = content.find(term, start)
        if idx == -1:
            break
        
        # Print context around the match
        snippet = content[max(0, idx - 100) : min(len(content), idx + 300)]
        print(f"Match at {idx}:")
        print(snippet)
        print("-" * 50)
        
        start = idx + 1
        if start > len(content):
            break
            
except Exception as e:
    print(f"Error: {e}")
