"""Open every topic link and report the ones that don't work.

Run from backend/:  uv run python -m scripts.check_links
Exits 1 if any link fails (not 200 after redirects, or no answer in 15 s, after retries).
Sites are checked in parallel, but one request at a time per site, so docs sites don't
rate-limit us.
"""

import asyncio
import sys
from collections import defaultdict
from urllib.parse import urlsplit

import httpx

from app.modules.topics.catalog import load_catalog

HEADERS = {"User-Agent": "cortex-link-check"}
RETRIES = 4


async def fetch(client: httpx.AsyncClient, url: str) -> str | None:
    """None if the link works, otherwise a short reason. Retries rate limits and timeouts."""
    why = ""
    for attempt in range(RETRIES):
        if attempt:
            await asyncio.sleep(5 * attempt)
        try:
            r = await client.get(url)
        except httpx.TimeoutException as err:
            why = type(err).__name__
            continue
        except httpx.HTTPError as err:
            return type(err).__name__
        if r.status_code == 200:
            return None
        why = str(r.status_code)
        if r.status_code != 429:
            return why
    return why


async def check_site(client: httpx.AsyncClient, urls: list[str]) -> dict[str, str | None]:
    """Check one site's links one after another, with a short pause between them."""
    result: dict[str, str | None] = {}
    for url in urls:
        result[url] = await fetch(client, url)
        await asyncio.sleep(0.5)
    return result


async def main() -> int:
    links = [(t.id, str(r.url)) for t in load_catalog("content").topics for r in t.resources]
    by_site: dict[str, list[str]] = defaultdict(list)
    for url in dict.fromkeys(url for _, url in links):
        by_site[urlsplit(url).hostname or ""].append(url)

    async with httpx.AsyncClient(follow_redirects=True, timeout=15, headers=HEADERS) as client:
        per_site = await asyncio.gather(*(check_site(client, urls) for urls in by_site.values()))
    result = {url: why for site in per_site for url, why in site.items()}

    failed = [(t, result[url], url) for t, url in links if result[url]]
    for topic_id, why, url in failed:
        print(f"{topic_id}  {why}  {url}")
    print(f"{len(links) - len(failed)}/{len(links)} links work")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
