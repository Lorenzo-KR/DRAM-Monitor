/**
 * pages/kpiTarget.js
 * KPI 목표 설정 페이지
 *
 * 기능:
 *   - 연도 탭으로 연도 선택
 *   - 사업별 목표 매출액 입력 & 저장
 *   - 목표 대비 실적 달성률 시각화
 */

Pages.KpiTarget = (() => {

  let _selectedYear = new Date().getFullYear();

  // ── 실적 계산 ───────────────────────────────────────────────

  function _getActualRevenue(year, biz) {
    return Store.getInvoices()
      .filter(inv => inv.biz === biz && String(inv.date || '').startsWith(String(year)))
      .reduce((total, inv) => total + parseNumber(inv.total || inv.amount), 0);
  }

  function _getTargetAmount(year, biz) {
    const target = Store.getTargetFor(year, biz);
    return target ? parseNumber(target.target) : 0;
  }

  // ── 저장 ────────────────────────────────────────────────────

  async function save(year, biz, rawValue) {
    const amount = parseNumber(rawValue);
    const existing = Store.getTargetFor(year, biz);
    const record = {
      id:     existing ? existing.id : (Date.now() + Math.random()),
      year:   String(year),
      biz,
      target: amount,
    };

    Store.upsertTarget(record);

    if (existing) {
      await Api.update(CONFIG.SHEETS.TARGETS, existing.id, record);
    } else {
      await Api.append(CONFIG.SHEETS.TARGETS, record);
    }

    UI.toast('목표 저장됨');
    render();

    // 대시보드가 열려 있으면 KPI 섹션 갱신
    if (Nav.current() === 'dash') Pages.Dashboard.render();
  }

  // ── 렌더 ────────────────────────────────────────────────────

  function _renderYearTabs() {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return years.map(year => {
      const isActive = year === _selectedYear;
      const style = isActive
        ? 'background:var(--navy);color:#fff;border-color:var(--navy)'
        : 'background:none;color:var(--tx2);border-color:var(--bd2)';
      return `
        <button onclick="Pages.KpiTarget.selectYear(${year})"
          style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;
                 cursor:pointer;border:1.5px solid;transition:.15s;
                 font-family:'DM Sans',sans-serif;${style}">
          ${year}년
        </button>`;
    }).join('');
  }

  function _renderSummaryCard(year) {
    const bizList = CONFIG.BIZ_LIST;
    const totalTarget = bizList.reduce((s, b) => s + _getTargetAmount(year, b), 0);
    const totalActual = bizList.reduce((s, b) => s + _getActualRevenue(year, b), 0);

    if (totalTarget === 0) return '';

    const pct        = Math.min(100, Math.round(totalActual / totalTarget * 100));
    const remaining  = Math.max(0, totalTarget - totalActual);
    const barColor   = pct >= 100 ? '#16a34a' : pct >= 70 ? 'var(--navy)' : '#f59e0b';

    return `
      <div class="card" style="margin-bottom:16px;border-top:3px solid var(--navy)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:14px;font-weight:600">${year}년 전체 달성 현황</div>
          <div style="font-size:22px;font-weight:600;color:${barColor}">${pct}%</div>
        </div>
        <div style="height:10px;background:var(--bg);border-radius:5px;overflow:hidden;margin-bottom:12px">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:5px;transition:width .4s"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${renderMetricCard('연간 목표',  '$' + formatNumberShort(totalTarget))}
          ${renderMetricCard('누적 달성',  '$' + formatNumberShort(totalActual), '', '#0F6E56')}
          ${renderMetricCard('잔여 목표',  '$' + formatNumberShort(remaining),   '', remaining > 0 ? '#92400e' : '#166534')}
        </div>
      </div>`;
  }

  function _renderBizCard(year, biz) {
    const target    = _getTargetAmount(year, biz);
    const actual    = _getActualRevenue(year, biz);
    const pct       = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
    const remaining = Math.max(0, target - actual);
    const color     = CONFIG.BIZ_COLORS[biz];
    const barColor  = pct >= 100 ? '#16a34a' : pct >= 70 ? color : '#f59e0b';

    return `
      <div class="card" style="border-top:3px solid ${color}">
        <div style="font-size:14px;font-weight:600;color:${color};margin-bottom:14px">
          ${CONFIG.BIZ_LABELS[biz] || biz}
        </div>

        <div class="fld" style="margin-bottom:14px">
          <label>${year}년 목표 매출 (USD)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="kpi-input-${biz}"
              value="${target || ''}" placeholder="0" min="0" step="1000"
              style="flex:1;padding:8px 11px;border:1px solid var(--bd2);border-radius:var(--rs);
                     font-size:13px;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--tx)">
            <button class="btn pri sm"
              onclick="Pages.KpiTarget.save(${year}, '${biz}', document.getElementById('kpi-input-${biz}').value)">
              저장
            </button>
          </div>
        </div>

        ${target > 0 ? `
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
            <span style="font-size:12px;color:var(--tx2)">달성률</span>
            <span style="font-size:20px;font-weight:600;color:${barColor}">${pct}%</span>
          </div>
          <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden;margin-bottom:10px">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .4s"></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <div style="background:var(--bg);border-radius:6px;padding:8px 10px;text-align:center">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">목표</div>
              <div style="font-size:13px;font-weight:600">$${formatNumberShort(target)}</div>
            </div>
            <div style="background:var(--bg);border-radius:6px;padding:8px 10px;text-align:center">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">달성</div>
              <div style="font-size:13px;font-weight:600;color:${color}">$${formatNumberShort(actual)}</div>
            </div>
            <div style="background:var(--bg);border-radius:6px;padding:8px 10px;text-align:center">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">잔여</div>
              <div style="font-size:13px;font-weight:600;color:${remaining > 0 ? '#92400e' : '#166534'}">
                $${formatNumberShort(remaining)}
              </div>
            </div>
          </div>
        ` : `
          <div style="font-size:12px;color:var(--tx3);padding:8px 0">
            목표를 입력하면 달성 현황이 표시됩니다
          </div>
        `}
      </div>`;
  }

  // ── Public ──────────────────────────────────────────────────
  return {

    selectYear(year) {
      _selectedYear = year;
      render();
    },

    save,

    render() {
      const el = document.getElementById('kpitarget-body');
      if (!el) return;

      el.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:20px">
          ${_renderYearTabs()}
        </div>
        ${_renderSummaryCard(_selectedYear)}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          ${CONFIG.BIZ_LIST.map(biz => _renderBizCard(_selectedYear, biz)).join('')}
        </div>`;
    },
  };

  // 내부에서 render 를 save 가 호출하므로 별칭 정의
  function render() { Pages.KpiTarget.render(); }

})();
