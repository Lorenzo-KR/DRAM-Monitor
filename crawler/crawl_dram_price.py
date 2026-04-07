"""
crawl_dram_price.py
TrendForce DRAM Spot Price 크롤링 → Google Sheets 저장
실행: python crawl_dram_price.py
"""

import os
import json
import time
import datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

# ── 설정 ──────────────────────────────────────────────────
SHEET_ID  = os.environ.get('GSHEET_ID', '')  # GitHub Secret
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')  # JSON string

TARGET_URL = 'https://www.trendforce.com/price/dram/dram_spot'

# ── Google Sheets 연결 ────────────────────────────────────
def get_sheet():
    creds_dict = json.loads(GCP_CREDS)
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ]
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    gc    = gspread.authorize(creds)
    sh    = gc.open_by_key(SHEET_ID)

    # spot_prices 시트 없으면 생성
    try:
        ws = sh.worksheet('spot_prices')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet('spot_prices', rows=5000, cols=20)
        ws.append_row(['Date', 'Product', 'Density', 'Maker', 'Price(USD)', 'Change', 'Change%', 'High', 'Low', 'Source'])
        print('[Sheet] Created spot_prices worksheet with headers')
    return ws

# ── 크롤링 ───────────────────────────────────────────────
def crawl():
    rows = []
    today = datetime.date.today().isoformat()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx     = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        )
        page = ctx.new_page()

        print(f'[Crawl] Navigating to {TARGET_URL}')
        page.goto(TARGET_URL, wait_until='networkidle', timeout=60000)
        time.sleep(3)

        # 테이블 찾기 - TrendForce spot price table
        tables = page.query_selector_all('table')
        print(f'[Crawl] Found {len(tables)} tables')

        for tbl in tables:
            headers = [th.inner_text().strip() for th in tbl.query_selector_all('thead th')]
            print(f'[Crawl] Table headers: {headers}')

            body_rows = tbl.query_selector_all('tbody tr')
            for tr in body_rows:
                cells = [td.inner_text().strip() for td in tr.query_selector_all('td')]
                if not cells or len(cells) < 3:
                    continue
                print(f'[Crawl] Row: {cells}')

                # 데이터 파싱 (TrendForce 구조에 맞게)
                row = [today] + cells[:9]
                row.append('TrendForce')
                rows.append(row)

        # 테이블이 없으면 div 기반 데이터 시도
        if not rows:
            print('[Crawl] No table found, trying div-based selectors...')
            items = page.query_selector_all('.price-table-row, .spot-price-row, [class*="price-row"], [class*="spot-row"]')
            print(f'[Crawl] Found {len(items)} div items')
            for item in items:
                text = item.inner_text().strip()
                if text:
                    print(f'[Crawl] Item: {text[:100]}')
                    rows.append([today, text, '', '', '', '', '', '', '', 'TrendForce'])

        browser.close()

    print(f'[Crawl] Total rows collected: {len(rows)}')
    return rows

# ── 중복 체크 후 저장 ─────────────────────────────────────
def save(ws, rows):
    if not rows:
        print('[Save] No data to save')
        return

    # 오늘 날짜 데이터가 이미 있는지 확인
    today = datetime.date.today().isoformat()
    existing = ws.get_all_values()
    existing_dates = [r[0] for r in existing[1:] if r]  # 헤더 제외

    if today in existing_dates:
        print(f'[Save] Data for {today} already exists, skipping')
        return

    for row in rows:
        ws.append_row(row)
    print(f'[Save] Saved {len(rows)} rows for {today}')

# ── 메인 ─────────────────────────────────────────────────
if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID or GCP_CREDENTIALS env var missing')
        exit(1)

    print(f'[Start] DRAM Price Crawler — {datetime.date.today()}')
    ws   = get_sheet()
    rows = crawl()
    save(ws, rows)
    print('[Done]')
