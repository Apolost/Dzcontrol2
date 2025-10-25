
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
                    const netWeight = grossWeight;
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
    const thighNeeds = {}; // Will hold breakdown of what thighs are used for

    if (totalChickenWeight <= 0 || !flocks) {
        return { yieldData, thighNeeds };
    }
    
    const dailyNeeds = getDailyNeeds(date, null, true); // Ignore done items for total overview
    const { yieldSettings } = appState;
    const adjustments = appState.yieldAdjustments?.[date] || {};
    const getSurovina = (name) => appState.suroviny.find(s => s.name.toUpperCase() === name.toUpperCase());
    
    // Suroviny definitions needed for thigh/quarter logic
    const ctvrtkySurovina = getSurovina('ČTVRTKY');
    const horniStehnaSurovina = getSurovina('HORNÍ STEHNA');
    const spodniStehnaSurovina = getSurovina('SPODNÍ STEHNA');
    const stehnaCelkemSurovina = getSurovina('STEHNA');
    const zadniDilySurovina = getSurovina('ZADNÍ DÍLY (SKELETY)') || getSurovina('HRBETY');

    // --- Process 'Čtvrtky' needs first, as they affect 'Zadní díly' production ---
    const ctvrtkyNeededKg = (ctvrtkySurovina && dailyNeeds[ctvrtkySurovina.id]) ? dailyNeeds[ctvrtkySurovina.id] : 0;
    let zadniDilyConsumedByCtvrtky = 0;
    if (ctvrtkyNeededKg > 0) {
        // Based on industry ratios where leg quarter is heavier than whole leg due to the back part.
        const CtvrtkaToStehnoRatio = 0.727; 
        const CtvrtkaToZadniDilRatio = 0.273;
        
        const stehnaForCtvrtky = ctvrtkyNeededKg * CtvrtkaToStehnoRatio;
        zadniDilyConsumedByCtvrtky = ctvrtkyNeededKg * CtvrtkaToZadniDilRatio;
        
        // We account for the 'stehno' part of the 'čtvrtka' in the thigh pool.
        thighNeeds['Na Čtvrtky'] = stehnaForCtvrtky;
    }

    // --- Schnitzel to Breast Calculation ---
    const rizkySurovina = getSurovina('ŘÍZKY');
    const prsaSurovina = getSurovina('PRSA');
    const rizkyOrderKg = (rizkySurovina && dailyNeeds[rizkySurovina.id]) ? dailyNeeds[rizkySurovina.id] : 0;
    const prsaNeededForRizky = rizkyOrderKg > 0 ? rizkyOrderKg / 0.70 : 0;

    // --- Define & Process Primary Parts ---
    const primaryParts = [
        { name: 'Prsa', yieldKey: 'prsa', surovina: prsaSurovina },
        { name: 'Křídla', yieldKey: 'kridla', surovina: getSurovina('KŘÍDLA') },
        { name: 'Zadní díly (skelety)', yieldKey: 'zadniDily', surovina: zadniDilySurovina },
        { name: 'Kůže', yieldKey: 'kuze', surovina: getSurovina('KŮŽE') },
        { name: 'Kosti', yieldKey: 'kosti', surovina: getSurovina('KOSTI') },
        { name: 'Játra', yieldKey: 'jatra', surovina: getSurovina('JÁTRA') },
        { name: 'Srdce', yieldKey: 'srdce', surovina: getSurovina('SRDCE') },
        { name: 'Žaludky', yieldKey: 'zaludky', surovina: getSurovina('ŽALUDKY') },
        { name: 'Krky', yieldKey: 'krky', surovina: getSurovina('KRKY') },
    ];
    
    primaryParts.forEach(part => {
        const adjustedKg = part.surovina ? adjustments[part.surovina.id] : undefined;
        let producedKg = adjustedKg !== undefined 
            ? adjustedKg 
            : totalChickenWeight * ((yieldSettings[part.yieldKey] || 0) / 100);

        // Adjust 'Zadní díly' production because part of it is sold with 'Čtvrtky'
        if (part.surovina && zadniDilySurovina && part.surovina.id === zadniDilySurovina.id) {
            producedKg -= zadniDilyConsumedByCtvrtky;
        }

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

    // --- Process Horní/Spodní Stehna Production from splitting 'Stehna celkem' ---
    const horniNeededKg = (horniStehnaSurovina && dailyNeeds[horniStehnaSurovina.id]) ? dailyNeeds[horniStehnaSurovina.id] : 0;
    const spodniNeededKg = (spodniStehnaSurovina && dailyNeeds[spodniStehnaSurovina.id]) ? dailyNeeds[spodniStehnaSurovina.id] : 0;
    
    if (horniNeededKg > 0 || spodniNeededKg > 0) {
        const { upperThighPercent, lowerThighPercent } = appState.thighSplitSettings;
        const upperPercent = upperThighPercent / 100;
        const lowerPercent = lowerThighPercent / 100;

        // Determine total whole thighs needed based on the larger requirement
        const stehnaNeededForUpper = upperPercent > 0 ? horniNeededKg / upperPercent : 0;
        const stehnaNeededForLower = lowerPercent > 0 ? spodniNeededKg / lowerPercent : 0;
        const totalStehnaToSplit = Math.max(stehnaNeededForUpper, stehnaNeededForLower);

        if (totalStehnaToSplit > 0) {
            thighNeeds['Na dělení (H/S)'] = totalStehnaToSplit;

            const producedHorni = totalStehnaToSplit * upperPercent;
            const producedSpodni = totalStehnaToSplit * lowerPercent;
            
            yieldData.push({
                name: 'Horní stehna',
                produced: producedHorni,
                needed: horniNeededKg,
                difference: producedHorni - horniNeededKg,
                paletteWeight: horniStehnaSurovina?.paletteWeight || 0
            });
            yieldData.push({
                name: 'Spodní stehna',
                produced: producedSpodni,
                needed: spodniNeededKg,
                difference: producedSpodni - spodniNeededKg,
                paletteWeight: spodniStehnaSurovina?.paletteWeight || 0
            });
        }
    }

    // --- Process "Stehna celkem" as a single pool ---
    // Add direct needs for 'Stehna' and Maykawa
    if (stehnaCelkemSurovina && dailyNeeds[stehnaCelkemSurovina.id] > 0) {
        thighNeeds[stehnaCelkemSurovina.name] = dailyNeeds[stehnaCelkemSurovina.id];
    }
    const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
    if (maykawaThighsNeeded > 0) {
        thighNeeds['Na Steak (Maykawa)'] = maykawaThighsNeeded;
    }

    const totalThighsNeededKg = Object.values(thighNeeds).reduce((sum, val) => sum + val, 0);
    
    const adjustedStehnaKg = stehnaCelkemSurovina ? adjustments[stehnaCelkemSurovina.id] : undefined;
    const totalThighsProducedKg = adjustedStehnaKg !== undefined
        ? adjustedStehnaKg
        : totalChickenWeight * ((yieldSettings.stehnaCelkem || 0) / 100);

    yieldData.push({ 
        name: 'Stehna celkem', 
        produced: totalThighsProducedKg, 
        needed: totalThighsNeededKg, 
        difference: totalThighsProducedKg - totalThighsNeededKg,
        paletteWeight: stehnaCelkemSurovina?.paletteWeight || 0
    });
    
    // --- "Prdele" Calculation ---
    const PRDEL_WEIGHT_KG = 0.030; // 30g average weight
    let prdeleProducedKg = 0;
    const prdeleSurovina = getSurovina('PRDELE');

    if (prdeleSurovina) {
        flocks.forEach(flock => {
            if (flock.avgWeight >= 0.8 && flock.avgWeight <= 1.45) { // Chickens from 800g to 1450g
                prdeleProducedKg += (flock.count || 0) * PRDEL_WEIGHT_KG;
            }
        });

        const adjustedPrdeleKg = adjustments[prdeleSurovina.id];
        if (adjustedPrdeleKg !== undefined) {
            prdeleProducedKg = adjustedPrdeleKg;
        }

        const prdeleNeededKg = dailyNeeds[prdeleSurovina.id] || 0;
        if (prdeleProducedKg > 0 || prdeleNeededKg > 0) { // Add to the table only if it's produced or needed
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

export function calculateTimeline(date) {
    const dailyChickenData = appState.chickenCounts[date];
    if (!dailyChickenData || !Array.isArray(dailyChickenData.flocks) || dailyChickenData.flocks.length === 0) {
        return { timeline: [], totals: { totalChickens: 0, totalWeight: 0, totalTime: 0 } };
    }

    const startTimeStr = dailyChickenData.startTime || '06:00';
    const delayHours = dailyChickenData.delayHours || 0;
    const delayMinutes = dailyChickenData.delayMinutes || 0;
    const totalDelayInMinutes = (delayHours * 60) + delayMinutes;
    const lineSpeed = appState.lineSettings?.speed || 5000;

    // --- AUTOMATIC PAUSE LOGIC ---
    let eventsForTimeline = [...(appState.productionEvents[date] || [])];
    const hasUserPause = eventsForTimeline.some(event => event.type === 'pause');
    
    if (!hasUserPause) {
        const dayOfWeek = new Date(date + 'T12:00:00Z').getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        let autoPauseTime = null;

        if (dayOfWeek === 1) { // Monday
            autoPauseTime = '09:30';
        } else if (dayOfWeek >= 2 && dayOfWeek <= 5) { // Tuesday to Friday
            autoPauseTime = '11:30';
        }

        if (autoPauseTime) {
            eventsForTimeline.push({
                id: `auto-pause-${date}`,
                type: 'pause',
                startTime: autoPauseTime,
                isAutomatic: true // Flag to identify this pause
            });
        }
    }
    // --- END AUTOMATIC PAUSE LOGIC ---

    const events = eventsForTimeline.map(event => {
        const [h, m] = event.startTime.split(':').map(Number);
        return {
            ...event,
            startTimeInMinutes: h * 60 + m,
            duration: event.type === 'pause' ? 30 : (event.duration || 0)
        };
    }).sort((a, b) => a.startTimeInMinutes - b.startTimeInMinutes);

    const timeline = [];
    let [startH, startM] = startTimeStr.split(':').map(Number);
    let currentTimeInMinutes = startH * 60 + startM;
    let totalChickens = 0;
    let totalWeight = 0;

    dailyChickenData.flocks.forEach((flock, index) => {
        if (!flock.count || flock.count <= 0) return;
        
        totalChickens += flock.count;
        totalWeight += flock.count * (flock.avgWeight || 0);

        const processingDuration = (flock.count / lineSpeed) * 60; // in minutes
        
        const entry = {
            type: 'flock',
            originalIndex: index,
            name: flock.name,
            avgWeight: flock.avgWeight,
            count: flock.count,
            startTime: currentTimeInMinutes,
            endTime: currentTimeInMinutes + processingDuration
        };
        
        timeline.push(entry);
        currentTimeInMinutes = entry.endTime;
    });
    
    const fullTimeline = [...timeline];
    events.forEach(event => {
        fullTimeline.push({
            type: event.type,
            startTime: event.startTimeInMinutes,
            endTime: event.startTimeInMinutes + event.duration,
            duration: event.duration,
            id: event.id
        });
    });

    fullTimeline.sort((a, b) => a.startTime - b.startTime);

    // Recalculate times with events
    let adjustedCurrentTime = (startH * 60 + startM) + totalDelayInMinutes;
    let totalProcessingDuration = 0;
    const finalTimeline = [];

    for (const item of fullTimeline) {
        let itemDuration;
        if (item.type === 'flock') {
            itemDuration = (item.count / lineSpeed) * 60;
        } else {
            itemDuration = item.duration;
        }
        
        finalTimeline.push({
            ...item,
            startTime: adjustedCurrentTime,
            endTime: adjustedCurrentTime + itemDuration,
        });
        adjustedCurrentTime += itemDuration;
        totalProcessingDuration += itemDuration;
    }
    
    const totalTime = totalProcessingDuration;

    return { timeline: finalTimeline, totals: { totalChickens, totalWeight, totalTime } };
}
