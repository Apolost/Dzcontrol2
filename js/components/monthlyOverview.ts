/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState } from '../state.ts';
import { DOMElements, showToast } from '../ui.ts';

let monthlyChart = null;
let currentRange = 'this-month'; // 'this-month', 'last-month', 'week', 'day'

function getDatesForRange(range) {
    const selectedDateObj = new Date(appState.ui.selectedDate + 'T12:00:00Z');
    let year = selectedDateObj.getFullYear();
    let month = selectedDateObj.getMonth();

    let startDate;
    let endDate;

    switch (range) {
        case 'last-month':
            month -= 1;
            if (month < 0) {
                month = 11;
                year -= 1;
            }
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
            break;
        case 'week':
            const dayOfWeek = selectedDateObj.getDay();
            const diff = selectedDateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday being 0, Monday is 1
            startDate = new Date(year, month, diff);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;
        case 'day':
            startDate = new Date(appState.ui.selectedDate + 'T12:00:00Z');
            endDate = new Date(appState.ui.selectedDate + 'T12:00:00Z');
            break;
        case 'this-month':
        default:
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
            break;
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}

function calculateMonthlyData(startDate, endDate) {
    const data = {
        customers: {}, // { customerId: { surovinaId: totalKg } }
        suroviny: {},  // { surovinaId: totalKg }
    };

    const ordersInRange = appState.orders.filter(o => {
        const orderDate = new Date(o.date);
        return orderDate >= startDate && orderDate <= endDate;
    });

    ordersInRange.forEach(order => {
        if (!data.customers[order.customerId]) {
            data.customers[order.customerId] = {};
        }

        order.items.forEach(item => {
            if (!item.isActive) return;

            const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
            if (!surovina) return;
            
            let kg = 0;
            const weights = appState.boxWeights[order.customerId]?.[item.surovinaId];
            const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : 10000;
            kg = item.boxCount * (boxWeightInGrams / 1000);

            if (surovina.isMix) {
                const components = item.ratioOverride || appState.mixDefinitions[surovina.id]?.components;
                if (components) {
                    components.forEach(comp => {
                        const grossWeight = kg * (comp.percentage / 100);
                        const netWeight = grossWeight * (1 - ((comp.loss || 0) / 100));
                        data.suroviny[comp.surovinaId] = (data.suroviny[comp.surovinaId] || 0) + netWeight;
                    });
                }
            } else if (surovina.isProduct) {
                 const product = appState.products.find(p => p.id === surovina.id);
                if (product && product.surovinaId) {
                    data.suroviny[product.surovinaId] = (data.suroviny[product.surovinaId] || 0) + kg;
                }
            } else {
                data.customers[order.customerId][item.surovinaId] = (data.customers[order.customerId][item.surovinaId] || 0) + kg;
                data.suroviny[item.surovinaId] = (data.suroviny[item.surovinaId] || 0) + kg;
            }
        });
    });

    return data;
}

function renderMonthlyChart(actualData, estimateData) {
    const canvas = document.getElementById('monthly-overview-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (monthlyChart) {
        monthlyChart.destroy();
    }

    const allSurovinyIds = new Set([...Object.keys(actualData), ...Object.keys(estimateData)]);
    const labels = Array.from(allSurovinyIds).map(id => appState.suroviny.find(s => s.id === id)?.name || 'Neznámá');
    const actualValues = Array.from(allSurovinyIds).map(id => actualData[id] || 0);
    const estimateValues = Array.from(allSurovinyIds).map(id => estimateData[id] || 0);

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Skutečná spotřeba (kg)',
                    data: actualValues,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Odhadovaná spotřeba (kg)',
                    data: estimateValues,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Hmotnost (kg)' }
                }
            },
             plugins: {
                legend: { position: 'top' },
            }
        }
    });
}

