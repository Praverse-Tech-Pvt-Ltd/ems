import os
import json
import base64
import gzip
import re

html_path = "NEX EMS Redesign (Standalone).html"
output_dir = "unpacked"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(html_path, "r", encoding="utf-8") as f:
    content = f.read()

# Extract manifest
manifest_match = re.search(r'<script type="__bundler/manifest">(.*?)</script>', content, re.DOTALL)
if not manifest_match:
    print("Could not find manifest!")
    exit(1)

manifest_json = json.loads(manifest_match.group(1).strip())

# Extract template
template_match = re.search(r'<script type="__bundler/template">(.*?)</script>', content, re.DOTALL)
if not template_match:
    print("Could not find template!")
    exit(1)

template_str = json.loads(template_match.group(1).strip())

# Extract ext_resources
ext_match = re.search(r'<script type="__bundler/ext_resources">(.*?)</script>', content, re.DOTALL)
ext_resources = json.loads(ext_match.group(1).strip()) if ext_match else []

# Save manifest files
print(f"Unpacking {len(manifest_json)} assets...")
for uuid, entry in manifest_json.items():
    data = base64.b64decode(entry["data"])
    if entry.get("compressed", False):
        try:
            data = gzip.decompress(data)
        except Exception as e:
            print(f"Failed to decompress {uuid}: {e}")
            
    # Try to determine file extension
    mime = entry["mime"]
    ext = "bin"
    if "javascript" in mime or "json" in mime:
        ext = "js"
    elif "css" in mime:
        ext = "css"
    elif "html" in mime:
        ext = "html"
    elif "png" in mime:
        ext = "png"
    elif "svg" in mime:
        ext = "svg"
    elif "woff2" in mime:
        ext = "woff2"
        
    filename = f"{uuid}.{ext}"
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, "wb") as out_f:
        out_f.write(data)
    print(f"Saved {filename} ({len(data)} bytes)")

# Save template.html
with open(os.path.join(output_dir, "template.html"), "w", encoding="utf-8") as out_f:
    out_f.write(template_str)

# Save metadata
metadata = {
    "ext_resources": ext_resources,
    "manifest_info": {uuid: {"mime": entry["mime"], "compressed": entry.get("compressed", False)} for uuid, entry in manifest_json.items()}
}
with open(os.path.join(output_dir, "metadata.json"), "w", encoding="utf-8") as out_f:
    json.dump(metadata, out_f, indent=2)

print("Unpacking complete!")
