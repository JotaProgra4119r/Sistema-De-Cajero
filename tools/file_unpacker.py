import base64, json, os, sys

bundle_file = sys.argv[1] if len(sys.argv) > 1 else 'tools/bundle.jsonl'
with open(bundle_file, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        path = data['path']
        content = base64.b64decode(data['b64'])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as out:
            out.write(content)
        print('Unpacked:', path)
print('All files unpacked successfully.')