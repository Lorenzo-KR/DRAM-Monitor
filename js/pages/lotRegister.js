/**
 * pages/lotRegister.js
 * LOT 등록 페이지 — 국가/사업 필터 → 폼 입력 → 인라인 편집 테이블
 */

Pages.LotRegister = (() => {

  let _co  = '';
  let _biz = '';

  function setFilter(el, type) {
    if (type === 'co') {
      document.querySelectorAll('#pg-lotreg [data-co]').forEach(e => e.classList.remove('on'));
      el.classList.add('on');
      _co = el.dataset.co;
    } else {
      document.querySelectorAll('#pg-lotreg [data-biz]').forEach(e => e.classList.remove('on'));
      el.classList.add('on');
      _biz = el.dataset.biz;
    }
    render();
  }

  function render() {
    const empty    = document.getElementById('lr-empty');
    const form     = document.getElementById('lr-form');
    const tableWrap = document.getElementById('lr-table-wrap');

    if (!_co || !_biz) {
      empty.style.display = 'block';
      form.style.display = 'none';
      tableWrap.style.display = 'none';
      document.getElementById('lr-sub').textContent = '국가와 사업을 선택하세요';
      return;
    }

    empty.style.display = 'none';
    form.style.display  = 'block';
    tableWrap.style.display = 'block';

    const coLabel  = CONFIG.COUNTRY_LABELS[_co]  || _co;
    const bizLabel = CONFIG.BIZ_LABELS[_biz] || _biz;
    document.getElementById('lr-sub').textContent       = coLabel + ' · ' + bizLabel;
    document.getElementById('lr-form-title').textContent = '새 LOT 추가 — ' + coLabel + ' · ' + bizLabel;
    document.getElementById('lr-table-title').textContent = coLabel + ' · ' + bizLabel + ' LOT 목록';

    // 고객사 드롭다운
    const custSel = document.getElementById('lr-cust');
    const custs   = Store.getCustomers().filter(c => (!c.country || c.country === _co) && (!c.biz || c.biz === _biz || c.biz === 'ALL'));
    custSel.innerHTML = '<option value="">-- 선택 --</option>'
      + custs.map(c => `<option value="${c.name}">${c.name}</option>`).join('')
      + '<option value="__manual__">직접 입력...</option>';

    _renderTable();
  }

  function _renderTable() {
    const dailies  = Store.getDailies();
    const filtered = Store.getLots()
      .filter(l => (!_co || l.country === _co) && (!_biz || l.biz === _biz))
      .sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    const tb = document.getElementById('lot-tbody');
    if (!filtered.length) {
      tb.innerHTML = `<tr><td colspan="14"><div class="empty">등록된 LOT가 없습니다. 위 폼에서 추가하세요.</div></td></tr>`;
      return;
    }

    tb.innerHTML = filtered.map(l => {
      const pct = getLotProgress(l, dailies);
      const st  = getLotStatus(l);
      return `
        <tr data-id="${l.id}">
          <td style="padding:6px 10px;text-align:center"><input type="checkbox" class="lot-chk" value="${l.id}" onchange="Pages.LotRegister.updateBulkBar()" style="cursor:pointer;width:14px;height:14px"></td>
          ${makeEditableCell(l.lotNo, 'mono', `Pages.LotRegister.saveCell(this,'lotNo',${l.id})`)}
          ${makeEditableCell(l.customerName, '', `Pages.LotRegister.saveCell(this,'customerName',${l.id})`)}
          ${makeEditableCell(l.inDate, '', `Pages.LotRegister.saveDateCell(this,${l.id})`, 'type="date"')}
          <td><input class="ec" value="${escapeAttr(l.targetDate)}" type="date" readonly style="color:var(--tx2)"></td>
          <td style="padding:8px 10px;color:#166534;font-size:12px">${l.actualDone || '-'}</td>
          ${makeEditableCell(l.qty, 'num', `Pages.LotRegister.saveCell(this,'qty',${l.id})`, 'type="number" min="0"')}
          ${makeEditableSelect(l.unit || '개', [['개','개'],['Wafer','Wafer'],['Tray','Tray'],['EA','EA']], '', `Pages.LotRegister.saveCell(this,'unit',${l.id})`)}
          ${makeEditableCell(l.price, 'num', `Pages.LotRegister.saveCell(this,'price',${l.id})`, 'type="number" min="0"')}
          ${makeEditableSelect(l.currency || 'USD', [['USD','USD'],['HKD','HKD'],['SGD','SGD'],['KRW','KRW']], '', `Pages.LotRegister.saveCell(this,'currency',${l.id})`)}
          ${makeEditableCell(l.product, '', `Pages.LotRegister.saveCell(this,'product',${l.id})`)}
          <td class="tc" style="padding:8px 10px">
            <div style="font-size:12px;font-weight:500;color:${pct >= 100 ? '#16a34a' : 'var(--tx)'}">${pct}%</div>
            <div class="pb-w"><div class="pb" style="width:${pct}%;background:${CONFIG.BIZ_COLORS[l.biz] || '#888'}"></div></div>
          </td>
          <td class="tc" style="padding:8px 10px">${renderStatusBadge(st)}</td>
          <td style="padding:4px 8px"><div class="row-actions"><button class="ra-btn del" onclick="Pages.LotRegister.deleteLot(${l.id})">삭제</button></div></td>
        </tr>`;
    }).join('');
  }

  function calcTargetDate() {
    const d = document.getElementById('lr-in').value;
    if (d) document.getElementById('lr-tgt').value = addDays(d, CONFIG.LOT_DEFAULT_TARGET_DAYS);
  }

  function handleCustomerSelect(sel) {
    const manual = document.getElementById('lr-cust-manual');
    if (sel.value === '__manual__') { manual.style.display = 'block'; manual.focus(); }
    else { manual.style.display = 'none'; manual.value = ''; }
  }

  async function save() {
    const inDate = document.getElementById('lr-in').value;
    const qty    = parseNumber(document.getElementById('lr-qty').value);
    if (!inDate || !qty) { UI.toast('입고일과 수량은 필수입니다', true); return; }
    if (!_co || !_biz)   { UI.toast('국가와 사업을 먼저 선택하세요', true); return; }

    const sel    = document.getElementById('lr-cust');
    const manual = document.getElementById('lr-cust-manual');
    const custName = sel.value === '__manual__' ? manual.value.trim() : sel.value;

    const record = {
      id:           Date.now(),
      biz:          _biz,
      country:      _co,
      customerName: custName,
      lotNo:        document.getElementById('lr-lot').value.trim() || ('LOT-' + Date.now()),
      inDate,
      targetDate:   document.getElementById('lr-tgt').value,
      qty,
      unit:         document.getElementById('lr-unit').value,
      price:        parseNumber(document.getElementById('lr-price').value),
      currency:     document.getElementById('lr-cur').value,
      product:      document.getElementById('lr-prod').value.trim(),
      note:         document.getElementById('lr-note').value.trim(),
      done:         '0',
      actualDone:   '',
    };

    Store.upsertLot(record);
    _renderTable();
    clearForm();
    const ok = document.getElementById('lr-ok');
    ok.style.display = 'inline';
    setTimeout(() => ok.style.display = 'none', 1500);
    UI.toast(CONFIG.BIZ_LABELS[_biz] + ' LOT 등록');
    Api.append(CONFIG.SHEETS.LOTS, record);
  }

  function clearForm() {
    ['lr-lot','lr-qty','lr-price','lr-prod','lr-note','lr-in','lr-tgt','lr-cust-manual'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const custSel = document.getElementById('lr-cust'); if (custSel) custSel.selectedIndex = 0;
    const manual  = document.getElementById('lr-cust-manual'); if (manual) manual.style.display = 'none';
  }

  async function saveCell(el, field, id) {
    const lot = Store.getLotById(id); if (!lot) return;
    const updated = { ...lot, [field]: el.tagName === 'SELECT' ? el.value : el.type === 'number' ? parseNumber(el.value) : el.value };
    Store.upsertLot(updated);
    Api.update(CONFIG.SHEETS.LOTS, id, updated);
    UI.toast('저장됨');
  }

  async function saveDateCell(el, id) {
    const lot = Store.getLotById(id); if (!lot) return;
    const updated = { ...lot, inDate: el.value, targetDate: el.value ? addDays(el.value, CONFIG.LOT_DEFAULT_TARGET_DAYS) : lot.targetDate };
    Store.upsertLot(updated);
    Api.update(CONFIG.SHEETS.LOTS, id, updated);
    _renderTable();
    UI.toast('저장됨');
  }

  async function deleteLot(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteLot(id);
    _renderTable();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.LOTS, id);
  }

  function updateBulkBar() {
    const chks = document.querySelectorAll('.lot-chk:checked');
    const bar  = document.getElementById('lot-bulk-bar');
    if (!bar) return;
    bar.style.display = chks.length ? 'flex' : 'none';
    const cnt = document.getElementById('lot-sel-cnt'); if (cnt) cnt.textContent = chks.length + '개 선택됨';
    const all = document.getElementById('lot-chk-all'); if (!all) return;
    const total = document.querySelectorAll('.lot-chk').length;
    all.indeterminate = chks.length > 0 && chks.length < total;
    all.checked       = chks.length > 0 && chks.length === total;
  }

  function toggleAllChecks(el) {
    document.querySelectorAll('.lot-chk').forEach(c => c.checked = el.checked);
    updateBulkBar();
  }

  function clearChecks() {
    document.querySelectorAll('.lot-chk').forEach(c => c.checked = false);
    const all = document.getElementById('lot-chk-all'); if (all) all.checked = false;
    const bar = document.getElementById('lot-bulk-bar'); if (bar) bar.style.display = 'none';
  }

  async function bulkDelete() {
    const ids = [...document.querySelectorAll('.lot-chk:checked')].map(c => c.value);
    if (!ids.length) return;
    if (!confirm(`선택한 LOT ${ids.length}건을 삭제하시겠습니까?`)) return;
    ids.forEach(id => { Store.deleteLot(id); Api.delete(CONFIG.SHEETS.LOTS, id); });
    _renderTable();
    UI.toast(ids.length + '건 삭제 완료');
  }

  function exportExcel() {
    const dailies = Store.getDailies();
    const data = Store.getLots().map(l => ({
      'LOT번호': l.lotNo || l.id, '사업': CONFIG.BIZ_LABELS[l.biz] || l.biz,
      '국가': CONFIG.COUNTRY_LABELS[l.country] || l.country, '고객사': l.customerName || '',
      '입고일': l.inDate, '목표완료일': l.targetDate, '실완료일': l.actualDone || '',
      '총수량': parseNumber(l.qty), '단위': l.unit || '개',
      '누적처리': getLotCumulative(l.id, dailies),
      '잔량': getLotRemaining(l, dailies),
      '진행률(%)': getLotProgress(l, dailies),
      '상태': getLotStatus(l) === 'done' ? '완료' : getLotStatus(l) === 'overdue' ? '지연' : '진행중',
      '단가': parseNumber(l.price), '통화': l.currency || '', '제품': l.product || '',
    }));
    _xlsxExport(data, 'LOT현황_' + today() + '.xlsx', 'LOT현황');
  }

  return { render, setFilter, calcTargetDate, handleCustomerSelect, save, clearForm, saveCell, saveDateCell, deleteLot, updateBulkBar, toggleAllChecks, clearChecks, bulkDelete, exportExcel };

})();
