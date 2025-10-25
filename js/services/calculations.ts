/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';

export function getDailyNeeds(date, customerFilter = null, ignoreDone = false) {
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
        const dayCountData = action.dailyCounts?.[date];
        const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
        if(boxCount > 0) {
            allItemsForDay.push({ surovinaId: action.surovinaId, boxCount, customerId: action.customerId, isActive: true, type: 'VL' });
        }
    });

    allItemsForDay.forEach(item => {
        const doneCount = ignoreDone ? 0 : (item.doneCount || 0);
        const remainingBoxes = item.boxCount - doneCount;

        // If the item is fully completed, skip it.
        if (remainingBoxes <= 0) {
            return;
        }
        
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        if (!surovina) return;
        
        const tempWeightKey = `${item.customerId}_${item.surovinaId}_${item.type}`;
        const tempWeight = appState.temporaryBoxWeights?.[date]?.[tempWeightKey];
        const weights = appState.boxWeights[item.customerId]?.[surovina.id];
        const defaultWeight = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
        const boxWeightInGrams = tempWeight !== undefined ? tempWeight : defaultWeight;


        const totalWeightInKg = remainingBoxes * (boxWeightInGrams / 1000);

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
    const needs = { klobasa: 0, spek: 0, cibule: 0, rizky: 0, steak: 0, paprika: 0 };
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
        needs.paprika += klobasaTotalKg * (appState.spizyConfig.klobasa.paprika / 100);

        // Špíz Špek composition
        needs.klobasa += spekTotalKg * (appState.spizyConfig.spek.klobasa / 100);
        needs.spek += spekTotalKg * (appState.spizyConfig.spek.spek / 100);
        needs.cibule += spekTotalKg * (appState.spizyConfig.spek.cibule / 100);
        needs.steak += spekTotalKg * (appState.spizyConfig.spek.steak / 100);
        needs.paprika += spekTotalKg * (appState.spizyConfig.spek.paprika / 100);

        // Špíz Čilli Mango is 100% řízky
        if (rizkySurovina) {
            needs.rizky += cilliTotalKg;
        }
    });
    return needs;
}

