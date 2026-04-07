"""
crawl_dram_price.py
TrendForce DRAM Spot Price 크롤링 → Google Sheets 저장
컬럼: Date | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
"""

import os, json, time, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID  = os.environ.get('GSHEET_ID', '')
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')
TARGET_URL = 'https://www.trendforce.com/price/dram/dram_spot'

HEADERS = ['Date', 'Item', 'Daily High', 'Daily Low',
           'Session High', 'Session Low', 'Session Average',
           'Session Change', 'Source']

def get_sheet():
    creds_dict = json.loads(GCP_CREDS)
    scopes = ['https://www.googleapis.com/auth/spreadsheets',
              'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SHEET_ID)
    try:
        ws = sh.worksheet('spot_prices')
        # 헤더가 없거나 잘못됐으면 재설정
        first = ws.row_values(1)
        if first != HEADERS:
            ws.clear()
            ws.append_row(HEADERS)
            print('[Sheet] Headers reset')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet('spot_prices', rows=5000, cols=20)
        ws.append_row(HEADERS)
        print('[Sheet] Created spot_prices worksheet')
    return ws

def crawl():
    rows = []
    today = datetime.date.today().isoformat()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        )
        page = ctx.new_page()
        print(f'[Crawl] Navigating to {TARGET_URL}')
        page.goto(TARGET_URL, wait_until='networkidle', timeout=60000)
        time.sleep(4)

        # 페이지 소스 일부 출력 (디버깅)
        tables = page.query_selector_all('table')
        print(f'[Crawl] Found {len(tables)} tables')

        for ti, tbl in enumerate(tables):
            ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
            print(f'[Crawl] Table {ti} headers: {ths[:5]}')

            # Item/Daily High 등 컬럼이 있는 테이블만 처리
            if not any(k in ' '.join(ths) for k in ['Item', 'Daily', 'Session']):
                continue

            trs = tbl.query_selector_all('tbody tr')
            print(f'[Crawl] Table {ti} has {len(trs)} rows')

            for tr in trs:
                tds = tr.query_selector_all('td')
                cells = [td.inner_text().strip() for td in tds]
                if not cells or len(cells) < 2:
                    continue

                # 빈 셀 스킵
                if not cells[0]:
                    continue

                # 컬럼 매핑: Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change
                item    = cells[0] if len(cells) > 0 else ''
                d_high  = cells[1] if len(cells) > 1 else ''
                d_low   = cells[2] if len(cells) > 2 else ''
                s_high  = cells[3] if len(cells) > 3 else ''
                s_low   = cells[4] if len(cells) > 4 else ''
                s_avg   = cells[5] if len(cells) > 5 else ''
                s_chg   = cells[6] if len(cells) > 6 else ''

                print(f'[Row] {item[:40]} | H:{d_high} L:{d_low} Avg:{s_avg} Chg:{s_chg}')
                rows.append([today, item, d_high, d_low, s_high, s_low, s_avg, s_chg, 'TrendForce'])

        browser.close()

    print(f'[Crawl] Total rows: {len(rows)}')
    return rows

def save(ws, rows):
    if not rows:
        print('[Save] No data to save')
        return

    today = datetime.date.today().isoformat()
    existing = ws.get_all_values()
    existing_dates = [r[0] for r in existing[1:] if r]

    if today in existing_dates:
        print(f'[Save] {today} already exists, skipping')
        return

    for row in rows:
        ws.append_row(row)
    print(f'[Save] Saved {len(rows)} rows for {today}')

if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID or GCP_CREDENTIALS missing')
        exit(1)
    print(f'[Start] {datetime.date.today()}')
    ws   = get_sheet()
    rows = crawl()
    save(ws, rows)
    print('[Done]')
