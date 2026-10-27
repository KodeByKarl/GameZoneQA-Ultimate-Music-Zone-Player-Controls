"""
Package stream resolver.

Usage:
  python package_link_resolver.py <package_page_url>
  python package_link_resolver.py <file_host_url>

The preferred input is a SteamRIP game page. The resolver reads the page,
extracts the BZZHR anchor without clicking ad-prone page chrome, opens the
BZZHR landing page, clicks the real download control, and accepts only the
actual ts.bzzhr.to / ts.buzzheavier.com stream URL.
"""

import os
import re
import sys
import time
import json
from urllib.parse import urljoin

def configure_playwright_browsers():
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        return
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = (
        os.path.join(script_dir, "browsers"),
        os.path.join(os.path.dirname(script_dir), "browsers"),
        os.path.join(os.path.dirname(script_dir), "resources", "browsers"),
    )
    for candidate in candidates:
        if os.path.isdir(candidate):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = candidate
            return


configure_playwright_browsers()

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[-] Playwright library not found.")
    sys.exit(1)


AD_BLOCK_PATTERNS = (
    "doubleclick",
    "googlesyndication",
    "googleadservices",
    "adservice",
    "adsterra",
    "onclick",
    "popads",
    "propeller",
    "exoclick",
    "adnxs",
    "mgid",
)


def is_steamrip_url(url: str) -> bool:
    return "steamrip.com/" in (url or "").lower()


def is_bzzhr_url(url: str) -> bool:
    value = (url or "").lower()
    return "bzzhr.to/" in value or "buzzheavier.com/" in value


def should_block(url: str) -> bool:
    value = (url or "").lower()
    return any(pattern in value for pattern in AD_BLOCK_PATTERNS)


def normalize_cookie(cookie: dict, target_url: str):
    name = str(cookie.get("name", "")).strip()
    value = str(cookie.get("value", ""))
    if not name:
        return None

    normalized = {
        "name": name,
        "value": value,
        "path": str(cookie.get("path", "/") or "/"),
    }

    domain = str(cookie.get("domain", "")).strip()
    if domain:
        normalized["domain"] = domain
    else:
        normalized["url"] = target_url

    if cookie.get("secure") is not None:
        normalized["secure"] = bool(cookie.get("secure"))
    if cookie.get("httpOnly") is not None:
        normalized["httpOnly"] = bool(cookie.get("httpOnly"))

    expiration = cookie.get("expirationDate")
    if expiration is not None:
        try:
            normalized["expires"] = float(expiration)
        except (TypeError, ValueError):
            pass

    same_site = str(cookie.get("sameSite", "") or "").lower()
    if same_site == "lax":
        normalized["sameSite"] = "Lax"
    elif same_site == "strict":
        normalized["sameSite"] = "Strict"
    elif same_site in {"none", "no_restriction"}:
        normalized["sameSite"] = "None"

    return normalized


def load_cookie_payload(raw: str, target_url: str):
    if not raw or not raw.strip():
        return []
    try:
        payload = json.loads(raw)
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    cookies = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        normalized = normalize_cookie(item, target_url)
        if normalized:
            cookies.append(normalized)
    return cookies


def extract_bzzhr_from_steamrip(page, steamrip_url: str) -> str:
    page.goto(steamrip_url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3500)
    href = page.evaluate(
        """() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const rows = anchors.map((a) => ({
                href: a.href || a.getAttribute('href') || '',
                text: (a.innerText || a.textContent || '').trim(),
                parent: (a.parentElement && (a.parentElement.innerText || a.parentElement.textContent) || '').trim()
            }));
            const labelled = rows.find((row) =>
                /bzzhr|buzzheavier/i.test(row.parent + ' ' + row.text) &&
                /bzzhr\\.to|buzzheavier\\.com/i.test(row.href)
            );
            const anyBzzhr = rows.find((row) => /bzzhr\\.to|buzzheavier\\.com/i.test(row.href));
            return (labelled || anyBzzhr || {}).href || '';
        }"""
    )
    return urljoin(steamrip_url, href) if href else ""


def extract_copy_download_path(page) -> str:
    onclick = page.evaluate(
        """() => {
            const copy = Array.from(document.querySelectorAll('a.copy, a, button')).find((el) =>
                /copy download link/i.test(el.innerText || el.textContent || '') ||
                /copyDownloadLink/i.test(el.getAttribute('onclick') || '')
            );
            return copy ? (copy.getAttribute('onclick') || '') : '';
        }"""
    )
    match = re.search(r"copyDownloadLink\('([^']+)'\)", onclick or "")
    if not match:
        return ""
    return match.group(1).replace("\\/", "/")


