/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showToast } from '../ui.ts';
import { getDailyNeeds, getMaykawaThighsNeeded, getKfcSurovinyNeeds, getSpizyNeeds } from '../services/calculations.ts';
import { render } from '../main.ts';

function renderOrderTableForSurovina(surovinaName, containerId, sectionTitle = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const targetSurovina = appState.suroviny.find(s => s.name.toUpperCase() === surovinaName.toUpperCase());
    if (!targetSurovina) {
        container.innerHTML = `<p>Surovina "${surovinaName}" nenalezena.</p>`;
        return;
    }
    const targetSurovinaId = targetSurovina.id;

    const productIdsUsingTarget = new Set(
        appState.products
            .filter(p => p.surovinaId === targetSurovinaId)
            .map(p => p.id)
    );

    let tableHTML = '';
    if (sectionTitle) {
        tableHTML += `<h3 class="subsection-title">${sectionTitle}</h3>`;
    }
    tableHTML += `<table class="data-table"><thead><tr><th>Zákazník</th><th>Produkt</th><th>Typ</th><th>Bedny</th><th class="actions">Akce</th></tr></thead><tbody>`;

    let hasOrders = false;
    const ordersForDay = appState.orders.filter(o => o.date === appState.ui.selectedDate);

    ordersForDay.forEach(order => {
        const sortedItems = [...order.items].sort((a, b) => (b.isActive === a.isActive) ? 0 : b.isActive ? -1 : 1);
        
        sortedItems.forEach(item => {
            const isDirectOrder = item.surovinaId === targetSurovinaId;
            const isProductOrder = productIdsUsingTarget.has(item.surovinaId);

            if (isDirectOrder || isProductOrder) {
                hasOrders = true;
                const customer = appState.zakaznici.find(c => c.id === order.customerId);
                const itemSurovina = appState.suroviny.find(s => s.id === item.surovinaId);

                const isItemDone = item.isDone || false;
                const doneClass = isItemDone ? 'class="done"' : '';
                const doneButtonText = isItemDone ? `<i data-feather="x-circle"></i>Zrušit` : `<i data-feather="check-circle"></i>Hotovo`;
                const doneButtonClass = isItemDone ? 'btn-secondary' : 'btn-success';

                tableHTML += `
                    <tr ${doneClass}>
                        <td>${customer?.name || 'N/A'}</td>
                        <td>${itemSurovina?.name || 'Neznámý'}</td>
                        <td>${item.type}</td>
                        <td>${item.boxCount}</td>
                        <td class="actions">
                            <button class="btn ${doneButtonClass}" data-action="toggle-main-page-order-item-done" data-order-id="${order.id}" data-item-id="${item.id}" style="padding: 6px 12px; font-size: 0.85rem;">
                                ${doneButtonText}
                            </button>
                            <button class="btn-icon danger" data-action="delete-main-page-order-item" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.trash}</button>
                        </td>
                    </tr>
                `;
            }
        });
    });

    if (!hasOrders) {
        tableHTML += `<tr><td colspan="5" style="text-align: center;">Žádné objednávky na tento den.</td></tr>`;
    }

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

export function renderMainPage() {
    const alertsContainer = document.getElementById('main-page-alerts');
    const quickEntryContainer = document.getElementById('main-page-quick-entry');
    const kfcQuickEntryContainer = document.getElementById('main-page-kfc-quick-entry');
    const spizyQuickEntryContainer = document.getElementById('main-page-spizy-quick-entry');
    const spizyContainer = document.getElementById('main-page-spizy');
    
    // Section 1: Alerts
    alertsContainer.innerHTML = '';
    let hasAlerts = false;
    
    // Standard suroviny alerts
    const todayNeeds = getDailyNeeds(appState.ui.selectedDate, 'non-kfc');
    const maykawaThighsNeeded = getMaykawaThighsNeeded(appState.ui.selectedDate);
    if (maykawaThighsNeeded > 0) {
         const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
         if(thighsSurovina) {
            todayNeeds[thighsSurovina.id] = (todayNeeds[thighsSurovina.id] || 0) + maykawaThighsNeeded;
         }
    }
    appState.suroviny.filter(s => !s.isMix && !s.isProduct).forEach(s => {
        const neededKg = todayNeeds[s.id] || 0;
        const neededPalettes = s.paletteWeight > 0 ? (neededKg / s.paletteWeight) : 0;
        const balancePalettes = (s.stock || 0) - neededPalettes;
        if (balancePalettes < -0.01) {
            hasAlerts = true;
            const shortageInPalettes = Math.abs(balancePalettes);
            let alertMessage = `Chybí ${shortageInPalettes.toFixed(2)} palet`;
            
            if (shortageInPalettes < 1 && s.paletteWeight > 0 && s.boxWeight > 0) {
                const shortageInKg = shortageInPalettes * s.paletteWeight;
                const neededBoxes = Math.ceil(shortageInKg / s.boxWeight);
                alertMessage += ` (${neededBoxes} beden)`;
            }

            alertsContainer.innerHTML += `<p class="shortage">${s.name}: ${alertMessage}</p>`;
        }
    });

    // Spizy suroviny alerts
    const spizyNeeds = getSpizyNeeds(appState.ui.selectedDate);
    const { spizyStock } = appState;
    const spizyIngredients = [
        { key: 'klobasa', name: 'Klobása' },
        { key: 'spek', name: 'Špek' },
        { key: 'steak', name: 'Steak na špíz' },
        { key: 'cibule', name: 'Cibule' },
    ];
    spizyIngredients.forEach(ing => {
        const needed = spizyNeeds[ing.key] || 0;
        const stock = spizyStock[ing.key] || 0;
        if (stock < needed) {
            hasAlerts = true;
            alertsContainer.innerHTML += `<p class="shortage">Špízy: Chybí ${(needed - stock).toFixed(2)} kg ${ing.name}</p>`;
        }
    });

    if (!hasAlerts) {
        alertsContainer.innerHTML = '<p>Žádné nedostatky surovin.</p>';
    }

    // Section 2: Quick Entry
    quickEntryContainer.innerHTML = '';
    const quickEntryProducts = appState.products.filter(p => p.showInQuickEntry && p.isActive);
    const date = appState.ui.selectedDate;

    quickEntryProducts.forEach(product => {
        let neededKg = 0;
        // From direct orders
        appState.orders.filter(o => o.date === date).forEach(order => {
            order.items.filter(i => i.surovinaId === product.id && i.isActive).forEach(item => {
                const weights = appState.boxWeights[order.customerId]?.[product.id];
                const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : product.boxWeight;
                neededKg += item.boxCount * (boxWeightInGrams / 1000);
            });
        });

        // From planned actions
        appState.plannedActions.filter(a => a.surovinaId === product.id && date >= a.startDate && (!a.endDate || date <= a.endDate)).forEach(action => {
            const boxCount = action.dailyCounts?.[date] || 0;
            if (boxCount > 0) {
                const weights = appState.boxWeights[action.customerId]?.[product.id];
                const boxWeightInGrams = weights?.VL || product.boxWeight; 
                neededKg += boxCount * (boxWeightInGrams / 1000);
            }
        });

        const isDone = appState.quickEntryStatus[date]?.[product.id] || false;
        const doneClass = isDone ? 'done' : '';

        quickEntryContainer.innerHTML += `
            <div class="quick-entry-card ${doneClass}">
                <i data-feather="box" class="icon"></i>
                <h3>${product.name}</h3>
                <div class="needs-display">
                    Potřeba
                    <strong>${neededKg.toFixed(2)} kg</strong>
                </div>
                <button class="btn ${isDone ? 'btn-secondary' : 'btn-success'}" data-action="quick-entry-done" data-id="${product.id}" style="width: 100%; margin-top: auto;">
                    ${isDone ? '<i data-feather="x-circle"></i>Zrušit' : '<i data-feather="check-circle"></i>Hotovo'}
                </button>
            </div>
        `;
    });
    
    const kfcSurovinyNeeded = getKfcSurovinyNeeds(appState.ui.selectedDate);
    if (Object.keys(kfcSurovinyNeeded).length > 0) {
        let kfcHtml = `
            <div class="quick-needs-section">
                <h4>KFC - Potřeba</h4>
                <ul>`;
        for (const surovinaId in kfcSurovinyNeeded) {
            const surovina = appState.kfcSuroviny.find(s => s.id === surovinaId);
            if (surovina) {
                kfcHtml += `
                    <li>
                        <span>${surovina.name}</span>
                        <span>Potřeba: <strong>${kfcSurovinyNeeded[surovinaId]} beden</strong></span>
                        <div class="stock-input-group">
                            <label>Sklad:</label>
                            <input type="number" class="kfc-quick-stock-input" data-surovina-id="${surovina.id}" value="${surovina.stockBoxes || 0}">
                        </div>
                    </li>
                `;
            }
        }
        kfcHtml += '</ul></div>';
        kfcQuickEntryContainer.innerHTML = kfcHtml;
    } else {
        kfcQuickEntryContainer.innerHTML = '';
    }

    if (spizyNeeds.steak > 0) {
        spizyQuickEntryContainer.innerHTML = `
            <div class="quick-needs-section">
                <h4>Špízy - Potřeba</h4>
                <ul>
                    <li><span>Steak (k marinaci)</span><strong>${spizyNeeds.steak.toFixed(2)} kg</strong></li>
                </ul>
            </div>`;
    } else {
        spizyQuickEntryContainer.innerHTML = '';
    }

    // Section 3: Collapsible Order Sections
    const dailySpizyOrders = appState.spizyOrders[appState.ui.selectedDate] || [];
    let spizyTableHTML = `<table class="data-table"><thead><tr><th>Zákazník</th><th>Produkt</th><th>Objednáno (beden)</th><th>Hotovo (beden)</th><th class="actions">Akce</th></tr></thead><tbody>`;
    
    if (dailySpizyOrders.length > 0 && dailySpizyOrders.some(o => o.klobasa > 0 || o.spek > 0 || o.cilli > 0)) {
        dailySpizyOrders.forEach(order => {
            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            const renderRow = (type, name, ordered, done, isDone) => {
                 return `
                    <tr class="${isDone ? 'done' : ''}">
                        <td>${customer.name}</td>
                        <td>Špíz ${name}</td>
                        <td>${ordered}</td>
                        <td><input type="number" class="spizy-done-input" value="${done || ''}" data-order-id="${order.id}" data-type="${type}" style="width: 80px;"></td>
                        <td class="actions">
                            <button class="btn btn-sm ${isDone ? 'btn-secondary' : 'btn-success'}" data-action="toggle-spizy-done" data-order-id="${order.id}" data-type="${type}">Hotovo</button>
                        </td>
                    </tr>
                `;
            };

            if (order.klobasa > 0) spizyTableHTML += renderRow('klobasa', 'Klobása', order.klobasa, order.klobasaDone, order.klobasaIsDone);
            if (order.spek > 0) spizyTableHTML += renderRow('spek', 'Špek', order.spek, order.spekDone, order.spekIsDone);
            if (order.cilli > 0) spizyTableHTML += renderRow('cilli', 'Čilli Mango', order.cilli, order.cilliDone, order.cilliIsDone);
        });
    } else {
        spizyTableHTML += `<tr><td colspan="5" style="text-align: center;">Žádné objednávky špízů na tento den.</td></tr>`;
    }

    spizyTableHTML += `</tbody></table>`;
    spizyContainer.innerHTML = spizyTableHTML;

    // Render new collapsible sections
    renderOrderTableForSurovina('ŘÍZKY', 'main-page-rizky');
    renderOrderTableForSurovina('STEAK', 'main-page-steak');
    renderOrderTableForSurovina('HORNÍ STEHNA', 'main-page-horni-stehna', 'Horní stehna');
    renderOrderTableForSurovina('SPODNÍ STEHNA', 'main-page-spodni-stehna', 'Spodní stehna');
    renderOrderTableForSurovina('STEHNA', 'main-page-stehna');
}


export function toggleQuickEntryDone(id) {
    const date = appState.ui.selectedDate;
    if (!appState.quickEntryStatus[date]) {
        appState.quickEntryStatus[date] = {};
    }
    appState.quickEntryStatus[date][id] = !appState.quickEntryStatus[date][id];
    saveState();
    renderMainPage();
}

export function toggleSpizyDone(orderId, type) {
    const date = appState.ui.selectedDate;
    const order = appState.spizyOrders[date]?.find(o => o.id === orderId);
    if (order) {
        const key = `${type}IsDone`;
        order[key] = !order[key];
        saveState();
        renderMainPage();
    }
}

export function toggleMainPageOrderItemDone(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (order) {
        const item = order.items.find(i => i.id === itemId);
        if (item) {
            item.isDone = !item.isDone;
            saveState();
            render();
        }
    }
}

export function deleteOrderItemFromMainPage(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (order) {
        order.items = order.items.filter(i => i.id !== itemId);
        if (order.items.length === 0) {
            appState.orders = appState.orders.filter(o => o.id !== orderId);
        }
    }
    saveState();
    render();
    showToast('Položka objednávky smazána.');
}


export function handleKfcQuickStockChange(target) {
    const { surovinaId } = target.dataset;
    const surovina = appState.kfcSuroviny.find(s => s.id === surovinaId);
    if (surovina) {
        surovina.stockBoxes = parseInt(target.value) || 0;
        saveState();
    }
}

export function handleSpizyDoneChange(target) {
    const { orderId, type } = target.dataset;
    const date = appState.ui.selectedDate;
    const order = appState.spizyOrders[date]?.find(o => o.id === orderId);
    if (order) {
        const key = `${type}Done`;
        order[key] = parseInt(target.value) || 0;
        saveState();
    }
}