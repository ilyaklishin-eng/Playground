#!/usr/bin/env python3
import argparse
import html
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE = "https://www.stihi-rus.ru"
USER_AGENT = "Mozilla/5.0 (compatible; PsycheCatalogBot/3.0)"

AUTHORS = [
    {"author": "Александр Пушкин", "path": "/Pushkin/stihi/", "slug": "pushkin"},
    {"author": "Евгений Баратынский", "path": "/1/Bratyinskiy/", "slug": "baratynsky"},
    {"author": "Гавриил Державин", "path": "/1/Derzhavin/", "slug": "derzhavin"},
    {"author": "Константин Батюшков", "path": "/1/Batyushkov/", "slug": "batyushkov"},
    {"author": "Федор Тютчев", "path": "/1/Tyutchev/", "slug": "tyutchev"},
    {"author": "Афанасий Фет", "path": "/1/Fet/", "slug": "fet"},
    {"author": "Владимир Маяковский", "path": "/1/Mayakovskiy/", "slug": "mayakovsky"},
    {"author": "Валерий Брюсов", "path": "/1/Bryusov/", "slug": "bryusov"},
    {"author": "Александр Блок", "path": "/1/Blok/", "slug": "blok"},
    {"author": "Велимир Хлебников", "path": "/1/Hlebnikov/", "slug": "khlebnikov"},
    {"author": "Николай Гумилев", "path": "/1/gumilev/", "slug": "gumilev"},
    {"author": "Владислав Ходасевич", "path": "/1/xodasevich/", "slug": "khodasevich"},
    {"author": "Сергей Есенин", "path": "/1/Esenin/", "slug": "esenin"},
    {"author": "Николай Заболоцкий", "path": "/1/Zabolockiy/", "slug": "zabolotsky"},
    {"author": "Борис Пастернак", "path": "/1/Pasternak/", "slug": "pasternak"},
    {"author": "Анна Ахматова", "path": "/1/Ahmatova/", "slug": "akhmatova"},
    {"author": "Марина Цветаева", "path": "/1/Cvetaeva/", "slug": "tsvetaeva"},
    {"author": "Иосиф Бродский", "path": "/1/br/", "slug": "brodsky"},
    {"author": "Осип Мандельштам", "path": "/1/Mandelshtam/", "slug": "mandelshtam"},
    {"author": "Михаил Лермонтов", "path": "/1/Lermontov/", "slug": "lermontov"},
]

NOISE_MARKERS = [
    "http://",
    "https://",
    "читать полностью",
    "версия для печати",
    "биография",
    "другие произведения",
    "copyright",
    "©",
]

DEFAULT_TARGET = 1000
DEFAULT_MIN_LINES = 4
DEFAULT_MAX_LINES = 20
DEFAULT_TIMEOUT = 30
MAX_REJECT_EXAMPLES = 5


def parse_args():
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Build local poems catalog with metadata merge, dedup and quality validation"
    )
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET, help="Target number of poems")
    parser.add_argument("--min-lines", type=int, default=DEFAULT_MIN_LINES, help="Minimum lines per poem")
    parser.add_argument("--max-lines", type=int, default=DEFAULT_MAX_LINES, help="Maximum lines per poem")
    parser.add_argument(
        "--limit-per-author",
        type=int,
        default=0,
        help="Max poems per author (0 = no explicit limit)",
    )
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds")
    parser.add_argument(
        "--metadata-overrides",
        default=str(repo_root / "tools" / "poem_metadata_overrides.json"),
        help="Path to additional metadata source (JSON)",
    )
    parser.add_argument(
        "--out",
        default=str(repo_root / "poems.local.json"),
        help="Output JSON path",
    )
    parser.add_argument(
        "--summary-out",
        default="",
        help="Optional path to write quality summary JSON",
    )
    return parser.parse_args()


def fetch(url: str, timeout: int) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read()

    for enc in ("windows-1251", "cp1251", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="ignore")


