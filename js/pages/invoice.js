/**
 * pages/invoice.js
 * 인보이스 관리 — 카드 목록 + 슬라이드 패널 입력
 */

Pages.Invoice = (() => {

  let _editId = null;

  function render() {
    const el     = document.getElementById('inv-cards'); if (!el) return;
    const sorted = [...Store.getInvoices()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    if (!sorted.length) {
      el.innerHTML = '<div class="empty" style="padding:48px">인보이스가 없습니다<br><button class="btn pri sm" onclick="Pages.Invoice.openPanel(null)" style="margin-top:12px">+ 새 인보이스 추가</button></div>';
      return;
    }

    const stMap = {
      unpaid:  '<span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:#fee2e2;color:#991b1b">미수금</span>',
      partial: '<span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:#fef3c7;color:#92400e">부분수금</span>',
      paid:    '<span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:#dcfce7;color:#166534">수금완료</span>',
    };

    el.innerHTML = sorted.map(r => {
      const lot     = Store.getLotById(r.lotId);
      const due     = r.due ? diffDays(today(), r.due) : null;
      const dueColor = r.status === 'paid' ? '#166534' : due !== null && due < 0 ? '#dc2626' : due !== null && due <= 7 ? '#92400e' : 'var(--tx2)';
      const dueText  = r.status === 'paid' ? '수금완료' : due === null ? '-' : due < 0 ? 'D+' + Math.abs(due) : due === 0 ? '오늘' : 'D-' + due;
      return `
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:12px;padding:16px 18px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:14px;font-weight:600;font-family:var(--font-mono)">${r.no || r.id}</span>
                ${renderBizTag(r.biz)} ${renderCountryTag(r.country)}
                ${stMap[r.status] || stMap.unpaid}
              </div>
              <div style="font-size:12px;color:var(--tx2)">${r.customerName || ''}${lot ? ' · ' + (lot.lotNo || lot.id) : ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;font-weight:600;letter-spacing:-.02em">${formatNumberShort(parseNumber(r.amount))}</div>
              <div style="font-size:11px;color:var(--tx3)">${r.currency || 'USD'}${parseNumber(r.vat) > 0 ? ' (VAT +' + formatNumberShort(parseNumber(r.vat)) + ')' : ''}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:0.5px solid var(--bd)">
            <div style="font-size:12px;color:var(--tx2)">발행 ${r.date || '-'}${r.due ? ` &nbsp;·&nbsp; 기한 <span style="color:${dueColor};font-weight:500">${r.due} (${dueText})</span>` : ''}</div>
            <div style="display:flex;gap:6px">
              ${r.status !== 'paid' ? `<button class="btn sm" style="font-size:11px" onclick="Pages.Invoice.quickPaid(${r.id})">수금 처리</button>` : ''}
              <button class="btn sm" style="font-size:11px" onclick="Pages.Invoice.openPanel(${r.id})">수정</button>
              <button class="btn del sm" style="font-size:11px" onclick="Pages.Invoice.delete(${r.id})">삭제</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function openPanel(id) {
    _editId = id;
    const panel   = document.getElementById('inv-panel');
    const overlay = document.getElementById('inv-overlay');
    document.getElementById('inv-panel-title').textContent = id ? '인보이스 수정' : '새 인보이스';

    const lotSel = document.getElementById('ip-lot');
    lotSel.innerHTML = '<option value="">-- LOT 선택 --</option>'
      + Store.getLots().map(l => `<option value="${l.id}">[${CONFIG.COUNTRY_LABELS[l.country] || l.country}] ${l.lotNo || l.id} (${CONFIG.BIZ_LABELS[l.biz] || l.biz})</option>`).join('');

    if (id) {
      const r = Store.getInvoiceById(id); if (!r) return;
      document.getElementById('ip-no').value        = r.no         || '';
      document.getElementById('ip-date').value      = r.date       || '';
      document.getElementById('ip-biz').value       = r.biz        || 'DRAM';
      document.getElementById('ip-co').value        = r.country    || 'HK';
      document.getElementById('ip-cust').value      = r.customerName || '';
      document.getElementById('ip-amount').value    = r.amount     || '';
      document.getElementById('ip-vat').value       = r.vat        || '';
      document.getElementById('ip-total').value     = formatNumberShort(parseNumber(r.amount) + parseNumber(r.vat));
      document.getElementById('ip-cur').value       = r.currency   || 'USD';
      document.getElementById('ip-due').value       = r.due        || '';
      document.getElementById('ip-status').value    = r.status     || 'unpaid';
      document.getElementById('ip-paid-date').value = r.paidDate   || '';
      document.getElementById('ip-paid-amt').value  = r.paidAmt    || '';
      document.getElementById('ip-note').value      = r.note       || '';
      document.getElementById('ip-lot').value       = r.lotId      || '';
      togglePaidFields(r.status);
    } else {
      ['ip-no','ip-date','ip-biz','ip-cust','ip-amount','ip-vat','ip-total','ip-due','ip-paid-date','ip-paid-amt','ip-note'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
      document.getElementById('ip-date').value      = today();
      document.getElementById('ip-status').value    = 'paid';       // 기본값: 수금완료
      document.getElementById('ip-paid-date').value = today();      // 수금일도 오늘로
      document.getElementById('ip-cur').value       = 'USD';
      document.getElementById('ip-lot').value       = '';
      togglePaidFields('paid');
    }
    panel.style.display = 'block'; overlay.style.display = 'block'; document.body.style.overflow = 'hidden';
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
    document.getElementById('ip-biz').value  = lot.biz          || 'DRAM';
    document.getElementById('ip-co').value   = lot.country      || 'HK';
    document.getElementById('ip-cust').value = lot.customerName || '';
    // 발행일 → LOT 완료일 (없으면 오늘)
    document.getElementById('ip-date').value      = lot.actualDone || today();
    document.getElementById('ip-paid-date').value = lot.actualDone || today();
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
    const vat    = parseNumber(document.getElementById('ip-vat').value);
    const lotId  = document.getElementById('ip-lot').value;
    const lot    = Store.getLots().find(l => String(l.id) === lotId);
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

  return { render, openPanel, closePanel, togglePaidFields, fillFromLot, calcTotal, save, quickPaid, delete: deleteInvoice, exportExcel };

})();
