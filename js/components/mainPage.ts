/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showToast, DOMElements, playNotificationSound } from '../ui.ts';
import { getDailyNeeds, getMaykawaThighsNeeded, getKfcSurovinyNeeds, getSpizyNeeds, calculateYieldData, calculateTimeline } from '../services/calculations.ts';
import { render } from '../main.ts';
import { generateId } from '../utils.ts';

let lastCalibrationAlertCount = 0;
let lastShortageCount = 0;
let lastRenderedDateForAlerts = null;

function getItemBaseMaterialInfo(orderItem, customerId) {
    const itemSurovina = appState.suroviny.find(s => s.id === orderItem.surovinaId);
    if (!itemSurovina) return [];

    const date = appState.ui.selectedDate;
    const tempWeightKey = `${customerId}_${itemSurovina.id}_${orderItem.type}`;
    const tempWeight = appState.temporaryBoxWeights?.[date]?.[tempWeightKey];
    const weights = appState.boxWeights[customerId]?.[itemSurovina.id];
    let defaultWeight = 10000;
    if (itemSurovina.isProduct) {
        const productDef = appState.products.find(p => p.id === itemSurovina.id);
        defaultWeight = productDef?.boxWeight || 10000;
    } else {
        defaultWeight = (weights?.VL) ?? 10000;
    }
    const boxWeightInGrams = tempWeight !== undefined ? tempWeight : (weights?.[orderItem.type] ?? defaultWeight);

    const totalItemKg = orderItem.boxCount * (boxWeightInGrams / 1000);

    const materials = [];

    if (itemSurovina.isProduct) {
        const productDef = appState.products.find(p => p.id === itemSurovina.id);
        if (productDef && productDef.surovinaId) {
            const baseSurovina = appState.suroviny.find(s => s.id === productDef.surovinaId);
            if (baseSurovina) {
                let usableMeatWeight = totalItemKg;
                if (productDef.marinadePercent > 0) {
                    usableMeatWeight /= (1 + (productDef.marinadePercent || 0) / 100);
                }
                let rawMaterialWeight = usableMeatWeight;
                if (productDef.lossPercent > 0) {
                    rawMaterialWeight /= (1 - (productDef.lossPercent || 0) / 100);
                }
                materials.push({ surovinaId: baseSurovina.id, name: baseSurovina.name, requiredKg: rawMaterialWeight });
            }
        }
    } else if (itemSurovina.isMix) {
        const mixDef = appState.mixDefinitions[itemSurovina.id];
        if (mixDef && mixDef.components) {
            mixDef.components.forEach(comp => {
                const componentSurovina = appState.suroviny.find(s => s.id === comp.surovinaId);
                if (componentSurovina) {
                    const componentWeight = totalItemKg * (comp.percentage / 100);
                    materials.push({ surovinaId: componentSurovina.id, name: componentSurovina.name, requiredKg: componentWeight });
                }
            });
        }
    } else { // It's a base surovina
        materials.push({ surovinaId: itemSurovina.id, name: itemSurovina.name, requiredKg: totalItemKg });
    }
    return materials;
}


function getContainerIdForSurovina(surovinaName) {
    const name = surovinaName.toUpperCase();
    if (name.includes('ŠPÍZ')) return 'main-page-spizy-container';
    if (name === 'ŘÍZKY') return 'main-page-rizky-container';
    if (name === 'MLETÉ MASO') return 'main-page-minced-meat-container';
    if (name === 'STEAK') return 'main-page-steak-container';
    if (name === 'HORNÍ STEHNA' || name === 'SPODNÍ STEHNA') return 'main-page-horni-spodni-container';
    if (name === 'STEHNA') return 'main-page-stehna-container';
    if (name === 'PRSA') return 'main-page-prsa-container';
    if (name === 'ČTVRTKY') return 'main-page-ctvrtky-container';
    return null;
}


function getPendingCountForSurovina(date, surovinaName) {
    const targetSurovina = appState.suroviny.find(s => s.name.toUpperCase() === surovinaName.toUpperCase());
    if (!targetSurovina) return 0;
    
    const relevantSurovinaIds = new Set([targetSurovina.id]);
    appState.products
        .filter(p => p.surovinaId === targetSurovina.id)
        .forEach(p => relevantSurovinaIds.add(p.id));

    const ordersForDay = appState.orders.filter(o => o.date === date);
    let pendingCount = 0;

    for (const order of ordersForDay) {
        for (const item of order.items) {
            if (relevantSurovinaIds.has(item.surovinaId) && item.doneCount < item.boxCount) {
                pendingCount++;
            }
        }
    }
    return pendingCount;
}

function hasOrdersForSurovina(date, surovinaName) {
    const targetSurovina = appState.suroviny.find(s => s.name.toUpperCase() === surovinaName.toUpperCase());
    if (!targetSurovina) return false;

    const relevantSurovinaIds = new Set([targetSurovina.id]);
    appState.products
        .filter(p => p.surovinaId === targetSurovina.id)
        .forEach(p => relevantSurovinaIds.add(p.id));

    const ordersForDay = appState.orders.filter(o => o.date === date);

    for (const order of ordersForDay) {
        for (const item of order.items) {
            if (relevantSurovinaIds.has(item.surovinaId)) {
                return true; // Found at least one item
            }
        }
    }
    return false;
}

function getPendingSpizyCount(date) {
    const spizyOrders = appState.spizyOrders[date] || [];
    let pendingCount = 0;
    for (const order of spizyOrders) {
        if (order.klobasa > 0 && !order.klobasaIsDone) pendingCount++;
        if (order.spek > 0 && !order.spekIsDone) pendingCount++;
        if (order.cilli > 0 && !order.cilliIsDone) pendingCount++;
    }
    return pendingCount;
}

function hasSpizyOrders(date) {
    const spizyOrders = appState.spizyOrders[date] || [];
    return spizyOrders.some(order => order.klobasa > 0 || order.spek > 0 || order.cilli > 0);
}