def clean_text(value: str) -> str:
    value = value.replace("\r", "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    value = value.replace("\xa0", " ")

    lines = [re.sub(r"\s+", " ", line).strip() for line in value.split("\n")]
    lines = [line for line in lines if line]
    return "\n".join(lines)


def normalize_author(author: str) -> str:
    author = clean_text(author).lower().replace("ё", "е")
    author = re.sub(r"\s+", " ", author)
    return author.strip()


def normalize_title(title: str) -> str:
    title = clean_text(title).lower().replace("ё", "е")
    title = re.sub(r"\s+", " ", title)
    title = re.sub(r"[\"'«»]", "", title)
    return title.strip(" .,:;!?-—")


def normalize_text_for_hash(text: str) -> str:
    text = text.lower().replace("ё", "е")
    text = re.sub(r"[^a-zа-я0-9\n\s-]+", " ", text, flags=re.I)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


def load_metadata_overrides(path: str):
    override_path = Path(path).expanduser().resolve()
    if not override_path.exists():
        return []

    with override_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, list):
        return []

    prepared = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        author = item.get("author")
        title = item.get("title")
        if not isinstance(author, str) or not isinstance(title, str):
            continue

        yearsrc = item.get("year")
        year = str(yearsrc).strip() if yearsrc is not None else ""
        if year and not re.match(r"^\d{4}$", year):
            year = ""

        aliases = [title]
        alt = item.get("alt_titles")
        if isinstance(alt, list):
            aliases.extend(x for x in alt if isinstance(x, str) and x.strip())

        prepared.append(
            {
                "author_key": normalize_author(author),
                "title_keys": [normalize_title(x) for x in aliases],
                "year": year,
                "wikisource": item.get("wikisource", "") if isinstance(item.get("wikisource", ""), str) else "",
                "source": item.get("source", "") if isinstance(item.get("source", ""), str) else "",
            }
        )

    return prepared


def lookup_metadata_override(author: str, title: str, overrides):
    if not overrides:
        return None

    author_key = normalize_author(author)
    title_key = normalize_title(title)

    exact = []
    loose = []

    for item in overrides:
        if item["author_key"] != author_key:
            continue

        if title_key in item["title_keys"]:
            exact.append(item)
            continue

        if any(k and (k in title_key or title_key in k) for k in item["title_keys"]):
            loose.append(item)

    if exact:
        return exact[0]
    if loose:
        return loose[0]
    return None


def extract_links(index_html: str, index_url: str):
    out = []
    seen = set()

    for href, title in re.findall(r'<a\s+href="([^"]+\.htm)"[^>]*>(.*?)</a>', index_html, flags=re.I | re.S):
        if re.search(r"eng", href, flags=re.I):
            continue

        parsed = urlparse(href)
        base = parsed.path.split("/")[-1]
        if not re.match(r"^\d+(?:-\d+)?\.htm$", base):
            continue

        url = urljoin(index_url, href)
        if url in seen:
            continue

        title_clean = clean_text(title)
        if not title_clean:
            continue

        seen.add(url)
        out.append((url, title_clean))

    def sort_key(item):
        path = urlparse(item[0]).path.split("/")[-1].replace(".htm", "")
        parts = path.split("-")
        nums = []
        for part in parts:
            nums.append(int(part) if part.isdigit() else 10**9)
        return nums

    out.sort(key=sort_key)
    return out


def extract_poem_text(page_html: str) -> str:
    candidates = re.findall(r'<font[^>]*size\s*=\s*"?5"?[^>]*>(.*?)</font>', page_html, flags=re.I | re.S)
    if not candidates:
        candidates = re.findall(r'<font[^>]*>(.*?)</font>', page_html, flags=re.I | re.S)
    if not candidates:
        return ""

    candidates.sort(key=lambda c: c.count("<br"), reverse=True)
    text = clean_text(candidates[0])

    filtered = []
    for line in text.split("\n"):
        low = line.lower()
        if "антология русской поэзии" in low:
            continue
        if "стихи о любви" in low:
            continue
        if low.startswith("александр ") and " - стихи" in low:
            continue
        filtered.append(line)

    return "\n".join(filtered).strip()


def infer_vector(text: str):
    t = text.lower()

    def score(words):
        count = sum(t.count(w) for w in words)
        return min(1.0, 0.25 + count * 0.12)

    introspection = score(["я ", "мне", "мой", "душ", "сердц"])
    hope = score(["весн", "свет", "радост", "надеж", "утро", "любов"])
    intensity = score(["бур", "огн", "крик", "страст", "гром", "бой", "мятеж"])
    tenderness = score(["неж", "мил", "люб", "поцел", "ласк", "сердц"])
    darkness = score(["ноч", "тьм", "печал", "тоск", "смерт", "мрак", "холод"])
    freedom = score(["свобод", "вол", "дорог", "ветер", "море", "путь", "крыл"])
    return [round(x, 3) for x in [introspection, hope, intensity, tenderness, darkness, freedom]]


