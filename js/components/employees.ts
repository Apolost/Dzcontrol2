// @ts-nocheck

// --- MODULE-LEVEL STATE ---
let currentDate = new Date();
let employees = [];
let workLocations = [];
let foremen = [];
let foremenSchedule = {};
let foremenVacations = [];
let foremenWeekendNotes = {};
let foremanRotationEnabled = false;
let forkliftDrivers = [];
let forkliftSchedule = {};
let forkliftVacations = [];
let forkliftWeekendNotes = {};
let forkliftRotationEnabled = false;
let hoursData = {};
let hoursWriteOffs = [];
let hoursSettings = { optimal_tons_per_hour: 18, calculation_method: 'tons_per_hour' };
let fileHandle = null;
const monthNames = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

// --- DATA PERSISTENCE ---
const saveDataToLocalStorage = () => {
    const dataToSave = {
        employees,
        workLocations,
        foremen,
        foremenSchedule,
        foremenVacations,
        foremenWeekendNotes,
        foremanRotationEnabled,
        forkliftDrivers,
        forkliftSchedule,
        forkliftVacations,
        forkliftWeekendNotes,
        forkliftRotationEnabled,
        hoursData,
        hoursSettings,
        hoursWriteOffs
    };
    localStorage.setItem('shiftCalendarData_v2.5', JSON.stringify(dataToSave));
};

const loadDataFromLocalStorage = () => {
    const savedData = localStorage.getItem('shiftCalendarData_v2.5');
    if (savedData) {
        const data = JSON.parse(savedData);
        employees = data.employees || [];
        workLocations = data.workLocations || [];
        foremen = data.foremen || [];
        foremenSchedule = data.foremenSchedule || {};
        foremenVacations = data.foremenVacations || [];
        foremenWeekendNotes = data.foremenWeekendNotes || {};
        foremanRotationEnabled = data.foremanRotationEnabled || false;
        forkliftDrivers = data.forkliftDrivers || [];
        forkliftSchedule = data.forkliftSchedule || {};
        forkliftVacations = data.forkliftVacations || [];
        forkliftWeekendNotes = data.forkliftWeekendNotes || {};
        forkliftRotationEnabled = data.forkliftRotationEnabled || false;
        hoursData = data.hoursData || {};
        hoursSettings = data.hoursSettings || { optimal_tons_per_hour: 18, calculation_method: 'tons_per_hour' };
        hoursWriteOffs = data.hoursWriteOffs || [];
    }
};

// --- INITIAL DATA LOAD (runs once on script parse) ---
loadDataFromLocalStorage();


