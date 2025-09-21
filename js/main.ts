/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState } from './state.ts';
import { DOMElements } from './ui.ts';
import { bindGlobalEvents } from './eventHandler.ts';

// View Renderers
import { renderMainPage } from './components/mainPage.ts';
import { renderDailyPlan } from './components/dailyPlan.ts';
import { renderOrders } from './components/orders.ts';
import { renderCalendar } from './components/calendar.ts';
import { renderKFC, renderKfcProductsPage } from './components/kfc.ts';
import { renderChanges } from './components/changes.ts';
import { renderSpizySettings } from './components/spizy.ts';
import { renderCalculator } from './components/calculator.ts';
import { renderCreateProduct } from './settings/products.ts';
import { renderCreateMix } from './settings/mixes.ts';
import { renderBoxWeights } from './settings/boxWeights.ts';
import { renderPaletteWeights } from './settings/paletteWeights.ts';
import { renderCustomers } from './settings/customers.ts';


async function loadView(viewName) {
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`Could not load view: ${viewName}`);
        return await response.text();
    } catch (error) {
        console.error(error);
        return `<div class="card"><div class="card-content"><p class="shortage">Error: View '${viewName}' could not be loaded.</p></div></div>`;
    }
}

export function startClock() {
    const clockElement = document.getElementById('digital-clock');
    if (!clockElement) return;

    function updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

export function bindEvents() {
    DOMElements.navLinks.forEach(link => {
        if (link.dataset.view) {
            link.addEventListener('click', e => {
                e.preventDefault();
                appState.ui.activeView = e.currentTarget.dataset.view;
                render();
            });
        }
    });
    DOMElements.selectedDateInput.addEventListener('change', () => {
        appState.ui.selectedDate = DOMElements.selectedDateInput.value;
        render();
    });
    
    bindGlobalEvents();
}

export async function render() {
    DOMElements.navLinks.forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-view="${appState.ui.activeView}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        const parentDetails = activeLink.closest('details');
        if (parentDetails) parentDetails.open = true;
    }
    
    DOMElements.selectedDateInput.value = appState.ui.selectedDate;
    
    const mainContainer = DOMElements.appMain;
    if (mainContainer) {
        mainContainer.innerHTML = await loadView(appState.ui.activeView);
    } else {
        console.error("#app-main container not found");
        return;
    }

    switch (appState.ui.activeView) {
        case 'main-page': renderMainPage(); break;
        case 'daily-plan': renderDailyPlan(); break;
        case 'orders': renderOrders(); break;
        case 'calendar': renderCalendar(); break;
        case 'calculator': renderCalculator(); break;
        case 'box-weights': renderBoxWeights(); break;
        case 'create-mix': renderCreateMix(); break;
        case 'create-product': renderCreateProduct(); break;
        case 'palette-weights': renderPaletteWeights(); break;
        case 'zmeny': renderChanges(); break;
        case 'kfc': renderKFC(); break;
        case 'kfc-products': renderKfcProductsPage(); break;
        case 'spizy-settings': renderSpizySettings(); break;
        case 'customers': renderCustomers(); break;
    }
    
    feather.replace();
}

export function changeDate(days) {
    const currentDate = new Date(appState.ui.selectedDate + 'T12:00:00Z'); // Use noon to avoid timezone DST issues
    currentDate.setDate(currentDate.getDate() + days);
    appState.ui.selectedDate = currentDate.toISOString().split('T')[0];
    render();
}