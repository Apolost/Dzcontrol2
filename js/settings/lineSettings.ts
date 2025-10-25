/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { showToast, DOMElements } from '../ui.ts';

export function renderLineSettings() {
    const speedInput = document.getElementById('line-speed');
    if (speedInput) {
        speedInput.value = appState.lineSettings.speed || 5000;
    }
}

export function saveLineSettings() {
    const speedInput = document.getElementById('line-speed');
    const speed = parseInt(speedInput.value, 10);

    if (isNaN(speed) || speed <= 0) {
        showToast('Zadejte prosím platnou rychlost linky.', 'error');
        return;
    }

    appState.lineSettings.speed = speed;
    saveState();
    showToast('Nastavení linky bylo uloženo.');
}


// --- Calibration Settings ---

export function openCalibrationSourceModal() {
    const modal = DOMElements.calibrationSourceModal;
    const body = modal.querySelector('#calibration-source-modal-body');
    body.innerHTML = `
        <button class="btn btn-primary" data-action="open-calibration-setup-modal" data-type="rizky">Řízky</button>
        <button class="btn btn-primary" data-action="open-calibration-setup-modal" data-type="stehna">Stehna</button>
        <button class="btn btn-primary" data-action="open-calibration-setup-modal" data-type="ctvrtky">Čtvrtky</button>
        <button class="btn btn-primary" data-action="open-calibration-setup-modal" data-type="kridla">Křídla</button>
    `;
    modal.classList.add('active');
}

export function openCalibrationSetupModal(surovinaType) {
    const modal = DOMElements.calibrationSetupModal;
    modal.dataset.surovinaType = surovinaType;

    const typeNameMap = {
        rizky: 'Řízky',
        stehna: 'Stehna',
        ctvrtky: 'Čtvrtky',
        kridla: 'Křídla'
    };

    modal.querySelector('#calibration-surovina-name').textContent = typeNameMap[surovinaType] || 'Neznámá surovina';
    
    const body = modal.querySelector('#calibration-setup-modal-body');
    const data = appState.calibrationSettings[surovinaType] || Array(7).fill({ chickenWeight: '', productCaliber: '' });

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Příklad</th>
                    <th>Velikost kuřete (g)</th>
                    <th>Výsledný kalibr (g)</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let i = 0; i < 7; i++) {
        const item = data[i] || { chickenWeight: '', productCaliber: '' };
        tableHTML += `
            <tr>
                <td>${i + 1}</td>
                <td><input type="number" class="chicken-weight-input" value="${item.chickenWeight}" placeholder="např. 2500"></td>
                <td><input type="text" class="product-caliber-input" value="${item.productCaliber}" placeholder="např. 180-200"></td>
            </tr>
        `;
    }

    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;

    DOMElements.calibrationSourceModal.classList.remove('active');
    modal.classList.add('active');
}

export function saveCalibrationSettings() {
    const modal = DOMElements.calibrationSetupModal;
    const surovinaType = modal.dataset.surovinaType;

    if (!surovinaType || !appState.calibrationSettings[surovinaType]) {
        showToast('Chyba: Nebyla vybrána platná surovina.', 'error');
        return;
    }

    const newData = [];
    modal.querySelectorAll('tbody tr').forEach(row => {
        const chickenWeight = row.querySelector('.chicken-weight-input').value;
        const productCaliber = row.querySelector('.product-caliber-input').value.trim();
        newData.push({
            chickenWeight: parseInt(chickenWeight, 10) || '',
            productCaliber: productCaliber,
        });
    });

    appState.calibrationSettings[surovinaType] = newData;
    saveState();
    
    modal.classList.remove('active');
    showToast('Nastavení kalibrace uloženo.');
}

// --- Yield Settings ---

export const YIELD_CONFIG = [
    { key: 'prsa', name: 'Prsa' },
    { key: 'stehnaCelkem', name: 'Stehna (celkem)' },
    { key: 'kridla', name: 'Křídla' },
    { key: 'zadniDily', name: 'Zadní díly (skelety)' },
    { key: 'kuze', name: 'Kůže' },
    { key: 'kosti', name: 'Kosti' },
    { key: 'jatra', name: 'Játra' },
    { key: 'srdce', name: 'Srdce' },
    { key: 'zaludky', name: 'Žaludky' },
    { key: 'krky', name: 'Krky' },
];

function updateYieldTotal() {
    const totalEl = document.getElementById('yield-settings-total');
    if (!totalEl) return;
    let total = 0;
    document.querySelectorAll('#yield-settings-table-body input').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    totalEl.textContent = total.toFixed(2);
    totalEl.style.color = Math.abs(total - 100) > 1 ? 'var(--accent-danger)' : 'var(--text-primary)';
}

export function openYieldSettingsModal() {
    const modal = DOMElements.yieldSettingsModal;
    const tbody = modal.querySelector('#yield-settings-table-body');
    tbody.innerHTML = '';

    YIELD_CONFIG.forEach(part => {
        const value = appState.yieldSettings[part.key] || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${part.name}</td>
            <td><input type="number" step="0.1" min="0" value="${value}" data-key="${part.key}" style="width: 100px;"></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateYieldTotal);
    });

    updateYieldTotal();
    modal.classList.add('active');
}

