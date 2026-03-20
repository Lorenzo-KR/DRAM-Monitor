/**
 * pages/dailyInput.js
 * 일별 처리 입력 — LOT 아코디언 카드 + 엑셀 붙여넣기 팝업
 */

Pages.DailyInput = (() => {

  let _co      = '';
  let _biz     = '';
  let _openId  = null;
  let _parsedRows = [];

  // ── 필터 ────────────────────────────────────────────────────
  function setFilter(el, type) {
    if (type === 'co') {
      document.querySelectorAll('#pg-daily [data-co]').forEach(e => e.classList.remove('on'));
      el.classList.add('on'); _co = el.dataset.co;
    } else {
      document.querySelectorAll('#pg-daily [data-biz]').forEach(e => e.classList.remove('on'));
      el.classList.add('on'); _biz = el.dataset.biz;
    }
    _openId = null;
    render();
  }

  // ── LOT 아코디언 목록 ────────────────────────────────────────
  function render() {
    const wrap = document.getElementById('dp-lot-cards');
    const info = document.getElementById('dp-filter-info');
    if (!_co || !_biz) {
      wrap.innerHTML = '<div class="empty" style="padding:48px">위에서 국가와 사업을 선택하면 LOT 목록이 표시됩니다</div>';
      info.textContent = ''; return;
    }

    const dailies = Store.getDailies();
    const lots    = Store.getLots()
      .filter(l => l.country === _co && l.biz === _biz)
      .sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    info.textContent = (CONFIG.COUNTRY_LABELS[_co] || _co) + ' · ' + (CONFIG.BIZ_LABELS[_biz] || _biz) + ' · ' + lots.length + '건';

    if (!lots.length) {
      wrap.innerHTML = `<div class="empty" style="padding:40px">등록된 LOT가 없습니다<br><a href="#" onclick="Nav.go('lotreg');return false;" style="color:var(--navy);font-weight:500">LOT 등록하러 가기</a></div>`;
      return;
    }

    wrap.innerHTML = lots.map(lot => {
      const st    = getLotStatus(lot);
      const cum   = getLotCumulative(lot.id, dailies);
      const rem   = getLotRemaining(lot, dailies);
      const pct   = getLotProgress(lot, dailies);
      const dd    = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const ddColor = dd === null ? 'var(--tx3)' : dd < 0 ? '#dc2626' : dd <= 3 ? '#92400e' : 'var(--tx2)';
      const ddText  = dd === null ? '-' : dd < 0 ? 'D+' + Math.abs(dd) : dd === 0 ? 'D-Day' : 'D-' + dd;
      const pbC   = st === 'done' ? '#16a34a' : st === 'overdue' ? '#dc2626' : pct >= 70 ? CONFIG.BIZ_COLORS.SSD : CONFIG.BIZ_COLORS[_biz];
      const isOpen = _openId === lot.id;

      return `
        <div class="lot-acc-card" id="acc-${lot.id}" style="border:1px solid var(--bd);border-radius:var(--r);margin-bottom:8px;overflow:hidden;border-left:4px solid ${CONFIG.BIZ_COLORS[_biz]}">
          <div onclick="Pages.DailyInput.toggleCard(${lot.id})" style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:${isOpen ? 'var(--bg)' : 'var(--card)'};transition:.15s">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
              <span style="font-size:14px;font-weight:600;font-family:var(--font-mono);flex-shrink:0">${lot.lotNo || lot.id}</span>
              <div style="display:flex;gap:10px;font-size:12px;color:var(--tx2)">
                <span>입고 <b style="color:var(--tx)">${formatNumber(parseNumber(lot.qty))}</b></span>
                <span>처리 <b style="color:${CONFIG.BIZ_COLORS[_biz]}">${formatNumber(cum)}</b></span>
                <span>잔량 <b style="color:${rem > 0 ? '#92400e' : '#166534'}">${formatNumber(rem)}</b></span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <div style="width:70px;height:5px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${pbC};width:${pct}%"></div></div>
                <span style="font-size:12px;font-weight:600;color:${pbC}">${pct}%</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px">
              <span style="font-size:12px;font-weight:500;color:${ddColor}">${ddText}</span>
              ${renderStatusBadge(st)}
              <svg width="14" height="14" fill="none" viewBox="0 0 16 16" style="transition:transform .2s;transform:${isOpen ? 'rotate(180deg)' : 'rotate(0)'}"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
          ${isOpen ? _renderCardBody(lot, dailies) : ''}
        </div>`;
    }).join('');
  }

  function _renderCardBody(lot, dailies) {
    const isDram = lot.biz === 'DRAM';
    const cum    = getLotCumulative(lot.id, dailies);
    const hist   = dailies.filter(r => String(r.lotId) === String(lot.id)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const histRows = hist.length === 0
      ? '<div style="font-size:12px;color:var(--tx3);padding:12px 0;text-align:center">처리 기록 없음</div>'
      : hist.map(r => {
          const tot = isDram ? (parseNumber(r.normal) + parseNumber(r.noBoot) + parseNumber(r.abnormal)) || parseNumber(r.proc) : parseNumber(r.proc);
          return `
            <div style="display:grid;grid-template-columns:90px ${isDram ? '55px 55px 55px ' : ' '}70px 70px 70px 60px 1fr 30px;gap:6px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:12px;align-items:center">
              <span style="font-family:var(--font-mono)">${r.date}</span>
              ${isDram ? `<span style="font-family:var(--font-mono);color:#166534">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);color:#92400e">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);color:#991b1b">${formatNumber(parseNumber(r.abnormal))}</span>` : ''}
              <span style="font-family:var(--font-mono);font-weight:600">${formatNumber(tot)}</span>
              <span style="font-family:var(--font-mono);color:var(--tx2)">${formatNumber(parseNumber(r.cumul))}</span>
              <span style="font-family:var(--font-mono);color:${parseNumber(r.remain) > 0 ? '#92400e' : '#166534'}">${formatNumber(parseNumber(r.remain))}</span>
              <span>${r.done === '1' ? '<span class="bdg b-done" style="font-size:10px">완료</span>' : ''}</span>
              <span style="color:var(--tx3);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note || ''}</span>
              <button class="btn del sm" style="padding:2px 6px;font-size:11px" onclick="Pages.DailyInput.deleteRecord(${r.id},${lot.id})">✕</button>
            </div>`;
        }).join('');

    return `
      <div style="padding:16px;background:var(--bg);border-top:1px solid var(--bd)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:8px">처리 이력</div>
        <div style="display:grid;grid-template-columns:90px ${isDram ? '55px 55px 55px ' : ' '}70px 70px 70px 60px 1fr 30px;gap:6px;padding:5px 0;border-bottom:2px solid var(--bd2);font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase">
          <span>날짜</span>${isDram ? '<span style="color:#166534">Normal</span><span style="color:#92400e">NoBoot</span><span style="color:#991b1b">Abnor.</span>' : ''}<span>처리</span><span>누적</span><span>잔량</span><span>완료</span><span>비고</span><span></span>
        </div>
        ${histRows}
        <div style="margin-top:16px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:14px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:10px">새 처리 기록 입력</div>
          <div style="display:grid;grid-template-columns:${isDram ? '110px 110px 110px auto' : '110px 130px auto'};gap:10px;margin-bottom:${isDram ? '10px' : '0'}">
            <div class="fld"><label>날짜</label><input type="date" id="dp-date-${lot.id}" value="${today()}"></div>
            <div class="fld"><label>처리량 합계</label><input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcRemaining(${lot.id})"></div>
            <div class="fld"><label>오늘 후 잔량</label><input type="number" id="dp-rem-${lot.id}" readonly style="color:var(--tx2)" value="${Math.max(0, parseNumber(lot.qty) - cum)}"></div>
            <div class="fld"><label>완료 여부</label>
              <select id="dp-done-${lot.id}"><option value="0">진행 중</option><option value="1">완료 처리</option></select>
            </div>
          </div>
          ${isDram ? `
            <div style="margin-bottom:10px">
              <div style="font-size:10px;font-weight:600;color:#1e40af;margin-bottom:6px">DRAM 분류 입력 <span style="font-weight:400;color:var(--tx3)">(합계 자동 계산)</span></div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                <div class="fld"><label style="color:#166534">Normal</label><input type="number" id="dp-normal-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="border-color:#bbf7d0;background:#f0fdf4"></div>
                <div class="fld"><label style="color:#92400e">No Boot</label><input type="number" id="dp-noboot-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="border-color:#fde68a;background:#fefce8"></div>
                <div class="fld"><label style="color:#991b1b">Abnormal</label><input type="number" id="dp-abnormal-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="border-color:#fca5a5;background:#fef2f2"></div>
              </div>
            </div>` : ''}
          <div class="fld" style="margin-bottom:10px"><label>비고</label><input type="text" id="dp-note-${lot.id}" placeholder="이슈, 특이사항 등"></div>
          <div class="br">
            <button class="btn pri sm" onclick="Pages.DailyInput.saveRecord(${lot.id})">저장</button>
            <span id="dp-ok-${lot.id}" style="font-size:12px;color:#166534;display:none;font-weight:500">✓ 저장됨</span>
          </div>
        </div>
      </div>`;
  }

  function toggleCard(lotId) {
    _openId = _openId === lotId ? null : lotId;
    render();
    if (_openId) {
      const el = document.getElementById('acc-' + lotId);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }

  function calcDram(lotId) {
    const nm = parseNumber(document.getElementById('dp-normal-' + lotId)?.value);
    const nb = parseNumber(document.getElementById('dp-noboot-' + lotId)?.value);
    const ab = parseNumber(document.getElementById('dp-abnormal-' + lotId)?.value);
    const proc = nm + nb + ab;
    const el = document.getElementById('dp-proc-' + lotId);
    if (el) { el.value = proc || ''; calcRemaining(lotId); }
  }

  function calcRemaining(lotId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    const cum  = getLotCumulative(lot.id, Store.getDailies());
    const proc = parseNumber(document.getElementById('dp-proc-' + lotId)?.value);
    const el   = document.getElementById('dp-rem-' + lotId);
    if (el) el.value = Math.max(0, parseNumber(lot.qty) - cum - proc);
  }

  async function saveRecord(lotId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    const dateEl = document.getElementById('dp-date-' + lotId);
    const procEl = document.getElementById('dp-proc-' + lotId);
    if (!dateEl || !procEl) { UI.toast('입력 필드를 찾을 수 없습니다', true); return; }
    const date = dateEl.value;
    const proc = parseNumber(procEl.value);
    if (!date || !proc) { UI.toast('날짜와 처리량은 필수입니다', true); return; }

    const isDram   = lot.biz === 'DRAM';
    const normal   = isDram ? parseNumber(document.getElementById('dp-normal-' + lotId)?.value) : 0;
    const noBoot   = isDram ? parseNumber(document.getElementById('dp-noboot-' + lotId)?.value) : 0;
    const abnormal = isDram ? parseNumber(document.getElementById('dp-abnormal-' + lotId)?.value) : 0;
    const cumNew   = getLotCumulative(lot.id, Store.getDailies()) + proc;
    const remNew   = Math.max(0, parseNumber(lot.qty) - cumNew);
    const isDone   = document.getElementById('dp-done-' + lotId).value === '1' || remNew === 0;

    const record = { id: Date.now(), date, lotId: lot.id, lotNo: lot.lotNo || lot.id, biz: lot.biz, country: lot.country, customerName: lot.customerName || '', proc, normal, noBoot, abnormal, cumul: cumNew, remain: remNew, note: document.getElementById('dp-note-' + lotId)?.value || '', done: isDone ? '1' : '0' };

    Store.upsertDaily(record);
    if (isDone) {
      const updated = { ...lot, done: '1', actualDone: date };
      Store.upsertLot(updated);
      Api.update(CONFIG.SHEETS.LOTS, lot.id, updated);
      UI.toast(lot.lotNo + ' 완료!');
    }
    const ok = document.getElementById('dp-ok-' + lotId);
    if (ok) { ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 1500); }
    UI.toast('저장됨');
    render();
    Api.append(CONFIG.SHEETS.DAILY, record);
  }

  async function deleteRecord(id, lotId) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteDaily(id);
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.DAILY, id);
  }

  // ── 엑셀 붙여넣기 팝업 ──────────────────────────────────────
  function openPasteModal() {
    document.getElementById('paste-modal').style.display = 'flex';
    document.getElementById('paste-area').value = '';
    document.getElementById('paste-preview-wrap').style.display = 'none';
    document.getElementById('paste-empty').style.display = 'block';
    document.getElementById('paste-save-btn').style.display = 'none';
    document.getElementById('paste-save-msg').style.display = 'none';
    _parsedRows = [];
    setTimeout(() => document.getElementById('paste-area').focus(), 100);
  }

  function closePasteModal() {
    document.getElementById('paste-modal').style.display = 'none';
  }

  function parsePaste() {
    const raw = document.getElementById('paste-area').value.trim();
    if (!raw) { _parsedRows = []; _showPastePreview(); return; }

    const lots  = Store.getLots();
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    _parsedRows  = [];

    const COUNTRY_MAP = { 'hk': 'HK', 'hong kong': 'HK', '홍콩': 'HK', 'sg': 'SG', 'singapore': 'SG', '싱가포르': 'SG' };

    for (const line of lines) {
      const cols    = line.split('\t').map(c => c.trim());
      if (cols.length < 4) continue;
      const dateVal = _parseDate(cols[3]);
      if (!dateVal) continue;

      const region  = cols[0] || '';
      const lotNo   = cols[1] || '';
      const proc    = parseNumber(cols[5]);
      const normal  = parseNumber(cols[6]);
      const noBoot  = parseNumber(cols[7]);
      const abnormal = parseNumber(cols[8]);
      const note    = cols[9] || '';
      const country = COUNTRY_MAP[region.toLowerCase()] || region.toUpperCase() || '';
      const lot     = lots.find(l => l.lotNo === lotNo || String(l.id) === lotNo || l.lotNo.toLowerCase() === lotNo.toLowerCase());
      const totalProc = (normal + noBoot + abnormal) > 0 ? (normal + noBoot + abnormal) : proc;

      _parsedRows.push({ date: dateVal, region, country, lotNo, lot, proc: totalProc, normal, noBoot, abnormal, note, matched: !!lot });
    }
    _showPastePreview();
  }

  function _parseDate(v) {
    if (!v) return '';
    if (typeof v === 'number') { const d = new Date((v - 25569) * 86400000); return d.toISOString().split('T')[0]; }
    const s = String(v).replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s); return isNaN(d) ? '' : d.toISOString().split('T')[0];
  }

  function _showPastePreview() {
    const wrap    = document.getElementById('paste-preview-wrap');
    const empty   = document.getElementById('paste-empty');
    const saveBtn = document.getElementById('paste-save-btn');
    const topBtn  = document.getElementById('paste-save-btn-top');

    if (!_parsedRows.length) {
      wrap.style.display = 'none'; empty.style.display = 'block';
      saveBtn.style.display = 'none'; return;
    }

    wrap.style.display  = 'block'; empty.style.display = 'none';
    document.getElementById('paste-cnt').textContent = _parsedRows.length + '행';
    saveBtn.style.display = 'inline-block'; saveBtn.textContent = _parsedRows.length + '건 저장';
    if (topBtn) { topBtn.style.display = 'inline-block'; topBtn.textContent = _parsedRows.length + '건 저장'; }

    const lots = Store.getLots().filter(l => (_co ? l.country === _co : true) && (_biz ? l.biz === _biz : true));

    document.getElementById('paste-preview-body').innerHTML = _parsedRows.map((r, i) => {
      const isDram    = r.lot && r.lot.biz === 'DRAM';
      const matched   = r.matched;
      const statusHtml = matched
        ? `<span style="font-size:11px;font-weight:500;color:#166534;white-space:nowrap">✓ ${CONFIG.BIZ_LABELS[r.lot.biz] || ''}</span>`
        : `<span style="font-size:11px;color:#92400e;white-space:nowrap">LOT 불명확</span>`;
      const selBorder = matched ? 'var(--bd2)' : '#fca5a5';
      const selBg     = matched ? 'var(--bg)'  : '#fff7f7';
      const options   = lots.map(l => `<option value="${l.id}"${r.lot && String(r.lot.id) === String(l.id) ? ' selected' : ''}>${l.lotNo || l.id}</option>`).join('');

      return `
        <tr style="${i % 2 === 0 ? '' : 'background:var(--bg)'}">
          <td style="padding:7px 10px;white-space:nowrap;font-family:var(--font-mono);font-size:12px">${r.date}</td>
          <td style="padding:7px 10px">${r.country ? renderCountryTag(r.country) : `<span style="font-size:11px;color:var(--tx3)">${r.region || '-'}</span>`}</td>
          <td style="padding:4px 6px">
            <div style="display:flex;gap:4px;align-items:center">
              <select onchange="Pages.DailyInput.setParsedLot(${i},this.value,false)" style="padding:4px 8px;border:1px solid ${selBorder};border-radius:5px;font-size:12px;background:${selBg};color:var(--tx);flex:1;min-width:110px">
                <option value="">-- 선택 --</option>${options}
              </select>
              <button onclick="Pages.DailyInput.setParsedLot(${i},this.previousElementSibling.value,true)" style="padding:3px 7px;border:1px solid var(--bd2);border-radius:5px;font-size:10px;font-weight:600;background:#EEF4FF;color:#1e40af;cursor:pointer;white-space:nowrap;flex-shrink:0" title="이 LOT를 전체 행에 적용">전체↓</button>
            </div>
          </td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${formatNumber(r.proc)}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);color:#166534">${isDram || r.normal > 0 ? formatNumber(r.normal) : '—'}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);color:#92400e">${isDram || r.noBoot > 0 ? formatNumber(r.noBoot) : '—'}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);color:#991b1b">${isDram || r.abnormal > 0 ? formatNumber(r.abnormal) : '—'}</td>
          <td style="padding:7px 10px;font-size:12px;color:var(--tx2);max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.note}</td>
          <td style="padding:7px 10px">${statusHtml}</td>
        </tr>`;
    }).join('');
  }

  function setParsedLot(i, lotId, applyAll) {
    const lot = Store.getLots().find(l => String(l.id) === lotId) || null;
    if (applyAll) {
      _parsedRows.forEach(r => { r.lot = lot; r.matched = !!lot; r.lotNo = lot ? lot.lotNo || lotId : r.lotNo; });
    } else {
      _parsedRows[i].lot = lot; _parsedRows[i].matched = !!lot; _parsedRows[i].lotNo = lot ? lot.lotNo || lotId : _parsedRows[i].lotNo;
    }
    _showPastePreview();
  }

  async function savePaste() {
    const toSave  = _parsedRows.filter(r => r.lot);
    const skipped = _parsedRows.length - toSave.length;
    if (!toSave.length) { UI.toast('저장할 데이터가 없습니다 (LOT가 선택되지 않음)', true); return; }

    const btn    = document.getElementById('paste-save-btn');
    const topBtn = document.getElementById('paste-save-btn-top');
    btn.disabled = true; btn.textContent = '저장 중...';
    if (topBtn)  { topBtn.disabled = true; topBtn.textContent = '저장 중...'; }

    let saved = 0;
    for (const r of toSave) {
      const lot    = r.lot;
      const dailies = Store.getDailies();
      const cumNew  = getLotCumulative(lot.id, dailies) + r.proc;
      const remNew  = Math.max(0, parseNumber(lot.qty) - cumNew);
      const isDone  = remNew === 0;
      const record  = { id: Date.now() + Math.random(), date: r.date, lotId: lot.id, lotNo: lot.lotNo || lot.id, biz: lot.biz, country: lot.country, customerName: lot.customerName || '', proc: r.proc, normal: r.normal, noBoot: r.noBoot, abnormal: r.abnormal, cumul: cumNew, remain: remNew, note: r.note, done: isDone ? '1' : '0' };
      const res = await Api.append(CONFIG.SHEETS.DAILY, record);
      if (!res.error) {
        Store.upsertDaily(record);
        if (isDone) {
          const upd = { ...lot, done: '1', actualDone: r.date };
          await Api.update(CONFIG.SHEETS.LOTS, lot.id, upd);
          Store.upsertLot(upd);
        }
        saved++;
      }
    }

    btn.disabled = false;
    const msg = document.getElementById('paste-save-msg');
    msg.style.display = 'inline';
    msg.textContent   = '✓ ' + saved + '건 저장 완료' + (skipped > 0 ? ' (LOT 미선택 ' + skipped + '건 제외)' : '');
    btn.style.display = 'none';
    render();
    UI.toast(saved + '건 저장 완료');
    setTimeout(() => closePasteModal(), 1500);
  }

  return { render, setFilter, toggleCard, calcDram, calcRemaining, saveRecord, deleteRecord, openPasteModal, closePasteModal, parsePaste, setParsedLot, savePaste };

})();
