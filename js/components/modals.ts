/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast } from '../ui.ts';
import { getDailyNeeds, getMaykawaThighsNeeded } from '../services/calculations.ts';
import { generateId } from '../utils.ts';
import { render } from '../main.ts';
import { handleThighSplitProduction } from '../services/production.ts';

// --- Maykawa Modal ---
export function openMaykawaModal() {
    const { maykawaConfig } = appState;
    const modal = DOMElements.maykawaModal;

    modal.querySelector('#maykawa-bone-percent').value = maykawaConfig.bonePercent;
    modal.querySelector('#maykawa-skin-percent').value = maykawaConfig.skinPercent;
    modal.querySelector('#maykawa-deboning-speed').value = maykawaConfig.deboningSpeed;

    modal.querySelector('#maykawa-bone-percent').oninput = calculateAndRenderMaykawa;
    modal.querySelector('#maykawa-skin-percent').oninput = calculateAndRenderMaykawa;
    modal.querySelector('#maykawa-deboning-speed').oninput = calculateAndRenderMaykawa;
    
    calculateAndRenderMaykawa();
    modal.classList.add('active');
}

function calculateAndRenderMaykawa() {
    const modal = DOMElements.maykawaModal;
    const bonePercent = parseFloat(modal.querySelector('#maykawa-bone-percent').value) || 0;
    const skinPercent = parseFloat(modal.querySelector('#maykawa-skin-percent').value) || 0;
    const deboningSpeed = parseFloat(modal.querySelector('#maykawa-deboning-speed').value) || 0;

    appState.maykawaConfig = { bonePercent, skinPercent, deboningSpeed };
    saveState();

    const yieldPercent = 100 - bonePercent - skinPercent;
    modal.querySelector('#maykawa-yield-percent').value = yieldPercent.toFixed(2);
    
    const warningEl = modal.querySelector('#maykawa-total-percent-warning');
    if (yieldPercent < 0) {
        warningEl.textContent = 'Součet procent nesmí být větší než 100%.';
        warningEl.style.display = 'block';
    } else {
         warningEl.style.display = 'none';
    }

    modal.querySelector('#maykawa-date').textContent = new Date(appState.ui.selectedDate).toLocaleDateString('cs-CZ');

    const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
    const totalThighsNeededKg = getMaykawaThighsNeeded(appState.ui.selectedDate);

    const dailyNeeds = getDailyNeeds(appState.ui.selectedDate);
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    const totalSteakNeededKg = dailyNeeds[steakSurovina.id] || 0;
    modal.querySelector('#maykawa-steak-needed').textContent = totalSteakNeededKg.toFixed(2);

    const neededTimeEl = modal.querySelector('#maykawa-needed-time');
    if (totalThighsNeededKg > 0 && deboningSpeed > 0) {
        const neededHoursDecimal = totalThighsNeededKg / deboningSpeed;
        const neededHours = Math.floor(neededHoursDecimal);
        const neededMinutes = Math.round((neededHoursDecimal - neededHours) * 60);
        neededTimeEl.textContent = `${neededHours} hod ${neededMinutes} min`;
    } else {
        neededTimeEl.textContent = '0 hod 0 min';
    }

    
    if (!thighsSurovina || totalThighsNeededKg <= 0) {
        modal.querySelector('#maykawa-thighs-needed-kg').textContent = '0.00';
        modal.querySelector('#maykawa-thighs-needed-pallets').textContent = '0.00';
        modal.querySelector('#maykawa-bones-produced').textContent = '0.00';
        modal.querySelector('#maykawa-skin-produced').textContent = '0.00';
        return;
    }

    const totalThighsNeededPallets = totalThighsNeededKg / thighsSurovina.paletteWeight;
    const totalBonesKg = totalThighsNeededKg * (bonePercent / 100);
    const totalSkinKg = totalThighsNeededKg * (skinPercent / 100);

    modal.querySelector('#maykawa-thighs-needed-kg').textContent = totalThighsNeededKg.toFixed(2);
    modal.querySelector('#maykawa-thighs-needed-pallets').textContent = totalThighsNeededPallets.toFixed(2);
    modal.querySelector('#maykawa-bones-produced').textContent = totalBonesKg.toFixed(2);
    modal.querySelector('#maykawa-skin-produced').textContent = totalSkinKg.toFixed(2);
}