export function saveYieldSettings() {
    const newSettings = {};
    let total = 0;
     document.querySelectorAll('#yield-settings-table-body input').forEach(input => {
        const value = parseFloat(input.value) || 0;
        newSettings[input.dataset.key] = value;
        total += value;
    });

    if (total > 100.1) {
        showToast('Celková výtěžnost nesmí přesáhnout 100 %.', 'error');
        return;
    }

    appState.yieldSettings = newSettings;
    saveState();
    DOMElements.yieldSettingsModal.classList.remove('active');
    showToast('Nastavení výtěžnosti uloženo.');
}

// --- Thigh Split Settings ---

function updateThighSplitTotal() {
    const modal = DOMElements.thighSplitSettingsModal;
    if (!modal) return;
    const totalEl = modal.querySelector('#thigh-split-total');
    const upper = parseFloat(modal.querySelector('#upper-thigh-percent').value) || 0;
    const lower = parseFloat(modal.querySelector('#lower-thigh-percent').value) || 0;
    const total = upper + lower;
    totalEl.textContent = total.toFixed(1);
    totalEl.style.color = Math.abs(total - 100) > 0.1 ? 'var(--accent-danger)' : 'var(--text-primary)';
}

export function openThighSplitSettingsModal() {
    const modal = DOMElements.thighSplitSettingsModal;
    const { upperThighPercent, lowerThighPercent } = appState.thighSplitSettings;
    
    modal.querySelector('#upper-thigh-percent').value = upperThighPercent;
    modal.querySelector('#lower-thigh-percent').value = lowerThighPercent;
    
    modal.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateThighSplitTotal);
    });

    updateThighSplitTotal();
    modal.classList.add('active');
}

export function saveThighSplitSettings() {
    const modal = DOMElements.thighSplitSettingsModal;
    const upper = parseFloat(modal.querySelector('#upper-thigh-percent').value) || 0;
    const lower = parseFloat(modal.querySelector('#lower-thigh-percent').value) || 0;

    if (Math.abs(upper + lower - 100) > 0.1) {
        showToast('Součet procent musí být 100 %.', 'error');
        return;
    }

    appState.thighSplitSettings.upperThighPercent = upper;
    appState.thighSplitSettings.lowerThighPercent = lower;
    saveState();
    showToast('Nastavení rozdělení stehen uloženo.');
    modal.classList.remove('active');
}

// --- Portioning Settings ---

const MAX_PORTIONING_SPEED = 7500;

function updatePortioningCalculations() {
    const modal = DOMElements.portioningSettingsModal;
    if (!modal || !modal.classList.contains('active')) return;

    const percentInput = modal.querySelector('#packaging-to-portioning-percent');
    const deviationInput = modal.querySelector('#portioning-deviation');
    const calculatedSpeedEl = modal.querySelector('#portioning-calculated-speed');

    const percent = parseFloat(percentInput.value) || 0;
    
    // The deviation stored in state is the base deviation at 100%
    const baseDeviation = appState.portioningSettings.portioningDeviation;

    const calculatedSpeed = MAX_PORTIONING_SPEED * (percent / 100);
    const calculatedDeviation = baseDeviation * (percent / 100);

    calculatedSpeedEl.textContent = Math.round(calculatedSpeed).toLocaleString('cs-CZ');
    deviationInput.value = Math.round(calculatedDeviation);
}

export function openPortioningSettingsModal() {
    const modal = DOMElements.portioningSettingsModal;
    const { packagingToPortioningPercent } = appState.portioningSettings;
    
    const percentInput = modal.querySelector('#packaging-to-portioning-percent');
    percentInput.value = packagingToPortioningPercent;
    
    // Replace the node to safely remove any old listeners
    const newPercentInput = percentInput.cloneNode(true);
    percentInput.parentNode.replaceChild(newPercentInput, percentInput);
    newPercentInput.addEventListener('input', updatePortioningCalculations);
    
    modal.classList.add('active');
    
    // Trigger initial calculation
    updatePortioningCalculations();
}

export function savePortioningSettings() {
    const modal = DOMElements.portioningSettingsModal;
    const percent = parseFloat(modal.querySelector('#packaging-to-portioning-percent').value);
    const displayedDeviation = parseInt(modal.querySelector('#portioning-deviation').value, 10);

    if (isNaN(percent) || percent < 0 || percent > 100) {
        showToast('Zadejte prosím platné procento (0-100).', 'error');
        return;
    }
    if (isNaN(displayedDeviation)) {
        showToast('Zadejte prosím platnou číselnou odchylku.', 'error');
        return;
    }

    let newBaseDeviation;
    if (percent > 0) {
        // Recalculate the base deviation (at 100%) based on the user's input
        newBaseDeviation = (displayedDeviation / percent) * 100;
    } else {
        // If percent is 0, we can't calculate a base. Keep the original base deviation.
        newBaseDeviation = appState.portioningSettings.portioningDeviation;
    }

    appState.portioningSettings.packagingToPortioningPercent = percent;
    appState.portioningSettings.portioningDeviation = Math.round(newBaseDeviation);

    saveState();
    showToast('Nastavení porcovny uloženo.');
    modal.classList.remove('active');
}