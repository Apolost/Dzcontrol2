/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { getWeekNumber } from './utils.ts';
import { showToast, showAutoSaveNotification } from './ui.ts';

export let appState = {};
const APP_DATA_KEY = 'surovinyAppData_v13';

export function saveState() {
    const stateToSave = { ...appState };
    delete stateToSave.ui; 
    localStorage.setItem(APP_DATA_KEY, JSON.stringify(stateToSave));
}

function setupDefaultData() {
    const specialMaterials = ['JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY'];
    appState.suroviny = [
        {id: 's01', name: 'ŘÍZKY', isActive: true}, {id: 's02', name: 'STRIPS', isActive: true}, {id: 's03', name: 'PRSA', isActive: true},
        {id: 's04', name: 'HRBETY', isActive: true}, {id: 's05', name: 'PRDELE', isActive: true}, {id: 's06', name: 'HORNÍ STEHNA', isActive: true},
        {id: 's07', name: 'SPODNÍ STEHNA', isActive: true}, {id: 's08', name: 'ČTVRTKY', isActive: true}, {id: 's09', name: 'KŘÍDLA', isActive: true},
        {id: 's10', name: 'STEHNA', isActive: true},
        {id: 's12', name: 'STEAK', isActive: true},
        {id: 's13', name: 'JÁTRA', isActive: true}, {id: 's14', name: 'SRDCE', isActive: true}, {id: 's15', name: 'ŽALUDKY', isActive: true}, {id: 's16', name: 'KRKY', isActive: true},
    ].map(s => ({ 
        ...s, 
        paletteWeight: 500, 
        boxWeight: specialMaterials.includes(s.name.toUpperCase()) ? 20 : 25,
        stock: 0, 
        isMix: false, 
        isProduct: false 
    }));

    appState.zakaznici = [
        {id: 'c1', name: 'Ahold', stabilizedAmount: 0}, {id: 'c2', name: 'Billa', stabilizedAmount: 0}, {id: 'c3', name: 'Tesco', stabilizedAmount: 0},
        {id: 'c4', name: 'Kaufland', stabilizedAmount: 0}, {id: 'c5', name: 'Lidl', stabilizedAmount: 0}, {id: 'c6', name: 'Rohlik', stabilizedAmount: 0}
    ];

    // Add minced meat surovina so it's available for boxWeights
    appState.suroviny.push({ id: 'surovina_minced', name: 'MLETÉ MASO', isMix: true, isActive: true, paletteWeight: 0, stock: 0, isProduct: false });

    appState.boxWeights = {};
    // These weights now apply to RB packaging for Ahold
    const aholdWeightsRB = {
        'ŘÍZKY': 3000,
        'PRSA': 4000,
        'STEHNA': 3000,
        'ČTVRTKY': 2400,
        'HORNÍ STEHNA': 3000,
        'SPODNÍ STEHNA': 2800,
        'KŘÍDLA': 2800,
        'STEAK': 1920,
        'JÁTRA': 2000,
        'SRDCE': 1600,
        'ŽALUDKY': 1600,
        'KRKY': 2000
    };

    const kauflandWeightsRB = {
        'PRSA': 4000,       // 1000g * 4
        'STEHNA': 4400,     // 1100g * 4
        'ČTVRTKY': 4400,    // 1100g * 4
        'HORNÍ STEHNA': 3200, // 800g * 4
        'SPODNÍ STEHNA': 3200, // 800g * 4
        'KŘÍDLA': 4000,     // 1000g * 4
    };

    const kauflandWeightsOA = {
        'STEHNA': 4800,      // 600g * 8
        'HORNÍ STEHNA': 4000,  // 500g * 8
        'SPODNÍ STEHNA': 4000, // 500g * 8
        'KŘÍDLA': 4000,      // 500g * 8
        'STEAK': 3200,       // 400g * 8
        'JÁTRA': 4000,       // 500g * 8
        'SRDCE': 3200,       // 400g * 8
        'ŽALUDKY': 3200,     // 400g * 8
        'KRKY': 4000,        // 500g * 8
    };

    appState.zakaznici.forEach(c => {
        appState.boxWeights[c.id] = {};
        appState.suroviny.forEach(s => {
            if (c.name === 'Ahold') {
                if (s.id === 'surovina_minced') {
                    // For Ahold, OA is only Minced Meat 500g x 8 = 4000g. Other types are deactivated (weight 0).
                    appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 0, VL: 0, isActive: true };
                } else {
                    // For other products, only RB is active with specific weights. OA and VL are deactivated (weight 0).
                    const rbWeight = aholdWeightsRB[s.name] || 0;
                    // Product is active for the customer only if it has a valid packaging weight.
                    appState.boxWeights[c.id][s.id] = { OA: 0, RB: rbWeight, VL: 0, isActive: rbWeight > 0 };
                }
            } else if (c.name === 'Kaufland') {
                if (s.id === 'surovina_minced') {
                    // Not specified for Kaufland, so keep default VL and deactivate others
                    appState.boxWeights[c.id][s.id] = { OA: 0, RB: 0, VL: 4000, isActive: true };
                } else {
                    const rbWeight = kauflandWeightsRB[s.name] || 0;
                    const oaWeight = kauflandWeightsOA[s.name] || 0;
                    const vlWeight = 10000; // Default VL for non-minced
                    const isActive = (oaWeight > 0 || rbWeight > 0 || vlWeight > 0);

                    appState.boxWeights[c.id][s.id] = { 
                        OA: oaWeight, 
                        RB: rbWeight, 
                        VL: vlWeight, 
                        isActive: isActive
                    };
                }
            } else { // For all other customers, use the standard defaults
                if (s.id === 'surovina_minced') {
                    appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 4000, isActive: true };
                } else {
                    appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
                }
            }
        });
    });

    appState.orders = [];
    appState.mixDefinitions = {};
    appState.mincedMeatStabilizedDefaults = {};
    appState.savedEstimates = {};

    // Add minced meat mix definition
    const steakSurovina = appState.suroviny.find(s => s.name === 'STEAK');
    if (steakSurovina) {
        appState.mixDefinitions['surovina_minced'] = { components: [{ surovinaId: steakSurovina.id, percentage: 100, loss: 0 }] };
    }

    appState.plannedActions = [];
    appState.products = [];
    appState.changes = [];
    appState.maykawaConfig = { bonePercent: 15, skinPercent: 10, deboningSpeed: 100 };
    appState.rizkyConfig = { prepad: 0, linePerformance: 2500, mastna: 0, stock: 0, startTime: '06:00' };
    
    appState.kfcSuroviny = [
        {id: 'kfc_s_01', name: 'rizky kfc', stockBoxes: 0, boxWeight: 10000},
        {id: 'kfc_s_02', name: 'placky bandury', stockBoxes: 0, boxWeight: 10000},
        {id: 'kfc_s_03', name: 'strips kfc', stockBoxes: 0, boxWeight: 10000},
        {id: 'kfc_s_04', name: 'kuře celé', stockBoxes: 0, boxWeight: 10000},
        {id: 'kfc_s_05', name: 'horní stehna', stockBoxes: 0, boxWeight: 10000},
        {id: 'kfc_s_06', name: 'spodní stehna', stockBoxes: 0, boxWeight: 10000}
    ];
    appState.kfcProducts = [
        {id: 'kfc_p_01', name: '9řez', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
        {id: 'kfc_p_02', name: 'strips', boxWeight: 10000, requiredSurovinaId: 'kfc_s_03', minutesPerBox: 10},
        {id: 'kfc_p_03', name: 'křídla', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
        {id: 'kfc_p_04', name: 'spodní stehna', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
        {id: 'kfc_p_05', name: 'steak', boxWeight: 10000, requiredSurovinaId: 'kfc_s_01', minutesPerBox: 10},
        {id: 'kfc_p_06', name: 'fillet', boxWeight: 10000, requiredSurovinaId: 'kfc_s_01', minutesPerBox: 10},
    ];
    appState.kfcOrders = {};
    appState.spizyOrders = {};
    appState.spizyIngredientOrders = [];
    appState.spizyStock = { paprika: 0, cibule: 0, spek: 0, klobasa: 0, steak: 0 };
    appState.spizyConfig = {
        spek: { spek: 60, klobasa: 20, cibule: 20, steak: 0, paprika: 0 },
        klobasa: { steak: 20, klobasa: 60, cibule: 20, paprika: 0 }
    };
    appState.quickEntryStatus = {};
    appState.dailyStockAdjustments = {};
    appState.temporaryBoxWeights = {};
    appState.lineSettings = { speed: 10000 };
    appState.chickenCounts = {};
    appState.productionEvents = {};
    appState.calibrationSettings = {
        rizky: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
        stehna: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
        ctvrtky: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
        kridla: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
    };
    appState.yieldSettings = {
        prsa: 25,
        stehnaCelkem: 25,
        kridla: 8,
        zadniDily: 12,
        kuze: 12,
        kosti: 18,
        jatra: 1.8,
        srdce: 0.7,
        zaludky: 2.0,
        krky: 3.0
    };
    appState.yieldAdjustments = {};
    appState.thighSplitSettings = { upperThighPercent: 55, lowerThighPercent: 45 };
    appState.portioningSettings = {
        packagingToPortioningPercent: 95,
        portioningDeviation: -100
    };
    appState.qrCodes = [];
}

export function loadState() {
    const savedState = localStorage.getItem(APP_DATA_KEY);
    if (savedState) {
        appState = JSON.parse(savedState);
        
        // --- MIGRATION LOGIC ---
        if (appState.savedEstimate && !appState.savedEstimates) {
            // Simple migration for savedEstimate to savedEstimates
            const d = new Date();
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            appState.savedEstimates = { [key]: appState.savedEstimate };
            delete appState.savedEstimate;
        }

        if (!appState.suroviny) setupDefaultData(); // Full reset if core data is missing

        // Minced meat migration
        if (!appState.suroviny.find(s => s.id === 'surovina_minced')) {
             const steakSurovina = appState.suroviny.find(s => s.name === 'STEAK');
             if (steakSurovina) {
                appState.suroviny.push({ id: 'surovina_minced', name: 'MLETÉ MASO', isMix: true, isActive: true, paletteWeight: 0, stock: 0, isProduct: false });
                appState.mixDefinitions['surovina_minced'] = { components: [{ surovinaId: steakSurovina.id, percentage: 100, loss: 0 }] };
                appState.zakaznici.forEach(c => {
                    if (appState.boxWeights[c.id]) {
                        appState.boxWeights[c.id]['surovina_minced'] = { OA: 4000, RB: 4000, VL: 4000, isActive: true };
                    }
                });
             }
        }
        
        // Customer stabilization amount migration
        if(appState.zakaznici) {
            appState.zakaznici.forEach(c => {
                if (c.stabilizedAmount === undefined) {
                    c.stabilizedAmount = 0;
                }
            });
        }


        // Ensure all top-level properties exist to prevent errors with older save files
        if (!appState.orders) appState.orders = [];
        if (!appState.mixDefinitions) appState.mixDefinitions = {};
        if (!appState.mincedMeatStabilizedDefaults) appState.mincedMeatStabilizedDefaults = {};
        if (!appState.savedEstimates) appState.savedEstimates = {};
        if (!appState.plannedActions) appState.plannedActions = [];
        if (!appState.changes) appState.changes = [];
        if (!appState.dailyStockAdjustments) appState.dailyStockAdjustments = {};
        if (!appState.temporaryBoxWeights) appState.temporaryBoxWeights = {};
        if (!appState.lineSettings) appState.lineSettings = { speed: 10000 };
        if (!appState.chickenCounts) appState.chickenCounts = {};
        if (!appState.productionEvents) appState.productionEvents = {};
        if (!appState.qrCodes) appState.qrCodes = [];
        if (!appState.calibrationSettings) {
            appState.calibrationSettings = {
                rizky: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
                stehna: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
                ctvrtky: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
                kridla: Array(7).fill({ chickenWeight: '', productCaliber: '' }),
            };
        }
        if (appState.plannedActions) {
            appState.plannedActions.forEach(action => {
                if (action.dailyCounts) {
                    Object.keys(action.dailyCounts).forEach(date => {
                        const count = action.dailyCounts[date];
                        if (typeof count === 'number') {
                            action.dailyCounts[date] = {
                                boxCount: count,
                                producedCount: 0 
                            };
                        }
                    });
                }
            });
        }
        if (!appState.yieldSettings) {
             appState.yieldSettings = {
                prsa: 25, stehnaCelkem: 25, kridla: 8, zadniDily: 12, kuze: 12, kosti: 18, jatra: 1.8, srdce: 0.7, zaludky: 2.0, krky: 3.0
            };
        } else {
            // Migrate from old thigh structure to new stehnaCelkem
            if (appState.yieldSettings.stehnaCelkem === undefined) {
                const oldThighsTotal = (appState.yieldSettings.horniStehna || 0) + 
                                       (appState.yieldSettings.spodniStehna || 0) + 
                                       (appState.yieldSettings.stehna || 0) + 
                                       (appState.yieldSettings.ctvrtky || 0);
                appState.yieldSettings.stehnaCelkem = oldThighsTotal > 0 ? oldThighsTotal : 25;
                delete appState.yieldSettings.horniStehna;
                delete appState.yieldSettings.spodniStehna;
                delete appState.yieldSettings.stehna;
                delete appState.yieldSettings.ctvrtky;
            }

            if (appState.yieldSettings.zadniDily === undefined && appState.yieldSettings.hrbety !== undefined) {
                appState.yieldSettings.zadniDily = appState.yieldSettings.hrbety;
                delete appState.yieldSettings.hrbety;
            }
            if (appState.yieldSettings.kuze === undefined) appState.yieldSettings.kuze = 12;
            if (appState.yieldSettings.kosti === undefined) appState.yieldSettings.kosti = 18;
            if (appState.yieldSettings.jatra === undefined) appState.yieldSettings.jatra = 1.8;
            if (appState.yieldSettings.srdce === undefined) appState.yieldSettings.srdce = 0.7;
            if (appState.yieldSettings.zaludky === undefined) appState.yieldSettings.zaludky = 2.0;
            if (appState.yieldSettings.krky === undefined) appState.yieldSettings.krky = 3.0;
        }
        if (!appState.yieldAdjustments) appState.yieldAdjustments = {};
        if (!appState.thighSplitSettings) {
            appState.thighSplitSettings = { upperThighPercent: 55, lowerThighPercent: 45 };
        }
        if (!appState.portioningSettings) {
            appState.portioningSettings = {
                packagingToPortioningPercent: 95,
                portioningDeviation: -100
            };
        }
        
        // Migrate chickenCounts to the new structure with startTime, delays and flock names
        if (appState.chickenCounts) {
            Object.keys(appState.chickenCounts).forEach(date => {
                const dailyData = appState.chickenCounts[date];
                if (dailyData && Array.isArray(dailyData.flocks)) {
                    if (dailyData.startTime === undefined) dailyData.startTime = '06:00';
                    if (dailyData.delayHours === undefined) dailyData.delayHours = 0;
                    if (dailyData.delayMinutes === undefined) dailyData.delayMinutes = 0;
                    
                    dailyData.flocks.forEach((flock, index) => {
                        if (flock.name === undefined) flock.name = `Chov ${index + 1}`;
                    });
                }
            });
        }
        
        delete appState.rizkyDoneStatus; // Remove obsolete property
        delete appState.settings; // Remove obsolete password settings

        const specialMaterials = ['JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY'];
        appState.suroviny.forEach(s => {
            if (s.isActive === undefined) s.isActive = true;
            if (s.isProduct === undefined) s.isProduct = false;
            if (s.boxWeight === undefined) {
                s.boxWeight = specialMaterials.includes(s.name.toUpperCase()) ? 20 : 25;
            }
        });
        if (!appState.products) appState.products = [];
        appState.products.forEach(p => {
            if(p.showInQuickEntry === undefined) p.showInQuickEntry = false;
            if(p.packagingType === undefined) p.packagingType = 'VL';
            if(p.isOther === undefined) p.isOther = false;
        });
        if (appState.orders) {
            const mincedMeatSurovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
            if (mincedMeatSurovina) {
                const mincedMeatId = mincedMeatSurovina.id;
                appState.orders.forEach(order => {
                    order.items.forEach(item => {
                        if (item.surovinaId === mincedMeatId) {
                            if (item.isStabilized === undefined) {
                                item.isStabilized = false;
                            }
                            // Migrate old g500/g1000 types to standard 4kg boxes
                            if (item.type === 'g500' || item.type === 'g1000') {
                                const weightPerPiece = item.type === 'g500' ? 0.5 : 1.0;
                                const totalKg = item.boxCount * weightPerPiece;
                                const newBoxCount = Math.round(totalKg / 4); // 4kg per box
                                item.boxCount = newBoxCount > 0 ? newBoxCount : 1;
                                item.type = 'VL';
                            }
                        }
                    });
                });
            }

            appState.orders.forEach(order => {
                order.items.forEach(item => {
                    if (!item.type) {
                        item.type = 'VL';
                    }
                    // MIGRATION: from isDone (boolean) to doneCount (number)
                    if (item.doneCount === undefined) {
                        if (item.isDone === true) {
                            item.doneCount = item.boxCount;
                        } else {
                            item.doneCount = item.doneCount || 0;
                        }
                    }
                    delete item.isDone;
                });
            });
        }
        if (appState.zakaznici && appState.suroviny && appState.boxWeights) {
            appState.zakaznici.forEach(c => {
                if (appState.boxWeights[c.id]) {
                    appState.suroviny.forEach(s => {
                         if (s.id === 'surovina_minced' && (appState.boxWeights[c.id][s.id]?.g500 || appState.boxWeights[c.id][s.id]?.g1000)) {
                            appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 4000, isActive: true };
                        }
                        const weightData = appState.boxWeights[c.id][s.id];
                        if (typeof weightData === 'number' || weightData === undefined || !('isActive' in weightData) ) {
                            const oldWeight = (typeof weightData === 'number') ? weightData : (weightData?.VL || 10000);
                            appState.boxWeights[c.id][s.id] = { 
                                OA: (weightData?.OA !== undefined) ? weightData.OA : 4000, 
                                RB: (weightData?.RB !== undefined) ? weightData.RB : 4000, 
                                VL: (weightData?.VL !== undefined) ? weightData.VL : 10000, 
                                isActive: (weightData?.isActive !== undefined) ? weightData.isActive : true 
                            };
                        }
                    });
                } else {
                     appState.boxWeights[c.id] = {};
                     appState.suroviny.forEach(s => {
                        if (s.id === 'surovina_minced') {
                             appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 4000, isActive: true };
                        } else {
                             appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
                        }
                     });
                }
            });
        }
        if (!appState.maykawaConfig) {
            appState.maykawaConfig = { bonePercent: 15, skinPercent: 10, deboningSpeed: 100 };
        }
        if (appState.maykawaConfig.deboningSpeed === undefined) {
            appState.maykawaConfig.deboningSpeed = 100;
        }
         if (!appState.rizkyConfig) {
            appState.rizkyConfig = { prepad: 0, linePerformance: 2500, mastna: 0, stock: 0, startTime: '06:00' };
        }
        if (!appState.kfcSuroviny) {
            appState.kfcSuroviny = [
                {id: 'kfc_s_01', name: 'rizky kfc', stockBoxes: 0, boxWeight: 10000},
                {id: 'kfc_s_02', name: 'placky bandury', stockBoxes: 0, boxWeight: 10000},
                {id: 'kfc_s_03', name: 'strips kfc', stockBoxes: 0, boxWeight: 10000},
                {id: 'kfc_s_04', name: 'kuře celé', stockBoxes: 0, boxWeight: 10000},
                {id: 'kfc_s_05', name: 'horní stehna', stockBoxes: 0, boxWeight: 10000},
                {id: 'kfc_s_06', name: 'spodní stehna', stockBoxes: 0, boxWeight: 10000}
            ];
        } else {
             if (!appState.kfcSuroviny.find(s => s.name === 'horní stehna')) {
                appState.kfcSuroviny.push({id: 'kfc_s_05', name: 'horní stehna', stockBoxes: 0, boxWeight: 10000});
            }
            if (!appState.kfcSuroviny.find(s => s.name === 'spodní stehna')) {
                appState.kfcSuroviny.push({id: 'kfc_s_06', name: 'spodní stehna', stockBoxes: 0, boxWeight: 10000});
            }
        }
         if (!appState.kfcProducts) {
            appState.kfcProducts = [
                {id: 'kfc_p_01', name: '9řez', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
                {id: 'kfc_p_02', name: 'strips', boxWeight: 10000, requiredSurovinaId: 'kfc_s_03', minutesPerBox: 10},
                {id: 'kfc_p_03', name: 'křídla', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
                {id: 'kfc_p_04', name: 'spodní stehna', boxWeight: 10000, requiredSurovinaId: 'kfc_s_04', minutesPerBox: 10},
                {id: 'kfc_p_05', name: 'steak', boxWeight: 10000, requiredSurovinaId: 'kfc_s_01', minutesPerBox: 10},
                {id: 'kfc_p_06', name: 'fillet', boxWeight: 10000, requiredSurovinaId: 'kfc_s_01', minutesPerBox: 10},
            ];
        } else {
            appState.kfcProducts.forEach(p => {
                if (p.minutesPerBox === undefined) {
                    p.minutesPerBox = 10;
                }
            });
        }
        if (!appState.kfcOrders) {
             appState.kfcOrders = {};
        }
        if (appState.kfcOrders) {
            Object.values(appState.kfcOrders).forEach(orderDay => {
                if (orderDay.addedStaff === undefined) orderDay.addedStaff = 0;
                if (orderDay.today) {
                    Object.keys(orderDay.today).forEach(productId => {
                        const orderData = orderDay.today[productId];
                        if (typeof orderData === 'number') {
                            orderDay.today[productId] = { ordered: orderData, produced: 0 };
                        }
                    });
                }
            });
        }
         if (!appState.spizyOrders) appState.spizyOrders = {};
         if (appState.spizyOrders) {
            Object.values(appState.spizyOrders).forEach(dailyOrders => {
                dailyOrders.forEach(order => {
                    if (order.klobasaDone === undefined) order.klobasaDone = 0;
                    if (order.spekDone === undefined) order.spekDone = 0;
                    if (order.cilliDone === undefined) order.cilliDone = 0;
                    if (order.klobasaIsDone === undefined) order.klobasaIsDone = false;
                    if (order.spekIsDone === undefined) order.spekIsDone = false;
                    if (order.cilliIsDone === undefined) order.cilliIsDone = false;
                });
            });
         }
         if (!appState.spizyIngredientOrders) appState.spizyIngredientOrders = [];
         if (!appState.spizyStock) appState.spizyStock = { paprika: 0, cibule: 0, spek: 0, klobasa: 0, steak: 0 };
         if (appState.spizyStock.steak === undefined) appState.spizyStock.steak = 0;

         if (!appState.spizyConfig) {
            appState.spizyConfig = {
                spek: { spek: 60, klobasa: 20, cibule: 20, steak: 0, paprika: 0 },
                klobasa: { steak: 20, klobasa: 60, cibule: 20, paprika: 0 }
            };
        } else {
            // Migration for spizyConfig
            // For Špek skewer, if 'steak' exists from previous version, rename it to 'klobasa'
            if (appState.spizyConfig.spek && appState.spizyConfig.spek.steak !== undefined) {
                // This logic seems reversed, let's keep it as is from previous version to avoid breaking it.
                // It was probably a typo in a previous migration.
                // The new logic correctly handles steak as its own ingredient.
            }
            // Add steak to spek config if missing
             if (appState.spizyConfig.spek && appState.spizyConfig.spek.steak === undefined) {
                appState.spizyConfig.spek.steak = 0;
            }
            if (appState.spizyConfig.spek && appState.spizyConfig.spek.paprika === undefined) {
                appState.spizyConfig.spek.paprika = 0;
            }
            // This part for the Klobása skewer remains the same, ensuring 'spek' becomes 'steak' from older versions
            if (appState.spizyConfig.klobasa && appState.spizyConfig.klobasa.spek !== undefined) {
                appState.spizyConfig.klobasa.steak = appState.spizyConfig.klobasa.spek;
                delete appState.spizyConfig.klobasa.spek;
            }
            if (appState.spizyConfig.klobasa && appState.spizyConfig.klobasa.paprika === undefined) {
                appState.spizyConfig.klobasa.paprika = 0;
            }
        }
        if (!appState.quickEntryStatus) appState.quickEntryStatus = {};


    } else {
        setupDefaultData();
    }
    const today = new Date();
    appState.ui = {
        selectedDate: today.toISOString().split('T')[0],
        activeView: 'main-page',
        editingOrderItemId: null,
        addingToCustomerId: null,
        addingToOrderType: null,
        editingMixId: null,
        editingProductId: null,
        editingChangeId: null,
        editingActionId: null,
        editingSpizyOrderId: null,
        editingSpizyIngredientOrderId: null,
        editingCustomerId: null,
        editingFlockIndex: null,
        openAccordionId: null,
        calculatorItems: [],
        qrScanningContext: { mode: 'none', surovinaId: null, surovinaName: null },
        calendar: {
            year: today.getFullYear(),
            month: today.getMonth(),
        },
    };
}

export function saveDataToFile() {
    saveState(); // Ensure current state is saved to localStorage before downloading.
    const stateToSave = { ...appState };
    delete stateToSave.ui;
    const dataStr = JSON.stringify(stateToSave, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dzcontrol_data.json';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
    showToast('Data byla uložena do souboru.');
}

export function loadDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const loadedState = JSON.parse(event.target.result);
                // Basic validation to check if it's a valid state file
                if (loadedState && loadedState.suroviny && loadedState.zakaznici) {
                    localStorage.setItem(APP_DATA_KEY, JSON.stringify(loadedState));
                    showToast('Data byla úspěšně načtena. Aplikace se aktualizuje.');
                    // Dispatch event to trigger a soft reload in the main script
                    document.body.dispatchEvent(new CustomEvent('appDataLoaded'));
                } else {
                    showToast('Soubor neobsahuje platná data aplikace.', 'error');
                }
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                showToast('Chyba při čtení souboru. Ujistěte se, že je ve formátu JSON.', 'error');
            }
        };
        reader.onerror = () => {
             showToast('Nepodařilo se přečíst soubor.', 'error');
        };
        reader.readAsText(file);
    };

    input.click();
}

export function startAutoSave() {
    setInterval(() => {
        saveState();
        showAutoSaveNotification();
    }, 60000); // 1 minute
}