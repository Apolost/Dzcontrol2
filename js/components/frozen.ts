/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';

export function openFrozenMainModal() {
    renderFrozenProductionList();
    DOMElements.frozenMainModal.classList.add('active');
}

function renderFrozenProductionList() {
    const body = DOMElements.frozenMainModal.querySelector('#frozen-main-modal-body');
    const date = appState.ui.selectedDate;
    
    // Filter out completed orders
    const activeOrders = appState.frozenProductionOrders.filter(o => !o.isComplete);

    if (activeOrders.length === 0) {
        body.innerHTML = '<div class="card"><p style="text-align: center; padding: 20px;">Nejsou žádné aktivní požadavky na výrobu.</p></div>';
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Produkt</th>
                    <th>Cíl (kg)</th>
                    <th>Cíl (kartony)</th>
                    <th>Hotovo celkem (kartony)</th>
                    <th>Dnes hotovo (kartony)</th>
                    <th>Zbývá (kartony)</th>
                    <th class="actions">Akce</th>
                </tr>
            </thead>
            <tbody>
    `;

    activeOrders.forEach(order => {
        const product = appState.frozenProducts.find(p => p.id === order.frozenProductId);
        if (!product) return;

        const totalCartonsRequired = product.cartonWeightKg > 0 ? Math.ceil(order.totalKgRequired / product.cartonWeightKg) : 0;
        const totalCartonsProduced = Object.values(order.dailyProduction || {}).reduce((sum, count) => sum + count, 0);
        const cartonsRemaining = totalCartonsRequired - totalCartonsProduced;
        const producedToday = order.dailyProduction?.[date] || 0;

        tableHTML += `
            <tr class="${cartonsRemaining <= 0 ? 'done' : ''}">
                <td>${product.name}</td>
                <td>${order.totalKgRequired.toFixed(2)}</td>
                <td>${totalCartonsRequired}</td>
                <td>${totalCartonsProduced}</td>
                <td>
                    <input 
                        type="number" 
                        class="frozen-daily-production-input" 
                        data-order-id="${order.id}" 
                        value="${producedToday > 0 ? producedToday : ''}" 
                        placeholder="0" 
                        min="0"
                        style="width: 80px;"
                    >
                </td>
                <td class="${cartonsRemaining > 0 ? 'shortage' : 'surplus'}">${cartonsRemaining}</td>
                <td class="actions">
                    <button class="btn-icon danger" data-action="delete-frozen-order" data-id="${order.id}">${ICONS.trash}</button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    feather.replace();
}

export function openAddFrozenRequestModal() {
    const modal = DOMElements.addFrozenRequestModal;
    const productSelect = modal.querySelector('#frozen-request-product');
    
    productSelect.innerHTML = appState.frozenProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    modal.querySelector('#frozen-request-kg').value = '';

    modal.classList.add('active');
}

export function saveFrozenRequest() {
    const modal = DOMElements.addFrozenRequestModal;
    const frozenProductId = modal.querySelector('#frozen-request-product').value;
    const totalKgRequired = parseFloat(modal.querySelector('#frozen-request-kg').value);

    if (!frozenProductId || !totalKgRequired || totalKgRequired <= 0) {
        showToast('Vyberte produkt a zadejte platné množství v kg.', 'error');
        return;
    }

    const newOrder = {
        id: generateId(),
        frozenProductId,
        totalKgRequired,
        createdAtDate: new Date().toISOString().split('T')[0],
        dailyProduction: {},
        isComplete: false,
    };

    appState.frozenProductionOrders.push(newOrder);
    saveState();
    showToast('Nový požadavek na výrobu byl uložen.');
    modal.classList.remove('active');
    renderFrozenProductionList();
}

export function handleDailyProductionInput(target) {
    const orderId = target.dataset.orderId;
    const producedToday = parseInt(target.value, 10) || 0;
    const date = appState.ui.selectedDate;

    const order = appState.frozenProductionOrders.find(o => o.id === orderId);
    if (!order) return;

    if (!order.dailyProduction) {
        order.dailyProduction = {};
    }
    order.dailyProduction[date] = producedToday;

    // Check for completion
    const product = appState.frozenProducts.find(p => p.id === order.frozenProductId);
    if (product && !order.isComplete) {
        const totalCartonsRequired = Math.ceil(order.totalKgRequired / product.cartonWeightKg);
        const totalCartonsProduced = Object.values(order.dailyProduction).reduce((sum, count) => sum + count, 0);

        if (totalCartonsProduced >= totalCartonsRequired) {
            // Production is complete, deduct raw materials
            const rawMaterial = appState.suroviny.find(s => s.id === product.rawMaterialId);
            if (rawMaterial && rawMaterial.paletteWeight > 0) {
                const palettesToDeduct = order.totalKgRequired / rawMaterial.paletteWeight;
                rawMaterial.stock = (rawMaterial.stock || 0) - palettesToDeduct;
                order.isComplete = true; // Mark as complete to prevent double deduction
                
                showToast(`Výroba pro "${product.name}" dokončena. ${palettesToDeduct.toFixed(2)} palet suroviny "${rawMaterial.name}" bylo odepsáno ze skladu.`, 'success');
            } else {
                 showToast(`Výroba pro "${product.name}" dokončena, ale surovina nebyla nalezena nebo nemá váhu palety. Zkontrolujte nastavení.`, 'warning');
            }
        }
    }

    saveState();
    // No need to re-render the whole list on input, just save the state
}

export function deleteFrozenOrder(orderId) {
    showConfirmation('Opravdu chcete smazat tento požadavek na výrobu?', () => {
        appState.frozenProductionOrders = appState.frozenProductionOrders.filter(o => o.id !== orderId);
        saveState();
        showToast('Požadavek smazán.');
        renderFrozenProductionList();
    });
}