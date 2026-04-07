"""
crawl_dram_price.py
TrendForce DRAM Spot Price 크롤링 → Google Sheets 저장
- DRAM Spot Price 섹션만 수집 (7개 제품)
- Last Update 시간 포함
컬럼: Date | Last Update | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
"""

import os, json, time, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID   = os.environ.get('GSHEET_ID', '')
GCP_CREDS  = os.environ.get('GCP_CREDENTIALS', '')
TARGET_URL = 'https://www.trendforce.com/price/dram/dram_spot'

HEADERS = ['Date', 'Last Update', 'Item',
           'Daily High', 'Daily Low',
           'Session High', 'Session Low',
           'Session Average', 'Session Change', 'Source']

# DRAM Spot 제품 목록 (이것만 수집)
DRAM_SPOT_ITEMS = [
    'DDR5 16Gb (2Gx8) 4800/5600',
    'DDR5 16Gb (2Gx8) eTT',
    'DDR4 16Gb (2Gx8) 3200',
    'DDR4 16Gb (2Gx8) eTT',
    'DDR4 8Gb (1Gx8) 3200',
    'DDR4 8Gb (1Gx8) eTT',
    'DDR3 4Gb 512Mx8 1600/1866',
]

def get_sheet():
    creds_dict = json.loads(GCP_CREDS)
    scopes = ['https://www.googleapis.com/auth/spreadsheets',
              'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SHEET_ID)
    try:
        ws = sh.worksheet('spot_prices')
        first = ws.row_values(1)
        if first != HEADERS:
            ws.clear()
            ws.append_row(HEADERS)
            print('[Sheet] Headers reset')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet('spot_prices', rows=5000, cols=15)
        ws.append_row(HEADERS)
        print('[Sheet] Created spot_prices')
    return ws

def crawl():
    rows = []
    today = datetime.date.today().isoformat()
    last_update = ''

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        )
        page = ctx.new_page()
        print(f'[Crawl] Loading {TARGET_URL}')
        page.goto(TARGET_URL, wait_until='networkidle', timeout=90000)
        time.sleep(6)

        # Last Update 텍스트 추출
        try:
            page_text = page.evaluate('document.body.innerText')
            for line in page_text.split('\n'):
                if 'Last Update' in line:
                    last_update = line.strip()
                    print(f'[Crawl] Last Update: {last_update}')
                    break
        except Exception as e:
            print(f'[Crawl] Last Update extract error: {e}')

        # 테이블 파싱
        tables = page.query_selector_all('table')
        print(f'[Crawl] Found {len(tables)} tables')

        found_spot = False
        for ti, tbl in enumerate(tables):
            ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
            ths_str = ' '.join(ths).lower()

            # Item/Daily/Session 컬럼 있는 테이블만
            if not any(k in ths_str for k in ['item', 'daily', 'session']):
                continue

            # 헤더 인덱스
            def hi(kws):
                for kw in kws:
                    for i, h in enumerate(ths):
                        if kw.lower() in h.lower():
                            return i
                return -1

            idx_item = hi(['item'])
            idx_dh   = hi(['daily high'])
            idx_dl   = hi(['daily low'])
            idx_sh   = hi(['session high'])
            idx_sl   = hi(['session low'])
            idx_savg = hi(['session average', 'session avg'])
            idx_schg = hi(['session change'])

            trs = tbl.query_selector_all('tbody tr')
            print(f'[Table {ti}] {len(trs)} rows, headers: {ths[:4]}')

            for tr in trs:
                tds = tr.query_selector_all('td')
                cells = [td.inner_text().strip() for td in tds]
                if not cells: continue

                def g(idx): return cells[idx] if 0 <= idx < len(cells) else ''

                item = g(idx_item) if idx_item >= 0 else g(0)
                if not item: continue

                # DRAM Spot 제품인지 확인 (부분 매칭)
                is_spot = any(spot.lower() in item.lower() or item.lower() in spot.lower()
                             for spot in DRAM_SPOT_ITEMS)
                if not is_spot:
                    print(f'  [Skip] {item[:50]}')
                    continue

                d_high = g(idx_dh)   if idx_dh   >= 0 else g(1)
                d_low  = g(idx_dl)   if idx_dl   >= 0 else g(2)
                s_high = g(idx_sh)   if idx_sh   >= 0 else g(3)
                s_low  = g(idx_sl)   if idx_sl   >= 0 else g(4)
                s_avg  = g(idx_savg) if idx_savg >= 0 else g(5)
                s_chg  = g(idx_schg) if idx_schg >= 0 else g(6)

                print(f'  [Spot] {item[:45]} | H:{d_high} L:{d_low} Avg:{s_avg} Chg:{s_chg}')
                rows.append([today, last_update, item,
                             d_high, d_low, s_high, s_low, s_avg, s_chg,
                             'TrendForce'])
                found_spot = True

        if not found_spot:
            print('[Crawl] WARNING: No DRAM Spot items found!')

        browser.close()

    print(f'[Crawl] Total rows: {len(rows)}')
    return rows

def save(ws, rows):
    if not rows:
        print('[Save] No data')
        return
    today = datetime.date.today().isoformat()
    existing = ws.get_all_values()
    existing_dates = [r[0] for r in existing[1:] if r]
    if today in existing_dates:
        print(f'[Save] {today} already saved, skipping')
        return
    for row in rows:
        ws.append_row(row)
    print(f'[Save] {len(rows)} rows saved for {today}')

if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID or GCP_CREDENTIALS missing')
        exit(1)
    print(f'[Start] {datetime.date.today()}')
    ws   = get_sheet()
    rows = crawl()
    save(ws, rows)
    print('[Done]')