def infer_tags(text: str):
    t = text.lower()
    tags = set()
    if any(x in t for x in ["люб", "сердц", "мил"]):
        tags.add("relation")
    if any(x in t for x in ["был", "прош", "вспом", "памят"]):
        tags.add("past")
    if any(x in t for x in ["завтра", "настан", "будет", "весн"]):
        tags.add("future")
    if any(x in t for x in ["тьм", "ноч", "смерт", "тоск", "печал"]):
        tags.add("darkness")
    if any(x in t for x in ["душ", "я ", "мой", "мне"]):
        tags.add("self")
    if any(x in t for x in ["свобод", "вол", "путь", "ветер"]):
        tags.add("freedom")
    if any(x in t for x in ["смысл", "истин", "мир", "вечн"]):
        tags.add("meaning")
    if not tags:
        tags.add("meaning")
    return sorted(tags)


def extract_year(title: str, page_html: str) -> str:
    pattern = r"\b(17\d{2}|18\d{2}|19\d{2}|20\d{2})\b"
    candidates = re.findall(pattern, title)
    if not candidates:
        candidates = re.findall(pattern, page_html)

    for year in candidates:
        value = int(year)
        if 1700 <= value <= 2026:
            return year
    return ""


def validate_poem_quality(text: str, title: str, min_lines: int, max_lines: int):
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) < min_lines:
        return False, "too_short"
    if len(lines) > max_lines:
        return False, "too_long"

    merged = " ".join(lines)
    if len(merged) < 80:
        return False, "too_small"

    low_merged = merged.lower()
    if any(marker in low_merged for marker in NOISE_MARKERS):
        return False, "noise_marker"

    letters = [ch for ch in merged if ch.isalpha()]
    if not letters:
        return False, "no_letters"

    cyrillic_count = sum(1 for ch in letters if "а" <= ch.lower() <= "я" or ch.lower() == "ё")
    if cyrillic_count / len(letters) < 0.55:
        return False, "low_cyrillic_ratio"

    unique_line_ratio = len({re.sub(r"\s+", " ", line.lower()) for line in lines}) / len(lines)
    if unique_line_ratio < 0.5:
        return False, "repeated_lines"

    words = re.findall(r"[а-яА-Яa-zA-ZёЁ-]+", merged)
    if len(set(w.lower() for w in words)) < 12:
        return False, "too_few_unique_words"

    title_letters = sum(1 for ch in title if ch.isalpha())
    if title_letters < 2:
        return False, "bad_title"

    if len(lines[-1]) <= 2:
        return False, "truncated_tail"

    return True, "ok"


def register_reject(examples, reason: str, author: str, title: str, source: str):
    bucket = examples[reason]
    if len(bucket) >= MAX_REJECT_EXAMPLES:
        return
    bucket.append({"author": author, "title": title, "source": source})


