/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// @ts-nocheck
import { loadState, startAutoSave } from './js/state.ts';
import { bindEvents, render, startClock, updateInfoBar } from './js/main.ts';
import { initializeDOMElements } from './js/ui.ts';

async function loadModals() {
    const modalFiles = [
        'modals_general.html',
        'modals_production.html',
        'modals_orders.html',
        'modals_settings.html',
        'modals_employees.html',
        'modals_minced_meat.html',
        'modals_monthly_overview.html'
    ];
    const container = document.getElementById('modals-container');
    if (!container) {
        console.error('Modals container not found!');
        return;
    }

    for (const file of modalFiles) {
        try {
            const response = await fetch(`views/${file}`);
            if (response.ok) {
                const html = await response.text();
                container.insertAdjacentHTML('beforeend', html);
            } else {
                console.error(`Could not load modals from: ${file}`);
            }
        } catch (error) {
            console.error(`Error fetching modals from ${file}:`, error);
        }
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // --- APP INITIALIZATION ---
    await loadModals();
    initializeDOMElements(); // Populate DOM element references now that modals are loaded
    loadState();
    bindEvents();
    startClock();
    setInterval(updateInfoBar, 5000); // Update info bar every 5 seconds
    startAutoSave();
    render();
    feather.replace(); // Initialize all icons on initial load

    // --- LISTENER FOR INSTANT DATA LOAD ---
    document.body.addEventListener('appDataLoaded', () => {
        loadState(); // Re-initialize state from localStorage
        render();    // Re-render the entire app with the new state
    });
});