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
        {id: 'c1', name: 'Ahold'}, {id: 'c2', name: 'Billa'}, {id: 'c3', name: 'Tesco'},
        {id: 'c4', name: 'Kaufland'}, {id: 'c5', name: 'Lidl'}, {id: 'c6', name: 'Rohlik'}
    ];

    appState.boxWeights = {};
    appState.zakaznici.forEach(c => {
        appState.boxWeights[c.id] = {};
        appState.suroviny.forEach(s => {
            appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
        });
    });

    appState.orders = [];
    appState.mixDefinitions = {};
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
        spek: { spek: 60, klobasa: 20, cibule: 20, steak: 0 },
        klobasa: { steak: 20, klobasa: 60, cibule: 20 }
    };
    appState.quickEntryStatus = {};
    appState.dailyStockAdjustments = {};
}

export function loadState() {
    const savedState = localStorage.getItem(APP_DATA_KEY);
    if (savedState) {
        appState = JSON.parse(savedState);
        
        // --- MIGRATION LOGIC ---
        if (!appState.suroviny) setupDefaultData(); // Full reset if core data is missing
        if (!appState.dailyStockAdjustments) appState.dailyStockAdjustments = {};
        delete appState.rizkyDoneStatus; // Remove obsolete property

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
            appState.orders.forEach(order => {
                order.items.forEach(item => {
                    if (!item.type) {
                        item.type = 'VL';
                    }
                    if (item.isDone === undefined) {
                        item.isDone = false;
                    }
                });
            });
        }
        if (appState.zakaznici && appState.suroviny && appState.boxWeights) {
            appState.zakaznici.forEach(c => {
                if (appState.boxWeights[c.id]) {
                    appState.suroviny.forEach(s => {
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
                        appState.boxWeights[c.id][s.id] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
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
                spek: { spek: 60, klobasa: 20, cibule: 20, steak: 0 },
                klobasa: { steak: 20, klobasa: 60, cibule: 20 }
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
            // This part for the Klobása skewer remains the same, ensuring 'spek' becomes 'steak' from older versions
            if (appState.spizyConfig.klobasa && appState.spizyConfig.klobasa.spek !== undefined) {
                appState.spizyConfig.klobasa.steak = appState.spizyConfig.klobasa.spek;
                delete appState.spizyConfig.klobasa.spek;
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
        openAccordionId: null,
        calculatorItems: [],
        calendar: {
            year: today.getFullYear(),
            month: today.getMonth(),
        },
    };
}

export function saveDataToFile() {
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
    showToast('Data byla uložena.');
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
                    showToast('Data byla úspěšně načtena. Aplikace se restartuje.');
                    setTimeout(() => location.reload(), 1000);
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