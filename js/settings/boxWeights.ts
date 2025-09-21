/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showToast } from '../ui.ts';

export function renderBoxWeights() {
    const accordion = document.getElementById('box-weights-accordion');
    accordion.innerHTML = '';
    const customersToRender = appState.zakaznici.filter(c => c.name.toLowerCase() !== 'kfc');

    const spizyProducts = [
        { id: 'spizy_klobasa', name: 'Špíz Klobása' },
        { id: 'spizy_spek', name: 'Špíz Špek' },
        { id: 'spizy_cilli', name: 'Špíz Čilli Mango' },
    ];

    customersToRender.forEach(customer => {
        const details = document.createElement('details');
        details.innerHTML = `<summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary><div class="details-content"></div>`;
        const content = details.querySelector('.details-content');
        let tableHTML = `
            <div class="accordion">
                <details>
                    <summary>Standardní produkty <i data-feather="chevron-right" class="arrow-icon"></i></summary>
                    <div class="details-content">
                        <table class="data-table">
                            <thead><tr><th>Produkt</th><th>Váha OA (kg)</th><th>Váha RB (kg)</th><th>Váha VL (g)</th><th class="actions">Akce</th></tr></thead>
                            <tbody>
        `;

        const surovinyForCustomer = appState.suroviny.map(s => ({...s, isActive: appState.boxWeights[customer.id]?.[s.id]?.isActive ?? true }));
        surovinyForCustomer.sort((a, b) => b.isActive - a.isActive);

        surovinyForCustomer.forEach(surovina => {
            const weights = appState.boxWeights[customer.id]?.[surovina.id] || { OA: 4000, RB: 4000, VL: 10000, isActive: true };
            const inactiveClass = !weights.isActive ? 'class="product-inactive"' : '';
            const activeIcon = weights.isActive ? ICONS.eyeOff : ICONS.eye;
            tableHTML += `
                <tr ${inactiveClass}>
                    <td>${surovina.name}</td>
                    <td><input type="number" step="0.01" value="${(weights.OA / 1000).toFixed(2)}" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" data-order-type="OA" class="box-weight-input" style="width: 100px;"></td>
                    <td><input type="number" step="0.01" value="${(weights.RB / 1000).toFixed(2)}" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" data-order-type="RB" class="box-weight-input" style="width: 100px;"></td>
                    <td><input type="number" value="${weights.VL}" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" data-order-type="VL" class="box-weight-input" style="width: 100px;"></td>
                    <td class="actions"><button class="btn-icon" data-action="toggle-box-weight-product-active" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}">${activeIcon}</button></td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table></div></details>`;

        tableHTML += `
                <details>
                    <summary>Špízy <i data-feather="chevron-right" class="arrow-icon"></i></summary>
                    <div class="details-content">
                        <table class="data-table">
                            <thead><tr><th>Produkt</th><th>Váha bedny (g)</th></tr></thead>
                            <tbody>
        `;
         spizyProducts.forEach(prod => {
            const weights = appState.boxWeights[customer.id]?.[prod.id] || { VL: 10000 };
             tableHTML += `
                <tr>
                    <td>${prod.name}</td>
                    <td><input type="number" value="${weights.VL}" data-customer-id="${customer.id}" data-surovina-id="${prod.id}" data-order-type="VL" class="box-weight-input" style="width: 100px;"></td>
                </tr>
             `;
         });
        tableHTML += `</tbody></table></div></details></div>`;

        content.innerHTML = tableHTML;
        accordion.appendChild(details);
    });
}

export function saveAllBoxWeights() {
    document.querySelectorAll('.box-weight-input').forEach(input => {
        const { customerId, surovinaId, orderType } = input.dataset;
        if (!appState.boxWeights[customerId]) appState.boxWeights[customerId] = {};
        if (!appState.boxWeights[customerId][surovinaId]) appState.boxWeights[customerId][surovinaId] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
        
        let weightInGrams;
        if (orderType === 'OA' || orderType === 'RB') {
            weightInGrams = Math.round((parseFloat(input.value) || 0) * 1000);
        } else {
            weightInGrams = parseInt(input.value) || 0;
        }
        appState.boxWeights[customerId][surovinaId][orderType] = weightInGrams;
    });
    saveState();
    showToast('Váhy beden uloženy');
}

export function toggleBoxWeightProductActive(customerId, surovinaId) {
    const productWeights = appState.boxWeights[customerId]?.[surovinaId];
    if (productWeights) {
        productWeights.isActive = !productWeights.isActive;
        saveState();
        renderBoxWeights();
    }
}