def resolve_copy_download_link(page) -> str:
    try:
        copied_url = page.evaluate(
            """async () => {
                const copy = Array.from(document.querySelectorAll('a.copy, a, button')).find((el) =>
                    /copy download link/i.test(el.innerText || el.textContent || '') ||
                    /copyDownloadLink/i.test(el.getAttribute('onclick') || '')
                );
                const onclick = copy ? (copy.getAttribute('onclick') || '') : '';
                const match = onclick.match(/copyDownloadLink\\('([^']+)'\\)/);
                const path = match ? match[1].replaceAll('\\\\/', '/') : '';
                if (!path) return '';
                const response = await fetch(path, { headers: { 'HX-Request': 'true' } });
                return response.headers.get('HX-Redirect') || '';
            }"""
        )
        if re.search(r"^https?://ts\.(?:bzzhr\.to|buzzheavier\.com)/", copied_url or "", re.IGNORECASE):
            return copied_url
    except Exception:
        pass
    return ""


def resolve_buzzheavier(target_url: str, cookies_raw: str = ""):
    injected_cookies = load_cookie_payload(cookies_raw, target_url)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=bool(injected_cookies) or os.environ.get("ZONEPLAY_BZZHR_HEADLESS") == "1",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-dev-shm-usage",
            ],
        )
        context = browser.new_context(
            accept_downloads=True,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="Asia/Singapore",
            viewport={"width": 1280, "height": 900},
        )
        if injected_cookies:
            context.add_cookies(injected_cookies)
            print(f"Injected BZZHR cookies: {len(injected_cookies)}")
        context.add_init_script(
            """
            (() => {
                const noop = () => null;
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                window.chrome = window.chrome || { runtime: {} };
                window.open = noop;
                document.addEventListener('click', (event) => {
                    const anchor = event.target && event.target.closest && event.target.closest('a[target="_blank"]');
                    if (anchor) anchor.removeAttribute('target');
                }, true);
            })();
            """
        )
        context.route("**/*", lambda route: route.abort() if should_block(route.request.url) else route.continue_())

        captured_stream_url = None
        steamrip_url = target_url if is_steamrip_url(target_url) else "https://steamrip.com/"
        page = context.new_page()

        def capture_request(request):
            nonlocal captured_stream_url
            url_str = request.url
            if re.search(r"https?://ts\.(?:bzzhr\.to|buzzheavier\.com)/", url_str, re.IGNORECASE):
                captured_stream_url = url_str

        def capture_response(response):
            nonlocal captured_stream_url
            try:
                redirected = response.headers.get("hx-redirect") or response.headers.get("HX-Redirect") or ""
            except Exception:
                redirected = ""
            if re.search(r"^https?://ts\.(?:bzzhr\.to|buzzheavier\.com)/", redirected, re.IGNORECASE):
                captured_stream_url = redirected

        def close_popup(popup):
            try:
                popup.close()
            except Exception:
                pass

        context.on("page", lambda popup: close_popup(popup) if popup != page else None)
        page.on("request", capture_request)
        page.on("response", capture_response)

        try:
            if is_steamrip_url(target_url):
                bzzhr_url = extract_bzzhr_from_steamrip(page, target_url)
                print(f"BZZHR Landing URL: {bzzhr_url}")
            else:
                bzzhr_url = target_url

            if not is_bzzhr_url(bzzhr_url):
                return None

            page.goto(bzzhr_url, wait_until="domcontentloaded", timeout=60000, referer=steamrip_url)
            page.wait_for_timeout(8000)

            captured_stream_url = resolve_copy_download_link(page)
            if captured_stream_url:
                print(f"Copy Download Link URL: {captured_stream_url}")

            page.on("request", capture_request)
            buttons = page.query_selector_all("a.download-btn.gay-button, a[hx-get*='download'], a.copy")
            for button in buttons:
                if captured_stream_url:
                    break
                try:
                    button.click()
                except Exception:
                    continue
                deadline = time.time() + 12
                while time.time() < deadline and not captured_stream_url:
                    time.sleep(0.25)

            if not captured_stream_url:
                content = page.content()
                matches = re.findall(r'https?://ts\.(?:bzzhr\.to|buzzheavier\.com)/[^"\'<>\s]+', content, re.IGNORECASE)
                if matches:
                    captured_stream_url = matches[0]
        except Exception as err:
            print(f"[-] Resolver error: {err}")
        finally:
            browser.close()

        if captured_stream_url:
            print(f"Direct Stream URL: {captured_stream_url}")
            return captured_stream_url
        print("[-] Failed to capture ts.bzzhr.to / ts.buzzheavier.com stream URL.")
        return None


def print_bzzhr_landing_url(target_url: str):
    if is_bzzhr_url(target_url):
        print(f"BZZHR Landing URL: {target_url}")
        return target_url
    if not is_steamrip_url(target_url):
        return ""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()
        try:
            bzzhr_url = extract_bzzhr_from_steamrip(page, target_url)
            print(f"BZZHR Landing URL: {bzzhr_url}")
            return bzzhr_url
        finally:
            browser.close()


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://steamrip.com/2nd-eve-free-download/"
    if "--print-bzzhr-only" in sys.argv:
        print_bzzhr_landing_url(url)
        sys.exit(0)
    cookies_arg = sys.argv[2] if len(sys.argv) > 2 else ""
    resolve_buzzheavier(url, cookies_arg)
