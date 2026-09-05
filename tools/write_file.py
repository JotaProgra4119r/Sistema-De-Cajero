import sys

def main():
    if len(sys.argv) < 3:
        print('Usage: python write_file.py <target_path> <content_file>')
        sys.exit(1)
    target = sys.argv[1]
    content_file = sys.argv[2]
    with open(content_file, 'r', encoding='utf-8') as src:
        content = src.read()
    with open(target, 'w', encoding='utf-8') as dst:
        dst.write(content)
    print(f'Wrote {len(content)} chars to {target}')

if __name__ == '__main__':
    main()
