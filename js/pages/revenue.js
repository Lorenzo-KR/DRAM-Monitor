/**
 * pages/revenue.js
 * 매출 현황 — 월별/연도별/전체 누적 + 차트
 */

Pages.Revenue = (() => {

  let _mode = 'month';
  let _charts = {};

  function setMode(m) {
    _mode = m;
    ['month','year','all'].forEach(x => {
      const btn = document.getElementById('rv-mode-' + x); if (!btn) return;
      btn.style.background = x === m ? 'var(--navy)' : 'var(--card)';
      btn.style.color      = x === m ? '#fff' : 'var(--tx)';
    });
    document.getElementById('rv-mo').style.display = m === 'month' ? '' : 'none';
    document.getElementById('rv-yr').style.display = m === 'year'  ? '' : 'none';
    render();
  }

  function _buildMonthSelect() {
    const sel = document.getElementById('rv-mo'); if (!sel) return;
    const ms  = new Set([currentMonth()]);
    Store.getInvoices().forEach(r => { if (r.date) ms.add(String(r.date).slice(0, 7)); });
    const sorted = [...ms].sort().reverse();
    sel.innerHTML = sorted.map(m => `<option value="${m}"${m === currentMonth() ? ' selected' : ''}>${m}</option>`).join('');
  }

  function _buildYearSelect() {
    const sel = document.getElementById('rv-yr'); if (!sel) return;
    const ys  = new Set([String(new Date().getFullYear())]);
    Store.getInvoices().forEach(r => { if (r.date) ys.add(String(r.date).slice(0, 4)); });
    const sorted = [...ys].sort().reverse();
    sel.innerHTML = sorted.map(y => `<option value="${y}"${y === String(new Date().getFullYear()) ? ' selected' : ''}>${y}년</option>`).join('');
  }

  function render() {
    _buildMonthSelect(); _buildYearSelect();
    const biz = document.getElementById('rv-biz')?.value || '';
    const co  = document.getElementById('rv-co')?.value  || '';
    const tick = '#9aa0ad', grid = 'rgba(0,0,0,.05)';

    let fi, periodLabel;
    if (_mode === 'month') {
      const mo = document.getElementById('rv-mo')?.value || currentMonth();
      fi = Store.getInvoices().filter(r => String(r.date || '').startsWith(mo) && (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = mo;
    } else if (_mode === 'year') {
      const yr = document.getElementById('rv-yr')?.value || String(new Date().getFullYear());
      fi = Store.getInvoices().filter(r => String(r.date || '').startsWith(yr) && (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = yr + '년';
    } else {
      fi = Store.getInvoices().filter(r => (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = '전체 누적';
    }

    const totB = fi.reduce((s, r) => s + parseNumber(r.amount), 0);
    const hkB  = fi.filter(r => r.country === 'HK').reduce((s, r) => s + parseNumber(r.amount), 0);
    const sgB  = fi.filter(r => r.country === 'SG').reduce((s, r) => s + parseNumber(r.amount), 0);

    const topEl = document.getElementById('rv-top'); if (!topEl) return;
    topEl.innerHTML =
      renderMetricCard('총 청구액', formatNumberShort(totB), periodLabel + ' · ' + fi.length + '건', CONFIG.BIZ_COLORS.DRAM) +
      renderMetricCard('홍콩', formatNumberShort(hkB), fi.filter(r => r.country === 'HK').length + '건', CONFIG.COUNTRY_COLORS.HK) +
      renderMetricCard('싱가포르', formatNumberShort(sgB), fi.filter(r => r.country === 'SG').length + '건', CONFIG.COUNTRY_COLORS.SG) +
      renderMetricCard('건수', fi.length + '건', '인보이스');

    // 테이블
    const tbody = document.getElementById('rv-tbody'); if (!tbody) return;
    const sorted = [...fi].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!sorted.length) { tbody.innerHTML = `<tr><td colspan="11"><div class="empty">데이터 없음</div></td></tr>`; }
    else {
      tbody.innerHTML = sorted.map(r => {
        const due     = r.due ? diffDays(today(), r.due) : null;
        const dueColor = r.status === 'paid' ? '#166534' : due !== null && due < 0 ? '#dc2626' : due !== null && due <= 7 ? '#92400e' : 'var(--tx2)';
        const dueText  = r.status === 'paid' ? '수금완료' : due === null ? '-' : due < 0 ? 'D+' + Math.abs(due) : 'D-' + due;
        const stBadge  = r.status === 'paid' ? '<span class="bdg b-ok">수금완료</span>' : r.status === 'partial' ? '<span class="bdg b-warn">부분수금</span>' : '<span class="bdg b-warn">미수금</span>';
        return `<tr>
          <td style="padding:8px 10px;font-size:12px">${r.date || '-'}</td>
          <td style="padding:8px 10px;font-family:var(--font-mono);font-size:11px">${r.no || '-'}</td>
          <td style="padding:8px 10px;font-size:12px">${r.lotNo || '-'}</td>
          <td style="padding:8px 10px">${renderBizTag(r.biz)}</td>
          <td style="padding:8px 10px">${renderCountryTag(r.country)}</td>
          <td style="padding:8px 10px;font-size:12px">${r.customerName || '-'}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:600;font-family:var(--font-mono)">${formatNumber(parseNumber(r.amount))}</td>
          <td style="padding:8px 10px;font-size:12px">${r.currency || 'USD'}</td>
          <td style="padding:8px 10px;font-size:12px;color:${dueColor}">${r.due || '-'}${due !== null ? ' (' + dueText + ')' : ''}</td>
          <td style="padding:8px 10px">${stBadge}</td>
          <td style="padding:4px 8px">
            ${r.status !== 'paid' ? `<button class="btn sm" style="font-size:11px" onclick="Pages.Invoice.quickPaid(${r.id})">수금</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    // 차트
    _renderCharts(fi, tick, grid);
  }

  function _renderCharts(fi, tick, grid) {
    ['rev','biz'].forEach(k => { if (_charts[k]) { _charts[k].destroy(); _charts[k] = null; } });

    // 청구액 추이 (월별)
    const revCanvas = document.getElementById('cv-rev'); if (!revCanvas) return;
    const months = [...new Set(fi.map(r => String(r.date || '').slice(0, 7)))].sort();
    if (months.length) {
      _charts.rev = new Chart(revCanvas, {
        type: 'bar',
        data: {
          labels: months.map(m => m.slice(5) + '월'),
          datasets: [{ label: '청구액', data: months.map(m => fi.filter(r => String(r.date || '').startsWith(m)).reduce((s, r) => s + parseNumber(r.amount), 0)), backgroundColor: CONFIG.BIZ_COLORS.DRAM + '55', borderColor: CONFIG.BIZ_COLORS.DRAM, borderWidth: 2, borderRadius: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: tick, font: { size: 11 } } }, y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: v => formatNumberShort(v) }, beginAtZero: true } } },
      });
    }

    // 사업별 비중 (도넛)
    const bizCanvas = document.getElementById('cv-biz'); if (!bizCanvas) return;
    const bizData = CONFIG.BIZ_LIST.map(b => fi.filter(r => r.biz === b).reduce((s, r) => s + parseNumber(r.amount), 0));
    if (bizData.some(v => v > 0)) {
      _charts.biz = new Chart(bizCanvas, {
        type: 'doughnut',
        data: { labels: CONFIG.BIZ_LIST.map(b => CONFIG.BIZ_LABELS[b]), datasets: [{ data: bizData, backgroundColor: CONFIG.BIZ_LIST.map(b => CONFIG.BIZ_COLORS[b] + 'cc'), borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, color: tick, boxWidth: 10, padding: 10 } } } },
      });
    }
  }

  function exportExcel() { Pages.Invoice.exportExcel(); }

  return { render, setMode };

})();
