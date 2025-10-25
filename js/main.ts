/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState } from './state.ts';
import { DOMElements } from './ui.ts';
import { bindGlobalEvents } from './eventHandler.ts';
import { initEmployeesApp } from './components/employees.ts';
import { getWeekNumber } from './utils.ts';
import { calculateTimeline } from './components/productionOverview.ts';

// View Renderers
import { renderMainPage } from './components/mainPage.ts';
import { renderDailyPlan } from './components/dailyPlan.ts';
import { renderOrders } from './components/orders.ts';
import { renderCalendar } from './components/calendar.ts';
import { renderKFC, renderKfcProductsPage } from './components/kfc.ts';
import { renderChanges } from './components/changes.ts';
import { renderSpizySettings } from './components/spizy.ts';
import { renderCalculator } from './components/calculator.ts';
import { renderProductionOverview } from './components/productionOverview.ts';
import { renderRawMaterialOrders } from './components/rawMaterialOrders.ts';
import { renderQrCodePage } from './components/qrCode.ts';
import { renderCreateProduct } from './settings/products.ts';
import { renderCreateMix } from './settings/mixes.ts';
import { renderBoxWeights } from './settings/boxWeights.ts';
import { renderPaletteWeights } from './settings/paletteWeights.ts';
import { renderCustomers } from './settings/customers.ts';
import { renderLineSettings } from './settings/lineSettings.ts';
import { renderExportData } from './components/export.ts';
import { renderMonthlyOverview } from './components/monthlyOverview.ts';


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

function minutesToTimeString(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.round(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function updateInfoBar() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const selectedDate = appState.ui.selectedDate;

    const weekNum = getWeekNumber(new Date(selectedDate));
    const { timeline } = calculateTimeline(selectedDate);
    
    let endTimeString = 'N/A';
    if (timeline.length > 0) {
        const lastEvent = timeline[timeline.length - 1];
        endTimeString = minutesToTimeString(lastEvent.endTime);
    }

    let currentFlockHtml = '<strong>N/A</strong>';
    let nextFlockHtml = '<strong>Žádný další</strong>';

    if (selectedDate === todayStr && timeline.length > 0) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        
        const currentFlockItem = timeline.find(item => item.type === 'flock' && nowMinutes >= item.startTime && nowMinutes < item.endTime);
        
        if (currentFlockItem) {
            currentFlockHtml = `<strong>${currentFlockItem.name} (${currentFlockItem.avgWeight.toFixed(2)} kg)</strong>`;
        } else {
            const isBeforeStart = nowMinutes < timeline[0].startTime;
            const isAfterEnd = nowMinutes >= timeline[timeline.length - 1].endTime;
            if (isBeforeStart) {
                currentFlockHtml = "<strong>Před začátkem</strong>";
            } else if (isAfterEnd) {
                currentFlockHtml = "<strong>Ukončeno</strong>";
            } else {
                currentFlockHtml = '<strong>Pauza / Porucha</strong>';
            }
        }

        const nextFlockItem = timeline.find(item => item.type === 'flock' && item.startTime > nowMinutes);
        if (nextFlockItem) {
            nextFlockHtml = `<strong>${nextFlockItem.name} (${nextFlockItem.avgWeight.toFixed(2)} kg) v ${minutesToTimeString(nextFlockItem.startTime)}</strong>`;
        }
    }

    const timeString = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    infoBar.innerHTML = `
        <span class="info-bar-item" title="Aktuální čas">
            <i data-feather="clock"></i>
            <strong>${timeString}</strong>
        </span>
        <span class="info-bar-item" title="Číslo týdne">
            <i data-feather="calendar"></i>
            <span>Týden: <strong>${weekNum}</strong></span>
        </span>
        <span class="info-bar-item" title="Aktuálně zpracovávaný chov">
            <i data-feather="truck"></i>
            <span>Aktuální chov: ${currentFlockHtml}</span>
        </span>
        <span class="info-bar-item" title="Další chov na porcovně">
            <i data-feather="chevrons-right"></i>
            <span>Další chov: ${nextFlockHtml}</span>
        </span>
        <span class="info-bar-item" title="Předpokládaný konec linky">
            <i data-feather="flag"></i>
            <span>Konec: <strong>${endTimeString}</strong></span>
        </span>
    `;

    feather.replace({ width: '18px', height: '18px' });
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
    DOMElements.selectedDateInput.addEventListener('change', () => {
        appState.ui.selectedDate = DOMElements.selectedDateInput.value;
        render();
    });
    
    bindGlobalEvents();
}

export async function render() {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-view="${appState.ui.activeView}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        const parentDetails = activeLink.closest('details');
        if (parentDetails) parentDetails.open = true;
    }
    
    DOMElements.selectedDateInput.value = appState.ui.selectedDate;
    
    const mainContainer = DOMElements.appMain;
    if (mainContainer) {
        const viewHtml = await loadView(appState.ui.activeView);
        mainContainer.innerHTML = viewHtml;
    } else {
        console.error("#app-main container not found");
        return;
    }

    const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
    if (sidebarToggleButton) {
        if (appState.ui.activeView === 'employees') {
            sidebarToggleButton.style.display = 'block';
        } else {
            sidebarToggleButton.style.display = 'none';
        }
    }
    
    updateInfoBar();

    switch (appState.ui.activeView) {
        case 'main-page': renderMainPage(); break;
        case 'daily-plan': renderDailyPlan(); break;
        case 'orders': renderOrders(); break;
        case 'calendar': renderCalendar(); break;
        case 'calculator': renderCalculator(); break;
        case 'production-overview': renderProductionOverview(); break;
        case 'monthly-overview': renderMonthlyOverview(); break;
        case 'raw-material-orders': renderRawMaterialOrders(); break;
        case 'export-data': renderExportData(); break;
        case 'qr-code': renderQrCodePage(); break;
        case 'box-weights': renderBoxWeights(); break;
        case 'create-mix': renderCreateMix(); break;
        case 'create-product': renderCreateProduct(); break;
        case 'palette-weights': renderPaletteWeights(); break;
        case 'zmeny': renderChanges(); break;
        case 'employees': initEmployeesApp(); break;
        case 'kfc': renderKFC(); break;
        case 'kfc-products': renderKfcProductsPage(); break;
        case 'spizy-settings': renderSpizySettings(); break;
        case 'customers': renderCustomers(); break;
        case 'line-settings': renderLineSettings(); break;
    }
    
    feather.replace();
}

export function changeDate(days) {
    const currentDate = new Date(appState.ui.selectedDate + 'T12:00:00Z'); // Use noon to avoid timezone DST issues
    currentDate.setDate(currentDate.getDate() + days);
    appState.ui.selectedDate = currentDate.toISOString().split('T')[0];
    render();
}