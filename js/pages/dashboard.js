/**
 * pages/dashboard.js
 * 메인 대시보드 페이지
 *
 * 섹션:
 *   1. KPI 계산
 *   2. 알림 (지연 / D-3 이내)
 *   3. Overview KPI 카드
 *   4. Revenue by business 바
 *   5. Units by category 바
 *   6. Active Job Orders 카드
 *   7. Completed Job Orders 테이블
 *   8. 입고 예정
 *   9. KPI 목표 달성 현황
 */

Pages.Dashboard = (() => {

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

    // 인보이스가 있으면 인보이스 기준, 없으면 LOT 단가×수량
    const invTotal = invoices.reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
    const useInv   = invTotal > 0;

    function revByBiz(biz) {
      if (useInv) return invoices.filter(r => r.biz === biz).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      return doneLots.filter(l => l.biz === biz).reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0);
    }

    const revenue = {
      total: useInv ? invTotal : doneLots.reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0),
      SSD:  revByBiz('SSD'),
      DRAM: revByBiz('DRAM'),
      MID:  revByBiz('MID'),
    };

    function unitsByBiz(biz) {
      return {
        qty:  lots.filter(l => l.biz === biz).reduce((s, l) => s + parseNumber(l.qty), 0),
        proc: lots.filter(l => l.biz === biz).reduce((s, l) => s + getLotCumulative(l.id, dailies), 0),
      };
    }

    const units = { SSD: unitsByBiz('SSD'), DRAM: unitsByBiz('DRAM'), MID: unitsByBiz('MID') };

    const overdueLots = activeLots.filter(l => getLotStatus(l) === 'overdue');
    const nearDueLots = activeLots.filter(l =>
      l.targetDate && diffDays(today(), l.targetDate) >= 0 && diffDays(today(), l.targetDate) <= 3
    );

    const upcomingShipments = [...shipments]
      .filter(s => s.expectedDate >= today())
      .sort((a, b) => String(a.expectedDate || '').localeCompare(String(b.expectedDate || '')));

    return { lots, dailies, invoices, activeLots, doneLots, totalUnits, totalProc, revenue, units, overdueLots, nearDueLots, upcomingShipments };
  }

  // ── 2. 알림 섹션 ────────────────────────────────────────────

  function _renderAlerts(overdueLots, nearDueLots) {
    const alerts = [];
    if (overdueLots.length > 0) {
      alerts.push(`<div class="alert al-bad">지연 LOT ${overdueLots.length}건 — ${overdueLots.map(l => l.lotNo || l.id).join(', ')}</div>`);
    }
    if (nearDueLots.length > 0) {
      alerts.push(`<div class="alert al-warn">완료 기한 3일 이내 LOT ${nearDueLots.length}건</div>`);
    }
    return alerts.join('');
  }

  // ── 3. Overview KPI 카드 ────────────────────────────────────

  function _renderKpiCards({ lots, activeLots, doneLots, totalUnits, totalProc, revenue, overdueLots }) {
    return `
      <div class="sec-label">Overview</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:1.5rem">
        <div style="background:var(--bg);border-radius:var(--rs);padding:14px 16px">
          <div style="font-size:11px;color:var(--tx2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Total Job Orders</div>
          <div style="font-size:22px;font-weight:600;line-height:1">${lots.length}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:5px">진행 ${activeLots.length}건 · 완료 ${doneLots.length}건</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:14px 16px">
          <div style="font-size:11px;color:var(--tx2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Total Units</div>
          <div style="font-size:22px;font-weight:600;line-height:1">${formatNumber(totalUnits)}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:5px">처리 ${formatNumber(totalProc)} · 잔량 ${formatNumber(Math.max(0, totalUnits - totalProc))}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:14px 16px">
          <div style="font-size:11px;color:var(--tx2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Total Revenue</div>
          <div style="font-size:22px;font-weight:600;line-height:1;color:#0F6E56">${revenue.total > 0 ? '$' + formatNumber(revenue.total) : '—'}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:5px">완료 기준</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:14px 16px">
          <div style="font-size:11px;color:var(--tx2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Active Orders</div>
          <div style="font-size:22px;font-weight:600;line-height:1;color:#185FA5">${activeLots.length}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:5px">${overdueLots.length > 0 ? '지연 ' + overdueLots.length + '건 포함' : '지연 없음'}</div>
        </div>
      </div>`;
  }

  // ── 4 & 5. Revenue / Units 바 카드 ──────────────────────────

  function _renderBusinessCards({ revenue, units, totalProc, totalUnits }) {
    const BIZ_DOTS  = { SSD: '#378ADD', DRAM: '#888780', MID: '#7F77DD' };

    // Revenue bars
    const revItems = CONFIG.BIZ_LIST
      .map(b => ({ label: CONFIG.BIZ_LABELS[b], val: revenue[b], dot: BIZ_DOTS[b] }))
      .filter(x => x.val > 0);
    const maxRev = Math.max(...revItems.map(x => x.val), 1);

    const revBars = revItems.map(x => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:12px;color:var(--tx2);display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${x.dot};display:inline-block;flex-shrink:0"></span>${x.label}
          </div>
          <div style="font-size:12px;font-weight:500;color:var(--tx)">$${formatNumber(x.val)}</div>
        </div>
        <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:${x.dot};width:${Math.round(x.val / maxRev * 100)}%"></div>
        </div>
      </div>`).join('');

    // Units bars
    const unitBars = CONFIG.BIZ_LIST
      .filter(b => units[b].qty > 0)
      .map(b => {
        const pct = Math.round(units[b].proc / units[b].qty * 100);
        return `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:12px;color:var(--tx2);display:flex;align-items:center;gap:6px">
                <span style="width:8px;height:8px;border-radius:50%;background:${BIZ_DOTS[b]};display:inline-block;flex-shrink:0"></span>${CONFIG.BIZ_LABELS[b]}
              </div>
              <div style="font-size:12px;font-weight:500;color:var(--tx)">${formatNumber(units[b].proc)} <span style="color:var(--tx3);font-weight:400">/ ${formatNumber(units[b].qty)}</span></div>
            </div>
            <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden">
              <div style="height:100%;border-radius:3px;background:${BIZ_DOTS[b]};width:${pct}%"></div>
            </div>
          </div>`;
      }).join('');

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:16px 18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600">Revenue by business</div>
            <div style="font-size:11px;color:var(--tx3)">Service fee (USD)</div>
          </div>
          ${revBars || '<div style="font-size:13px;color:var(--tx3);text-align:center;padding:16px 0">데이터 없음</div>'}
          ${revItems.length > 0 ? `
            <div style="height:0.5px;background:var(--bd);margin:10px 0"></div>
            <div style="display:flex;justify-content:space-between;font-size:13px">
              <span style="color:var(--tx2)">Total</span>
              <span style="font-weight:600;color:#0F6E56">$${formatNumber(revenue.total)}</span>
            </div>` : ''}
        </div>
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:16px 18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-size:13px;font-weight:600">Units by category</div>
            <div style="font-size:11px;color:var(--tx3)">처리 / 입고 수량</div>
          </div>
          ${unitBars || '<div style="font-size:13px;color:var(--tx3);text-align:center;padding:16px 0">데이터 없음</div>'}
          <div style="height:0.5px;background:var(--bd);margin:10px 0"></div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:var(--tx2)">Total</span>
            <span style="font-weight:600">${formatNumber(totalProc)} <span style="color:var(--tx3);font-weight:400">/ ${formatNumber(totalUnits)}</span></span>
          </div>
        </div>
      </div>`;
  }

  // ── 6. Active Job Order 단일 카드 ───────────────────────────

  function _renderActiveLotCard(lot, dailies) {
    const cum    = getLotCumulative(lot.id, dailies);
    const qty    = parseNumber(lot.qty);
    const pct    = qty > 0 ? Math.min(100, Math.round(cum / qty * 100)) : 0;
    const status = getLotStatus(lot);

    const pctColor  = status === 'overdue' ? '#A32D2D' : pct >= 80 ? '#BA7517' : '#185FA5';
    const barColor  = status === 'overdue' ? '#E24B4A' : pct >= 80 ? '#EF9F27' : '#378ADD';

    const statusBadge = status === 'overdue'
      ? '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#FCEBEB;color:#A32D2D">지연</span>'
      : pct >= 80
        ? '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#FAEEDA;color:#854F0B">거의 완료</span>'
        : '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#E6F1FB;color:#185FA5">진행중</span>';

    const coBadge = lot.country === 'HK'
      ? '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#FAEEDA;color:#854F0B">HK</span>'
      : '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#E1F5EE;color:#0F6E56">SG</span>';

    const bizBadge = lot.biz === 'DRAM'
      ? '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#F1EFE8;color:#444441">DRAM Test</span>'
      : lot.biz === 'SSD'
        ? '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#E6F1FB;color:#185FA5">SSD Test</span>'
        : '<span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:#EEEDFE;color:#534AB7">Mobile Ink Die</span>';

    return `
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:12px;padding:14px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
              <span style="font-size:12px;font-weight:600;font-family:var(--font-mono)">${lot.lotNo || lot.id}</span>
              ${coBadge}
            </div>
            <div style="display:flex;gap:4px">${bizBadge} ${statusBadge}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:600;color:${pctColor};line-height:1">${pct}%</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:2px">진행률</div>
          </div>
        </div>
        <div style="height:5px;background:var(--bg);border-radius:3px;overflow:hidden;margin-bottom:5px">
          <div style="height:100%;border-radius:3px;background:${barColor};width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:11px;color:var(--tx3);font-family:var(--font-mono)">${formatNumber(cum)} / ${formatNumber(qty)}</span>
          <span style="font-size:11px;color:var(--tx3)">잔량 ${formatNumber(Math.max(0, qty - cum))}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--bg);border-radius:6px;padding:7px 10px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Inbound</div>
            <div style="font-size:13px;font-weight:500">${lot.inDate || '—'}</div>
          </div>
          <div style="background:var(--bg);border-radius:6px;padding:7px 10px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Inbound qty</div>
            <div style="font-size:13px;font-weight:500">${formatNumber(qty)}</div>
          </div>
        </div>
        ${lot.customerName ? `<div style="font-size:11px;color:var(--tx3);margin-top:8px">${lot.customerName}</div>` : ''}
      </div>`;
  }

  // ── 7. Completed Job Orders 테이블 행 ───────────────────────

  function _renderCompletedRow(lot, dailies, invoices) {
    const inv = invoices.find(r => String(r.lotId) === String(lot.id));
    const rev = inv
      ? parseNumber(inv.total || inv.amount)
      : parseNumber(lot.price) * parseNumber(lot.qty);
    const tat = (lot.inDate && lot.actualDone) ? diffDays(lot.inDate, lot.actualDone) + ' days' : '—';

    const coBadge = lot.country === 'HK'
      ? '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#FAEEDA;color:#854F0B">HK</span>'
      : '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#E1F5EE;color:#0F6E56">SG</span>';
    const bizBadge = lot.biz === 'DRAM'
      ? '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#F1EFE8;color:#444441">DRAM</span>'
      : lot.biz === 'SSD'
        ? '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#E6F1FB;color:#185FA5">SSD</span>'
        : '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#EEEDFE;color:#534AB7">MID</span>';

    return `
      <tr>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd);font-family:var(--font-mono);font-size:11px">${lot.lotNo || lot.id}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd)">${coBadge}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd)">${bizBadge}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums">${formatNumber(parseNumber(lot.qty))}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd);font-size:11px;color:var(--tx2)">${lot.inDate || '—'}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd);font-size:11px;color:var(--tx2)">${lot.actualDone || '—'}</td>
        <td style="padding:9px 8px 9px 0;border-bottom:0.5px solid var(--bd);font-size:11px;color:var(--tx3)">${tat}</td>
        <td style="padding:9px 0 9px 0;border-bottom:0.5px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums">${rev > 0 ? '$' + formatNumber(rev) : '—'}</td>
      </tr>`;
  }

  // ── 8. 입고 예정 섹션 ───────────────────────────────────────

  function _renderShipments(shipments) {
    if (shipments.length === 0) return '';
    return `
      <div class="sec-label" style="margin-top:28px">입고 예정</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
        ${shipments.map(s => {
          const dd      = s.expectedDate ? diffDays(today(), s.expectedDate) : null;
          const ddText  = dd === null ? '—' : dd === 0 ? 'D-Day' : 'D-' + dd;
          const ddColor = dd === null ? 'var(--tx3)' : dd <= 3 ? '#B45309' : 'var(--tx2)';
          const coBadge = s.country === 'HK'
            ? '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#FAEEDA;color:#854F0B">HK</span>'
            : '<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:#E1F5EE;color:#0F6E56">SG</span>';
          const stBg    = s.status === 'confirmed' ? '#E6F1FB' : '#FAEEDA';
          const stColor = s.status === 'confirmed' ? '#185FA5' : '#854F0B';
          return `
            <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
                  <span style="font-size:12px;font-weight:600;font-family:var(--font-mono)">${s.lotNo || '—'}</span>
                  ${coBadge}
                  <span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:${stBg};color:${stColor}">${s.status === 'confirmed' ? '확정' : '미확정'}</span>
                </div>
                <div style="font-size:12px;color:var(--tx2)">${s.customerName || ''}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:16px;font-weight:600">${formatNumber(parseNumber(s.qty))}<span style="font-size:11px;font-weight:400;color:var(--tx3)"> ${s.unit || '개'}</span></div>
                <div style="font-size:12px;font-weight:500;color:${ddColor}">${ddText} · ${s.expectedDate || ''}</div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── 9. KPI 목표 달성 현황 ───────────────────────────────────

  function _renderKpiSection() {
    const year   = new Date().getFullYear();
    const hasTgt = CONFIG.BIZ_LIST.some(b => (Store.getTargetFor(year, b)?.target || 0) > 0);

    if (!hasTgt) {
      return `
        <div style="margin-top:20px;padding:14px 18px;background:var(--bg);border-radius:var(--r);border:1px dashed var(--bd2);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--tx2)">${year}년 KPI 목표가 설정되지 않았습니다</span>
          <button class="btn sm" onclick="Nav.go('kpitarget')">목표 설정하기 →</button>
        </div>`;
    }

    const invoices = Store.getInvoices();
    const totalTgt = CONFIG.BIZ_LIST.reduce((s, b) => s + (Store.getTargetFor(year, b)?.target || 0), 0);
    const totalAct = CONFIG.BIZ_LIST.reduce((s, b) =>
      s + invoices.filter(r => r.biz === b && String(r.date || '').startsWith(String(year))).reduce((t, r) => t + parseNumber(r.total || r.amount), 0), 0);
    const totalPct   = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
    const totalRem   = Math.max(0, totalTgt - totalAct);
    const totalColor = totalPct >= 100 ? '#16a34a' : totalPct >= 70 ? '#0F6E56' : '#f59e0b';

    const bizCards = CONFIG.BIZ_LIST.map(b => {
      const tgt = Store.getTargetFor(year, b)?.target || 0;
      if (!tgt) return '';
      const act    = invoices.filter(r => r.biz === b && String(r.date || '').startsWith(String(year))).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      const pct    = Math.min(100, Math.round(act / tgt * 100));
      const remain = Math.max(0, tgt - act);
      const color  = CONFIG.BIZ_COLORS[b];
      const barClr = pct >= 100 ? '#16a34a' : pct >= 70 ? color : '#f59e0b';

      return `
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:14px 16px;border-top:3px solid ${color}">
          <div style="font-size:12px;font-weight:600;color:${color};margin-bottom:10px">${CONFIG.BIZ_LABELS[b]}</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
            <span style="font-size:11px;color:var(--tx2)">달성률</span>
            <span style="font-size:20px;font-weight:600;color:${barClr}">${pct}%</span>
          </div>
          <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-bottom:10px">
            <div style="height:100%;width:${pct}%;background:${barClr};border-radius:3px"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div style="background:var(--bg);border-radius:6px;padding:7px 9px">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">달성</div>
              <div style="font-size:13px;font-weight:600;color:${color}">$${formatNumberShort(act)}</div>
            </div>
            <div style="background:var(--bg);border-radius:6px;padding:7px 9px">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">잔여</div>
              <div style="font-size:13px;font-weight:600;color:${remain > 0 ? '#92400e' : '#166534'}">$${formatNumberShort(remain)}</div>
            </div>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--tx3)">목표 $${formatNumberShort(tgt)}</div>
        </div>`;
    }).filter(Boolean).join('');

    return `
      <div class="sec-label" style="margin-top:24px">${year}년 KPI 목표 달성 현황</div>
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:16px 18px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:13px;font-weight:600">전체 매출 목표</div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-size:26px;font-weight:600;color:${totalColor}">${totalPct}%</span>
            <span style="font-size:12px;color:var(--tx2)">달성</span>
          </div>
        </div>
        <div style="height:10px;background:var(--bg);border-radius:5px;overflow:hidden;margin-bottom:12px">
          <div style="height:100%;width:${totalPct}%;background:${totalColor};border-radius:5px;transition:width .5s"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div style="background:var(--bg);border-radius:6px;padding:10px 12px;text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">연간 목표</div>
            <div style="font-size:16px;font-weight:600">$${formatNumberShort(totalTgt)}</div>
          </div>
          <div style="background:var(--bg);border-radius:6px;padding:10px 12px;text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">누적 달성</div>
            <div style="font-size:16px;font-weight:600;color:#0F6E56">$${formatNumberShort(totalAct)}</div>
          </div>
          <div style="background:var(--bg);border-radius:6px;padding:10px 12px;text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">잔여 목표</div>
            <div style="font-size:16px;font-weight:600;color:${totalRem > 0 ? '#92400e' : '#166534'}">$${formatNumberShort(totalRem)}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px">${bizCards}</div>`;
  }

  // ── Public ──────────────────────────────────────────────────
  return {
    render() {
      const el = document.getElementById('dash-root');
      if (!el) return;

      const kpi   = _calcKpi();
      const dtStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      const completedRows = kpi.doneLots
        .sort((a, b) => String(b.actualDone || b.inDate || '').localeCompare(String(a.actualDone || a.inDate || '')))
        .map(lot => _renderCompletedRow(lot, kpi.dailies, kpi.invoices))
        .join('');

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.5rem">
          <div>
            <div style="font-size:18px;font-weight:600;letter-spacing:-.02em">Operations Dashboard</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:3px">${dtStr}</div>
          </div>
        </div>

        ${_renderAlerts(kpi.overdueLots, kpi.nearDueLots)}
        ${_renderKpiCards(kpi)}
        ${_renderBusinessCards(kpi)}

        ${kpi.activeLots.length > 0 ? `
          <div class="sec-label" style="margin-top:6px">Active Job Orders</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:12px">
            ${kpi.activeLots.map(lot => _renderActiveLotCard(lot, kpi.dailies)).join('')}
          </div>` : ''}

        ${kpi.doneLots.length > 0 ? `
          <div class="sec-label" style="margin-top:6px">Completed Job Orders</div>
          <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead>
                <tr style="background:var(--bg)">
                  <th style="padding:8px 8px 8px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd);white-space:nowrap">Job Order</th>
                  <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Region</th>
                  <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Category</th>
                  <th style="padding:8px;text-align:right;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Qty</th>
                  <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Inbound</th>
                  <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Outbound</th>
                  <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">TAT</th>
                  <th style="padding:8px 16px 8px 8px;text-align:right;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;border-bottom:0.5px solid var(--bd)">Revenue</th>
                </tr>
              </thead>
              <tbody>${completedRows}</tbody>
            </table>
          </div>` : ''}

        ${_renderShipments(kpi.upcomingShipments)}
        ${_renderKpiSection()}
      `;
    },
  };

})();