// --- Rizky Modal ---
export function openRizkyModal() {
    const { rizkyConfig } = appState;
    const modal = DOMElements.rizkyModal;

    modal.querySelector('#rizky-stock').value = rizkyConfig.stock;
    modal.querySelector('#rizky-prepad').value = rizkyConfig.prepad;
    modal.querySelector('#rizky-mastna').value = rizkyConfig.mastna;
    modal.querySelector('#rizky-line-performance').value = rizkyConfig.linePerformance;
    modal.querySelector('#rizky-start-time').value = rizkyConfig.startTime;
    
    ['#rizky-stock', '#rizky-prepad', '#rizky-mastna', '#rizky-line-performance', '#rizky-start-time'].forEach(selector => {
        modal.querySelector(selector).oninput = calculateAndRenderRizky;
    });

    calculateAndRenderRizky();
    modal.classList.add('active');
}

function calculateAndRenderRizky() {
    const modal = DOMElements.rizkyModal;
    
    const stock = parseFloat(modal.querySelector('#rizky-stock').value) || 0;
    const prepad = parseFloat(modal.querySelector('#rizky-prepad').value) || 0;
    const mastna = parseFloat(modal.querySelector('#rizky-mastna').value) || 0;
    const linePerformance = parseFloat(modal.querySelector('#rizky-line-performance').value) || 2500;
    const startTime = modal.querySelector('#rizky-start-time').value;

    appState.rizkyConfig = { stock, prepad, mastna, linePerformance, startTime };
    saveState();

    modal.querySelector('#rizky-date').textContent = new Date(appState.ui.selectedDate).toLocaleDateString('cs-CZ');

    const dailyNeeds = getDailyNeeds(appState.ui.selectedDate);
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    
    if (!rizkySurovina) {
        showToast('Surovina "ŘÍZKY" nebyla nalezena.', 'error');
        return;
    }

    const totalOrdersKg = dailyNeeds[rizkySurovina.id] || 0;
    modal.querySelector('#rizky-total-orders').textContent = totalOrdersKg.toFixed(2);

    const totalNeededKg = (totalOrdersKg + prepad + mastna) - stock;
    modal.querySelector('#rizky-total-needed').textContent = totalNeededKg.toFixed(2);

    if (totalNeededKg <= 0 || linePerformance <= 0) {
         modal.querySelector('#rizky-runtime').textContent = '0 hod 0 min';
         modal.querySelector('#rizky-end-time').textContent = startTime || 'N/A';
         return;
    }

    const runtimeHoursDecimal = totalNeededKg / linePerformance;
    const runtimeHours = Math.floor(runtimeHoursDecimal);
    const runtimeMinutes = Math.round((runtimeHoursDecimal - runtimeHours) * 60);
    modal.querySelector('#rizky-runtime').textContent = `${runtimeHours} hod ${runtimeMinutes} min`;

    if (startTime) {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startHour, startMinute, 0, 0);

        const totalMinutesToAdd = runtimeHours * 60 + runtimeMinutes;
        const endDate = new Date(startDate.getTime() + totalMinutesToAdd * 60000);
        
        const endHour = endDate.getHours().toString().padStart(2, '0');
        const endMinute = endDate.getMinutes().toString().padStart(2, '0');
        modal.querySelector('#rizky-end-time').textContent = `${endHour}:${endMinute}`;
    } else {
         modal.querySelector('#rizky-end-time').textContent = 'N/A';
    }
}