function renderOrderTableForSurovina(surovinaName, containerId, sectionTitle = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const targetSurovina = appState.suroviny.find(s => s.name.toUpperCase() === surovinaName.toUpperCase());
    if (!targetSurovina) {
        container.innerHTML = `<p>Surovina "${surovinaName}" nenalezena. Zkontrolujte nastavení.</p>`;
        return;
    }
    const targetSurovinaId = targetSurovina.id;

    const isMincedMeat = surovinaName.toUpperCase() === 'MLETÉ MASO';

    const productIdsUsingTarget = new Set(
        appState.products
            .filter(p => p.surovinaId === targetSurovinaId)
            .map(p => p.id)
    );

    let tableHTML = '';
    if (sectionTitle) {
        tableHTML += `<h3 class="subsection-title">${sectionTitle}</h3>`;
    }
    
    const stabilizedHeader = isMincedMeat ? '<th>Stabiliz.</th>' : '';
    tableHTML += `<table class="data-table"><thead><tr><th>Zákazník</th><th>Produkt</th><th>Typ</th><th>Objednáno</th><th>Hotovo</th>${stabilizedHeader}<th class="actions">Akce</th></tr></thead><tbody>`;

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

                const isItemDone = item.doneCount >= item.boxCount;
                const doneClass = isItemDone ? 'class="done"' : '';
                const doneButtonText = isItemDone ? `<i data-feather="x-circle"></i>Zrušit` : `<i data-feather="check-circle"></i>Hotovo`;
                const doneButtonClass = isItemDone ? 'btn-secondary' : 'btn-success';
                const doneCountValue = item.doneCount > 0 ? item.doneCount : '';

                const stabilizedCell = isMincedMeat 
                    ? `<td style="text-align: center;"><input type="checkbox" data-action="toggle-item-stabilized" data-order-id="${order.id}" data-item-id="${item.id}" ${item.isStabilized ? 'checked' : ''}></td>` 
                    : '';

                tableHTML += `
                    <tr ${doneClass}>
                        <td>${customer?.name || 'N/A'}</td>
                        <td>${itemSurovina?.name || 'Neznámý'}</td>
                        <td>${item.type}</td>
                        <td>${item.boxCount}</td>
                        <td><input type="number" class="main-order-done-input" value="${doneCountValue}" data-order-id="${order.id}" data-item-id="${item.id}" style="width: 80px;" min="0" max="${item.boxCount}"></td>
                        ${stabilizedCell}
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
        const colspan = isMincedMeat ? 7 : 6;
        tableHTML += `<tr><td colspan="${colspan}" style="text-align: center;">Žádné objednávky na tento den.</td></tr>`;
    }

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function getCalibrationKey(baseSurovinaName) {
    const name = baseSurovinaName.toUpperCase();
    if (name === 'ŘÍZKY') return 'rizky';
    if (name === 'STEHNA') return 'stehna';
    if (name === 'ČTVRTKY') return 'ctvrtky';
    if (name === 'KŘÍDLA') return 'kridla';
    return null;
}

function renderCalibrationAlerts(alertsContainer) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (appState.ui.selectedDate !== todayStr) return; // Only show for the current day

    const { timeline } = calculateTimeline(appState.ui.selectedDate);
    if (!timeline || timeline.length === 0) return;

    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const currentFlockItem = timeline.find(item => item.type === 'flock' && minutesNow >= item.startTime && minutesNow < item.endTime);

    if (!currentFlockItem) return;

    const currentFlockWeightGrams = (currentFlockItem.avgWeight || 0) * 1000;
    if (currentFlockWeightGrams === 0) return;

    const calibratedSuroviny = new Map(appState.suroviny.filter(s => s.isCalibrated && s.isActive).map(s => [s.id, s]));
    if (calibratedSuroviny.size === 0) return;
    
    const calibratedOrders = [];
    appState.orders
        .filter(o => o.date === appState.ui.selectedDate)
        .forEach(order => {
            order.items.forEach(item => {
                if (item.isActive && item.doneCount < item.boxCount && calibratedSuroviny.has(item.surovinaId)) {
                    calibratedOrders.push(item);
                }
            });
        });

    if (calibratedOrders.length === 0) return;

    const matchingAlerts = [];
    calibratedOrders.forEach(item => {
        const surovina = calibratedSuroviny.get(item.surovinaId);
        const baseSurovina = appState.suroviny.find(s => s.id === surovina.baseSurovinaId);
        if (!baseSurovina || !surovina.caliberRange) return;

        const settingsKey = getCalibrationKey(baseSurovina.name);
        if (!settingsKey) return;
        
        const calibrationRule = appState.calibrationSettings[settingsKey]?.find(rule => rule.productCaliber === surovina.caliberRange);
        if (!calibrationRule || !calibrationRule.chickenWeight) return;

        const targetWeightGrams = calibrationRule.chickenWeight;
        const tolerance = 0.15; // 15%

        if (Math.abs(currentFlockWeightGrams - targetWeightGrams) <= targetWeightGrams * tolerance) {
            matchingAlerts.push(`Nyní je ideální čas na výrobu <strong>${surovina.name}</strong>. Zpracovává se chov s průměrnou váhou <strong>${currentFlockItem.avgWeight.toFixed(2)} kg/ks</strong>.`);
        }
    });

    if (matchingAlerts.length > lastCalibrationAlertCount) {
        playNotificationSound('success');
    }
    lastCalibrationAlertCount = matchingAlerts.length;

    if (matchingAlerts.length > 0) {
        if (alertsContainer.innerHTML.includes('Žádné nedostatky surovin')) {
            alertsContainer.innerHTML = ''; // Clear the "no shortage" message
        }
        let html = '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;"><h4>Upozornění na kalibraci</h4>';
        matchingAlerts.forEach(alertText => {
            html += `<p style="color: var(--accent-primary); font-weight: 500; display: flex; align-items: center; gap: 8px; margin-top: 8px;"><i data-feather="star"></i><span>${alertText}</span></p>`;
        });
        alertsContainer.innerHTML += html;
    }
}

export function renderMainPage() {
    if (appState.ui.selectedDate !== lastRenderedDateForAlerts) {
        lastCalibrationAlertCount = 0;
        lastShortageCount = 0;
        lastRenderedDateForAlerts = appState.ui.selectedDate;
    }
    const alertsContainer = document.getElementById('main-page-alerts');
    const surplusContainer = document.getElementById('main-page-yield-surplus');
    const quickEntryContainer = document.getElementById('main-page-quick-entry');
    const kfcQuickEntryContainer = document.getElementById('main-page-kfc-quick-entry');
    const spizyQuickEntryContainer = document.getElementById('main-page-spizy-quick-entry');
    const spizyContainer = document.getElementById('main-page-spizy');
    const date = appState.ui.selectedDate;
    
    alertsContainer.innerHTML = '';
    surplusContainer.innerHTML = ''; 
    let hasAlerts = false;
    let currentShortageCount = 0;

    const calculationResults = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData, thighNeeds } = calculateYieldData(date, dailyData?.flocks, calculationResults.totals.totalWeight);
    const yieldMap = new Map(yieldData.map(d => [d.name.toUpperCase().replace(' (SKELETY)', ''), d]));
    const hasProduction = calculationResults.totals.totalWeight > 0;
    
    const todayNeeds = getDailyNeeds(appState.ui.selectedDate);
    const maykawaThighsNeeded = getMaykawaThighsNeeded(appState.ui.selectedDate);
    if (maykawaThighsNeeded > 0) {
         const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
         if(thighsSurovina) {
            todayNeeds[thighsSurovina.id] = (todayNeeds[thighsSurovina.id] || 0) + maykawaThighsNeeded;
         }
    }
    
    // --- NEW: Old Stock Leftover Alert ---
    const leftoverStockAlerts = [];
    appState.suroviny.filter(s => s.isActive && !s.isMix && !s.isProduct).forEach(s => {
        const neededKg = todayNeeds[s.id] || 0;
        const paletteStockKg = (s.stock || 0) * (s.paletteWeight || 0);
        const boxStockKg = (appState.dailyStockAdjustments[date]?.[s.id] || 0) * (s.boxWeight || 25);
        const stockFromWarehouseKg = paletteStockKg + boxStockKg;

        if (stockFromWarehouseKg > neededKg) {
            const leftoverKg = stockFromWarehouseKg - neededKg;
            const paletteWeight = s.paletteWeight || 500;
            const boxWeight = s.boxWeight || 25;

            const leftoverPallets = paletteWeight > 0 ? Math.floor(leftoverKg / paletteWeight) : 0;
            const remainingKgForBoxes = paletteWeight > 0 ? leftoverKg % paletteWeight : leftoverKg;
            const leftoverBoxes = boxWeight > 0 ? Math.round(remainingKgForBoxes / boxWeight) : 0;

            if (leftoverKg > 0.1) {
                leftoverStockAlerts.push(`
                    <div style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border-radius: 8px; background-color: color-mix(in srgb, var(--accent-primary) 10%, transparent);">
                         <i data-feather="archive" style="color: var(--accent-primary);"></i>
                         <span>Zůstane staré maso <strong>${s.name}</strong>: ${leftoverPallets} palet a ${leftoverBoxes} beden.</span>
                    </div>
                `);
            }
        }
    });

    if (leftoverStockAlerts.length > 0) {
        hasAlerts = true;
        alertsContainer.innerHTML += `
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
              ${leftoverStockAlerts.join('')}
          </div>
        `;
    }


    // --- Section 1: Shortage Alerts ---
    const shortageAlerts = [];
    // Pre-calculate balances for interdependent materials
    const prsaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'PRSA');
    const prsaStockKg = prsaSurovina ? ((prsaSurovina.stock || 0) * (prsaSurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[prsaSurovina.id] || 0) * (prsaSurovina.boxWeight || 25)) : 0;
    const prsaYieldInfo = yieldMap.get('PRSA');
    const totalPrsaBalanceKg = prsaStockKg + (prsaYieldInfo?.difference || 0);

    const thighSurovinaNames = ['STEHNA', 'HORNÍ STEHNA', 'SPODNÍ STEHNA', 'ČTVRTKY'];
    const thighSuroviny = appState.suroviny.filter(s => thighSurovinaNames.includes(s.name.toUpperCase()));
    let totalThighStockKg = 0;
    thighSuroviny.forEach(s => {
        const boxes = appState.dailyStockAdjustments[date]?.[s.id] || 0;
        totalThighStockKg += (s.stock || 0) * (s.paletteWeight || 0) + boxes * (s.boxWeight || 25);
    });
    const totalThighsProducedKg = yieldMap.get('STEHNA CELKEM')?.produced || 0;
    const totalThighsNeededKg = Object.values(thighNeeds).reduce((sum, val) => sum + val, 0);
    const isThighPoolCovered = (totalThighStockKg + totalThighsProducedKg) >= totalThighsNeededKg;


    appState.suroviny.filter(s => !s.isMix && !s.isProduct).forEach(s => {
        const neededKg = todayNeeds[s.id] || 0;
        if (neededKg <= 0) return;

        const boxes = appState.dailyStockAdjustments[date]?.[s.id] || 0;
        const boxWeight = s.boxWeight || 25;
        const stockKg = (s.stock || 0) * (s.paletteWeight || 0) + boxes * boxWeight;

        if (stockKg < neededKg) {
            hasAlerts = true;
            let isCovered = false;
            let finalShortageKg = neededKg - stockKg;
            const surovinaNameUpper = s.name.toUpperCase();

            if (surovinaNameUpper === 'ŘÍZKY') {
                isCovered = totalPrsaBalanceKg >= 0;
                if (!isCovered) {
                    const prsaDeficitKg = -totalPrsaBalanceKg;
                    finalShortageKg = prsaDeficitKg * 0.70;
                }
            } else if (surovinaNameUpper === 'PRSA') {
                isCovered = totalPrsaBalanceKg >= 0;
                if (!isCovered) finalShortageKg = -totalPrsaBalanceKg;
            } else if (surovinaNameUpper === 'STEAK') {
                const finalThighBalanceKg = (totalThighStockKg + totalThighsProducedKg) - totalThighsNeededKg;
                isCovered = finalThighBalanceKg >= 0;
                if (!isCovered) {
                    const { bonePercent, skinPercent } = appState.maykawaConfig;
                    const steakYieldPercent = (100 - (bonePercent || 0) - (skinPercent || 0)) / 100;
                    if (steakYieldPercent > 0) {
                        const finalThighShortageKg = -finalThighBalanceKg;
                        const steakNeededFromProductionKg = neededKg - stockKg;
                        const potentialSteakShortageKg = finalThighShortageKg * steakYieldPercent;
                        finalShortageKg = Math.min(steakNeededFromProductionKg, potentialSteakShortageKg);
                    }
                }
            } else if (thighSurovinaNames.includes(surovinaNameUpper)) {
                isCovered = isThighPoolCovered;
            } else {
                // Generic logic for other parts (Křídla, etc.)
                const yieldNameMap = { 'KŘÍDLA': 'KŘÍDLA', 'ZADNÍ DÍLY (SKELETY)': 'ZADNÍ DÍLY', 'HRBETY': 'ZADNÍ DÍLY', 'KŮŽE': 'KŮŽE', 'KOSTI': 'KOSTI', 'JÁTRA': 'JÁTRA', 'SRDCE': 'SRDCE', 'ŽALUDKY': 'ŽALUDKY', 'KRKY': 'KRKY' };
                const yieldName = yieldNameMap[surovinaNameUpper];
                const yieldInfo = yieldMap.get(yieldName);
                if (yieldInfo) {
                    const totalBalance = stockKg + yieldInfo.difference;
                    isCovered = totalBalance >= 0;
                    if (!isCovered) finalShortageKg = -totalBalance;
                }
            }
            
            finalShortageKg = Math.max(0, finalShortageKg);
            let alertMessage = '';
            let icon = '';
            
            if (isCovered && hasProduction) {
                const stockShortageKg = neededKg - stockKg;
                const stockShortagePalettes = s.paletteWeight > 0 ? stockShortageKg / s.paletteWeight : 0;
                alertMessage = `Chybí ${stockShortagePalettes.toFixed(2)} palet`;
                icon = `<i data-feather="check-circle" style="color: var(--accent-success);"></i>`;
            } else {
                currentShortageCount++;
                const finalShortagePalettes = s.paletteWeight > 0 ? finalShortageKg / s.paletteWeight : 0;
                alertMessage = `Chybí ${finalShortagePalettes.toFixed(2)} palet`;
                icon = `<i data-feather="x-circle" style="color: var(--accent-danger);"></i>`;
            }
            
            const isCoveredByProduction = isCovered && hasProduction;
            let adjustButton = '';
            if (isCoveredByProduction) {
                 adjustButton = `
                    <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" data-action="open-single-stock-adjustment" data-surovina-id="${s.id}">
                        Sklad
                    </button>
                `;
            } else {
                 adjustButton = `
                    <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" data-action="open-surovina-shortage-modal" data-surovina-id="${s.id}">
                        Sklad
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" data-action="open-surovina-shortage-modal" data-surovina-id="${s.id}">
                        Pokrátit
                    </button>
                `;
            }
            
            shortageAlerts.push(`
                <div class="shortage-card ${isCoveredByProduction ? 'is-covered' : ''}">
                    <div class="shortage-card-header">
                        ${icon}
                        <h4>${s.name}</h4>
                    </div>
                    <div class="shortage-card-body">
                        <p>${alertMessage}</p>
                    </div>
                    <div class="shortage-card-footer">
                        ${adjustButton}
                    </div>
                </div>
            `);
        }
    });

    if (shortageAlerts.length > 0) {
        alertsContainer.innerHTML += `
            <div class="shortage-grid">
                ${shortageAlerts.join('')}
            </div>
        `;
    }


    // Spizy suroviny alerts (these don't come from the line)
    const spizyNeeds = getSpizyNeeds(appState.ui.selectedDate);
    const { spizyStock } = appState;
    const spizyIngredients = [
        { key: 'klobasa', name: 'Klobása' }, { key: 'spek', name: 'Špek' }, { key: 'steak', name: 'Steak na špíz' },
        { key: 'cibule', name: 'Cibule' }, { key: 'paprika', name: 'Paprika' },
    ];
    spizyIngredients.forEach(ing => {
        const needed = spizyNeeds[ing.key] || 0;
        const stock = spizyStock[ing.key] || 0;
        if (stock < needed) {
            hasAlerts = true;
            currentShortageCount++;
            const icon = `<i data-feather="x-circle" style="color: var(--accent-danger);"></i>`;
            alertsContainer.innerHTML += `<p class="shortage" style="display: flex; align-items: center; gap: 8px;">${icon} Špízy: Chybí ${(needed - stock).toFixed(2)} kg ${ing.name}</p>`;
        }
    });

    // Price change alerts
    const activePriceChanges = appState.priceChanges.filter(change => 
        change.validFrom <= date && !appState.dismissedPriceChangeAlerts.includes(change.id)
    );

    if (activePriceChanges.length > 0) {
        let priceChangeAlertsHtml = '';
        activePriceChanges.forEach(change => {
            const hasOrder = appState.orders.some(o => 
                o.date === date && 
                o.customerId === change.customerId && 
                o.items.some(i => i.surovinaId === change.surovinaId)
            );
            const hasAction = appState.plannedActions.some(a => 
                a.customerId === change.customerId && 
                a.surovinaId === change.surovinaId && 
                date >= a.startDate && 
                (!a.endDate || date <= a.endDate) &&
                (a.dailyCounts?.[date]?.boxCount || 0) > 0
            );

            if (hasOrder || hasAction) {
                const customer = appState.zakaznici.find(c => c.id === change.customerId);
                const surovina = appState.suroviny.find(s => s.id === change.surovinaId);
                const formattedDate = new Date(change.validFrom).toLocaleDateString('cs-CZ');
                
                if (customer && surovina) {
                    hasAlerts = true;
                    priceChangeAlertsHtml += `
                        <div class="shortage" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; background-color: color-mix(in srgb, var(--accent-danger) 15%, transparent); border-color: var(--accent-danger);">
                            <span style="display: flex; align-items: center; gap: 8px;"><i data-feather="dollar-sign" style="color: var(--accent-danger);"></i> Upozornění: Změna ceny pro ${customer.name} - ${surovina.name} od ${formattedDate}</span>
                            <button class="btn btn-secondary" data-action="dismiss-price-change-alert" data-id="${change.id}" style="padding: 4px 12px;">OK</button>
                        </div>
                    `;
                }
            }
        });
        if (priceChangeAlertsHtml) {
            alertsContainer.innerHTML += priceChangeAlertsHtml;
        }
    }


    if (currentShortageCount > lastShortageCount) {
        playNotificationSound('warning');
    }
    lastShortageCount = currentShortageCount;

    if (!hasAlerts) {
        alertsContainer.innerHTML = '<p>Žádné nedostatky surovin ani jiná upozornění.</p>';
    }

    renderCalibrationAlerts(alertsContainer);
    
    // START of pre-production section
    const preProductionContainer = document.getElementById('main-page-pre-production-status');
    const actionsForToday = appState.plannedActions.filter(a => {
        const dayData = a.dailyCounts?.[date];
        return dayData && dayData.boxCount > 0;
    });

    if (actionsForToday.length > 0) {
        let preProdHtml = `<h4>Předvýroba na dnes</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Zákazník</th>
                        <th>Produkt</th>
                        <th>Plán</th>
                        <th>Hotovo</th>
                        <th>Zbývá</th>
                        <th class="actions">Akce</th>
                    </tr>
                </thead>
                <tbody>`;
        
        actionsForToday.forEach(action => {
            const dayData = action.dailyCounts[date];
            const customer = appState.zakaznici.find(c => c.id === action.customerId);
            const product = appState.suroviny.find(s => s.id === action.surovinaId);
            const remaining = dayData.boxCount - (dayData.producedCount || 0);

            preProdHtml += `
                <tr class="${remaining <= 0 ? 'done' : ''}">
                    <td>${customer?.name || '?'}</td>
                    <td>${product?.name || '?'}</td>
                    <td>${dayData.boxCount}</td>
                    <td><input type="number" class="pre-production-done-input" value="${dayData.producedCount || ''}" data-action-id="${action.id}" data-date="${date}" min="0" max="${dayData.boxCount}" style="width: 80px;"></td>
                    <td>${remaining}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-success" data-action="mark-pre-production-done" data-action-id="${action.id}" data-date="${date}" ${remaining <= 0 ? 'disabled' : ''}>Hotovo</button>
                    </td>
                </tr>
            `;
        });

        preProdHtml += '</tbody></table>';
        preProductionContainer.innerHTML = preProdHtml;
        preProductionContainer.style.display = 'block';

    } else {
        preProductionContainer.innerHTML = '';
        preProductionContainer.style.display = 'none';
    }
    // END of pre-production section

    // Section 2: Shortage detection for the 'Výroba' button
    let kfcHasShortage = false;
    const kfcSurovinyNeeded = getKfcSurovinyNeeds(date);
    if (Object.keys(kfcSurovinyNeeded).length > 0) {
        for (const surovinaId in kfcSurovinyNeeded) {
            const surovina = appState.kfcSuroviny.find(s => s.id === surovinaId);
            if (surovina && (surovina.stockBoxes || 0) < kfcSurovinyNeeded[surovinaId]) {
                kfcHasShortage = true;
                break;
            }
        }
    }
    
    let spizyHasShortage = false;
    if ((spizyNeeds.klobasa > spizyStock.klobasa) || (spizyNeeds.spek > spizyStock.spek) || (spizyNeeds.cibule > spizyStock.cibule) || (spizyNeeds.steak > spizyStock.steak) || (spizyNeeds.paprika > spizyStock.paprika)) {
        spizyHasShortage = true;
    }
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (rizkySurovina && spizyNeeds.rizky > 0) {
        const rizkyStockKg = (rizkySurovina.stock || 0) * (rizkySurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[rizkySurovina.id] || 0) * (rizkySurovina.boxWeight || 25);
        if (rizkyStockKg < (todayNeeds[rizkySurovina.id] || 0)) {
            spizyHasShortage = true;
        }
    }
    
    let rizkyHasShortage = false;
    if (rizkySurovina) {
        const rizkyNeededKg = todayNeeds[rizkySurovina.id] || 0;
        if (rizkyNeededKg > 0) {
                const rizkyStockKg = (rizkySurovina.stock || 0) * (rizkySurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[rizkySurovina.id] || 0) * (rizkySurovina.boxWeight || 25);
                if (rizkyStockKg < rizkyNeededKg) {
                    rizkyHasShortage = true;
                }
        }
    }
    
    let steakHasShortage = false;
    if (maykawaThighsNeeded > 0) {
            const stehnaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
            if (stehnaSurovina) {
            const totalStehnaNeeded = (todayNeeds[stehnaSurovina.id] || 0);
            const stehnaStockKg = (stehnaSurovina.stock || 0) * (stehnaSurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[stehnaSurovina.id] || 0) * (stehnaSurovina.boxWeight || 25);
            if (stehnaStockKg < totalStehnaNeeded) {
                steakHasShortage = true;
            }
            }
    }
    
    const vyrobaBtn = document.getElementById('main-page-vyroba-btn');
    if (vyrobaBtn) {
        const hasAnyShortage = kfcHasShortage || spizyHasShortage || rizkyHasShortage || steakHasShortage;
        if (hasAnyShortage) {
            vyrobaBtn.classList.remove('btn-secondary');
            vyrobaBtn.classList.add('btn-danger');
        } else {
            vyrobaBtn.classList.remove('btn-danger');
            vyrobaBtn.classList.add('btn-secondary');
        }
    }
    
    quickEntryContainer.innerHTML = '';
    const quickEntryProducts = appState.products.filter(p => p.showInQuickEntry && p.isActive);

    quickEntryProducts.forEach(product => {
        let neededKg = 0;
        appState.orders.filter(o => o.date === date).forEach(order => {
            order.items.filter(i => i.surovinaId === product.id && i.isActive).forEach(item => {
                const weights = appState.boxWeights[order.customerId]?.[product.id];
                const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : product.boxWeight;
                neededKg += item.boxCount * (boxWeightInGrams / 1000);
            });
        });

        appState.plannedActions.filter(a => a.surovinaId === product.id && date >= a.startDate && (!a.endDate || date <= a.endDate)).forEach(action => {
            const dayCountData = action.dailyCounts?.[date];
            const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
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

    const spizyNeedsResult = getSpizyNeeds(appState.ui.selectedDate);
    if (spizyNeedsResult.steak > 0) {
        spizyQuickEntryContainer.innerHTML = `
            <div class="quick-needs-section">
                <h4>Špízy - Potřeba</h4>
                <ul>
                    <li><span>Steak (k marinaci)</span><strong>${spizyNeedsResult.steak.toFixed(2)} kg</strong></li>
                </ul>
            </div>`;
    } else {
        spizyQuickEntryContainer.innerHTML = '';
    }

    if (kfcQuickEntryContainer.innerHTML.trim() || spizyQuickEntryContainer.innerHTML.trim()) {
        const divider = document.createElement('hr');
        divider.style.border = 'none';
        divider.style.borderTop = '1px solid var(--border-color)';
        divider.style.margin = '25px 0';
        
        const firstCard = document.querySelector('#view-main-page .card');
        if (firstCard) {
            firstCard.insertAdjacentElement('afterend', divider);
        }
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

    renderOrderTableForSurovina('ŘÍZKY', 'main-page-rizky');
    renderOrderTableForSurovina('MLETÉ MASO', 'main-page-minced-meat');
    renderOrderTableForSurovina('STEAK', 'main-page-steak');
    renderOrderTableForSurovina('HORNÍ STEHNA', 'main-page-horni-stehna', 'Horní stehna');
    renderOrderTableForSurovina('SPODNÍ STEHNA', 'main-page-spodni-stehna', 'Spodní stehna');
    renderOrderTableForSurovina('STEHNA', 'main-page-stehna');
    renderOrderTableForSurovina('PRSA', 'main-page-prsa');
    renderOrderTableForSurovina('ČTVRTKY', 'main-page-ctvrtky');
    
    const updateBadge = (containerId, count) => {
        const badge = document.querySelector(`${containerId} .order-badge`);
        if (badge) {
            badge.textContent = count > 0 ? count : '';
        }
    };

    const toggleSectionVisibility = (containerId, hasOrders) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = hasOrders ? '' : 'none';
        }
    };

    const hasSpizy = hasSpizyOrders(date);
    toggleSectionVisibility('main-page-spizy-container', hasSpizy);
    const spizyCount = hasSpizy ? getPendingSpizyCount(date) : 0;
    updateBadge('#main-page-spizy-container', spizyCount);

    const hasRizky = hasOrdersForSurovina(date, 'ŘÍZKY');
    toggleSectionVisibility('main-page-rizky-container', hasRizky);
    const rizkyCount = hasRizky ? getPendingCountForSurovina(date, 'ŘÍZKY') : 0;
    updateBadge('#main-page-rizky-container', rizkyCount);
    
    const hasMinced = hasOrdersForSurovina(date, 'MLETÉ MASO');
    toggleSectionVisibility('main-page-minced-meat-container', hasMinced);
    const mincedCount = hasMinced ? getPendingCountForSurovina(date, 'MLETÉ MASO') : 0;
    updateBadge('#main-page-minced-meat-container', mincedCount);

    const hasSteak = hasOrdersForSurovina(date, 'STEAK');
    toggleSectionVisibility('main-page-steak-container', hasSteak);
    const steakCount = hasSteak ? getPendingCountForSurovina(date, 'STEAK') : 0;
    updateBadge('#main-page-steak-container', steakCount);

    const hasHorni = hasOrdersForSurovina(date, 'HORNÍ STEHNA');
    const hasSpodni = hasOrdersForSurovina(date, 'SPODNÍ STEHNA');
    toggleSectionVisibility('main-page-horni-spodni-container', hasHorni || hasSpodni);
    const horniCount = hasHorni ? getPendingCountForSurovina(date, 'HORNÍ STEHNA') : 0;
    const spodniCount = hasSpodni ? getPendingCountForSurovina(date, 'SPODNÍ STEHNA') : 0;
    updateBadge('#main-page-horni-spodni-container', horniCount + spodniCount);

    const hasStehna = hasOrdersForSurovina(date, 'STEHNA');
    toggleSectionVisibility('main-page-stehna-container', hasStehna);
    const stehnaCount = hasStehna ? getPendingCountForSurovina(date, 'STEHNA') : 0;
    updateBadge('#main-page-stehna-container', stehnaCount);

    const hasPrsa = hasOrdersForSurovina(date, 'PRSA');
    toggleSectionVisibility('main-page-prsa-container', hasPrsa);
    const prsaCount = hasPrsa ? getPendingCountForSurovina(date, 'PRSA') : 0;
    updateBadge('#main-page-prsa-container', prsaCount);

    const hasCtvrtky = hasOrdersForSurovina(date, 'ČTVRTKY');
    toggleSectionVisibility('main-page-ctvrtky-container', hasCtvrtky);
    const ctvrtkyCount = hasCtvrtky ? getPendingCountForSurovina(date, 'ČTVRTKY') : 0;
    updateBadge('#main-page-ctvrtky-container', ctvrtkyCount);

    const totalPendingCount = spizyCount + rizkyCount + mincedCount + steakCount + horniCount + spodniCount + stehnaCount + prsaCount + ctvrtkyCount;
    updateBadge('#main-page-overview-container', totalPendingCount);
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

export async function toggleSpizyDone(target) {
    const { orderId, type } = target.dataset;
    const date = appState.ui.selectedDate;
    const order = appState.spizyOrders[date]?.find(o => o.id === orderId);
    if (order) {
        const key = `${type}IsDone`;
        order[key] = !order[key];
        saveState();
        await render();

        // Check if the spizy accordion should be closed
        const detailsElement = document.getElementById('main-page-spizy-container');
        if (detailsElement && detailsElement.open) {
            const allSpizyDone = (appState.spizyOrders[date] || []).every(o => {
                const klobasaOk = o.klobasa === 0 || o.klobasaIsDone;
                const spekOk = o.spek === 0 || o.spekIsDone;
                const cilliOk = o.cilli === 0 || o.cilliIsDone;
                return klobasaOk && spekOk && cilliOk;
            });
            if (allSpizyDone) {
                detailsElement.open = false;
            }
        }
    }
}

/**
 * Calculates the raw material consumption for a single order item and updates the stock.
 * @param {object} item - The order item.
 * @param {string} customerId - The ID of the customer for the order.
 * @param {number} factor - 1 to add stock (un-doing), -1 to remove stock (doing).
 */
function updateStockForOrderItem(item, customerId, factor) {
    const itemSurovina = appState.suroviny.find(s => s.id === item.surovinaId);
    if (!itemSurovina || item.boxCount === 0) return;

    const weights = appState.boxWeights[customerId]?.[itemSurovina.id];
    const defaultWeight = (itemSurovina.isProduct ? appState.products.find(p => p.id === itemSurovina.id)?.boxWeight : (itemSurovina.boxWeight * 1000)) || 10000;
    const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : defaultWeight;
    const totalItemKg = item.boxCount * (boxWeightInGrams / 1000);

    const materialsToUpdate = []; // [{ surovina: surovinaObject, kg: amountInKg }]

    if (itemSurovina.isProduct) {
        const productDef = appState.products.find(p => p.id === itemSurovina.id);
        if (productDef && productDef.surovinaId) {
            const baseSurovina = appState.suroviny.find(s => s.id === productDef.surovinaId);
            if (baseSurovina) {
                let usableMeatWeight = totalItemKg;
                if (productDef.marinadePercent > 0) {
                    usableMeatWeight /= (1 + productDef.marinadePercent / 100);
                }
                let rawMaterialWeight = usableMeatWeight;
                if (productDef.lossPercent > 0) {
                    rawMaterialWeight /= (1 - ((productDef.lossPercent || 0) / 100));
                }
                materialsToUpdate.push({ surovina: baseSurovina, kg: rawMaterialWeight });
            }
        }
    } else if (itemSurovina.isMix) {
        const mixDef = appState.mixDefinitions[itemSurovina.id];
        if (mixDef && mixDef.components) {
            mixDef.components.forEach(comp => {
                const componentSurovina = appState.suroviny.find(s => s.id === comp.surovinaId);
                if (componentSurovina) {
                    const rawMaterialForComponent = (totalItemKg * (comp.percentage / 100)) / (1 - ((comp.loss || 0) / 100));
                    materialsToUpdate.push({ surovina: componentSurovina, kg: rawMaterialForComponent });
                }
            });
        }
    } else {
        // Simple raw material
        materialsToUpdate.push({ surovina: itemSurovina, kg: totalItemKg });
    }

    materialsToUpdate.forEach(({ surovina, kg }) => {
        if (surovina.paletteWeight > 0) {
            const palettesToChange = kg / surovina.paletteWeight;
            surovina.stock = (surovina.stock || 0) + (palettesToChange * factor);
        }
    });
}


export async function toggleMainPageOrderItemDone(target) {
    const { orderId, itemId } = target.dataset;
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);

    if (item) {
        const isMarkingDone = item.doneCount < item.boxCount;
        const factor = isMarkingDone ? -1 : 1; // -1 to remove from stock, 1 to add back
        
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);

        // Update stock before changing doneCount
        updateStockForOrderItem(item, order.customerId, factor);

        // Now toggle the done status
        if (isMarkingDone) {
            item.doneCount = item.boxCount; // If not done, mark as fully done
        } else {
            item.doneCount = 0; // If done, mark as not done
        }
        
        saveState();
        showToast(isMarkingDone ? 'Položka označena jako hotová a suroviny odečteny.' : 'Označení zrušeno a suroviny vráceny na sklad.');
        await render();
        
        // NEW LOGIC: Check if accordion can be closed
        if (surovina) {
            const containerId = getContainerIdForSurovina(surovina.name);
            if (containerId) {
                const detailsElement = document.getElementById(containerId);
                if (detailsElement && detailsElement.open) {
                    const allRows = detailsElement.querySelectorAll('tbody tr');
                    // Check if there are any rows and if all of them have the 'done' class
                    const allDone = allRows.length > 0 && Array.from(allRows).every(row => row.classList.contains('done'));
                    if (allDone) {
                        detailsElement.open = false;
                    }
                }
            }
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

export function handleMainOrderDoneChange(target) {
    const { orderId, itemId } = target.dataset;
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);

    if (item) {
        const value = parseInt(target.value) || 0;
        if (value > item.boxCount) {
            item.doneCount = item.boxCount;
            target.value = item.boxCount; // Correct the input value visually
            showToast('Nelze zadat více hotových beden než je objednáno.', 'error');
        } else {
            item.doneCount = value;
        }
        saveState();
        renderMainPage(); // Re-render to update badges and row styles
    }
}

export function setPreProductionDays(target) {
    const days = parseInt(target.dataset.days, 10);
    target.parentElement.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    target.classList.add('active');
    openPreProductionModal(days);
}

export function openPreProductionModal(days = 5) {
    const modal = DOMElements.preProductionModal;
    const body = modal.querySelector('#pre-production-body');
    const todayActualDateString = new Date().toISOString().split('T')[0];

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Datum</th>
                <th>Zákazník</th>
                <th>Produkt</th>
                <th>Plán (bedny)</th>
                <th>Vyrobeno (bedny)</th>
                <th>Surovina (kg)</th>
                <th class="actions">Vyrobit (bedny)</th>
            </tr>
        </thead>
        <tbody>`;
    let hasActions = false;
    const today = new Date(appState.ui.selectedDate);

    for (let i = 0; i < days; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const actionsForDay = appState.plannedActions.filter(a => {
            const dayCountData = a.dailyCounts?.[dateStr];
            const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
            return boxCount > 0 && dateStr >= a.startDate && (!a.endDate || dateStr <= a.endDate);
        });

        if (actionsForDay.length > 0) {
            actionsForDay.forEach(action => {
                const customer = appState.zakaznici.find(c => c.id === action.customerId);
                const surovina = appState.suroviny.find(s => s.id === action.surovinaId);
                if (!customer || !surovina) return;

                const dayCountData = action.dailyCounts[dateStr];
                const plannedBoxes = dayCountData.boxCount || 0;
                const producedBoxes = dayCountData.producedCount || 0;
                const remainingBoxes = plannedBoxes - producedBoxes;

                const isTodayAction = dateStr === todayActualDateString;
                if (remainingBoxes <= 0 && isTodayAction) {
                    return; // Skip if for today and already done
                }

                hasActions = true;
                const isDone = remainingBoxes <= 0;
                const boxWeightInGrams = appState.boxWeights[customer.id]?.[surovina.id]?.VL || surovina.boxWeight * 1000;
                const neededKg = (remainingBoxes * boxWeightInGrams) / 1000;
                const buttonHtml = `<button class="btn ${isDone ? 'btn-secondary' : 'btn-success'}" data-action="produce-from-plan" data-action-id="${action.id}" data-date="${dateStr}" ${isDone ? 'disabled' : ''}>${isDone ? 'Hotovo' : 'Vyrobit'}</button>`;

                tableHTML += `
                    <tr>
                        <td>${new Date(dateStr).toLocaleDateString('cs-CZ')}</td>
                        <td>${customer.name}</td>
                        <td>${surovina.name}</td>
                        <td>${plannedBoxes}</td>
                        <td>${producedBoxes}</td>
                        <td>${isDone ? '0.00' : neededKg.toFixed(2)}</td>
                        <td class="actions">
                            <div style="display: flex; gap: 5px;">
                                <input type="number" id="produce-count-${action.id}-${dateStr}" class="pre-production-input" min="0" max="${remainingBoxes}" placeholder="${isDone ? '' : remainingBoxes}" style="width: 80px;" ${isDone ? 'disabled' : ''}>
                                ${buttonHtml}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }

    if (!hasActions) {
        tableHTML += `<tr><td colspan="7" style="text-align: center;">Nebyly nalezeny žádné naplánované akce na dalších ${days} dní.</td></tr>`;
    }

    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    modal.classList.add('active');
    feather.replace();
}

export async function produceFromPlan(target) {
    const { actionId, date: futureDate } = target.dataset;
    const currentDate = appState.ui.selectedDate;

    const input = document.getElementById(`produce-count-${actionId}-${futureDate}`);
    const action = appState.plannedActions.find(a => a.id === actionId);
    if (!action || !input) return;

    const dayCountData = action.dailyCounts[futureDate];
    const remainingBoxes = (dayCountData.boxCount || 0) - (dayCountData.producedCount || 0);
    let boxesToProduce = parseInt(input.value);

    if (isNaN(boxesToProduce) || boxesToProduce <= 0) {
        boxesToProduce = remainingBoxes;
    }

    if (boxesToProduce > remainingBoxes) {
        showToast('Nelze vyrobit více beden, než je v plánu.', 'error');
        return;
    }

    // 1. Update planned action on the future date
    dayCountData.producedCount += boxesToProduce;

    // 2. Add a completed order item to the CURRENT day's orders
    let order = appState.orders.find(o => o.customerId === action.customerId && o.date === currentDate);
    if (!order) {
        order = { id: generateId(), date: currentDate, customerId: action.customerId, items: [] };
        appState.orders.push(order);
    }

    let item = order.items.find(i => i.surovinaId === action.surovinaId && i.type === 'VL');
    if (!item) {
        item = { 
            id: generateId(), 
            surovinaId: action.surovinaId, 
            boxCount: 0, 
            isActive: true, 
            type: 'VL', 
            doneCount: 0 
        };
        order.items.push(item);
    }

    // Add to boxCount and mark as done to consume raw materials today
    item.boxCount += boxesToProduce;
    item.doneCount += boxesToProduce;

    saveState();
    showToast(`${boxesToProduce} beden vyrobeno a surovina započtena na den ${new Date(currentDate+'T00:00:00').toLocaleDateString('cs-CZ')}.`, 'success');

    const activeDaysButton = document.querySelector('#pre-production-modal .btn-group .btn.active');
    const days = activeDaysButton ? parseInt(activeDaysButton.dataset.days, 10) : 5;

    await render(); 

    openPreProductionModal(days);
    
    const modal = DOMElements.preProductionModal;
    if (modal) {
        modal.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
        const newActiveButton = modal.querySelector(`.btn-group .btn[data-days="${days}"]`);
        if (newActiveButton) {
            newActiveButton.classList.add('active');
        }
    }
}

export function openTempWeightModal(target) {
    const { surovinaId } = target.dataset;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    if (!surovina) return;

    const date = appState.ui.selectedDate;
    const modal = DOMElements.tempWeightModal;
    modal.dataset.surovinaId = surovinaId;

    const affectedItems = [];
    const surovinaNameUpper = surovina.name.toUpperCase();
    
    const relatedSurovinaIds = new Set([surovinaId]);
    appState.products.forEach(p => {
        if (p.surovinaId === surovinaId) {
            relatedSurovinaIds.add(p.id);
        }
    });
    if (surovinaNameUpper === 'PRSA') {
        const rizky = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
        if (rizky) relatedSurovinaIds.add(rizky.id);
    }
    if (surovinaNameUpper === 'STEHNA') {
        const steak = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
        if (steak) relatedSurovinaIds.add(steak.id);
    }
    
    let totalNeededKg = 0;
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.isActive && relatedSurovinaIds.has(item.surovinaId)) {
                affectedItems.push({ ...item, orderId: order.id, customerId: order.customerId });

                const weights = appState.boxWeights[order.customerId]?.[item.surovinaId];
                const originalWeight = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
                totalNeededKg += item.boxCount * (originalWeight / 1000);
            }
        });
    });

    const calculationResults = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData } = calculateYieldData(date, dailyData?.flocks, calculationResults.totals.totalWeight);
    const yieldMap = new Map(yieldData.map(d => [d.name.toUpperCase().replace(' (SKELETY)', ''), d]));
    
    let availableKg = 0;

    if (surovinaNameUpper === 'ŘÍZKY') {
        const prsaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'PRSA');
        if (prsaSurovina) {
            const prsaStockKg = (prsaSurovina.stock || 0) * (prsaSurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[prsaSurovina.id] || 0) * (prsaSurovina.boxWeight || 25);
            const prsaYieldKg = yieldMap.get('PRSA')?.produced || 0;
            const totalPrsaAvailableKg = prsaStockKg + prsaYieldKg;
            
            const directPrsaNeededKg = getDailyNeeds(date)[prsaSurovina.id] || 0;
            const surplusPrsaKg = totalPrsaAvailableKg - directPrsaNeededKg;
            
            const potentialRizkyFromPrsaKg = Math.max(0, surplusPrsaKg) * 0.70;
            const rizkyStockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[surovinaId] || 0) * (surovina.boxWeight || 25);
            
            availableKg = potentialRizkyFromPrsaKg + rizkyStockKg;
        } else {
            availableKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[surovinaId] || 0) * (surovina.boxWeight || 25);
        }
    } else if (surovinaNameUpper === 'STEAK') {
        const { bonePercent, skinPercent } = appState.maykawaConfig;
        const steakYieldPercent = (100 - (bonePercent || 0) - (skinPercent || 0)) / 100;
        
        if (steakYieldPercent > 0) {
            const thighSurovinaNames = ['STEHNA', 'HORNÍ STEHNA', 'SPODNÍ STEHNA', 'ČTVRTKY'];
            const thighSuroviny = appState.suroviny.filter(s => thighSurovinaNames.includes(s.name.toUpperCase()));
            let totalThighStockKg = 0;
            thighSuroviny.forEach(s => {
                const boxes = appState.dailyStockAdjustments[date]?.[s.id] || 0;
                totalThighStockKg += (s.stock || 0) * (s.paletteWeight || 0) + boxes * (s.boxWeight || 25);
            });

            const thighYieldInfo = yieldMap.get('STEHNA CELKEM');
            const totalThighsProducedKg = thighYieldInfo?.produced || 0;
            const totalThighsAvailableKg = totalThighStockKg + totalThighsProducedKg;
            
            const totalThighsNeededKg = thighYieldInfo?.needed || 0;
            const { thighNeeds } = calculateYieldData(date, dailyData?.flocks, calculationResults.totals.totalWeight);
            const maykawaNeedsKg = thighNeeds['Na Steak (Maykawa)'] || 0;
            const otherThighNeedsKg = totalThighsNeededKg - maykawaNeedsKg;

            const surplusThighsForSteakKg = totalThighsAvailableKg - otherThighNeedsKg;
            
            const potentialSteakFromThighsKg = Math.max(0, surplusThighsForSteakKg) * steakYieldPercent;
            const steakStockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[surovinaId] || 0) * (surovina.boxWeight || 25);
            
            availableKg = potentialSteakFromThighsKg + steakStockKg;
        } else {
            availableKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[surovinaId] || 0) * (surovina.boxWeight || 25);
        }
    } else {
        const boxes = appState.dailyStockAdjustments[date]?.[surovinaId] || 0;
        const stockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + boxes * (surovina.boxWeight || 25);
        
        let yieldKg = 0;
        const yieldInfo = yieldMap.get(surovinaNameUpper.replace(' (SKELETY)', ''));
        if(yieldInfo) yieldKg = yieldInfo.produced;
        
        if(surovinaNameUpper === 'STEHNA') {
             const thighYieldInfo = yieldMap.get('STEHNA CELKEM');
             if(thighYieldInfo) yieldKg = thighYieldInfo.produced;
        }
    
        availableKg = stockKg + yieldKg;
    }
    
    const shortageKg = Math.max(0, totalNeededKg - availableKg);
    const reductionFactor = (totalNeededKg > 0 && availableKg < totalNeededKg) ? availableKg / totalNeededKg : 1;

    const summaryContainer = modal.querySelector('#temp-weight-summary');
    summaryContainer.innerHTML = `
        <p><strong>Potřeba celkem:</strong> ${totalNeededKg.toFixed(2)} kg</p>
        <p><strong>Dostupné (sklad + výroba):</strong> ${availableKg.toFixed(2)} kg</p>
        <p class="shortage"><strong>Chybí: ${shortageKg.toFixed(2)} kg</strong></p>
        <hr style="margin: 10px 0;">
        <p class="surplus"><strong>Navrhuje se rovnoměrné pokrácení o ${((1 - reductionFactor) * 100).toFixed(1)} %</strong></p>
    `;

    const tableContainer = modal.querySelector('#temp-weight-items-container');
    let tableHTML = `<table class="data-table"><thead><tr><th>Použít</th><th>Zákazník</th><th>Produkt</th><th>Typ</th><th>Pův. váha (g)</th><th>Nová váha (g)</th></tr></thead><tbody>`;

    affectedItems.forEach(item => {
        const customer = appState.zakaznici.find(c => c.id === item.customerId);
        const itemSurovina = appState.suroviny.find(s => s.id === item.surovinaId);

        const tempWeightKey = `${item.customerId}_${item.surovinaId}_${item.type}`;
        const tempWeight = appState.temporaryBoxWeights?.[date]?.[tempWeightKey];

        const weights = appState.boxWeights[item.customerId]?.[item.surovinaId];
        const originalWeight = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
        const suggestedWeightForRow = Math.floor(originalWeight * reductionFactor);

        tableHTML += `
            <tr data-customer-id="${item.customerId}" data-surovina-id="${item.surovinaId}" data-type="${item.type}">
                <td><input type="checkbox" class="apply-suggested-checkbox" style="width: 18px; height: 18px;"></td>
                <td>${customer?.name || '?'}</td>
                <td>${itemSurovina?.name || '?'}</td>
                <td>${item.type}</td>
                <td>${originalWeight}</td>
                <td><input type="number" class="temp-weight-input" value="${tempWeight !== undefined ? tempWeight : ''}" placeholder="${originalWeight}" max="${originalWeight}" data-suggested-weight="${suggestedWeightForRow}"></td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    
    modal.querySelector('.modal-title').textContent = `Dočasná úprava váhy pro ${surovina.name}`;
    modal.classList.add('active');
    feather.replace();
}

export function applySuggestedWeight(target) {
    const modal = target.closest('.modal');
    let appliedCount = 0;
    const checkboxes = modal.querySelectorAll('.apply-suggested-checkbox:checked');

    if (checkboxes.length === 0) {
        showToast('Nejprve zaškrtněte řádky, na které chcete aplikovat navrhovanou váhu.', 'warning');
        return;
    }

    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const input = row.querySelector('.temp-weight-input');
        if (input) {
            const suggestedWeight = input.dataset.suggestedWeight;
            if (suggestedWeight) {
                input.value = suggestedWeight;
                appliedCount++;
            }
        }
    });

    if (appliedCount > 0) {
        showToast(`Navrhovaná váha byla aplikována na ${appliedCount} řádků.`);
    } else {
        showToast('Pro vybrané řádky nebyla nalezena žádná navrhovaná váha.', 'error');
    }
}

export function saveTempWeights(target) {
    const modal = target.closest('.modal');
    const date = appState.ui.selectedDate;

    if (!appState.temporaryBoxWeights[date]) {
        appState.temporaryBoxWeights[date] = {};
    }

    modal.querySelectorAll('tbody tr').forEach(row => {
        const { customerId, surovinaId, type } = row.dataset;
        const input = row.querySelector('.temp-weight-input');
        const newWeight = parseInt(input.value, 10);
        
        const key = `${customerId}_${surovinaId}_${type}`;

        if (!isNaN(newWeight) && newWeight > 0) {
            appState.temporaryBoxWeights[date][key] = newWeight;
        } else {
            // If the input is empty or zero, remove the override
            delete appState.temporaryBoxWeights[date][key];
        }
    });

    saveState();
    modal.classList.remove('active');
    showToast('Dočasné váhy byly uloženy.');
    renderMainPage();
}

// --- NEW Shortage Modal ---

export function openSurovinaShortageModal(surovinaId) {
    const modal = DOMElements.surovinaShortageModal;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    if (!surovina) return;
    
    modal.dataset.surovinaId = surovinaId;

    modal.querySelector('#surovina-shortage-title').textContent = `Řešení nedostatku: ${surovina.name}`;
    modal.querySelector('#surovina-shortage-adjust-weight-btn').dataset.surovinaId = surovinaId;
    
    const date = appState.ui.selectedDate;
    const stockPallets = surovina.stock || 0;
    const stockBoxes = appState.dailyStockAdjustments[date]?.[surovinaId] || 0;

    // Find all related items
    const relatedSurovinaIds = new Set([surovinaId]);
    appState.products.forEach(p => {
        if (p.surovinaId === surovinaId) relatedSurovinaIds.add(p.id);
    });
    appState.suroviny.forEach(s => {
        if (s.isMix) {
            const mixDef = appState.mixDefinitions[s.id];
            if (mixDef?.components.some(c => c.surovinaId === surovinaId)) {
                relatedSurovinaIds.add(s.id);
            }
        }
    });
     if (surovina.name.toUpperCase() === 'PRSA') {
        const rizky = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
        if (rizky) relatedSurovinaIds.add(rizky.id);
    }
    if (surovina.name.toUpperCase() === 'STEHNA') {
        const steak = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
        if (steak) relatedSurovinaIds.add(steak.id);
    }

    const consumingItems = [];
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.isActive && relatedSurovinaIds.has(item.surovinaId)) {
                consumingItems.push({ ...item, orderId: order.id, customerId: order.customerId });
            }
        });
    });

    let orderRowsHtml = '';
    if (consumingItems.length > 0) {
        consumingItems.forEach(item => {
            const customer = appState.zakaznici.find(c => c.id === item.customerId);
            const itemSurovina = appState.suroviny.find(s => s.id === item.surovinaId);
            const isDone = item.doneCount >= item.boxCount;

            orderRowsHtml += `
                <tr class="${isDone ? 'done' : ''}">
                    <td>${customer?.name || '?'}</td>
                    <td>${itemSurovina?.name || '?'}</td>
                    <td>${item.type}</td>
                    <td>${item.boxCount}</td>
                    <td><input type="number" class="shortage-done-count-input" value="${item.doneCount || ''}" data-order-id="${item.orderId}" data-item-id="${item.id}" min="0" max="${item.boxCount}" style="width: 80px;"></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-success" data-action="mark-shortage-item-done" data-order-id="${item.orderId}" data-item-id="${item.id}">Hotovo</button>
                        <button class="btn btn-sm btn-danger" data-action="open-shorten-order-modal" data-order-id="${item.orderId}" data-item-id="${item.id}">Pokrátit</button>
                    </td>
                </tr>
            `;
        });
    } else {
        orderRowsHtml = '<tr><td colspan="6" style="text-align: center;">Žádné objednávky pro tuto surovinu.</td></tr>';
    }

    const body = modal.querySelector('#surovina-shortage-body');
    body.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Sklad</h3></div>
            <div class="card-content">
                <div class="form-row">
                    <div class="form-field">
                        <label>Palety na skladě</label>
                        <input type="number" class="shortage-stock-input" value="${stockPallets}" data-surovina-id="${surovinaId}" data-type="pallets">
                    </div>
                    <div class="form-field">
                        <label>Bedny na skladě</label>
                        <input type="number" class="shortage-stock-input" value="${stockBoxes}" data-surovina-id="${surovinaId}" data-type="boxes">
                    </div>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3 class="card-title">Objednávky spotřebovávající surovinu</h3></div>
            <div class="card-content">
                <table class="data-table">
                    <thead><tr><th>Zákazník</th><th>Produkt</th><th>Typ</th><th>Objednáno</th><th>Hotovo</th><th class="actions">Akce</th></tr></thead>
                    <tbody>${orderRowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    feather.replace();
}

