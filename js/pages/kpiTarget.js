/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 표 형식 + 달성 현황
 */

Pages.KpiTarget = (() => {

  let _year = new Date().getFullYear();

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
    Pages.KpiTarget.render();
    if (Nav.current() === 'dash') Pages.Dashboard.render();
  }

  function selectYear(year) {
    _year = year;
    Pages.KpiTarget.render();
  }

  return {
    save,
    selectYear,

    render() {
      const el = document.getElementById('kpitarget-body'); if (!el) return;
      const year = _year;

      const bizRows = CONFIG.BIZ_LIST.map(b => {
        const tgt    = _getTarget(year, b);
        const act    = _getActual(year, b);
        const pct    = tgt > 0 ? Math.min(100, Math.round(act / tgt * 100)) : 0;
        const rem    = Math.max(0, tgt - act);
        const color  = CONFIG.BIZ_COLORS[b];
        const barClr = pct >= 100 ? '#1D9E75' : pct >= 70 ? color : '#EF9F27';

        const progCell = tgt > 0
          ? `<div style="display:flex;align-items:center;gap:8px">
               <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                 <div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div>
               </div>
               <span style="font-size:14px;font-weight:600;color:${barClr};min-width:32px;text-align:right">${pct}%</span>
             </div>`
          : '<span style="font-size:14px;color:var(--tx3)">목표 미설정</span>';

        // 입력된 경우 → 값 표시 + 수정 버튼 / 미입력 → 바로 입력 셀 + 저장
        const tgtCell = tgt > 0
          ? `<span style="font-family:var(--font-mono);font-size:14px;font-weight:600">$${formatNumber(Math.round(tgt))}</span>`
          : `<div style="display:flex;align-items:center;gap:6px">
               <input type="number" id="kpi-input-${b}" placeholder="목표 입력" min="0" step="1000"
                 style="width:130px;padding:6px 10px;border:1.5px solid #B5D4F4;border-radius:6px;font-size:15px;background:#EAF3FE;color:#0C447C;text-align:right">
               <button class="btn pri sm" onclick="Pages.KpiTarget.save(${year},'${b}',document.getElementById('kpi-input-${b}').value)">저장</button>
             </div>`;

        const actionCell = tgt > 0
          ? `<button onclick="Pages.KpiTarget.startEdit(${year},'${b}',${tgt})"
               style="padding:4px 12px;border:0.5px solid var(--bd2);border-radius:5px;background:none;color:var(--tx2);font-size:14px;cursor:pointer">수정</button>`
          : '';

        return `
          <tr id="kpi-row-${b}" style="border-bottom:0.5px solid var(--bd)">
            <td style="padding:12px 14px"><span style="font-size:14px;font-weight:500;color:${color}">${CONFIG.BIZ_LABELS[b]}</span></td>
            <td style="padding:12px 14px" id="kpi-tgt-cell-${b}">${tgtCell}</td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;color:#085041">
              ${act > 0 ? '$' + formatNumber(Math.round(act)) : '—'}
            </td>
            <td style="padding:12px 14px;min-width:160px">${progCell}</td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;color:${rem > 0 ? '#BA7517' : 'var(--tx3)'}">
              ${tgt > 0 ? '$' + formatNumber(Math.round(rem)) : '—'}
            </td>
            <td style="padding:12px 14px;width:100px" id="kpi-act-cell-${b}">${actionCell}</td>
          </tr>`;
      }).join('');

      const totalTgt  = CONFIG.BIZ_LIST.reduce((s, b) => s + _getTarget(year, b), 0);
      const totalAct  = CONFIG.BIZ_LIST.reduce((s, b) => s + _getActual(year, b), 0);
      const totalPct  = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
      const totalRem  = Math.max(0, totalTgt - totalAct);
      const totalClr  = totalPct >= 100 ? '#1D9E75' : totalPct >= 70 ? 'var(--navy)' : '#EF9F27';

      const yearTabs = [year - 1, year, year + 1].map(y => {
        const active = y === year;
        return `<button onclick="Pages.KpiTarget.selectYear(${y})"
          style="padding:4px 14px;border-radius:20px;font-size:14px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;
          ${active ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : 'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
      }).join('');

      const TH = label => `<th style="padding:9px 14px;text-align:left;font-size:15px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd)">${label}</th>`;
      const THR = label => `<th style="padding:9px 14px;text-align:right;font-size:15px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd)">${label}</th>`;

      el.innerHTML = `
        <div style="max-width:860px">
          <div style="display:flex;gap:6px;margin-bottom:16px">${yearTabs}</div>

          ${totalTgt > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">연간 목표</div>
              <div style="font-size:20px;font-weight:600">$${formatNumber(Math.round(totalTgt))}</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">누적 달성</div>
              <div style="font-size:20px;font-weight:600;color:#085041">$${formatNumber(Math.round(totalAct))}</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">전체 달성률</div>
              <div style="font-size:20px;font-weight:600;color:${totalClr}">${totalPct}%</div>
            </div>
          </div>` : ''}

          <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr>
                ${TH('사업')}${TH('목표 매출 (USD)')}${THR('누적 실적')}
                ${TH('달성률')}${THR('잔여')}${TH('')}
              </tr></thead>
              <tbody>${bizRows}</tbody>
              ${totalTgt > 0 ? `
              <tfoot>
                <tr style="background:var(--bg)">
                  <td style="padding:10px 14px;font-size:14px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
                  <td style="padding:10px 14px;font-family:var(--font-mono);font-size:15px;font-weight:600;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalTgt))}</td>
                  <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:15px;font-weight:600;color:#085041;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalAct))}</td>
                  <td style="padding:10px 14px;border-top:0.5px solid var(--bd)">
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                        <div style="height:100%;border-radius:3px;background:${totalClr};width:${totalPct}%"></div>
                      </div>
                      <span style="font-size:14px;font-weight:600;color:${totalClr};min-width:32px;text-align:right">${totalPct}%</span>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:15px;font-weight:600;color:${totalRem > 0 ? '#BA7517' : 'var(--tx3)'};border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalRem))}</td>
                  <td style="border-top:0.5px solid var(--bd)"></td>
                </tr>
              </tfoot>` : ''}
            </table>
          </div>
        </div>`;
    },

    startEdit(year, biz, currentTgt) {
      const cell    = document.getElementById('kpi-tgt-cell-' + biz);
      const actCell = document.getElementById('kpi-act-cell-' + biz);
      const row     = document.getElementById('kpi-row-' + biz);
      if (!cell) return;
      row.style.background = '#F5F9FF';
      cell.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" id="kpi-input-${biz}" value="${currentTgt}" min="0" step="1000"
            style="width:130px;padding:6px 10px;border:1.5px solid #B5D4F4;border-radius:6px;font-size:15px;background:#EAF3FE;color:#0C447C;text-align:right">
          <button class="btn pri sm" onclick="Pages.KpiTarget.save(${year},'${biz}',document.getElementById('kpi-input-${biz}').value)">저장</button>
          <button onclick="Pages.KpiTarget.render()"
            style="padding:4px 10px;border:0.5px solid var(--bd2);border-radius:5px;background:none;color:var(--tx2);font-size:14px;cursor:pointer">취소</button>
        </div>`;
      actCell.innerHTML = '';
      document.getElementById('kpi-input-' + biz)?.focus();
    },
  };

})();
