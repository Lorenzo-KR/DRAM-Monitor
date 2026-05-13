/**
 * pages/bizHistory.js
 * 사업별 히스토리 — 세로 타임라인 + KPI/처리량/매출 흐름
 *
 * 한 화면에 하나의 사업(BIZ)을 골라:
 *   1) 사업 시작일 / 누적 LOT·처리량 / 현재 KPI 달성률 (상단 요약)
 *   2) 월별 처리량 · 월별 매출 추이 (미니 차트)
 *   3) 세로 타임라인 이벤트 스트림 (입고/완료/청구/수금)
 */

Pages.BizHistory = (() => {

  // ── 상태 ───────────────────────────────────────────────────
  let _biz     = 'DRAM';
  let _country = '';   // '' = 전체
  let _chartProc, _chartRev;

  // ── 이벤트 타입 정의 (색/라벨) ────────────────────────────
  const EVT_STYLE = {
    in:    { color: '#1B4F8A', bg: '#EBF2FB', label: '입고' },
    done:  { color: '#0F6E56', bg: '#E8F5F0', label: '완료' },
    inv:   { color: '#6A3D7C', bg: '#F3EEF8', label: '청구' },
    paid:  { color: '#B45309', bg: '#FEF6E7', label: '수금' },
    ship:  { color: '#6B6762', bg: '#F5F5F7', label: '입고예정' },
  };

  // ── 유틸 ──────────────────────────────────────────────────
  function _ym(dateStr) {
    return (dateStr || '').slice(0, 7);
  }
  function _yearOf(dateStr) {
    return (dateStr || '').slice(0, 4);
  }

  /** 현재 필터에 해당하는 LOT 목록 */
  function _lots() {
    return Store.getLots().filter(l =>
      l.biz === _biz && (!_country || l.country === _country)
    );
  }

  /** 현재 필터에 해당하는 인보이스 목록 */
  function _invoices() {
    return Store.getInvoices().filter(i =>
      i.biz === _biz && (!_country || i.country === _country)
    );
  }

  /** 현재 필터에 해당하는 입고예정 목록 */
  function _shipments() {
    return Store.getShipments().filter(s =>
      s.biz === _biz && (!_country || s.country === _country)
    );
  }

  /** 현재 필터에 해당하는 LOT id 집합 — daily 필터링용 */
  function _lotIdSet() {
    const set = new Set();
    _lots().forEach(l => set.add(String(l.id)));
    return set;
  }

  function _dailies() {
    const ids = _lotIdSet();
    return Store.getDailies().filter(d => ids.has(String(d.lotId)));
  }

  // ── 상단 요약 카드 ─────────────────────────────────────────
  function _renderSummary() {
    const lots     = _lots();
    const dailies  = _dailies();
    const invoices = _invoices();

    const totalQty  = lots.reduce((s, l) => s + parseNumber(l.qty), 0);
    const totalProc = dailies.reduce((s, d) => s + parseNumber(d.proc), 0);
    const doneCnt   = lots.filter(l => getLotStatus(l) === 'done').length;
    const activeCnt = lots.length - doneCnt;

    // 사업 시작일 = 최초 입고일 (LOT 또는 shipment)
    const allDates = lots.map(l => l.inDate).filter(Boolean).sort();
    const startDate = allDates[0] || '';
    const operatingDays = startDate ? diffDays(startDate, today()) : 0;

    // KPI 달성률 (현재년도)
    const year = new Date().getFullYear();
    const kpi = Pages.KpiTarget.getBizSummary
      ? Pages.KpiTarget.getBizSummary(year, _biz)
      : null;
    const kpiPct  = kpi && kpi.tgt > 0 ? kpi.pct : null;
    const kpiText = kpiPct === null ? '—' : kpiPct + '%';
    const kpiSub  = !kpi || !kpi.tgt
      ? `${year}년 목표 미설정`
      : kpi.hasRate
        ? `목표 ${(kpi.tgt/100000000).toFixed(2)}억원 · 실적 ${(kpi.act/100000000).toFixed(2)}억원`
        : `목표 $${formatNumber(Math.round(kpi.tgt))} · 실적 $${formatNumber(Math.round(kpi.act))}`;

    // 매출 (인보이스 합계)
    const revTotal = invoices.reduce((s, i) => s + parseNumber(i.total || i.amount), 0);
    const paidTotal = invoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + parseNumber(i.total || i.amount), 0);

    function card(label, value, sub, color) {
      return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 18px">
        <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
        <div style="font-size:22px;font-weight:600;line-height:1.1;${color?'color:'+color:''}">${value}</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:6px">${sub || '&nbsp;'}</div>
      </div>`;
    }

    return `<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px">
      ${card('사업 시작',
        startDate || '—',
        startDate ? `운영 ${operatingDays}일 (≈${(operatingDays/30).toFixed(1)}개월)` : '입고 LOT 없음'
      )}
      ${card('LOT',
        lots.length + '건',
        `완료 ${doneCnt} · 진행 ${activeCnt}`
      )}
      ${card('누적 처리량',
        formatNumber(totalProc),
        `총 입고 ${formatNumber(totalQty)} · 잔량 ${formatNumber(Math.max(0, totalQty - totalProc))}`
      )}
      ${card(`${year} KPI`,
        kpiText,
        kpiSub,
        kpiPct === null ? '' : kpiPct >= 100 ? '#0F6E56' : kpiPct >= 70 ? 'var(--tx)' : 'var(--tx2)'
      )}
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px">
      ${card('누적 매출 (청구 기준)',
        revTotal > 0 ? '$' + formatNumber(Math.round(revTotal)) : '—',
        invoices.length + '건 인보이스 · 수금 $' + formatNumber(Math.round(paidTotal))
      )}
      ${card('미수금',
        revTotal - paidTotal > 0 ? '$' + formatNumber(Math.round(revTotal - paidTotal)) : '—',
        revTotal > 0 ? Math.round((paidTotal/revTotal)*100) + '% 수금 완료' : '청구 없음'
      )}
    </div>`;
  }

  // ── 월별 차트 ─────────────────────────────────────────────
  function _renderCharts() {
    // 최근 12개월 라벨
    const labels = [];
    const today_ = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today_.getFullYear(), today_.getMonth() - i, 1);
      labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }

    const procByMonth = {};
    const revByMonth  = {};
    labels.forEach(m => { procByMonth[m] = 0; revByMonth[m] = 0; });

    _dailies().forEach(d => {
      const m = _ym(d.date);
      if (procByMonth[m] !== undefined) procByMonth[m] += parseNumber(d.proc);
    });

    _invoices().forEach(i => {
      const m = _ym(i.date);
      if (revByMonth[m] !== undefined) revByMonth[m] += parseNumber(i.total || i.amount);
    });

    setTimeout(() => {
      if (_chartProc) _chartProc.destroy();
      if (_chartRev)  _chartRev.destroy();

      const ctxProc = document.getElementById('bh-chart-proc');
      const ctxRev  = document.getElementById('bh-chart-rev');
      if (!ctxProc || !ctxRev) return;

      const bizColor = CONFIG.BIZ_COLORS[_biz] || '#4B5563';

      _chartProc = new Chart(ctxProc, {
        type: 'bar',
        data: {
          labels: labels.map(m => m.slice(2)),  // "26-05" 형태로 짧게
          datasets: [{
            label: '월별 처리량',
            data: labels.map(m => procByMonth[m]),
            backgroundColor: bizColor + 'CC',
            borderRadius: 3,
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#F0F0F0' }, ticks: { font: { size: 10 } } }
          }
        }
      });

      _chartRev = new Chart(ctxRev, {
        type: 'bar',
        data: {
          labels: labels.map(m => m.slice(2)),
          datasets: [{
            label: '월별 매출 (USD)',
            data: labels.map(m => revByMonth[m]),
            backgroundColor: bizColor + '88',
            borderRadius: 3,
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => '$' + formatNumber(Math.round(ctx.raw)) } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#F0F0F0' }, ticks: { font: { size: 10 },
              callback: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v
            } }
          }
        }
      });
    }, 30);

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:8px">월별 처리량 (최근 12개월)</div>
        <div style="position:relative;height:140px"><canvas id="bh-chart-proc"></canvas></div>
      </div>
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:8px">월별 매출 USD (최근 12개월)</div>
        <div style="position:relative;height:140px"><canvas id="bh-chart-rev"></canvas></div>
      </div>
    </div>`;
  }

  // ── 타임라인 이벤트 빌드 ──────────────────────────────────
  function _buildEvents() {
    const events = [];
    const lots     = _lots();
    const dailies  = Store.getDailies();
    const invoices = _invoices();
    const shipments= _shipments();

    // LOT 입고
    lots.forEach(l => {
      if (!l.inDate) return;
      events.push({
        date:  l.inDate,
        type:  'in',
        title: `${l.lotNo || l.id} 입고`,
        sub:   `${l.customerName || '고객사 미지정'} · ${formatNumber(parseNumber(l.qty))}${l.unit || '개'}` +
               (l.country ? ` · ${CONFIG.COUNTRY_LABELS[l.country] || l.country}` : ''),
      });

      // LOT 완료
      if (l.actualDone) {
        const cum = getLotCumulative(l.id, dailies);
        const leadDays = l.inDate ? diffDays(l.inDate, l.actualDone) : null;
        events.push({
          date:  l.actualDone,
          type:  'done',
          title: `${l.lotNo || l.id} 완료`,
          sub:   `처리 ${formatNumber(cum)}${leadDays !== null ? ` · 리드타임 ${leadDays}일` : ''}`,
        });
      }
    });

    // 인보이스 발행
    invoices.forEach(i => {
      if (!i.date) return;
      const amt = parseNumber(i.total || i.amount);
      const invLabel = i.no || ('INV#' + i.id);
      events.push({
        date:  i.date,
        type:  'inv',
        title: `${invLabel} 청구`,
        sub:   `${i.currency || ''} ${formatNumber(Math.round(amt))}` +
               (i.customerName ? ` · ${i.customerName}` : ''),
      });

      // 수금 (paidDate)
      if (i.paidDate) {
        events.push({
          date:  i.paidDate,
          type:  'paid',
          title: `${invLabel} 수금`,
          sub:   `${i.currency || ''} ${formatNumber(Math.round(parseNumber(i.paidAmt || i.total || i.amount)))}`,
        });
      }
    });

    // 입고 예정 (미래)
    shipments
      .filter(s => s.expectedDate && s.expectedDate >= today())
      .forEach(s => {
        events.push({
          date:  s.expectedDate,
          type:  'ship',
          title: `${s.lotNo || ''} 입고 예정`,
          sub:   `${s.customerName || ''} · ${formatNumber(parseNumber(s.qty))}${s.unit || '개'}`,
          future: true,
        });
      });

    // 최신 순 정렬
    events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return events;
  }

  // ── 타임라인 렌더 ─────────────────────────────────────────
  function _renderTimeline() {
    const events = _buildEvents();
    if (events.length === 0) {
      return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:48px 20px;text-align:center;color:var(--tx3);font-size:13px">
        ${CONFIG.BIZ_LABELS[_biz]} 사업 이벤트가 아직 없습니다
      </div>`;
    }

    // 월 단위로 그룹화
    const byMonth = {};
    events.forEach(e => {
      const m = _ym(e.date);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(e);
    });

    const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
    const now    = today();

    const monthsHtml = months.map(m => {
      const eventsHtml = byMonth[m].map((e, idx, arr) => {
        const st     = EVT_STYLE[e.type];
        const isLast = idx === arr.length - 1;
        const future = e.future || e.date > now;
        return `<div style="position:relative;padding-left:34px;padding-bottom:${isLast?'0':'14px'}">
          ${isLast ? '' : '<div style="position:absolute;left:11px;top:18px;bottom:0;width:1px;background:var(--bd)"></div>'}
          <div style="position:absolute;left:5px;top:5px;width:13px;height:13px;border-radius:50%;background:${st.bg};border:2px solid ${st.color};${future?'opacity:.55':''}"></div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--tx3);min-width:54px">${e.date.slice(5)}</span>
            <span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;color:${st.color};background:${st.bg};border:1px solid ${st.color}33">${st.label}</span>
            <span style="font-size:13px;font-weight:500;color:var(--tx);${future?'opacity:.65':''}">${e.title}</span>
          </div>
          <div style="font-size:12px;color:var(--tx2);padding-left:62px">${e.sub || ''}</div>
        </div>`;
      }).join('');

      const [yyyy, mm] = m.split('-');
      return `<div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="font-size:13px;font-weight:600;color:var(--tx)">${yyyy}년 ${parseInt(mm,10)}월</div>
          <div style="flex:1;height:1px;background:var(--bd)"></div>
          <div style="font-size:11px;color:var(--tx3)">${byMonth[m].length}건</div>
        </div>
        ${eventsHtml}
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:20px 22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;color:var(--tx)">이벤트 타임라인</div>
        <div style="font-size:11px;color:var(--tx3)">총 ${events.length}건 · 최신순</div>
      </div>
      ${monthsHtml}
    </div>`;
  }

  // ── 필터 탭 ──────────────────────────────────────────────
  function _renderTabs() {
    const bizTabs = CONFIG.BIZ_LIST.map(b => {
      const active = b === _biz;
      const color  = CONFIG.BIZ_COLORS[b];
      return `<button onclick="Pages.BizHistory.setBiz('${b}')"
        style="padding:7px 14px;border:1px solid ${active?color:'var(--bd2)'};border-radius:6px;
        background:${active?color:'var(--card)'};color:${active?'#fff':'var(--tx2)'};
        font-size:12px;font-weight:${active?'600':'500'};cursor:pointer;transition:.12s">
        ${CONFIG.BIZ_LABELS[b]}
      </button>`;
    }).join('');

    const coTabs = [['', '전체'], ['HK', '홍콩'], ['SG', '싱가포르']].map(([v, label]) => {
      const active = v === _country;
      return `<button onclick="Pages.BizHistory.setCountry('${v}')"
        style="padding:6px 12px;border:1px solid ${active?'var(--tx)':'var(--bd2)'};border-radius:6px;
        background:${active?'var(--tx)':'var(--card)'};color:${active?'#fff':'var(--tx2)'};
        font-size:12px;font-weight:${active?'600':'500'};cursor:pointer;transition:.12s">
        ${label}
      </button>`;
    }).join('');

    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${bizTabs}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
      <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-right:4px">국가</span>
      ${coTabs}
    </div>`;
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  function render() {
    const root = document.getElementById('bizhistory-body');
    if (!root) return;
    root.innerHTML =
      _renderTabs() +
      _renderSummary() +
      _renderCharts() +
      _renderTimeline();
  }

  // ── Public API ────────────────────────────────────────────
  return {
    render,
    setBiz(b)     { _biz = b; render(); },
    setCountry(c) { _country = c; render(); },
  };

})();
