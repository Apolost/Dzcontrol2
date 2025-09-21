/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';

export function getDailyNeeds(date, customerFilter = null) {
    const needs = {};
    appState.suroviny.filter(s => !s.isMix && !s.isProduct).forEach(s => { needs[s.id] = 0; });
    
    let dailyOrders = appState.orders.filter(o => o.date === date);
    let activeActions = appState.plannedActions.filter(a => date >= a.startDate && (!a.endDate || date <= a.endDate));

    if (customerFilter) {
         if (customerFilter === 'non-kfc') {
            const nonKfcCustomers = appState.zakaznici.filter(c => c.name.toLowerCase() !== 'kfc').map(c => c.id);
            dailyOrders = dailyOrders.filter(o => nonKfcCustomers.includes(o.customerId));
            activeActions = activeActions.filter(a => nonKfcCustomers.includes(a.customerId));
        }
    }

    const allItemsForDay = [];
    dailyOrders.forEach(order => {
        order.items.forEach(item => {
            if (item.isActive) {
                allItemsForDay.push({ ...item, customerId: order.customerId });
            }
        });
    });
    activeActions.forEach(action => {
        const dayCounts = action.dailyCounts || {};
        const boxCount = dayCounts[date];
        if(boxCount > 0) {
            allItemsForDay.push({ surovinaId: action.surovinaId, boxCount, customerId: action.customerId, isActive: true, type: 'VL' });
        }
    });

    allItemsForDay.forEach(item => {
        // Skip calculation for any item marked as done for the day
        if (item.isDone) {
            return;
        }

        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        if (!surovina) return;
        
        const weights = appState.boxWeights[item.customerId]?.[surovina.id];
        const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);

        const totalWeightInKg = item.boxCount * (boxWeightInGrams / 1000);

        if (surovina.isMix) {
            const components = item.ratioOverride || appState.mixDefinitions[surovina.id]?.components;
            if (components) {
                components.forEach(comp => {
                    const grossWeight = totalWeightInKg * (comp.percentage / 100);
                    const netWeight = grossWeight * (1 - ((comp.loss || 0) / 100));
                    needs[comp.surovinaId] = (needs[comp.surovinaId] || 0) + netWeight;
                });
            }
        } else if (surovina.isProduct) {
            const product = appState.products.find(p => p.id === surovina.id);
            if (product && product.surovinaId) {
                let usableMeatWeight = totalWeightInKg;
                if (product.marinadePercent > 0) {
                    usableMeatWeight = totalWeightInKg / (1 + product.marinadePercent / 100);
                }
                let rawMaterialWeight = usableMeatWeight;
                if (product.lossPercent > 0) {
                    rawMaterialWeight = usableMeatWeight / (1 - product.lossPercent / 100);
                }
                needs[product.surovinaId] = (needs[product.surovinaId] || 0) + rawMaterialWeight;
            }
        } else {
            needs[surovina.id] = (needs[surovina.id] || 0) + totalWeightInKg;
        }
    });
    return needs;
}

export function getMaykawaThighsNeeded(date) {
    const { bonePercent, skinPercent } = appState.maykawaConfig;
    const yieldPercent = 100 - bonePercent - skinPercent;
    const dailyNeeds = getDailyNeeds(date);
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    if (!steakSurovina || yieldPercent <= 0) return 0;
    const totalSteakNeededKg = dailyNeeds[steakSurovina.id] || 0;
    return totalSteakNeededKg / (yieldPercent / 100);
}

export function getKfcSurovinyNeeds(date) {
    const order = appState.kfcOrders[date] || { today: {} };
    const surovinyNeeded = {}; // { surovinaId: boxCount }

    for (const productId in order.today) {
        const orderData = order.today[productId];
        const boxCount = orderData.ordered || 0;
        if (boxCount > 0) {
            const product = appState.kfcProducts.find(p => p.id === productId);
            if (product && product.requiredSurovinaId) {
                surovinyNeeded[product.requiredSurovinaId] = (surovinyNeeded[product.requiredSurovinaId] || 0) + boxCount;
            }
        }
    }
    return surovinyNeeded;
}

export function getSpizyNeeds(date) {
    const needs = { klobasa: 0, spek: 0, cibule: 0, rizky: 0, steak: 0 };
    const orders = appState.spizyOrders[date] || [];
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');

    orders.forEach(order => {
        const customer = appState.zakaznici.find(c => c.id === order.customerId);
        if (!customer) return;

        const klobasaWeight = appState.boxWeights[customer.id]?.['spizy_klobasa']?.VL || 10000;
        const spekWeight = appState.boxWeights[customer.id]?.['spizy_spek']?.VL || 10000;
        const cilliWeight = appState.boxWeights[customer.id]?.['spizy_cilli']?.VL || 10000;

        const klobasaTotalKg = (order.klobasa * klobasaWeight) / 1000;
        const spekTotalKg = (order.spek * spekWeight) / 1000;
        const cilliTotalKg = (order.cilli * cilliWeight) / 1000;
        
        // Špíz Klobása composition
        needs.klobasa += klobasaTotalKg * (appState.spizyConfig.klobasa.klobasa / 100);
        needs.steak += klobasaTotalKg * (appState.spizyConfig.klobasa.steak / 100);
        needs.cibule += klobasaTotalKg * (appState.spizyConfig.klobasa.cibule / 100);

        // Špíz Špek composition
        needs.klobasa += spekTotalKg * (appState.spizyConfig.spek.klobasa / 100);
        needs.spek += spekTotalKg * (appState.spizyConfig.spek.spek / 100);
        needs.cibule += spekTotalKg * (appState.spizyConfig.spek.cibule / 100);
        needs.steak += spekTotalKg * (appState.spizyConfig.spek.steak / 100);

        // Špíz Čilli Mango is 100% řízky
        if (rizkySurovina) {
            needs.rizky += cilliTotalKg;
        }
    });
    return needs;
}