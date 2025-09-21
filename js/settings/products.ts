/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderCreateProduct() {
    const newProdCustomer = document.getElementById('new-prod-customer');
    const newProdSurovina = document.getElementById('new-prod-surovina');
    const newProdCalibratedSurovina = document.getElementById('new-prod-calibrated-surovina');
    const newProdCalibratedWeight = document.getElementById('new-prod-calibrated-weight');
    const saveCaliberBtn = document.getElementById('save-caliber-btn');
    
    const customerOptions = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    newProdCustomer.innerHTML = customerOptions;
    
    const surovinaOptions = appState.suroviny.filter(s => !s.isMix && !s.isProduct).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    newProdSurovina.innerHTML = surovinaOptions;
    newProdCalibratedSurovina.innerHTML = '<option value="">-- Vyberte --</option>' + surovinaOptions;
    
    const toggleSaveCaliberBtn = () => {
        saveCaliberBtn.disabled = !(newProdCalibratedSurovina.value && newProdCalibratedWeight.value.trim());
    };
    newProdCalibratedSurovina.onchange = toggleSaveCaliberBtn;
    newProdCalibratedWeight.oninput = toggleSaveCaliberBtn;

    renderExistingProducts();
}

function renderExistingProducts() {
    const tbody = document.getElementById('existing-products-table-body');
    tbody.innerHTML = '';
    appState.products.forEach(product => {
        const customer = appState.zakaznici.find(c => c.id === product.customerId);
        const surovina = appState.suroviny.find(s => s.id === product.surovinaId);
        const tr = document.createElement('tr');
        if (!product.isActive) {
            tr.classList.add('product-inactive');
        }
        const activeIcon = product.isActive ? ICONS.eye : ICONS.eyeOff;

        tr.innerHTML = `
            <td>${product.name}</td>
            <td>${customer?.name || 'N/A'}</td>
            <td>${surovina?.name || 'N/A'}</td>
            <td>${product.boxWeight}</td>
            <td><button class="btn-icon" data-action="toggle-product-active" data-id="${product.id}">${activeIcon}</button></td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-product" data-id="${product.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-product" data-id="${product.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function openProductEditor(productId) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;

    appState.ui.editingProductId = productId;
    document.getElementById('create-product-header').textContent = `Upravit produkt: ${product.name}`;
    document.getElementById('new-prod-name').value = product.name;
    document.getElementById('new-prod-customer').value = product.customerId;
    document.getElementById('new-prod-surovina').value = product.surovinaId;
    document.getElementById('new-prod-box-weight').value = product.boxWeight;
    document.getElementById('new-prod-packaging-type').value = product.packagingType || 'VL';
    document.getElementById('new-prod-quick-entry').checked = product.showInQuickEntry || false;
    document.getElementById('new-prod-is-other').checked = product.isOther || false;
    document.getElementById('new-prod-marinade-name').value = product.marinadeName;
    document.getElementById('new-prod-marinade-percent').value = product.marinadePercent;
    document.getElementById('new-prod-loss-percent').value = product.lossPercent;
    document.getElementById('new-prod-calibrated-surovina').value = product.calibratedSurovinaId;
    document.getElementById('new-prod-calibrated-weight').value = product.calibratedWeight;

    document.getElementById('save-new-prod-btn').textContent = 'Uložit změny';
    document.getElementById('cancel-edit-prod-btn').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

export function cancelEditProd() {
    appState.ui.editingProductId = null;
    document.getElementById('create-product-header').textContent = 'Vytvořit nový produkt';
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-box-weight').value = '';
    document.getElementById('new-prod-packaging-type').value = 'OA';
    document.getElementById('new-prod-quick-entry').checked = false;
    document.getElementById('new-prod-is-other').checked = false;
    document.getElementById('new-prod-marinade-name').value = '';
    document.getElementById('new-prod-marinade-percent').value = '';
    document.getElementById('new-prod-loss-percent').value = '';
    document.getElementById('new-prod-calibrated-weight').value = '';
    document.getElementById('save-new-prod-btn').textContent = 'Uložit produkt';
    document.getElementById('cancel-edit-prod-btn').style.display = 'none';
}

export function saveNewProd() {
    const { newProdName, newProdCustomer, newProdSurovina, newProdBoxWeight, newProdPackagingType, newProdQuickEntry, newProdIsOther, newProdMarinadeName, newProdMarinadePercent, newProdLossPercent, newProdCalibratedSurovina, newProdCalibratedWeight } = {
        newProdName: document.getElementById('new-prod-name'),
        newProdCustomer: document.getElementById('new-prod-customer'),
        newProdSurovina: document.getElementById('new-prod-surovina'),
        newProdBoxWeight: document.getElementById('new-prod-box-weight'),
        newProdPackagingType: document.getElementById('new-prod-packaging-type'),
        newProdQuickEntry: document.getElementById('new-prod-quick-entry'),
        newProdIsOther: document.getElementById('new-prod-is-other'),
        newProdMarinadeName: document.getElementById('new-prod-marinade-name'),
        newProdMarinadePercent: document.getElementById('new-prod-marinade-percent'),
        newProdLossPercent: document.getElementById('new-prod-loss-percent'),
        newProdCalibratedSurovina: document.getElementById('new-prod-calibrated-surovina'),
        newProdCalibratedWeight: document.getElementById('new-prod-calibrated-weight'),
    };

    const name = newProdName.value.trim();
    if (!name) {
        showToast('Zadejte název produktu.', 'error');
        return;
    }
    
    const productData = {
        name: name,
        customerId: newProdCustomer.value,
        surovinaId: newProdSurovina.value,
        boxWeight: parseFloat(newProdBoxWeight.value) || 0,
        packagingType: newProdPackagingType.value,
        showInQuickEntry: newProdQuickEntry.checked,
        isOther: newProdIsOther.checked,
        marinadeName: newProdMarinadeName.value.trim(),
        marinadePercent: parseFloat(newProdMarinadePercent.value) || 0,
        lossPercent: parseFloat(newProdLossPercent.value) || 0,
        calibratedSurovinaId: newProdCalibratedSurovina.value,
        calibratedWeight: newProdCalibratedWeight.value.trim(),
        isActive: true
    };

    const isEditing = !!appState.ui.editingProductId;
    let productId = appState.ui.editingProductId;

    if (isEditing) {
        const index = appState.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            appState.products[index] = { ...appState.products[index], ...productData };
            showToast('Produkt upraven');
        }
    } else {
        productId = generateId();
        appState.products.push({ id: productId, ...productData });
        showToast('Nový produkt uložen.');
    }
    
    const surovinaProxy = {
        id: productId,
        name: productData.name,
        isMix: false,
        isProduct: true,
        baseSurovinaId: productData.surovinaId,
        paletteWeight: 0,
        stock: 0,
        isActive: productData.isActive
    };

    const surovinaIndex = appState.suroviny.findIndex(s => s.id === productId);
    if (surovinaIndex > -1) {
        appState.suroviny[surovinaIndex] = { ...appState.suroviny[surovinaIndex], ...surovinaProxy };
    } else {
        appState.suroviny.push(surovinaProxy);
    }
    
    saveState();
    cancelEditProd();
    renderCreateProduct();
}

export function deleteProduct(productId) {
    showConfirmation('Opravdu chcete smazat tento produkt?', () => {
        appState.products = appState.products.filter(p => p.id !== productId);
        appState.suroviny = appState.suroviny.filter(s => s.id !== productId);
        appState.orders.forEach(order => {
            order.items = order.items.filter(item => item.surovinaId !== productId);
        });
        Object.keys(appState.boxWeights).forEach(customerId => {
            delete appState.boxWeights[customerId][productId];
        });

        saveState();
        renderCreateProduct();
        showToast('Produkt smazán', 'success');
    });
}

export function toggleProductActive(productId) {
    const product = appState.products.find(p => p.id === productId);
    const surovina = appState.suroviny.find(s => s.id === productId);
    if(product) {
        product.isActive = !product.isActive;
        if (surovina) {
            surovina.isActive = product.isActive;
        }
        saveState();
        renderExistingProducts();
        showToast(product.isActive ? 'Produkt aktivován' : 'Produkt deaktivován');
    }
}

export function saveCaliberAsSurovina() {
    const newProdCalibratedSurovina = document.getElementById('new-prod-calibrated-surovina');
    const newProdCalibratedWeight = document.getElementById('new-prod-calibrated-weight');
    const baseSurovinaId = newProdCalibratedSurovina.value;
    const caliberRange = newProdCalibratedWeight.value.trim();

    if (!baseSurovinaId || !caliberRange) {
        showToast('Vyberte surovinu a zadejte váhu pro uložení kalibru.', 'error');
        return;
    }

    const baseSurovina = appState.suroviny.find(s => s.id === baseSurovinaId);
    const newName = `${baseSurovina.name} (${caliberRange}g)`;

    if (appState.suroviny.some(s => s.name === newName)) {
        showToast('Surovina s tímto kalibrem již existuje.', 'error');
        return;
    }

    const newSurovina = {
        id: generateId(),
        name: newName,
        isMix: false,
        isCalibrated: true,
        baseSurovinaId: baseSurovinaId,
        caliberRange: caliberRange,
        paletteWeight: baseSurovina.paletteWeight,
        stock: 0,
        isActive: true
    };

    appState.suroviny.push(newSurovina);
    saveState();
    showToast(`Nová surovina "${newName}" byla vytvořena.`);
    renderCreateProduct();
}
