/**
 * FinanFlow Pro - Interactive Charts Module
 * Manages Chart.js visualisations for category breakdown, projections impact, and monthly trends.
 */

import { appState } from './state.js';
import { calculateProjections } from './projections.js';

let projectionChartInstance = null;
let categoryPieChartInstance = null;
let monthlyTrendChartInstance = null;

// Category Color Map
const CATEGORY_COLORS = {
  'Vivienda': '#6366F1',       // Indigo
  'Servicios': '#3B82F6',      // Blue
  'Alimentación': '#10B981',   // Emerald
  'Transporte': '#F59E0B',     // Amber
  'Deudas': '#EF4444',         // Red
  'Entretenimiento': '#8B5CF6',// Purple
  'Salud': '#EC4899',          // Pink
  'Ahorro': '#14B8A6',         // Teal
  'Otros': '#64748B'           // Slate
};

export function renderCharts() {
  renderProjectionChart();
  renderCategoryPieChart();
  renderMonthlyTrendChart();
}

/**
 * 1. PROJECTION IMPACT COMPARISON CHART
 */
function renderProjectionChart() {
  const ctx = document.getElementById('projectionChart')?.getContext('2d');
  if (!ctx) return;

  const projData = calculateProjections();

  if (projectionChartInstance) {
    projectionChartInstance.destroy();
  }

  const isDark = appState.getTheme() === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';

  projectionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Saldo Actual', 'Impacto Proyección', 'Saldo Proyectado'],
      datasets: [{
        label: 'Monto ($)',
        data: [
          projData.currentBalance,
          projData.totalProjectedCost,
          projData.resultingBalance
        ],
        backgroundColor: [
          '#6366F1', // Indigo
          '#F59E0B', // Amber
          projData.resultingBalance >= 0 ? '#10B981' : '#EF4444' // Green or Red
        ],
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` $${context.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } },
          grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }
        },
        y: {
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: 'bold' } },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * 2. CATEGORY BREAKDOWN DONUT CHART
 */
function renderCategoryPieChart() {
  const ctx = document.getElementById('categoryPieChart')?.getContext('2d');
  if (!ctx) return;

  const monthData = appState.getActiveMonthData();
  const categoryTotals = {};

  monthData.payments.forEach(p => {
    const cat = p.category || 'Otros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(p.amount) || 0);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const bgColors = labels.map(cat => CATEGORY_COLORS[cat] || '#64748B');

  if (categoryPieChartInstance) {
    categoryPieChartInstance.destroy();
  }

  const isDark = appState.getTheme() === 'dark';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';

  if (labels.length === 0) {
    // Empty state chart
    categoryPieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sin pagos registrados'],
        datasets: [{ data: [1], backgroundColor: [isDark ? '#334155' : '#E2E8F0'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } }
      }
    });
    return;
  }

  categoryPieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: isDark ? '#0B0F19' : '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' },
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.label}: $${context.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        }
      },
      cutout: '68%'
    }
  });
}

/**
 * 3. MONTHLY TREND COMPARISON CHART
 */
function renderMonthlyTrendChart() {
  const ctx = document.getElementById('monthlyTrendChart')?.getContext('2d');
  if (!ctx) return;

  const monthsState = appState.state.months;
  const monthKeys = Object.keys(monthsState).sort();

  // If only 1 month exists, create display labels
  const labels = monthKeys.map(key => {
    const [y, m] = key.split('-');
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
  });

  const incomeData = monthKeys.map(key => {
    const m = monthsState[key];
    const base = m.income.base || 0;
    const extras = (m.income.extras || []).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
    return base + extras;
  });

  const expenseData = monthKeys.map(key => {
    const m = monthsState[key];
    return m.payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  });

  if (monthlyTrendChartInstance) {
    monthlyTrendChartInstance.destroy();
  }

  const isDark = appState.getTheme() === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';

  monthlyTrendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          backgroundColor: '#10B981',
          borderRadius: 6
        },
        {
          label: 'Gastos Totales',
          data: expenseData,
          backgroundColor: '#6366F1',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: isDark ? '#F1F5F9' : '#0F172A', font: { family: 'Plus Jakarta Sans' } }
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.dataset.label}: $${context.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } },
          grid: { display: false }
        },
        y: {
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } },
          grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}
