#!/usr/bin/env python3
"""Fix i18n: module-level t() and missing useTranslation in sub-components."""
from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"
I18N_IMPORT = "import i18n from '@/localization/i18n';"
USE_HOOK = "const { t } = useTranslation();"
USE_IMPORT = "import { useTranslation } from 'react-i18next';"


def has_import(content: str, needle: str) -> bool:
    return needle in content


def ensure_imports(content: str, needs_i18n: bool, needs_hook_import: bool) -> str:
    if needs_hook_import and not has_import(content, USE_IMPORT):
        # insert after first import block
        m = re.search(r"(import .+?;\n)(?:import .+?;\n)*", content, re.DOTALL)
        if m:
            insert_at = m.end()
            content = content[:insert_at] + USE_IMPORT + "\n" + content[insert_at:]
        else:
            content = USE_IMPORT + "\n" + content
    if needs_i18n and "from '@/localization/i18n'" not in content and "from \"@/localization/i18n\"" not in content:
        m = re.search(r"(import .+?;\n)(?:import .+?;\n)*", content, re.DOTALL)
        if m:
            insert_at = m.end()
            content = content[:insert_at] + I18N_IMPORT + "\n" + content[insert_at:]
    return content


def fix_module_level_t(content: str) -> tuple[str, bool]:
    """Replace t('key') with i18n.t('key') before first export default function."""
    m = re.search(r"\nexport\s+default\s+function\s+", content)
    if not m:
        m = re.search(r"\nexport\s+default\s+", content)
    split = m.start() if m else len(content)
    head, tail = content[:split], content[split:]
    if "t(" not in head:
        return content, False
    new_head = re.sub(r"\bt\(", "i18n.t(", head)
    if new_head == head:
        return content, False
    return new_head + tail, True


def find_function_blocks(content: str) -> list[tuple[int, int, str]]:
    """Rough function blocks: (start, end, name)."""
    blocks = []
    patterns = [
        r"\nfunction\s+(\w+)\s*\(",
        r"\nconst\s+(\w+)\s*=\s*(?:React\.)?(?:memo\()?function\s*\(",
        r"\nconst\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{",
    ]
    for pat in patterns:
        for m in re.finditer(pat, content):
            name = m.group(1)
            brace_start = content.find("{", m.end())
            if brace_start == -1:
                continue
            depth = 0
            i = brace_start
            while i < len(content):
                c = content[i]
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        blocks.append((brace_start + 1, i, name))
                        break
                i += 1
    # dedupe overlapping
    blocks.sort(key=lambda x: x[0])
    filtered = []
    last_end = -1
    for s, e, n in blocks:
        if s >= last_end:
            filtered.append((s, e, n))
            last_end = e
    return filtered


def fix_subcomponents(content: str) -> tuple[str, bool]:
    changed = False
    if "useTranslation" not in content and "\bt(" not in content:
        return content, False

    blocks = find_function_blocks(content)
    # process from end to start to preserve offsets
    for start, end, name in reversed(blocks):
        body = content[start:end]
        if "\bt(" not in body:
            continue
        if "useTranslation" in body[:400]:
            continue
        if USE_HOOK in body:
            continue
        # skip default export main if already has hook at top level - still need hook in sub
        indent = ""
        m = re.match(r"\n(\s*)", content[start - 1 : start + 20] if start > 0 else "\n  ")
        if m:
            indent = m.group(1) or "  "
        injection = f"\n{indent}{USE_HOOK}\n"
        content = content[:start] + injection + content[start:]
        changed = True

    return content, changed


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    content = original
    needs_i18n = False
    needs_hook = False

    content, c1 = fix_module_level_t(content)
    needs_i18n = needs_i18n or c1

    content, c2 = fix_subcomponents(content)
    needs_hook = needs_hook or c2

    if "\bt(" in content:
        if "useTranslation" in content and "export default function" in content:
            # main component might need hook - check export default block
            pass
        if "useTranslation" not in content and "\bt(" in content:
            needs_hook = True

    content = ensure_imports(content, needs_i18n, needs_hook or c2 or ("useTranslation" in content))

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed_files = []
    for path in sorted(APP.rglob("*.tsx")):
        if process_file(path):
            changed_files.append(str(path.relative_to(APP.parent)))
    print(f"Updated {len(changed_files)} files")
    for f in changed_files[:60]:
        print(f"  - {f}")
    if len(changed_files) > 60:
        print(f"  ... and {len(changed_files) - 60} more")


if __name__ == "__main__":
    main()
