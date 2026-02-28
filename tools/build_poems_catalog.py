#!/usr/bin/env python3
import json
import re
import html
import hashlib
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE = "https://www.stihi-rus.ru"
USER_AGENT = "Mozilla/5.0 (compatible; PsycheCatalogBot/1.0)"

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
    {"author": "Михаил Лермонтов", "path": "/1/Lermontov/", "slug": "lermontov"}
]

MAX_LINES = 20
TARGET_MIN = 420


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as resp:
        raw = resp.read()
    for enc in ("windows-1251", "cp1251", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="ignore")


def clean_text(s: str) -> str:
    s = s.replace("\r", "")
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in s.split("\n")]
    lines = [line for line in lines if line]
    return "\n".join(lines)


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
        seen.add(url)
        title_clean = clean_text(title)
        if not title_clean:
            continue
        out.append((url, title_clean))
    return out


def extract_poem_text(page_html: str) -> str:
    # Prefer the largest <font size=5> block, which usually contains the poem.
    candidates = re.findall(r'<font[^>]*size\s*=\s*"?5"?[^>]*>(.*?)</font>', page_html, flags=re.I | re.S)
    if not candidates:
        candidates = re.findall(r'<font[^>]*>(.*?)</font>', page_html, flags=re.I | re.S)
    if not candidates:
        return ""

    candidates = sorted(candidates, key=lambda c: c.count("<br"), reverse=True)
    text = clean_text(candidates[0])

    # Drop service lines.
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
        c = 0
        for w in words:
            c += t.count(w)
        return min(1.0, 0.25 + c * 0.12)

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


def extract_year(title: str):
    m = re.search(r"(18\d{2}|19\d{2}|20\d{2})", title)
    return m.group(1) if m else ""


def build():
    results = []
    seen_hashes = set()

    for author in AUTHORS:
        index_url = urljoin(BASE, author["path"])
        try:
            index_html = fetch(index_url)
        except Exception:
            continue

        links = extract_links(index_html, index_url)

        for url, title in links:
            try:
                page_html = fetch(url)
            except Exception:
                continue

            text = extract_poem_text(page_html)
            if not text:
                continue

            lines = [ln for ln in text.split("\n") if ln.strip()]
            if len(lines) < 4 or len(lines) > MAX_LINES:
                continue

            digest = hashlib.sha1(text.encode("utf-8")).hexdigest()
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)

            base = urlparse(url).path.split("/")[-1].replace(".htm", "")
            item = {
                "id": f"{author['slug']}-{base}",
                "title": title,
                "author": author["author"],
                "year": extract_year(title),
                "tags": infer_tags(text),
                "v": infer_vector(text),
                "text": text,
                "source": url
            }
            results.append(item)

            if len(results) >= TARGET_MIN:
                break
        if len(results) >= TARGET_MIN:
            break

    return results


def main():
    poems = build()
    out_path = "/Users/ilyaklishin/Documents/Playground/poems.local.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(poems, f, ensure_ascii=False, indent=2)
    print(f"saved={len(poems)} path={out_path}")


if __name__ == "__main__":
    main()
