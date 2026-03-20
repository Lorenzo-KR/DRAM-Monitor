/**
 * pages/customers.js
 * 고객사 관리
 */

Pages.Customers = (() => {

  function render() {
    const tb   = document.getElementById('cu-tb'); if (!tb) return;
    const custs = Store.getCustomers();
    if (!custs.length) {
      tb.innerHTML = `<tr><td colspan="7"><div class="empty">등록된 고객사가 없습니다</div></td></tr>`;
      return;
    }
    tb.innerHTML = custs.map(c => `
      <tr>
        <td style="padding:8px 12px;font-weight:500">${c.name}</td>
        <td style="padding:8px 12px">${renderCountryTag(c.country)}</td>
        <td style="padding:8px 12px">${renderBizTag(c.biz === 'ALL' ? 'DRAM' : c.biz)}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--tx2)">${c.contact || '-'}</td>
        <td style="padding:8px 12px">${c.currency || 'USD'}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--tx2)">${c.note || ''}</td>
        <td style="padding:4px 8px"><button class="btn del sm" onclick="Pages.Customers.delete(${c.id})">✕</button></td>
      </tr>`).join('');
  }

  async function save() {
    const name = document.getElementById('cu-name').value.trim();
    if (!name) { UI.toast('이름 필수', true); return; }
    const record = {
      id:       Date.now(),
      name,
      country:  document.getElementById('cu-co').value,
      biz:      document.getElementById('cu-biz').value,
      contact:  document.getElementById('cu-contact').value.trim(),
      currency: document.getElementById('cu-cur').value,
      note:     document.getElementById('cu-note').value.trim(),
    };
    Store.setCustomers([...Store.getCustomers(), record]);
    const ok = document.getElementById('cu-ok');
    ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 1500);
    render(); UI.toast(name + ' 등록');
    Api.append(CONFIG.SHEETS.CUSTOMERS, record);
  }

  async function deleteCustomer(id) {
    if (!confirm('삭제?')) return;
    Store.setCustomers(Store.getCustomers().filter(c => c.id !== id));
    render(); UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.CUSTOMERS, id);
  }

  return { render, save, delete: deleteCustomer };

})();
