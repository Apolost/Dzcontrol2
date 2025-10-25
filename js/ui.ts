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
    minusCircle: `<i data-feather="minus-circle"></i>`,
};

// DOMElements is now a mutable object, initialized after modals are loaded.
export let DOMElements = {};

export function initializeDOMElements() {
    DOMElements = {
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
        maykawaAddOrderModal: document.getElementById('maykawa-add-order-modal'),
        productionActionsModal: document.getElementById('production-actions-modal'),
        addMainOrderModal: document.getElementById('add-main-order-modal'),
        addSurovinyModal: document.getElementById('add-suroviny-modal'),
        addChangeModal: document.getElementById('add-change-modal'),
        mixRatioModal: document.getElementById('mix-ratio-modal'),
        addOrderModal: document.getElementById('add-order-modal'),
        planActionModal: document.getElementById('plan-action-modal'),
        dayDetailsModal: document.getElementById('day-details-modal'),
        calculatorAddItemModal: document.getElementById('calculator-add-item-modal'),
        chickenCountModal: document.getElementById('chicken-count-modal'),
        pauseModal: document.getElementById('pause-modal'),
        breakdownModal: document.getElementById('breakdown-modal'),
        batchReductionModal: document.getElementById('batch-reduction-modal'),
        surovinaOverviewModal: document.getElementById('surovina-overview-modal'),
        preProductionModal: document.getElementById('pre-production-modal'),
        addPreProductionModal: document.getElementById('add-pre-production-modal'),
        calibrationSourceModal: document.getElementById('calibration-source-modal'),
        calibrationSetupModal: document.getElementById('calibration-setup-modal'),
        yieldSettingsModal: document.getElementById('yield-settings-modal'),
        thighSplitSettingsModal: document.getElementById('thigh-split-settings-modal'),
        portioningSettingsModal: document.getElementById('portioning-settings-modal'),
        tempWeightModal: document.getElementById('temp-weight-modal'),
        confirmationModal: document.getElementById('confirmation-modal'),
        qrDisplayModal: document.getElementById('qr-display-modal'),
        qrAddToStockModal: document.getElementById('qr-add-to-stock-modal'),
        mincedMeatModal: document.getElementById('minced-meat-modal'),
        addMincedMeatOrderModal: document.getElementById('add-minced-meat-order-modal'),
        estimateModal: document.getElementById('estimate-modal'),
        exportActionsModal: document.getElementById('export-actions-modal'),
        surovinaShortageModal: document.getElementById('surovina-shortage-modal'),
        shortenOrderModal: document.getElementById('shorten-order-modal'),
        surovinaSourceModal: document.getElementById('surovina-source-modal'),
        yieldAdjustmentModal: document.getElementById('yield-adjustment-modal'),
        stockAdjustmentModal: document.getElementById('single-stock-adjustment-modal'),
        toastContainer: document.getElementById('toast-container'),
    };
}


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

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

export function playNotificationSound(type = 'success') {
    if (!audioContext || audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);


    if (type === 'success') { // For calibration match
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
    } else if (type === 'warning') { // For shortage
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}