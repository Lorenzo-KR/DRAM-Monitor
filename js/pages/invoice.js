/**
 * pages/invoice.js
 * 인보이스 관리 — 표 목록(필터/정렬/합계) + 슬라이드 패널 입력
 */

Pages.Invoice = (() => {

  let _editId   = null;
  let _filterCo  = '';
  let _filterBiz = '';
  let _sortKey   = 'inDate';   // 기본: 입고일 내림차순
  let _sortDir   = -1;

  // ── 목록 렌더 ───────────────────────────────────────────────
  function render() {
    const el = document.getElementById('inv-cards'); if (!el) return;

    let list = [...Store.getInvoices()];
    if (_filterCo)  list = list.filter(r => r.country === _filterCo);
    if (_filterBiz) list = list.filter(r => r.biz === _filterBiz);

    // 인보이스에 연결된 LOT의 입고일로 정렬
    list.sort((a, b) => {
      let av, bv;
      if (_sortKey === 'inDate') {
        const lotA = Store.getLotById(a.lotId);
        const lotB = Store.getLotById(b.lotId);
        av = lotA?.inDate || a.date || '';
        bv = lotB?.inDate || b.date || '';
      } else if (_sortKey === 'amount' || _sortKey === 'total') {
        av = parseNumber(a.amount); bv = parseNumber(b.amount);
      } else {
        av = a[_sortKey] || ''; bv = b[_sortKey] || '';
      }
      return typeof av === 'number' ? (av - bv) * _sortDir : String(av).localeCompare(String(bv)) * _sortDir;
    });

    const totalAmt  = list.reduce((s, r) => s + parseNumber(r.amount), 0);
    const paidAmt   = list.filter(r => r.status === 'paid').reduce((s, r) => s + parseNumber(r.amount), 0);
    const unpaidAmt = list.filter(r => r.status !== 'paid').reduce((s, r) => s + parseNumber(r.amount), 0);

    const CO_STYLE  = { HK: 'background:#FAEEDA;color:#633806', SG: 'background:#E1F5EE;color:#085041' };
    const BIZ_STYLE = { DRAM: 'background:#E6F1FB;color:#0C447C', SSD: 'background:#E1F5EE;color:#085041', MID: 'background:#EEEDFE;color:#3C3489' };
    const ST_STYLE  = { paid: 'background:#E1F5EE;color:#085041', partial: 'background:#FAEEDA;color:#633806', unpaid: 'background:#FCEBEB;color:#791F1F' };
    const ST_LABEL  = { paid: '수금완료', partial: '부분수금', unpaid: '미수금' };

    function badge(txt, style) { return `<span style="display:inline-flex;align-items:center;font-size:14px;font-weight:500;padding:1px 6px;border-radius:3px;white-space:nowrap;${style}">${txt}</span>`; }
    function th(label, key, align = 'left') {
      const active = _sortKey === key;
      const arrow  = active ? (_sortDir > 0 ? ' ↑' : ' ↓') : '';
      return `<th onclick="Pages.Invoice.sort('${key}')" style="padding:9px 13px;text-align:${align};font-size:14px;font-weight:500;color:${active ? 'var(--tx)' : 'var(--tx3)'};text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd);white-space:nowrap;cursor:pointer">${label}${arrow}</th>`;
    }

    const rows = list.length === 0
      ? `<tr><td colspan="10" style="padding:24px;text-align:center;color:var(--tx3);font-size:15px">인보이스가 없습니다</td></tr>`
      : list.map((r, i) => {
          const lot      = Store.getLotById(r.lotId);
          const due      = r.due ? diffDays(today(), r.due) : null;
          const dueColor = r.status === 'paid' ? '#085041' : due !== null && due < 0 ? '#A32D2D' : due !== null && due <= 7 ? '#BA7517' : 'var(--tx2)';
          const dueText  = r.status === 'paid' ? '수금완료' : due === null ? '—' : due < 0 ? 'D+' + Math.abs(due) : 'D-' + due;
          const lotInDate = lot?.inDate || '—';
          return `
            <tr style="border-bottom:0.5px solid var(--bd)">
              <td style="padding:9px 13px;color:var(--tx3);font-size:15px;text-align:center">${i + 1}</td>
              <td style="padding:9px 13px;font-size:15px;color:var(--tx3)">${lotInDate}</td>
              <td style="padding:9px 13px;font-size:15px;color:var(--tx3)">${r.date || '—'}</td>
              <td style="padding:9px 13px;font-family:var(--font-mono);font-size:15px">${r.no || '—'}</td>
              <td style="padding:9px 13px">${badge(r.country, CO_STYLE[r.country] || '')} ${badge(r.biz, BIZ_STYLE[r.biz] || '')}</td>
              <td style="padding:9px 13px;font-size:14px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.customerName || '—'}</td>
              <td style="padding:9px 13px;font-size:15px;color:var(--tx3)">${lot ? (lot.lotNo || lot.id) : (r.lotNo || '—')}</td>
              <td style="padding:9px 13px;text-align:right;font-family:var(--font-mono);font-size:14px;font-weight:600">$${formatNumber(Math.round(parseNumber(r.amount)))}</td>
              <td style="padding:9px 13px;font-size:15px;color:${dueColor}">${r.due || '—'}${due !== null && r.status !== 'paid' ? ` (${dueText})` : ''}</td>
              <td style="padding:9px 13px">${badge(ST_LABEL[r.status] || '미수금', ST_STYLE[r.status] || ST_STYLE.unpaid)}</td>
              <td style="padding:4px 8px;white-space:nowrap">
                ${r.status !== 'paid' ? `<button class="btn sm" style="font-size:14px;padding:2px 7px" onclick="Pages.Invoice.quickPaid(${r.id})">수금</button>` : ''}
                <button class="btn sm" style="font-size:14px;padding:2px 7px" onclick="Pages.Invoice.openPanel(${r.id})">수정</button>
                <button class="btn del sm" style="font-size:14px;padding:2px 7px" onclick="Pages.Invoice.delete(${r.id})">삭제</button>
              </td>
            </tr>`;
        }).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <div style="display:flex;gap:4px">
          ${['', 'HK', 'SG'].map(co => `<button class="btn sm${_filterCo === co ? ' pri' : ''}" style="font-size:15px;padding:3px 10px" onclick="Pages.Invoice.filterCo('${co}')">${co || '전체'}</button>`).join('')}
        </div>
        <div style="display:flex;gap:4px">
          ${['', ...CONFIG.BIZ_LIST].map(b => `<button class="btn sm${_filterBiz === b ? ' pri' : ''}" style="font-size:15px;padding:3px 10px" onclick="Pages.Invoice.filterBiz('${b}')">${b ? CONFIG.BIZ_LABELS[b] : '전체'}</button>`).join('')}
        </div>
        <span style="font-size:15px;color:var(--tx3);margin-left:auto">${list.length}건</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
          <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">총 매출액</div>
          <div style="font-size:18px;font-weight:600">$${formatNumber(Math.round(totalAmt))}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
          <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">수금 완료</div>
          <div style="font-size:18px;font-weight:600;color:#085041">$${formatNumber(Math.round(paidAmt))}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
          <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">미수금</div>
          <div style="font-size:18px;font-weight:600;color:${unpaidAmt > 0 ? '#A32D2D' : 'var(--tx3)'}">$${formatNumber(Math.round(unpaidAmt))}</div>
        </div>
      </div>

      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr>
            <th style="padding:9px 13px;text-align:center;font-size:14px;font-weight:500;color:var(--tx3);text-transform:uppercase;background:var(--bg);border-bottom:0.5px solid var(--bd);width:32px">#</th>
            ${th('입고일', 'inDate')}
            ${th('발행일', 'date')}
            ${th('번호', 'no')}
            <th style="padding:9px 13px;font-size:14px;font-weight:500;color:var(--tx3);text-transform:uppercase;background:var(--bg);border-bottom:0.5px solid var(--bd)">지역/사업</th>
            ${th('고객사', 'customerName')}
            <th style="padding:9px 13px;font-size:14px;font-weight:500;color:var(--tx3);text-transform:uppercase;background:var(--bg);border-bottom:0.5px solid var(--bd)">LOT</th>
            ${th('매출액', 'amount', 'right')}
            ${th('결제기한', 'due')}
            ${th('상태', 'status')}
            <th style="padding:9px 13px;background:var(--bg);border-bottom:0.5px solid var(--bd);width:100px"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
          ${list.length > 0 ? `
          <tfoot>
            <tr style="background:var(--bg)">
              <td colspan="7" style="padding:9px 13px;font-size:15px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">합계 (${list.length}건)</td>
              <td style="padding:9px 13px;text-align:right;font-family:var(--font-mono);font-size:14px;font-weight:600;color:#085041;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalAmt))}</td>
              <td colspan="3" style="border-top:0.5px solid var(--bd)"></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>`;
  }

  // ── 필터 / 정렬 ─────────────────────────────────────────────
  function filterCo(co)   { _filterCo  = co;  render(); }
  function filterBiz(biz) { _filterBiz = biz; render(); }
  function sort(key) {
    if (_sortKey === key) _sortDir *= -1; else { _sortKey = key; _sortDir = -1; }
    render();
  }

  // ── 패널 ────────────────────────────────────────────────────
  function openPanel(id) {
    _editId = id;
    document.getElementById('inv-panel-title').textContent = id ? '인보이스 수정' : '새 인보이스';

    const lotSel = document.getElementById('ip-lot');
    lotSel.innerHTML = '<option value="">-- LOT 선택 --</option>'
      + Store.getLots().map(l => `<option value="${l.id}">[${CONFIG.COUNTRY_LABELS[l.country] || l.country}] ${l.lotNo || l.id} (${CONFIG.BIZ_LABELS[l.biz] || l.biz})</option>`).join('');

    if (id) {
      const r = Store.getInvoiceById(id); if (!r) return;
      document.getElementById('ip-no').value        = r.no           || '';
      document.getElementById('ip-date').value      = r.date         || '';
      document.getElementById('ip-biz').value       = r.biz          || 'DRAM';
      document.getElementById('ip-co').value        = r.country      || 'HK';
      document.getElementById('ip-cust').value      = r.customerName || '';
      document.getElementById('ip-amount').value    = r.amount       || '';
      document.getElementById('ip-vat').value       = r.vat          || '';
      document.getElementById('ip-total').value     = formatNumberShort(parseNumber(r.amount) + parseNumber(r.vat));
      document.getElementById('ip-cur').value       = r.currency     || 'USD';
      document.getElementById('ip-due').value       = r.due          || '';
      document.getElementById('ip-status').value    = r.status       || 'unpaid';
      document.getElementById('ip-paid-date').value = r.paidDate     || '';
      document.getElementById('ip-paid-amt').value  = r.paidAmt      || '';
      document.getElementById('ip-note').value      = r.note         || '';
      document.getElementById('ip-lot').value       = r.lotId        || '';
      togglePaidFields(r.status);
    } else {
      ['ip-no','ip-date','ip-biz','ip-cust','ip-amount','ip-vat','ip-total','ip-due','ip-paid-date','ip-paid-amt','ip-note'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
      document.getElementById('ip-date').value      = today();
      document.getElementById('ip-status').value    = 'paid';
      document.getElementById('ip-paid-date').value = today();
      document.getElementById('ip-cur').value       = 'USD';
      document.getElementById('ip-lot').value       = '';
      togglePaidFields('paid');
    }
    document.getElementById('inv-panel').style.display   = 'block';
    document.getElementById('inv-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    document.getElementById('inv-panel').style.display   = 'none';
    document.getElementById('inv-overlay').style.display = 'none';
    document.body.style.overflow = ''; _editId = null;
  }

  function togglePaidFields(status) {
    const row = document.getElementById('ip-paid-row');
    if (row) row.style.display = (status === 'paid' || status === 'partial') ? 'grid' : 'none';
  }

  function fillFromLot(lotId) {
    const lot = Store.getLots().find(l => String(l.id) === lotId); if (!lot) return;
    document.getElementById('ip-biz').value       = lot.biz          || 'DRAM';
    document.getElementById('ip-co').value        = lot.country      || 'HK';
    document.getElementById('ip-cust').value      = lot.customerName || '';
    document.getElementById('ip-date').value      = lot.actualDone   || today();
    document.getElementById('ip-paid-date').value = lot.actualDone   || today();
    if (lot.price)    document.getElementById('ip-amount').value = lot.price;
    if (lot.currency) document.getElementById('ip-cur').value    = lot.currency;
    calcTotal();
  }

  function calcTotal() {
    const amt = parseNumber(document.getElementById('ip-amount').value);
    const vat = parseNumber(document.getElementById('ip-vat').value);
    document.getElementById('ip-total').value = formatNumberShort(amt + vat);
  }

  async function save() {
    const date   = document.getElementById('ip-date').value;
    const amount = parseNumber(document.getElementById('ip-amount').value);
    if (!date || !amount) { UI.toast('발행일과 청구금액은 필수입니다', true); return; }
    const vat   = parseNumber(document.getElementById('ip-vat').value);
    const lotId = document.getElementById('ip-lot').value;
    const lot   = Store.getLots().find(l => String(l.id) === lotId);
    const record = {
      id: _editId || Date.now(),
      no: document.getElementById('ip-no').value.trim() || ('INV-' + Date.now()),
      date, due: document.getElementById('ip-due').value,
      lotId: lotId || '', lotNo: lot ? lot.lotNo || lot.id : '',
      biz: document.getElementById('ip-biz').value,
      country: document.getElementById('ip-co').value,
      customerName: document.getElementById('ip-cust').value.trim(),
      amount, vat, total: amount + vat,
      currency: document.getElementById('ip-cur').value,
      status: document.getElementById('ip-status').value,
      paidDate: document.getElementById('ip-paid-date').value,
      paidAmt: parseNumber(document.getElementById('ip-paid-amt').value),
      note: document.getElementById('ip-note').value.trim(),
    };
    Store.upsertInvoice(record);
    if (_editId) Api.update(CONFIG.SHEETS.INVOICES, _editId, record);
    else         Api.append(CONFIG.SHEETS.INVOICES, record);
    const ok = document.getElementById('ip-ok');
    ok.style.display = 'block';
    setTimeout(() => { ok.style.display = 'none'; closePanel(); }, 1000);
    render(); UI.toast('저장됨');
  }

  async function quickPaid(id) {
    const r = Store.getInvoiceById(id); if (!r) return;
    const updated = { ...r, status: 'paid', paidDate: today(), paidAmt: r.amount };
    Store.upsertInvoice(updated);
    Api.update(CONFIG.SHEETS.INVOICES, id, updated);
    render(); Pages.Revenue.render(); UI.toast('수금 완료 처리됨');
  }

  async function deleteInvoice(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteInvoice(id);
    Api.delete(CONFIG.SHEETS.INVOICES, id);
    render(); UI.toast('삭제됨');
  }

  function exportExcel() {
    const data = Store.getInvoices().map(r => ({
      '발행일': r.date, '번호': r.no, 'LOT': r.lotNo || '',
      '사업': CONFIG.BIZ_LABELS[r.biz] || r.biz,
      '국가': CONFIG.COUNTRY_LABELS[r.country] || r.country,
      '고객사': r.customerName || '', '청구액': parseNumber(r.amount),
      '통화': r.currency || '', '결제기한': r.due || '',
      '수금상태': r.status === 'paid' ? '수금완료' : r.status === 'partial' ? '부분수금' : '미수금',
    }));
    _xlsxExport(data, '매출현황_' + today() + '.xlsx', '매출현황');
  }

  return { render, filterCo, filterBiz, sort, openPanel, closePanel, togglePaidFields, fillFromLot, calcTotal, save, quickPaid, delete: deleteInvoice, exportExcel };

})();