export function handleShortageStockChange(target) {
    const { surovinaId, type } = target.dataset;
    const value = parseFloat(target.value) || 0;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    
    if (surovina) {
        if (type === 'pallets') {
            surovina.stock = value;
        } else if (type === 'boxes') {
            const date = appState.ui.selectedDate;
            if (!appState.dailyStockAdjustments[date]) {
                appState.dailyStockAdjustments[date] = {};
            }
            appState.dailyStockAdjustments[date][surovinaId] = value;
        }
        saveState();
        renderMainPage();
        openSurovinaShortageModal(surovinaId); // Re-render modal to reflect changes
    }
}

export function handleShortageDoneCountChange(target) {
    const { orderId, itemId } = target.dataset;
    const value = parseInt(target.value) || 0;
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    
    if (item) {
        item.doneCount = Math.min(value, item.boxCount); // Cap at max order
        saveState();
        renderMainPage(); // To update alerts
        const surovinaId = DOMElements.surovinaShortageModal.querySelector('.shortage-stock-input').dataset.surovinaId;
        openSurovinaShortageModal(surovinaId); // Re-render modal
    }
}

export function markShortageItemDone(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (item) {
        item.doneCount = item.boxCount;
        saveState();
        renderMainPage();
        const surovinaId = DOMElements.surovinaShortageModal.querySelector('.shortage-stock-input').dataset.surovinaId;
        openSurovinaShortageModal(surovinaId);
    }
}

