/**
 * FinanFlow Pro - Payment Projections Engine ("What-If" Simulator)
 * Evaluates hypothetical payments against real-time balance and projects future cashflow.
 */

import { appState } from './state.js';

export function calculateProjections() {
  const totals = appState.getPaymentsTotals();
  const currentBalance = totals.availableBalance;
  const totalIncome = totals.totalIncome;

  const projections = appState.getProjections();
  const selectedProjections = projections.filter(p => p.selected);

  // Calculate immediate impact of selected projections
  let totalProjectedCost = 0;

  selectedProjections.forEach(p => {
    const installmentVal = (parseFloat(p.amount) || 0) / (parseInt(p.installments) || 1);
    totalProjectedCost += installmentVal;
  });

  const resultingBalance = currentBalance - totalProjectedCost;
  const marginPercentage = totalIncome > 0 ? (resultingBalance / totalIncome) * 100 : 0;

  let liquidityStatus = 'SUCCESS';
  let title = 'Liquidez Financiera Segura ✅';
  let description = `Tu saldo disponible cubriá los $${totalProjectedCost.toFixed(2)} proyectados y mantendrás un margen de reserva del ${marginPercentage.toFixed(1)}%.`;

  if (resultingBalance < 0) {
    liquidityStatus = 'DANGER';
    title = '¡Riesgo de Déficit Financiero! ⚠️';
    description = `Si aplicas estas proyecciones quedarás con un saldo negativo de $${Math.abs(resultingBalance).toFixed(2)}. Te sugerimos revisar las cuotas o posponer pagos.`;
  } else if (marginPercentage < 15) {
    liquidityStatus = 'WARNING';
    title = 'Margen de Liquidez Ajustado ⚠️';
    description = `Tu saldo seguirá siendo positivo ($${resultingBalance.toFixed(2)}), pero tu margen de maniobra será bajo (${marginPercentage.toFixed(1)}% del ingreso).`;
  }

  return {
    currentBalance,
    totalIncome,
    totalExpenses: totals.totalExpenses,
    selectedProjectionsCount: selectedProjections.length,
    totalProjectedCost,
    resultingBalance,
    marginPercentage,
    liquidityStatus,
    title,
    description,
    selectedProjections
  };
}
