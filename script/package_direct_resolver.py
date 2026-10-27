"""
Package direct stream resolver.
Usage: python package_direct_resolver.py <file_host_url>
Example: python package_direct_resolver.py <file_host_url>
"""

import sys
import os
import time
import re

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
    print("[-] Playwright library not found. Install via: pip install playwright")
    sys.exit(1)

def resolve_buzzheavier(target_url: str):
    print(f"[+] Target BZZHR URL: {target_url}")

    with sync_playwright() as p:
        print("[+] Launching Playwright Chromium (Headless mode)...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        captured_stream_url = None

        def intercept_request(request):
            nonlocal captured_stream_url
            url_str = request.url
            if "ts.buzzheavier.com" in url_str or "ts.bzzhr.to" in url_str or "/download?t=" in url_str:
                if not captured_stream_url or "ts." in url_str:
                    captured_stream_url = url_str

        page.on("request", intercept_request)

        try:
            print("[+] Navigating page & resolving Cloudflare Turnstile...")
            page.goto(target_url, wait_until="domcontentloaded", timeout=60000, referer="https://steamrip.com/")
            time.sleep(3)

            title = page.title()
            print(f"[+] Page Title: {title}")

            content = page.content()
            matches = re.findall(r'hx-get=["\']([^"\']+)["\']', content)
            if matches:
                for m in matches:
                    if "download" in m:
                        captured_stream_url = "https://buzzheavier.com" + m if m.startswith("/") else m
                        break

            btn = page.query_selector("a.download-btn.gay-button, a[hx-get], button")
            if btn:
                print("[+] Clicking download button to trigger stream link...")
                btn.click()
                time.sleep(4)

        except Exception as err:
            print(f"[-] Error resolving page: {err}")
        finally:
            print("[+] Closing Playwright headless browser instance...")
            browser.close()

        if captured_stream_url:
            print("\n==================================================")
            print("BUZZHEAVIER DIRECT LINK RESOLVED!")
            print(f"File Title: {title}")
            print(f"Direct Stream URL: {captured_stream_url}")
            print("==================================================\n")
            return captured_stream_url
        else:
            print("[-] Failed to capture stream CDN link.")
            return None

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://bzzhr.to/2nbgw4kjsy94"
    resolve_buzzheavier(url)
