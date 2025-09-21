/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId, getWeekNumber } from '../utils.ts';
import { renderDailyPlan } from './dailyPlan.ts';

export function changeMonth(delta) {
    appState.ui.calendar.month += delta;
    if (appState.ui.calendar.month > 11) {
        appState.ui.calendar.month = 0;
        appState.ui.calendar.year++;
    } else if (appState.ui.calendar.month < 0) {
        appState.ui.calendar.month = 11;
        appState.ui.calendar.year--;
    }
    renderCalendar();
}

export function renderCalendar() {
    const { year, month } = appState.ui.calendar;
    document.getElementById('current-month-display').textContent = new Date(year, month).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    grid.innerHTML += `<div class="calendar-header"></div>`;
    ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].forEach(day => {
        grid.innerHTML += `<div class="calendar-header">${day}</div>`;
    });

    const firstDayOfMonth = new Date(year, month, 1);
    let dayOfWeek = firstDayOfMonth.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const offset = dayOfWeek - 1;

    let currentDate = new Date(firstDayOfMonth);
    currentDate.setDate(currentDate.getDate() - offset);

    for (let i = 0; i < 6; i++) {
        const weekNum = getWeekNumber(currentDate);
        grid.innerHTML += `<div class="week-number">${weekNum}</div>`;
        for (let j = 0; j < 7; j++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if (currentDate.getMonth() !== month) {
                dayCell.style.opacity = '0.5';
            }
            const dateStr = currentDate.toISOString().split('T')[0];
            dayCell.dataset.action = 'open-day-details';
            dayCell.dataset.date = dateStr;

            dayCell.innerHTML = `<div class="day-number">${currentDate.getDate()}</div><div class="day-items"></div>`;
            
            const itemsDiv = dayCell.querySelector('.day-items');
            const dayActions = appState.plannedActions.filter(a => dateStr >= a.startDate && (!a.endDate || dateStr <= a.endDate));
            
            dayActions.forEach(action => {
                const customer = appState.zakaznici.find(c => c.id === action.customerId);
                itemsDiv.innerHTML += `<div class="day-pill">${customer?.name || '?'} (Akce)</div>`;
            });

            grid.appendChild(dayCell);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
}

export function openPlanActionModal(actionId = null) {
    appState.ui.editingActionId = actionId;
    const planActionModal = DOMElements.planActionModal;
    const planActionCustomer = planActionModal.querySelector('#plan-action-customer');
    const planActionProduct = planActionModal.querySelector('#plan-action-product');
    const planActionFrom = planActionModal.querySelector('#plan-action-from');
    const planActionTo = planActionModal.querySelector('#plan-action-to');
    const planActionModalTitle = planActionModal.querySelector('.modal-title');
    
    planActionCustomer.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    planActionProduct.innerHTML = appState.suroviny.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    if (actionId) {
        const action = appState.plannedActions.find(a => a.id === actionId);
        if (action) {
            planActionModalTitle.textContent = 'Upravit akci';
            planActionCustomer.value = action.customerId;
            planActionProduct.value = action.surovinaId;
            planActionFrom.value = action.startDate;
            planActionTo.value = action.endDate;
        } else {
            appState.ui.editingActionId = null;
            actionId = null;
        }
    } 
    
    if (!actionId) {
        planActionModalTitle.textContent = 'Naplánovat akci';
        planActionFrom.value = '';
        planActionTo.value = '';
    }

    renderDailyCountsForPlanning();
    planActionFrom.addEventListener('change', renderDailyCountsForPlanning);
    planActionTo.addEventListener('change', renderDailyCountsForPlanning);
    planActionModal.classList.add('active');
}

function renderDailyCountsForPlanning() {
    const planActionModal = DOMElements.planActionModal;
    const planActionFrom = planActionModal.querySelector('#plan-action-from');
    const planActionTo = planActionModal.querySelector('#plan-action-to');
    const planActionDailyCounts = planActionModal.querySelector('#plan-action-daily-counts');
    const from = planActionFrom.value;
    const to = planActionTo.value;
    planActionDailyCounts.innerHTML = '';
    
    const action = appState.ui.editingActionId ? appState.plannedActions.find(a => a.id === appState.ui.editingActionId) : null;
    const dailyCounts = action?.dailyCounts || {};

    if (!from || !to) {
        if(Object.keys(dailyCounts).length > 0) {
             // render existing saved counts
        } else {
            return;
        }
    };

    let currentDate = new Date(from);
    const endDate = new Date(to);

    while(currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const count = dailyCounts[dateStr] || 0;
        const dayLabel = currentDate.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
        planActionDailyCounts.innerHTML += `
            <div class="form-row">
                <label style="flex-basis: 150px;">${dayLabel}</label>
                <div class="form-field"><input type="number" class="plan-day-count" data-date="${dateStr}" value="${count}" min="0"></div>
            </div>
        `;
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

export function openDayDetailsModal(date) {
    const modal = DOMElements.dayDetailsModal;
    modal.querySelector('.modal-title').textContent = new Date(date + 'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    const body = modal.querySelector('.modal-body');
    body.innerHTML = '';
    
    const dayActions = appState.plannedActions.filter(a => date >= a.startDate && (!a.endDate || date <= a.endDate));
    const dayOrders = appState.orders.filter(o => o.date === date);

    if (dayActions.length === 0 && dayOrders.length === 0) {
        body.innerHTML = '<p>Žádné události pro tento den.</p>';
    } else {
        if (dayActions.length > 0) {
            body.innerHTML += '<h3>Naplánované akce</h3>';
            dayActions.forEach(action => {
                const customer = appState.zakaznici.find(c => c.id === action.customerId);
                const product = appState.suroviny.find(s => s.id === action.surovinaId);
                const dayCounts = action.dailyCounts || {};
                body.innerHTML += `
                    <div class="card" style="padding: 10px; margin-bottom: 10px;">
                        <strong>${product?.name || '?'}</strong> pro ${customer?.name || '?'} (${dayCounts[date] || 0} beden)
                        <div class="actions" style="float: right;">
                            <button class="btn-icon" data-action="edit-action" data-id="${action.id}">${ICONS.edit}</button>
                            <button class="btn-icon danger" data-action="delete-action" data-id="${action.id}">${ICONS.trash}</button>
                        </div>
                    </div>
                `;
            });
        }
         if (dayOrders.length > 0) {
             body.innerHTML += '<h3>Standardní objednávky</h3><p>Upravujte v záložce Objednávky.</p>';
         }
    }
    modal.classList.add('active');
}

export function savePlannedAction() {
    const modal = DOMElements.planActionModal;
    const planActionCustomer = modal.querySelector('#plan-action-customer');
    const planActionProduct = modal.querySelector('#plan-action-product');
    const planActionFrom = modal.querySelector('#plan-action-from');
    const planActionTo = modal.querySelector('#plan-action-to');

    const dailyCounts = {};
    modal.querySelectorAll('.plan-day-count').forEach(input => {
        const count = parseInt(input.value);
        if (count > 0) {
            dailyCounts[input.dataset.date] = count;
        }
    });

    if (Object.keys(dailyCounts).length === 0 && !planActionTo.value) {
        showToast('Zadejte počet beden alespoň pro jeden den nebo vyplňte datum "Do".', 'error');
        return;
    }

    if (appState.ui.editingActionId) {
        const action = appState.plannedActions.find(a => a.id === appState.ui.editingActionId);
        action.customerId = planActionCustomer.value;
        action.surovinaId = planActionProduct.value;
        action.startDate = planActionFrom.value;
        action.endDate = planActionTo.value;
        action.dailyCounts = dailyCounts;
        showToast('Akce upravena');
    } else {
        appState.plannedActions.push({
            id: generateId(),
            customerId: planActionCustomer.value,
            surovinaId: planActionProduct.value,
            startDate: planActionFrom.value,
            endDate: planActionTo.value,
            dailyCounts
        });
        showToast('Akce naplánována');
    }
    saveState();
    modal.classList.remove('active');
    if(appState.ui.activeView === 'calendar') renderCalendar();
    if(appState.ui.activeView === 'daily-plan') renderDailyPlan();
}

export function deletePlannedAction(actionId) {
    showConfirmation('Opravdu chcete smazat tuto naplánovanou akci?', () => {
        appState.plannedActions = appState.plannedActions.filter(a => a.id !== actionId);
        saveState();
        DOMElements.dayDetailsModal.classList.remove('active');
        renderCalendar();
        showToast('Akce smazána', 'success');
    });
}
