/**
 * pages/forecast.js
 * 매출 예측 — 국가 × 사업 매트릭스
 *
 * 산정 공식 (직전월 기준):
 *   월평균 입고량 = Σ(lots.qty by inDate) / N (cutoff까지의 월 수)
 *   평균 단가     = avg(lots.price)  ← LOT별 단가의 단순 평균
 *   월 예측 매출  = 월평균 입고량 × 평균 단가  ← 각 예측 월에 동일 적용
 *
 * 실적 행은 invoice.amount(매출 실적) 와 lots.qty(입고 실적) 를 월별 표시.
 * UI 규칙: 모노톤 / 색 최소화 — feedback_ui_style 메모리 참조
 */

Pages.Forecast = (() => {

  let _year    = new Date().getFullYear();
  let _cutoff  = 0;
  let _horizon = 3;

  const MATRIX = [
    { co: 'HK', biz: 'DRAM' },
    { co: 'HK', biz: 'SSD'  },
    { co: 'SG', biz: 'DRAM' },
    { co: 'SG', biz: 'SSD'  },
  ];

  function _bucketize(country, biz, year, cutoffMonth) {
    const yr   = String(year);
    const invs = Store.getInvoices().filter(r => String(r.date   || '').startsWith(yr) && r.biz === biz && r.country === country);
    const lots = Store.getLots()    .filter(r => String(r.inDate || '').startsWith(yr) && r.biz === biz && r.country === country);
    const monthly = [];
    for (let m = 1; m <= cutoffMonth; m++) {
      const ym  = yr + '-' + String(m).padStart(2, '0');
      const monthInvs = invs.filter(r => String(r.date   || '').startsWith(ym));
      const monthLots = lots.filter(r => String(r.inDate || '').startsWith(ym));
      const rev = monthInvs.reduce((s, r) => s + parseNumber(r.amount), 0);
      const qty = monthLots.reduce((s, r) => s + parseNumber(r.qty),    0);
      // 월 LOT 단가 평균 (해당 월에 입고된 LOT의 price 단순 평균)
      const lotPrices = monthLots.map(r => parseNumber(r.price)).filter(p => p > 0);
      const monthAvgPrice = lotPrices.length ? lotPrices.reduce((s, p) => s + p, 0) / lotPrices.length : 0;
      monthly.push({ m, ym, rev, qty, monthAvgPrice, lotCount: monthLots.length });
    }
    return { monthly, allLots: lots };
  }

  function _autoCutoff(year) {
    const t = new Date();
    if (t.getFullYear() < year) return 0;
    if (t.getFullYear() > year) return 12;
    return Math.max(1, t.getMonth());
  }

  // ── 셀 렌더 (1국가×1사업) ──────────────────────────────────
  function _renderCell(country, biz, year, cutoff, horizon) {
    const { monthly, allLots } = _bucketize(country, biz, year, cutoff);
    const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);

    // 월평균 입고량 — 데이터 있는 월의 평균 (없는 월 제외)
    const avgMonthlyQty = nonZero.length ? nonZero.reduce((s, x) => s + x.qty, 0) / nonZero.length : 0;

    // 평균 단가 — cutoff 구간 내 모든 LOT의 price 단순 평균
    const lotPrices = allLots
      .filter(l => {
        const m = parseInt(String(l.inDate || '').slice(5, 7), 10);
        return m >= 1 && m <= cutoff;
      })
      .map(l => parseNumber(l.price))
      .filter(p => p > 0);
    const avgPrice = lotPrices.length ? lotPrices.reduce((s, p) => s + p, 0) / lotPrices.length : 0;

    const forecastPerMonth = avgMonthlyQty * avgPrice;

    const forecast = [];
    for (let m = cutoff + 1; m <= Math.min(cutoff + horizon, 12); m++) {
      forecast.push({ m, rev: forecastPerMonth });
    }

    // 실적 매출 평균 (참조용)
    const avgActualRev = nonZero.length ? nonZero.reduce((s, x) => s + x.rev, 0) / nonZero.length : 0;

    const num = (v) => formatNumber(Math.round(v));
    const usd = (v) => '$' + num(v);

    const monthRows = monthly.map(x => `
      <tr>
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${String(x.m).padStart(2,'0')}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${x.qty > 0 ? num(x.qty) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${x.monthAvgPrice > 0 ? '$' + x.monthAvgPrice.toFixed(2) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx)">${x.rev > 0 ? usd(x.rev) : '—'}</td>
      </tr>`).join('');

    const actualSumQty = nonZero.reduce((s, x) => s + x.qty, 0);
    const actualSumRev = nonZero.reduce((s, x) => s + x.rev, 0);
    const sumRow = monthly.length ? `
      <tr style="border-top:1px solid var(--bd2)">
        <td style="padding:6px 10px;font-size:10px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.05em">평균</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${num(avgMonthlyQty)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${avgPrice > 0 ? '$' + avgPrice.toFixed(2) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${usd(avgActualRev)}</td>
      </tr>` : '';

    const fcRows = forecast.length ? forecast.map(f => `
      <tr>
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px;color:var(--tx2);font-style:italic">${String(f.m).padStart(2,'0')}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2);font-style:italic">${num(avgMonthlyQty)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2);font-style:italic">${avgPrice > 0 ? '$' + avgPrice.toFixed(2) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx);font-weight:600">${usd(f.rev)}</td>
      </tr>`).join('') : '<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--tx3);font-size:12px">예측 구간 없음</td></tr>';

    const fcSumRow = forecast.length ? `
      <tr style="border-top:1px solid var(--bd2)">
        <td style="padding:6px 10px;font-size:10px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.05em">합계</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${num(avgMonthlyQty * forecast.length)}</td>
        <td style="padding:6px 10px"></td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${usd(forecastPerMonth * forecast.length)}</td>
      </tr>` : '';

    return `
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs)">
        <div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:baseline">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--tx);letter-spacing:-.01em">${CONFIG.COUNTRY_LABELS[country] || country} · ${CONFIG.BIZ_LABELS[biz] || biz}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">실적 ${nonZero.length}개월 · LOT ${lotPrices.length}건</div>
          </div>
        </div>

        <div style="padding:14px 16px">
          <!-- 핵심 지표 -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--bd);padding-bottom:12px;margin-bottom:12px">
            <div style="padding-right:12px;border-right:1px solid var(--bd)">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월평균 입고량</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${num(avgMonthlyQty)}</div>
            </div>
            <div style="padding:0 12px;border-right:1px solid var(--bd)">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">평균 단가</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${avgPrice > 0 ? '$' + avgPrice.toFixed(2) : '—'}</div>
            </div>
            <div style="padding-left:12px">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월 예측 매출</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${usd(forecastPerMonth)}</div>
            </div>
          </div>

          <!-- 실적 표 -->
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">실적</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
            <thead><tr style="border-bottom:1px solid var(--bd)">
              <th style="padding:5px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">입고량</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">LOT 평균단가</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">매출 실적 (USD)</th>
            </tr></thead>
            <tbody>${monthRows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--tx3);font-size:12px">데이터 없음</td></tr>'}${sumRow}</tbody>
          </table>

          <!-- 예측 표 -->
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">예측 — 월평균 입고량 × 평균 단가</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--bd)">
              <th style="padding:5px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">예상 입고량</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">단가</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">예측 매출</th>
            </tr></thead>
            <tbody>${fcRows}${fcSumRow}</tbody>
          </table>
        </div>
      </div>`;
  }

  function render() {
    const root = document.getElementById('forecast-root');
    if (!root) return;

    const auto    = _autoCutoff(_year);
    const cutoff  = _cutoff > 0 ? _cutoff : auto;
    const horizon = _horizon;

    // 상단 합계
    let totalActualRev = 0, totalActualQty = 0, totalFc = 0;
    MATRIX.forEach(({ co, biz }) => {
      const { monthly, allLots } = _bucketize(co, biz, _year, cutoff);
      const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);
      totalActualRev += nonZero.reduce((s, x) => s + x.rev, 0);
      totalActualQty += nonZero.reduce((s, x) => s + x.qty, 0);

      const aQ = nonZero.length ? nonZero.reduce((s, x) => s + x.qty, 0) / nonZero.length : 0;
      const lotPrices = allLots
        .filter(l => {
          const m = parseInt(String(l.inDate || '').slice(5, 7), 10);
          return m >= 1 && m <= cutoff;
        })
        .map(l => parseNumber(l.price))
        .filter(p => p > 0);
      const aP = lotPrices.length ? lotPrices.reduce((s, p) => s + p, 0) / lotPrices.length : 0;
      const fcMonths = Math.min(cutoff + horizon, 12) - cutoff;
      totalFc += aQ * aP * Math.max(0, fcMonths);
    });

    const cutoffLabel = `1–${cutoff}월`;
    const fcEnd       = Math.min(cutoff + horizon, 12);
    const fcLabel     = `${cutoff + 1}–${fcEnd}월`;
    const usd         = (v) => '$' + formatNumber(Math.round(v));
    const num         = (v) => formatNumber(Math.round(v));

    root.innerHTML = `
      <div class="ph"><h1>매출 예측</h1><p>월평균 입고량 × LOT 평균 단가 — 직전월까지의 실적 기반</p></div>

      <!-- 필터 -->
      <div style="display:flex;gap:18px;align-items:center;padding:12px 0 16px;border-bottom:1px solid var(--bd);margin-bottom:18px">
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">연도</span>
          <select onchange="Pages.Forecast.setYear(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card);color:var(--tx)">
            ${[2025, 2026, 2027].map(y => `<option value="${y}"${_year === y ? ' selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">실적 기준</span>
          <select onchange="Pages.Forecast.setCutoff(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card);color:var(--tx)">
            <option value="0"${_cutoff === 0 ? ' selected' : ''}>자동 (지난달까지)</option>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}"${_cutoff === m ? ' selected' : ''}>${m}월까지</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">예측 구간</span>
          <select onchange="Pages.Forecast.setHorizon(this.value)" style="padding:5px 10px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;background:var(--card);color:var(--tx)">
            ${[1,2,3,6].map(h => `<option value="${h}"${_horizon === h ? ' selected' : ''}>${h}개월</option>`).join('')}
          </select>
        </div>
        <span style="margin-left:auto;font-size:11px;color:var(--tx3);font-family:var(--font-mono)">실적 ${cutoffLabel} · 예측 ${fcLabel}</span>
      </div>

      <!-- 상단 요약 -->
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:18px 22px;margin-bottom:18px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0">
          <div style="padding-right:24px;border-right:1px solid var(--bd)">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">실적 매출 합계</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:4px;letter-spacing:-.02em">${usd(totalActualRev)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${cutoffLabel} · 4셀 합산</div>
          </div>
          <div style="padding:0 24px;border-right:1px solid var(--bd)">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">실적 입고량 합계</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:4px;letter-spacing:-.02em">${num(totalActualQty)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${cutoffLabel} · 4셀 합산</div>
          </div>
          <div style="padding-left:24px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">예측 매출 합계</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:4px;letter-spacing:-.02em">${usd(totalFc)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${fcLabel} · 월평균 유지 가정</div>
          </div>
        </div>
      </div>

      <!-- 4셀 매트릭스 -->
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        ${MATRIX.map(({ co, biz }) => _renderCell(co, biz, _year, cutoff, horizon)).join('')}
      </div>

      <!-- 방식 설명 -->
      <div style="margin-top:18px;padding:14px 18px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);font-size:12px;color:var(--tx2);line-height:1.7">
        <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">예측 산정 방식</div>
        <div><b style="color:var(--tx);font-weight:600">가정</b> · 직전월까지의 월평균 입고량이 다음 월에도 유지됨</div>
        <div><b style="color:var(--tx);font-weight:600">월평균 입고량</b> · 실적 데이터가 있는 월의 입고량 평균 (lots.qty · inDate 기준)</div>
        <div><b style="color:var(--tx);font-weight:600">평균 단가</b> · 실적 구간 내 모든 LOT의 단가(lots.price) 단순 평균</div>
        <div><b style="color:var(--tx);font-weight:600">월 예측 매출</b> · 월평균 입고량 × 평균 단가 — 모든 예측 월에 동일 적용</div>
      </div>`;
  }

  function setYear(y)    { _year    = Number(y); render(); }
  function setCutoff(m)  { _cutoff  = Number(m); render(); }
  function setHorizon(h) { _horizon = Number(h); render(); }

  return { render, setYear, setCutoff, setHorizon };

})();