export function openShortenOrderModal(orderId, itemId) {
    const modal = DOMElements.shortenOrderModal;
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);

    if (!order || !item) {
        showToast('Položka objednávky nenalezena.', 'error');
        return;
    }
    
    const shortageSurovinaId = DOMElements.surovinaShortageModal.dataset.surovinaId;
    if (!shortageSurovinaId) {
        showToast('Nelze určit chybějící surovinu. Zkuste to znovu.', 'error');
        return;
    }
    const shortageSurovina = appState.suroviny.find(s => s.id === shortageSurovinaId);

    const date = appState.ui.selectedDate;
    
    // 1. Calculate Total Available
    const stockKg = (shortageSurovina.stock || 0) * (shortageSurovina.paletteWeight || 0) 
                  + (appState.dailyStockAdjustments[date]?.[shortageSurovinaId] || 0) * (shortageSurovina.boxWeight || 25);
    
    const calculationResults = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData } = calculateYieldData(date, dailyData?.flocks, calculationResults.totals.totalWeight);
    
    let productionKg = 0;
    const yieldInfo = yieldData.find(d => d.name.toUpperCase().replace(' (SKELETY)', '') === shortageSurovina.name.toUpperCase().replace(' (SKELETY)', ''));
    if (yieldInfo) {
        productionKg = yieldInfo.produced || 0;
    }
    const totalAvailableKg = stockKg + productionKg;

    // 2. Calculate Total Needed for this specific surovina across all orders for the day
    const allNeeds = getDailyNeeds(date, null, true); // true to get total demand regardless of production status
    const totalNeededKg = allNeeds[shortageSurovinaId] || 0;
    
    // 3. Calculate suggestion
    const deficitKg = totalNeededKg > totalAvailableKg ? totalNeededKg - totalAvailableKg : 0;
    const coverageRatio = totalNeededKg > 0 ? Math.min(1, totalAvailableKg / totalNeededKg) : 1;
    const suggestedBoxCount = Math.floor(item.boxCount * coverageRatio);

    // --- UPDATE MODAL UI ---
    modal.dataset.orderId = orderId;
    modal.dataset.itemId = itemId;

    const itemSurovina = appState.suroviny.find(s => s.id === item.surovinaId);
    modal.querySelector('#shorten-order-title').textContent = `Pokrátit: ${itemSurovina.name}`;
    
    const calcContainer = modal.querySelector('#shorten-order-calculation');
    calcContainer.innerHTML = `
        <p>Celkem dostupné <strong>${shortageSurovina.name}</strong>: <strong>${totalAvailableKg.toFixed(2)} kg</strong> (Sklad: ${stockKg.toFixed(2)} + Výroba: ${productionKg.toFixed(2)})</p>
        <p>Celková potřeba na všechny objednávky: <strong>${totalNeededKg.toFixed(2)} kg</strong></p>
        <p class="shortage">Chybí celkem: <strong>${deficitKg.toFixed(2)} kg</strong></p>
    `;

    modal.querySelector('#shorten-order-original-amount').textContent = `${item.boxCount} beden`;
    const newAmountInput = modal.querySelector('#shorten-order-new-amount');
    newAmountInput.value = suggestedBoxCount;
    newAmountInput.max = item.boxCount;

    const applyBtn = modal.querySelector('#apply-suggested-boxes-btn');
    applyBtn.textContent = `Použít navrhované (${suggestedBoxCount})`;
    applyBtn.onclick = () => {
        newAmountInput.value = suggestedBoxCount;
    };

    modal.classList.add('active');
}


