/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 표 형식 + 달성 현황
 */

Pages.KpiTarget = (() => {

  let _selectedYear = new Date().getFullYear();

  function _getActual(year, biz) {
    return Store.getInvoices()
      .filter(r => r.biz === biz && String(r.date || '').startsWith(String(year)))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  function _getTarget(year, biz) {
    return parseNumber(Store.getTargetFor(year, biz)?.target || 0);
  }

  async function save(year, biz, rawValue) {
    const amount   = parseNumber(rawValue);
    const existing = Store.getTargetFor(year, biz);
    const record   = { id: existing ? existing.id : (Date.now() + Math.random()), year: String(year), biz, target: amount };
    Store.upsertTarget(record);
    if (existing) await Api.update(CONFIG.SHEETS.TARGETS, existing.id, record);
    else          await Api.append(CONFIG.SHEETS.TARGETS, record);
    UI.toast('목표 저장됨');
    render();
    if (Nav.current() === 'dash') Pages.Dashboard.render();
  }

  function render() {
    const el = document.getElementById('kpitarget-body'); if (!el) return;
    const year = _selectedYear;

    const bizRows = CONFIG.BIZ_LIST.map(b => {
      const tgt    = _getTarget(year, b);
      const act    = _getActual(year, b);
      const pct    = tgt > 0 ? Math.min(100, Math.round(act / tgt * 100)) : 0;
      const rem    = Math.max(0, tgt - act);
      const color  = CONFIG.BIZ_COLORS[b];
      const barClr = pct >= 100 ? '#1D9E75' : pct >= 70 ? color : '#EF9F27';
      return `
        <tr style="border-bottom:0.5px solid var(--bd)">
          <td style="padding:12px 14px">
            <span style="font-size:13px;font-weight:500;color:${color}">${CONFIG.BIZ_LABELS[b]}</span>
          </td>
          <td style="padding:12px 14px">
            <div style="display:flex;gap:6px;align-items:center">
              <input type="number" id="kpi-input-${b}" value="${tgt || ''}" placeholder="0" min="0" step="1000"
                style="width:130px;padding:6px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--bg);color:var(--tx)">
              <button class="btn pri sm" onclick="Pages.KpiTarget.save(${year},'${b}',document.getElementById('kpi-input-${b}').value)">저장</button>
            </div>
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:13px">
            ${act > 0 ? '$' + formatNumber(Math.round(act)) : '—'}
          </td>
          <td style="padding:12px 14px;min-width:140px">
            ${tgt > 0 ? `
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                  <div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div>
                </div>
                <span style="font-size:12px;font-weight:600;color:${barClr};min-width:32px;text-align:right">${pct}%</span>
              </div>` : '<span style="font-size:12px;color:var(--tx3)">목표 미설정</span>'}
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;color:${rem > 0 ? '#BA7517' : 'var(--tx3)'}">
            ${tgt > 0 ? '$' + formatNumber(Math.round(rem)) : '—'}
          </td>
        </tr>`;
    }).join('');

    // 전체 합계 행
    const totalTgt = CONFIG.BIZ_LIST.reduce((s, b) => s + _getTarget(year, b), 0);
    const totalAct = CONFIG.BIZ_LIST.reduce((s, b) => s + _getActual(year, b), 0);
    const totalPct = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
    const totalRem = Math.max(0, totalTgt - totalAct);
    const totalBarClr = totalPct >= 100 ? '#1D9E75' : totalPct >= 70 ? 'var(--navy)' : '#EF9F27';

    const yearTabs = [year - 1, year, year + 1].map(y => {
      const active = y === _selectedYear;
      return `<button onclick="Pages.KpiTarget.selectYear(${y})"
        style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;
        ${active ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : 'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
    }).join('');

    el.innerHTML = `
      <div style="max-width:860px">
        <div style="display:flex;gap:6px;margin-bottom:16px">${yearTabs}</div>

        ${totalTgt > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">연간 목표</div>
            <div style="font-size:20px;font-weight:600">$${formatNumber(Math.round(totalTgt))}</div>
          </div>
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">누적 달성</div>
            <div style="font-size:20px;font-weight:600;color:#085041">$${formatNumber(Math.round(totalAct))}</div>
          </div>
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">전체 달성률</div>
            <div style="font-size:20px;font-weight:600;color:${totalBarClr}">${totalPct}%</div>
          </div>
        </div>` : ''}

        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg)">
                <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">사업</th>
                <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">목표 매출 (USD)</th>
                <th style="padding:9px 14px;text-align:right;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">누적 실적</th>
                <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd);min-width:140px">달성률</th>
                <th style="padding:9px 14px;text-align:right;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:0.5px solid var(--bd)">잔여</th>
              </tr>
            </thead>
            <tbody>${bizRows}</tbody>
            ${totalTgt > 0 ? `
            <tfoot>
              <tr style="background:var(--bg)">
                <td style="padding:10px 14px;font-size:12px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
                <td style="padding:10px 14px;font-family:var(--font-mono);font-size:13px;font-weight:600;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalTgt))}</td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:#085041;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalAct))}</td>
                <td style="padding:10px 14px;border-top:0.5px solid var(--bd)">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                      <div style="height:100%;border-radius:3px;background:${totalBarClr};width:${totalPct}%"></div>
                    </div>
                    <span style="font-size:12px;font-weight:600;color:${totalBarClr};min-width:32px;text-align:right">${totalPct}%</span>
                  </div>
                </td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:${totalRem > 0 ? '#BA7517' : 'var(--tx3)'};border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalRem))}</td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>`;
  }

  function render_internal() { Pages.KpiTarget.render(); }

  return {
    selectYear(year) { _selectedYear = year; render_internal(); },
    save,
    render() {
      const el = document.getElementById('kpitarget-body'); if (!el) return;
      _selectedYear = _selectedYear || new Date().getFullYear();
      render();
    },
  };

  function render() { Pages.KpiTarget.render(); }

})();
