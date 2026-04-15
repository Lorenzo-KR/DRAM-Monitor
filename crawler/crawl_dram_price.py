"""
crawl_dram_price.py  v3
TrendForce DRAM Price 크롤링 → Google Sheets 저장

- 탭 클릭 없이 DOM에서 테이블 인덱스로 직접 접근 (안정적)
- 테이블별 Last Update를 개별 추출
- 시트의 마지막 저장 Last Update와 비교 → 변경됐을 때만 저장
  (DRAM Spot은 매일, GDDR은 주간/월간 업데이트이므로 자동 대응)

테이블 → 시트 매핑:
  Table 0: DRAM Spot Price     → spot_prices
  Table 1: DRAM Contract Price → contract_prices
  Table 2: Module Spot Price   → module_prices
  Table 3: GDDR Spot Price     → gddr_prices

컬럼: Date | Last Update | Category | Item |
       High | Low | Session High | Session Low |
       Session Average | Session Change | Source
"""

import os, json, time, re, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID  = os.environ.get('GSHEET_ID', '')
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')

SOURCE_URL = 'https://www.trendforce.com/price/dram/dram_spot'

# 테이블 인덱스 → (카테고리명, 시트명)
TABLE_MAP = [
    (0, 'DRAM Spot',     'spot_prices'),
    (1, 'DRAM Contract', 'contract_prices'),
    (2, 'Module Spot',   'module_prices'),
    (3, 'GDDR Spot',     'gddr_prices'),
]

HEADERS = [
    'Date', 'Last Update', 'Category', 'Item',
    'High', 'Low',
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
            print(f'  [Sheet] {sheet_name}: 헤더 업데이트')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(sheet_name, rows=10000, cols=len(HEADERS) + 2)
        ws.append_row(HEADERS)
        print(f'  [Sheet] {sheet_name}: 새로 생성')
    return ws


def get_last_saved_update(ws):
    """시트에서 마지막으로 저장된 Last Update 값 반환"""
    all_rows = ws.get_all_values()
    # 헤더 제외, 데이터 행의 Last Update 컬럼(index 1)
    data_rows = [r for r in all_rows[1:] if len(r) > 1 and r[1]]
    if not data_rows:
        return None
    return data_rows[-1][1]  # 마지막 행의 Last Update


def extract_date(last_update_text):
    """'Last Update 2026-04-15 11:00 (GMT+8)' → '2026-04-15'"""
    m = re.search(r'(\d{4}-\d{2}-\d{2})', last_update_text)
    return m.group(1) if m else datetime.date.today().isoformat()


def find_col(headers, keywords):
    """헤더 목록에서 키워드 포함 컬럼 인덱스 반환"""
    for kw in keywords:
        for i, h in enumerate(headers):
            if kw.lower() in h.lower():
                return i
    return -1


def get_table_last_update(page, tbl):
    """테이블 주변 DOM에서 Last Update 텍스트 추출"""
    section_text = page.evaluate('''(tbl) => {
        let el = tbl;
        for (let j = 0; j < 8; j++) {
            el = el.parentElement;
            if (!el) break;
            if ((el.innerText || '').includes('Last Update'))
                return el.innerText.slice(0, 300);
        }
        return '';
    }''', tbl)
    matches = re.findall(r'Last Update[^\n]+', section_text)
    return matches[0].strip() if matches else ''


def parse_table(page, tbl, category):
    """테이블 파싱 → (last_update_text, date_str, rows)"""
    last_update = get_table_last_update(page, tbl)
    date_str    = extract_date(last_update) if last_update else datetime.date.today().isoformat()
    print(f'  Last Update: {last_update or "(없음)"}')

    ths   = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
    trs   = tbl.query_selector_all('tbody tr')
    print(f'  헤더: {ths}')
    print(f'  행 수: {len(trs)}개')

    # 컬럼 매핑 (테이블마다 헤더명이 다소 다름)
    idx_item = find_col(ths, ['item'])
    idx_high = find_col(ths, ['daily high', 'weekly high'])
    idx_low  = find_col(ths, ['daily low',  'weekly low'])
    idx_sh   = find_col(ths, ['session high'])
    idx_sl   = find_col(ths, ['session low'])
    idx_savg = find_col(ths, ['session average'])
    idx_schg = find_col(ths, ['session change', 'average change'])

    rows = []
    for tr in trs:
        cells = [td.inner_text().strip() for td in tr.query_selector_all('td')]
        if not cells:
            continue

        item   = cells[idx_item] if idx_item >= 0 and idx_item < len(cells) else ''
        high   = cells[idx_high] if idx_high >= 0 and idx_high < len(cells) else ''
        low    = cells[idx_low]  if idx_low  >= 0 and idx_low  < len(cells) else ''
        s_high = cells[idx_sh]   if idx_sh   >= 0 and idx_sh   < len(cells) else ''
        s_low  = cells[idx_sl]   if idx_sl   >= 0 and idx_sl   < len(cells) else ''
        s_avg  = cells[idx_savg] if idx_savg >= 0 and idx_savg < len(cells) else ''
        s_chg  = cells[idx_schg] if idx_schg >= 0 and idx_schg < len(cells) else ''

        if not item:
            continue
        if not any([high, low, s_avg, s_high]):
            print(f'  [Skip] {item[:40]} — 가격 데이터 없음')
            continue

        print(f'  → {item[:40]} | Avg: {s_avg}')
        rows.append([
            date_str, last_update, category, item,
            high, low, s_high, s_low, s_avg, s_chg,
            'TrendForce'
        ])

    return last_update, date_str, rows


def crawl():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel='chrome',
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
        print(f'[Crawl] 접속 중: {SOURCE_URL}')
        page.goto(SOURCE_URL, wait_until='domcontentloaded', timeout=90000)
        time.sleep(8)

        tables = page.query_selector_all('table')
        print(f'[Crawl] 테이블 {len(tables)}개 발견\n')

        for tbl_idx, category, sheet_name in TABLE_MAP:
            print(f'[{category}] Table {tbl_idx} 파싱 중...')

            if tbl_idx >= len(tables):
                print(f'  [Error] Table {tbl_idx} 없음 — 스킵\n')
                continue

            last_update, date_str, rows = parse_table(page, tables[tbl_idx], category)
            results[sheet_name] = (category, last_update, date_str, rows)
            print()

        ctx.close()
        browser.close()

    return results


def save_all(sh, results):
    total_saved = 0

    for sheet_name, (category, last_update, date_str, rows) in results.items():
        print(f'[Save] {sheet_name}')
        ws = get_or_create_sheet(sh, sheet_name)

        if not rows:
            print(f'  → 파싱된 데이터 없음, 스킵\n')
            continue

        # Last Update 기준 중복 체크
        # 시트의 마지막 저장값과 비교 — 같으면 업데이트 없는 것이므로 스킵
        last_saved = get_last_saved_update(ws)
        if last_saved and last_saved == last_update:
            print(f'  → Last Update 동일 ({last_update}) — 스킵\n')
            continue

        for row in rows:
            ws.append_row(row, value_input_option='RAW')

        print(f'  → {len(rows)}행 저장 완료 (Last Update: {last_update})\n')
        total_saved += len(rows)

    return total_saved


if __name__ == '__main__':
    if not SHEET_ID or not GCP_CREDS:
        print('[Error] GSHEET_ID 또는 GCP_CREDENTIALS 환경변수 없음')
        exit(1)

    print(f'[Start] {datetime.date.today()}')
    sh      = get_gc()
    results = crawl()
    saved   = save_all(sh, results)
    print(f'[Done] 총 {saved}행 저장')
