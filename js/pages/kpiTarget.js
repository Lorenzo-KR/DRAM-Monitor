/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 연간 목표 설정 + 월별 트래킹
 */

Pages.KpiTarget = (() => {

  let _year     = new Date().getFullYear();
  let _bizSet   = new Set(['all']);
  let _startMon = parseInt(localStorage.getItem('kpi_start_mon') || '4');
  let _rollingYear = new Date().getFullYear();

  // ── 데이터 헬퍼 ────────────────────────────────────────────
  function _getActual(year, biz) {
    return Store.getInvoices()
      .filter(r => r.biz === biz && String(r.date || '').startsWith(String(year)))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  function _getActualMonth(year, biz, month) {
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    return Store.getInvoices()
      .filter(r => (!biz || r.biz === biz) && String(r.date || '').startsWith(prefix))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  function _getTarget(year, biz) {
    return parseNumber(Store.getTargetFor(year, biz)?.target || 0);
  }

  function _getTotalTarget(year) {
    return CONFIG.BIZ_LIST.reduce((s, b) => s + _getTarget(year, b), 0);
  }

  // ── 저장 ───────────────────────────────────────────────────
  async function save(year, biz, rawValue) {
    const amount   = parseNumber(rawValue);
    const existing = Store.getTargetFor(year, biz);
    const record   = { id: existing ? existing.id : (Date.now() + Math.random()), year: String(year), biz, target: amount };
    Store.upsertTarget(record);
    if (existing) await Api.update(CONFIG.SHEETS.TARGETS, existing.id, record);
    else          await Api.append(CONFIG.SHEETS.TARGETS, record);
    UI.toast('목표 저장됨');
    Pages.KpiTarget.render();
    if (typeof Nav !== 'undefined' && Nav.current && Nav.current() === 'dash') Pages.Dashboard.render();
  }

  function selectYear(year) { _year = year; Pages.KpiTarget.render(); }

  function switchBiz(biz) {
    if (biz === 'all') {
      // 전체 → 단독 선택
      _bizSet = new Set(['all']);
    } else {
      // 개별 선택 시 'all' 제거
      _bizSet.delete('all');
      if (_bizSet.has(biz)) {
        _bizSet.delete(biz);
        if (_bizSet.size === 0) _bizSet = new Set(['all']); // 모두 해제 시 전체로
      } else {
        _bizSet.add(biz);
      }
    }
    // 버튼 활성화 상태 업데이트
    ['all','DRAM','SSD','MID'].forEach(b => {
      const btn = document.getElementById('kpi-biz-' + b); if (!btn) return;
      const color = b === 'all' ? '#1B4F8A' : CONFIG.BIZ_COLORS[b];
      const on = _bizSet.has(b);
      btn.style.background  = on ? color : 'none';
      btn.style.color       = on ? '#fff' : 'var(--tx2)';
      btn.style.borderColor = on ? color  : 'var(--bd2)';
    });
    _renderTracking();
  }

  function setStartMon(val) {
    _startMon = parseInt(val);
    localStorage.setItem('kpi_start_mon', String(_startMon));
    _renderTracking();
  }

  // ── 월별 트래킹 렌더 ───────────────────────────────────────
  function _renderTracking() {
    const el = document.getElementById('kpi-tracking-wrap'); if (!el) return;
    const year    = _year;
    const isAll   = _bizSet.has('all');
    const bizList = isAll ? CONFIG.BIZ_LIST : CONFIG.BIZ_LIST.filter(b => _bizSet.has(b));

    const totalTgt = bizList.reduce((s, b) => s + _getTarget(year, b), 0);
    if (totalTgt === 0) {
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--tx3);font-size:14px">목표를 먼저 설정해주세요</div>`;
      return;
    }

    const numMonths  = 13 - _startMon;
    const monthlyTgt = Math.round(totalTgt / numMonths);
    const now        = new Date();
    const curMonIdx  = now.getFullYear() === year ? now.getMonth() : (now.getFullYear() > year ? 11 : -1);

    const MONTHS      = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const monthTargets = MONTHS.map((_, i) => i >= _startMon - 1 ? monthlyTgt : 0);

    const monthActuals = MONTHS.map((_, i) => {
      if (i > curMonIdx) return null;
      return bizList.reduce((s, b) => s + _getActualMonth(year, b, i+1), 0);
    });

    // 누적
    let cumT = 0, cumA = 0;
    const cumTargets = [], cumActuals = [];
    MONTHS.forEach((_, i) => {
      cumT += monthTargets[i];
      cumTargets.push(cumT);
      if (i <= curMonIdx) { cumA += (monthActuals[i] || 0); cumActuals.push(cumA); }
      else cumActuals.push(null);
    });

    const curCumA    = cumActuals[curMonIdx] ?? 0;
    const curCumT    = cumTargets[curMonIdx] ?? 0;
    const overallPct = curCumT > 0 ? Math.round(curCumA / curCumT * 100) : 0;
    const diff       = curCumA - curCumT;

    // 선택된 사업 레이블
    const bizLabel = isAll ? '전체' : bizList.map(b => CONFIG.BIZ_LABELS[b]).join(' + ');

    // 요약 카드
    const periodLabel = `1~${curMonIdx + 1}월`;
    const cards = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:13px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">연간 목표 · ${bizLabel}</div>
          <div style="font-size:20px;font-weight:600">$${formatNumber(Math.round(totalTgt))}</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px">월 $${formatNumber(monthlyTgt)} (${_startMon}~12월)</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:13px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 실적 (${periodLabel})</div>
          <div style="font-size:20px;font-weight:600;color:#085041">$${formatNumber(Math.round(curCumA))}</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px">목표 $${formatNumber(Math.round(curCumT))}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:13px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 달성률 (${periodLabel})</div>
          <div style="font-size:20px;font-weight:600;color:${overallPct>=100?'#085041':overallPct>=70?'#0C447C':'#A32D2D'}">${overallPct}%</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px">목표 대비</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:13px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 차이 (${periodLabel})</div>
          <div style="font-size:20px;font-weight:600;color:${diff>=0?'#085041':'#A32D2D'}">${diff>=0?'+':'-'}$${formatNumber(Math.round(Math.abs(diff)))}</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px">${diff>=0?'목표 초과':'목표 미달'}</div>
        </div>
      </div>`;

    // 차트 HTML
    const chartHtml = `
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">
        <div style="display:flex;gap:16px;margin-bottom:10px;font-size:13px;align-items:center">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#85B7EB;display:inline-block;border-radius:2px;border-top:2px dashed #85B7EB"></span>목표 누적</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#1D9E75;display:inline-block;border-radius:2px"></span>실적 누적</span>
          <span style="font-size:12px;color:var(--tx3);margin-left:auto">목표는 ${_startMon}월부터 적용</span>
        </div>
        <div style="position:relative;height:210px"><canvas id="cv-kpi-monthly"></canvas></div>
      </div>`;

    // 표
    const thS = 'padding:9px 12px;font-size:13px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd)';
    let cumTA2 = 0, cumAA2 = 0;
    const tableRows = MONTHS.map((m, i) => {
      cumTA2 += monthTargets[i];
      const isPast = i <= curMonIdx;
      const isCur  = i === curMonIdx;
      const noTgt  = monthTargets[i] === 0;
      const act    = isPast ? (monthActuals[i] || 0) : null;
      if (isPast) cumAA2 += (monthActuals[i] || 0);
      const cumAVal = isPast ? cumAA2 : null;
      const pct  = cumTA2 > 0 && cumAVal !== null ? Math.round(cumAVal / cumTA2 * 100) : null;
      const dif  = cumTA2 > 0 && cumAVal !== null ? cumAVal - cumTA2 : null;
      const barC = pct === null ? '#e5e7eb' : pct >= 100 ? '#1D9E75' : pct >= 70 ? '#185FA5' : '#E24B4A';
      const pctC = pct === null ? 'var(--tx3)' : pct >= 100 ? '#085041' : pct >= 70 ? '#0C447C' : '#791F1F';
      const difBadge = dif === null ? '—'
        : dif >= 0 ? `<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#E1F5EE;color:#085041">+$${Math.round(dif).toLocaleString()}</span>`
                   : `<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FCEBEB;color:#791F1F">-$${Math.round(Math.abs(dif)).toLocaleString()}</span>`;
      return `<tr style="${isCur?'background:#F0F7FF':''}${!isPast?';opacity:0.38':''}">
        <td style="padding:9px 12px;font-weight:${isCur?'600':'400'};color:${isCur?'#0C447C':'var(--tx)'}">
          ${m}${isCur?' ◀':''}
          ${noTgt&&isPast?'<span style="font-size:11px;color:var(--tx3);margin-left:4px">(목표전)</span>':''}
        </td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx3)">${noTgt?'—':'$'+monthlyTgt.toLocaleString()}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:13px">${act!==null?'$'+Math.round(act).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx3)">${cumTA2>0?'$'+Math.round(cumTA2).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:${isPast?'500':'400'};color:#085041">${cumAVal!==null?'$'+Math.round(cumAVal).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;min-width:130px">
          ${pct!==null?`<div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
              <div style="height:100%;border-radius:3px;background:${barC};width:${Math.min(100,pct)}%"></div>
            </div>
            <span style="font-size:13px;font-weight:500;color:${pctC};min-width:36px;text-align:right">${pct}%</span>
          </div>`:`<span style="font-size:13px;color:var(--tx3)">${isPast?'목표전':'—'}</span>`}
        </td>
        <td style="padding:9px 12px;text-align:right">${difBadge}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      ${cards}
      ${chartHtml}
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr>
            <th style="${thS};text-align:left">월</th>
            <th style="${thS};text-align:right">월 목표</th>
            <th style="${thS};text-align:right">월 실적</th>
            <th style="${thS};text-align:right">누적 목표</th>
            <th style="${thS};text-align:right">누적 실적</th>
            <th style="${thS};min-width:130px">달성률</th>
            <th style="${thS};text-align:right">누적 차이</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    // 차트 그리기
    setTimeout(() => {
      const canvas = document.getElementById('cv-kpi-monthly'); if (!canvas) return;
      if (window._kpiChart) { window._kpiChart.destroy(); window._kpiChart = null; }
      window._kpiChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: MONTHS,
          datasets: [
            { label:'목표 누적', data:cumTargets, borderColor:'#85B7EB', borderWidth:2, borderDash:[5,3],
              pointRadius:cumTargets.map((_,i)=>i>=_startMon-1?3:0), pointBackgroundColor:'#85B7EB', fill:false, tension:0 },
            { label:'실적 누적', data:cumActuals, borderColor:'#1D9E75', borderWidth:2.5,
              pointRadius:cumActuals.map(v=>v!==null?4:0), pointBackgroundColor:'#1D9E75',
              fill:{target:0, above:'rgba(29,158,117,0.08)', below:'rgba(226,75,74,0.08)'}, tension:0.2 },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{display:false},
            tooltip:{mode:'index',intersect:false,callbacks:{label:ctx=>` ${ctx.dataset.label}: $${Math.round(ctx.raw||0).toLocaleString()}`}}
          },
          scales: {
            x:{grid:{display:false},ticks:{color:'#9aa0ad',font:{size:12},autoSkip:false}},
            y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#9aa0ad',font:{size:12},callback:v=>'$'+(v/1000).toFixed(0)+'K'},beginAtZero:true},
          },
          layout:{padding:{top:10}}
        }
      });
    }, 50);
  }

  // ── 메인 렌더 ──────────────────────────────────────────────
  return {
    save, selectYear, switchBiz, setStartMon,

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

        const tgtCell = tgt > 0
          ? `<span style="font-family:var(--font-mono);font-size:14px;font-weight:600">$${formatNumber(Math.round(tgt))}</span>`
          : `<div style="display:flex;align-items:center;gap:6px">
               <input type="number" id="kpi-input-${b}" placeholder="목표 입력" min="0" step="1000"
                 style="width:130px;padding:6px 10px;border:1.5px solid #B5D4F4;border-radius:6px;font-size:14px;background:#EAF3FE;color:#0C447C;text-align:right">
               <button class="btn pri sm" onclick="Pages.KpiTarget.save(${year},'${b}',document.getElementById('kpi-input-${b}').value)">저장</button>
             </div>`;

        const actionCell = tgt > 0
          ? `<button onclick="Pages.KpiTarget.startEdit(${year},'${b}',${tgt})"
               style="padding:4px 12px;border:0.5px solid var(--bd2);border-radius:5px;background:none;color:var(--tx2);font-size:13px;cursor:pointer">수정</button>`
          : '';

        return `
          <tr id="kpi-row-${b}" style="border-bottom:0.5px solid var(--bd)">
            <td style="padding:12px 14px"><span style="font-size:14px;font-weight:500;color:${color}">${CONFIG.BIZ_LABELS[b]}</span></td>
            <td style="padding:12px 14px" id="kpi-tgt-cell-${b}">${tgtCell}</td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;color:#085041">${act>0?'$'+formatNumber(Math.round(act)):'—'}</td>
            <td style="padding:12px 14px;min-width:160px">
              ${tgt>0?`<div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                  <div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div>
                </div>
                <span style="font-size:14px;font-weight:600;color:${barClr};min-width:32px;text-align:right">${pct}%</span>
              </div>`:'<span style="font-size:14px;color:var(--tx3)">목표 미설정</span>'}
            </td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;color:${rem>0?'#BA7517':'var(--tx3)'}">
              ${tgt>0?'$'+formatNumber(Math.round(rem)):'—'}
            </td>
            <td style="padding:12px 14px;width:100px" id="kpi-act-cell-${b}">${actionCell}</td>
          </tr>`;
      }).join('');

      const totalTgt = CONFIG.BIZ_LIST.reduce((s, b) => s + _getTarget(year, b), 0);
      const totalAct = CONFIG.BIZ_LIST.reduce((s, b) => s + _getActual(year, b), 0);
      const totalPct = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
      const totalRem = Math.max(0, totalTgt - totalAct);
      const totalClr = totalPct >= 100 ? '#1D9E75' : totalPct >= 70 ? 'var(--navy)' : '#EF9F27';

      const yearTabs = [year-1, year, year+1].map(y => {
        const active = y === year;
        return `<button onclick="Pages.KpiTarget.selectYear(${y})"
          style="padding:4px 14px;border-radius:20px;font-size:14px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;
          ${active?'background:var(--navy);color:#fff;border-color:var(--navy)':'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
      }).join('');

      const TH  = l => `<th style="padding:9px 14px;text-align:left;font-size:13px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd)">${l}</th>`;
      const THR = l => `<th style="padding:9px 14px;text-align:right;font-size:13px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd)">${l}</th>`;

      // 사업 필터 버튼
      const bizBtns = [
        {key:'all', label:'전체', color:'#1B4F8A'},
        ...CONFIG.BIZ_LIST.map(b => ({key:b, label:CONFIG.BIZ_LABELS[b], color:CONFIG.BIZ_COLORS[b]}))
      ].map(({key, label, color}) => {
        const on = _bizSet.has(key);
        return `<button id="kpi-biz-${key}" onclick="Pages.KpiTarget.switchBiz('${key}')"
          style="padding:5px 14px;border-radius:20px;font-size:13px;font-weight:500;cursor:pointer;border:1.5px solid ${color};
          background:${on?color:'none'};color:${on?'#fff':color};transition:.15s">${label}</button>`;
      }).join('');

      // 시작월 옵션 1~6월
      const monOpts = Array.from({length:6},(_,i)=>i+1).map(m =>
        `<option value="${m}" ${m===_startMon?'selected':''}>${m}월부터</option>`
      ).join('');

      el.innerHTML = `
        <div style="max-width:1000px">
          <div style="display:flex;gap:6px;margin-bottom:16px">${yearTabs}</div>

          ${totalTgt > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">연간 목표</div>
              <div style="font-size:20px;font-weight:600">$${formatNumber(Math.round(totalTgt))}</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">누적 달성</div>
              <div style="font-size:20px;font-weight:600;color:#085041">$${formatNumber(Math.round(totalAct))}</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:3px">전체 달성률</div>
              <div style="font-size:20px;font-weight:600;color:${totalClr}">${totalPct}%</div>
            </div>
          </div>` : ''}

          <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr>${TH('사업')}${TH('목표 매출 (USD)')}${THR('누적 실적')}${TH('달성률')}${THR('잔여')}${TH('')}</tr></thead>
              <tbody>${bizRows}</tbody>
              ${totalTgt > 0 ? `
              <tfoot><tr style="background:var(--bg)">
                <td style="padding:10px 14px;font-size:14px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
                <td style="padding:10px 14px;font-family:var(--font-mono);font-size:14px;font-weight:600;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalTgt))}</td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;font-weight:600;color:#085041;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalAct))}</td>
                <td style="padding:10px 14px;border-top:0.5px solid var(--bd)">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                      <div style="height:100%;border-radius:3px;background:${totalClr};width:${totalPct}%"></div>
                    </div>
                    <span style="font-size:14px;font-weight:600;color:${totalClr};min-width:32px;text-align:right">${totalPct}%</span>
                  </div>
                </td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:14px;font-weight:600;color:${totalRem>0?'#BA7517':'var(--tx3)'};border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalRem))}</td>
                <td style="border-top:0.5px solid var(--bd)"></td>
              </tr></tfoot>` : ''}
            </table>
          </div>

          <!-- 월별 트래킹 섹션 -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">${bizBtns}</div>
            <button onclick="Pages.KpiTarget.openRolling()"
              style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:1.5px solid #185FA5;border-radius:7px;background:none;color:#185FA5;font-size:13px;font-weight:500;cursor:pointer">
              <svg width="14" height="14" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              KPI 롤링 데이터 입력
            </button>
          </div>
          <div id="kpi-tracking-wrap"></div>
        </div>`;

      _renderTracking();
    },

    openRolling() {
      const el = document.getElementById('kpi-rolling-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) { el.style.display = 'block'; document.body.style.overflow = 'hidden'; }
      if (ov) ov.style.display = 'block';
      Pages.KpiTarget.renderRolling();
    },

    closeRolling() {
      const el = document.getElementById('kpi-rolling-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display = 'none';
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    },

    setRollingYear(y) {
      _rollingYear = parseInt(y);
      Pages.KpiTarget.renderRolling();
    },

    calcRollingRow(input) {
      const row = input.closest('tr');
      const inputs = row.querySelectorAll('input[type=number]');
      let sum = 0;
      inputs.forEach(i => { sum += parseFloat(i.value)||0; });
      const rt = row.querySelector('.rolling-rowtotal');
      if (rt) rt.textContent = sum > 0 ? +sum.toFixed(4)+'' : '—';
      Pages.KpiTarget.calcRollingAll();
    },

    calcRollingAll() {
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const rows = body.querySelectorAll('tr');
      const colSums = Array(12).fill(0);
      let grand = 0;
      rows.forEach(row => {
        const inputs = row.querySelectorAll('input[type=number]');
        let rowSum = 0;
        inputs.forEach((inp, ci) => {
          const v = parseFloat(inp.value)||0;
          colSums[ci] += v; rowSum += v;
        });
        const rt = row.querySelector('.rolling-rowtotal');
        if (rt) rt.textContent = rowSum > 0 ? +rowSum.toFixed(4)+'' : '—';
      });
      colSums.forEach((v, i) => {
        const el = document.getElementById('rs'+i);
        if (el) el.textContent = v > 0 ? +v.toFixed(4)+'' : '0';
        grand += v;
      });
      const st = document.getElementById('rstotal');
      if (st) st.textContent = grand > 0 ? +grand.toFixed(4)+'' : '0';
    },

    renderRolling() {
      const wrap = document.getElementById('kpi-rolling-inner'); if (!wrap) return;
      const y = _rollingYear;

      // 초기값 데이터
      const INIT = {
        2026: {
          DRAM: [0,0,0.1,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556],
          SSD:  [0,0,0.1,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667],
          MID:  [0,0,1.2,0,0,1.2,0,0,1.2,0,0,1.2],
        },
      };
      const ROWS = [
        { key:'DRAM', label:'DRAM Test', fixed:true },
        { key:'SSD',  label:'SSD Test',  fixed:true },
        { key:'MID',  label:'Mobile Ink Die', fixed:true },
        { key:'TBD1', label:'TBD', fixed:false },
        { key:'TBD2', label:'TBD', fixed:false },
        { key:'TBD3', label:'TBD', fixed:false },
        { key:'TBD4', label:'TBD', fixed:false },
        { key:'TBD5', label:'TBD', fixed:false },
      ];
      const MO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS = 'padding:6px 6px;text-align:center;font-size:11px;font-weight:500;color:var(--tx3);background:var(--bg);border:0.5px solid var(--bd);white-space:nowrap';
      const inpW = 'width:52px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';

      const tableRows = ROWS.map((r, i) => {
        const initVals = INIT[y]?.[r.key] || Array(12).fill('');
        const cells = initVals.map((v, mi) =>
          `<td style="padding:3px 3px;border:0.5px solid var(--bd)"><input type="number" value="${v}" placeholder="0" step="0.0001" style="${inpW}" oninput="Pages.KpiTarget.calcRollingRow(this)"></td>`
        ).join('');
        const rowSum = initVals.reduce((s,v) => s + (parseFloat(v)||0), 0);
        return `<tr>
          <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--tx3);background:var(--bg);border:0.5px solid var(--bd)">${i+1}</td>
          <td style="padding:6px 10px;font-size:13px;font-weight:${r.fixed?'500':'400'};color:${r.fixed?'var(--tx)':'var(--tx3)'};background:var(--bg);border:0.5px solid var(--bd);white-space:nowrap;text-align:center">${r.label}</td>
          ${cells}
          <td class="rolling-rowtotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;color:#085041;background:var(--bg);border:0.5px solid var(--bd);font-family:var(--font-mono)">${rowSum>0?+rowSum.toFixed(4):'—'}</td>
        </tr>`;
      }).join('');

      // 초기 열 합계
      const colSums = Array(12).fill(0);
      ROWS.forEach(r => {
        const vals = INIT[y]?.[r.key] || [];
        vals.forEach((v,i) => { colSums[i] += parseFloat(v)||0; });
      });
      const grand = colSums.reduce((s,v)=>s+v,0);
      const sumCells = colSums.map((v,i) =>
        `<td id="rs${i}" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;background:#F1EFE8;border:0.5px solid var(--bd);font-family:var(--font-mono)">${v>0?+v.toFixed(4):'0'}</td>`
      ).join('');

      wrap.innerHTML = `
        <div style="font-size:12px;color:#E24B4A;font-weight:500;margin-bottom:12px">Unit: Million USD &nbsp;·&nbsp; 셀을 클릭해서 직접 입력하세요</div>
        <div style="overflow-x:auto">
          <table style="border-collapse:collapse;table-layout:auto">
            <thead>
              <tr>
                <th style="${thS};width:30px">No.</th>
                <th style="${thS};min-width:110px">구분</th>
                ${MO.map(m=>`<th style="${thS};width:56px">${m}</th>`).join('')}
                <th style="${thS};width:60px;background:#F1EFE8">합계</th>
              </tr>
            </thead>
            <tbody id="rolling-tbody">${tableRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:6px 10px;text-align:center;font-size:13px;font-weight:500;background:#F1EFE8;border:0.5px solid var(--bd)">합계</td>
                ${sumCells}
                <td id="rstotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:600;color:#085041;background:#E8E4D8;border:0.5px solid var(--bd);font-family:var(--font-mono)">${grand>0?+grand.toFixed(4):'0'}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    },

    saveRolling() {
      UI.toast('롤링 데이터 저장됨');
      Pages.KpiTarget.closeRolling();
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
            style="width:130px;padding:6px 10px;border:1.5px solid #B5D4F4;border-radius:6px;font-size:14px;background:#EAF3FE;color:#0C447C;text-align:right">
          <button class="btn pri sm" onclick="Pages.KpiTarget.save(${year},'${biz}',document.getElementById('kpi-input-${biz}').value)">저장</button>
          <button onclick="Pages.KpiTarget.render()"
            style="padding:4px 10px;border:0.5px solid var(--bd2);border-radius:5px;background:none;color:var(--tx2);font-size:13px;cursor:pointer">취소</button>
        </div>`;
      actCell.innerHTML = '';
      document.getElementById('kpi-input-' + biz)?.focus();
    },
  };

})();
