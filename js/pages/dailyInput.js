/**
 * pages/dailyInput.js
 * 처리량 입력 — LOT 아코디언 카드 + MO 관리 + 엑셀 붙여넣기
 *
 * UI 규칙: 모노톤 / 색 최소화 — feedback_ui_style 메모리 참조
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
      wrap.innerHTML = '<div class="empty" style="padding:48px;color:var(--tx3)">위에서 국가와 사업을 선택하면 LOT 목록이 표시됩니다</div>';
      info.textContent = ''; return;
    }

    const dailies = Store.getDailies();
    const lots    = Store.getLots()
      .filter(l => l.country === _co && l.biz === _biz)
      .sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    info.textContent = (CONFIG.COUNTRY_LABELS[_co] || _co) + ' · ' + (CONFIG.BIZ_LABELS[_biz] || _biz) + ' · ' + lots.length + '건';

    if (!lots.length) {
      wrap.innerHTML = '<div class="empty" style="padding:40px;color:var(--tx3)">등록된 LOT가 없습니다</div>';
      return;
    }

    wrap.innerHTML = lots.map(lot => {
      const st     = getLotStatus(lot);
      const cum    = getLotCumulative(lot.id, dailies);
      const rem    = getLotRemaining(lot, dailies);
      const pct    = getLotProgress(lot, dailies);
      const dd     = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const ddText = dd === null ? '—' : dd < 0 ? 'D+' + Math.abs(dd) : dd === 0 ? 'D-Day' : 'D-' + dd;
      const ddWeight = dd !== null && dd <= 3 ? 600 : 400;
      const isOpen   = _openId === lot.id;
      const stLabel  = st === 'done' ? '완료' : st === 'overdue' ? '지연' : '진행';

      return `
        <div id="acc-${lot.id}" style="border:1px solid var(--bd);border-radius:var(--rs);margin-bottom:8px;overflow:hidden;background:var(--card)">
          <div onclick="Pages.DailyInput.toggleCard(${lot.id})"
               style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:${isOpen ? 'var(--bg)' : 'var(--card)'};transition:background .15s">
            <div style="display:flex;align-items:center;gap:18px;flex:1;min-width:0">
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--tx);flex-shrink:0">${lot.lotNo || lot.id}</span>
              <div style="display:flex;gap:18px;font-size:12px;color:var(--tx2)">
                <span>입고 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:500">${formatNumber(parseNumber(lot.qty))}</span></span>
                <span>처리 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:500">${formatNumber(cum)}</span></span>
                <span>잔량 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:${rem > 0 ? 500 : 400}">${formatNumber(rem)}</span></span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <div style="width:70px;height:4px;background:var(--bd);border-radius:2px;overflow:hidden">
                  <div style="height:100%;background:var(--tx2);width:${pct}%"></div>
                </div>
                <span style="font-size:12px;font-family:var(--font-mono);color:var(--tx2);min-width:32px">${pct}%</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-shrink:0;margin-left:12px">
              <span style="font-size:12px;font-family:var(--font-mono);color:var(--tx2);font-weight:${ddWeight}">${ddText}</span>
              <span style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;min-width:36px;text-align:right">${stLabel}</span>
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16" style="transition:transform .15s;transform:${isOpen ? 'rotate(180deg)' : 'rotate(0)'};color:var(--tx3)"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
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
    const mos    = Store.getMosByLot(lot.id);

    // ── MO 목록 ────────────────────────────────────────────
    const moHeader = mos.length ? `
      <div style="display:grid;grid-template-columns:1fr 80px 80px 80px 60px 30px;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">
        <span>MO 번호</span><span style="text-align:right">수량</span><span style="text-align:right">누적</span><span style="text-align:right">잔량</span><span style="text-align:center">진행</span><span></span>
      </div>` : '';

    const moRows = mos.length === 0
      ? '<div style="font-size:12px;color:var(--tx3);padding:10px 0;text-align:center">등록된 MO 없음 — DO 직접 입력만 가능</div>'
      : mos.map(m => {
          const mq = parseNumber(m.qty);
          const mc = getMoCumulative(m.id, dailies);
          const mr = Math.max(0, mq - mc);
          const mp = mq > 0 ? Math.min(100, Math.round(mc / mq * 100)) : 0;
          return `
            <div style="display:grid;grid-template-columns:1fr 80px 80px 80px 60px 30px;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px;align-items:center">
              <span style="font-family:var(--font-mono);color:var(--tx)">${m.moNo}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${mq > 0 ? formatNumber(mq) : '—'}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx)">${formatNumber(mc)}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${mq > 0 ? formatNumber(mr) : '—'}</span>
              <span style="text-align:center;font-size:11px;font-family:var(--font-mono);color:var(--tx2)">${mq > 0 ? mp + '%' : '—'}</span>
              <button onclick="Pages.DailyInput.deleteMo(${m.id},${lot.id})" style="border:none;background:none;cursor:pointer;color:var(--tx3);font-size:13px;padding:2px 4px" title="MO 삭제">✕</button>
            </div>`;
        }).join('');

    const moOptions = mos.map(m => {
      const mc = getMoCumulative(m.id, dailies);
      const mq = parseNumber(m.qty);
      const mr = mq > 0 ? Math.max(0, mq - mc) : null;
      return `<option value="${m.id}">${m.moNo}${mr !== null ? ` (잔 ${formatNumber(mr)})` : ''}</option>`;
    }).join('');

    // ── 처리 이력 ──────────────────────────────────────────
    const colGrid = isDram ? '90px 56px 56px 56px 70px 70px 70px 40px 1fr 30px' : '90px 70px 70px 70px 40px 1fr 30px';
    const histRows = hist.length === 0
      ? '<div style="font-size:12px;color:var(--tx3);padding:12px 0;text-align:center">처리 기록 없음</div>'
      : hist.map(r => {
          const tot = isDram ? (parseNumber(r.normal) + parseNumber(r.noBoot) + parseNumber(r.abnormal)) || parseNumber(r.proc) : parseNumber(r.proc);
          const moTag = r.moNo ? `<span style="display:inline-block;font-size:10px;padding:1px 5px;background:var(--bg);color:var(--tx2);border:1px solid var(--bd);border-radius:2px;font-family:var(--font-mono);margin-left:6px">${r.moNo}</span>` : '';
          return `
            <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px;align-items:center">
              <span style="font-family:var(--font-mono);color:var(--tx2)">${r.date}${moTag}</span>
              ${isDram ? `<span style="font-family:var(--font-mono);text-align:right;color:var(--tx)">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.abnormal))}</span>` : ''}
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx);font-weight:500">${formatNumber(tot)}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.cumul))}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.remain))}</span>
              <span style="text-align:center;font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${r.done === '1' ? '완료' : ''}</span>
              <span style="color:var(--tx3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note || ''}</span>
              <button onclick="Pages.DailyInput.deleteRecord(${r.id},${lot.id})" style="border:none;background:none;cursor:pointer;color:var(--tx3);font-size:13px;padding:2px 4px">✕</button>
            </div>`;
        }).join('');

    const histHeader = `
      <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">
        <span>날짜</span>${isDram ? '<span style="text-align:right">Normal</span><span style="text-align:right">NoBoot</span><span style="text-align:right">Abnor.</span>' : ''}<span style="text-align:right">처리</span><span style="text-align:right">누적</span><span style="text-align:right">잔량</span><span style="text-align:center">완료</span><span>비고</span><span></span>
      </div>`;

    return `
      <div style="padding:18px 20px;background:var(--bg);border-top:1px solid var(--bd)">
        <!-- MO 관리 -->
        <div style="margin-bottom:18px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">MO 목록</div>
            <span style="font-size:11px;color:var(--tx3)">${mos.length}개</span>
          </div>
          ${moHeader}
          ${moRows}
          <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end;padding-top:12px;border-top:1px solid var(--bd)">
            <div class="fld" style="flex:1;margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">MO 번호</label><input type="text" id="mo-no-${lot.id}" placeholder="예: MO-001" style="font-size:13px;padding:6px 8px;width:100%"></div>
            <div class="fld" style="width:110px;margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">수량 (선택)</label><input type="number" id="mo-qty-${lot.id}" placeholder="0" min="0" style="font-size:13px;padding:6px 8px;width:100%;text-align:right"></div>
            <button onclick="Pages.DailyInput.addMo(${lot.id})" style="padding:6px 14px;font-size:12px;font-weight:500;border:1px solid var(--tx);background:var(--tx);color:var(--card);border-radius:var(--rs);cursor:pointer;height:30px;white-space:nowrap">MO 추가</button>
          </div>
        </div>

        <!-- 처리 이력 -->
        <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">처리 이력 (${hist.length}건)</div>
        ${histHeader}
        ${histRows}

        <!-- 새 처리 기록 입력 -->
        <div style="margin-top:18px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:14px 16px">
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">새 처리 기록 입력</div>
          ${mos.length ? `
          <div class="fld" style="margin-bottom:10px"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">입력 대상 <span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--tx3)">— MO 선택 시 해당 MO에 귀속</span></label>
            <select id="dp-mo-${lot.id}" style="font-size:13px;padding:6px 8px;width:100%">
              <option value="">DO 직접 입력 (${lot.lotNo})</option>
              ${moOptions}
            </select>
          </div>` : ''}
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
            <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">날짜</label><input type="date" id="dp-date-${lot.id}" value="${today()}" style="font-size:13px;padding:6px 8px;width:130px"></div>
            <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">처리량 합계</label><input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcRemaining(${lot.id})" style="font-size:13px;padding:6px 8px;width:100px;text-align:right"></div>
            <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">잔량 (자동)</label><input type="number" id="dp-rem-${lot.id}" readonly value="${Math.max(0, parseNumber(lot.qty) - cum)}" style="font-size:13px;padding:6px 8px;width:100px;text-align:right;color:var(--tx2);background:var(--bg)"></div>
            <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">완료 여부</label>
              <select id="dp-done-${lot.id}" style="font-size:13px;padding:6px 8px;width:110px"><option value="0">진행 중</option><option value="1">완료 처리</option></select>
            </div>
          </div>
          ${isDram ? `
          <div style="margin-bottom:12px;padding-top:10px;border-top:1px solid var(--bd)">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">DRAM 분류 <span style="font-weight:400;text-transform:none;letter-spacing:0">— 합계 자동 계산</span></div>
            <div style="display:flex;gap:10px;align-items:flex-end">
              <div class="fld" style="margin:0"><label style="font-size:11px;color:var(--tx2)">Normal</label><input type="number" id="dp-normal-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="font-size:13px;padding:6px 8px;width:90px;text-align:right"></div>
              <div class="fld" style="margin:0"><label style="font-size:11px;color:var(--tx2)">No Boot</label><input type="number" id="dp-noboot-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="font-size:13px;padding:6px 8px;width:90px;text-align:right"></div>
              <div class="fld" style="margin:0"><label style="font-size:11px;color:var(--tx2)">Abnormal</label><input type="number" id="dp-abnormal-${lot.id}" placeholder="0" min="0" oninput="Pages.DailyInput.calcDram(${lot.id})" style="font-size:13px;padding:6px 8px;width:90px;text-align:right"></div>
            </div>
          </div>` : ''}
          <div style="display:flex;gap:10px;align-items:flex-end">
            <div class="fld" style="margin:0;flex:1"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">비고</label><input type="text" id="dp-note-${lot.id}" placeholder="이슈, 특이사항 등" style="font-size:13px;padding:6px 8px;width:100%"></div>
            <button onclick="Pages.DailyInput.saveRecord(${lot.id})" style="padding:6px 18px;font-size:12px;font-weight:500;border:1px solid var(--tx);background:var(--tx);color:var(--card);border-radius:var(--rs);cursor:pointer;height:30px">저장</button>
            <span id="dp-ok-${lot.id}" style="font-size:11px;color:var(--tx2);display:none;align-self:center">저장됨</span>
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

    const moSelEl = document.getElementById('dp-mo-' + lotId);
    const moId    = moSelEl?.value || '';
    const mo      = moId ? Store.getMoById(moId) : null;
    const moNo    = mo ? mo.moNo : '';

    const record = { id: Date.now(), date, lotId: lot.id, lotNo: lot.lotNo || lot.id, moId, moNo, biz: lot.biz, country: lot.country, customerName: lot.customerName || '', proc, normal, noBoot, abnormal, cumul: cumNew, remain: remNew, note: document.getElementById('dp-note-' + lotId)?.value || '', done: isDone ? '1' : '0' };

    const result = await Api.appendNow(CONFIG.SHEETS.DAILY, record);
    if (!result.success) return;

    Store.upsertDaily(record);
    if (isDone) {
      const updated = { ...lot, done: '1', actualDone: date };
      Store.upsertLot(updated);
      Api.update(CONFIG.SHEETS.LOTS, lot.id, updated);
      UI.toast(lot.lotNo + ' 완료');
    }
    const ok = document.getElementById('dp-ok-' + lotId);
    if (ok) { ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 1500); }
    UI.toast('저장됨');
    render();
    Api.log('일별처리', '등록', lot.lotNo || String(lot.id), `${date}${moNo ? ` [MO ${moNo}]` : ''} 처리 ${formatNumber(proc)}개${isDram ? ` (N:${formatNumber(normal)} / NB:${formatNumber(noBoot)} / AB:${formatNumber(abnormal)})` : ''} | 누적 ${formatNumber(cumNew)} / 잔량 ${formatNumber(remNew)}`);
  }

  // ── MO 추가 / 삭제 ──────────────────────────────────────────
  async function addMo(lotId) {
    const lot   = Store.getLotById(lotId); if (!lot) return;
    const noEl  = document.getElementById('mo-no-' + lotId);
    const qtyEl = document.getElementById('mo-qty-' + lotId);
    const moNo  = (noEl?.value || '').trim();
    const qty   = parseNumber(qtyEl?.value);
    if (!moNo) { UI.toast('MO 번호는 필수입니다', true); noEl?.focus(); return; }

    const dup = Store.getMosByLot(lot.id).some(m => m.moNo.toLowerCase() === moNo.toLowerCase());
    if (dup) { UI.toast('이미 등록된 MO 번호입니다', true); return; }

    const record = { id: Date.now(), lotId: lot.id, lotNo: lot.lotNo || String(lot.id), moNo, qty, note: '' };
    Store.upsertMo(record);
    if (noEl)  noEl.value  = '';
    if (qtyEl) qtyEl.value = '';
    render();
    UI.toast('MO 추가됨');
    Api.append(CONFIG.SHEETS.MOS, record);
    Api.log('MO', '등록', lot.lotNo || String(lot.id), `MO ${moNo}${qty ? ` (수량 ${formatNumber(qty)})` : ''} 추가`);
  }

  async function deleteMo(moId, lotId) {
    const mo = Store.getMoById(moId); if (!mo) return;
    const linked = Store.getDailies().filter(d => String(d.moId) === String(moId));
    const msg = linked.length
      ? `MO ${mo.moNo} 삭제 시 연결된 처리 기록 ${linked.length}건은 DO 직접 입력으로 전환됩니다. 계속하시겠습니까?`
      : `MO ${mo.moNo} 를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;

    for (const d of linked) {
      const upd = { ...d, moId: '', moNo: '' };
      Store.upsertDaily(upd);
      Api.update(CONFIG.SHEETS.DAILY, d.id, upd);
    }
    Store.deleteMo(moId);
    Api.delete(CONFIG.SHEETS.MOS, moId);
    const lot = Store.getLotById(lotId);
    Api.log('MO', '삭제', lot?.lotNo || String(lotId), `MO ${mo.moNo} 삭제${linked.length ? ` (연결 처리 ${linked.length}건은 DO 직접 입력으로 전환)` : ''}`);
    render();
    UI.toast('MO 삭제됨');
  }

  async function deleteRecord(id, lotId) {
    if (!confirm('삭제하시겠습니까?')) return;
    const lot = Store.getLotById(lotId);
    const rec = Store.getDailies().find(d => String(d.id) === String(id));
    Store.deleteDaily(id);
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.DAILY, id);
    Api.log('일별처리', '삭제', lot?.lotNo || String(lotId), `${rec?.date || ''} 처리 ${formatNumber(parseNumber(rec?.proc))}개${rec?.biz==='DRAM' ? ` (N:${formatNumber(parseNumber(rec?.normal))} / NB:${formatNumber(parseNumber(rec?.noBoot))} / AB:${formatNumber(parseNumber(rec?.abnormal))})` : ''} 삭제`);
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
        ? `<span style="font-size:11px;color:var(--tx2);white-space:nowrap">매칭 ${CONFIG.BIZ_LABELS[r.lot.biz] || ''}</span>`
        : `<span style="font-size:11px;color:var(--tx3);font-style:italic;white-space:nowrap">LOT 불명확</span>`;
      const options   = lots.map(l => `<option value="${l.id}"${r.lot && String(r.lot.id) === String(l.id) ? ' selected' : ''}>${l.lotNo || l.id}</option>`).join('');

      return `
        <tr style="${i % 2 === 0 ? '' : 'background:var(--bg)'};border-bottom:1px solid var(--bd)">
          <td style="padding:8px 10px;white-space:nowrap;font-family:var(--font-mono);font-size:12px;color:var(--tx2)">${r.date}</td>
          <td style="padding:8px 10px;font-size:12px;color:var(--tx2)">${r.country || r.region || '—'}</td>
          <td style="padding:4px 6px">
            <div style="display:flex;gap:4px;align-items:center">
              <select onchange="Pages.DailyInput.setParsedLot(${i},this.value,false)" style="padding:4px 8px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:12px;background:var(--card);color:var(--tx);flex:1;min-width:110px">
                <option value="">-- 선택 --</option>${options}
              </select>
              <button onclick="Pages.DailyInput.setParsedLot(${i},this.previousElementSibling.value,true)" style="padding:3px 8px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:11px;background:var(--card);color:var(--tx2);cursor:pointer;white-space:nowrap" title="이 LOT를 전체 행에 적용">전체↓</button>
            </div>
          </td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tx);font-weight:500">${formatNumber(r.proc)}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tx2)">${isDram || r.normal > 0 ? formatNumber(r.normal) : '—'}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tx2)">${isDram || r.noBoot > 0 ? formatNumber(r.noBoot) : '—'}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tx2)">${isDram || r.abnormal > 0 ? formatNumber(r.abnormal) : '—'}</td>
          <td style="padding:8px 10px;font-size:11px;color:var(--tx3);max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.note}</td>
          <td style="padding:8px 10px">${statusHtml}</td>
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
    msg.textContent   = saved + '건 저장 완료' + (skipped > 0 ? ' (LOT 미선택 ' + skipped + '건 제외)' : '');
    btn.style.display = 'none';
    render();
    UI.toast(saved + '건 저장 완료');
    setTimeout(() => closePasteModal(), 1500);
  }

  return { render, setFilter, toggleCard, calcDram, calcRemaining, saveRecord, deleteRecord, addMo, deleteMo, openPasteModal, closePasteModal, parsePaste, setParsedLot, savePaste };

})();
