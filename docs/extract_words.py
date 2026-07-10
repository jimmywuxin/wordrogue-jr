#!/usr/bin/env python3
"""
粤教粤人版 4-6 年级英语 PDF → words.js

依赖: pip3 install --user pdfplumber

输出:
  src/data/words-extracted.js  (EXTRACTED_WORDS,带 grade/unit)
  src/data/levels-extracted.js  (EXTRACTED_LEVELS,按 unit 一个关卡)

策略:
  1. 找 PDF 末段 "Vocabulary (by unit)" 页
  2. 按 "Unit N" 切段
  3. 每段内按行解析 "英文 中文"(支持多词短语 ice-skating/go to bed)
  4. 5 本 PDF 抽完去重 + 按 unit 聚合
"""

import json
import re
import sys
from pathlib import Path

TEXTBOOK_DIR = Path(__file__).parent.parent / 'textbook'
WORDS_FILE = Path(__file__).parent.parent / 'src' / 'data' / 'words-extracted.js'
LEVELS_FILE = Path(__file__).parent.parent / 'src' / 'data' / 'levels-extracted.js'

# 5 本有效 PDF (g4-lower-1 是冲突副本下不到,g4-lower-2 文件损坏)
# 上册 unit 1-N/2,下册 unit N/2+1 ... 我们按出现顺序重新编号
GRADE_MAP = {
    'g4-upper.pdf': 4,
    'g5-upper.pdf': 5,
    'g5-lower.pdf': 5,
    'g6-upper.pdf': 6,
    'g6-lower.pdf': 6,
}

# 简易 emoji 占位(后期可换 PNG)。覆盖一些常见词,其他默认书本。
EMOJI_HINTS = {
    # 4 上
    'monday': '📅', 'tuesday': '📅', 'wednesday': '📅', 'thursday': '📅',
    'friday': '📅', 'saturday': '📅', 'sunday': '📅', 'week': '📅', 'today': '📅',
    'tomorrow': '📅', 'birthday': '🎂',
    'subject': '📚', 'english': '🇬🇧', 'chinese': '🇨🇳', 'music': '🎵', 'art': '🎨',
    'math': '➕', 'p.e.': '🏃', 'science': '🔬', 'like': '👍', 'and': '➕',
    'play': '⚽', 'study': '📚', 'paint': '🎨', 'sleep': '😴', 'write': '✍️',
    'run': '🏃', 'read': '📖', 'swim': '🏊', 'do': '✅', 'fish': '🐟', 'shh': '🤫',
    'get up': '⏰', 'have breakfast': '🍳', 'go to school': '🏫', 'have lunch': '🍱',
    'get home': '🏠', 'do homework': '📝', 'have dinner': '🍽️', 'go to bed': '🛏️',
    'lake': '🏞️', 'time': '⏰', 'wake up': '⏰', 'go to sleep': '😴',
    'twenty-one': '21️⃣', 'thirty': '🔢', 'forty': '🔢', 'fifty': '🔢', 'work': '💼',
    'eye': '👁️', 'ear': '👂', 'nose': '👃', 'mouth': '👄', 'hand': '✋',
    'arm': '💪', 'leg': '🦵', 'foot': '🦶', 'touch': '🖐️', 'open': '🚪',
    'close': '❌', 'body': '🧍', 'head': '🙂', 'dance': '💃',
    'computer game': '🎮', 'puzzle': '🧩', 'plane': '✈️', 'toy car': '🚗',
    'doll': '🪆', 'bear': '🐻', 'drum': '🥁', 'guitar': '🎸', 'long': '📏',
    'shout': '📢', 'think': '💭', 'exercise': '🤸', 'talk': '💬',
    'color': '🎨', 'cut': '✂️', 'thump': '👊', 'dad': '👨',
    'sweep': '🧹', 'floor': '⬜', 'clean': '🧽', 'window': '🪟',
    'wash': '🧼', 'dish': '🍽️', 'fold': '🧺', 'clothes': '👕',
    'busy': '😤', 'cook': '👨‍🍳', 'wait': '⏰', 'mom': '👩', 'ball': '⚽',
    'violin': '🎻', 'bus': '🚌', 'toy': '🧸',
    # 5 上
    'spring': '🌸', 'summer': '☀️', 'fall': '🍂', 'winter': '❄️',
    'sunny': '☀️', 'rainy': '🌧️', 'windy': '🌬️', 'cloudy': '☁️', 'hot': '🔥',
    'cold': '🥶', 'look at': '👀', 'flower': '🌸', 'leaves': '🍃', 'weather': '🌤️',
    'month': '📅', 'january': '1️⃣', 'february': '2️⃣', 'march': '3️⃣', 'april': '4️⃣',
    'may': '5️⃣', 'june': '6️⃣', 'july': '7️⃣', 'august': '8️⃣', 'september': '9️⃣',
    'october': '🔟', 'november': '📅', 'december': '📅',
    'before': '⬅️', 'after': '➡️', 'when': '❓', 'holiday': '🏖️',
    'ice-skating': '⛸️', 'go': '🟢', 'now': '⏰', 'beach': '🏖️',
    'date': '📅', 'season': '🍂',
    # 食物
    'apple': '🍎', 'banana': '🍌', 'rice': '🍚', 'noodles': '🍜',
    'milk': '🥛', 'bread': '🍞', 'egg': '🥚', 'chicken': '🍗',
    'water': '💧', 'tea': '🍵', 'juice': '🧃',
    # 动物
    'cat': '🐱', 'dog': '🐶', 'bird': '🐦', 'pig': '🐷',
    'tiger': '🐯', 'lion': '🦁', 'monkey': '🐵', 'panda': '🐼',
    # 颜色
    'red': '🔴', 'blue': '🔵', 'green': '🟢', 'yellow': '🟡',
    # 数字
    'one': '1️⃣', 'two': '2️⃣', 'three': '3️⃣', 'four': '4️⃣',
    'five': '5️⃣', 'six': '6️⃣', 'seven': '7️⃣', 'eight': '8️⃣',
    # 家人
    'father': '👨', 'mother': '👩', 'brother': '👦', 'sister': '👧',
    'family': '👨‍👩‍👧‍👦', 'baby': '👶', 'grandma': '👵', 'grandpa': '👴',
    # 学校
    'school': '🏫', 'book': '📚', 'pen': '🖊️', 'pencil': '✏️',
    'classroom': '🏫', 'library': '📚', 'teacher': '👨‍🏫', 'student': '🧑‍🎓',
}

