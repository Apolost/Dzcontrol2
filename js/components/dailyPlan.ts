/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { getDailyNeeds } from '../services/calculations.ts';
import { handleThighSplitProduction } from '../services/production.ts';

export function renderDailyPlan() {
    const todayNeeds = getDailyNeeds(appState.ui.selectedDate, 'non-kfc');
    const nextDay = new Date(appState.ui.selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const tomorrowNeeds = getDailyNeeds(nextDay.toISOString().split('T')[0], 'non-kfc');

    const tbody = document.querySelector('#suroviny-overview-table tbody');
    tbody.innerHTML = '';

    appState.suroviny.filter(s => !s.isMix && !s.isProduct).forEach(s => {
        const boxes = appState.dailyStockAdjustments[appState.ui.selectedDate]?.[s.id] || 0;
        const boxWeight = s.boxWeight || 25;
        const totalStockKg = (s.stock || 0) * (s.paletteWeight || 0) + boxes * boxWeight;
        
        const neededKg = todayNeeds[s.id] || 0;
        const balancePalettes = s.paletteWeight > 0 ? ((totalStockKg - neededKg) / s.paletteWeight) : 0;
        
        let balanceHtml = '';
        if (balancePalettes < -0.01) {
            balanceHtml = `<span class="shortage">- ${Math.abs(balancePalettes).toFixed(2)}</span>`;
        } else {
            balanceHtml = `<span class="surplus">+ ${Math.floor(balancePalettes)}</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td><input type="number" value="${s.stock || 0}" data-surovina-id="${s.id}" class="stock-input" style="width: 80px;"></td>
            <td><input type="number" value="${boxes || ''}" data-surovina-id="${s.id}" class="box-input" style="width: 80px;" placeholder="0"></td>
            <td>${totalStockKg.toFixed(2)} kg</td>
            <td>${neededKg.toFixed(2)} kg</td>
            <td>${balanceHtml}</td>
            <td>${(tomorrowNeeds[s.id] || 0).toFixed(2)} kg</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.stock-input').forEach(input => {
        input.addEventListener('change', e => {
            const surovina = appState.suroviny.find(s => s.id === e.target.dataset.surovinaId);
            if (surovina) surovina.stock = parseFloat(e.target.value) || 0;
            saveState();
            renderDailyPlan();
        });
    });

    tbody.querySelectorAll('.box-input').forEach(input => {
        input.addEventListener('change', e => {
            const surovinaId = e.target.dataset.surovinaId;
            const date = appState.ui.selectedDate;

            if (!appState.dailyStockAdjustments[date]) {
                appState.dailyStockAdjustments[date] = {};
            }
            const oldValue = appState.dailyStockAdjustments[date][surovinaId] || 0;
            const newValue = parseFloat(e.target.value) || 0;

            appState.dailyStockAdjustments[date][surovinaId] = newValue;

            if (newValue > oldValue) {
                const addedBoxes = newValue - oldValue;
                handleThighSplitProduction(surovinaId, addedBoxes, date);
            }

            saveState();
            renderDailyPlan();
        });
    });

    renderKalibrTable();
}

function renderKalibrTable() {
    document.getElementById('kalibr-table-container').innerHTML = '<p>Zde bude tabulka kalibrace.</p>';
}