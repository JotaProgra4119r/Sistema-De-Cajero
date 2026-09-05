import os
import json

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')
    print('Wrote:', path)

# 1. Package inits
write('backend/__init__.py', '')
write('backend/app/__init__.py', '')
write('backend/app/core/__init__.py', '')
write('backend/app/db/__init__.py', '')
write('backend/app/services/__init__.py', '')
write('backend/app/hardware/__init__.py', '')
write('backend/app/storage_txt/__init__.py', '')
write('backend/app/api/__init__.py', '')
write('backend/tests/__init__.py', '')

print('Package inits done.')