# 已知非词汇行(可能是问候/句子/章节标题),用来过滤
SKIP_LINE_PATTERNS = [
    r'^Vocabulary\b',
    r'^Language Checklist\b',
    r'^语言知识一览表',
    r'^Structures and Expressions\b',
    r'^Sounds and Words\b',
    r'^\(cid:',  # PDF 嵌入字体未解码字符
    r'^[0-9]+$',  # 纯页码
    r'^Practice \d',
    r'^Review \d',
    r'^Unit \d+$',  # 单独的 Unit 标题(下面会单独识别)
    r'^[一二三四五六七八九十]+、',  # 中文序号
    r'^义务教育',
    r'^廣東|^广东',
    r'^出版',
    r'^[A-Z]$',  # 字母索引(A B C ...)
]

UNIT_PATTERN = re.compile(r'Unit\s+(\d+)', re.IGNORECASE)


def is_skip_line(line):
    for pat in SKIP_LINE_PATTERNS:
        if re.search(pat, line):
            return True
    return False


def parse_glossary_page(text):
    """从一页文本里抽取 [(unit, word, meaning), ...]

    注意:pdfplumber 对双栏排版页面,有时会返回合并的字符串(整页 = 1 行)。
    策略:先把文本切成"单元段",每段对应一个 Unit N;再在每段里用正则切词。
    """
    items = []

    # 预处理:pdfplumber 把 PDF 字间距控制字符(\x07=SET, \x0b=\v 等)当字符吐出来,会污染正则
    # 把控制字符替换成空格(但保留 \n 和 \r 以维持换行结构)
    text = re.sub(r'[\x00-\x09\x0b-\x1f]+', ' ', text)

    # 按 Unit N 切段(用占位符避免破坏)
    # 先找所有 Unit N 的位置
    unit_marks = list(re.finditer(r'Unit\s+(\d+)', text))
    if not unit_marks:
        return items

    segments = []
    for idx, m in enumerate(unit_marks):
        start = m.end()
        end = unit_marks[idx + 1].start() if idx + 1 < len(unit_marks) else len(text)
        unit_num = int(m.group(1))
        segments.append((unit_num, text[start:end]))

    for current_unit, segment in segments:
        # 段内每行可能含多个词条(双栏排版),"a 中文 b 中文 c 中文" 全部拆出来
        # 严格规则:英文 1-3 词 + 单空格 + 1-6 字中文 + 终止(下个英文 或 行尾)
        for m in re.finditer(
            r"([A-Za-z][\w'\-]*(?:\s+[A-Za-z][\w'\-]*){0,2})\s+([一-鿿][一-鿿；，。、\s]{0,15}?[一-鿿；，。、]|[一-鿿]{1,6})(?:[\s\d]*?)(?=\s+[A-Za-z][\w'\-]*(?:\s+[A-Za-z][\w'\-]*){0,2}\s+[一-鿿]|\s*$)",
            segment
        ):
            en = m.group(1).strip()
            zh = m.group(2).strip().rstrip('；，。、 ')

            # 末尾页码数字去掉
            zh = re.sub(r'\s+\d+\s*$', '', zh)
            if not en or not zh:
                continue
            if len(en) > 25 or len(zh) > 12:
                continue
            if not re.search(r'[一-鿿]', zh):
                continue
            # 词条不能纯标点/单字符
            if len(zh) < 2 or len(en) < 2:
                continue
            # 排除序数词切碎('nd' from '22nd', 'th' from '4th')
            if en.lower() in {'th', 'st', 'nd', 'rd', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'of', 'the'}:
                continue
            items.append((current_unit, en, zh))

    return items


