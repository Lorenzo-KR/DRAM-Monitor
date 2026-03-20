/**
 * pages/dashboard.js
 * 메인 대시보드 — 컴팩트 표 형식
 *
 * 섹션:
 *   1. KPI 계산
 *   2. 알림
 *   3. KPI 요약 카드 (5개)
 *   4. Revenue + KPI달성 2열 바 차트
 *   5. Active Job Orders 표
 *   6. Completed Job Orders 표
 *   7. 입고 예정
 */

Pages.Dashboard = (() => {

  // ── 공통 스타일 상수 ────────────────────────────────────────
  const S = {
    th:  'padding:7px 10px;text-align:left;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd);white-space:nowrap',
    thr: 'padding:7px 10px;text-align:right;font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd);white-space:nowrap',
    td:  'padding:7px 10px;border-bottom:0.5px solid var(--bd);color:var(--tx);vertical-align:middle',
    tdr: 'padding:7px 10px;border-bottom:0.5px solid var(--bd);color:var(--tx);vertical-align:middle;text-align:right;font-family:var(--font-mono);font-size:11px',
    tdm: 'padding:7px 10px;border-bottom:0.5px solid var(--bd);color:var(--tx3);vertical-align:middle;font-size:11px',
  };

  // ── 배지 헬퍼 ───────────────────────────────────────────────
  const CO_STYLE = {
    HK: 'background:#FAEEDA;color:#633806',
    SG: 'background:#E1F5EE;color:#085041',
  };
  const BIZ_STYLE = {
    DRAM: 'background:#E6F1FB;color:#0C447C',
    SSD:  'background:#E1F5EE;color:#085041',
    MID:  'background:#EEEDFE;color:#3C3489',
  };
  const ST_STYLE = {
    done:    'background:#E1F5EE;color:#085041',
    inprog:  'background:#E6F1FB;color:#0C447C',
    overdue: 'background:#FCEBEB;color:#791F1F',
  };
  const ST_LABEL = { done: '완료', inprog: '진행중', overdue: '지연' };

  function badge(text, style) {
    return `<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:500;padding:1px 6px;border-radius:3px;white-space:nowrap;${style}">${text}</span>`;
  }

  // ── 1. KPI 계산 ─────────────────────────────────────────────
  function _calcKpi() {
    const lots      = Store.getLots();
    const dailies   = Store.getDailies();
    const invoices  = Store.getInvoices();
    const shipments = Store.getShipments();

    const activeLots = lots.filter(l => getLotStatus(l) !== 'done');
    const doneLots   = lots.filter(l => getLotStatus(l) === 'done');
    const totalUnits = lots.reduce((s, l) => s + parseNumber(l.qty), 0);
    const totalProc  = lots.reduce((s, l) => s + getLotCumulative(l.id, dailies), 0);

    const invTotal = invoices.reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
    const useInv   = invTotal > 0;

    function revByBiz(biz) {
      if (useInv) return invoices.filter(r => r.biz === biz).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      return doneLots.filter(l => l.biz === biz).reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0);
    }

    const revenue = {
      total: useInv ? invTotal : doneLots.reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0),
      SSD: revByBiz('SSD'), DRAM: revByBiz('DRAM'), MID: revByBiz('MID'),
    };

    const overdueLots = activeLots.filter(l => getLotStatus(l) === 'overdue');
    const nearDueLots = activeLots.filter(l =>
      l.targetDate && diffDays(today(), l.targetDate) >= 0 && diffDays(today(), l.targetDate) <= 3
    );
    const upcomingShipments = [...shipments]
      .filter(s => s.expectedDate >= today())
      .sort((a, b) => String(a.expectedDate || '').localeCompare(String(b.expectedDate || '')));

    return { lots, dailies, invoices, activeLots, doneLots, totalUnits, totalProc, revenue, overdueLots, nearDueLots, upcomingShipments };
  }

  // ── 2. 알림 ─────────────────────────────────────────────────
  function _renderAlerts(overdueLots, nearDueLots) {
    return [
      overdueLots.length > 0 ? `<div style="background:#FCEBEB;color:#791F1F;border-left:3px solid #E24B4A;padding:7px 12px;border-radius:var(--rs);font-size:12px;margin-bottom:8px">지연 LOT ${overdueLots.length}건 — ${overdueLots.map(l => l.lotNo || l.id).join(', ')}</div>` : '',
      nearDueLots.length > 0 ? `<div style="background:#FAEEDA;color:#633806;border-left:3px solid #EF9F27;padding:7px 12px;border-radius:var(--rs);font-size:12px;margin-bottom:8px">완료 기한 3일 이내 LOT ${nearDueLots.length}건</div>` : '',
    ].join('');
  }

  // ── 3. KPI 카드 (5개 한 줄) ─────────────────────────────────
  function _renderKpiRow(kpi) {
    const year     = new Date().getFullYear();
    const totalTgt = CONFIG.BIZ_LIST.reduce((s, b) => s + (Store.getTargetFor(year, b)?.target || 0), 0);
    const totalAct = CONFIG.BIZ_LIST.reduce((s, b) =>
      s + kpi.invoices.filter(r => r.biz === b && String(r.date || '').startsWith(String(year))).reduce((t, r) => t + parseNumber(r.total || r.amount), 0), 0);
    const kpiPct   = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
    const kpiColor = kpiPct >= 100 ? '#085041' : kpiPct >= 70 ? '#0C447C' : '#BA7517';

    function kpiCard(label, value, sub, color = '') {
      return `<div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:4px">${label}</div>
        <div style="font-size:20px;font-weight:600;line-height:1;${color ? 'color:' + color : ''}">${value}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:3px">${sub}</div>
      </div>`;
    }

    return `
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px">
        ${kpiCard('Job Orders', kpi.lots.length, `진행 ${kpi.activeLots.length} · 완료 ${kpi.doneLots.length}`)}
        ${kpiCard('Total Units', formatNumber(kpi.totalUnits), `처리 ${formatNumber(kpi.totalProc)} · 잔량 ${formatNumber(Math.max(0, kpi.totalUnits - kpi.totalProc))}`)}
        ${kpiCard('Total Revenue', kpi.revenue.total > 0 ? '$' + formatNumber(kpi.revenue.total) : '—', '완료 기준', '#085041')}
        ${kpiCard('Active Orders', kpi.activeLots.length, kpi.overdueLots.length > 0 ? `지연 ${kpi.overdueLots.length}건 포함` : '지연 없음', '#0C447C')}
        ${totalTgt > 0 ? kpiCard('KPI 달성률', kpiPct + '%', `목표 $${formatNumberShort(totalTgt)}`, kpiColor) : kpiCard('KPI 달성률', '—', '목표 미설정')}
      </div>`;
  }

  // ── 4. Revenue + KPI 달성 2열 ───────────────────────────────
  function _renderBarCards(kpi) {
    const BIZ_COLORS_DOT = { SSD: '#185FA5', DRAM: '#888780', MID: '#6A3D7C' };
    const maxRev = Math.max(...CONFIG.BIZ_LIST.map(b => kpi.revenue[b]), 1);

    const revBars = CONFIG.BIZ_LIST.filter(b => kpi.revenue[b] > 0).map(b => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:0.5px solid var(--bd)">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2);min-width:90px">
          <span style="width:7px;height:7px;border-radius:50%;background:${BIZ_COLORS_DOT[b]};flex-shrink:0;display:inline-block"></span>${CONFIG.BIZ_LABELS[b]}
        </div>
        <div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:${BIZ_COLORS_DOT[b]};width:${Math.round(kpi.revenue[b] / maxRev * 100)}%"></div>
        </div>
        <div style="font-size:11px;font-weight:500;min-width:60px;text-align:right">$${formatNumber(kpi.revenue[b])}</div>
      </div>`).join('');

    const year     = new Date().getFullYear();
    const kpiBars  = CONFIG.BIZ_LIST.map(b => {
      const tgt = Store.getTargetFor(year, b)?.target || 0; if (!tgt) return '';
      const act = kpi.invoices.filter(r => r.biz === b && String(r.date || '').startsWith(String(year))).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      const pct = Math.min(100, Math.round(act / tgt * 100));
      const color = CONFIG.BIZ_COLORS[b];
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:0.5px solid var(--bd)">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2);min-width:90px">
            <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>${CONFIG.BIZ_LABELS[b]}
          </div>
          <div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
            <div style="height:100%;border-radius:3px;background:${color};width:${pct}%"></div>
          </div>
          <div style="font-size:11px;font-weight:500;min-width:28px;text-align:right;color:${pct >= 70 ? color : '#BA7517'}">${pct}%</div>
        </div>`;
    }).filter(Boolean).join('');

    function barCard(title, sub, content, footer = '') {
      return `
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg);border-bottom:0.5px solid var(--bd)">
            <span style="font-size:11px;font-weight:500;color:var(--tx)">${title}</span>
            <span style="font-size:11px;color:var(--tx3)">${sub}</span>
          </div>
          ${content}
          ${footer ? `<div style="display:flex;justify-content:space-between;padding:7px 10px;background:var(--bg)">${footer}</div>` : ''}
        </div>`;
    }

    const revTotal = kpi.revenue.total;
    const revFooter = revTotal > 0
      ? `<span style="font-size:11px;font-weight:500;color:var(--tx)">Total</span><span style="font-size:13px;font-weight:600;color:#085041">$${formatNumber(revTotal)}</span>`
      : '';

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        ${barCard('Revenue by business', 'USD', revBars || '<div style="padding:12px 10px;font-size:12px;color:var(--tx3)">데이터 없음</div>', revFooter)}
        ${kpiBars
          ? barCard('KPI 목표 달성', String(year) + '년', kpiBars)
          : barCard('KPI 목표 달성', '', '<div style="padding:12px 10px;font-size:12px;color:var(--tx3)">목표 미설정 — <a href="#" onclick="Nav.go(\'kpitarget\');return false;" style="color:var(--navy)">설정하기</a></div>')}
      </div>`;
  }

  // ── 5. Active Job Orders 표 ─────────────────────────────────
  function _renderActiveTable(activeLots, dailies) {
    if (!activeLots.length) return '';
    const rows = activeLots.map(lot => {
      const cum   = getLotCumulative(lot.id, dailies);
      const qty   = parseNumber(lot.qty);
      const rem   = Math.max(0, qty - cum);
      const pct   = qty > 0 ? Math.min(100, Math.round(cum / qty * 100)) : 0;
      const st    = getLotStatus(lot);
      const dd    = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const pctColor = st === 'overdue' ? '#A32D2D' : pct >= 80 ? '#BA7517' : '#0C447C';
      const barColor = st === 'overdue' ? '#E24B4A' : pct >= 80 ? '#EF9F27' : '#185FA5';
      return `
        <tr>
          <td style="${S.td};font-family:var(--font-mono);font-size:11px;font-weight:500">${lot.lotNo || lot.id}</td>
          <td style="${S.td}">${badge(lot.country, CO_STYLE[lot.country] || '')}</td>
          <td style="${S.td}">${badge(lot.biz, BIZ_STYLE[lot.biz] || '')}</td>
          <td style="${S.tdm}">${lot.customerName || '—'}</td>
          <td style="${S.tdr}">${formatNumber(qty)}</td>
          <td style="${S.tdr};color:${CONFIG.BIZ_COLORS[lot.biz] || 'var(--tx)'}">${formatNumber(cum)}</td>
          <td style="${S.tdr};color:${rem > 0 ? '#BA7517' : 'var(--tx3)'}">${formatNumber(rem)}</td>
          <td style="${S.td};min-width:110px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;height:4px;background:var(--bd);border-radius:2px;overflow:hidden">
                <div style="height:100%;border-radius:2px;background:${barColor};width:${pct}%"></div>
              </div>
              <span style="font-size:11px;font-weight:500;color:${pctColor};min-width:26px;text-align:right">${pct}%</span>
            </div>
          </td>
          <td style="${S.tdm}">${lot.inDate || '—'}</td>
          <td style="${S.tdm};color:${st === 'overdue' ? '#A32D2D' : 'var(--tx3)'}">
            ${lot.targetDate || '—'}${dd !== null ? `<span style="font-size:10px;margin-left:4px;color:${dd < 0 ? '#A32D2D' : dd <= 3 ? '#BA7517' : 'var(--tx3)'}">(${dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd})</span>` : ''}
          </td>
          <td style="${S.td}">${badge(ST_LABEL[st], ST_STYLE[st] || '')}</td>
        </tr>`;
    }).join('');

    return `
      <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);margin-bottom:6px">Active job orders</div>
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto;margin-bottom:12px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${S.th}">LOT 번호</th><th style="${S.th}">지역</th><th style="${S.th}">사업</th><th style="${S.th}">고객사</th>
            <th style="${S.thr}">입고량</th><th style="${S.thr}">처리</th><th style="${S.thr}">잔량</th>
            <th style="${S.th};min-width:110px">진행률</th>
            <th style="${S.th}">입고일</th><th style="${S.th}">목표완료</th><th style="${S.th}">상태</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── 6. Completed Job Orders 표 ──────────────────────────────
  function _renderCompletedTable(doneLots, dailies, invoices) {
    if (!doneLots.length) return '';
    const sorted = [...doneLots].sort((a, b) => String(b.actualDone || b.inDate || '').localeCompare(String(a.actualDone || a.inDate || '')));
    const rows = sorted.map(lot => {
      const inv = invoices.find(r => String(r.lotId) === String(lot.id));
      const rev = inv ? parseNumber(inv.total || inv.amount) : parseNumber(lot.price) * parseNumber(lot.qty);
      const tat = (lot.inDate && lot.actualDone) ? diffDays(lot.inDate, lot.actualDone) + 'd' : '—';
      return `
        <tr>
          <td style="${S.td};font-family:var(--font-mono);font-size:11px;font-weight:500">${lot.lotNo || lot.id}</td>
          <td style="${S.td}">${badge(lot.country, CO_STYLE[lot.country] || '')}</td>
          <td style="${S.td}">${badge(lot.biz, BIZ_STYLE[lot.biz] || '')}</td>
          <td style="${S.tdm}">${lot.customerName || '—'}</td>
          <td style="${S.tdr}">${formatNumber(parseNumber(lot.qty))}</td>
          <td style="${S.tdm}">${lot.inDate || '—'}</td>
          <td style="${S.tdm}">${lot.actualDone || '—'}</td>
          <td style="${S.tdm}">${tat}</td>
          <td style="${S.tdr};color:${rev > 0 ? '#085041' : 'var(--tx3)'}">${rev > 0 ? '$' + formatNumber(rev) : '—'}</td>
        </tr>`;
    }).join('');

    const totalRev = sorted.reduce((s, lot) => {
      const inv = invoices.find(r => String(r.lotId) === String(lot.id));
      return s + (inv ? parseNumber(inv.total || inv.amount) : parseNumber(lot.price) * parseNumber(lot.qty));
    }, 0);

    return `
      <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);margin-bottom:6px">Completed job orders</div>
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto;margin-bottom:12px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${S.th}">LOT 번호</th><th style="${S.th}">지역</th><th style="${S.th}">사업</th><th style="${S.th}">고객사</th>
            <th style="${S.thr}">수량</th><th style="${S.th}">입고일</th><th style="${S.th}">완료일</th>
            <th style="${S.th}">TAT</th><th style="${S.thr}">Revenue</th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr style="background:var(--bg)">
              <td colspan="4" style="padding:7px 10px;font-size:11px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">Total</td>
              <td style="${S.tdr};border-top:0.5px solid var(--bd);font-weight:600">${formatNumber(sorted.reduce((s,l) => s + parseNumber(l.qty), 0))}</td>
              <td colspan="3" style="border-top:0.5px solid var(--bd)"></td>
              <td style="${S.tdr};border-top:0.5px solid var(--bd);font-weight:600;color:#085041">${totalRev > 0 ? '$' + formatNumber(totalRev) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  // ── 7. 입고 예정 ────────────────────────────────────────────
  function _renderShipments(shipments) {
    if (!shipments.length) return '';
    const rows = shipments.map(s => {
      const dd      = s.expectedDate ? diffDays(today(), s.expectedDate) : null;
      const ddText  = dd === null ? '—' : dd === 0 ? 'D-Day' : dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd;
      const ddColor = dd === null ? 'var(--tx3)' : dd <= 3 ? '#BA7517' : 'var(--tx2)';
      return `
        <tr>
          <td style="${S.td};font-family:var(--font-mono);font-size:11px;font-weight:500">${s.lotNo || '—'}</td>
          <td style="${S.td}">${badge(s.country, CO_STYLE[s.country] || '')}</td>
          <td style="${S.td}">${badge(s.biz, BIZ_STYLE[s.biz] || '')}</td>
          <td style="${S.tdm}">${s.customerName || '—'}</td>
          <td style="${S.tdr}">${formatNumber(parseNumber(s.qty))} ${s.unit || '개'}</td>
          <td style="${S.tdm}">${s.expectedDate || '—'}</td>
          <td style="${S.td};font-weight:500;color:${ddColor}">${ddText}</td>
          <td style="${S.td}">${badge(s.status === 'confirmed' ? '확정' : '미확정', s.status === 'confirmed' ? 'background:#E6F1FB;color:#0C447C' : 'background:#FAEEDA;color:#633806')}</td>
        </tr>`;
    }).join('');

    return `
      <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);margin-bottom:6px">입고 예정</div>
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto;margin-bottom:12px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${S.th}">LOT 번호</th><th style="${S.th}">지역</th><th style="${S.th}">사업</th>
            <th style="${S.th}">고객사</th><th style="${S.thr}">예정수량</th>
            <th style="${S.th}">입고예정일</th><th style="${S.th}">D-day</th><th style="${S.th}">상태</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Public ──────────────────────────────────────────────────
  return {
    render() {
      const el = document.getElementById('dash-root');
      if (!el) return;

      const kpi   = _calcKpi();
      const dtStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      el.innerHTML = `
        <div style="max-width:1100px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:16px;font-weight:600;letter-spacing:-.02em">Operations Dashboard</div>
            <div style="font-size:12px;color:var(--tx3)">${dtStr}</div>
          </div>

          ${_renderAlerts(kpi.overdueLots, kpi.nearDueLots)}
          ${_renderKpiRow(kpi)}
          ${_renderBarCards(kpi)}
          ${_renderActiveTable(kpi.activeLots, kpi.dailies)}
          ${_renderCompletedTable(kpi.doneLots, kpi.dailies, kpi.invoices)}
          ${_renderShipments(kpi.upcomingShipments)}
        </div>`;
    },
  };

})();
