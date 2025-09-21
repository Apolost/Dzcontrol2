/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';
import { renderMainPage } from './mainPage.ts';

export function renderOrders() {
    const accordion = document.getElementById('orders-accordion');
    accordion.innerHTML = '';
    appState.zakaznici.forEach(customer => {
        const details = document.createElement('details');
        details.dataset.customerId = customer.id;
        if(appState.ui.openAccordionId === customer.id) {
            details.open = true;
        }
        details.innerHTML = `<summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary><div class="details-content"></div>`;
        const content = details.querySelector('.details-content');
        
        const orderTypes = [
            { key: 'OA', title: 'Malé misky (OA)' },
            { key: 'RB', title: 'Rodinné balení (RB)' },
            { key: 'VL', title: 'Volně ložené (VL)' },
        ];

        let contentHTML = '<div class="order-types-container">';

        const order = appState.orders.find(o => o.customerId === customer.id && o.date === appState.ui.selectedDate);

        orderTypes.forEach(typeInfo => {
            contentHTML += `
                <div class="order-type-column">
                    <h3>${typeInfo.title}</h3>
            `;
            const itemsOfType = order ? order.items.filter(item => item.type === typeInfo.key) : [];
            
            contentHTML += `
                <table class="data-table">
                    <thead><tr><th>Pořadí</th><th>Produkt</th><th>Bedny</th><th class="actions">Akce</th></tr></thead>
                    <tbody>
            `;

            if (itemsOfType.length > 0) {
                 itemsOfType.sort((a,b) => (b.isActive === a.isActive) ? 0 : b.isActive ? -1 : 1)
                 .forEach((item, index) => {
                    const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
                    if (!surovina) return;
                    
                    const itemInactiveClass = !item.isActive ? 'class="order-item-inactive"' : '';
                    const upButtonDisabled = index === 0 ? 'disabled' : '';
                    const downButtonDisabled = index === itemsOfType.length - 1 ? 'disabled' : '';
                    const activeButton = item.isActive 
                        ? `<button class="btn-icon" data-action="toggle-item-active" title="Deaktivovat" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.eyeOff}</button>`
                        : `<button class="btn-icon" data-action="toggle-item-active" title="Aktivovat" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.eye}</button>`;

                    contentHTML += `
                        <tr ${itemInactiveClass}>
                            <td style="width: 80px;">
                                <button class="btn-icon" data-action="move-order-item" data-order-id="${order.id}" data-item-id="${item.id}" data-direction="up" ${upButtonDisabled}>${ICONS.arrowUp}</button>
                                <button class="btn-icon" data-action="move-order-item" data-order-id="${order.id}" data-item-id="${item.id}" data-direction="down" ${downButtonDisabled}>${ICONS.arrowDown}</button>
                            </td>
                            <td>${surovina.name}</td>
                            <td><input type="number" value="${item.boxCount}" data-order-id="${order.id}" data-item-id="${item.id}" class="order-box-count-input" style="width: 80px;"></td>
                            <td class="actions">
                                ${surovina.isMix ? `<button class="btn btn-secondary btn-sm" data-action="edit-mix-ratio" data-order-id="${order.id}" data-item-id="${item.id}">Poměr</button>` : ''}
                                ${activeButton}
                                <button class="btn-icon danger" data-action="delete-order-item" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.trash}</button>
                            </td>
                        </tr>
                    `;
                });
            }
            contentHTML += `</tbody></table>`;
            contentHTML += `<button class="btn btn-primary" data-action="add-order-items" data-id="${customer.id}" data-order-type="${typeInfo.key}" style="margin-top: 15px;"><i data-feather="plus"></i> Přidat</button>`;
            contentHTML += `</div>`; // end column

        });

        contentHTML += '</div>'; // end container
        content.innerHTML = contentHTML;
        accordion.appendChild(details);
    });
    
    // --- "Ostatní produkty" section ---
    const otherDetails = document.createElement('details');
    otherDetails.dataset.customerId = 'other';
    if (appState.ui.openAccordionId === 'other') {
        otherDetails.open = true;
    }
    otherDetails.innerHTML = `<summary>Ostatní produkty<i data-feather="chevron-right" class="arrow-icon"></i></summary><div class="details-content"></div>`;
    const otherContent = otherDetails.querySelector('.details-content');

    let otherContentHTML = `
        <table class="data-table">
            <thead><tr><th>Zákazník</th><th>Produkt</th><th>Bedny</th><th>Typ</th><th class="actions">Akce</th></tr></thead>
            <tbody>
    `;

    const otherProductIds = new Set(appState.products.filter(p => p.isOther).map(p => p.id));
    let hasOtherItems = false;

    appState.orders.filter(o => o.date === appState.ui.selectedDate).forEach(order => {
        order.items.forEach(item => {
            if (otherProductIds.has(item.surovinaId)) {
                hasOtherItems = true;
                const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
                const customer = appState.zakaznici.find(c => c.id === order.customerId);

                if (!surovina || !customer) return;

                otherContentHTML += `
                    <tr>
                        <td>${customer.name}</td>
                        <td>${surovina.name}</td>
                        <td><input type="number" value="${item.boxCount}" data-order-id="${order.id}" data-item-id="${item.id}" class="order-box-count-input" style="width: 80px;"></td>
                        <td>${item.type}</td>
                        <td class="actions">
                            <button class="btn-icon danger" data-action="delete-order-item" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.trash}</button>
                        </td>
                    </tr>
                `;
            }
        });
    });

    if (!hasOtherItems) {
        otherContentHTML += `<tr><td colspan="5" style="text-align: center;">Žádné objednávky pro 'Ostatní produkty' na tento den.</td></tr>`;
    }
    otherContentHTML += `</tbody></table>`;
    otherContentHTML += `<button class="btn btn-primary" data-action="add-main-order" data-order-category="other" style="margin-top: 15px;"><i data-feather="plus"></i> Přidat</button>`;
    otherContent.innerHTML = otherContentHTML;
    accordion.appendChild(otherDetails);

    
    accordion.querySelectorAll('.order-box-count-input').forEach(input => {
        input.addEventListener('change', e => {
            const order = appState.orders.find(o => o.id === e.target.dataset.orderId);
            const item = order?.items.find(i => i.id === e.target.dataset.itemId);
            if (item) item.boxCount = parseFloat(e.target.value) || 0;
            saveState();
        });
    });
    accordion.querySelectorAll('details').forEach(detail => {
        detail.addEventListener('toggle', () => {
            if(detail.open) {
                appState.ui.openAccordionId = detail.dataset.customerId;
            } else if (appState.ui.openAccordionId === detail.dataset.customerId) {
                appState.ui.openAccordionId = null;
            }
        });
    });
}