def extract_glossary(pdf_path):
    """从 PDF 找 'Vocabulary (by unit)' 那一页,抽 [(unit, word, meaning), ...]"""
    import pdfplumber

    all_items = []
    with pdfplumber.open(pdf_path) as pdf:
        # 找 by-unit 起始页:
        #   - 'Language Checklist' 后跟 'Vocabulary (by unit)' (g4/g5 系列)
        #   - 或标题被 cid 字体吃了(g6-upper):靠 '≥3 个 Unit N + 后面页继续有 Unit + 非 alphabetical' 判定
        start_idx = None
        for i in range(len(pdf.pages)):
            text = pdf.pages[i].extract_text() or ''
            if 'alphabetical' in text.lower():
                break
            unit_count = len(re.findall(r'Unit\s+\d+', text))
            # 启发 1:正常教材
            if 'Language Checklist' in text and 'Vocabulary' in text and 'by unit' in text.lower():
                start_idx = i
                break
            # 启发 2:g6-upper 标题被吃,只要 ≥3 个 Unit + 下页有 Unit
            if unit_count >= 3:
                next_text = pdf.pages[i + 1].extract_text() if i + 1 < len(pdf.pages) else ''
                if re.search(r'Unit\s+\d+', next_text):
                    start_idx = i
                    break
        if start_idx is None:
            return all_items

        # 从 start_idx 往后扫,直到碰到 'alphabetical order' 之前停下
        scan_end = min(len(pdf.pages), start_idx + 6)
        for i in range(start_idx, scan_end):
            text = pdf.pages[i].extract_text() or ''
            if 'alphabetical' in text.lower():
                break
            items = parse_glossary_page(text)
            all_items.extend(items)

    return all_items


