"""
crawl_dram_price.py  v2
TrendForce DRAM Price 크롤링 → Google Sheets 저장

- URL 1개 접속 후 탭 3개를 순서대로 클릭하여 각각 파싱
  Tab 0: DRAM Spot Price     → sheet: spot_prices
  Tab 1: DRAM Contract Price → sheet: contract_prices
  Tab 2: Module Spot Price   → sheet: module_prices

- 저장 기준: Last Update 날짜 기준 (같은 날짜가 이미 있으면 스킵)
- 컬럼: Date | Last Update | Category | Item |
         Daily High | Daily Low | Session High | Session Low |
         Session Average | Session Change | Source
"""

import os, json, time, re, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID  = os.environ.get('GSHEET_ID', '')
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')

SOURCE_URL = 'https://www.trendforce.com/price/dram/dram_spot'

# 클릭할 탭 순서 → (탭 텍스트 키워드, 카테고리명, 시트명)
TAB_MAP = [
    ('DRAM Spot Price',     'DRAM Spot',     'spot_prices'),
    ('DRAM Contract Price', 'DRAM Contract', 'contract_prices'),
    ('Module Spot Price',   'Module Spot',   'module_prices'),
]

HEADERS = [
    'Date', 'Last Update', 'Category', 'Item',
    'Daily High', 'Daily Low',
    'Session High', 'Session Low',
    'Session Average', 'Session Change', 'Source'
]


def get_gc():
    creds_dict = json.loads(GCP_CREDS)
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ]
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    return gspread.authorize(creds).open_by_key(SHEET_ID)


def get_or_create_sheet(sh, sheet_name):
    try:
        ws    = sh.worksheet(sheet_name)
        first = ws.row_values(1)
        if first != HEADERS:
            ws.update('A1', [HEADERS])
            print(f'[Sheet] {sheet_name}: headers updated')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(sheet_name, rows=10000, cols=len(HEADERS) + 2)
        ws.append_row(HEADERS)
        print(f'[Sheet] {sheet_name}: created')
    return ws


def extract_date(text):
    """'Last Update 2026-04-10 18:10 (GMT+8)' → '2026-04-10'"""
    m = re.search(r'(\d{4}-\d{2}-\d{2})', text)
    return m.group(1) if m else datetime.date.today().isoformat()


def find_col(headers, keywords):
    for kw in keywords:
        for i, h in enumerate(headers):
            if kw.lower() in h.lower():
                return i
    return -1


def parse_visible_table(page, category):
    """현재 활성화된(보이는) 테이블 1개만 파싱"""
    rows = []

    # Last Update 텍스트 추출 (페이지에서 가장 최근 것)
    body_text  = page.evaluate('document.body.innerText')
    lu_matches = re.findall(r'Last Update[^\n]+', body_text)
    last_update = lu_matches[0].strip() if lu_matches else ''
    date_str    = extract_date(last_update)
    print(f'  Last Update: {last_update}')

    # 현재 보이는(visible) 테이블만 선택
    # TrendForce는 탭 콘텐츠를 display:none으로 숨기거나 v-show/v-if로 처리
    tables = page.query_selector_all('table')
    visible_tables = []
    for tbl in tables:
        try:
            is_visible = tbl.is_visible()
            if is_visible:
                visible_tables.append(tbl)
        except Exception:
            pass

    print(f'  Visible tables: {len(visible_tables)}')

    if not visible_tables:
        # fallback: 첫 번째 테이블
        print('  [Fallback] using first table')
        visible_tables = tables[:1]

    # 첫 번째 visible 테이블만 파싱
    tbl = visible_tables[0]
    ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
    print(f'  Headers: {ths}')

    idx_item = find_col(ths, ['item'])
    idx_dh   = find_col(ths, ['daily high',  'weekly high'])
    idx_dl   = find_col(ths, ['daily low',   'weekly low'])
    idx_sh   = find_col(ths, ['session high'])
    idx_sl   = find_col(ths, ['session low'])
    idx_savg = find_col(ths, ['session average'])
    idx_schg = find_col(ths, ['session change', 'average change'])

    trs = tbl.query_selector_all('tbody tr')
    print(f'  Rows: {len(trs)}')

    for tr in trs:
        tds   = tr.query_selector_all('td')
        cells = [td.inner_text().strip() for td in tds]
        if not cells:
            continue

        item   = cells[idx_item] if idx_item >= 0 and idx_item < len(cells) else ''
        dh     = cells[idx_dh]   if idx_dh   >= 0 and idx_dh   < len(cells) else ''
        dl     = cells[idx_dl]   if idx_dl   >= 0 and idx_dl   < len(cells) else ''
        s_high = cells[idx_sh]   if idx_sh   >= 0 and idx_sh   < len(cells) else ''
        s_low  = cells[idx_sl]   if idx_sl   >= 0 and idx_sl   < len(cells) else ''
        s_avg  = cells[idx_savg] if idx_savg >= 0 and idx_savg < len(cells) else ''
        s_chg  = cells[idx_schg] if idx_schg >= 0 and idx_schg < len(cells) else ''

        if not item:
            continue
        if not any([dh, dl, s_avg, s_high]):
            print(f'  [Skip] {item[:40]} — no price data')
            continue

        print(f'  [{category}] {item[:40]} | Avg:{s_avg}')
        rows.append([
            date_str, last_update, category, item,
            dh, dl, s_high, s_low, s_avg, s_chg,
            'TrendForce'
        ])

    return date_str, last_update, rows


