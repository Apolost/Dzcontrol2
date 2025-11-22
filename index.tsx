/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// @ts-nocheck
import { loadState, startAutoSave, isDirty, markAsDirty } from './js/state.ts';
import { bindEvents, render, startClock, updateInfoBar, initializeNotificationInterval } from './js/main.ts';
import { initializeDOMElements } from './js/ui.ts';

async function loadModals() {
    const modalFiles = [
        'modals_general.html',
        'modals_production.html',
        'modals_orders.html',
        'modals_settings.html',
        'modals_employees.html',
        'modals_minced_meat.html',
        'modals_monthly_overview.html',
        'modals_stock.html',
        'modals_trays.html',
        'modals_changes.html',
        'modals_frozen.html'
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
    // --- SPLASH SCREEN LOGIC ---
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        // After 6 seconds, start fade out
        setTimeout(() => {
            splashScreen.classList.add('fade-out');
            
            // After fade out animation completes (500ms), hide it completely
            splashScreen.addEventListener('transitionend', () => {
                splashScreen.style.display = 'none';
            }, { once: true });

        }, 6000);
    }

    // --- APP INITIALIZATION ---
    await loadModals();
    initializeDOMElements(); // Populate DOM element references now that modals are loaded
    loadState();
    bindEvents();
    startClock();
    initializeNotificationInterval(); // Start checking for shortages periodically
    setInterval(updateInfoBar, 5000); // Update info bar every 5 seconds
    startAutoSave();
    render();
    feather.replace(); // Initialize all icons on initial load

    // --- UNSAVED CHANGES WARNING ---
    window.addEventListener('beforeunload', (event) => {
        if (isDirty) {
            // Most modern browsers show a generic message and ignore the return value.
            // But it's good practice to include it for compatibility.
            event.preventDefault(); // Required for Chrome.
            event.returnValue = 'Máte neuložené změny. Opravdu chcete opustit stránku?';
        }
    });

    // --- GLOBAL DIRTY FLAG HANDLERS ---
    document.body.addEventListener('input', () => markAsDirty());
    document.body.addEventListener('change', () => markAsDirty());


    // --- LISTENER FOR INSTANT DATA LOAD ---
    document.body.addEventListener('appDataLoaded', () => {
        loadState(); // Re-initialize state from localStorage
        render();    // Re-render the entire app with the new state
    });
});