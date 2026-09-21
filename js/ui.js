/**
 * FinanFlow Pro - UI Controller Module
 * Handles DOM rendering, formatting, toast notifications, modals, and user interactions.
 */

import { appState } from './state.js';
import { calculateProjections } from './projections.js';
import { renderCharts } from './charts.js';

// Currency Symbols & Formatters
const CURRENCY_CONFIG = {
  USD: { symbol: '$', locale: 'en-US' },
  COP: { symbol: '$', locale: 'es-CO' },
  EUR: { symbol: '€', locale: 'de-DE' },
  MXN: { symbol: '$', locale: 'es-MX' },
  ARS: { symbol: '$', locale: 'es-AR' },
  CLP: { symbol: '$', locale: 'es-CL' },
  PEN: { symbol: 'S/', locale: 'es-PE' }
};

export function formatCurrency(amount, currencyCode = appState.getCurrency()) {
  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.USD;
  const num = parseFloat(amount) || 0;
  return num.toLocaleString(config.locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Toast Notifications
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal Helpers
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

/**
 * MAIN RENDER METHOD - Called whenever state updates
 */
export function renderUI() {
  updateHeaderControls();
  renderKPIs();
  renderPaymentsTable();
  renderProjectionsView();
  renderCharts();
}

/**
 * 1. HEADER CONTROLS (Month & Currency & Theme)
 */
function updateHeaderControls() {
  const monthYearKey = appState.getActiveMonthYear();
  const [yearStr, monthStr] = monthYearKey.split('-');
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  
  const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  
  const monthDisplay = document.getElementById('month-year-text');
  if (monthDisplay) monthDisplay.textContent = formattedMonth;

  // Update Currency Symbols across UI labels
  const currency = appState.getCurrency();
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = CURRENCY_CONFIG[currency]?.symbol || '$';
  });

  // Sync currency dropdown value
  const currSelect = document.getElementById('currency-select');
  if (currSelect) currSelect.value = currency;

  // Sync HTML Theme attribute
  document.documentElement.setAttribute('data-theme', appState.getTheme());
  const themeBtnIcon = document.querySelector('#theme-toggle-btn i');
  if (themeBtnIcon) {
    themeBtnIcon.className = appState.getTheme() === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
}

/**
 * 2. TOP KPI SUMMARY CARDS
 */
function renderKPIs() {
  const totals = appState.getPaymentsTotals();
  const currency = appState.getCurrency();

  // Income Card
  const incomeInfo = appState.getIncomeSourceInfo();
  document.getElementById('kpi-income-value').textContent = formatCurrency(totals.totalIncome, currency);
  document.getElementById('kpi-income-subtext').textContent = incomeInfo.sourceText;

  // Paid Card
  document.getElementById('kpi-paid-value').textContent = formatCurrency(totals.totalPaid, currency);
  document.getElementById('kpi-paid-subtext').textContent = `${totals.countPaid} de ${totals.totalCount} pagos completados`;

  // Pending Card
  document.getElementById('kpi-pending-value').textContent = formatCurrency(totals.totalPending, currency);
  document.getElementById('kpi-pending-subtext').textContent = `${totals.countPending} compromisos pendientes`;

  // Balance Card
  const balanceValEl = document.getElementById('kpi-balance-value');
  balanceValEl.textContent = formatCurrency(totals.availableBalance, currency);

  const balanceCard = document.getElementById('balance-card-container');
  if (totals.availableBalance < 0) {
    balanceCard.classList.add('balance-negative');
    document.getElementById('kpi-balance-subtext').textContent = '⚠️ Saldo negativo. Revisa tus gastos.';
  } else {
    balanceCard.classList.remove('balance-negative');
    document.getElementById('kpi-balance-subtext').textContent = 'Saldo libre tras cubrir compromisos';
  }

  // Budget Fill Bar
  const spentPct = totals.totalIncome > 0 ? Math.min(100, (totals.totalExpenses / totals.totalIncome) * 100) : 0;
  const fillEl = document.getElementById('budget-progress-fill');
  if (fillEl) fillEl.style.width = `${spentPct}%`;
}

/**
 * 3. PAYMENTS TABLE & FILTERS
 */
function renderPaymentsTable() {
  const tbody = document.getElementById('payments-tbody');
  const emptyState = document.getElementById('empty-payments-state');
  if (!tbody) return;

  const monthData = appState.getActiveMonthData();
  let payments = [...monthData.payments];

  // Apply Search Filter
  const searchText = (document.getElementById('search-payment-input')?.value || '').toLowerCase();
  if (searchText) {
    payments = payments.filter(p => p.concept.toLowerCase().includes(searchText) || (p.notes && p.notes.toLowerCase().includes(searchText)));
  }

  // Apply Category Filter
  const catFilter = document.getElementById('filter-category-select')?.value || 'ALL';
  if (catFilter !== 'ALL') {
    payments = payments.filter(p => p.category === catFilter);
  }

  // Apply Status Filter
  const statusFilter = document.getElementById('filter-status-select')?.value || 'ALL';
  if (statusFilter !== 'ALL') {
    payments = payments.filter(p => p.status === statusFilter);
  }

  // Apply Sort
  const sortVal = document.getElementById('sort-payment-select')?.value || 'date-desc';
  payments.sort((a, b) => {
    if (sortVal === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortVal === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortVal === 'amount-desc') return b.amount - a.amount;
    if (sortVal === 'amount-asc') return a.amount - b.amount;
    return 0;
  });

  if (payments.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  const currency = appState.getCurrency();

  tbody.innerHTML = payments.map(p => {
    const isPaid = p.status === 'PAID';
    const formattedDate = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'N/A';

    return `
      <tr>
        <td>
          <span class="concept-title">${escapeHTML(p.concept)}</span>
          ${p.notes ? `<span class="concept-notes">${escapeHTML(p.notes)}</span>` : ''}
        </td>
        <td>
          <span class="badge badge-category">${p.category || 'Otros'}</span>
        </td>
        <td>${formattedDate}</td>
        <td><span class="badge-method">${p.method || 'Transferencia'}</span></td>
        <td class="font-bold">${formatCurrency(p.amount, currency)}</td>
        <td>
          <span class="badge ${isPaid ? 'badge-paid' : 'badge-pending'}">
            <i class="fa-solid ${isPaid ? 'fa-check' : 'fa-clock'}"></i>
            ${isPaid ? 'Pagado' : 'Pendiente'}
          </span>
        </td>
        <td class="text-right">
          <div class="action-buttons">
            <button class="btn-toggle-status ${isPaid ? 'to-pending' : 'to-paid'}" data-action="toggle-status" data-id="${p.id}">
              <i class="fa-solid ${isPaid ? 'fa-rotate-left' : 'fa-check'}"></i>
              ${isPaid ? 'Deshacer' : 'Pagar'}
            </button>
            <button class="btn-table-icon" data-action="edit-payment" data-id="${p.id}" title="Editar">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-table-icon delete" data-action="delete-payment" data-id="${p.id}" title="Eliminar">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 4. PROJECTIONS SIMULATOR VIEW & IMPACT METRICS
 */
function renderProjectionsView() {
  const projContainer = document.getElementById('projections-list');
  const emptyState = document.getElementById('empty-projections-state');
  if (!projContainer) return;

  const projections = appState.getProjections();
  const countBadge = document.getElementById('proj-count-badge');
  if (countBadge) countBadge.textContent = `${projections.length} escenario(s)`;

  if (projections.length === 0) {
    projContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    const currency = appState.getCurrency();

    projContainer.innerHTML = projections.map(p => `
      <div class="projection-item">
        <div class="proj-item-left">
          <input type="checkbox" class="proj-checkbox" data-action="toggle-proj" data-id="${p.id}" ${p.selected ? 'checked' : ''}>
          <div>
            <div class="proj-title">${escapeHTML(p.concept)}</div>
            <div class="proj-meta">${p.category} | ${p.installments > 1 ? `${p.installments} cuotas` : 'Pago único'}</div>
          </div>
        </div>
        <div class="flex-align-center gap-sm">
          <span class="proj-amount">-${formatCurrency(p.amount / (p.installments || 1), currency)}</span>
          <button class="btn-table-icon delete" data-action="delete-proj" data-id="${p.id}">&times;</button>
        </div>
      </div>
    `).join('');
  }

  // Update Impact Analysis Metrics
  const projData = calculateProjections();
  const currency = appState.getCurrency();

  document.getElementById('sim-current-balance').textContent = formatCurrency(projData.currentBalance, currency);
  document.getElementById('sim-projected-cost').textContent = `-${formatCurrency(projData.totalProjectedCost, currency)}`;
  
  const resValEl = document.getElementById('sim-resulting-balance');
  resValEl.textContent = formatCurrency(projData.resultingBalance, currency);
  resValEl.style.color = projData.resultingBalance >= 0 ? '#10B981' : '#EF4444';

  // Status Banner
  const banner = document.getElementById('liquidity-banner');
  const bannerTitle = document.getElementById('liquidity-title');
  const bannerDesc = document.getElementById('liquidity-desc');

  bannerTitle.textContent = projData.title;
  bannerDesc.textContent = projData.description;

  if (projData.liquidityStatus === 'DANGER') {
    banner.className = 'status-banner banner-danger';
  } else if (projData.liquidityStatus === 'WARNING') {
    banner.className = 'status-banner banner-warning';
  } else {
    banner.className = 'status-banner banner-success';
  }
}

// Utility: Trigger Confetti animation
export function triggerConfetti() {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// Utility: XSS escape
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
