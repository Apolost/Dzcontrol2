/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, showToast } from '../ui.ts';
import { getDailyNeeds, getMaykawaThighsNeeded } from '../services/calculations.ts';
import { generateId } from '../utils.ts';
import { renderMainPage } from './mainPage.ts';

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

    const ordersForDay = appState.orders.filter(o => o.date === date);
    const customersWithRizkyOrder = new Set();
    ordersForDay.forEach(order => {
        if (order.items.some(item => item.surovinaId === rizkySurovina.id)) {
            customersWithRizkyOrder.add(order.customerId);
        }
    });

    const customersWithoutOrder = appState.zakaznici.filter(c => !customersWithRizkyOrder.has(c.id));

    if (customersWithoutOrder.length === 0) {
         body.innerHTML = '<p>Všichni zákazníci již mají objednávku řízků na tento den.</p>';
    } else {
        let tableHTML = `
            <table class="data-table">
                <thead><tr><th>Zákazník</th><th>Typ balení</th><th>Počet beden</th></tr></thead>
                <tbody>
        `;
        customersWithoutOrder.forEach(customer => {
            tableHTML += `
                <tr data-customer-id="${customer.id}">
                    <td>${customer.name}</td>
                    <td>
                        <select class="rizky-order-type" style="width: 200px;">
                            <option value="OA">Malé misky (OA)</option>
                            <option value="RB">Rodinné balení (RB)</option>
                            <option value="VL">Volně ložené (VL)</option>
                        </select>
                    </td>
                    <td><input type="number" class="rizky-order-boxes" min="0" placeholder="0" style="width: 100px;"></td>
                </tr>
            `;
        });
        tableHTML += '</tbody></table>';
        body.innerHTML = tableHTML;
    }
    
    modal.classList.add('active');
}

export function saveRizkyOrders() {
    const modal = DOMElements.rizkyAddOrderModal;
    const date = appState.ui.selectedDate;
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    let ordersAdded = 0;

    modal.querySelectorAll('#rizky-add-order-modal-body tbody tr').forEach(row => {
        const boxCount = parseInt(row.querySelector('.rizky-order-boxes').value) || 0;
        if (boxCount > 0) {
            const customerId = row.dataset.customerId;
            const orderType = row.querySelector('.rizky-order-type').value;

            let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
            if (!order) {
                order = { id: generateId(), date: date, customerId: customerId, items: [] };
                appState.orders.push(order);
            }
            
            order.items.push({
                id: generateId(),
                surovinaId: rizkySurovina.id,
                boxCount: boxCount,
                isActive: true,
                type: orderType
            });
            ordersAdded++;
        }
    });

    if (ordersAdded > 0) {
        saveState();
        showToast(`Přidáno ${ordersAdded} objednávek řízků.`);
        renderMainPage();
    }
    modal.classList.remove('active');
}
