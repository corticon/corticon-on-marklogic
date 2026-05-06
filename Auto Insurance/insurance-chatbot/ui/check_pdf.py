import os
import zlib

path = r'C:\Users\hverlee\OneDrive - Progress Software Corporation\Progress\Development\corticon-demos-marklogic\DEV documentation\develop_with_fasttrack_2026-01-09-13-51-42.pdf'

print(f"Checking {path}")
if os.path.exists(path):
    size = os.path.getsize(path)
    print(f"File exists, size: {size}")
    
    try:
        with open(path, 'rb') as f:
            data = f.read()
            
        term = b"NetworkGraph"
        if term in data:
            print("Found 'NetworkGraph' literal!")
            count = data.count(term)
            print(f"Count: {count}")
            # print surrounding
            idx = data.find(term)
            start = max(0, idx - 100)
            end = min(len(data), idx + 200)
            print(f"Context: {data[start:end]}")
        else:
            print("Literal 'NetworkGraph' not found. Scanning compressed streams...")
            # Try to decompress all streams
            import re
            stream_pattern = re.compile(b'stream[\r\n]+(.*?)[\r\n]+endstream', re.DOTALL)
            found_in_streams = 0
            
            for match in stream_pattern.finditer(data):
                chunk = match.group(1)
                try:
                    decompressed = zlib.decompress(chunk)
                    if term in decompressed:
                        found_in_streams += 1
                        print(f"Found in stream! Context:")
                        idx = decompressed.find(term)
                        start = max(0, idx - 100)
                        end = min(len(decompressed), idx + 300)
                        print(decompressed[start:end])
                except:
                    pass
            
            if found_in_streams == 0:
                print("Not found in compressed streams either.")

    except Exception as e:
        print(f"Error reading file: {e}")
else:
    print("File not found.")