export function openRizkyAddOrderModal() {
    const modal = DOMElements.rizkyAddOrderModal;
    const date = appState.ui.selectedDate;
    modal.querySelector('#rizky-add-order-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    const body = modal.querySelector('#rizky-add-order-modal-body');

    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (!rizkySurovina) {
        body.innerHTML = '<p class="shortage">Surovina "ŘÍZKY" nebyla nalezena. Vytvořte ji v nastavení.</p>';
        modal.classList.add('active');
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead><tr><th>Zákazník</th><th>Typ balení</th><th>Počet beden</th></tr></thead>
            <tbody>
    `;

    appState.zakaznici.forEach(customer => {
        const order = appState.orders.find(o => o.customerId === customer.id && o.date === date);
        const findBoxCount = (type) => order?.items.find(i => i.surovinaId === rizkySurovina.id && i.type === type)?.boxCount || '';

        tableHTML += `
            <tr>
                <td rowspan="3" style="vertical-align: middle;"><strong>${customer.name}</strong></td>
                <td>Malé misky (OA)</td>
                <td><input type="number" class="rizky-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="OA" value="${findBoxCount('OA')}"></td>
            </tr>
            <tr>
                <td>Rodinné balení (RB)</td>
                <td><input type="number" class="rizky-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="RB" value="${findBoxCount('RB')}"></td>
            </tr>
            <tr>
                <td>Volně ložené (VL)</td>
                <td><input type="number" class="rizky-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="VL" value="${findBoxCount('VL')}"></td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    
    modal.classList.add('active');
}

export function saveRizkyOrders() {
    const modal = DOMElements.rizkyAddOrderModal;
    const date = appState.ui.selectedDate;
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    let ordersChanged = 0;

    modal.querySelectorAll('.rizky-order-boxes').forEach(input => {
        const boxCount = parseInt(input.value) || 0;
        const customerId = input.dataset.customerId;
        const orderType = input.dataset.orderType;

        let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
        if (!order && boxCount > 0) {
            order = { id: generateId(), date: date, customerId: customerId, items: [] };
            appState.orders.push(order);
        }

        if (order) {
            let item = order.items.find(i => i.surovinaId === rizkySurovina.id && i.type === orderType);

            if (boxCount > 0) {
                if (item) {
                    if (item.boxCount !== boxCount) {
                        item.boxCount = boxCount;
                        ordersChanged++;
                    }
                } else {
                    order.items.push({
                        id: generateId(),
                        surovinaId: rizkySurovina.id,
                        boxCount: boxCount,
                        isActive: true,
                        type: orderType
                    });
                    ordersChanged++;
                }
            } else { 
                if (item) {
                    order.items = order.items.filter(i => i.id !== item.id);
                    ordersChanged++;
                }
            }
        }
    });

    if (ordersChanged > 0) {
        saveState();
        showToast(`Objednávky řízků uloženy.`);
        render();
    }
    
    modal.classList.remove('active');

    if(DOMElements.rizkyModal.classList.contains('active')) {
        calculateAndRenderRizky();
    }
}

export function openMaykawaAddOrderModal() {
    const modal = DOMElements.maykawaAddOrderModal;
    const date = appState.ui.selectedDate;
    modal.querySelector('#maykawa-add-order-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    const body = modal.querySelector('#maykawa-add-order-modal-body');

    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    if (!steakSurovina) {
        body.innerHTML = '<p class="shortage">Surovina "STEAK" nebyla nalezena. Vytvořte ji v nastavení.</p>';
        modal.classList.add('active');
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead><tr><th>Zákazník</th><th>Typ balení</th><th>Počet beden</th></tr></thead>
            <tbody>
    `;

    appState.zakaznici.forEach(customer => {
        const order = appState.orders.find(o => o.customerId === customer.id && o.date === date);
        const findBoxCount = (type) => order?.items.find(i => i.surovinaId === steakSurovina.id && i.type === type)?.boxCount || '';

        tableHTML += `
            <tr>
                <td rowspan="3" style="vertical-align: middle;"><strong>${customer.name}</strong></td>
                <td>Malé misky (OA)</td>
                <td><input type="number" class="maykawa-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="OA" value="${findBoxCount('OA')}"></td>
            </tr>
            <tr>
                <td>Rodinné balení (RB)</td>
                <td><input type="number" class="maykawa-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="RB" value="${findBoxCount('RB')}"></td>
            </tr>
            <tr>
                <td>Volně ložené (VL)</td>
                <td><input type="number" class="maykawa-order-boxes" min="0" placeholder="0" style="width: 100px;" data-customer-id="${customer.id}" data-order-type="VL" value="${findBoxCount('VL')}"></td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    
    modal.classList.add('active');
}

export function saveMaykawaOrders() {
    const modal = DOMElements.maykawaAddOrderModal;
    const date = appState.ui.selectedDate;
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    let ordersChanged = 0;

    modal.querySelectorAll('.maykawa-order-boxes').forEach(input => {
        const boxCount = parseInt(input.value) || 0;
        const customerId = input.dataset.customerId;
        const orderType = input.dataset.orderType;

        let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
        if (!order && boxCount > 0) {
            order = { id: generateId(), date: date, customerId: customerId, items: [] };
            appState.orders.push(order);
        }

        if (order) {
            let item = order.items.find(i => i.surovinaId === steakSurovina.id && i.type === orderType);

            if (boxCount > 0) {
                if (item) {
                    if (item.boxCount !== boxCount) {
                        item.boxCount = boxCount;
                        ordersChanged++;
                    }
                } else {
                    order.items.push({
                        id: generateId(),
                        surovinaId: steakSurovina.id,
                        boxCount: boxCount,
                        isActive: true,
                        type: orderType
                    });
                    ordersChanged++;
                }
            } else { 
                if (item) {
                    order.items = order.items.filter(i => i.id !== item.id);
                    ordersChanged++;
                }
            }
        }
    });

    if (ordersChanged > 0) {
        saveState();
        showToast(`Objednávky steaku uloženy.`);
        render();
    }
    
    modal.classList.remove('active');

    if(DOMElements.maykawaModal.classList.contains('active')) {
        calculateAndRenderMaykawa();
    }
}

export function openAddSurovinyModal() {
    const modal = DOMElements.addSurovinyModal;
    const body = modal.querySelector('#add-suroviny-modal-body');
    body.innerHTML = ''; // Clear previous content

    const baseSuroviny = appState.suroviny.filter(s => !s.isMix && !s.isProduct);

    // Using a responsive grid layout instead of a fixed table
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    container.style.gap = '20px';

    baseSuroviny.forEach(surovina => {
        const itemDiv = document.createElement('div');
        // Using existing .card class for styling, but with less padding for a more compact look
        itemDiv.className = 'card';
        itemDiv.style.padding = '15px';
        itemDiv.style.marginBottom = '0';
        
        itemDiv.innerHTML = `
            <h4 style="font-weight: 600; margin-bottom: 12px; font-size: 1rem;">${surovina.name}</h4>
            <div class="form-row" style="gap: 10px; align-items: end;">
                <div class="form-field">
                    <label>Přidat palety</label>
                    <input type="number" class="surovina-palette-input" min="0" placeholder="0" data-surovina-id="${surovina.id}">
                </div>
                <div class="form-field">
                    <label>Přidat bedny</label>
                    <input type="number" class="surovina-box-input" min="0" placeholder="0" data-surovina-id="${surovina.id}">
                </div>
            </div>
        `;
        container.appendChild(itemDiv);
    });

    body.appendChild(container);

    // Handle Enter key navigation
    const allPaletteInputs = Array.from(body.querySelectorAll('.surovina-palette-input'));
    const allBoxInputs = Array.from(body.querySelectorAll('.surovina-box-input'));

    const addEnterNavigation = (inputs, nextInputList = null) => {
        inputs.forEach((input, index) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextIndex = index + 1;
                    if (nextIndex < inputs.length) {
                        inputs[nextIndex].focus();
                    } else if (nextInputList && nextInputList.length > 0) {
                        // At the end of a column, jump to the start of the next
                        nextInputList[0].focus();
                    } else {
                        // At the very end, focus the save button
                        modal.querySelector('[data-action="save-added-suroviny"]').focus();
                    }
                }
            });
        });
    };

    addEnterNavigation(allPaletteInputs, allBoxInputs);
    addEnterNavigation(allBoxInputs, null); // Pass null to focus save button at the end
    
    modal.classList.add('active');
}

