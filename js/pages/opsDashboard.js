/**
 * pages/opsDashboard.js
 * Ops Dashboard — Job Order 중심 운영 현황
 */

Pages.OpsDashboard = (() => {

  const CO_COLOR = { HK: '#854F0B', SG: '#0F6E56' };
  const CO_BG    = { HK: '#FAEEDA', SG: '#E1F5EE' };
  const CO_LABEL = { HK: 'HK', SG: 'SG' };

  function _coBadge(country) {
    const bg  = CO_BG[country]    || 'var(--bg)';
    const col = CO_COLOR[country] || 'var(--tx2)';
    const lbl = CO_LABEL[country] || country;
    return `<span style="background:${bg};color:${col};font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px">${lbl}</span>`;
  }

  function _renderKpi(lots, activeLots, doneLots, totalUnits, ssdUnits, dramUnits, totalRev) {
    const hkCount = lots.filter(l => l.country === 'HK').length;
    const sgCount = lots.filter(l => l.country === 'SG').length;
    return `
      <div class="sec-label">Overview</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:1.5rem">
        <div class="mc"><div class="mc-l">Total Job Orders</div><div class="mc-v">${lots.length}</div><div class="mc-s">HK ${hkCount} · SG ${sgCount}</div></div>
        <div class="mc"><div class="mc-l">Total Units</div><div class="mc-v">${formatNumber(totalUnits)}</div><div class="mc-s">SSD ${formatNumber(ssdUnits)} · DRAM ${formatNumber(dramUnits)}</div></div>
        <div class="mc"><div class="mc-l">Total Revenue</div><div class="mc-v" style="color:#0F6E56">${totalRev > 0 ? '$' + formatNumber(totalRev) : '—'}</div><div class="mc-s">Completed orders only</div></div>
        <div class="mc"><div class="mc-l">Active Orders</div><div class="mc-v" style="color:#185FA5">${activeLots.length}</div><div class="mc-s">${doneLots.length} completed</div></div>
      </div>`;
  }

  function _renderRevenueUnits(ssdRev, dramRev, totalRev, lots, dailies, totalUnits) {
    const ssdPct  = totalRev > 0 ? Math.round(ssdRev / totalRev * 100) : 0;
    const dramPct = 100 - ssdPct;

    const unitBars = CONFIG.BIZ_LIST.map(b => {
      const bl     = lots.filter(l => l.biz === b);
      const done   = bl.filter(l => getLotStatus(l) === 'done').reduce((s, l) => s + parseNumber(l.qty), 0);
      const active = bl.filter(l => getLotStatus(l) !== 'done').reduce((s, l) => s + getLotCumulative(l.id, dailies), 0);
      const total  = done + active;
      if (total === 0) return '';
      const pct    = Math.round(total / (totalUnits || 1) * 100);
      const color  = b === 'SSD' ? '#378ADD' : b === 'DRAM' ? '#888780' : '#6A3D7C';
      const tag    = done > 0 && active > 0 ? 'partial' : done > 0 ? 'completed' : 'in progress';
      const tagCol = done > 0 && active === 0 ? '#3B6D11' : done > 0 ? '#185FA5' : '#A32D2D';
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2)">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
              ${CONFIG.BIZ_LABELS[b] || b}
              <span style="font-size:10px;color:${tagCol}">${tag}</span>
            </div>
            <div style="font-size:12px;font-weight:600">${formatNumber(total)}</div>
          </div>
          <div style="height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="sec-label">Revenue & Units</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600">Revenue by business</div>
            <div style="font-size:11px;color:var(--tx3)">Service fee (USD)</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">
            <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--tx2)"><span style="width:8px;height:8px;border-radius:50%;background:#378ADD;display:inline-block"></span>SSD Test</div>
            <div style="font-weight:600;color:#185FA5">${ssdRev > 0 ? '$' + formatNumber(ssdRev) : '—'}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">
            <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--tx2)"><span style="width:8px;height:8px;border-radius:50%;background:#888780;display:inline-block"></span>DRAM Test</div>
            <div style="font-weight:600">${dramRev > 0 ? '$' + formatNumber(dramRev) : '—'}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
            <div style="font-size:13px;font-weight:600">Total</div>
            <div style="font-size:15px;font-weight:600;color:#0F6E56">${totalRev > 0 ? '$' + formatNumber(totalRev) : '—'}</div>
          </div>
          ${totalRev > 0 ? `
            <div style="height:7px;background:var(--bd);border-radius:4px;overflow:hidden;margin-top:8px">
              <div style="height:100%;width:${ssdPct}%;background:#378ADD;border-radius:4px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:5px">
              <span style="font-size:11px;color:#185FA5">SSD ${ssdPct}%</span>
              <span style="font-size:11px;color:var(--tx3)">DRAM ${dramPct}%</span>
            </div>` : ''}
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600">Units by category</div>
            <div style="font-size:11px;color:var(--tx3)">Quantity processed</div>
          </div>
          ${unitBars}
          <div style="border-top:1px solid var(--bd);padding-top:8px;display:flex;justify-content:space-between;font-size:12px">
            <span style="color:var(--tx3)">Total units (incl. in progress)</span>
            <span style="font-weight:600">${formatNumber(totalUnits)}</span>
          </div>
        </div>
      </div>`;
  }

  function _renderActiveCard(lot, dailies) {
    const cum       = getLotCumulative(lot.id, dailies);
    const qty       = parseNumber(lot.qty);
    const pct       = qty > 0 ? Math.min(100, Math.round(cum / qty * 100)) : 0;
    const pbColor   = pct >= 80 ? '#EF9F27' : '#378ADD';
    const pctColor  = pct >= 80 ? '#BA7517' : '#185FA5';
    const statusTxt = pct >= 80 ? '거의 완료' : pct > 0 ? '작업 중' : '작업 시작';

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
              <span style="font-family:var(--font-mono);font-size:11px">${lot.lotNo || lot.id}</span>
              ${_coBadge(lot.country)}
            </div>
            ${renderBizTag(lot.biz)}
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:600;color:${pctColor}">${pct > 0 ? pct + '%' : '—'}</div>
            <div style="font-size:11px;color:var(--tx3)">in progress</div>
          </div>
        </div>
        <div style="height:6px;background:var(--bd);border-radius:3px;overflow:hidden;margin-bottom:4px">
          <div style="height:100%;width:${pct || 1}%;background:${pbColor};border-radius:3px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:11px;color:${pctColor}">${statusTxt}</span>
          <span style="font-size:11px;color:var(--tx3);font-family:var(--font-mono)">${formatNumber(cum)} / ${formatNumber(qty)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--bg);border-radius:6px;padding:8px 10px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Inbound date</div>
            <div style="font-size:14px;font-weight:600">${lot.inDate || '—'}</div>
          </div>
          <div style="background:var(--bg);border-radius:6px;padding:8px 10px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Inbound qty</div>
            <div style="font-size:14px;font-weight:600">${formatNumber(qty)}</div>
          </div>
        </div>
      </div>`;
  }

  function _renderCompletedTable(doneLots, invoices, totalRev) {
    if (!doneLots.length) return '';
    const rows = doneLots
      .sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')))
      .map((lot, i) => {
        const inv = invoices.find(r => String(r.lotId) === String(lot.id) || r.lotNo === lot.lotNo);
        const rev = inv ? parseNumber(inv.total || inv.amount) : 0;
        const tat = (lot.inDate && lot.actualDone) ? diffDays(lot.inDate, lot.actualDone) + ' days' : '—';
        return `
          <tr style="${i % 2 === 0 ? '' : 'background:var(--bg)'}">
            <td style="padding:8px 10px;font-family:var(--font-mono);font-size:11px">${lot.lotNo || lot.id}</td>
            <td style="padding:8px 10px">${_coBadge(lot.country)}</td>
            <td style="padding:8px 10px">${renderBizTag(lot.biz)}</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono)">${formatNumber(parseNumber(lot.qty))}</td>
            <td style="padding:8px 10px;font-size:11px;color:var(--tx2)">${lot.inDate || '—'}</td>
            <td style="padding:8px 10px;font-size:11px;color:var(--tx2)">${lot.actualDone || '—'}</td>
            <td style="padding:8px 10px;font-size:11px;color:var(--tx2)">${tat}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;font-family:var(--font-mono);color:${rev > 0 ? '#0F6E56' : 'var(--tx3)'}">${rev > 0 ? '$' + formatNumber(rev) : '—'}</td>
          </tr>`;
      }).join('');

    const TH = (label, align = 'left') =>
      `<th style="padding:8px 10px;text-align:${align};font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;background:var(--bg);border-bottom:1px solid var(--bd);white-space:nowrap">${label}</th>`;

    return `
      <div class="sec-label">Completed job orders</div>
      <div class="etw" style="margin-bottom:14px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            ${TH('Job Order')}${TH('Region')}${TH('Category')}${TH('Qty','right')}
            ${TH('Inbound')}${TH('Outbound')}${TH('TAT')}${TH('Revenue','right')}
          </tr></thead>
          <tbody>
            ${rows}
            <tr style="border-top:1px solid var(--bd2)">
              <td colspan="3" style="padding:10px;font-size:12px;color:var(--tx2);font-weight:600">Total</td>
              <td style="padding:10px;text-align:right;font-family:var(--font-mono);font-weight:600">${formatNumber(doneLots.reduce((s, l) => s + parseNumber(l.qty), 0))}</td>
              <td colspan="3"></td>
              <td style="padding:10px;text-align:right;font-family:var(--font-mono);font-weight:600;color:#0F6E56">${totalRev > 0 ? '$' + formatNumber(totalRev) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  return {
    render() {
      const dtEl = document.getElementById('opsdash-dt');
      if (dtEl) dtEl.textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      const lots      = Store.getLots();
      const dailies   = Store.getDailies();
      const invoices  = Store.getInvoices();
      const doneLots  = lots.filter(l => getLotStatus(l) === 'done');
      const activeLots = lots.filter(l => getLotStatus(l) !== 'done');

      const totalRev  = invoices.reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      const ssdRev    = invoices.filter(r => r.biz === 'SSD').reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      const dramRev   = invoices.filter(r => r.biz === 'DRAM' || r.biz === 'MID').reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      const totalUnits = lots.reduce((s, l) => s + parseNumber(l.qty), 0);
      const ssdUnits  = lots.filter(l => l.biz === 'SSD').reduce((s, l) => s + parseNumber(l.qty), 0);
      const dramUnits = lots.filter(l => l.biz === 'DRAM' || l.biz === 'MID').reduce((s, l) => s + parseNumber(l.qty), 0);

      const activeHtml = activeLots.length === 0 ? '' : `
        <div class="sec-label">Active job orders</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(activeLots.length, 3)},minmax(0,1fr));gap:12px;margin-bottom:12px">
          ${activeLots.map(lot => _renderActiveCard(lot, dailies)).join('')}
        </div>`;

      document.getElementById('opsdash-body').innerHTML =
        _renderKpi(lots, activeLots, doneLots, totalUnits, ssdUnits, dramUnits, totalRev) +
        _renderRevenueUnits(ssdRev, dramRev, totalRev, lots, dailies, totalUnits) +
        activeHtml +
        _renderCompletedTable(doneLots, invoices, totalRev);
    },
  };

})();
