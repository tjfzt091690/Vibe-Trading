import os
import chardet


def detect_encoding(file_path):
    with open(file_path, 'rb') as f:
        raw = f.read()
    result = chardet.detect(raw)
    return result['encoding']


def convert_gbk_to_utf8(file_path):
    with open(file_path, 'r', encoding='gbk') as f:
        content = f.read()
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


def scan_and_convert(directory):
    converted = 0
    skipped = 0
    errors = 0

    for root, dirs, files in os.walk(directory):
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                encoding = detect_encoding(file_path)
                if encoding and encoding.upper() in ('GBK', 'GB2312', 'GB18030'):
                    convert_gbk_to_utf8(file_path)
                    print(f"[convert] {file_path}  ({encoding} -> UTF-8)")
                    converted += 1
                else:
                    print(f"[pass] {file_path}  (encoding: {encoding})")
                    skipped += 1
            except Exception as e:
                print(f"[error] {file_path}  ({e})")
                errors += 1

    print(f"\ndone:  converted{converted} ,  skipped{skipped} , errors {errors} ")


if __name__ == '__main__':
    files = [
        r'C:\Users\FOOLZT\Documents\projects\Vibe-Trading\agent\backtest\engines\base.py',
        r'C:\Users\FOOLZT\Documents\projects\Vibe-Trading\agent\backtest\engines\global_futures.py',
    ]

    for fpath in files:
        with open(fpath, 'rb') as fh:
            raw = fh.read()
        # Try: decode as latin-1, then encode as latin-1 to get original bytes, then decode as utf-8
        try:
            text_latin1 = raw.decode('latin-1')
            re_encoded = text_latin1.encode('latin-1')
            text_utf8 = re_encoded.decode('utf-8')
            print(f'{os.path.basename(fpath)}: double-encoding fix works! First 200 chars:')
            print(text_utf8[:200])
            print()
        except Exception as e:
            print(f'{os.path.basename(fpath)}: double-encoding fix failed: {e}')

