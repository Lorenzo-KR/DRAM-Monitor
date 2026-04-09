"""
crawl_dram_price.py
TrendForce DRAM Price 크롤링 → Google Sheets 저장

대상 3개 URL:
  - DRAM Spot     → 시트: spot_prices
  - DRAM Contract → 시트: contract_prices
  - Module Spot   → 시트: module_prices

공통 컬럼: Date | Last Update | Category | Item |
           Daily High | Daily Low | Session High | Session Low |
           Session Average | Session Change | Source
"""

import os, json, time, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID  = os.environ.get('GSHEET_ID', '')
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')

HEADERS = [
    'Date', 'Last Update', 'Category', 'Item',
    'Daily High', 'Daily Low',
    'Session High', 'Session Low',
    'Session Average', 'Session Change', 'Source'
]

TARGETS = [
    {'url': 'https://www.trendforce.com/price/dram/dram_spot',     'category': 'DRAM Spot',     'sheet': 'spot_prices'},
    {'url': 'https://www.trendforce.com/price/dram/dram_contract', 'category': 'DRAM Contract', 'sheet': 'contract_prices'},
    {'url': 'https://www.trendforce.com/price/dram/module_spot',   'category': 'Module Spot',   'sheet': 'module_prices'},
]


def get_gc():
    creds_dict = json.loads(GCP_CREDS)
    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    gc = gspread.authorize(creds)
    return gc.open_by_key(SHEET_ID)


def get_or_create_sheet(sh, sheet_name):
    try:
        ws = sh.worksheet(sheet_name)
        first = ws.row_values(1)
        if first != HEADERS:
            ws.update('A1', [HEADERS])
            print(f'[Sheet] {sheet_name}: headers updated (data preserved)')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(sheet_name, rows=10000, cols=len(HEADERS) + 2)
        ws.append_row(HEADERS)
        print(f'[Sheet] {sheet_name}: created')
    return ws


def parse_tables(page, category, today, last_update):
    rows = []
    tables = page.query_selector_all('table')
    print(f'  [Parse] {len(tables)} tables found')

    for ti, tbl in enumerate(tables):
        ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
        ths_str = ' '.join(ths).lower()
        if not any(k in ths_str for k in ['item', 'daily', 'session', 'price']):
            continue

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
        print(f'  [Table {ti}] {len(trs)} rows | headers: {ths[:5]}')

        for tr in trs:
            tds   = tr.query_selector_all('td')
            cells = [td.inner_text().strip() for td in tds]
            if not cells:
                continue

            def g(idx):
                return cells[idx] if 0 <= idx < len(cells) else ''

            item   = g(idx_item) if idx_item >= 0 else g(0)
            d_high = g(idx_dh)   if idx_dh   >= 0 else ''
            d_low  = g(idx_dl)   if idx_dl   >= 0 else ''
            s_high = g(idx_sh)   if idx_sh   >= 0 else ''
            s_low  = g(idx_sl)   if idx_sl   >= 0 else ''
            s_avg  = g(idx_savg) if idx_savg >= 0 else ''
            s_chg  = g(idx_schg) if idx_schg >= 0 else ''

            if not item or not any([d_high, d_low, s_avg]):
                continue

            print(f'    [{category}] {item[:40]} | Avg:{s_avg} Chg:{s_chg}')
            rows.append([today, last_update, category, item,
                         d_high, d_low, s_high, s_low, s_avg, s_chg, 'TrendForce'])
    return rows


def crawl_all():
    today   = datetime.date.today().isoformat()
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
        )

        for target in TARGETS:
            url, category, sheet = target['url'], target['category'], target['sheet']
            print(f'\n[Crawl] === {category} ===')

            ctx = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 800},
                locale='en-US',
            )
            ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            page = ctx.new_page()

            try:
                page.goto(url, wait_until='domcontentloaded', timeout=90000)
                time.sleep(8)

                last_update = ''
                try:
                    page_text = page.evaluate('document.body.innerText')
                    for line in page_text.split('\n'):
                        if 'Last Update' in line:
                            last_update = line.strip()
                            print(f'  [Last Update] {last_update}')
                            break
                except Exception as e:
                    print(f'  [Last Update Error] {e}')

                rows = parse_tables(page, category, today, last_update)
                results[sheet] = rows
                print(f'  [Result] {len(rows)} rows')

            except Exception as e:
                print(f'  [Error] {e}')
                results[sheet] = []
            finally:
                ctx.close()

        browser.close()

    return results


def save_all(sh, results):
    today       = datetime.date.today().isoformat()
    total_saved = 0

    for sheet_name, rows in results.items():
        ws = get_or_create_sheet(sh, sheet_name)
        if not rows:
            print(f'[Save] {sheet_name}: no data')
            continue
        existing       = ws.get_all_values()
        existing_dates = {r[0] for r in existing[1:] if r}
        if today in existing_dates:
            print(f'[Save] {sheet_name}: {today} already exists, skipping')
            continue
        for row in rows:
            ws.append_row(row, value_input_option='RAW')
        print(f'[Save] {sheet_name}: {len(rows)} rows saved for {today}')
        total_saved += len(rows)

    return total_saved


if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID or GCP_CREDENTIALS missing')
        exit(1)
    print(f'[Start] {datetime.date.today()} — 3 targets')
    sh      = get_gc()
    results = crawl_all()
    saved   = save_all(sh, results)
    print(f'\n[Done] Total {saved} rows saved')