export function initEmployeesApp() {
    feather.replace();

    // --- ELEMENTS (re-queried on each render) ---
    const calendarBody = document.getElementById('calendar-body');
    const monthYearEls = document.querySelectorAll('.month-year-display');
    const prevMonthBtns = document.querySelectorAll('.prev-month-btn');
    const nextMonthBtns = document.querySelectorAll('.next-month-btn');
    const departuresInfoEl = document.getElementById('departures-info');
    const unknownDeparturesInfoEl = document.getElementById('unknown-departures-info');
    const calendarContainer = document.getElementById('calendar-container');
    const locationsOverviewEl = document.getElementById('locations-overview');
    const shiftsContentEl = document.getElementById('shifts-content');
    
    // Views
    const mainView = document.getElementById('main-view');
    const foremenView = document.getElementById('foremen-view');
    const forkliftView = document.getElementById('forklift-view');
    const hoursView = document.getElementById('hours-view');
    
    // Sidebar Elements
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-button');

    // Data I/O
    const saveDataBtn = document.getElementById('save-data-button');
    const loadDataInput = document.getElementById('load-data-input');

    // Modals & Forms
    const addEmployeeModal = document.getElementById('add-employee-modal');
    const shiftsModal = document.getElementById('shifts-modal');
    const addDepartureModal = document.getElementById('add-departure-modal');
    const locationsModal = document.getElementById('locations-modal');
    const addEditLocationModal = document.getElementById('add-edit-location-modal');
    const dailyDeparturesModal = document.getElementById('daily-departures-modal');
    const fillDepartureModal = document.getElementById('fill-departure-modal');
    const addEmployeeForm = document.getElementById('add-employee-form');
    const addDepartureForm = document.getElementById('add-departure-form');
    const addEditLocationForm = document.getElementById('add-edit-location-form');
    const fillDepartureForm = document.getElementById('fill-departure-form');
    
    // Hours Modals
    const addHoursModal = document.getElementById('add-hours-modal');
    const hoursSettingsModal = document.getElementById('hours-settings-modal');
    const addHoursForm = document.getElementById('add-hours-form');
    const hoursSettingsForm = document.getElementById('hours-settings-form');
    const writeOffHoursModal = document.getElementById('write-off-hours-modal');
    const writeOffHoursForm = document.getElementById('write-off-hours-form');
    const reasonModal = document.getElementById('reason-modal');

    // --- HELPER FUNCTIONS ---

    const saveDataToFile = () => {
        const dataStr = localStorage.getItem('shiftCalendarData_v2.5') || '{}';
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kalendar_data_export.json';
        a.click();
        URL.revokeObjectURL(url);
        alert("Data byla úspěšně exportována!");
    };

    const loadDataFromFile = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const contents = await file.text();
            JSON.parse(contents); // Validate JSON
            localStorage.setItem('shiftCalendarData_v2.5', contents);
            loadDataFromLocalStorage(); // Reload state from the new data
            alert("Data byla úspěšně importována.");
            const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
            setActiveView(activeView ? activeView.id : 'main-view');
        } catch (err) {
            console.error('Chyba při importu souboru:', err);
            alert('Nepodařilo se importovat soubor. Ujistěte se, že je ve správném formátu JSON.');
        }
        event.target.value = ''; // Reset input
    };

    const setActiveView = (viewToShow) => {
         [mainView, foremenView, forkliftView, hoursView].forEach(view => {
            if (view.id === viewToShow) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        monthYearEls.forEach(el => el.textContent = `${monthNames[month]} ${year}`);

        if (viewToShow === 'main-view') renderCalendar();
        else if (viewToShow === 'foremen-view') {
            updateRotationToggleUI('foreman', foremanRotationEnabled);
            renderScheduleCalendar('foreman');
        }
        else if (viewToShow === 'forklift-view') {
            updateRotationToggleUI('forklift', forkliftRotationEnabled);
            renderScheduleCalendar('forklift');
        }
        else if (viewToShow === 'hours-view') renderHoursView();
    }

    const openModal = (modal) => modal.classList.remove('hidden');
    const closeModal = (modal) => modal.classList.add('hidden');

    const openEmployeeModal = (employee = null) => {
        addEmployeeForm.reset();
        updateEmployeeLocationSelect();
        if (employee) {
            document.getElementById('employee-modal-title').textContent = 'Upravit zaměstnance';
            document.getElementById('employee-id').value = employee.id;
            document.getElementById('firstName').value = employee.firstName;
            document.getElementById('lastName').value = employee.lastName;
            document.getElementById('phone').value = employee.phone;
            document.getElementById('chip').value = employee.chip || '';
            document.getElementById('location').value = employee.locationId;
            document.getElementById('shift').value = employee.shift;
            document.getElementById('gender').value = employee.gender || 'muz';
            document.getElementById('departureDate').value = employee.departureDate || '';
        } else {
            document.getElementById('employee-modal-title').textContent = 'Přidat nového zaměstnance';
            document.getElementById('employee-id').value = '';
        }
        openModal(addEmployeeModal);
    };

    const deleteEmployee = (employeeId) => {
        if(confirm('Opravdu chcete smazat tohoto zaměstnance? Tato akce je nevratná.')) {
            employees = employees.filter(emp => emp.id != employeeId);
            saveDataToLocalStorage();
            updateAllViews();
        }
    };

    const renderCalendar = () => {
        calendarContainer.classList.add('switching');
        
        setTimeout(() => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            monthYearEls.forEach(el => el.textContent = `${monthNames[month]} ${year}`);
            calendarBody.innerHTML = '';

            const firstDayOfMonth = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            const dayOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

            for (let i = 0; i < dayOffset; i++) {
                calendarBody.innerHTML += `<div class="bg-slate-50"></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dayDate = new Date(year, month, day);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                
                const departures = employees.filter(emp => {
                    if (!emp.departureDate) return false;
                    const empDate = new Date(emp.departureDate);
                    return empDate.getFullYear() === year && empDate.getMonth() === month && empDate.getDate() === day;
                });

                let departureHtml = '';
                if (departures.length > 0) {
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    departureHtml = `<div class="departure-count" data-date="${dateString}" title="${departures.length} odjezdů">${departures.length}</div>`;
                }

                calendarBody.innerHTML += `
                    <div class="calendar-day bg-white p-2 flex flex-col items-start justify-start border-r border-b border-gray-200">
                        <span class="text-sm font-medium text-gray-700 ${isToday ? 'today' : ''}">${day}</span>
                        ${departureHtml}
                    </div>
                `;
            }
            calendarContainer.classList.remove('switching');
            updateAllViews();
        }, 200);
    };
    
    const updateMenShiftsCount = () => {
        const shift1Men = employees.filter(e => e.shift === '1' && e.gender === 'muz').length;
        const shift2Men = employees.filter(e => e.shift === '2' && e.gender === 'muz').length;
        document.getElementById('shift1-men-count').textContent = shift1Men;
        document.getElementById('shift2-men-count').textContent = shift2Men;
    };

    const updateDeparturesInfo = () => {
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
        const nextMonth = nextMonthDate.getMonth();
        const nextMonthYear = nextMonthDate.getFullYear();

        const departuresThisMonth = employees.filter(emp => {
            if (!emp.departureDate) return false;
            const d = new Date(emp.departureDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).sort((a,b) => new Date(a.departureDate) - new Date(b.departureDate));

        const departuresNextMonth = employees.filter(emp => {
            if (!emp.departureDate) return false;
            const d = new Date(emp.departureDate);
            return d.getMonth() === nextMonth && d.getFullYear() === nextMonthYear;
        }).sort((a,b) => new Date(a.departureDate) - new Date(b.departureDate));
        
        const formatDeparture = (emp) => {
            const d = new Date(emp.departureDate);
            return `<div class="text-sm mb-1 p-2 rounded-md bg-white border border-gray-200">
                        <span class="font-semibold">${emp.firstName} ${emp.lastName}</span>
                        <span class="block text-xs text-gray-500">${d.toLocaleDateString('cs-CZ')}</span>
                    </div>`;
        };

        departuresInfoEl.innerHTML = `
            <div class="mb-4">
                <h3 class="font-semibold text-gray-700 mb-2">Tento měsíc (${departuresThisMonth.length})</h3>
                <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
                   ${departuresThisMonth.length > 0 ? departuresThisMonth.map(formatDeparture).join('') : '<p class="text-xs text-gray-500">Žádné odjezdy.</p>'}
                </div>
            </div>
            <div>
                <h3 class="font-semibold text-gray-700 mb-2">Následující měsíc (${departuresNextMonth.length})</h3>
                <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
                   ${departuresNextMonth.length > 0 ? departuresNextMonth.map(formatDeparture).join('') : '<p class="text-xs text-gray-500">Žádné odjezdy.</p>'}
                </div>
            </div>
        `;
    };
    
    const updateUnknownDeparturesInfo = () => {
        const unknownDepartureEmployees = employees.filter(emp => !emp.departureDate);
        if (unknownDepartureEmployees.length === 0) {
            unknownDeparturesInfoEl.innerHTML = '<p class="text-xs text-gray-500">Všichni zaměstnanci mají zadaný odjezd.</p>';
            return;
        }
        
        unknownDeparturesInfoEl.innerHTML = `
            <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
            ${unknownDepartureEmployees.map(emp => `
                <div class="text-sm p-2 rounded-md bg-white border border-gray-200 flex justify-between items-center">
                    <div>
                        <span class="font-semibold">${emp.firstName} ${emp.lastName}</span>
                        <span class="block text-xs text-gray-500">Čip: ${emp.chip || 'N/A'}</span>
                    </div>
                    <button class="fill-departure-btn bg-indigo-100 text-indigo-700 text-xs font-bold py-1 px-2 rounded-md hover:bg-indigo-200" data-id="${emp.id}">Doplnit</button>
                </div>
            `).join('')}
            </div>
        `;
    };

    const updateShiftsView = () => {
        const shift1 = employees.filter(e => e.shift === '1');
        const shift2 = employees.filter(e => e.shift === '2');
        
        const createShiftHtml = (employeesList) => {
            if (employeesList.length === 0) return '<li>Žádní zaměstnanci</li>';
            return employeesList.map(e => `
                <li class="flex justify-between items-center py-1">
                    <span>${e.firstName} ${e.lastName}</span>
                    <button class="delete-employee-shift-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-all duration-150" data-id="${e.id}" title="Smazat zaměstnance">
                        <i data-feather="trash-2" class="w-4 h-4"></i>
                    </button>
                </li>`).join('');
        };

        shiftsContentEl.innerHTML = `
            <div class="flex-1">
                <h3 class="text-lg font-bold text-blue-700 mb-2">1. směna (${shift1.length})</h3>
                <ul class="space-y-1 bg-blue-50 p-3 rounded-lg">${createShiftHtml(shift1)}</ul>
            </div>
             <div class="flex-1">
                <h3 class="text-lg font-bold text-green-700 mb-2">2. směna (${shift2.length})</h3>
                <ul class="space-y-1 bg-green-50 p-3 rounded-lg">${createShiftHtml(shift2)}</ul>
            </div>
        `;
        document.getElementById('shifts-total').textContent = `Celkem zaměstnanců: ${employees.length}`;
        feather.replace();
    };

    const updateAddDepartureView = () => {
         const select = document.getElementById('departure-employee-select');
         select.innerHTML = '<option value="" disabled selected>Vyberte...</option>';
         employees.sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach(emp => {
             const option = document.createElement('option');
             option.value = emp.id;
             option.textContent = `${emp.lastName}, ${emp.firstName}`;
             select.appendChild(option);
         });
    };
    
    const renderLocations = () => {
        const listEl = document.getElementById('locations-list');
        listEl.innerHTML = '';
        if (workLocations.length === 0) {
            listEl.innerHTML = `<p class="text-gray-500 text-center py-4">Zatím nebyla přidána žádná umístění.</p>`;
            return;
        }
        workLocations.forEach(loc => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
            item.innerHTML = `
                <span class="font-medium text-gray-800">${loc.name}</span>
                <div class="flex gap-1">
                    <button class="edit-location-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-indigo-600 transition-all duration-150" data-id="${loc.id}"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                    <button class="delete-location-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-600 transition-all duration-150" data-id="${loc.id}"><i data-feather="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
            listEl.appendChild(item);
        });
        feather.replace();
    };
    
    const renderLocationsOverview = () => {
        locationsOverviewEl.innerHTML = '';
        if (workLocations.length === 0) {
            locationsOverviewEl.innerHTML = `<p class="text-gray-500 text-center py-4 bg-slate-50 rounded-lg">Přidejte pracovní umístění, aby se zde zobrazili zaměstnanci.</p>`;
            return;
        }

        workLocations.forEach(loc => {
            const employeesInLocation = employees.filter(emp => emp.locationId == loc.id);
            const shift1Employees = employeesInLocation.filter(emp => emp.shift == '1');
            const shift2Employees = employeesInLocation.filter(emp => emp.shift == '2');
            
            const locationEl = document.createElement('div');
            locationEl.className = 'bg-slate-50 rounded-lg border';
            
            const createEmployeeListHtml = (list) => {
                if (list.length === 0) return '<p class="px-4 py-2 text-sm text-gray-500 border-b">Žádní zaměstnanci na směně.</p>';
                return list.map(emp => `
                    <div class="flex justify-between items-center py-2 px-4 border-b last:border-b-0">
                        <span>${emp.firstName} ${emp.lastName} <span class="text-xs text-gray-500">(Čip: ${emp.chip || 'N/A'})</span></span>
                        <button class="edit-employee-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-indigo-600 transition-all duration-150" data-id="${emp.id}"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                    </div>
                `).join('');
            };

            const employeesHtml = `
                <div>
                    <h4 class="font-semibold text-sm text-blue-800 bg-blue-100 p-2 rounded-t-md">1. směna (${shift1Employees.length})</h4>
                    ${createEmployeeListHtml(shift1Employees)}
                    <h4 class="font-semibold text-sm text-green-800 bg-green-100 p-2 mt-2">2. směna (${shift2Employees.length})</h4>
                    ${createEmployeeListHtml(shift2Employees)}
                </div>
            `;

            locationEl.innerHTML = `
                <div class="flex justify-between items-center p-4 cursor-pointer location-header">
                    <h3 class="font-bold text-lg text-gray-800">${loc.name}</h3>
                    <div class="flex items-center gap-4 text-sm">
                        <span class="bg-blue-100 text-blue-800 font-semibold px-2 py-1 rounded-full">1. směna: ${shift1Employees.length}</span>
                        <span class="bg-green-100 text-green-800 font-semibold px-2 py-1 rounded-full">2. směna: ${shift2Employees.length}</span>
                        <i data-feather="chevron-down" class="transition-transform location-toggle-icon"></i>
                    </div>
                </div>
                <div class="location-employee-list bg-white rounded-b-lg">
                    ${employeesInLocation.length > 0 ? employeesHtml : '<p class="text-sm text-gray-500 p-4">V tomto umístění nejsou žádní zaměstnanci.</p>'}
                </div>
            `;
            locationsOverviewEl.appendChild(locationEl);
        });
        feather.replace();
    };
    
    const renderDailyDeparturesModal = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        const departingEmployees = employees.filter(emp => {
            if(!emp.departureDate) return false;
            const empDate = new Date(emp.departureDate);
            return empDate.getFullYear() === year && empDate.getMonth() === month - 1 && empDate.getDate() === day;
        });

        document.getElementById('daily-departures-title').textContent = `Odjezdy ${day}. ${month}. ${year}`;
        const listEl = document.getElementById('daily-departures-list');
        listEl.innerHTML = '';

        if (departingEmployees.length === 0) {
             listEl.innerHTML = '<p>Žádné odjezdy pro tento den.</p>';
             return;
        }

        departingEmployees.forEach(emp => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
            item.innerHTML = `
                <span class="font-medium text-gray-800">${emp.firstName} ${emp.lastName}</span>
                <div class="flex gap-1">
                    <button class="edit-employee-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all duration-150" data-id="${emp.id}" title="Upravit zaměstnance"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                    <button class="delete-employee-daily-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-all duration-150" data-id="${emp.id}" title="Smazat zaměstnance"><i data-feather="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
            listEl.appendChild(item);
        });
        feather.replace();
        openModal(dailyDeparturesModal);
    };

    const updateEmployeeLocationSelect = () => {
        const select = document.getElementById('location');
        select.innerHTML = '<option value="" disabled selected>Vyberte umístění...</option>';
        workLocations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.name;
            select.appendChild(option);
        });
    };

    const updateAllViews = () => {
        updateDeparturesInfo();
        updateUnknownDeparturesInfo();
        updateShiftsView();
        updateAddDepartureView();
        renderLocations();
        renderLocationsOverview();
        updateEmployeeLocationSelect();
        updateMenShiftsCount();
    };
    
    // --- GENERIC SCHEDULING LOGIC ---
    const schedulePillContextMenu = document.getElementById('schedule-pill-context-menu');
    
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    const isPersonOnVacation = (personType, personId, date) => {
        const vacations = personType === 'foreman' ? foremenVacations : forkliftVacations;
        const checkDate = new Date(date);
        checkDate.setHours(0,0,0,0);
        return vacations.some(vac => {
            const start = new Date(vac.startDate);
            start.setHours(0,0,0,0);
            const end = new Date(vac.endDate);
            end.setHours(0,0,0,0);
            return vac.personId == personId && checkDate >= start && checkDate <= end;
        });
    };

    const updateRotationToggleUI = (personType, isEnabled) => {
        const btn = document.getElementById(`toggle-${personType}-rotation`);
        const textEl = document.getElementById(`${personType}-rotation-status-text`);
        const iconEl = document.getElementById(`${personType}-rotation-status-icon`);
        if (isEnabled) {
            textEl.textContent = 'Auto: Zapnuto';
            btn.classList.remove('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
            btn.classList.add('bg-green-100', 'text-green-800', 'hover:bg-green-200');
            iconEl.outerHTML = `<i id="${personType}-rotation-status-icon" data-feather="toggle-right" class="w-5 h-5"></i>`;
        } else {
            textEl.textContent = 'Auto: Vypnuto';
            btn.classList.add('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
            btn.classList.remove('bg-green-100', 'text-green-800', 'hover:bg-green-200');
            iconEl.outerHTML = `<i id="${personType}-rotation-status-icon" data-feather="toggle-left" class="w-5 h-5"></i>`;
        }
        feather.replace();
    };

    const renderScheduleCalendar = (personType) => {
        const container = document.getElementById(`${personType}-calendar-container`);
        const people = personType === 'foreman' ? foremen : forkliftDrivers;
        const schedule = personType === 'foreman' ? foremenSchedule : forkliftSchedule;
        const weekendNotes = personType === 'foreman' ? foremenWeekendNotes : forkliftWeekendNotes;
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'schedule-calendar-week bg-slate-50 font-bold text-sm text-slate-600';
        let headerHTML = `<div class="p-2 flex items-center justify-center border-r">Týden</div><div class="p-2 border-r">Směna</div>`;
        const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
        daysOfWeek.forEach(day => headerHTML += `<div class="p-2 text-center">${day}</div>`);
        header.innerHTML = headerHTML;
        container.appendChild(header);

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        let currentDay = new Date(firstDayOfMonth);
        currentDay.setDate(currentDay.getDate() - (firstDayOfMonth.getDay() + 6) % 7);

        while(currentDay <= lastDayOfMonth || currentDay.getDay() !== 1) {
            const weekRow = document.createElement('div');
            weekRow.className = 'schedule-calendar-week';
            const weekStartDateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
            const weekNum = getWeekNumber(currentDay);
            
            const labelsHTML = `
                <div class="flex flex-col justify-around h-full p-2 text-xs font-bold text-right">
                    <div class="flex-1 flex items-center justify-end text-[#f59e0b]">Ranní</div>
                    <div class="flex-1 flex items-center justify-end text-[#fd7e14]">Odpolední</div>
                    <div class="flex-1 flex items-center justify-end text-[#374151]">Noční</div>
                </div>
            `;

            weekRow.innerHTML = `
                <div class="schedule-week-number p-2 text-center font-bold text-indigo-600 flex items-center justify-center border-r bg-indigo-50" data-person-type="${personType}" data-week-start-date="${weekStartDateStr}" data-week-number="${weekNum}">${weekNum}</div>
                <div class="border-r bg-slate-50">${labelsHTML}</div>
            `;
            
            for (let i=0; i<7; i++) {
                const dayInMonth = currentDay.getMonth() === month;
                const dateString = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
                const dayOfWeek = currentDay.getDay();
                
                const allPeopleOnShiftOrVacation = new Set();
                
                const createPills = (shift) => {
                     const daySchedule = schedule[dateString] || {};
                     return (daySchedule[shift] || []).map(personId => {
                        allPeopleOnShiftOrVacation.add(personId);
                        const person = people.find(p => p.id == personId);
                        if (!person) return '';
                        return `<div class="schedule-pill ${personType}-pill ${shift}" draggable="true" data-person-type="${personType}" data-person-id="${person.id}" data-date="${dateString}" data-shift="${shift}">${person.firstName} ${person.lastName}</div>`;
                    }).join('');
                }
                
                const vacationPills = people.filter(p => !allPeopleOnShiftOrVacation.has(p.id) && isPersonOnVacation(personType, p.id, dateString))
                    .map(p => {
                        allPeopleOnShiftOrVacation.add(p.id);
                        return `<div class="schedule-pill vacation" data-person-id="${p.id}">${p.firstName} ${p.lastName}</div>`;
                    }).join('');

                let weekendNoteIndicator = '';
                if ((dayOfWeek === 6 || dayOfWeek === 0) && weekendNotes[dateString]?.note) {
                    weekendNoteIndicator = `<div class="weekend-note-indicator" title="Poznámka"><i data-feather="message-square" class="w-full h-full text-blue-500"></i></div><div class="weekend-tooltip">${weekendNotes[dateString].note}</div>`;
                }
                
                const dayEl = document.createElement('div');
                dayEl.className = `schedule-calendar-day ${dayInMonth ? 'bg-white' : 'bg-slate-50'}`;
                dayEl.dataset.date = dateString;
                dayEl.dataset.dayOfWeek = dayOfWeek;
                dayEl.dataset.personType = personType;
                dayEl.innerHTML = `
                    <div class="p-1 text-xs font-semibold ${dayInMonth ? 'text-slate-700' : 'text-slate-400'}">${currentDay.getDate()}. ${currentDay.getMonth()+1}.</div>
                    ${weekendNoteIndicator}
                    <div class="schedule-shift-cell" data-date="${dateString}" data-shift="morning">${createPills('morning')}</div>
                    <div class="schedule-shift-cell" data-date="${dateString}" data-shift="afternoon">${createPills('afternoon')}</div>
                    <div class="schedule-shift-cell" data-date="${dateString}" data-shift="night">${createPills('night')} ${vacationPills}</div>
                `;
                weekRow.appendChild(dayEl);
                currentDay.setDate(currentDay.getDate() + 1);
            }
            container.appendChild(weekRow);
            if (currentDay > lastDayOfMonth && currentDay.getDay() === 1) break;
        }
        addDragDropListeners(personType);
        feather.replace();
    };
    
    const addDragDropListeners = (personType) => {
        const pills = document.querySelectorAll(`.schedule-pill[data-person-type="${personType}"]`);
        const cells = document.querySelectorAll(`#${personType}-calendar-container .schedule-shift-cell`);
        let draggedPill = null;
        
        pills.forEach(pill => {
            pill.addEventListener('dragstart', (e) => {
                if (pill.classList.contains('vacation')) {
                    e.preventDefault();
                    return;
                }
                draggedPill = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0);
                const sourceCell = draggedPill.parentElement;
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    personId: draggedPill.dataset.personId,
                    personType: draggedPill.dataset.personType,
                    sourceDate: sourceCell.dataset.date,
                    sourceShift: sourceCell.dataset.shift
                }));
            });
            pill.addEventListener('dragend', () => {
                 if(draggedPill) draggedPill.classList.remove('dragging');
                 draggedPill = null;
            });
        });
        
        cells.forEach(cell => {
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });
             cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
             cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                if (!draggedPill) return;

                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const { personId, sourceDate, sourceShift } = data;
                const targetDate = cell.dataset.date;
                const targetShift = cell.dataset.shift;
                
                if (isPersonOnVacation(personType, personId, targetDate)) {
                    alert('Nelze přiřadit. Osoba má na tento den dovolenou.');
                    return;
                }
                
                let schedule = personType === 'foreman' ? foremenSchedule : forkliftSchedule;

                if (sourceDate) {
                    if (schedule[sourceDate] && schedule[sourceDate][sourceShift]) {
                        schedule[sourceDate][sourceShift] = schedule[sourceDate][sourceShift].filter(id => id != personId);
                    }
                }
                
                if (!schedule[targetDate]) {
                    schedule[targetDate] = { morning: [], afternoon: [], night: [] };
                }
                if (!schedule[targetDate][targetShift].includes(personId)) {
                     schedule[targetDate][targetShift].push(personId);
                }
                
                saveDataToLocalStorage();
                renderScheduleCalendar(personType);
             });
        });
    };

    const openAssignPersonToWeekModal = (personType, weekStartDateStr, weekNum) => {
        const modal = document.getElementById(`assign-${personType === 'foreman' ? 'foreman' : 'forklift-driver'}-week-modal`);
        const title = modal.querySelector('h2');
        const select = modal.querySelector('select[id$="-week-select"]');
        const people = personType === 'foreman' ? foremen : forkliftDrivers;

        modal.querySelector('input[type="hidden"]').value = weekStartDateStr;
        title.textContent = `Přiřadit na celý ${weekNum}. týden`;

        select.innerHTML = '<option value="" disabled selected>Vyberte...</option>';
        people.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.firstName} ${p.lastName}`;
            select.appendChild(option);
        });
        
        const weekStartDate = new Date(weekStartDateStr);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        modal.querySelector('input[id$="-vacation-start-date"]').value = weekStartDateStr;
        modal.querySelector('input[id$="-vacation-end-date"]').value = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`;

        openModal(modal);
    };
    
    const openAddPersonModal = (personType, person = null) => {
        const modal = document.getElementById(`add-${personType === 'foreman' ? 'foreman' : 'forklift-driver'}-modal`);
        const form = modal.querySelector('form');
        form.reset();
        if (person) {
             modal.querySelector('h2').textContent = `Upravit ${personType === 'foreman' ? 'předního dělníka' : 'vozíčkáře'}`;
             modal.querySelector('input[type="hidden"]').value = person.id;
             modal.querySelector('input[id$="-firstName"]').value = person.firstName;
             modal.querySelector('input[id$="-lastName"]').value = person.lastName;
             modal.querySelector('input[id$="-chip"]').value = person.chip;
             modal.querySelector('input[id$="-phone"]').value = person.phone;
        } else {
             modal.querySelector('h2').textContent = `Přidat ${personType === 'foreman' ? 'předního dělníka' : 'vozíčkáře'}`;
             modal.querySelector('input[type="hidden"]').value = '';
        }
        openModal(modal);
    };

    const renderPeopleList = (personType) => {
        const modal = document.getElementById(`${personType === 'foreman' ? 'foremen' : 'forklift-drivers'}-list-modal`);
        const content = modal.querySelector('[id$="-list-content"]');
        const people = personType === 'foreman' ? foremen : forkliftDrivers;
        content.innerHTML = '';
         if (people.length === 0) {
            content.innerHTML = `<p>Nebyly nalezeny žádní ${personType === 'foreman' ? 'přední dělníci' : 'vozíčkáři'}.</p>`;
            return;
        }
        people.forEach(p => {
            content.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <div>
                        <p class="font-bold">${p.firstName} ${p.lastName}</p>
                        <p class="text-sm text-slate-500">Čip: ${p.chip || 'N/A'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="edit-person-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200" data-person-type="${personType}" data-id="${p.id}"><i data-feather="edit"></i></button>
                        <button class="delete-person-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200" data-person-type="${personType}" data-id="${p.id}"><i data-feather="trash-2"></i></button>
                    </div>
                </div>
            `;
        });
        feather.replace();
    };

    const renderHoursView = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const container = document.getElementById('hours-list-container');
        container.innerHTML = '';
        
        const writeOffsByDate = {};
        const monthlyWriteOffs = hoursWriteOffs.filter(wo => {
            const d = new Date(wo.date);
            return d.getMonth() === month && d.getFullYear() === year;
        });
        monthlyWriteOffs.forEach(wo => {
            if (!writeOffsByDate[wo.date]) {
                writeOffsByDate[wo.date] = 0;
            }
            writeOffsByDate[wo.date] += parseFloat(wo.hours);
        });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

        let totalHours = 0, totalNetto = 0, totalBizerba = 0;
        
        const method = hoursSettings.calculation_method || 'tons_per_hour';
        const unit = method === 'tons_per_hour' ? 't/h' : 'h/t';

        let tableHTML = `<div class="border rounded-lg overflow-hidden"><table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
                <tr>
                    <th class="p-2 text-left font-semibold">Datum</th>
                    <th class="p-2 text-right font-semibold">Hodiny</th>
                    <th class="p-2 text-right font-semibold">Netto (kg)</th>
                    <th class="p-2 text-right font-semibold">Bizzerba (kg)</th>
                    <th class="p-2 text-right font-semibold">Výkon (${unit})</th>
                    <th class="p-2 text-center font-semibold">Akce</th>
                </tr>
            </thead><tbody>`;

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayName = dayNames[d.getDay()];
            const data = hoursData[dateString];

            if (data) {
                const dailyWriteOffs = writeOffsByDate[dateString] || 0;
                const recordedHours = parseFloat(data.hours) || 0;
                const effectiveHours = recordedHours - dailyWriteOffs;

                let performanceHtml = '---';
                const nettoKg = parseFloat(data.netto_kg) || 0;
                const bizzerbaKg = parseFloat(data.bizzerba_kg) || 0;
                const totalKg = nettoKg + bizzerbaKg;
                
                if (totalKg > 0 && effectiveHours > 0) {
                    let performance = 0;
                     if (method === 'tons_per_hour') {
                        performance = (totalKg / 1000) / effectiveHours;
                    } else { // hours_per_ton
                        performance = effectiveHours / (totalKg / 1000);
                    }
                    
                    let isOffTarget;
                    if (method === 'tons_per_hour') {
                        isOffTarget = performance < hoursSettings.optimal_tons_per_hour;
                    } else {
                        const optimalHoursPerTon = 1 / hoursSettings.optimal_tons_per_hour;
                        isOffTarget = performance > optimalHoursPerTon;
                    }
                    const colorClass = isOffTarget ? 'performance-red' : 'performance-green';
                    performanceHtml = `<span class="font-bold ${colorClass}">${performance.toFixed(3)}</span>`;
                }
                
                totalHours += effectiveHours;
                totalNetto += nettoKg;
                totalBizerba += bizzerbaKg;

                tableHTML += `
                    <tr class="border-t">
                        <td class="p-2 font-medium">${day}. ${month+1}. (${dayName})</td>
                        <td class="p-2 text-right">${data.hours}${dailyWriteOffs > 0 ? ` (-${dailyWriteOffs})` : ''}</td>
                        <td class="p-2 text-right">${nettoKg.toLocaleString('cs-CZ')}</td>
                        <td class="p-2 text-right">${bizzerbaKg.toLocaleString('cs-CZ')}</td>
                        <td class="p-2 text-right">${performanceHtml}</td>
                        <td class="p-2 text-center">
                            <button class="edit-hours-btn p-1.5 rounded-full hover:bg-slate-100" data-date="${dateString}">
                                <i data-feather="edit-2" class="w-4 h-4 text-slate-600"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
        tableHTML += `</tbody></table></div>`;
        container.innerHTML = tableHTML;
        
        let avgPerformance = 0;
        const totalProducedKg = totalNetto + totalBizerba;
        if (totalProducedKg > 0 && totalHours > 0) {
            if (method === 'tons_per_hour') {
                avgPerformance = (totalProducedKg / 1000) / totalHours;
            } else {
                avgPerformance = totalHours / (totalProducedKg / 1000);
            }
        }

        document.getElementById('hours-summary').innerHTML = `
             <h3 class="text-xl font-bold mb-4 text-gray-800">Měsíční souhrn</h3>
             <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                    <p class="text-sm text-gray-500">Celkem Netto</p>
                    <p class="text-2xl font-bold">${totalNetto.toLocaleString('cs-CZ')} kg</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Celkem Bizzerba</p>
                    <p class="text-2xl font-bold">${totalBizerba.toLocaleString('cs-CZ')} kg</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Celkem hodin (po upsání)</p>
                    <p class="text-2xl font-bold">${totalHours.toLocaleString('cs-CZ', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Průměrný výkon</p>
                    <p class="text-2xl font-bold">${avgPerformance > 0 ? avgPerformance.toFixed(3) : '0'} ${unit}</p>
                </div>
             </div>
        `;

        const writeOffsListEl = document.getElementById('write-offs-list');
        const totalWriteOffsHours = monthlyWriteOffs.reduce((sum, wo) => sum + parseFloat(wo.hours), 0);
        document.getElementById('write-offs-total').textContent = `${totalWriteOffsHours.toLocaleString('cs-CZ')} hod`;
        
        if (monthlyWriteOffs.length > 0) {
            writeOffsListEl.innerHTML = `
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th class="px-4 py-2">Datum</th>
                            <th class="px-4 py-2">Zaměstnanec</th>
                            <th class="px-4 py-2">Čip</th>
                            <th class="px-4 py-2 text-right">Upsané hodiny</th>
                            <th class="px-4 py-2 text-center">Akce</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyWriteOffs.sort((a,b) => new Date(a.date) - new Date(b.date)).map(wo => {
                            const employee = employees.find(e => e.id == wo.employeeId);
                            return `
                                <tr class="bg-white border-b">
                                    <td class="px-4 py-2">${new Date(wo.date).toLocaleDateString('cs-CZ')}</td>
                                    <td class="px-4 py-2">${employee ? `${employee.firstName} ${employee.lastName}` : 'Neznámý'}</td>
                                    <td class="px-4 py-2">${employee ? employee.chip : 'N/A'}</td>
                                    <td class="px-4 py-2 text-right font-semibold">${wo.hours}</td>
                                    <td class="px-4 py-2 text-center flex items-center justify-center gap-2">
                                        <button class="view-reason-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="info" class="w-4 h-4 text-blue-600"></i></button>
                                        <button class="edit-write-off-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="edit-2" class="w-4 h-4 text-slate-600"></i></button>
                                        <button class="delete-write-off-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="trash-2" class="w-4 h-4 text-red-600"></i></button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            writeOffsListEl.innerHTML = `<p class="text-center text-gray-500">Tento měsíc nebyly upsány žádné hodiny.</p>`;
        }
        feather.replace();
    };
    
    const openAddHoursModal = (dateString = null) => {
        addHoursForm.reset();
        const deleteBtn = document.getElementById('delete-hours-entry-btn');
        const title = document.getElementById('add-hours-modal-title');
        
        if (dateString && hoursData[dateString]) {
            const data = hoursData[dateString];
            document.getElementById('hours-date').value = dateString;
            document.getElementById('hours-worked').value = data.hours;
            document.getElementById('hours-bizzerba-kg').value = data.bizzerba_kg;
            document.getElementById('hours-netto-kg').value = data.netto_kg;
            deleteBtn.classList.remove('hidden');
            title.textContent = 'Upravit záznam';
        } else {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('hours-date').value = dateString || today;
            deleteBtn.classList.add('hidden');
            title.textContent = 'Přidat záznam o výrobě';
        }
        openModal(addHoursModal);
    };
    
    const openWriteOffHoursModal = (writeOff = null) => {
        writeOffHoursForm.reset();
        document.getElementById('write-off-employee-info').classList.add('hidden');
        
        if (writeOff) {
            document.getElementById('write-off-id').value = writeOff.id;
            const employee = employees.find(e => e.id == writeOff.employeeId);
            if (employee && employee.chip) {
                const chipInput = document.getElementById('write-off-chip');
                chipInput.value = employee.chip;
                chipInput.dispatchEvent(new Event('input'));
            }
            document.getElementById('write-off-date').value = writeOff.date;
            document.getElementById('write-off-hours').value = writeOff.hours;
            document.getElementById('write-off-reason').value = writeOff.reason;
        } else {
             document.getElementById('write-off-id').value = '';
             document.getElementById('write-off-date').value = new Date().toISOString().split('T')[0];
        }
        openModal(writeOffHoursModal);
    };

    // --- EVENT LISTENERS ---

    prevMonthBtns.forEach(btn => btn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
        setActiveView(activeView.id);
    }));

    nextMonthBtns.forEach(btn => btn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
        setActiveView(activeView.id);
    }));

    saveDataBtn.addEventListener('click', saveDataToFile);
    loadDataInput.addEventListener('change', loadDataFromFile);
    
    document.querySelector('label[for="load-data-input"]').addEventListener('click', () => loadDataInput.click());

    const openSidebar = () => {
        sidebarOverlay.classList.remove('hidden');
        sidebar.classList.remove('translate-x-full');
    };
    const closeSidebar = () => {
        sidebarOverlay.classList.add('hidden');
        sidebar.classList.add('translate-x-full');
    };
    sidebarToggleBtn.addEventListener('click', openSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // View switching
    document.getElementById('show-foremen-view').addEventListener('click', () => { setActiveView('foremen-view'); closeSidebar(); });
    document.getElementById('show-forklift-view').addEventListener('click', () => { setActiveView('forklift-view'); closeSidebar(); });
    document.getElementById('show-hours-view').addEventListener('click', () => { setActiveView('hours-view'); closeSidebar(); });
    document.getElementById('back-to-main-view-foreman').addEventListener('click', () => setActiveView('main-view'));
    document.getElementById('back-to-main-view-forklift').addEventListener('click', () => setActiveView('main-view'));
    document.getElementById('back-to-main-view-hours').addEventListener('click', () => setActiveView('main-view'));

    // Modal toggles
    document.getElementById('open-add-employee-modal').addEventListener('click', () => openEmployeeModal());
    document.getElementById('close-add-employee-modal').addEventListener('click', () => closeModal(addEmployeeModal));
    document.getElementById('open-shifts-modal').addEventListener('click', () => { updateShiftsView(); openModal(shiftsModal); });
    document.getElementById('close-shifts-modal').addEventListener('click', () => closeModal(shiftsModal));
    document.getElementById('open-add-departure-modal-main').addEventListener('click', () => { addDepartureForm.reset(); updateAddDepartureView(); openModal(addDepartureModal); });
    document.getElementById('close-add-departure-modal').addEventListener('click', () => closeModal(addDepartureModal));
    document.getElementById('open-locations-modal').addEventListener('click', () => { renderLocations(); openModal(locationsModal); });
    document.getElementById('close-locations-modal').addEventListener('click', () => closeModal(locationsModal));
    document.getElementById('cancel-add-edit-location').addEventListener('click', () => closeModal(addEditLocationModal));
    document.getElementById('close-daily-departures-modal').addEventListener('click', () => closeModal(dailyDeparturesModal));
    document.getElementById('close-fill-departure-modal').addEventListener('click', () => closeModal(fillDepartureModal));
    document.getElementById('open-add-foreman-modal').addEventListener('click', () => openAddPersonModal('foreman'));
    document.getElementById('close-add-foreman-modal').addEventListener('click', () => closeModal(document.getElementById('add-foreman-modal')));
    document.getElementById('open-foremen-list-modal').addEventListener('click', () => { renderPeopleList('foreman'); openModal(document.getElementById('foremen-list-modal')); });
    document.getElementById('close-foremen-list-modal').addEventListener('click', () => closeModal(document.getElementById('foremen-list-modal')));
    document.getElementById('close-assign-foreman-week-modal').addEventListener('click', () => closeModal(document.getElementById('assign-foreman-week-modal')));
    document.getElementById('close-weekend-foreman-modal').addEventListener('click', () => closeModal(document.getElementById('weekend-foreman-modal')));
    document.getElementById('open-add-forklift-driver-modal').addEventListener('click', () => openAddPersonModal('forklift'));
    document.getElementById('close-add-forklift-driver-modal').addEventListener('click', () => closeModal(document.getElementById('add-forklift-driver-modal')));
    document.getElementById('open-forklift-drivers-list-modal').addEventListener('click', () => { renderPeopleList('forklift'); openModal(document.getElementById('forklift-drivers-list-modal')); });
    document.getElementById('close-forklift-drivers-list-modal').addEventListener('click', () => closeModal(document.getElementById('forklift-drivers-list-modal')));
    document.getElementById('close-assign-forklift-driver-week-modal').addEventListener('click', () => closeModal(document.getElementById('assign-forklift-driver-week-modal')));
    document.getElementById('close-weekend-forklift-driver-modal').addEventListener('click', () => closeModal(document.getElementById('weekend-forklift-driver-modal')));
    document.getElementById('open-add-hours-modal').addEventListener('click', () => openAddHoursModal());
    document.getElementById('close-add-hours-modal').addEventListener('click', () => closeModal(addHoursModal));
    document.getElementById('open-hours-settings-modal').addEventListener('click', () => { document.getElementById('optimal-tons-per-hour').value = hoursSettings.optimal_tons_per_hour; document.getElementById('performance-calculation-method').value = hoursSettings.calculation_method || 'tons_per_hour'; openModal(hoursSettingsModal); });
    document.getElementById('close-hours-settings-modal').addEventListener('click', () => closeModal(hoursSettingsModal));
    document.getElementById('open-write-off-hours-modal').addEventListener('click', () => openWriteOffHoursModal());
    document.getElementById('close-write-off-hours-modal').addEventListener('click', () => closeModal(writeOffHoursModal));
    document.getElementById('close-reason-modal').addEventListener('click', () => closeModal(reasonModal));

    // Form Submissions & Form Logic
    addEmployeeForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    addDepartureForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    fillDepartureForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    addEditLocationForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    document.getElementById('add-foreman-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddPersonForm('foreman', e.target); });
    document.getElementById('add-forklift-driver-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddPersonForm('forklift', e.target); });
    document.getElementById('assign-foreman-week-form').addEventListener('submit', e => { e.preventDefault(); handleAssignWeekForm('foreman', e.target); });
    document.getElementById('assign-forklift-driver-week-form').addEventListener('submit', e => { e.preventDefault(); handleAssignWeekForm('forklift', e.target); });
    document.getElementById('weekend-foreman-form').addEventListener('submit', (e) => { e.preventDefault(); handleWeekendForm('foreman', e.target); });
    document.getElementById('weekend-forklift-driver-form').addEventListener('submit', (e) => { e.preventDefault(); handleWeekendForm('forklift', e.target); });
    addHoursForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    hoursSettingsForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */ });
    writeOffHoursForm.addEventListener('submit', e => { e.preventDefault(); /* ... */ });
    
    // Attaching form submission logic
    addEmployeeForm.onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('employee-id').value;
        const employeeData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            chip: document.getElementById('chip').value,
            shift: document.getElementById('shift').value,
            gender: document.getElementById('gender').value,
            locationId: document.getElementById('location').value,
            departureDate: document.getElementById('departureDate').value,
        };

        if (employeeId) {
            const index = employees.findIndex(emp => emp.id == employeeId);
            if (index !== -1) employees[index] = { ...employees[index], ...employeeData };
        } else {
            employees.push({ id: Date.now(), ...employeeData });
        }
        saveDataToLocalStorage();
        addEmployeeForm.reset();
        closeModal(addEmployeeModal);
        updateAllViews();
        renderCalendar();
    };

    addDepartureForm.onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('departure-employee-select').value;
        const newDate = document.getElementById('newDepartureDate').value;
        if (!employeeId || !newDate) return;
        const employee = employees.find(emp => emp.id == employeeId);
        if(employee) employee.departureDate = newDate;
        saveDataToLocalStorage();
        addDepartureForm.reset();
        closeModal(addDepartureModal);
        updateAllViews();
        renderCalendar();
    };
    
    fillDepartureForm.onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('fill-departure-employee-id').value;
        const newDate = document.getElementById('fill-departure-date').value;
        const employee = employees.find(emp => emp.id == employeeId);
        if (employee) employee.departureDate = newDate;
        saveDataToLocalStorage();
        closeModal(fillDepartureModal);
        updateAllViews();
        renderCalendar();
    };
    
    addEditLocationForm.onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('location-id').value;
        const name = document.getElementById('location-name').value;
        if (id) {
            const location = workLocations.find(l => l.id == id);
            if (location) location.name = name;
        } else {
            workLocations.push({ id: Date.now(), name: name });
        }
        saveDataToLocalStorage();
        closeModal(addEditLocationModal);
        updateAllViews();
    };

    addHoursForm.onsubmit = (e) => {
        e.preventDefault();
        const date = document.getElementById('hours-date').value;
        const data = {
            hours: document.getElementById('hours-worked').value,
            bizzerba_kg: document.getElementById('hours-bizzerba-kg').value,
            netto_kg: document.getElementById('hours-netto-kg').value,
        };
        hoursData[date] = data;
        saveDataToLocalStorage();
        closeModal(addHoursModal);
        renderHoursView();
    };

    hoursSettingsForm.onsubmit = (e) => {
        e.preventDefault();
        hoursSettings.optimal_tons_per_hour = parseFloat(document.getElementById('optimal-tons-per-hour').value);
        hoursSettings.calculation_method = document.getElementById('performance-calculation-method').value;
        saveDataToLocalStorage();
        closeModal(hoursSettingsModal);
        renderHoursView();
    };

    writeOffHoursForm.onsubmit = e => {
        e.preventDefault();
        const id = document.getElementById('write-off-id').value;
        const chip = document.getElementById('write-off-chip').value;
        const employee = employees.find(emp => emp.chip && emp.chip === chip);

        if (!employee) {
            alert('Zaměstnanec s tímto čipem nebyl nalezen.');
            return;
        }
        
        const writeOffData = {
            employeeId: employee.id,
            date: document.getElementById('write-off-date').value,
            hours: document.getElementById('write-off-hours').value,
            reason: document.getElementById('write-off-reason').value
        };

        if (id) {
            const index = hoursWriteOffs.findIndex(wo => wo.id == id);
            if (index > -1) hoursWriteOffs[index] = { ...hoursWriteOffs[index], ...writeOffData };
        } else {
            hoursWriteOffs.push({ id: Date.now(), ...writeOffData });
        }
        saveDataToLocalStorage();
        closeModal(writeOffHoursModal);
        renderHoursView();
    };


    // Event Delegation on the main view container
    const employeeView = document.getElementById('view-employees');
    if (employeeView) {
        employeeView.addEventListener('click', (e) => {
            if (e.target.closest('.delete-employee-shift-btn')) {
                deleteEmployee(e.target.closest('.delete-employee-shift-btn').dataset.id);
                updateShiftsView();
            }
            if (e.target.closest('.departure-count')) {
                renderDailyDeparturesModal(e.target.closest('.departure-count').dataset.date);
            }
            if (e.target.closest('.edit-employee-btn')) {
                const employee = employees.find(emp => emp.id == e.target.closest('.edit-employee-btn').dataset.id);
                if (employee) openEmployeeModal(employee);
            }
             if (e.target.closest('.delete-employee-daily-btn')) {
                deleteEmployee(e.target.closest('.delete-employee-daily-btn').dataset.id);
                closeModal(dailyDeparturesModal);
                renderCalendar();
            }
            if (e.target.closest('.location-header')) {
                const header = e.target.closest('.location-header');
                const content = header.nextElementSibling;
                const icon = header.querySelector('.location-toggle-icon');
                content.classList.toggle('max-h-0');
                icon.classList.toggle('rotate-180');
            }
            if (e.target.closest('.fill-departure-btn')) {
                const id = e.target.closest('.fill-departure-btn').dataset.id;
                const employee = employees.find(emp => emp.id == id);
                if (employee) {
                    document.getElementById('fill-departure-employee-id').value = id;
                    document.getElementById('fill-departure-title').textContent = `Doplnit odjezd: ${employee.firstName} ${employee.lastName}`;
                    openModal(fillDepartureModal);
                }
            }
            if (e.target.closest('#open-add-location-button')) {
                addEditLocationForm.reset();
                document.getElementById('add-edit-location-title').textContent = 'Přidat nové umístění';
                document.getElementById('location-id').value = '';
                openModal(addEditLocationModal);
            }
            if (e.target.closest('.edit-location-btn')) {
                const location = workLocations.find(loc => loc.id == e.target.closest('.edit-location-btn').dataset.id);
                if (location) {
                    document.getElementById('add-edit-location-title').textContent = 'Upravit umístění';
                    document.getElementById('location-id').value = location.id;
                    document.getElementById('location-name').value = location.name;
                    openModal(addEditLocationModal);
                }
            }
            if (e.target.closest('.delete-location-btn')) {
                const locationId = e.target.closest('.delete-location-btn').dataset.id;
                if (employees.some(emp => emp.locationId == locationId)) {
                    alert('Nelze smazat umístění, které je přiřazeno zaměstnancům.');
                    return;
                }
                if (confirm('Opravdu chcete smazat toto umístění?')) {
                    workLocations = workLocations.filter(loc => loc.id != locationId);
                    saveDataToLocalStorage();
                    updateAllViews();
                }
            }
            if (e.target.closest('.schedule-week-number')) {
                const el = e.target.closest('.schedule-week-number');
                openAssignPersonToWeekModal(el.dataset.personType, el.dataset.weekStartDate, el.dataset.weekNumber);
            }
            if (e.target.closest('.edit-person-btn')) {
                const el = e.target.closest('.edit-person-btn');
                const personType = el.dataset.personType;
                const people = personType === 'foreman' ? foremen : forkliftDrivers;
                const person = people.find(p => p.id == el.dataset.id);
                if (person) openAddPersonModal(personType, person);
            }
            if (e.target.closest('.delete-person-btn')) {
                const el = e.target.closest('.delete-person-btn');
                const personType = el.dataset.personType;
                const personId = el.dataset.id;
                if (confirm('Opravdu chcete smazat tuto osobu?')) {
                    if (personType === 'foreman') foremen = foremen.filter(p => p.id != personId);
                    else forkliftDrivers = forkliftDrivers.filter(p => p.id != personId);
                    saveDataToLocalStorage();
                    renderPeopleList(personType);
                    renderScheduleCalendar(personType);
                }
            }
            if (e.target.closest('.edit-hours-btn')) {
                openAddHoursModal(e.target.closest('.edit-hours-btn').dataset.date);
            }
            if (e.target.closest('#delete-hours-entry-btn')) {
                const date = document.getElementById('hours-date').value;
                if (confirm(`Opravdu chcete smazat záznam pro ${date}?`)) {
                    delete hoursData[date];
                    saveDataToLocalStorage();
                    closeModal(addHoursModal);
                    renderHoursView();
                }
            }
            if (e.target.closest('.view-reason-btn')) {
                const writeOff = hoursWriteOffs.find(wo => wo.id == e.target.closest('.view-reason-btn').dataset.id);
                if (writeOff) {
                    document.getElementById('reason-modal-content').textContent = writeOff.reason;
                    openModal(reasonModal);
                }
            }
            if (e.target.closest('.edit-write-off-btn')) {
                const writeOff = hoursWriteOffs.find(wo => wo.id == e.target.closest('.edit-write-off-btn').dataset.id);
                if (writeOff) openWriteOffHoursModal(writeOff);
            }
            if (e.target.closest('.delete-write-off-btn')) {
                const id = e.target.closest('.delete-write-off-btn').dataset.id;
                if (confirm('Opravdu chcete smazat tento záznam o upsání hodin?')) {
                    hoursWriteOffs = hoursWriteOffs.filter(wo => wo.id != id);
                    saveDataToLocalStorage();
                    renderHoursView();
                }
            }
        });

        employeeView.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.schedule-pill')) {
                e.preventDefault();
                const pill = e.target.closest('.schedule-pill');
                if (pill.classList.contains('vacation')) return;
                schedulePillContextMenu.style.top = `${e.pageY}px`;
                schedulePillContextMenu.style.left = `${e.pageX}px`;
                schedulePillContextMenu.classList.remove('hidden');
                schedulePillContextMenu.dataset.personType = pill.dataset.personType;
                schedulePillContextMenu.dataset.personId = pill.dataset.personId;
                schedulePillContextMenu.dataset.date = pill.dataset.date;
                schedulePillContextMenu.dataset.shift = pill.dataset.shift;
            }
        });
        
        employeeView.addEventListener('input', (e) => {
            if (e.target.matches('#write-off-chip')) {
                const chip = e.target.value;
                const employee = employees.find(emp => emp.chip && emp.chip === chip);
                const infoEl = document.getElementById('write-off-employee-info');
                if (employee) {
                    infoEl.innerHTML = `
                        <p><strong>Jméno:</strong> ${employee.firstName} ${employee.lastName}</p>
                        <p><strong>Umístění:</strong> ${workLocations.find(l=>l.id == employee.locationId)?.name || 'N/A'}</p>
                    `;
                    infoEl.classList.remove('hidden');
                } else {
                    infoEl.classList.add('hidden');
                }
            }
        });
    }

    // --- INITIAL RENDER ---
    setActiveView('main-view');
}
