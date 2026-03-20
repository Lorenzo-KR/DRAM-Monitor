/**
 * pages/verify.js
 * 데이터 검증 — 텍스트 붙여넣기 or 이미지 업로드 → DB 비교
 */

Pages.Verify = (() => {

  let _type    = 'daily'; // daily | lot | invoice
  let _results = [];

  const COUNTRY_MAP = { hk:'HK','hong kong':'HK','홍콩':'HK', sg:'SG',singapore:'SG','싱가포르':'SG' };

  function _parseDate(v) {
    if (!v) return '';
    if (typeof v === 'number') { const d = new Date((v-25569)*86400000); return d.toISOString().split('T')[0]; }
    const s = String(v).replace(/\//g,'-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s); return isNaN(d)?'':d.toISOString().split('T')[0];
  }

  // ── 텍스트 파싱 ─────────────────────────────────────────────
  function _parsePaste(raw) {
    const lines = raw.split('\n').map(l=>l.trim()).filter(l=>l);
    if (lines.length < 2) return [];
    const header = lines[0].split('\t').map(h=>h.trim().toLowerCase());
    const rows   = [];
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split('\t').map(c=>c.trim());
      const obj  = {};
      header.forEach((h,j) => obj[h] = cols[j]||'');
      rows.push(obj);
    }
    return rows;
  }

  // ── 컬럼 자동 매핑 ──────────────────────────────────────────
  function _mapCol(row, candidates) {
    for (const k of candidates) { if (row[k] !== undefined) return row[k]; }
    return '';
  }

  // ── 일별 처리 검증 ──────────────────────────────────────────
  function _verifyDaily(rows) {
    const dailies = Store.getDailies();
    const lots    = Store.getLots();
    return rows.map(row => {
      const date  = _parseDate(_mapCol(row, ['date','날짜','일자','day']));
      const lotNo = _mapCol(row, ['batch','lot','lot번호','lot no','lotno','배치']);
      const proc  = parseNumber(_mapCol(row, ['qty','합계','total','처리량','proc','quantity']));
      if (!date || !lotNo) return null;

      const lot    = lots.find(l => l.lotNo===lotNo || String(l.id)===lotNo || l.lotNo?.toLowerCase()===lotNo.toLowerCase());
      const dbRec  = dailies.find(r => r.date===date && (String(r.lotId)===String(lot?.id) || r.lotNo===lotNo));
      const dbProc = dbRec ? parseNumber(dbRec.proc) : null;
      const diff   = dbProc !== null ? proc - dbProc : null;
      const result = dbProc===null ? 'missing' : diff===0 ? 'ok' : 'mismatch';

      return { date, lotNo, country: lot?.country||_mapCol(row,['region','country','지역']), proc, dbProc, diff, result, lot };
    }).filter(Boolean);
  }

  // ── LOT 목록 검증 ───────────────────────────────────────────
  function _verifyLot(rows) {
    const lots = Store.getLots();
    return rows.map(row => {
      const lotNo  = _mapCol(row, ['lot','lot번호','lot no','lotno','batch']);
      const inDate = _parseDate(_mapCol(row, ['indate','입고일','date','날짜']));
      const qty    = parseNumber(_mapCol(row, ['qty','수량','quantity']));
      if (!lotNo) return null;

      const lot   = lots.find(l => l.lotNo===lotNo || l.lotNo?.toLowerCase()===lotNo.toLowerCase());
      const dbQty = lot ? parseNumber(lot.qty) : null;
      const diff  = dbQty!==null && qty ? qty-dbQty : null;
      const result = !lot ? 'missing' : diff===0 ? 'ok' : 'mismatch';

      return { date: inDate||'—', lotNo, country: lot?.country||'', proc: qty, dbProc: dbQty, diff, result, lot };
    }).filter(Boolean);
  }

  // ── 인보이스 검증 ───────────────────────────────────────────
  function _verifyInvoice(rows) {
    const invs = Store.getInvoices();
    return rows.map(row => {
      const no     = _mapCol(row, ['no','번호','invoice','인보이스번호']);
      const date   = _parseDate(_mapCol(row, ['date','날짜','발행일']));
      const amount = parseNumber(_mapCol(row, ['amount','청구액','금액']));
      if (!no && !date) return null;

      const inv    = invs.find(r => r.no===no || (r.date===date && Math.abs(parseNumber(r.amount)-amount)<1));
      const dbAmt  = inv ? parseNumber(inv.amount) : null;
      const diff   = dbAmt!==null && amount ? amount-dbAmt : null;
      const result = !inv ? 'missing' : diff===0||Math.abs(diff)<0.01 ? 'ok' : 'mismatch';

      return { date: date||'—', lotNo: no||'—', country: inv?.country||'', proc: amount, dbProc: dbAmt, diff, result };
    }).filter(Boolean);
  }

  // ── 검증 실행 ───────────────────────────────────────────────
  function runVerify() {
    const raw  = document.getElementById('vfy-paste')?.value.trim();
    if (!raw)  { UI.toast('데이터를 붙여넣어 주세요', true); return; }
    const rows = _parsePaste(raw);
    if (!rows.length) { UI.toast('파싱할 수 없습니다. 헤더 포함 탭으로 구분된 표를 붙여넣어 주세요', true); return; }

    if (_type === 'daily')   _results = _verifyDaily(rows);
    else if (_type === 'lot') _results = _verifyLot(rows);
    else                      _results = _verifyInvoice(rows);

    _renderResults();
  }

  // ── 결과 렌더 ───────────────────────────────────────────────
  function _renderResults(onlyMismatch = false) {
    const el = document.getElementById('vfy-results'); if (!el) return;
    const list = onlyMismatch ? _results.filter(r=>r.result!=='ok') : _results;

    const okCnt      = _results.filter(r=>r.result==='ok').length;
    const mismatchCnt = _results.filter(r=>r.result==='mismatch').length;
    const missingCnt = _results.filter(r=>r.result==='missing').length;

    const CO_STYLE  = { HK:'background:#FAEEDA;color:#633806', SG:'background:#E1F5EE;color:#085041' };
    const typeLabel = _type==='daily'?'처리량':_type==='lot'?'수량':'청구액';

    const rows = list.map((r,i) => {
      const stStyle  = r.result==='ok' ? 'background:#E1F5EE;color:#085041' : r.result==='mismatch' ? 'background:#FCEBEB;color:#791F1F' : 'background:#FAEEDA;color:#633806';
      const stLabel  = r.result==='ok' ? '✓ 일치' : r.result==='mismatch' ? '✗ 불일치' : '⚠ DB 없음';
      const rowBg    = r.result==='mismatch' ? 'background:#FFF5F5' : r.result==='missing' ? 'background:#FFFBF5' : '';
      const diffCell = r.diff===null ? '—' : r.diff===0 ? '—' : `<span style="background:#FCEBEB;color:#791F1F;font-family:var(--font-mono);font-size:11px;padding:1px 6px;border-radius:3px">${r.diff>0?'+':''}${formatNumber(Math.round(r.diff))}</span>`;
      return `
        <tr style="border-bottom:0.5px solid var(--bd);${rowBg}">
          <td style="padding:7px 10px;font-size:11px;color:var(--tx3);text-align:center">${i+1}</td>
          <td style="padding:7px 10px;font-size:11px;color:var(--tx3)">${r.date}</td>
          <td style="padding:7px 10px;font-family:var(--font-mono);font-size:11px">${r.lotNo}</td>
          <td style="padding:7px 10px">${r.country ? `<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:500;padding:1px 6px;border-radius:3px;${CO_STYLE[r.country]||''}">${r.country}</span>` : '—'}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:11px">${r.proc>0?formatNumber(Math.round(r.proc)):'—'}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--tx2)">${r.dbProc!==null?formatNumber(Math.round(r.dbProc)):'—'}</td>
          <td style="padding:7px 10px;text-align:right">${diffCell}</td>
          <td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;font-size:10px;font-weight:500;padding:2px 7px;border-radius:3px;${stStyle}">${stLabel}</span></td>
        </tr>`;
    }).join('');

    // DB 없는 항목 일괄 입력 버튼
    const missingItems = _results.filter(r=>r.result==='missing');
    const bulkBtn = _type==='daily' && missingItems.length > 0
      ? `<button onclick="Pages.Verify.bulkInsert()" style="padding:6px 14px;background:#185FA5;color:#fff;border:none;border-radius:var(--rs);font-size:12px;font-weight:500;cursor:pointer">DB 없는 ${missingItems.length}건 일괄 입력</button>`
      : '';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:12px">
        <div style="background:var(--bg);padding:10px 14px;text-align:center">
          <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">총 비교</div>
          <div style="font-size:20px;font-weight:500">${_results.length}건</div>
        </div>
        <div style="background:#E1F5EE;padding:10px 14px;text-align:center">
          <div style="font-size:10px;color:#085041;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">일치</div>
          <div style="font-size:20px;font-weight:500;color:#085041">${okCnt}건</div>
        </div>
        <div style="background:#FCEBEB;padding:10px 14px;text-align:center">
          <div style="font-size:10px;color:#791F1F;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">불일치</div>
          <div style="font-size:20px;font-weight:500;color:#791F1F">${mismatchCnt}건</div>
        </div>
        <div style="background:#FAEEDA;padding:10px 14px;text-align:center">
          <div style="font-size:10px;color:#633806;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">DB 없음</div>
          <div style="font-size:20px;font-weight:500;color:#633806">${missingCnt}건</div>
        </div>
      </div>

      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto;margin-bottom:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg)">
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd);width:32px;text-align:center">#</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">날짜</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">LOT/번호</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">지역</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd);text-align:right">리포트 ${typeLabel}</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd);text-align:right">DB ${typeLabel}</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd);text-align:right">차이</th>
            <th style="padding:7px 10px;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">결과</th>
          </tr></thead>
          <tbody>${rows||'<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--tx3)">결과 없음</td></tr>'}</tbody>
        </table>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="Pages.Verify.filterMismatch()" style="padding:6px 14px;border:0.5px solid var(--bd);border-radius:var(--rs);font-size:12px;background:none;color:var(--tx2);cursor:pointer">불일치만 보기</button>
        <button onclick="Pages.Verify.exportResults()" style="padding:6px 14px;border:0.5px solid var(--bd);border-radius:var(--rs);font-size:12px;background:none;color:var(--tx2);cursor:pointer">↓ 엑셀 내보내기</button>
        ${bulkBtn}
      </div>`;
  }

  async function bulkInsert() {
    const missing = _results.filter(r=>r.result==='missing' && r.lot);
    if (!missing.length) { UI.toast('LOT가 매칭된 미입력 데이터가 없습니다', true); return; }
    if (!confirm(`${missing.length}건을 DB에 입력하시겠습니까?`)) return;
    let cnt = 0;
    for (const r of missing) {
      const lot    = r.lot;
      const cumNew = getLotCumulative(lot.id, Store.getDailies()) + r.proc;
      const remNew = Math.max(0, parseNumber(lot.qty) - cumNew);
      const record = { id:Date.now()+Math.random(), date:r.date, lotId:lot.id, lotNo:lot.lotNo||lot.id, biz:lot.biz, country:lot.country, customerName:lot.customerName||'', proc:r.proc, normal:0, noBoot:0, abnormal:0, cumul:cumNew, remain:remNew, note:'검증 일괄입력', done:'0' };
      const res = await Api.append(CONFIG.SHEETS.DAILY, record);
      if (!res.error) { Store.upsertDaily(record); cnt++; }
    }
    UI.toast(`${cnt}건 입력 완료`);
    runVerify();
  }

  function filterMismatch() { _renderResults(true); }

  function exportResults() {
    const data = _results.map(r => ({
      '날짜': r.date, 'LOT/번호': r.lotNo, '지역': r.country,
      '리포트값': r.proc, 'DB값': r.dbProc??'', '차이': r.diff??'',
      '결과': r.result==='ok'?'일치':r.result==='mismatch'?'불일치':'DB없음',
    }));
    _xlsxExport(data, '검증결과_'+today()+'.xlsx', '검증결과');
  }

  function setType(type) {
    _type = type;
    ['daily','lot','invoice'].forEach(t => {
      const btn = document.getElementById('vfy-type-'+t); if (!btn) return;
      btn.style.background   = t===type ? 'var(--navy)' : 'none';
      btn.style.color        = t===type ? '#fff' : 'var(--tx2)';
      btn.style.borderColor  = t===type ? 'var(--navy)' : 'var(--bd2)';
    });
  }

  function render() {
    const el = document.getElementById('verify-body'); if (!el) return;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:14px">
          <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="width:18px;height:18px;border-radius:50%;background:var(--tx);color:var(--card);font-size:10px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">1</span>
            검증 유형 선택
          </div>
          <div style="display:flex;gap:6px;margin-bottom:14px">
            <button id="vfy-type-daily" onclick="Pages.Verify.setType('daily')"
              style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid var(--navy);background:var(--navy);color:#fff;transition:.15s">일별 처리</button>
            <button id="vfy-type-lot" onclick="Pages.Verify.setType('lot')"
              style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid var(--bd2);background:none;color:var(--tx2);transition:.15s">LOT 목록</button>
            <button id="vfy-type-invoice" onclick="Pages.Verify.setType('invoice')"
              style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid var(--bd2);background:none;color:var(--tx2);transition:.15s">인보이스</button>
          </div>
          <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span style="width:18px;height:18px;border-radius:50%;background:var(--tx);color:var(--card);font-size:10px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">2</span>
            리포트 붙여넣기
          </div>
          <textarea id="vfy-paste" style="width:100%;height:120px;padding:8px 10px;border:0.5px solid var(--bd2);border-radius:var(--rs);font-size:11px;font-family:var(--font-mono);background:var(--bg);color:var(--tx);resize:vertical;line-height:1.5"
            placeholder="엑셀/표에서 헤더 포함 복사 후 붙여넣기

예시 (일별 처리):
Date	Batch	Qty	Normal	No Boot	Abnormal
2026-03-18	SGT100001597	280	210	40	30
2026-03-17	SGT100001597	320	280	25	15"></textarea>
        </div>

        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:14px">
          <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="width:18px;height:18px;border-radius:50%;background:var(--tx);color:var(--card);font-size:10px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">3</span>
            이미지 업로드 (홍콩 캡처)
          </div>
          <div style="width:100%;height:90px;border:1px dashed var(--bd2);border-radius:var(--rs);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:var(--bg);color:var(--tx3);font-size:12px;cursor:pointer;margin-bottom:14px" onclick="document.getElementById('vfy-img-input').click()">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>클릭하여 이미지 업로드</span>
            <span style="font-size:10px">PNG, JPG · Claude AI가 자동으로 읽습니다</span>
          </div>
          <input id="vfy-img-input" type="file" accept="image/*" style="display:none" onchange="Pages.Verify.handleImage(this)">
          <div id="vfy-img-status" style="font-size:12px;color:var(--tx3);margin-bottom:14px"></div>

          <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="width:18px;height:18px;border-radius:50%;background:var(--tx);color:var(--card);font-size:10px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">4</span>
            검증 실행
          </div>
          <button onclick="Pages.Verify.runVerify()" style="width:100%;padding:9px;background:#185FA5;color:#fff;border:none;border-radius:var(--rs);font-size:13px;font-weight:500;cursor:pointer">검증 실행</button>
        </div>
      </div>

      <div id="vfy-results"></div>`;
  }

  async function handleImage(input) {
    const file = input.files[0]; if (!file) return;
    const statusEl = document.getElementById('vfy-img-status');
    if (statusEl) statusEl.textContent = '이미지 읽는 중...';

    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target.result.split(',')[1];
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 1000,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
                { type: 'text', text: '이 표에서 날짜, LOT번호(Batch), 처리량(합계/Total/Qty), Normal, No Boot, Abnormal 숫자를 탭으로 구분된 표 형식으로 추출해주세요. 첫 행은 헤더(Date, Batch, Qty, Normal, No Boot, Abnormal)로 해주세요. 숫자가 없는 셀은 0으로 표시해주세요. 표 데이터만 출력하고 다른 설명은 하지 마세요.' }
              ]
            }]
          })
        });
        const data = await resp.json();
        const text = data.content?.find(c=>c.type==='text')?.text || '';
        const pasteEl = document.getElementById('vfy-paste');
        if (pasteEl) pasteEl.value = text.trim();
        if (statusEl) statusEl.textContent = '✓ 이미지에서 데이터 추출 완료. 검증 실행을 눌러주세요.';
        if (statusEl) statusEl.style.color = '#085041';
      } catch(err) {
        if (statusEl) statusEl.textContent = '이미지 읽기 실패. API 키를 확인해주세요.';
        if (statusEl) statusEl.style.color = '#791F1F';
      }
    };
    reader.readAsDataURL(file);
  }

  return { render, setType, runVerify, filterMismatch, bulkInsert, exportResults, handleImage };

})();
