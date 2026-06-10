/**
 * pages/forecast.js
 * 매출 예측 — 국가 × 사업 매트릭스로 월평균·트렌드 기반 향후 매출 예측
 *
 * 데이터 소스:
 *   매출액 = invoices 의 amount (월·biz·country 필터)
 *   처리량 = dailies 의 proc
 *   평균단가 = 매출액 / 처리량
 *
 * 예측 방식:
 *   ① 단순 월평균 — 실적 월평균을 미래 N개월에 동일 적용
 *   ② 선형 회귀 — y=ax+b 외삽
 */

Pages.Forecast = (() => {

  let _year   = new Date().getFullYear();
  let _cutoff = 0; // 0 = 자동(지난 달까지), 1~12 = 명시 월
  let _horizon = 3;

  const MATRIX = [
    { co: 'HK', biz: 'DRAM' },
    { co: 'HK', biz: 'SSD'  },
    { co: 'SG', biz: 'DRAM' },
    { co: 'SG', biz: 'SSD'  },
  ];

  // ── 선형회귀 ───────────────────────────────────────────────
  function _regression(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
    const sumX  = xs.reduce((s, x) => s + x, 0);
    const sumY  = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const denom = (n * sumX2 - sumX * sumX);
    if (!denom) return { slope: 0, intercept: sumY / n };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  // ── 월별 집계 (한 cell 분) ─────────────────────────────────
  function _bucketize(country, biz, year, cutoffMonth) {
    const yr = String(year);
    const invs    = Store.getInvoices().filter(r => String(r.date || '').startsWith(yr) && r.biz === biz && r.country === country);
    const dailies = Store.getDailies().filter(r  => String(r.date || '').startsWith(yr) && r.biz === biz && r.country === country);

    const monthly = [];
    for (let m = 1; m <= cutoffMonth; m++) {
      const ym  = yr + '-' + String(m).padStart(2, '0');
      const rev = invs.filter(r => String(r.date || '').startsWith(ym)).reduce((s, r) => s + parseNumber(r.amount), 0);
      const qty = dailies.filter(r => String(r.date || '').startsWith(ym)).reduce((s, r) => s + parseNumber(r.proc), 0);
      const avg = qty > 0 ? rev / qty : 0;
      monthly.push({ m, ym, rev, qty, avg });
    }
    return monthly;
  }

  // ── 자동 cutoff: 오늘 기준 직전 월 (현재 진행 월은 데이터 미완) ──
  function _autoCutoff(year) {
    const t = new Date();
    if (t.getFullYear() < year) return 0;
    if (t.getFullYear() > year) return 12;
    return Math.max(1, t.getMonth()); // 이번 달 직전까지 (0-index 월 → 직전 월 번호와 같음)
  }

  // ── 셀 렌더 (1국가×1사업) ──────────────────────────────────
  function _renderCell(country, biz, year, cutoff, horizon) {
    const monthly = _bucketize(country, biz, year, cutoff);
    const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);

    const avgRev = nonZero.length ? nonZero.reduce((s, x) => s + x.rev, 0) / nonZero.length : 0;
    const avgQty = nonZero.length ? nonZero.reduce((s, x) => s + x.qty, 0) / nonZero.length : 0;
    const avgPrc = avgQty > 0 ? avgRev / avgQty : 0;

    const xs = nonZero.map(x => x.m);
    const reg = _regression(xs, nonZero.map(x => x.rev));

    // 예측 (다음 horizon 개월)
    const forecast = [];
    for (let m = cutoff + 1; m <= Math.min(cutoff + horizon, 12); m++) {
      const flat  = avgRev;
      const trend = Math.max(0, reg.slope * m + reg.intercept);
      forecast.push({ m, flat, trend });
    }

    const co = CONFIG.COUNTRY_COLORS[country] || '#666';
    const bc = CONFIG.BIZ_COLORS[biz] || '#666';

    const monthRows = monthly.map(x => `
      <tr>
        <td style="padding:5px 8px;font-family:var(--font-mono);font-size:13px">${x.m}월</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px">$${formatNumber(Math.round(x.rev))}</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${formatNumber(Math.round(x.qty))}</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${x.avg > 0 ? '$' + x.avg.toFixed(2) : '-'}</td>
      </tr>`).join('');

    const fcRows = forecast.length ? forecast.map(f => `
      <tr style="background:#FFF8E5">
        <td style="padding:5px 8px;font-family:var(--font-mono);font-size:13px;font-weight:500">${f.m}월</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px">$${formatNumber(Math.round(f.flat))}</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px">$${formatNumber(Math.round(f.trend))}</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:500">$${formatNumber(Math.round((f.flat + f.trend) / 2))}</td>
      </tr>`).join('') : '<tr><td colspan="4" style="padding:8px;text-align:center;color:var(--tx3);font-size:13px">예측 구간 없음</td></tr>';

    const trendInfo = reg.slope !== 0
      ? `기울기 $${formatNumber(Math.round(reg.slope))}/월 (${reg.slope > 0 ? '↑ 상승' : '↓ 하락'})`
      : '추세 부족';

    return `
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:16px;border-top:3px solid ${bc}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:15px;font-weight:600">
            <span style="display:inline-block;padding:2px 8px;background:${co}22;color:${co};border-radius:3px;font-size:12px;margin-right:6px">${CONFIG.COUNTRY_LABELS[country] || country}</span>
            <span style="color:${bc}">${CONFIG.BIZ_LABELS[biz] || biz}</span>
          </div>
          <div style="font-size:11px;color:var(--tx3)">실적 ${nonZero.length}개월</div>
        </div>

        <!-- 실적 표 -->
        <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">실적</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
          <thead><tr style="border-bottom:1px solid var(--bd);font-size:11px;color:var(--tx3);text-transform:uppercase">
            <th style="padding:4px 8px;text-align:left">월</th>
            <th style="padding:4px 8px;text-align:right">매출(USD)</th>
            <th style="padding:4px 8px;text-align:right">처리량</th>
            <th style="padding:4px 8px;text-align:right">평균단가</th>
          </tr></thead>
          <tbody>${monthRows || '<tr><td colspan="4" style="padding:8px;text-align:center;color:var(--tx3);font-size:13px">데이터 없음</td></tr>'}</tbody>
        </table>

        <!-- 월평균 박스 -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px;background:var(--bg);border-radius:var(--rs);margin-bottom:10px">
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase">월평균 매출</div>
            <div style="font-size:14px;font-weight:600;color:${bc};font-family:var(--font-mono)">$${formatNumber(Math.round(avgRev))}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase">월평균 처리량</div>
            <div style="font-size:14px;font-weight:600;color:var(--tx);font-family:var(--font-mono)">${formatNumber(Math.round(avgQty))}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase">평균 단가</div>
            <div style="font-size:14px;font-weight:600;color:var(--tx);font-family:var(--font-mono)">${avgPrc > 0 ? '$' + avgPrc.toFixed(2) : '-'}</div>
          </div>
        </div>

        <!-- 예측 표 -->
        <div style="font-size:11px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">예측 — ${trendInfo}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--bd);font-size:11px;color:var(--tx3);text-transform:uppercase">
            <th style="padding:4px 8px;text-align:left">월</th>
            <th style="padding:4px 8px;text-align:right" title="단순 월평균 적용">평균 기준</th>
            <th style="padding:4px 8px;text-align:right" title="선형회귀 외삽">트렌드</th>
            <th style="padding:4px 8px;text-align:right">중간값</th>
          </tr></thead>
          <tbody>${fcRows}</tbody>
        </table>
      </div>`;
  }

  // ── 메인 렌더 ──────────────────────────────────────────────
  function render() {
    const root = document.getElementById('forecast-root');
    if (!root) return;

    const auto    = _autoCutoff(_year);
    const cutoff  = _cutoff > 0 ? _cutoff : auto;
    const horizon = _horizon;

    // 상단 합계
    let totalActualRev = 0, totalActualQty = 0, totalFcMid = 0;
    MATRIX.forEach(({ co, biz }) => {
      const monthly = _bucketize(co, biz, _year, cutoff);
      const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);
      const aR = nonZero.length ? nonZero.reduce((s, x) => s + x.rev, 0) / nonZero.length : 0;
      const aQ = nonZero.length ? nonZero.reduce((s, x) => s + x.qty, 0) / nonZero.length : 0;
      totalActualRev += nonZero.reduce((s, x) => s + x.rev, 0);
      totalActualQty += nonZero.reduce((s, x) => s + x.qty, 0);

      const xs = nonZero.map(x => x.m);
      const reg = _regression(xs, nonZero.map(x => x.rev));
      for (let m = cutoff + 1; m <= Math.min(cutoff + horizon, 12); m++) {
        const trend = Math.max(0, reg.slope * m + reg.intercept);
        totalFcMid += (aR + trend) / 2;
      }
    });

    const cutoffLabel = `1~${cutoff}월 실적`;
    const fcLabel     = `${cutoff + 1}~${Math.min(cutoff + horizon, 12)}월 예측`;

    root.innerHTML = `
      <div class="ph-row">
        <div class="ph">
          <h1>매출 예측</h1>
          <p>국가 × 사업 매트릭스로 월별 매출·처리량·평균단가 트렌드 분석 및 향후 매출 예측</p>
        </div>
      </div>

      <!-- 필터 -->
      <div class="fb" style="margin-bottom:16px;gap:14px">
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase">연도</span>
          <select id="fc-year" onchange="Pages.Forecast.setYear(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card)">
            <option value="2026"${_year === 2026 ? ' selected' : ''}>2026</option>
            <option value="2027"${_year === 2027 ? ' selected' : ''}>2027</option>
            <option value="2025"${_year === 2025 ? ' selected' : ''}>2025</option>
          </select>
        </div>
        <span class="sep"></span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase">실적 기준</span>
          <select id="fc-cutoff" onchange="Pages.Forecast.setCutoff(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card)">
            <option value="0"${_cutoff === 0 ? ' selected' : ''}>자동 (지난달까지)</option>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}"${_cutoff === m ? ' selected' : ''}>${m}월까지</option>`).join('')}
          </select>
        </div>
        <span class="sep"></span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase">예측 구간</span>
          <select id="fc-horizon" onchange="Pages.Forecast.setHorizon(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card)">
            <option value="1"${_horizon === 1 ? ' selected' : ''}>1개월</option>
            <option value="2"${_horizon === 2 ? ' selected' : ''}>2개월</option>
            <option value="3"${_horizon === 3 ? ' selected' : ''}>3개월</option>
            <option value="6"${_horizon === 6 ? ' selected' : ''}>6개월</option>
          </select>
        </div>
        <span style="margin-left:auto;font-size:12px;color:var(--tx3)">${cutoffLabel} · ${fcLabel}</span>
      </div>

      <!-- 요약 KPI -->
      <div class="mg mg3" style="margin-bottom:16px">
        ${renderMetricCard('실적 합계 (4셀, USD)', '$' + formatNumber(Math.round(totalActualRev)), cutoffLabel)}
        ${renderMetricCard('실적 처리량 합계', formatNumber(Math.round(totalActualQty)), cutoffLabel)}
        ${renderMetricCard('예측 합계 (중간값)', '$' + formatNumber(Math.round(totalFcMid)), fcLabel, '#92400e')}
      </div>

      <!-- 4셀 매트릭스 -->
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        ${MATRIX.map(({ co, biz }) => _renderCell(co, biz, _year, cutoff, horizon)).join('')}
      </div>

      <div style="margin-top:16px;padding:12px 14px;background:#EEF4FF;border:1px solid #bfdbfe;border-radius:var(--rs);font-size:12px;color:#1e40af;line-height:1.7">
        <div style="font-weight:600;margin-bottom:4px">예측 방식 설명</div>
        <div><b>평균 기준</b>: 실적 월평균을 미래 각 월에 동일 적용 (변동 적은 사업에 적합)</div>
        <div><b>트렌드</b>: 선형회귀(y=ax+b)로 외삽. 기울기가 크면 추세 강하다는 의미</div>
        <div><b>중간값</b>: 위 두 값의 평균 — 단순 평균과 트렌드를 절충</div>
        <div style="margin-top:4px;color:#3b82f6">※ 통화는 invoice amount 원값을 그대로 합산 (FX 변환 없음). USD 외 통화가 섞이면 절대값보다 추세 해석에 활용하세요.</div>
      </div>`;
  }

  function setYear(y)     { _year    = Number(y); render(); }
  function setCutoff(m)   { _cutoff  = Number(m); render(); }
  function setHorizon(h)  { _horizon = Number(h); render(); }

  return { render, setYear, setCutoff, setHorizon };

})();
