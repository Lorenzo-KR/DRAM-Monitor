"""
crawl_dram_price.py  v4
TrendForce DRAM Price 크롤링 → Google Sheets 저장

- 탭 클릭 없이 DOM 테이블 인덱스로 직접 접근
- 시트별로 다른 헤더 구조를 각각 정확하게 저장
- Last Update 기준 중복 방지 (업데이트 없으면 스킵)

테이블 → 시트 매핑:
  Table 0: DRAM Spot Price     → spot_prices     (Daily High/Low + Session 컬럼)
  Table 1: DRAM Contract Price → contract_prices  (Session 컬럼 + Average/Low Change)
  Table 2: Module Spot Price   → module_prices    (Weekly High/Low + Session 컬럼)
  Table 3: GDDR Spot Price     → gddr_prices      (Weekly High/Low + Session 컬럼)
"""

import os, json, time, re, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID  = os.environ.get('GSHEET_ID', '')
GCP_CREDS = os.environ.get('GCP_CREDENTIALS', '')

SOURCE_URL = 'https://www.trendforce.com/price/dram/dram_spot'

# 테이블별 설정: 인덱스, 카테고리명, 시트명, 저장 헤더
# 저장 헤더는 실제 TrendForce 테이블 헤더와 동일하게 맞춤
TABLE_MAP = [
    {
        'idx': 0, 'category': 'DRAM Spot', 'sheet': 'spot_prices',
        'headers': ['Date', 'Last Update', 'Category', 'Item',
                    'Daily High', 'Daily Low',
                    'Session High', 'Session Low', 'Session Average', 'Session Change',
                    'Source'],
    },
    {
        'idx': 1, 'category': 'DRAM Contract', 'sheet': 'contract_prices',
        'headers': ['Date', 'Last Update', 'Category', 'Item',
                    'Session High', 'Session Low', 'Session Average',
                    'Average Change', 'Low Change',
                    'Source'],
    },
    {
        'idx': 2, 'category': 'Module Spot', 'sheet': 'module_prices',
        'headers': ['Date', 'Last Update', 'Category', 'Item',
                    'Weekly High', 'Weekly Low',
                    'Session High', 'Session Low', 'Session Average', 'Average Change',
                    'Source'],
    },
    {
        'idx': 3, 'category': 'GDDR Spot', 'sheet': 'gddr_prices',
        'headers': ['Date', 'Last Update', 'Category', 'Item',
                    'Weekly High', 'Weekly Low',
                    'Session High', 'Session Low', 'Session Average', 'Average Change',
                    'Source'],
    },
]


def get_gc():
    creds_dict = json.loads(GCP_CREDS)
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ]
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    return gspread.authorize(creds).open_by_key(SHEET_ID)


def get_or_create_sheet(sh, sheet_name, headers):
    """시트가 없으면 생성, 헤더가 다르면 업데이트"""
    try:
        ws    = sh.worksheet(sheet_name)
        first = ws.row_values(1)
        if first != headers:
            ws.update('A1', [headers])
            print(f'  [Sheet] {sheet_name}: 헤더 업데이트')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(sheet_name, rows=10000, cols=len(headers) + 2)
        ws.append_row(headers)
        print(f'  [Sheet] {sheet_name}: 새로 생성')
    return ws


def get_last_saved_update(ws):
    """시트에서 마지막으로 저장된 Last Update 값 반환"""
    all_rows   = ws.get_all_values()
    data_rows  = [r for r in all_rows[1:] if len(r) > 1 and r[1]]
    return data_rows[-1][1] if data_rows else None


def extract_date(text):
    """'Last Update 2026-04-15 11:00 (GMT+8)' → '2026-04-15'"""
    m = re.search(r'(\d{4}-\d{2}-\d{2})', text)
    return m.group(1) if m else datetime.date.today().isoformat()


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


def parse_table(page, tbl, config):
    """
    테이블 파싱 → (last_update, date_str, rows)

    실제 테이블 헤더를 읽어 config['headers']에 정의된 컬럼명으로 매핑.
    컬럼명이 정확히 일치해야 올바른 위치에 저장됨.
    """
    last_update = get_table_last_update(page, tbl)
    date_str    = extract_date(last_update) if last_update else datetime.date.today().isoformat()
    category    = config['category']
    sheet_hdrs  = config['headers']

    # 실제 테이블 헤더 (th 텍스트)
    actual_ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
    trs        = tbl.query_selector_all('tbody tr')
    print(f'  Last Update : {last_update or "(없음)"}')
    print(f'  실제 헤더   : {actual_ths}')
    print(f'  행 수       : {len(trs)}개')

    rows = []
    for tr in trs:
        cells = [td.inner_text().strip() for td in tr.query_selector_all('td')]
        if not cells:
            continue

        # 실제 헤더 → 셀값 dict
        cell_dict = {h: cells[i] for i, h in enumerate(actual_ths) if i < len(cells)}

        item = cell_dict.get('Item', '').strip()
        if not item:
            continue

        # sheet_hdrs 순서대로 값 조회
        # [Date, Last Update, Category] 고정 + [Item, col1, ...] 동적 + [Source] 고정
        data_cols = [cell_dict.get(h, '') for h in sheet_hdrs[3:-1]]  # Item 포함, Source 제외

        # 가격 데이터(Item 이후)가 하나도 없으면 스킵
        if not any(data_cols[1:]):
            print(f'  [Skip] {item[:40]} — 가격 없음')
            continue

        out_row = [date_str, last_update, category] + data_cols + ['TrendForce']
        print(f'  → {item[:40]}')
        rows.append(out_row)

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

        for cfg in TABLE_MAP:
            tbl_idx = cfg['idx']
            print(f'[{cfg["category"]}] Table {tbl_idx} 파싱 중...')

            if tbl_idx >= len(tables):
                print(f'  [Error] Table {tbl_idx} 없음 — 스킵\n')
                continue

            last_update, date_str, rows = parse_table(page, tables[tbl_idx], cfg)
            results[cfg['sheet']] = {
                'config':      cfg,
                'last_update': last_update,
                'date_str':    date_str,
                'rows':        rows,
            }
            print()

        ctx.close()
        browser.close()

    return results


def save_all(sh, results):
    total_saved = 0

    for sheet_name, info in results.items():
        cfg         = info['config']
        last_update = info['last_update']
        rows        = info['rows']
        print(f'[Save] {sheet_name}')

        if not rows:
            print(f'  → 파싱된 데이터 없음, 스킵\n')
            continue

        ws         = get_or_create_sheet(sh, sheet_name, cfg['headers'])
        last_saved = get_last_saved_update(ws)

        if last_saved and last_saved == last_update:
            print(f'  → Last Update 동일 ({last_update}) — 스킵\n')
            continue

        for row in rows:
            ws.append_row(row, value_input_option='RAW')

        print(f'  → {len(rows)}행 저장 (Last Update: {last_update})\n')
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
