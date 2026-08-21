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
  let _editDailyId = null;   // 처리 이력 인라인 수정 대상 id
  let _selDaily = new Set(); // 처리 이력 다중 선택 대상 id (문자열)
  let _parsedRows = [];

  // ── 필터 ────────────────────────────────────────────────────
  // 기본값은 전체(_co/_biz 빈 값). 'ALL' 버튼을 누르면 다시 전체로 돌아갑니다.
  function setFilter(el, type) {
    const key = type === 'co' ? 'co' : 'biz';
    const raw = el.dataset[key];
    const val = raw === 'ALL' ? '' : raw;

    document.querySelectorAll(`#pg-daily [data-${key}]`).forEach(e => e.classList.remove('on'));
    el.classList.add('on');

    if (key === 'co') _co = val;
    else              _biz = val;

    _openId = null;
    _selDaily.clear();
    render();
  }

  // ── LOT 아코디언 목록 ────────────────────────────────────────
  function render() {
    const wrap = document.getElementById('dp-lot-cards');
    const info = document.getElementById('dp-filter-info');

    const dailies = Store.getDailies();
    const lots    = Store.getLots()
      .filter(l => (!_co || l.country === _co) && (!_biz || l.biz === _biz))
      .sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    const scope = [
      _co  ? (CONFIG.COUNTRY_LABELS[_co] || _co)  : '전체 국가',
      _biz ? (CONFIG.BIZ_LABELS[_biz]    || _biz) : '전체 사업',
    ].join(' · ');
    info.textContent = scope + ' · ' + lots.length + '건';

    if (!lots.length) {
      wrap.innerHTML = '<div class="empty" style="padding:40px;color:var(--tx3)">해당 조건의 LOT가 없습니다</div>';
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
      // 전체 보기일 때 어느 국가·사업 LOT인지 구분되도록 표시 (필터가 걸린 항목은 생략)
      const tag = [
        _co  ? '' : (CONFIG.COUNTRY_LABELS[lot.country] || lot.country || ''),
        _biz ? '' : (CONFIG.BIZ_LABELS[lot.biz]         || lot.biz     || ''),
      ].filter(Boolean).join(' · ');

      return `
        <div id="acc-${lot.id}" style="border:1px solid var(--bd);border-radius:var(--rs);margin-bottom:8px;overflow:hidden;background:var(--card)">
          <div onclick="Pages.DailyInput.toggleCard(${lot.id})"
               style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:${isOpen ? 'var(--bg)' : 'var(--card)'};transition:background .15s">
            <div style="display:flex;align-items:center;gap:18px;flex:1;min-width:0">
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--tx);flex-shrink:0">${lot.lotNo || lot.id}</span>
              ${tag ? `<span style="font-size:11px;color:var(--tx3);flex-shrink:0;white-space:nowrap">${tag}</span>` : ''}
              <div style="display:flex;gap:18px;font-size:12px;color:var(--tx2)">
                <span>입고 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:500">${formatQty(lot.qty, lot.biz)}</span></span>
                <span>처리 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:500">${formatQty(cum, lot.biz)}</span></span>
                <span>잔량 <span style="color:var(--tx);font-family:var(--font-mono);font-weight:${rem > 0 ? 500 : 400}">${formatQty(rem, lot.biz)}</span></span>
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

    if (_openId) _syncSelUI(_openId);   // 선택 상태(전체선택 체크박스 포함) 재동기화
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
    const colGrid  = isDram ? '24px 90px 56px 56px 56px 70px 70px 70px 40px 1fr 58px' : '24px 90px 70px 70px 70px 40px 1fr 58px';
    const selCount = hist.filter(r => _selDaily.has(String(r.id))).length;
    const cbStyle  = 'width:13px;height:13px;margin:0;cursor:pointer;accent-color:var(--tx)';
    const histRows = hist.length === 0
      ? '<div style="font-size:12px;color:var(--tx3);padding:12px 0;text-align:center">처리 기록 없음</div>'
      : hist.map(r => {
          if (String(r.id) === String(_editDailyId)) return _renderDailyEditRow(r, lot, isDram);
          const tot = isDram ? (parseNumber(r.normal) + parseNumber(r.noBoot) + parseNumber(r.abnormal)) || parseNumber(r.proc) : parseNumber(r.proc);
          const moTag = r.moNo ? `<span style="display:inline-block;font-size:10px;padding:1px 5px;background:var(--bg);color:var(--tx2);border:1px solid var(--bd);border-radius:2px;font-family:var(--font-mono);margin-left:6px">${r.moNo}</span>` : '';
          return `
            <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px;align-items:center">
              <input type="checkbox" data-dsel="${lot.id}" value="${r.id}" ${_selDaily.has(String(r.id)) ? 'checked' : ''} onchange="Pages.DailyInput.toggleSelectDaily('${r.id}',${lot.id},this)" title="선택" style="${cbStyle}">
              <span style="font-family:var(--font-mono);color:var(--tx2)">${r.date}${moTag}</span>
              ${isDram ? `<span style="font-family:var(--font-mono);text-align:right;color:var(--tx)">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.abnormal))}</span>` : ''}
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx);font-weight:500">${formatNumber(tot)}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.cumul))}</span>
              <span style="font-family:var(--font-mono);text-align:right;color:var(--tx2)">${formatNumber(parseNumber(r.remain))}</span>
              <span style="text-align:center;font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${r.done === '1' ? '완료' : ''}</span>
              <span style="color:var(--tx3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note || ''}</span>
              <span style="display:flex;gap:2px;justify-content:flex-end">
                <button onclick="Pages.DailyInput.startEditDaily(${r.id})" title="수정" style="border:none;background:none;cursor:pointer;color:var(--tx3);font-size:13px;padding:2px 4px">✎</button>
                <button onclick="Pages.DailyInput.deleteRecord(${r.id},${lot.id})" title="삭제" style="border:none;background:none;cursor:pointer;color:var(--tx3);font-size:13px;padding:2px 4px">✕</button>
              </span>
            </div>`;
        }).join('');

    const histHeader = `
      <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">
        <input type="checkbox" id="dp-selall-${lot.id}" ${hist.length ? '' : 'disabled'} ${hist.length && selCount === hist.length ? 'checked' : ''} onchange="Pages.DailyInput.toggleSelectAllDaily(${lot.id},this)" title="전체 선택" style="${cbStyle}">
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
        <div style="display:flex;justify-content:space-between;align-items:center;min-height:24px;margin-bottom:6px">
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">처리 이력 (${hist.length}건)</div>
          <div id="dp-selbar-${lot.id}" style="display:${selCount ? 'flex' : 'none'};gap:6px;align-items:center">
            <span id="dp-selcnt-${lot.id}" style="font-size:11px;font-family:var(--font-mono);color:var(--tx2)">${selCount}건 선택</span>
            <button onclick="Pages.DailyInput.deleteSelected(${lot.id})" style="padding:4px 10px;font-size:11px;font-weight:500;border:1px solid var(--tx);background:var(--card);color:var(--tx);border-radius:var(--rs);cursor:pointer">선택 삭제</button>
            <button onclick="Pages.DailyInput.clearSelection(${lot.id})" style="padding:4px 10px;font-size:11px;font-weight:500;border:1px solid var(--bd2);background:var(--card);color:var(--tx2);border-radius:var(--rs);cursor:pointer">해제</button>
          </div>
        </div>
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
            <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">처리량 합계</label><input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0" step="any" oninput="Pages.DailyInput.calcRemaining(${lot.id})" style="font-size:13px;padding:6px 8px;width:100px;text-align:right"></div>
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

  // ── 처리 이력 인라인 수정 ────────────────────────────────────
  function _renderDailyEditRow(r, lot, isDram) {
    const inp = 'padding:5px 8px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;font-family:var(--font-mono);background:var(--card);color:var(--tx)';
    const noteVal = String(r.note || '').replace(/"/g, '&quot;');
    return `
      <div style="padding:10px 12px;border-bottom:1px solid var(--bd);background:var(--card);border-left:2px solid var(--tx)">
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">날짜</label>
            <input type="date" id="dpe-date-${r.id}" value="${r.date || ''}" style="${inp};width:140px"></div>
          ${isDram ? `
          <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Normal</label>
            <input type="number" id="dpe-normal-${r.id}" value="${parseNumber(r.normal) || ''}" min="0" oninput="Pages.DailyInput.calcEditDailyDram(${r.id})" style="${inp};width:74px;text-align:right"></div>
          <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">No Boot</label>
            <input type="number" id="dpe-noboot-${r.id}" value="${parseNumber(r.noBoot) || ''}" min="0" oninput="Pages.DailyInput.calcEditDailyDram(${r.id})" style="${inp};width:74px;text-align:right"></div>
          <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Abnormal</label>
            <input type="number" id="dpe-abnormal-${r.id}" value="${parseNumber(r.abnormal) || ''}" min="0" oninput="Pages.DailyInput.calcEditDailyDram(${r.id})" style="${inp};width:74px;text-align:right"></div>` : ''}
          <div class="fld" style="margin:0"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">처리량${isDram ? ' (자동)' : ''}</label>
            <input type="number" id="dpe-proc-${r.id}" value="${parseNumber(r.proc) || ''}" min="0" step="any" ${isDram ? 'readonly' : ''} style="${inp};width:84px;text-align:right${isDram ? ';background:var(--bg);color:var(--tx2)' : ''}"></div>
          <div class="fld" style="margin:0;flex:1;min-width:150px"><label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">비고</label>
            <input type="text" id="dpe-note-${r.id}" value="${noteVal}" style="${inp};width:100%;font-family:Pretendard,sans-serif"></div>
          <button onclick="Pages.DailyInput.saveDailyEdit(${lot.id},${r.id})" style="padding:6px 14px;font-size:12px;font-weight:500;border:1px solid var(--tx);background:var(--tx);color:var(--card);border-radius:var(--rs);cursor:pointer;height:30px;white-space:nowrap">저장</button>
          <button onclick="Pages.DailyInput.cancelEditDaily()" style="padding:6px 14px;font-size:12px;font-weight:500;border:1px solid var(--bd2);background:var(--card);color:var(--tx2);border-radius:var(--rs);cursor:pointer;height:30px;white-space:nowrap">취소</button>
        </div>
      </div>`;
  }

  function startEditDaily(id)  { _editDailyId = id;   render(); }
  function cancelEditDaily()   { _editDailyId = null; render(); }

  function calcEditDailyDram(id) {
    const nm = parseNumber(document.getElementById('dpe-normal-' + id)?.value);
    const nb = parseNumber(document.getElementById('dpe-noboot-' + id)?.value);
    const ab = parseNumber(document.getElementById('dpe-abnormal-' + id)?.value);
    const el = document.getElementById('dpe-proc-' + id);
    if (el) el.value = (nm + nb + ab) || '';
  }

  // 한 LOT의 모든 일별 기록을 날짜순으로 누적/잔량 재계산 후 변경분만 저장
  function _resequenceLot(lot) {
    const rows = Store.getDailies()
      .filter(d => String(d.lotId) === String(lot.id))
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)));
    let run = 0;
    rows.forEach(d => {
      run += parseNumber(d.proc);
      const remain = Math.max(0, parseNumber(lot.qty) - run);
      if (parseNumber(d.cumul) !== run || parseNumber(d.remain) !== remain) {
        const upd = { ...d, cumul: run, remain };
        Store.upsertDaily(upd);
        Api.update(CONFIG.SHEETS.DAILY, d.id, upd);
      }
    });
    return run;
  }

  async function saveDailyEdit(lotId, dailyId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    const rec = Store.getDailies().find(d => String(d.id) === String(dailyId)); if (!rec) return;

    const date     = document.getElementById('dpe-date-' + dailyId)?.value;
    const isDram   = lot.biz === 'DRAM';
    const normal   = isDram ? parseNumber(document.getElementById('dpe-normal-' + dailyId)?.value)   : parseNumber(rec.normal);
    const noBoot   = isDram ? parseNumber(document.getElementById('dpe-noboot-' + dailyId)?.value)   : parseNumber(rec.noBoot);
    const abnormal = isDram ? parseNumber(document.getElementById('dpe-abnormal-' + dailyId)?.value) : parseNumber(rec.abnormal);
    const proc     = isDram ? (normal + noBoot + abnormal) : parseNumber(document.getElementById('dpe-proc-' + dailyId)?.value);
    const note     = document.getElementById('dpe-note-' + dailyId)?.value || '';
    if (!date || !proc) { UI.toast('날짜와 처리량은 필수입니다', true); return; }

    const updated = { ...rec, date, proc, normal, noBoot, abnormal, note };
    Store.upsertDaily(updated);

    const saveBtn = document.querySelector(`[onclick="Pages.DailyInput.saveDailyEdit(${lotId},${dailyId})"]`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
    const result = await Api.update(CONFIG.SHEETS.DAILY, dailyId, updated);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }
    if (result && result.success === false) return;

    // 누적/잔량 재계산 + 전량 처리 시 LOT 자동 완료
    const totalCum = _resequenceLot(lot);
    if (parseNumber(lot.qty) > 0 && totalCum >= parseNumber(lot.qty) && lot.done !== '1') {
      const lastDate = Store.getDailies()
        .filter(d => String(d.lotId) === String(lot.id))
        .reduce((mx, d) => String(d.date || '') > mx ? String(d.date || '') : mx, '');
      const updLot = { ...lot, done: '1', actualDone: lot.actualDone || lastDate || date };
      Store.upsertLot(updLot);
      Api.update(CONFIG.SHEETS.LOTS, lot.id, updLot);
    }

    _editDailyId = null;
    Api.log('일별처리', '수정', lot.lotNo || String(lotId), `${date} 처리 ${formatQty(proc, lot.biz)}${isDram ? ` (N:${formatNumber(normal)} / NB:${formatNumber(noBoot)} / AB:${formatNumber(abnormal)})` : ''}`);
    UI.toast('수정됨');
    render();
  }

  function toggleCard(lotId) {
    _openId = _openId === lotId ? null : lotId;
    _editDailyId = null;
    _selDaily.clear();
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
    Api.log('일별처리', '등록', lot.lotNo || String(lot.id), `${date}${moNo ? ` [MO ${moNo}]` : ''} 처리 ${formatQty(proc, lot.biz)}${isDram ? ` (N:${formatNumber(normal)} / NB:${formatNumber(noBoot)} / AB:${formatNumber(abnormal)})` : ''} | 누적 ${formatNumber(cumNew)} / 잔량 ${formatNumber(remNew)}`);
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
    Api.log('일별처리', '삭제', lot?.lotNo || String(lotId), `${rec?.date || ''} 처리 ${formatQty(parseNumber(rec?.proc), lot?.biz)}${rec?.biz==='DRAM' ? ` (N:${formatNumber(parseNumber(rec?.normal))} / NB:${formatNumber(parseNumber(rec?.noBoot))} / AB:${formatNumber(parseNumber(rec?.abnormal))})` : ''} 삭제`);
  }

  // ── 처리 이력 다중 선택 / 일괄 삭제 ─────────────────────────
  function _syncSelUI(lotId) {
    const boxes = Array.from(document.querySelectorAll(`[data-dsel="${lotId}"]`));
    const n     = boxes.filter(b => b.checked).length;
    const bar   = document.getElementById('dp-selbar-' + lotId);
    const cnt   = document.getElementById('dp-selcnt-' + lotId);
    const all   = document.getElementById('dp-selall-' + lotId);
    if (bar) bar.style.display = n ? 'flex' : 'none';
    if (cnt) cnt.textContent   = n + '건 선택';
    if (all) {
      all.checked       = n > 0 && n === boxes.length;
      all.indeterminate = n > 0 && n < boxes.length;
    }
  }

  function toggleSelectDaily(id, lotId, el) {
    if (el.checked) _selDaily.add(String(id));
    else            _selDaily.delete(String(id));
    _syncSelUI(lotId);
  }

  function toggleSelectAllDaily(lotId, el) {
    document.querySelectorAll(`[data-dsel="${lotId}"]`).forEach(b => {
      b.checked = el.checked;
      if (el.checked) _selDaily.add(String(b.value));
      else            _selDaily.delete(String(b.value));
    });
    _syncSelUI(lotId);
  }

  function clearSelection(lotId) {
    document.querySelectorAll(`[data-dsel="${lotId}"]`).forEach(b => b.checked = false);
    _selDaily.clear();
    _syncSelUI(lotId);
  }

  async function deleteSelected(lotId) {
    const lot     = Store.getLotById(lotId);
    const targets = Store.getDailies()
      .filter(d => String(d.lotId) === String(lotId) && _selDaily.has(String(d.id)))
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (!targets.length) { UI.toast('선택된 처리 이력이 없습니다', true); return; }

    const totQty   = targets.reduce((sum, d) => sum + parseNumber(d.proc), 0);
    const dates    = [...new Set(targets.map(d => d.date || ''))].filter(Boolean);
    const dateText = dates.length <= 3 ? dates.join(', ') : `${dates[0]} ~ ${dates[dates.length - 1]}`;
    if (!confirm(`처리 이력 ${targets.length}건을 삭제하시겠습니까?\n\n${dateText}\n합계 ${formatQty(totQty, lot?.biz)}`)) return;

    for (const rec of targets) {
      Store.deleteDaily(rec.id);
      Api.delete(CONFIG.SHEETS.DAILY, rec.id);
    }
    _selDaily.clear();
    render();
    UI.toast(targets.length + '건 삭제됨');

    const moList = [...new Set(targets.map(d => d.moNo).filter(Boolean))];
    Api.log('일별처리', '삭제', lot?.lotNo || String(lotId),
      `처리 이력 ${targets.length}건 일괄 삭제 (${dateText}) 합계 ${formatQty(totQty, lot?.biz)}${moList.length ? ` | MO ${moList.join(', ')}` : ''}`);
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

  return { render, setFilter, toggleCard, calcDram, calcRemaining, saveRecord, deleteRecord, addMo, deleteMo,
           toggleSelectDaily, toggleSelectAllDaily, clearSelection, deleteSelected,
           startEditDaily, cancelEditDaily, calcEditDailyDram, saveDailyEdit,
           openPasteModal, closePasteModal, parsePaste, setParsedLot, savePaste };

})();