export function saveShortenedOrder() {
    const modal = DOMElements.shortenOrderModal;
    const { orderId, itemId } = modal.dataset;
    const newAmount = parseInt(modal.querySelector('#shorten-order-new-amount').value);

    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);

    if (item && !isNaN(newAmount) && newAmount >= 0) {
        item.boxCount = newAmount;
        if (item.doneCount > newAmount) {
            item.doneCount = newAmount;
        }
        saveState();
        showToast('Objednávka byla pokrácena.');
        modal.classList.remove('active');
        renderMainPage();
        const surovinaId = DOMElements.surovinaShortageModal.querySelector('.shortage-stock-input').dataset.surovinaId;
        openSurovinaShortageModal(surovinaId);
    } else {
        showToast('Chyba: Zadejte platné číslo.', 'error');
    }
}

export function openSingleStockAdjustmentModal(surovinaId) {
    const modal = DOMElements.stockAdjustmentModal;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    if (!surovina) return;

    modal.dataset.surovinaId = surovinaId;

    const date = appState.ui.selectedDate;
    const stockPallets = surovina.stock || 0;
    const stockBoxes = appState.dailyStockAdjustments[date]?.[surovinaId] || 0;

    modal.querySelector('#single-stock-adjustment-title').textContent = `Upravit sklad: ${surovina.name}`;
    modal.querySelector('#single-stock-palettes').value = stockPallets;
    modal.querySelector('#single-stock-boxes').value = stockBoxes;

    modal.classList.add('active');
}

