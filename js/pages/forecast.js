/**
 * pages/forecast.js
 * 매출 예측 — 국가 × 사업 매트릭스로 월평균·트렌드 기반 향후 매출 예측
 *
 * 데이터 소스:
 *   매출액 = invoices 의 amount (invoice date 월·biz·country 필터)
 *   입고량 = lots 의 qty (inDate 월·biz·country 필터)
 *   평균단가 = 매출액 / 입고량
 *
 * 예측 방식:
 *   ① 단순 월평균 — 실적 월평균을 미래 N개월에 동일 적용
 *   ② 선형 회귀 — y=ax+b 외삽
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

  function _bucketize(country, biz, year, cutoffMonth) {
    const yr   = String(year);
    const invs = Store.getInvoices().filter(r => String(r.date   || '').startsWith(yr) && r.biz === biz && r.country === country);
    const lots = Store.getLots()    .filter(r => String(r.inDate || '').startsWith(yr) && r.biz === biz && r.country === country);
    const monthly = [];
    for (let m = 1; m <= cutoffMonth; m++) {
      const ym  = yr + '-' + String(m).padStart(2, '0');
      const rev = invs.filter(r => String(r.date   || '').startsWith(ym)).reduce((s, r) => s + parseNumber(r.amount), 0);
      const qty = lots.filter(r => String(r.inDate || '').startsWith(ym)).reduce((s, r) => s + parseNumber(r.qty),    0);
      const avg = qty > 0 ? rev / qty : 0;
      monthly.push({ m, ym, rev, qty, avg });
    }
    return monthly;
  }

  function _autoCutoff(year) {
    const t = new Date();
    if (t.getFullYear() < year) return 0;
    if (t.getFullYear() > year) return 12;
    return Math.max(1, t.getMonth());
  }

  // ── 셀 렌더 ─────────────────────────────────────────────────
  function _renderCell(country, biz, year, cutoff, horizon) {
    const monthly = _bucketize(country, biz, year, cutoff);
    const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);

    const avgRev = nonZero.length ? nonZero.reduce((s, x) => s + x.rev, 0) / nonZero.length : 0;
    const avgQty = nonZero.length ? nonZero.reduce((s, x) => s + x.qty, 0) / nonZero.length : 0;
    const avgPrc = avgQty > 0 ? avgRev / avgQty : 0;

    const xs = nonZero.map(x => x.m);
    const reg = _regression(xs, nonZero.map(x => x.rev));

    const forecast = [];
    for (let m = cutoff + 1; m <= Math.min(cutoff + horizon, 12); m++) {
      const flat  = avgRev;
      const trend = Math.max(0, reg.slope * m + reg.intercept);
      forecast.push({ m, flat, trend, mid: (flat + trend) / 2 });
    }

    const num = (v) => formatNumber(Math.round(v));
    const usd = (v) => '$' + num(v);

    const monthRows = monthly.map(x => `
      <tr>
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${String(x.m).padStart(2,'0')}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx)">${x.rev > 0 ? usd(x.rev) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${x.qty > 0 ? num(x.qty) : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${x.avg > 0 ? '$' + x.avg.toFixed(2) : '—'}</td>
      </tr>`).join('');

    const actualSum = nonZero.reduce((s, x) => s + x.rev, 0);
    const actualQty = nonZero.reduce((s, x) => s + x.qty, 0);
    const sumRow = monthly.length ? `
      <tr style="border-top:1px solid var(--bd2)">
        <td style="padding:6px 10px;font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.05em">합계</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${usd(actualSum)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${num(actualQty)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--tx)">${actualQty > 0 ? '$' + (actualSum / actualQty).toFixed(2) : '—'}</td>
      </tr>` : '';

    const fcRows = forecast.length ? forecast.map(f => `
      <tr>
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px;color:var(--tx2);font-style:italic">${String(f.m).padStart(2,'0')}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${usd(f.flat)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx2)">${usd(f.trend)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:var(--tx);font-weight:600">${usd(f.mid)}</td>
      </tr>`).join('') : '<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--tx3);font-size:12px">예측 구간 없음</td></tr>';

    const trendLabel = !nonZero.length ? '데이터 없음'
      : reg.slope === 0 ? '추세 평탄'
      : reg.slope > 0 ? `↑ +${usd(reg.slope)}/월` : `↓ ${usd(reg.slope)}/월`;

    return `
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs)">
        <div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:baseline">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--tx);letter-spacing:-.01em">${CONFIG.COUNTRY_LABELS[country] || country} · ${CONFIG.BIZ_LABELS[biz] || biz}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">실적 ${nonZero.length}개월 · ${trendLabel}</div>
          </div>
        </div>

        <div style="padding:14px 16px">
          <!-- 월평균 요약 -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--bd);padding-bottom:12px;margin-bottom:12px">
            <div style="padding-right:12px;border-right:1px solid var(--bd)">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월평균 매출</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${usd(avgRev)}</div>
            </div>
            <div style="padding:0 12px;border-right:1px solid var(--bd)">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월평균 입고량</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${num(avgQty)}</div>
            </div>
            <div style="padding-left:12px">
              <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">평균 단가</div>
              <div style="font-size:16px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:3px">${avgPrc > 0 ? '$' + avgPrc.toFixed(2) : '—'}</div>
            </div>
          </div>

          <!-- 실적 표 -->
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">실적</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
            <thead><tr style="border-bottom:1px solid var(--bd)">
              <th style="padding:5px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">매출 (USD)</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">입고량</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">평균 단가</th>
            </tr></thead>
            <tbody>${monthRows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--tx3);font-size:12px">데이터 없음</td></tr>'}${sumRow}</tbody>
          </table>

          <!-- 예측 표 -->
          <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">예측</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--bd)">
              <th style="padding:5px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">월</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em" title="단순 월평균 적용">평균 기준</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em" title="선형회귀 외삽">트렌드</th>
              <th style="padding:5px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">중간값</th>
            </tr></thead>
            <tbody>${fcRows}</tbody>
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
    let totalActualRev = 0, totalActualQty = 0, totalFcMid = 0;
    MATRIX.forEach(({ co, biz }) => {
      const monthly = _bucketize(co, biz, _year, cutoff);
      const nonZero = monthly.filter(x => x.rev > 0 || x.qty > 0);
      const aR = nonZero.length ? nonZero.reduce((s, x) => s + x.rev, 0) / nonZero.length : 0;
      totalActualRev += nonZero.reduce((s, x) => s + x.rev, 0);
      totalActualQty += nonZero.reduce((s, x) => s + x.qty, 0);

      const xs = nonZero.map(x => x.m);
      const reg = _regression(xs, nonZero.map(x => x.rev));
      for (let m = cutoff + 1; m <= Math.min(cutoff + horizon, 12); m++) {
        const trend = Math.max(0, reg.slope * m + reg.intercept);
        totalFcMid += (aR + trend) / 2;
      }
    });

    const cutoffLabel = `1–${cutoff}월`;
    const fcEnd       = Math.min(cutoff + horizon, 12);
    const fcLabel     = `${cutoff + 1}–${fcEnd}월`;
    const usd         = (v) => '$' + formatNumber(Math.round(v));
    const num         = (v) => formatNumber(Math.round(v));

    root.innerHTML = `
      <div class="ph"><h1>매출 예측</h1><p>국가 · 사업 매트릭스 — 실적 월평균 및 선형 추세 기반 향후 매출 전망</p></div>

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
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${cutoffLabel}</div>
          </div>
          <div style="padding:0 24px;border-right:1px solid var(--bd)">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">실적 입고량 합계</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:4px;letter-spacing:-.02em">${num(totalActualQty)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${cutoffLabel}</div>
          </div>
          <div style="padding-left:24px">
            <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em">예측 매출 합계 (중간값)</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx);font-family:var(--font-mono);margin-top:4px;letter-spacing:-.02em">${usd(totalFcMid)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${fcLabel}</div>
          </div>
        </div>
      </div>

      <!-- 4셀 매트릭스 -->
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        ${MATRIX.map(({ co, biz }) => _renderCell(co, biz, _year, cutoff, horizon)).join('')}
      </div>

      <!-- 방식 설명 -->
      <div style="margin-top:18px;padding:14px 18px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);font-size:12px;color:var(--tx2);line-height:1.7">
        <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">예측 방식</div>
        <div><b style="color:var(--tx);font-weight:600">평균 기준</b> · 실적 월평균을 미래 각 월에 동일 적용. 변동이 적은 사업에 적합</div>
        <div><b style="color:var(--tx);font-weight:600">트렌드</b> · 선형회귀(y = a·월 + b)로 외삽. 기울기 크기로 추세 강도 파악</div>
        <div><b style="color:var(--tx);font-weight:600">중간값</b> · 두 값의 단순 평균 — 평균과 트렌드 절충</div>
        <div style="margin-top:6px;font-size:11px;color:var(--tx3)">매출은 invoice amount 원값 합산 (FX 변환 없음). 통화 혼재 시 절대값보다 추세 해석에 활용 권장</div>
      </div>`;
  }

  function setYear(y)    { _year    = Number(y); render(); }
  function setCutoff(m)  { _cutoff  = Number(m); render(); }
  function setHorizon(h) { _horizon = Number(h); render(); }

  return { render, setYear, setCutoff, setHorizon };

})();