export function calculateYieldData(date, flocks, totalChickenWeight) {
    const yieldData = [];

    if (totalChickenWeight <= 0 || !flocks) {
        return { yieldData: [], thighNeeds: {} };
    }
    
    const dailyNeeds = getDailyNeeds(date, null, true); // Ignore done items for total overview
    const { yieldSettings } = appState;
    const adjustments = appState.yieldAdjustments?.[date] || {};
    const getSurovina = (name) => appState.suroviny.find(s => s.name.toUpperCase() === name.toUpperCase());
    
    // --- Schnitzel to Breast Calculation ---
    const rizkySurovina = getSurovina('ŘÍZKY');
    const prsaSurovina = getSurovina('PRSA');
    const rizkyOrderKg = (rizkySurovina && dailyNeeds[rizkySurovina.id]) ? dailyNeeds[rizkySurovina.id] : 0;
    const prsaNeededForRizky = rizkyOrderKg > 0 ? rizkyOrderKg / 0.70 : 0;

    // --- Define Parts ---
    const primaryParts = [
        { name: 'Prsa', yieldKey: 'prsa', surovina: prsaSurovina },
        { name: 'Křídla', yieldKey: 'kridla', surovina: getSurovina('KŘÍDLA') },
        { name: 'Zadní díly (skelety)', yieldKey: 'zadniDily', surovina: getSurovina('ZADNÍ DÍLY (SKELETY)') || getSurovina('HRBETY') },
        { name: 'Kůže', yieldKey: 'kuze', surovina: getSurovina('KŮŽE') },
        { name: 'Kosti', yieldKey: 'kosti', surovina: getSurovina('KOSTI') },
        { name: 'Játra', yieldKey: 'jatra', surovina: getSurovina('JÁTRA') },
        { name: 'Srdce', yieldKey: 'srdce', surovina: getSurovina('SRDCE') },
        { name: 'Žaludky', yieldKey: 'zaludky', surovina: getSurovina('ŽALUDKY') },
        { name: 'Krky', yieldKey: 'krky', surovina: getSurovina('KRKY') },
    ];
    
    const thighRelatedSuroviny = [
        getSurovina('STEHNA'),
        getSurovina('ČTVRTKY'),
        getSurovina('HORNÍ STEHNA'),
        getSurovina('SPODNÍ STEHNA'),
    ].filter(Boolean); // Filter out any not found suroviny
    
    // --- Process Primary Parts ---
    primaryParts.forEach(part => {
        const adjustedKg = part.surovina ? adjustments[part.surovina.id] : undefined;
        const producedKg = adjustedKg !== undefined 
            ? adjustedKg 
            : totalChickenWeight * ((yieldSettings[part.yieldKey] || 0) / 100);

        let neededKg = 0;
        if (part.surovina && dailyNeeds[part.surovina.id]) {
            neededKg += dailyNeeds[part.surovina.id];
        }

        const dataItem = { 
            name: part.name, 
            produced: producedKg, 
            needed: 0, 
            difference: 0, 
            paletteWeight: part.surovina?.paletteWeight || 0 
        };

        if (part.name === 'Prsa') {
            dataItem.needed = neededKg + prsaNeededForRizky;
            if (prsaNeededForRizky > 0) {
                 dataItem.prsaNeededForRizky = prsaNeededForRizky;
            }
        } else {
            dataItem.needed = neededKg;
        }
        dataItem.difference = dataItem.produced - dataItem.needed;
        yieldData.push(dataItem);
    });

    // --- Process "Stehna celkem" as a single pool ---
    const totalThighsProducedKg = totalChickenWeight * ((yieldSettings.stehnaCelkem || 0) / 100);
    let totalThighsNeededKg = 0;
    const thighNeeds = {};

    thighRelatedSuroviny.forEach(surovina => {
        const neededKg = dailyNeeds[surovina.id] || 0;
        if (neededKg > 0) {
            totalThighsNeededKg += neededKg;
            thighNeeds[surovina.name] = neededKg;
        }
    });

    // Add Maykawa needs
    const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
    if (maykawaThighsNeeded > 0) {
        totalThighsNeededKg += maykawaThighsNeeded;
        thighNeeds['Na Steak (Maykawa)'] = maykawaThighsNeeded;
    }

    const stehnaSurovinaForWeight = getSurovina('STEHNA');
    yieldData.push({ 
        name: 'Stehna celkem', 
        produced: totalThighsProducedKg, 
        needed: totalThighsNeededKg, 
        difference: totalThighsProducedKg - totalThighsNeededKg,
        paletteWeight: stehnaSurovinaForWeight?.paletteWeight || 0
    });
    
    // --- "Prdele" Calculation ---
    const PRDEL_WEIGHT_KG = 0.030; // 30g average weight
    let prdeleProducedKg = 0;
    const prdeleSurovina = getSurovina('PRDELE');

    if (prdeleSurovina) {
        flocks.forEach(flock => {
            // Chickens from 800g to 1450g
            if (flock.avgWeight >= 0.8 && flock.avgWeight <= 1.45) {
                prdeleProducedKg += (flock.count || 0) * PRDEL_WEIGHT_KG;
            }
        });

        const adjustedPrdeleKg = adjustments[prdeleSurovina.id];
        if (adjustedPrdeleKg !== undefined) {
            prdeleProducedKg = adjustedPrdeleKg;
        }

        const prdeleNeededKg = dailyNeeds[prdeleSurovina.id] || 0;
        // Add to the table only if it's produced or needed
        if (prdeleProducedKg > 0 || prdeleNeededKg > 0) {
            yieldData.push({
                name: 'Prdele',
                produced: prdeleProducedKg,
                needed: prdeleNeededKg,
                difference: prdeleProducedKg - prdeleNeededKg,
                paletteWeight: prdeleSurovina.paletteWeight || 0
            });
        }
    }

    return { yieldData, thighNeeds };
}