def build_catalog(args):
    results = []
    seen_text_hashes = set()
    seen_meta = set()
    seen_ids = set()

    stats = Counter()
    per_author = defaultdict(Counter)
    reject_examples = defaultdict(list)
    overrides = load_metadata_overrides(args.metadata_overrides)

    if overrides:
        stats["metadata_overrides_loaded"] = len(overrides)

    for author_meta in AUTHORS:
        author = author_meta["author"]
        index_url = urljoin(BASE, author_meta["path"])

        try:
            index_html = fetch(index_url, args.timeout)
        except Exception:
            stats["index_fetch_errors"] += 1
            per_author[author]["index_fetch_errors"] += 1
            continue

        links = extract_links(index_html, index_url)
        stats["links_found"] += len(links)
        per_author[author]["links_found"] += len(links)

        kept_for_author = 0

        for url, title in links:
            if args.limit_per_author and kept_for_author >= args.limit_per_author:
                break

            stats["pages_attempted"] += 1
            per_author[author]["pages_attempted"] += 1

            try:
                page_html = fetch(url, args.timeout)
            except Exception:
                stats["page_fetch_errors"] += 1
                per_author[author]["page_fetch_errors"] += 1
                register_reject(reject_examples, "page_fetch_errors", author, title, url)
                continue

            text = extract_poem_text(page_html)
            if not text:
                stats["reject_no_text"] += 1
                per_author[author]["reject_no_text"] += 1
                register_reject(reject_examples, "reject_no_text", author, title, url)
                continue

            valid, reason = validate_poem_quality(text, title, args.min_lines, args.max_lines)
            if not valid:
                stats[f"reject_{reason}"] += 1
                per_author[author][f"reject_{reason}"] += 1
                register_reject(reject_examples, f"reject_{reason}", author, title, url)
                continue

            normalized_text = normalize_text_for_hash(text)
            text_hash = hashlib.sha1(normalized_text.encode("utf-8")).hexdigest()
            if text_hash in seen_text_hashes:
                stats["reject_duplicate_text"] += 1
                per_author[author]["reject_duplicate_text"] += 1
                register_reject(reject_examples, "reject_duplicate_text", author, title, url)
                continue

            year = extract_year(title, page_html)
            override = lookup_metadata_override(author, title, overrides)
            if override and override.get("year") and not year:
                year = override["year"]
                stats["year_from_override"] += 1
                per_author[author]["year_from_override"] += 1

            normalized_title = normalize_title(title)
            meta_key = (author, normalized_title, year)
            if meta_key in seen_meta:
                stats["reject_duplicate_meta"] += 1
                per_author[author]["reject_duplicate_meta"] += 1
                register_reject(reject_examples, "reject_duplicate_meta", author, title, url)
                continue

            page_basename = urlparse(url).path.split("/")[-1].replace(".htm", "")
            poem_id = f"{author_meta['slug']}-{page_basename}"
            if poem_id in seen_ids:
                stats["reject_duplicate_id"] += 1
                per_author[author]["reject_duplicate_id"] += 1
                register_reject(reject_examples, "reject_duplicate_id", author, title, url)
                continue

            seen_text_hashes.add(text_hash)
            seen_meta.add(meta_key)
            seen_ids.add(poem_id)

            if year:
                stats["with_year"] += 1
                per_author[author]["with_year"] += 1
            else:
                stats["without_year"] += 1
                per_author[author]["without_year"] += 1

            metadata = {
                "year_source": "stihi-rus" if extract_year(title, page_html) else "unknown",
                "metadata_source": "stihi-rus",
            }
            if override:
                metadata["metadata_source"] = override.get("source") or "metadata_override"
                if override.get("wikisource"):
                    metadata["wikisource"] = override["wikisource"]
                if year and metadata["year_source"] == "unknown":
                    metadata["year_source"] = "metadata_override"

            item = {
                "id": poem_id,
                "title": title,
                "author": author,
                "year": year,
                "tags": infer_tags(text),
                "v": infer_vector(text),
                "text": text,
                "source": url,
                "meta": metadata,
            }
            results.append(item)
            stats["kept"] += 1
            per_author[author]["kept"] += 1
            kept_for_author += 1

            if len(results) >= args.target:
                return results, stats, per_author, reject_examples

    return results, stats, per_author, reject_examples


def print_summary(stats, per_author):
    print("summary:")
    for key in sorted(stats.keys()):
        print(f"  {key}={stats[key]}")

    print("per_author_kept:")
    for author in sorted(per_author.keys()):
        kept = per_author[author].get("kept", 0)
        with_year = per_author[author].get("with_year", 0)
        without_year = per_author[author].get("without_year", 0)
        print(f"  {author}: kept={kept} with_year={with_year} without_year={without_year}")


def merge_existing_required_entries(new_poems, out_path: Path):
    if not out_path.exists():
        return new_poems, 0

    try:
        existing = json.loads(out_path.read_text(encoding="utf-8"))
    except Exception:
        return new_poems, 0

    if not isinstance(existing, list):
        return new_poems, 0

    ids = {item.get("id") for item in new_poems if isinstance(item, dict)}
    merged = list(new_poems)
    added = 0

    for item in existing:
        if not isinstance(item, dict):
            continue
        meta = item.get("meta")
        if not isinstance(meta, dict) or not meta.get("required_by_user"):
            continue
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            continue
        if item_id in ids:
            continue
        merged.append(item)
        ids.add(item_id)
        added += 1

    return merged, added


def main():
    args = parse_args()
    poems, stats, per_author, reject_examples = build_catalog(args)

    out_path = Path(args.out).expanduser().resolve()
    poems, merged_required = merge_existing_required_entries(poems, out_path)
    if merged_required:
        stats["required_entries_merged"] = merged_required

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as file:
        json.dump(poems, file, ensure_ascii=False, indent=2)

    print(f"saved={len(poems)} path={out_path}")
    print_summary(stats, per_author)

    if args.summary_out:
        summary_path = Path(args.summary_out).expanduser().resolve()
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "summary": dict(stats),
            "authors": {author: dict(values) for author, values in per_author.items()},
            "target": args.target,
            "saved": len(poems),
            "reject_examples": dict(reject_examples),
        }
        with summary_path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        print(f"summary_saved={summary_path}")


if __name__ == "__main__":
    main()