def crawl():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
        )
        ctx = browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/122.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 800},
            locale='en-US',
        )
        ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        page = ctx.new_page()
        print(f'[Crawl] Loading {SOURCE_URL}')
        page.goto(SOURCE_URL, wait_until='domcontentloaded', timeout=90000)
        time.sleep(8)  # 페이지 완전 로드 대기

        for tab_keyword, category, sheet_name in TAB_MAP:
            print(f'\n[Tab] {category} ({tab_keyword})')

            # 탭 버튼 찾아서 클릭
            try:
                # 텍스트로 탭 버튼 찾기
                tab_btn = page.locator(
                    f'button:has-text("{tab_keyword}"), '
                    f'a:has-text("{tab_keyword}"), '
                    f'li:has-text("{tab_keyword}"), '
                    f'span:has-text("{tab_keyword}")'
                ).first

                if tab_btn.count() == 0:
                    # 부분 텍스트로 재시도
                    short = tab_keyword.split()[0]  # 'DRAM', 'Module' 등
                    tab_btn = page.locator(f'[class*="tab"]:has-text("{short}")').first

                tab_btn.click(timeout=5000)
                print(f'  Clicked tab: {tab_keyword}')
                time.sleep(3)  # 탭 전환 애니메이션 대기

            except Exception as e:
                print(f'  [Tab Click Error] {e}')
                if tab_keyword == TAB_MAP[0][0]:
                    print('  First tab — already active, continuing')
                else:
                    print('  Skipping this tab')
                    continue

            # 현재 보이는 테이블 파싱
            date_str, last_update, rows = parse_visible_table(page, category)
            results[sheet_name] = (category, date_str, last_update, rows)
            print(f'  → {len(rows)} rows parsed')

        ctx.close()
        browser.close()

    return results


def save_all(sh, results):
    total_saved = 0

    for sheet_name, (category, date_str, last_update, rows) in results.items():
        ws = get_or_create_sheet(sh, sheet_name)

        if not rows:
            print(f'[Save] {sheet_name}: no rows')
            continue

        # 중복 체크 (같은 날짜 이미 있으면 스킵)
        existing       = ws.get_all_values()
        existing_dates = {r[0] for r in existing[1:] if r}

        if date_str in existing_dates:
            print(f'[Save] {sheet_name}: {date_str} already exists → skip')
            continue

        for row in rows:
            ws.append_row(row, value_input_option='RAW')

        print(f'[Save] {sheet_name}: {len(rows)} rows saved (date: {date_str})')
        total_saved += len(rows)

    return total_saved


if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID or GCP_CREDENTIALS missing')
        exit(1)

    print(f'[Start] {datetime.date.today()} — tab-click mode, 3 tabs')
    sh      = get_gc()
    results = crawl()
    saved   = save_all(sh, results)
    print(f'\n[Done] Total {saved} rows saved')