def main():
    all_words = []
    seen = set()  # (grade, en_lower) 去重

    for pdf_name, grade in GRADE_MAP.items():
        pdf_path = TEXTBOOK_DIR / pdf_name
        if not pdf_path.exists():
            print(f'⚠ 跳过 {pdf_name} (文件不存在)', file=sys.stderr)
            continue

        size_mb = pdf_path.stat().st_size / 1024 / 1024
        # < 1 MB 很可能是损坏的(如 g4-lower-2)
        if size_mb < 1.0:
            print(f'⚠ 跳过 {pdf_name} ({size_mb:.1f} MB,文件可能损坏)', file=sys.stderr)
            continue

        print(f'抽取 {pdf_name} (grade {grade}, {size_mb:.1f} MB)...', flush=True)
        try:
            items = extract_glossary(pdf_path)
            print(f'  抓到 {len(items)} 条词', flush=True)
        except Exception as e:
            print(f'  ✗ {e}', flush=True)
            continue

        for unit, en, zh in items:
            key = (grade, en.lower())
            if key in seen:
                continue
            seen.add(key)
            emoji = EMOJI_HINTS.get(en.lower(), '📘')
            all_words.append({
                'word': en,
                'meaning': zh,
                'grade': grade,
                'unit': unit,
                'image': emoji,
            })

    # 按 (grade, unit) 排序输出
    all_words.sort(key=lambda w: (w['grade'], w['unit'], w['word']))
    # 重新分配 id
    for i, w in enumerate(all_words):
        w['id'] = f'{w["grade"]}-u{w["unit"]}-{i:04d}'

    print(f'\n共 {len(all_words)} 词 (去重后)')

    # 写出 words-extracted.js
    with open(WORDS_FILE, 'w', encoding='utf-8') as f:
        f.write('// 自动从粤教粤人版 PDF Glossary (by unit) 抽取\n')
        f.write('// 重新生成:python3 docs/extract_words.py\n')
        f.write('// emoji 占位,后期可换 PNG\n\n')
        f.write('export const EXTRACTED_WORDS = [\n')
        for w in all_words:
            f.write('  {\n')
            f.write(f"    id: {json.dumps(w['id'])},\n")
            f.write(f"    word: {json.dumps(w['word'])},\n")
            f.write(f"    meaning: {json.dumps(w['meaning'])},\n")
            f.write(f"    grade: {w['grade']},\n")
            f.write(f"    unit: {w['unit']},\n")
            f.write(f"    image: {json.dumps(w['image'])},\n")
            f.write('  },\n')
        f.write('];\n')

    print(f'✓ 写入 {WORDS_FILE}')

    # 同步生成关卡:每个 (grade, unit) 一个 level
    levels = []
    seen_lv = set()
    for w in all_words:
        key = (w['grade'], w['unit'])
        if key in seen_lv:
            continue
        seen_lv.add(key)
        word_count = sum(1 for x in all_words if x['grade'] == w['grade'] and x['unit'] == w['unit'])
        if word_count < 3:
            continue  # 太少的 unit 跳过
        mode = 'spell' if w['grade'] >= 5 else 'choose'
        # 关卡名:用 unit 标题占位,后期可手填
        level_id = f'g{w["grade"]}-u{w["unit"]}'
        levels.append({
            'id': level_id,
            'name': f'{w["grade"]} 年级 · Unit {w["unit"]}',
            'grade': w['grade'],
            'unit': w['unit'],
            'mode': mode,
            'wordCount': min(10, word_count),
        })

    # 排序:按年级 + unit
    levels.sort(key=lambda lv: (lv['grade'], lv['unit']))

    with open(LEVELS_FILE, 'w', encoding='utf-8') as f:
        f.write('// 自动从 OCR 词库生成的关卡\n')
        f.write('// 重新生成:python3 docs/extract_words.py\n\n')
        f.write('export const EXTRACTED_LEVELS = [\n')
        for lv in levels:
            f.write('  {\n')
            for k, v in lv.items():
                if isinstance(v, str):
                    f.write(f"    {k}: {json.dumps(v)},\n")
                else:
                    f.write(f'    {k}: {v},\n')
            f.write('  },\n')
        f.write('];\n')

    print(f'✓ 写入 {LEVELS_FILE} ({len(levels)} 关)')

    # 简明统计
    by_grade = {}
    for w in all_words:
        by_grade.setdefault(w['grade'], {}).setdefault(w['unit'], 0)
        by_grade[w['grade']][w['unit']] += 1
    print('\n分布:')
    for g in sorted(by_grade):
        units = by_grade[g]
        total = sum(units.values())
        print(f'  {g} 年级: {len(units)} unit / {total} 词')
        for u in sorted(units):
            print(f'    Unit {u}: {units[u]} 词')


if __name__ == '__main__':
    main()