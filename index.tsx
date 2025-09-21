/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// @ts-nocheck
import { loadState, startAutoSave } from './js/state.ts';
import { bindEvents, render, startClock } from './js/main.ts';

document.addEventListener('DOMContentLoaded', () => {
    // --- APP INITIALIZATION ---
    loadState();
    bindEvents();
    startClock();
    startAutoSave();
    render();
});