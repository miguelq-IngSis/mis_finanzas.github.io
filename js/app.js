/**
 * FinanFlow Pro - Main Application Controller
 * Bootstraps the app, connects event listeners, forms, modales, and state subscriptions.
 */

import { appState } from './state.js';
import { renderUI, openModal, closeModal, showToast, triggerConfetti } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Subscribe UI to State changes
  appState.subscribe(() => {
    renderUI();
  });

  // Initial Render
  renderUI();

  // Initialize Event Listeners
  initNavigation();
  initIncomeModal();
  initPaymentModal();
  initProjectionsForm();
  initTableAndListActions();
  initBackupAndDemo();
  initInstallPrompt();
  registerServiceWorker();
});

/** Installs the PWA when the browser supports the native prompt. */
function initInstallPrompt() {
  let deferredPrompt = null;
  const installBtn = document.getElementById('install-app-btn');

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) {
      openModal('install-help-modal');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    installBtn?.classList.add('hidden');
    showToast('FinanFlow se instaló correctamente', 'success');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
  }
}

/**
 * 1. NAVIGATION & HEADER CONTROLS
 */
function initNavigation() {
  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      const contentEl = document.getElementById(`tab-${targetTab}`);
      if (contentEl) contentEl.classList.add('active');

      // Re-render UI & Charts on tab switch
      renderUI();
    });
  });

  // Month Navigation
  document.getElementById('prev-month-btn')?.addEventListener('click', () => {
    appState.navigateMonth(-1);
  });

  document.getElementById('next-month-btn')?.addEventListener('click', () => {
    appState.navigateMonth(1);
  });

  // Currency Selection
  document.getElementById('currency-select')?.addEventListener('change', (e) => {
    appState.setCurrency(e.target.value);
    showToast(`Moneda cambiada a ${e.target.value}`, 'info');
  });

  // Theme Toggle
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const current = appState.getTheme();
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    appState.setTheme(nextTheme);
    showToast(`Modo ${nextTheme === 'dark' ? 'Oscuro' : 'Claro'} activado`, 'info');
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  // Search & Filter listeners for real-time table filtering
  ['search-payment-input', 'filter-category-select', 'filter-status-select', 'sort-payment-select'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => renderUI());
    document.getElementById(id)?.addEventListener('change', () => renderUI());
  });
}

/**
 * 2. INCOME MODAL CONTROLLER
 */
function initIncomeModal() {
  const editIncomeBtn = document.getElementById('edit-income-btn');
  const incomeModal = 'income-modal';
  const incomeForm = document.getElementById('income-form');
  const extraContainer = document.getElementById('extra-incomes-container');
  const addExtraBtn = document.getElementById('add-extra-income-btn');

  editIncomeBtn?.addEventListener('click', () => {
    const monthData = appState.getActiveMonthData();
    document.getElementById('income-base').value = monthData.income.base || '';
    
    const isNextMonthCheck = document.getElementById('income-next-month-fund');
    if (isNextMonthCheck) {
      isNextMonthCheck.checked = !!monthData.income.isNextMonthFund;
    }

    // Render extra income rows
    extraContainer.innerHTML = '';
    (monthData.income.extras || []).forEach(extra => {
      addExtraIncomeRow(extra.concept, extra.amount);
    });

    openModal(incomeModal);
  });

  addExtraBtn?.addEventListener('click', () => {
    addExtraIncomeRow('', '');
  });

  function addExtraIncomeRow(concept = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'extra-income-row';
    row.innerHTML = `
      <input type="text" class="extra-concept" placeholder="Concepto (ej: Freelance, Bonus)" value="${concept}">
      <div class="input-prefix" style="width: 140px;">
        <span class="currency-symbol">$</span>
        <input type="number" class="extra-amount" min="0" step="0.01" placeholder="0.00" value="${amount}">
      </div>
      <button type="button" class="btn-table-icon delete remove-extra-btn">&times;</button>
    `;
    row.querySelector('.remove-extra-btn').addEventListener('click', () => row.remove());
    extraContainer.appendChild(row);
  }

  incomeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const baseVal = parseFloat(document.getElementById('income-base').value) || 0;
    const isNextMonthFund = !!document.getElementById('income-next-month-fund')?.checked;

    const extras = [];
    document.querySelectorAll('.extra-income-row').forEach(row => {
      const c = row.querySelector('.extra-concept').value.trim();
      const a = parseFloat(row.querySelector('.extra-amount').value) || 0;
      if (c && a > 0) {
        extras.push({ id: 'ext_' + Date.now() + Math.random().toString(36).substr(2, 4), concept: c, amount: a });
      }
    });

    appState.setIncome(baseVal, extras, { isNextMonthFund });
    closeModal(incomeModal);
    showToast('Ingreso mensual actualizado correctamente', 'success');
  });
}

/**
 * 3. PAYMENT MODAL CONTROLLER (Create / Edit)
 */
