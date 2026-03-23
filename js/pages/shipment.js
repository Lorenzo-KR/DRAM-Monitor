/**
 * pages/shipment.js
 * 입고 예정 Shipment 관리
 */

Pages.Shipment = (() => {

  let _editId = null;

  function render() {
    const el     = document.getElementById('ship-cards'); if (!el) return;
    const ships  = Store.getShipments().sort((a, b) => String(a.expectedDate || '').localeCompare(String(b.expectedDate || '')));
    if (!ships.length) { el.innerHTML = '<div class="empty" style="padding:48px">등록된 입고 예정이 없습니다</div>'; return; }

    el.innerHTML = ships.map(s => {
      const dd      = s.expectedDate ? diffDays(today(), s.expectedDate) : null;
      const ddText  = dd === null ? '-' : dd < 0 ? 'D+' + Math.abs(dd) : dd === 0 ? '입고일!' : 'D-' + dd;
      const ddColor = dd === null ? 'var(--tx3)' : dd < 0 ? '#dc2626' : dd <= 3 ? '#B45309' : 'var(--tx2)';
      const stBg    = s.status === 'confirmed' ? '#dbeafe' : '#fef3c7';
      const stColor = s.status === 'confirmed' ? '#1e40af' : '#92400e';
      return `
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:12px;padding:16px 18px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-size:14px;font-weight:600;font-family:var(--font-mono)">${s.lotNo || '-'}</span>
              ${renderBizTag(s.biz)} ${renderCountryTag(s.country)}
              <span style="font-size:14px;font-weight:600;padding:2px 7px;border-radius:4px;background:${stBg};color:${stColor}">${s.status === 'confirmed' ? '확정' : '미확정'}</span>
            </div>
            <div style="font-size:14px;color:var(--tx2)">${s.customerName || ''}${s.note ? ' · ' + s.note : ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:600">${formatNumber(parseNumber(s.qty))}<span style="font-size:15px;font-weight:400;color:var(--tx3)"> ${s.unit || '개'}</span></div>
            <div style="font-size:14px;font-weight:600;color:${ddColor}">${ddText}</div>
            <div style="font-size:15px;color:var(--tx3)">${s.expectedDate || ''}</div>
            <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">
              ${s.status !== 'confirmed' ? `<button class="btn sm" style="font-size:15px" onclick="Pages.Shipment.confirm(${s.id})">확정</button>` : ''}
              <button class="btn sm" style="font-size:15px" onclick="Pages.Shipment.openPanel(${s.id})">수정</button>
              <button class="btn del sm" style="font-size:15px" onclick="Pages.Shipment.delete(${s.id})">삭제</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function openPanel(id) {
    _editId = id;
    document.getElementById('ship-panel-title').textContent = id ? 'Shipment 수정' : '새 Shipment';
    if (id) {
      const s = Store.getShipmentById(id); if (!s) return;
      document.getElementById('sp-biz').value     = s.biz     || 'DRAM';
      document.getElementById('sp-country').value = s.country || 'HK';
      document.getElementById('sp-cust').value    = s.customerName || '';
      document.getElementById('sp-lot').value     = s.lotNo   || '';
      document.getElementById('sp-qty').value     = s.qty     || '';
      document.getElementById('sp-unit').value    = s.unit    || '개';
      document.getElementById('sp-date').value    = s.expectedDate || '';
      document.getElementById('sp-status').value  = s.status  || 'pending';
      document.getElementById('sp-note').value    = s.note    || '';
    } else {
      ['sp-cust','sp-lot','sp-qty','sp-note','sp-date'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
      document.getElementById('sp-status').value = 'pending';
    }
    document.getElementById('ship-panel').style.display   = 'block';
    document.getElementById('ship-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    document.getElementById('ship-panel').style.display   = 'none';
    document.getElementById('ship-overlay').style.display = 'none';
    document.body.style.overflow = ''; _editId = null;
  }

  async function save() {
    const record = {
      id:           _editId || Date.now(),
      biz:          document.getElementById('sp-biz').value,
      country:      document.getElementById('sp-country').value,
      customerName: document.getElementById('sp-cust').value.trim(),
      lotNo:        document.getElementById('sp-lot').value.trim(),
      qty:          parseNumber(document.getElementById('sp-qty').value),
      unit:         document.getElementById('sp-unit').value,
      expectedDate: document.getElementById('sp-date').value,
      status:       document.getElementById('sp-status').value,
      note:         document.getElementById('sp-note').value.trim(),
    };
    Store.upsertShipment(record);
    if (_editId) Api.update(CONFIG.SHEETS.SHIPMENTS, _editId, record);
    else         Api.append(CONFIG.SHEETS.SHIPMENTS, record);
    const ok = document.getElementById('sp-ok');
    ok.style.display = 'block';
    setTimeout(() => { ok.style.display = 'none'; closePanel(); render(); Pages.Dashboard.render(); }, 800);
    UI.toast('저장됨');
  }

  async function confirm(id) {
    const s = Store.getShipmentById(id); if (!s) return;
    const updated = { ...s, status: 'confirmed' };
    Store.upsertShipment(updated);
    Api.update(CONFIG.SHEETS.SHIPMENTS, id, updated);
    render(); Pages.Dashboard.render(); UI.toast('확정 처리됨');
  }

  async function deleteShipment(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteShipment(id);
    Api.delete(CONFIG.SHEETS.SHIPMENTS, id);
    render(); Pages.Dashboard.render(); UI.toast('삭제됨');
  }

  return { render, openPanel, closePanel, save, confirm, delete: deleteShipment };

})();
