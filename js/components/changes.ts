/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderChanges() {
    const tbody = document.getElementById('changes-table-body');
    tbody.innerHTML = '';
    appState.changes.forEach(change => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(change.dateFrom).toLocaleDateString('cs-CZ')}</td>
            <td>${change.dateTo ? new Date(change.dateTo).toLocaleDateString('cs-CZ') : '-'}</td>
            <td>${change.title}</td>
            <td>${change.text}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-change" data-id="${change.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-change" data-id="${change.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function openAddChangeModal(changeId = null) {
    const modal = DOMElements.addChangeModal;
    const { addChangeModalTitle, changeDateFrom, changeDateTo, changeTitle, changeText } = {
        addChangeModalTitle: modal.querySelector('.modal-title'),
        changeDateFrom: modal.querySelector('#change-date-from'),
        changeDateTo: modal.querySelector('#change-date-to'),
        changeTitle: modal.querySelector('#change-title'),
        changeText: modal.querySelector('#change-text'),
    };

    appState.ui.editingChangeId = changeId;

    if (changeId) {
        const change = appState.changes.find(c => c.id === changeId);
        if (change) {
            addChangeModalTitle.textContent = "Upravit změnu";
            changeDateFrom.value = change.dateFrom;
            changeDateTo.value = change.dateTo || '';
            changeTitle.value = change.title;
            changeText.value = change.text;
        }
    } else {
        addChangeModalTitle.textContent = "Přidat změnu";
        changeDateFrom.value = new Date().toISOString().split('T')[0];
        changeDateTo.value = '';
        changeTitle.value = '';
        changeText.value = '';
    }
    modal.classList.add('active');
}

export function saveChange() {
    const modal = DOMElements.addChangeModal;
    const changeDateFrom = modal.querySelector('#change-date-from');
    const changeDateTo = modal.querySelector('#change-date-to');
    const changeTitle = modal.querySelector('#change-title');
    const changeText = modal.querySelector('#change-text');
    
    const title = changeTitle.value.trim();
    const text = changeText.value.trim();
    const dateFrom = changeDateFrom.value;
    const dateTo = changeDateTo.value;

    if (!title || !dateFrom) {
        showToast('Datum "od" a nadpis jsou povinné.', 'error');
        return;
    }

    if (appState.ui.editingChangeId) {
        const change = appState.changes.find(c => c.id === appState.ui.editingChangeId);
        if (change) {
            change.dateFrom = dateFrom;
            change.dateTo = dateTo;
            change.title = title;
            change.text = text;
            showToast('Změna upravena');
        }
    } else {
        appState.changes.push({ id: generateId(), dateFrom, dateTo, title, text });
        showToast('Změna uložena');
    }
    
    saveState();
    renderChanges();
    modal.classList.remove('active');
}

export function deleteChange(changeId) {
    showConfirmation('Opravdu chcete smazat tuto změnu?', () => {
        appState.changes = appState.changes.filter(c => c.id !== changeId);
        saveState();
        renderChanges();
        showToast('Změna smazána', 'success');
    });
}
