"""
crawl_dram_price.py
TrendForce DRAM Spot Price 크롤링 → Google Sheets 저장
컬럼: Date | Category | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
"""

import os, json, time, datetime
from playwright.sync_api import sync_playwright
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID   = os.environ.get('GSHEET_ID', '')
GCP_CREDS  = os.environ.get('GCP_CREDENTIALS', '')
TARGET_URL = 'https://www.trendforce.com/price/dram/dram_spot'

HEADERS = ['Date', 'Category', 'Item', 'Daily High', 'Daily Low',
           'Session High', 'Session Low', 'Session Average', 'Session Change', 'Source']

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
            print('[Sheet] Headers reset to new format')
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet('spot_prices', rows=5000, cols=20)
        ws.append_row(HEADERS)
        print('[Sheet] Created spot_prices')
    return ws

def is_number(s):
    """숫자인지 확인 (콤마 포함)"""
    try:
        float(str(s).replace(',', ''))
        return True
    except:
        return False

def crawl():
    rows = []
    today = datetime.date.today().isoformat()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        )
        page = ctx.new_page()
        print(f'[Crawl] Loading {TARGET_URL}')
        page.goto(TARGET_URL, wait_until='networkidle', timeout=90000)
        time.sleep(6)

        # 섹션 제목과 테이블을 함께 찾기
        # TrendForce 구조: 섹션 헤딩 → 테이블 반복
        html_content = page.content()
        print(f'[Crawl] Page HTML size: {len(html_content)}')

        # 섹션 키워드로 카테고리 판별
        SECTION_KEYWORDS = {
            'Spot': ['spot', 'dram spot', 'dram_spot'],
            'Contract': ['contract'],
            'Module': ['module', 'so-dimm', 'sodimm', 'udimm', 'rdimm'],
        }

        tables = page.query_selector_all('table')
        print(f'[Crawl] Found {len(tables)} tables')

        for ti, tbl in enumerate(tables):
            # 테이블 위에 있는 제목 찾기 (이전 형제 또는 부모)
            category = 'Spot'  # 기본값
            try:
                # 테이블 주변 텍스트로 카테고리 추론
                parent_text = page.evaluate('''(tbl) => {
                    let el = tbl;
                    for (let i = 0; i < 5; i++) {
                        el = el.parentElement;
                        if (!el) break;
                        const h = el.querySelector("h1,h2,h3,h4,h5,.title,.section-title");
                        if (h) return h.innerText;
                    }
                    // 이전 형제 요소들 확인
                    let sib = tbl.previousElementSibling;
                    for (let i = 0; i < 5; i++) {
                        if (!sib) break;
                        const t = sib.innerText || '';
                        if (t.trim()) return t;
                        sib = sib.previousElementSibling;
                    }
                    return "";
                }''', tbl)

                pt_lower = (parent_text or '').lower()
                if 'contract' in pt_lower:
                    category = 'Contract'
                elif 'module' in pt_lower:
                    category = 'Module'
                elif 'spot' in pt_lower:
                    category = 'Spot'
                print(f'[Table {ti}] Category hint: {repr(parent_text[:60] if parent_text else "")} → {category}')
            except Exception as e:
                print(f'[Table {ti}] Category detect error: {e}')

            # 헤더 확인
            ths = [th.inner_text().strip() for th in tbl.query_selector_all('th')]
            print(f'[Table {ti}] Headers: {ths}')

            # Item/Daily 컬럼 없으면 스킵
            ths_lower = ' '.join(ths).lower()
            if not any(k in ths_lower for k in ['item', 'daily', 'session', 'high', 'low']):
                continue

            # 헤더 인덱스 매핑
            def hi(keywords):
                for kw in keywords:
                    for i, h in enumerate(ths):
                        if kw.lower() in h.lower():
                            return i
                return -1

            idx_item  = hi(['item'])
            idx_dh    = hi(['daily high'])
            idx_dl    = hi(['daily low'])
            idx_sh    = hi(['session high'])
            idx_sl    = hi(['session low'])
            idx_savg  = hi(['session average', 'session avg'])
            idx_schg  = hi(['session change', 'change'])

            print(f'[Table {ti}] Col indices: item={idx_item} dH={idx_dh} dL={idx_dl} sAvg={idx_savg} sChg={idx_schg}')

            trs = tbl.query_selector_all('tbody tr')
            for tr in trs:
                tds = tr.query_selector_all('td')
                cells = [td.inner_text().strip() for td in tds]
                if not cells:
                    continue

                def g(idx):
                    return cells[idx] if 0 <= idx < len(cells) else ''

                item = g(idx_item) if idx_item >= 0 else g(0)
                if not item:
                    continue

                # 숫자가 아닌 셀이 item 위치에 오면 사용
                d_high = g(idx_dh)  if idx_dh  >= 0 else g(1)
                d_low  = g(idx_dl)  if idx_dl  >= 0 else g(2)
                s_high = g(idx_sh)  if idx_sh  >= 0 else g(3)
                s_low  = g(idx_sl)  if idx_sl  >= 0 else g(4)
                s_avg  = g(idx_savg) if idx_savg >= 0 else g(5)
                s_chg  = g(idx_schg) if idx_schg >= 0 else g(6)

                # SO-DIMM 등 Module 제품은 카테고리 보정
                item_lower = item.lower()
                if any(k in item_lower for k in ['so-dimm', 'sodimm', 'udimm', 'rdimm', 'lpddr']):
                    row_category = 'Module'
                elif any(k in item_lower for k in ['gddr']):
                    row_category = 'Graphics'
                else:
                    row_category = category

                print(f'  [{row_category}] {item[:40]} | H:{d_high} L:{d_low} Avg:{s_avg} Chg:{s_chg}')
                rows.append([today, row_category, item, d_high, d_low, s_high, s_low, s_avg, s_chg, 'TrendForce'])

        browser.close()

    print(f'[Crawl] Total rows collected: {len(rows)}')
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
