/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

export const ICONS = {
    trash: `<i data-feather="trash-2"></i>`,
    edit: `<i data-feather="edit-2"></i>`,
    check: `<i data-feather="check-circle"></i>`,
    alert: `<i data-feather="alert-triangle"></i>`,
    eye: `<i data-feather="eye"></i>`,
    eyeOff: `<i data-feather="eye-off"></i>`,
    arrowUp: `<i data-feather="arrow-up"></i>`,
    arrowDown: `<i data-feather="arrow-down"></i>`,
    list: `<i data-feather="list"></i>`,
};

export const DOMElements = {
    appMain: document.getElementById('app-main'),
    navLinks: document.querySelectorAll('.nav-link'),
    selectedDateInput: document.getElementById('selectedDate'),
    // Modals
    rizkyAddOrderModal: document.getElementById('rizky-add-order-modal'),
    spizyIngredientOrderModal: document.getElementById('spizy-ingredient-order-modal'),
    spizyAddOrderModal: document.getElementById('spizy-add-order-modal'),
    spizyStockModal: document.getElementById('spizy-stock-modal'),
    spizyModal: document.getElementById('spizy-modal'),
    rizkyModal: document.getElementById('rizky-modal'),
    kfcStockModal: document.getElementById('kfc-stock-modal'),
    kfcAddOrderModal: document.getElementById('kfc-add-order-modal'),
    kfcStaffModal: document.getElementById('kfc-staff-modal'),
    maykawaModal: document.getElementById('maykawa-modal'),
    addMainOrderModal: document.getElementById('add-main-order-modal'),
    addChangeModal: document.getElementById('add-change-modal'),
    mixRatioModal: document.getElementById('mix-ratio-modal'),
    addOrderModal: document.getElementById('add-order-modal'),
    planActionModal: document.getElementById('plan-action-modal'),
    dayDetailsModal: document.getElementById('day-details-modal'),
    calculatorAddItemModal: document.getElementById('calculator-add-item-modal'),
    confirmationModal: document.getElementById('confirmation-modal'),
    toastContainer: document.getElementById('toast-container'),
};


export function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? ICONS.check : ICONS.alert;
    toast.innerHTML = `${icon} ${message}`;
    DOMElements.toastContainer.appendChild(toast);
    feather.replace();
    setTimeout(() => toast.remove(), 4000);
}
    
export function showConfirmation(message, onConfirm) {
    const modal = DOMElements.confirmationModal;
    
    modal.querySelector('.modal-body').innerHTML = `<p>${message}</p>`;
    modal.classList.add('active');

    const confirmBtn = modal.querySelector('#confirmation-confirm-btn');
    const cancelBtn = modal.querySelector('#confirmation-cancel-btn');

    const confirmHandler = () => {
        onConfirm();
        closeAndCleanup();
    };
    
    const cancelHandler = () => {
        closeAndCleanup();
    };

    function closeAndCleanup() {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    }
    
    confirmBtn.addEventListener('click', confirmHandler, { once: true });
    cancelBtn.addEventListener('click', cancelHandler, { once: true });
}

let autoSaveTimer;
export function showAutoSaveNotification() {
    const indicator = document.getElementById('autosave-indicator');
    if (!indicator) return;

    indicator.textContent = `✓ Uloženo ${new Date().toLocaleTimeString('cs-CZ')}`;
    indicator.classList.add('visible');

    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 3000);
}