export function openMixRatioModal(orderId, itemId) {
    appState.ui.editingOrderItemId = itemId;
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
    if (!item || !surovina || !surovina.isMix) return;

    DOMElements.mixRatioModal.querySelector('.modal-title').textContent = `Poměr pro: ${surovina.name}`;
    const body = DOMElements.mixRatioModal.querySelector('.modal-body');
    body.innerHTML = '';
    
    const components = item.ratioOverride || appState.mixDefinitions[surovina.id].components;
    components.forEach(comp => {
        const compSurovina = appState.suroviny.find(s => s.id === comp.surovinaId);
        const row = document.createElement('div');
        row.className = 'form-row';
        row.innerHTML = `
            <div class="form-field" style="flex: 3;"><label>${compSurovina.name}</label></div>
            <div class="form-field"><input type="number" class="mix-ratio-percentage" value="${comp.percentage}" data-surovina-id="${comp.surovinaId}" min="0" max="100"></div>
        `;
        body.appendChild(row);
    });
    DOMElements.mixRatioModal.classList.add('active');
}

export function openAddOrderModal(customerId, orderType) {
    appState.ui.addingToCustomerId = customerId;
    appState.ui.addingToOrderType = orderType;
    const customer = appState.zakaznici.find(c => c.id === customerId);

    const typeTitles = { OA: 'Malé misky', RB: 'Rodinné balení', VL: 'Volně ložené' };
    const typeTitle = typeTitles[orderType] || '';
    
    DOMElements.addOrderModal.querySelector('.modal-title').textContent = `Přidat do: ${customer.name} (${typeTitle})`;
    const body = DOMElements.addOrderModal.querySelector('.modal-body');
    body.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `<thead><tr><th>Produkt</th><th>Počet beden</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    
    appState.suroviny.filter(s => s.isActive).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td><input type="number" min="0" class="add-order-box-count" data-surovina-id="${s.id}" style="width: 100px;"></td>
        `;
        tbody.appendChild(tr);
    });
    body.appendChild(table);

    const inputs = body.querySelectorAll('.add-order-box-count');
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (input.value === '') {
                    input.value = 0;
                }
                const nextInput = inputs[index + 1];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                } else {
                    DOMElements.addOrderModal.querySelector('[data-action="save-added-items"]').focus();
                }
            }
        });
    });
    
    DOMElements.addOrderModal.classList.add('active');
    if(inputs[0]) {
        inputs[0].focus();
        inputs[0].select();
    }
}