export function saveSingleStockAdjustment() {
    const modal = DOMElements.stockAdjustmentModal;
    const surovinaId = modal.dataset.surovinaId;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    if (!surovina) return;

    const date = appState.ui.selectedDate;
    const newPalettes = parseFloat(modal.querySelector('#single-stock-palettes').value) || 0;
    const newBoxes = parseInt(modal.querySelector('#single-stock-boxes').value) || 0;

    surovina.stock = newPalettes;

    if (!appState.dailyStockAdjustments[date]) {
        appState.dailyStockAdjustments[date] = {};
    }
    appState.dailyStockAdjustments[date][surovinaId] = newBoxes;

    saveState();
    modal.classList.remove('active');
    showToast('Sklad byl upraven.');
    renderMainPage();
}

export function openAddPreProductionModal() {
    const modal = DOMElements.addPreProductionModal;
    const customerSelect = modal.querySelector('#direct-pre-prod-customer');
    const surovinaSelect = modal.querySelector('#direct-pre-prod-surovina');
    const dateInput = modal.querySelector('#direct-pre-prod-date');
    const boxesInput = modal.querySelector('#direct-pre-prod-boxes');

    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    surovinaSelect.innerHTML = appState.suroviny.filter(s => s.isActive && !s.isMix).map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    dateInput.value = appState.ui.selectedDate;
    boxesInput.value = '';

    modal.classList.add('active');
}