export function saveAddedSuroviny() {
    const modal = DOMElements.addSurovinyModal;
    const date = appState.ui.selectedDate;
    let itemsChanged = 0;

    if (!appState.dailyStockAdjustments[date]) {
        appState.dailyStockAdjustments[date] = {};
    }

    modal.querySelectorAll('.card').forEach(card => {
        const paletteInput = card.querySelector('.surovina-palette-input');
        const boxInput = card.querySelector('.surovina-box-input');
        const surovinaId = paletteInput.dataset.surovinaId;

        const palettesToAdd = parseFloat(paletteInput.value) || 0;
        const boxesToAdd = parseInt(boxInput.value) || 0;

        if (palettesToAdd > 0) {
            const surovina = appState.suroviny.find(s => s.id === surovinaId);
            if (surovina) {
                surovina.stock = (surovina.stock || 0) + palettesToAdd;
                itemsChanged++;
            }
        }

        if (boxesToAdd > 0) {
            appState.dailyStockAdjustments[date][surovinaId] = (appState.dailyStockAdjustments[date][surovinaId] || 0) + boxesToAdd;
            handleThighSplitProduction(surovinaId, boxesToAdd, date);
            itemsChanged++;
        }
    });

    if (itemsChanged > 0) {
        saveState();
        showToast('Suroviny byly přidány na sklad.');
        render(); // Re-render the current view to reflect changes
    }
    
    modal.classList.remove('active');
}

