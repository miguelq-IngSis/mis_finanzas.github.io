/**
 * FinanFlow Pro - State Management Module
 * Handles application state, LocalStorage persistence, active month/year, and reactive events.
 */

const STORAGE_KEY = 'finanflow_pro_v1';

const defaultState = {
  currency: 'USD',
  theme: 'dark',
  activeMonthYear: '', // e.g. "2026-09"
  months: {
    // "2026-09": { income: { base: 3500, extras: [] }, payments: [...] }
  },
  projections: [] // [{ id, concept, amount, category, date, installments, selected }]
};

class StateManager {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
    
    // Set current month-year if none set
    if (!this.state.activeMonthYear) {
      const now = new Date();
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      this.state.activeMonthYear = `${now.getFullYear()}-${monthStr}`;
    }

    // Ensure active month structure exists
    this.ensureMonthExists(this.state.activeMonthYear);
  }

  // Load state from LocalStorage
  loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error al cargar LocalStorage:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  // Save state to LocalStorage
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (e) {
      console.error('Error al guardar LocalStorage:', e);
    }
  }

  // Subscribe UI components to state changes
  subscribe(listener) {
    this.listeners.push(listener);
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn(this.state));
  }

  // Ensure current month key exists in state
  ensureMonthExists(monthYearKey) {
    if (!this.state.months[monthYearKey]) {
      this.state.months[monthYearKey] = {
        income: { base: 0, extras: [] },
        payments: []
      };
    }
  }

  // --- GETTERS ---
  getActiveMonthYear() {
    return this.state.activeMonthYear;
  }

  getActiveMonthData() {
    this.ensureMonthExists(this.state.activeMonthYear);
    return this.state.months[this.state.activeMonthYear];
  }

  getCurrency() {
    return this.state.currency || 'USD';
  }

  getTheme() {
    return this.state.theme || 'dark';
  }

  getProjections() {
    return this.state.projections || [];
  }

  // --- ACTIONS: MONTH NAVIGATION ---
  setActiveMonthYear(monthYearKey) {
    this.state.activeMonthYear = monthYearKey;
    this.ensureMonthExists(monthYearKey);
    this.saveState();
  }

  navigateMonth(direction) {
    const [year, month] = this.state.activeMonthYear.split('-').map(Number);
    let d = new Date(year, month - 1 + direction, 1);
    const newMonthStr = String(d.getMonth() + 1).padStart(2, '0');
    const newMonthYear = `${d.getFullYear()}-${newMonthStr}`;
    this.setActiveMonthYear(newMonthYear);
  }

  // --- ACTIONS: CURRENCY & THEME ---
  setCurrency(curr) {
    this.state.currency = curr;
    this.saveState();
  }

  setTheme(theme) {
    this.state.theme = theme;
    this.saveState();
  }

  // Helper: Get previous month-year key (e.g. "2026-08" for "2026-09")
  getPrevMonthYearKey(monthYearKey = this.state.activeMonthYear) {
    const [year, month] = monthYearKey.split('-').map(Number);
    let d = new Date(year, month - 2, 1); // month is 1-indexed, minus 1 for date month, minus 1 for prev month
    const prevMonthStr = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${prevMonthStr}`;
  }

  // --- ACTIONS: INCOME ---
  setIncome(baseIncome, extras = [], options = {}) {
    const monthData = this.getActiveMonthData();
    monthData.income.base = parseFloat(baseIncome) || 0;
    monthData.income.extras = extras;
    monthData.income.isNextMonthFund = !!options.isNextMonthFund;
    this.saveState();
  }

  getTotalIncome() {
    const monthData = this.getActiveMonthData();
    const base = monthData.income.base || 0;
    const extrasTotal = (monthData.income.extras || []).reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
    const directTotal = base + extrasTotal;

    // If direct total is 0, check if previous month had an income set to fund next month
    if (directTotal === 0) {
      const prevKey = this.getPrevMonthYearKey();
      const prevMonth = this.state.months[prevKey];
      if (prevMonth && prevMonth.income) {
        const prevBase = prevMonth.income.base || 0;
        const prevExtras = (prevMonth.income.extras || []).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
        return prevBase + prevExtras;
      }
    }

    return directTotal;
  }

  // Check if current month income comes from previous month's payday
  getIncomeSourceInfo() {
    const monthData = this.getActiveMonthData();
    const directBase = monthData.income.base || 0;
    const extrasTotal = (monthData.income.extras || []).reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

    if (directBase > 0 || extrasTotal > 0) {
      return {
        isCarriedOver: false,
        sourceText: monthData.income.isNextMonthFund ? 'Cobrado a fin de mes (Financia este periodo)' : 'Ingreso registrado para el mes',
        total: directBase + extrasTotal
      };
    }

    const prevKey = this.getPrevMonthYearKey();
    const prevMonth = this.state.months[prevKey];
    if (prevMonth && prevMonth.income && (prevMonth.income.base > 0 || (prevMonth.income.extras && prevMonth.income.extras.length > 0))) {
      const prevTotal = (prevMonth.income.base || 0) + (prevMonth.income.extras || []).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
      return {
        isCarriedOver: true,
        sourceText: `Heredado de fin del mes anterior (${prevKey})`,
        total: prevTotal
      };
    }

    return {
      isCarriedOver: false,
      sourceText: 'Sin ingreso registrado',
      total: 0
    };
  }

  // --- ACTIONS: PAYMENTS ---
  addPayment(paymentData) {
    const monthData = this.getActiveMonthData();
    const newPayment = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      concept: paymentData.concept,
      amount: parseFloat(paymentData.amount),
      category: paymentData.category,
      date: paymentData.date,
      method: paymentData.method || 'Transferencia',
      status: paymentData.status || 'PENDING',
      notes: paymentData.notes || ''
    };
    monthData.payments.push(newPayment);
    this.saveState();
    return newPayment;
  }

  updatePayment(updatedData) {
    const monthData = this.getActiveMonthData();
    const index = monthData.payments.findIndex(p => p.id === updatedData.id);
    if (index !== -1) {
      monthData.payments[index] = {
        ...monthData.payments[index],
        concept: updatedData.concept,
        amount: parseFloat(updatedData.amount),
        category: updatedData.category,
        date: updatedData.date,
        method: updatedData.method,
        status: updatedData.status,
        notes: updatedData.notes
      };
      this.saveState();
    }
  }

  togglePaymentStatus(id) {
    const monthData = this.getActiveMonthData();
    const payment = monthData.payments.find(p => p.id === id);
    if (payment) {
      payment.status = payment.status === 'PAID' ? 'PENDING' : 'PAID';
      this.saveState();
    }
  }

  deletePayment(id) {
    const monthData = this.getActiveMonthData();
    monthData.payments = monthData.payments.filter(p => p.id !== id);
    this.saveState();
  }

  getPaymentsTotals() {
    const monthData = this.getActiveMonthData();
    let totalPaid = 0;
    let totalPending = 0;
    let countPaid = 0;
    let countPending = 0;

    monthData.payments.forEach(p => {
      const val = parseFloat(p.amount) || 0;
      if (p.status === 'PAID') {
        totalPaid += val;
        countPaid++;
      } else {
        totalPending += val;
        countPending++;
      }
    });

    const totalIncome = this.getTotalIncome();
    const availableBalance = totalIncome - totalPaid - totalPending;

    return {
      totalIncome,
      totalPaid,
      totalPending,
      totalExpenses: totalPaid + totalPending,
      availableBalance,
      countPaid,
      countPending,
      totalCount: monthData.payments.length
    };
  }

  // --- ACTIONS: PROJECTIONS ---
  addProjection(projData) {
    const newProj = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      concept: projData.concept,
      amount: parseFloat(projData.amount),
      category: projData.category || 'Otros',
      date: projData.date || new Date().toISOString().split('T')[0],
      installments: parseInt(projData.installments) || 1,
      selected: true
    };
    if (!this.state.projections) this.state.projections = [];
    this.state.projections.push(newProj);
    this.saveState();
    return newProj;
  }

  toggleProjectionSelection(id) {
    const proj = (this.state.projections || []).find(p => p.id === id);
    if (proj) {
      proj.selected = !proj.selected;
      this.saveState();
    }
  }

  deleteProjection(id) {
    this.state.projections = (this.state.projections || []).filter(p => p.id !== id);
    this.saveState();
  }

  // Apply selected projections to real payments list!
  applyProjectionsToRealPayments() {
    const selectedProjections = (this.state.projections || []).filter(p => p.selected);
    if (selectedProjections.length === 0) return 0;

    const monthData = this.getActiveMonthData();
    selectedProjections.forEach(proj => {
      const installmentAmount = proj.amount / (proj.installments || 1);
      
      for (let i = 0; i < proj.installments; i++) {
        let conceptText = proj.concept;
        if (proj.installments > 1) {
          conceptText += ` (Cuota ${i + 1}/${proj.installments})`;
        }
        monthData.payments.push({
          id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + '_' + i,
          concept: conceptText,
          amount: parseFloat(installmentAmount.toFixed(2)),
          category: proj.category,
          date: proj.date || new Date().toISOString().split('T')[0],
          method: 'Transferencia',
          status: 'PENDING',
          notes: 'Generado desde Proyección de Pago'
        });
      }
    });

    // Remove applied projections from projections list
    this.state.projections = (this.state.projections || []).filter(p => !p.selected);
    this.saveState();
    return selectedProjections.length;
  }

  // --- DEMO DATA LOADER ---
  loadDemoData() {
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const activeKey = `${now.getFullYear()}-${monthStr}`;
    
    this.state.activeMonthYear = activeKey;
    this.state.currency = 'USD';
    
    const todayStr = now.toISOString().split('T')[0];

    this.state.months[activeKey] = {
      income: {
        base: 3200,
        extras: [
          { id: 'ext_1', concept: 'Trabajo Freelance Design', amount: 450 }
        ]
      },
      payments: [
        { id: 'p1', concept: 'Arriendo de Departamento', amount: 1100, category: 'Vivienda', date: todayStr, method: 'Transferencia', status: 'PAID', notes: 'Pago mes en curso' },
        { id: 'p2', concept: 'Servicios de Luz y Agua', amount: 130, category: 'Servicios', date: todayStr, method: 'Debito Automático', status: 'PAID', notes: 'Enel / Agua' },
        { id: 'p3', concept: 'Supermercado Semanal', amount: 320, category: 'Alimentación', date: todayStr, method: 'Tarjeta de Débito', status: 'PAID', notes: 'Compras mes' },
        { id: 'p4', concept: 'Internet de Alta Velocidad', amount: 55, category: 'Servicios', date: todayStr, method: 'Tarjeta de Crédito', status: 'PENDING', notes: 'Vence día 20' },
        { id: 'p5', concept: 'Cuota Crédito Vehicular', amount: 340, category: 'Deudas', date: todayStr, method: 'Transferencia', status: 'PENDING', notes: 'Banco Santander' },
        { id: 'p6', concept: 'Gimnasio y Salud', amount: 60, category: 'Salud', date: todayStr, method: 'Tarjeta de Débito', status: 'PENDING', notes: 'Membresía mensual' },
        { id: 'p7', concept: 'Ahorro Fondo de Emergencia', amount: 300, category: 'Ahorro', date: todayStr, method: 'Transferencia', status: 'PAID', notes: 'Fondo de inversión' }
      ]
    };

    this.state.projections = [
      { id: 'proj_demo_1', concept: 'Nuevo Laptop MacBook Air', amount: 1200, category: 'Otros', date: todayStr, installments: 3, selected: true },
      { id: 'proj_demo_2', concept: 'Mantenimiento Preventivo Auto', amount: 220, category: 'Transporte', date: todayStr, installments: 1, selected: true }
    ];

    this.saveState();
  }

  // --- IMPORT / EXPORT ---
  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.months) {
        this.state = parsed;
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('JSON Inválido:', e);
    }
    return false;
  }
}

export const appState = new StateManager();