export function saveDirectPreProduction() {
    const modal = DOMElements.addPreProductionModal;
    const customerId = modal.querySelector('#direct-pre-prod-customer').value;
    const surovinaId = modal.querySelector('#direct-pre-prod-surovina').value;
    const type = modal.querySelector('#direct-pre-prod-type').value;
    const boxCount = parseInt(modal.querySelector('#direct-pre-prod-boxes').value, 10);
    const date = modal.querySelector('#direct-pre-prod-date').value;

    if (!customerId || !surovinaId || !type || !boxCount || boxCount <= 0 || !date) {
        showToast('Vyplňte prosím všechna pole.', 'error');
        return;
    }
    
    let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
    if (!order) {
        order = { id: generateId(), date: date, customerId: customerId, items: [] };
        appState.orders.push(order);
    }

    let item = order.items.find(i => i.surovinaId === surovinaId && i.type === type);
    if (item) {
        item.boxCount += boxCount;
    } else {
        order.items.push({ 
            id: generateId(), 
            surovinaId: surovinaId, 
            boxCount: boxCount, 
            isActive: true, 
            type: type, 
            doneCount: 0 
        });
    }

    saveState();
    showToast(`${boxCount} beden přidáno jako požadavek do objednávek.`, 'success');
    modal.classList.remove('active');
    render();
}

