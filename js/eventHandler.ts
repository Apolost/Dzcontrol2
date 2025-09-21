/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState, saveDataToFile, loadDataFromFile } from './state.ts';
import { changeDate } from './main.ts';

// Import handlers from all component/settings modules
import * as mainPage from './components/mainPage.ts';
import * as orders from './components/orders.ts';
import * as calendar from './components/calendar.ts';
import * as kfc from './components/kfc.ts';
import * as changes from './components/changes.ts';
import * as spizy from './components/spizy.ts';
import * as modals from './components/modals.ts';
import * as calculator from './components/calculator.ts';
import * as products from './settings/products.ts';
import * as mixes from './settings/mixes.ts';
import * as boxWeights from './settings/boxWeights.ts';
import * as paletteWeights from './settings/paletteWeights.ts';
import * as customers from './settings/customers.ts';


export function bindGlobalEvents() {
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);
    document.body.addEventListener('input', handleGlobalInput);
}

function handleGlobalClick(e) {
    const actionTarget = e.target.closest('[data-action]');
    if (!actionTarget) return;

    const { action, id } = actionTarget.dataset;

    // --- Switch statement to delegate actions ---
    switch (action) {
        // Data Management
        case 'save-data-to-file': saveDataToFile(); break;
        case 'load-data-from-file': loadDataFromFile(); break;
        
        // Date Navigation
        case 'prev-day': changeDate(-1); break;
        case 'next-day': changeDate(1); break;

        // Main Page
        case 'quick-entry-done': mainPage.toggleQuickEntryDone(id); break;
        case 'toggle-spizy-done': mainPage.toggleSpizyDone(actionTarget.dataset.orderId, actionTarget.dataset.type); break;
        case 'toggle-main-page-order-item-done': mainPage.toggleMainPageOrderItemDone(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
        case 'delete-main-page-order-item': mainPage.deleteOrderItemFromMainPage(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;

        // Orders
        case 'add-order-items': orders.openAddOrderModal(id, actionTarget.dataset.orderType); break;
        case 'delete-order-item': orders.deleteOrderItem(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
        case 'edit-mix-ratio': orders.openMixRatioModal(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
        case 'move-order-item': orders.moveOrderItem(actionTarget.dataset.orderId, actionTarget.dataset.itemId, actionTarget.dataset.direction); break;
        case 'toggle-item-active': orders.toggleOrderItemActive(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
        case 'add-main-order': orders.openAddMainOrderModal(actionTarget.dataset.orderCategory); break;
        case 'save-added-items': orders.saveAddedItems(); break;
        case 'save-main-order': orders.saveMainOrder(); break;
        case 'save-mix-ratio': orders.saveMixRatio(); break;

        // Calendar
        case 'prev-month': calendar.changeMonth(-1); break;
        case 'next-month': calendar.changeMonth(1); break;
        case 'open-day-details': calendar.openDayDetailsModal(actionTarget.dataset.date); break;
        case 'plan-action': calendar.openPlanActionModal(); break;
        case 'edit-action': calendar.openPlanActionModal(id); break;
        case 'delete-action': calendar.deletePlannedAction(id); break;
        case 'save-planned-action': calendar.savePlannedAction(); break;
        
        // Changes
        case 'add-change': changes.openAddChangeModal(); break;
        case 'edit-change': changes.openAddChangeModal(id); break;
        case 'delete-change': changes.deleteChange(id); break;
        case 'save-change': changes.saveChange(); break;

        // Calculator
        case 'open-calculator-add-item-modal': calculator.openAddItemModal(); break;
        case 'save-calculator-item': calculator.saveItem(); break;
        case 'delete-calculator-item': calculator.deleteItem(id); break;

        // Settings -> Customers
        case 'save-customer': customers.saveCustomer(); break;
        case 'edit-customer': customers.openCustomerEditor(id); break;
        case 'delete-customer': customers.deleteCustomer(id); break;
        case 'cancel-edit-customer': customers.cancelEditCustomer(); break;

        // Settings -> Products
        case 'edit-product': products.openProductEditor(id); break;
        case 'delete-product': products.deleteProduct(id); break;
        case 'toggle-product-active': products.toggleProductActive(id); break;
        case 'save-caliber': products.saveCaliberAsSurovina(); break;
        case 'save-new-prod': products.saveNewProd(); break;
        case 'cancel-edit-prod': products.cancelEditProd(); break;
        
        // Settings -> Mixes
        case 'delete-new-product-component': mixes.deleteNewProductComponent(actionTarget); break;
        case 'edit-mix': mixes.openMixEditor(id); break;
        case 'delete-mix': mixes.deleteMix(id); break;
        case 'add-new-product-component': mixes.renderNewProductComponents(true); break;
        case 'save-new-product': mixes.saveNewProduct(); break;
        case 'cancel-edit-mix': mixes.cancelEditMix(); break;

        // Settings -> Box Weights
        case 'toggle-box-weight-product-active': boxWeights.toggleBoxWeightProductActive(actionTarget.dataset.customerId, actionTarget.dataset.surovinaId); break;
        case 'save-all-box-weights': boxWeights.saveAllBoxWeights(); break;

        // Settings -> Palette Weights
        case 'save-all-palette-weights': paletteWeights.saveAllPaletteWeights(); break;
        
        // KFC
        case 'open-kfc-add-order': kfc.openKfcAddOrderModal(); break;
        case 'open-kfc-stock': kfc.openKfcStockModal(); break;
        case 'open-kfc-staff-modal': kfc.openKfcStaffModal(); break;
        case 'save-kfc-products': kfc.saveKfcProducts(); break;
        case 'save-kfc-order': kfc.saveKfcOrder(); break;
        case 'save-kfc-stock': kfc.saveKfcStock(); break;
        case 'save-kfc-staff': kfc.saveKfcStaff(); break;

        // Spizy
        case 'open-spizy-modal': spizy.openSpizyModal(); break;
        case 'open-spizy-add-order-modal': spizy.openSpizyAddOrderModal(); break;
        case 'edit-spizy-order': spizy.openSpizyAddOrderModal(id); break;
        case 'delete-spizy-order': spizy.deleteSpizyOrder(id); break;
        case 'open-spizy-stock-modal': spizy.openSpizyStockModal(); break;
        case 'open-spizy-ingredient-order-modal': spizy.openSpizyIngredientOrderModal(); break;
        case 'edit-spizy-ingredient-order': spizy.openSpizyIngredientOrderModal(id); break;
        case 'delete-spizy-ingredient-order': spizy.deleteSpizyIngredientOrder(id); break;
        case 'save-spizy-order': spizy.saveSpizyOrder(); break;
        case 'save-spizy-stock': spizy.saveSpizyStock(); break;
        case 'save-spizy-settings': spizy.saveSpizySettings(); break;
        case 'save-spizy-ingredient-order': spizy.saveSpizyIngredientOrder(); break;
        
        // Standalone Modals
        case 'open-maykawa-modal': modals.openMaykawaModal(); break;
        case 'open-rizky-modal': modals.openRizkyModal(); break;
        case 'open-rizky-add-order-modal': modals.openRizkyAddOrderModal(); break;
        case 'save-rizky-orders': modals.saveRizkyOrders(); break;
        
        // General
        case 'close-modal': actionTarget.closest('.modal').classList.remove('active'); break;
    }
}

function handleGlobalChange(e) {
    const { target } = e;
    if (target.matches('.kfc-produced-input')) {
        kfc.handleKfcProductionChange(target);
    }
    if (target.matches('.kfc-quick-stock-input')) {
        mainPage.handleKfcQuickStockChange(target);
    }
    if (target.matches('.spizy-done-input')) {
        mainPage.handleSpizyDoneChange(target);
    }
    if (target.id === 'calculator-item-surovina' || target.id === 'calculator-item-type') {
        calculator.renderCustomerInputs();
    }
}

function handleGlobalInput(e) {
    if (e.target.matches('.spizy-config-input')) {
        spizy.handleSpizySettingsInput();
    } else if (e.target.id === 'kfc-staff-added') {
        kfc.calculateKfcStaffing();
    }
}