export function openProductionModal() {
    DOMElements.productionActionsModal.classList.add('active');
}


// --- Minced Meat Modals ---

function renderMincedMeatModalContent() {
    const date = appState.ui.selectedDate;
    const modal = DOMElements.mincedMeatModal;
    const body = modal.querySelector('#minced-meat-modal-body');
    modal.querySelector('#minced-meat-date').textContent = new Date(date).toLocaleDateString('cs-CZ');

    const mincedMeatSurovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
    if (!mincedMeatSurovina) {
        body.innerHTML = '<p class="shortage">Surovina "MLETÉ MASO" nenalezena. Zkontrolujte nastavení.</p>';
        return;
    }

    const ordersForDay = appState.orders.filter(o => o.date === date);
    const mincedMeatItems = [];
    ordersForDay.forEach(order => {
        order.items.forEach(item => {
            if (item.surovinaId === mincedMeatSurovina.id && item.isActive) {
                mincedMeatItems.push({ ...item, customerId: order.customerId, orderId: order.id });
            }
        });
    });

    let totalNeededKgClean = 0;
    let totalNeededKgStabilized = 0;
    let tableHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Objednávky</h3></div>
            <div class="card-content">
                <table class="data-table">
                    <thead><tr><th>Zákazník</th><th>Typ balení</th><th>Počet beden</th><th>Celková váha (kg)</th><th>Stabiliz.</th><th class="actions">Akce</th></tr></thead>
                    <tbody>
    `;

    if (mincedMeatItems.length > 0) {
        mincedMeatItems.forEach(item => {
            const customer = appState.zakaznici.find(c => c.id === item.customerId);
            const weights = appState.boxWeights[customer.id]?.[mincedMeatSurovina.id] || {};
            const boxWeightInGrams = weights[item.type] || 4000;
            const itemWeightKg = (item.boxCount * boxWeightInGrams) / 1000;
            
            if (item.isStabilized) {
                totalNeededKgStabilized += itemWeightKg;
            } else {
                totalNeededKgClean += itemWeightKg;
            }

            const stabilizedCheckbox = `<input type="checkbox" data-action="toggle-item-stabilized" data-order-id="${item.orderId}" data-item-id="${item.id}" ${item.isStabilized ? 'checked' : ''}>`;

            tableHTML += `
                <tr>
                    <td>${customer?.name || 'N/A'}</td>
                    <td>${item.type}</td>
                    <td>${item.boxCount} ks</td>
                    <td>${itemWeightKg.toFixed(2)}</td>
                    <td style="text-align: center;">${stabilizedCheckbox}</td>
                    <td class="actions">
                        <button class="btn-icon danger" data-action="delete-minced-meat-order-item" data-order-id="${item.orderId}" data-item-id="${item.id}">${ICONS.trash}</button>
                    </td>
                </tr>
            `;
        });
    } else {
        tableHTML += '<tr><td colspan="6" style="text-align: center;">Žádné objednávky</td></tr>';
    }
    tableHTML += '</tbody></table></div></div>';

    // Raw material calculation
    const steakSurovina = appState.suroviny.find(s => s.name === 'STEAK');
    const totalSteakNeededKg = totalNeededKgClean + totalNeededKgStabilized;
    const steakStockKg = steakSurovina ? ((steakSurovina.stock || 0) * (steakSurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[steakSurovina.id] || 0) * (steakSurovina.boxWeight || 25)) : 0;
    const steakBalanceKg = steakStockKg - totalSteakNeededKg;

    let needsHtml = `
        <div class="card">
             <div class="card-header"><h3 class="card-title">Potřeba suroviny</h3></div>
             <div class="card-content">
                <table class="data-table">
                 <thead><tr><th>Surovina</th><th>Potřeba (kg)</th><th>Skladem (kg)</th><th>Chybí / Přebývá (kg)</th></tr></thead>
                 <tbody>
                    <tr>
                        <td>STEAK (čisté)</td>
                        <td>${totalNeededKgClean.toFixed(2)}</td>
                        <td rowspan="2" style="vertical-align: middle; text-align: center;">${steakStockKg.toFixed(2)}</td>
                        <td rowspan="2" style="vertical-align: middle; text-align: center;" class="${steakBalanceKg < 0 ? 'shortage' : 'surplus'}">${steakBalanceKg.toFixed(2)}</td>
                    </tr>
                     <tr>
                        <td>STEAK (stabilizované)</td>
                        <td>${totalNeededKgStabilized.toFixed(2)}</td>
                    </tr>
                     <tr style="font-weight: bold; background-color: var(--bg-tertiary);">
                        <td>Celkem STEAK</td>
                        <td>${totalSteakNeededKg.toFixed(2)}</td>
                        <td>${steakStockKg.toFixed(2)}</td>
                        <td class="${steakBalanceKg < 0 ? 'shortage' : 'surplus'}">${steakBalanceKg.toFixed(2)}</td>
                    </tr>
                 </tbody>
                </table>
             </div>
        </div>
    `;

    body.innerHTML = tableHTML + needsHtml;
    feather.replace();
}


export function openMincedMeatModal() {
    renderMincedMeatModalContent();
    DOMElements.mincedMeatModal.classList.add('active');
}

export function openAddMincedMeatOrderModal() {
    const modal = DOMElements.addMincedMeatOrderModal;
    const tbody = modal.querySelector('tbody');
    const date = appState.ui.selectedDate;

    const mincedMeatSurovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
    if (!mincedMeatSurovina) {
        tbody.innerHTML = '<tr><td colspan="4" class="shortage">Surovina "MLETÉ MASO" nenalezena. Zkontrolujte nastavení.</td></tr>';
        modal.classList.add('active');
        return;
    }

    let tableHTML = '';
    appState.zakaznici.forEach(customer => {
        const order = appState.orders.find(o => o.customerId === customer.id && o.date === date);
        const findBoxCount = (type) => order?.items.find(i => i.surovinaId === mincedMeatSurovina.id && i.type === type)?.boxCount || '';
        
        tableHTML += `
            <tr data-customer-id="${customer.id}">
                <td><strong>${customer.name}</strong></td>
                <td><input type="number" class="minced-meat-order-input" data-type="OA" min="0" placeholder="0" value="${findBoxCount('OA')}" style="width: 100px;"></td>
                <td><input type="number" class="minced-meat-order-input" data-type="RB" min="0" placeholder="0" value="${findBoxCount('RB')}" style="width: 100px;"></td>
                <td><input type="number" class="minced-meat-order-input" data-type="VL" min="0" placeholder="0" value="${findBoxCount('VL')}" style="width: 100px;"></td>
            </tr>
        `;
    });
    tbody.innerHTML = tableHTML;
    
    modal.classList.add('active');
}

export function saveMincedMeatOrder() {
    const modal = DOMElements.addMincedMeatOrderModal;
    const date = appState.ui.selectedDate;
    const mincedMeatSurovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
    let ordersChanged = 0;

    modal.querySelectorAll('tbody tr').forEach(row => {
        const customerId = row.dataset.customerId;
        let order = appState.orders.find(o => o.customerId === customerId && o.date === date);

        const inputs = row.querySelectorAll('.minced-meat-order-input');
        inputs.forEach(input => {
            const boxCount = parseInt(input.value) || 0;
            const orderType = input.dataset.type;

            if (!order && boxCount > 0) {
                order = { id: generateId(), date: date, customerId: customerId, items: [] };
                appState.orders.push(order);
            }

            if (order) {
                let item = order.items.find(i => i.surovinaId === mincedMeatSurovina.id && i.type === orderType);

                if (boxCount > 0) {
                    if (item) {
                        if (item.boxCount !== boxCount) {
                            item.boxCount = boxCount;
                            ordersChanged++;
                        }
                    } else {
                        // Check for saved preference when creating a new item
                        const isStabilizedDefault = appState.mincedMeatStabilizedDefaults?.[customerId]?.[orderType] || false;
                        order.items.push({
                            id: generateId(),
                            surovinaId: mincedMeatSurovina.id,
                            boxCount: boxCount,
                            isActive: true,
                            type: orderType,
                            doneCount: 0,
                            isStabilized: isStabilizedDefault
                        });
                        ordersChanged++;
                    }
                } else if (item) { // boxCount is 0, so remove item if it exists
                    order.items = order.items.filter(i => i.id !== item.id);
                    ordersChanged++;
                }
            }
        });

        // Clean up empty orders
        if (order && order.items.length === 0) {
            appState.orders = appState.orders.filter(o => o.id !== order.id);
        }
    });

    if (ordersChanged > 0) {
        saveState();
        showToast(`Objednávky mletého masa uloženy.`);
    }
    
    modal.classList.remove('active');
    renderMincedMeatModalContent();
    render();
}

export function deleteMincedMeatOrderItem(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (order) {
        order.items = order.items.filter(i => i.id !== itemId);
        if (order.items.length === 0) {
            appState.orders = appState.orders.filter(o => o.id !== order.id);
        }
    }
    saveState();
    renderMincedMeatModalContent(); // Re-render just the modal content.
    showToast('Položka smazána.');
    render(); // To update badges
}

export function openSurovinaSourceModal() {
    DOMElements.surovinaSourceModal.classList.add('active');
}

export function openAddSurovinyModalFromStock() {
    DOMElements.surovinaSourceModal.classList.remove('active');
    openAddSurovinyModal();
}

export function openYieldAdjustmentModal() {
    DOMElements.surovinaSourceModal.classList.remove('active');
    const modal = DOMElements.yieldAdjustmentModal;
    const body = modal.querySelector('#yield-adjustment-modal-body');
    const date = appState.ui.selectedDate;
    
    const yieldableSurovinyNames = [
        'PRSA', 'STEHNA', 'KŘÍDLA', 'ZADNÍ DÍLY (SKELETY)', 'HRBETY', 
        'KŮŽE', 'KOSTI', 'JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY', 'PRDELE'
    ];
    const suroviny = appState.suroviny.filter(s => yieldableSurovinyNames.includes(s.name.toUpperCase()) && s.isActive);

    const adjustments = appState.yieldAdjustments?.[date] || {};

    let content = `<p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 20px;">
        Zde zadejte skutečnou váhu (v kg) vybraných dílů, jak byla navážena z dnešní výroby. 
        Tato hodnota přepíše automaticky vypočítanou výtěžnost.
        Nevyplněné položky budou vypočítány automaticky.
    </p>`;
    
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    container.style.gap = '20px';

    suroviny.forEach(surovina => {
        const value = adjustments[surovina.id] || '';
        const itemDiv = document.createElement('div');
        itemDiv.className = 'form-field';
        itemDiv.innerHTML = `
            <label>${surovina.name}</label>
            <input type="number" class="yield-adjustment-input" step="0.1" min="0" placeholder="kg" data-surovina-id="${surovina.id}" value="${value}">
        `;
        container.appendChild(itemDiv);
    });

    body.innerHTML = content;
    body.appendChild(container);
    
    modal.classList.add('active');
}

export function saveYieldAdjustment() {
    const modal = DOMElements.yieldAdjustmentModal;
    const date = appState.ui.selectedDate;

    if (!appState.yieldAdjustments[date]) {
        appState.yieldAdjustments[date] = {};
    }

    let itemsChanged = 0;
    modal.querySelectorAll('.yield-adjustment-input').forEach(input => {
        const surovinaId = input.dataset.surovinaId;
        const kg = parseFloat(input.value);

        if (!isNaN(kg) && kg >= 0) {
            appState.yieldAdjustments[date][surovinaId] = kg;
            itemsChanged++;
        } else {
            // If input is empty or invalid, remove the adjustment
            delete appState.yieldAdjustments[date][surovinaId];
        }
    });

    if (itemsChanged > 0) {
        saveState();
        showToast('Upřesnění výtěžnosti bylo uloženo.');
        render(); // Re-render the current view to reflect changes
    }
    
    modal.classList.remove('active');
}