export function renderMonthlyOverview() {
    if (currentRange === 'custom') {
        // Implement date pickers if needed
    }

    const { startDate, endDate } = getDatesForRange(currentRange);
    
    let titleText;
    if (currentRange === 'week') {
        titleText = `Přehled za týden od ${startDate.toLocaleDateString('cs-CZ')} do ${endDate.toLocaleDateString('cs-CZ')}`;
    } else if (currentRange === 'day') {
        titleText = `Přehled za den ${startDate.toLocaleDateString('cs-CZ')}`;
    } else {
        titleText = `Přehled za ${startDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`;
    }
    document.getElementById('monthly-overview-title').textContent = titleText;

    const actualData = calculateMonthlyData(startDate, endDate);
    
    const estimateKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const estimate = appState.savedEstimates[estimateKey] || { items: [] };
    const estimateDataBySurovina = {};
    (estimate.items || []).forEach(item => {
        estimateDataBySurovina[item.surovinaId] = (estimateDataBySurovina[item.surovinaId] || 0) + item.estimatedKg;
    });

    renderMonthlyChart(actualData.suroviny, estimateDataBySurovina);

    const comparisonContainer = document.getElementById('monthly-estimate-comparison');
    let comparisonHtml = `<table class="data-table">
        <thead>
            <tr>
                <th>Surovina</th>
                <th>Odhad (kg)</th>
                <th>Skutečnost (kg)</th>
                <th>Rozdíl (kg)</th>
                <th>Rozdíl (%)</th>
            </tr>
        </thead>
        <tbody>`;

    const allSurovinyIds = new Set([...Object.keys(actualData.suroviny), ...Object.keys(estimateDataBySurovina)]);
    
    if (allSurovinyIds.size === 0) {
        comparisonHtml += '<tr><td colspan="5" style="text-align: center;">Žádná data k zobrazení.</td></tr>';
    } else {
        Array.from(allSurovinyIds).sort().forEach(surovinaId => {
            const surovina = appState.suroviny.find(s => s.id === surovinaId);
            if (!surovina) return;
            const estimateKg = estimateDataBySurovina[surovinaId] || 0;
            const actualKg = actualData.suroviny[surovinaId] || 0;
            const diffKg = actualKg - estimateKg;
            const diffPercent = estimateKg > 0 ? ((diffKg / estimateKg) * 100) : (actualKg > 0 ? Infinity : 0);
            
            const diffClass = diffKg < -0.01 ? 'shortage' : diffKg > 0.01 ? 'surplus' : '';
            const percentString = isFinite(diffPercent) ? `${diffPercent.toFixed(1)}%` : '∞%';

            comparisonHtml += `
                <tr>
                    <td>${surovina?.name || 'Neznámá'}</td>
                    <td>${estimateKg.toFixed(2)}</td>
                    <td>${actualKg.toFixed(2)}</td>
                    <td class="${diffClass}">${diffKg.toFixed(2)}</td>
                    <td class="${diffClass}">${percentString}</td>
                </tr>
            `;
        });
    }

    comparisonHtml += `</tbody></table>`;
    comparisonContainer.innerHTML = comparisonHtml;
}

export function setRange(target) {
    const { range } = target.dataset;
    currentRange = range;
    
    document.querySelectorAll('#monthly-overview-controls .btn').forEach(btn => btn.classList.remove('active'));
    target.classList.add('active');
    
    renderMonthlyOverview();
}

function loadEstimateDataIntoModal(monthKey) {
    const modal = DOMElements.estimateModal;
    const body = modal.querySelector('#estimate-modal-body');
    
    const savedEstimate = appState.savedEstimates[monthKey] || { items: [] };

    const suroviny = appState.suroviny.filter(s => !s.isMix && !s.isProduct && s.isActive).sort((a, b) => a.name.localeCompare(b.name));
    
    let accordionHtml = '<div class="accordion">';
    appState.zakaznici.forEach(customer => {
        accordionHtml += `
            <details>
                <summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary>
                <div class="details-content">
                    <table class="data-table">
                        <thead><tr><th>Surovina</th><th>Odhadovaná měsíční spotřeba (kg)</th></tr></thead>
                        <tbody>
        `;
        suroviny.forEach(surovina => {
            const savedItem = savedEstimate.items?.find(i => i.customerId === customer.id && i.surovinaId === surovina.id);
            const value = savedItem?.estimatedKg || '';
            accordionHtml += `
                <tr>
                    <td>${surovina.name}</td>
                    <td><input type="number" class="estimate-input" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" value="${value}" placeholder="0" style="width: 150px; text-align: right;"></td>
                </tr>
            `;
        });
        accordionHtml += `</tbody></table></div></details>`;
    });

    accordionHtml += '</div>';
    body.innerHTML = accordionHtml;
    
    feather.replace();
}

export function openEstimateModal() {
    const modal = DOMElements.estimateModal;
    const monthInput = modal.querySelector('#estimate-month');

    const { startDate } = getDatesForRange(currentRange);
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;

    monthInput.value = currentMonthKey;

    const newMonthInput = monthInput.cloneNode(true);
    monthInput.parentNode.replaceChild(newMonthInput, monthInput);

    newMonthInput.addEventListener('change', () => {
        const newMonthKey = newMonthInput.value;
        if (newMonthKey) {
            loadEstimateDataIntoModal(newMonthKey);
        }
    });

    loadEstimateDataIntoModal(currentMonthKey);
    
    modal.classList.add('active');
}

export function saveEstimate() {
    const modal = DOMElements.estimateModal;
    const monthKey = modal.querySelector('#estimate-month').value;

    if (!monthKey) {
        showToast('Vyberte prosím měsíc pro uložení odhadu.', 'error');
        return;
    }

    const newItems = [];
    modal.querySelectorAll('.estimate-input').forEach(input => {
        const kg = parseFloat(input.value);
        if (kg > 0) {
            newItems.push({
                customerId: input.dataset.customerId,
                surovinaId: input.dataset.surovinaId,
                estimatedKg: kg,
            });
        }
    });
    
    if (!appState.savedEstimates) {
        appState.savedEstimates = {};
    }
    appState.savedEstimates[monthKey] = { items: newItems };
    saveState();
    
    showToast('Odhad spotřeby byl uložen.');
    DOMElements.estimateModal.classList.remove('active');
    renderMonthlyOverview();
}