export function saveAddedItems() {
    const customerId = appState.ui.addingToCustomerId;
    const orderType = appState.ui.addingToOrderType;
    if (!customerId || !orderType) return;

    let order = appState.orders.find(o => o.customerId === customerId && o.date === appState.ui.selectedDate);
    if (!order) {
        order = { id: generateId(), date: appState.ui.selectedDate, customerId, items: [] };
        appState.orders.push(order);
    }
    
    DOMElements.addOrderModal.querySelectorAll('.add-order-box-count').forEach(input => {
        const boxCount = parseInt(input.value);
        if (boxCount > 0) {
            const surovinaId = input.dataset.surovinaId;
            const existingItem = order.items.find(item => item.surovinaId === surovinaId && item.type === orderType);
            if (existingItem) {
                existingItem.boxCount += boxCount;
            } else {
                order.items.push({ id: generateId(), surovinaId, boxCount, isActive: true, type: orderType });
            }
        }
    });
    
    appState.ui.openAccordionId = customerId;
    saveState();
    renderOrders();
    DOMElements.addOrderModal.classList.remove('active');
    showToast('Položky přidány do objednávky');
}

export function deleteOrderItem(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (order) {
        appState.ui.openAccordionId = order.customerId;
        order.items = order.items.filter(i => i.id !== itemId);
        if (order.items.length === 0) {
            appState.orders = appState.orders.filter(o => o.id !== orderId);
        }
    }
    saveState();
    renderOrders();
}

export function moveOrderItem(orderId, itemId, direction) {
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const itemToMove = order.items.find(i => i.id === itemId);
    if (!itemToMove) return;
    
    const itemsInOrder = order.items;
    const filteredItems = itemsInOrder.filter(i => i.type === itemToMove.type && i.isActive === itemToMove.isActive);

    const indexInFiltered = filteredItems.findIndex(i => i.id === itemId);

    if (direction === 'up' && indexInFiltered > 0) {
        const neighbor = filteredItems[indexInFiltered - 1];
        const originalIndex1 = itemsInOrder.findIndex(i => i.id === itemToMove.id);
        const originalIndex2 = itemsInOrder.findIndex(i => i.id === neighbor.id);
        [itemsInOrder[originalIndex1], itemsInOrder[originalIndex2]] = [itemsInOrder[originalIndex2], itemsInOrder[originalIndex1]];
    } else if (direction === 'down' && indexInFiltered < filteredItems.length - 1) {
        const neighbor = filteredItems[indexInFiltered + 1];
        const originalIndex1 = itemsInOrder.findIndex(i => i.id === itemToMove.id);
        const originalIndex2 = itemsInOrder.findIndex(i => i.id === neighbor.id);
        [itemsInOrder[originalIndex1], itemsInOrder[originalIndex2]] = [itemsInOrder[originalIndex2], itemsInOrder[originalIndex1]];
    }
    
    saveState();
    renderOrders();
}

export function toggleOrderItemActive(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;

    item.isActive = !item.isActive;
    saveState();
    renderOrders();
}