export function handlePreProductionDoneChange(target) {
    const { actionId, date } = target.dataset;
    const action = appState.plannedActions.find(a => a.id === actionId);
    if (!action || !action.dailyCounts[date]) return;

    const dayData = action.dailyCounts[date];
    const oldValue = dayData.producedCount || 0;
    const newValue = Math.min(parseInt(target.value, 10) || 0, dayData.boxCount);
    
    if (newValue !== oldValue) {
        const boxesChanged = newValue - oldValue; // Positive if production increased
        updateStockForPreProduction(action, boxesChanged);
        dayData.producedCount = newValue;
        saveState();
        renderMainPage();
    }
}

export function markPreProductionDone(target) {
    const { actionId, date } = target.dataset;
    const action = appState.plannedActions.find(a => a.id === actionId);
    if (!action || !action.dailyCounts[date]) return;
    
    const dayData = action.dailyCounts[date];
    const oldValue = dayData.producedCount || 0;
    const newValue = dayData.boxCount;

    if (newValue > oldValue) {
        const boxesChanged = newValue - oldValue;
        updateStockForPreProduction(action, boxesChanged);
        dayData.producedCount = newValue;
        saveState();
        renderMainPage();
        showToast('Předvýroba označena jako hotová a suroviny odečteny.', 'success');
    }
}

export function dismissPriceChangeAlert(changeId) {
    if (!appState.dismissedPriceChangeAlerts.includes(changeId)) {
        appState.dismissedPriceChangeAlerts.push(changeId);
        saveState();
        renderMainPage();
    }
}