function initPaymentModal() {
  const addBtn = document.getElementById('add-payment-btn');
  const modalId = 'payment-modal';
  const form = document.getElementById('payment-form');

  addBtn?.addEventListener('click', () => {
    document.getElementById('payment-modal-title').textContent = 'Registrar Nuevo Pago';
    form.reset();
    document.getElementById('payment-id').value = '';
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
    openModal(modalId);
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('payment-id').value;
    const paymentData = {
      concept: document.getElementById('pay-concept').value.trim(),
      amount: parseFloat(document.getElementById('pay-amount').value),
      category: document.getElementById('pay-category').value,
      date: document.getElementById('pay-date').value,
      method: document.getElementById('pay-method').value,
      status: form.querySelector('input[name="pay-status"]:checked').value,
      notes: document.getElementById('pay-notes').value.trim()
    };

    if (id) {
      appState.updatePayment({ id, ...paymentData });
      showToast('Pago modificado exitosamente', 'success');
    } else {
      appState.addPayment(paymentData);
      showToast('Nuevo pago registrado', 'success');
    }

    closeModal(modalId);
  });
}

/**
 * 4. PROJECTIONS SIMULATOR FORM & APPLY BUTTON
 */
function initProjectionsForm() {
  const form = document.getElementById('projection-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const projData = {
      concept: document.getElementById('proj-concept').value.trim(),
      amount: parseFloat(document.getElementById('proj-amount').value),
      category: document.getElementById('proj-category').value,
      date: document.getElementById('proj-date').value || new Date().toISOString().split('T')[0],
      installments: document.getElementById('proj-installments').value
    };

    appState.addProjection(projData);
    form.reset();
    showToast('Proyección agregada a la simulación', 'info');
  });

  // Apply Projections Action Button
  document.getElementById('apply-projection-btn')?.addEventListener('click', () => {
    const count = appState.applyProjectionsToRealPayments();
    if (count > 0) {
      triggerConfetti();
      showToast(`¡Excelente! ${count} proyección(es) aplicadas como pagos reales`, 'success');
    } else {
      showToast('Selecciona al menos una proyección para aplicar', 'error');
    }
  });
}

/**
 * 5. EVENT DELEGATION FOR PAYMENTS TABLE & PROJECTION LIST
 */
function initTableAndListActions() {
  // Table row actions (Toggle status, edit, delete)
  document.getElementById('payments-tbody')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');

    if (action === 'toggle-status') {
      appState.togglePaymentStatus(id);
      showToast('Estado del pago actualizado', 'success');
    } else if (action === 'edit-payment') {
      const monthData = appState.getActiveMonthData();
      const p = monthData.payments.find(item => item.id === id);
      if (p) {
        document.getElementById('payment-modal-title').textContent = 'Editar Pago';
        document.getElementById('payment-id').value = p.id;
        document.getElementById('pay-concept').value = p.concept;
        document.getElementById('pay-amount').value = p.amount;
        document.getElementById('pay-category').value = p.category;
        document.getElementById('pay-date').value = p.date;
        document.getElementById('pay-method').value = p.method;
        document.getElementById('pay-notes').value = p.notes || '';
        
        const radioStatus = document.querySelector(`input[name="pay-status"][value="${p.status}"]`);
        if (radioStatus) radioStatus.checked = true;

        openModal('payment-modal');
      }
    } else if (action === 'delete-payment') {
      if (confirm('¿Estás seguro de eliminar este registro de pago?')) {
        appState.deletePayment(id);
        showToast('Pago eliminado', 'info');
      }
    }
  });

  // Projection list actions (Checkbox toggle, delete)
  document.getElementById('projections-list')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');

    if (action === 'toggle-proj') {
      appState.toggleProjectionSelection(id);
    } else if (action === 'delete-proj') {
      appState.deleteProjection(id);
      showToast('Proyección eliminada', 'info');
    }
  });
}

/**
 * 6. DEMO DATA & DATA BACKUP / EXPORT / IMPORT
 */
function initBackupAndDemo() {
  // Demo Data Button
  document.getElementById('demo-data-btn')?.addEventListener('click', () => {
    if (confirm('¿Deseas cargar los datos de prueba? Esto preparará un mes de ejemplo con ingresos, pagos y proyecciones.')) {
      appState.loadDemoData();
      showToast('Datos de demostración cargados', 'success');
      triggerConfetti();
    }
  });

  // Open Data Backup Modal
  document.getElementById('export-import-btn')?.addEventListener('click', () => {
    openModal('data-modal');
  });

  // Export JSON
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(appState.exportJSON());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `FinanFlow_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Respaldo JSON descargado', 'success');
  });

  // Export CSV
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const monthData = appState.getActiveMonthData();
    let csvContent = "data:text/csv;charset=utf-8,Concepto,Categoria,Fecha,Metodo,Monto,Estado,Notas\n";

    monthData.payments.forEach(p => {
      const row = [
        `"${p.concept.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.date}"`,
        `"${p.method}"`,
        p.amount,
        `"${p.status}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pagos_${appState.getActiveMonthYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Reporte CSV descargado', 'success');
  });

  // Import JSON
  document.getElementById('import-json-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = appState.importJSON(event.target.result);
      if (success) {
        showToast('Datos importados con éxito', 'success');
        closeModal('data-modal');
      } else {
        showToast('Archivo JSON inválido o corrupto', 'error');
      }
    };
    reader.readAsText(file);
  });
}