export function openAddMainOrderModal(category = null) {
    const modal = DOMElements.addMainOrderModal;
    const mainOrderCustomer = modal.querySelector('#main-order-customer');
    const mainOrderType = modal.querySelector('#main-order-type');
    const mainOrderTypeGroup = modal.querySelector('#main-order-type-group');
    
    mainOrderCustomer.innerHTML = '<option value="">-- Vyberte --</option>' + 
        appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    mainOrderCustomer.value = '';
    mainOrderType.value = '';
    mainOrderTypeGroup.style.display = 'none';
    
    const renderAndListen = () => renderMainOrderProducts(category);

    mainOrderCustomer.onchange = () => {
        mainOrderTypeGroup.style.display = mainOrderCustomer.value ? 'block' : 'none';
        mainOrderType.value = '';
        renderAndListen();
    };
    mainOrderType.onchange = renderAndListen;

    renderMainOrderProducts(category);
    modal.classList.add('active');
}

function renderMainOrderProducts(category = null) {
    const modal = DOMElements.addMainOrderModal;
    const customerId = modal.querySelector('#main-order-customer').value;
    const orderType = modal.querySelector('#main-order-type').value;
    const container = modal.querySelector('#main-order-products-container');

    if (!customerId || !orderType) {
        container.innerHTML = '<p>Nejprve vyberte zákazníka a typ balení.</p>';
        return;
    }

    let productsToShow = appState.suroviny.filter(s => s.isActive);
    if (category === 'other') {
        const otherProductIds = new Set(appState.products.filter(p => p.isOther).map(p => p.id));
        productsToShow = productsToShow.filter(s => otherProductIds.has(s.id));
    }

    let html = '<div style="max-height: 40vh; overflow-y: auto;"><table class="data-table">';
    html += '<thead><tr><th>Produkt</th><th>Počet beden</th></tr></thead><tbody>';
    
    productsToShow.forEach(s => {
        html += `
            <tr>
                <td>${s.name}</td>
                <td><input type="number" min="0" class="main-order-box-count" data-surovina-id="${s.id}" style="width: 100px;"></td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

export function saveMainOrder() {
    const modal = DOMElements.addMainOrderModal;
    const customerId = modal.querySelector('#main-order-customer').value;
    const orderType = modal.querySelector('#main-order-type').value;
    if (!customerId || !orderType) {
        showToast('Vyberte zákazníka a typ balení.', 'error');
        return;
    }

    let order = appState.orders.find(o => o.customerId === customerId && o.date === appState.ui.selectedDate);
    if (!order) {
        order = { id: generateId(), date: appState.ui.selectedDate, customerId, items: [] };
        appState.orders.push(order);
    }
    
    let itemsAdded = false;
    modal.querySelectorAll('.main-order-box-count').forEach(input => {
        const boxCount = parseInt(input.value);
        if (boxCount > 0) {
            itemsAdded = true;
            const surovinaId = input.dataset.surovinaId;
            const existingItem = order.items.find(item => item.surovinaId === surovinaId && item.type === orderType);
            if (existingItem) {
                existingItem.boxCount += boxCount;
            } else {
                order.items.push({ id: generateId(), surovinaId, boxCount, isActive: true, type: orderType });
            }
        }
    });
    
    if (!itemsAdded) {
        showToast('Nebyly zadány žádné položky.', 'error');
        return;
    }

    saveState();
    modal.classList.remove('active');
    showToast('Objednávka uložena.');
    if (appState.ui.activeView === 'orders') {
        renderOrders();
    } else {
        renderMainPage();
    }
}

export function saveMixRatio() {
    const itemId = appState.ui.editingOrderItemId;
    const order = appState.orders.find(o => o.items.some(i => i.id === itemId));
    const item = order?.items.find(i => i.id === itemId);
    if (!item) return;

    const newRatios = [];
    let total = 0;
    DOMElements.mixRatioModal.querySelectorAll('.mix-ratio-percentage').forEach(input => {
        const percentage = parseFloat(input.value) || 0;
        total += percentage;
        newRatios.push({ surovinaId: input.dataset.surovinaId, percentage });
    });

    if (Math.abs(total - 100) > 0.1) { showToast('Součet musí být 100%', 'error'); return; }

    item.ratioOverride = newRatios;
    saveState();
    DOMElements.mixRatioModal.classList.remove('active');
    showToast('Poměr pro objednávku upraven');
}
