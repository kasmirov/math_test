// API базовый URL
const API_BASE_URL = '/api';

let validationMode = 'warning';

// Схема по умолчанию
const defaultSchema = {
	"limits": {
		"type": "object",
		"children": ["sum", "mult", "div", "roman_conversion", "roman_sum"],
		"description": "Настройка пределов выражений в тестах"
	},
	"limits.sum": {
		"type": "object",
		"children": ["add", "result"],
		"description": "Операция сложения"
	},
	"limits.sum.add": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры для сложения"
	},
	"limits.sum.add.min": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Минимальное значение для сложения"
	},
	"limits.sum.add.max": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Максимальное значение для сложения"
	},
	"limits.sum.result": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры результата сложения"
	},
	"limits.sum.result.min": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Минимальное значение результата"
	},
	"limits.sum.result.max": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Максимальное значение результата"
	},
	"limits.mult": {
		"type": "object",
		"children": ["factor", "result"],
		"description": "Операция умножения"
	},
	"limits.mult.factor": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры множителя"
	},
	"limits.mult.factor.min": {
		"type": "number",
		"min": -1000,
		"max": 100,
		"description": "Минимальное значение множителя"
	},
	"limits.mult.factor.max": {
		"type": "number",
		"min": -1000,
		"max": 100,
		"description": "Максимальное значение множителя"
	},
	"limits.mult.result": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры результата умножения"
	},
	"limits.mult.result.min": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Минимальное значение результата"
	},
	"limits.mult.result.max": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Максимальное значение результата"
	},
	"limits.div": {
		"type": "object",
		"children": ["dividend", "divisor", "result"],
		"description": "Операция деления"
	},
	"limits.div.dividend": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры делимого"
	},
	"limits.div.dividend.min": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Минимальное значение делимого"
	},
	"limits.div.dividend.max": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Максимальное значение делимого"
	},
	"limits.div.divisor": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры делителя"
	},
	"limits.div.divisor.min": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Минимальное значение делителя"
	},
	"limits.div.divisor.max": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Максимальное значение делителя"
	},
	"limits.div.result": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры результата деления"
	},
	"limits.div.result.min": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Минимальное значение результата"
	},
	"limits.div.result.max": {
		"type": "number",
		"min": -1000,
		"max": 1000,
		"description": "Максимальное значение результата"
	},
	"limits.roman_conversion": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры для конвертации арабские-римские числа"
	},
	"limits.roman_conversion.min": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Минимальное величина"
	},
	"limits.roman_conversion.max": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Максимальная величина"
	},
	"limits.roman_sum": {
		"type": "object",
		"children": ["add", "result"],
		"description": "Операции сложения и вычитания над римскими числами"
	},
	"limits.roman_sum.add": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры для сложения"
	},
	"limits.roman_sum.add.min": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Минимальное значение для сложения"
	},
	"limits.roman_sum.add.max": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Максимальное значение для сложения"
	},
	"limits.roman_sum.result": {
		"type": "object",
		"children": ["min", "max"],
		"description": "Параметры результата сложения"
	},
	"limits.roman_sum.result.min": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Минимальное значение результата"
	},
	"limits.roman_sum.result.max": {
		"type": "number",
		"min": 1,
		"max": 1000,
		"description": "Максимальное значение результата"
	},
};

class AccountPage {
    constructor() {
        this.currentUser = null;
        this.profiles = [];
        this.selectedProfiles = new Set();
        this.editingProfileId = null;
        this.editingField = null;
        this.originalValue = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initAccountWidget();
        await this.checkAuthAndLoadData();
    }

    initAccountWidget() {
        // Инициализируем виджет с настройками для страницы аккаунта
        const accountWidget = AccountWidget.getInstance({
            apiBaseUrl: API_BASE_URL,
            alignment: 'right',
            container: '.user-menu-container',
            accountPageUrl: '/account.html',
            showSettings: false,
            showProfiles: false,

            onLogin: (user) => {
                this.currentUser = user;
                this.showAuthenticated();
                this.loadAccountData(user);
                this.loadProfilesFromServer();
            },

            onLogout: () => {
                this.currentUser = null;
                this.profiles = [];
                this.selectedProfiles.clear();
                this.showNotAuthenticated();
            },

            onAccountUpdate: (user) => {
                this.currentUser = user;
                this.loadAccountData(user);
            },

            onProfileClick: (profile) => {
                console.log('Выбран профиль:', profile);
            },

            onAuthRefresh: (user, profilesList) => {
                this.currentUser = user;
                this.profiles = profilesList || [];
                if (user) {
                    this.showAuthenticated();
                    this.loadAccountData(user);
                    this.loadProfilesTable(this.profiles);
                }
            }
        });

        window.accountWidget = accountWidget;
    }

    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // Форма аккаунта
        const accountForm = document.getElementById('accountForm');
        if (accountForm) {
            accountForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateAccount();
            });
        }

        // Кнопка удаления аккаунта
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                this.deleteAccount();
            });
        }

        // Кнопка нового профиля
        const newProfileBtn = document.getElementById('newProfileBtn');
        if (newProfileBtn) {
            newProfileBtn.addEventListener('click', () => {
                this.showNewProfileModal();
            });
        }

        // Кнопка удаления выбранных профилей
        const deleteSelectedBtn = document.getElementById('deleteSelectedProfileBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                this.deleteSelectedProfiles();
            });
        }

        // Глобальный обработчик для клавиш (Escape для отмены редактирования)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.editingProfileId) {
                this.cancelEditing();
            }
        });

        // Глобальный обработчик кликов для завершения редактирования
        document.addEventListener('click', (e) => {
            if (this.editingProfileId &&
                !e.target.closest('.editable-input') &&
                !e.target.closest('.editable-select') &&
                !e.target.classList.contains('editable-cell')) {
                this.saveCurrentEditing();
            }
        });

        // Делегирование событий для таблицы
        this.setupTableEventDelegation();
    }

    setupTableEventDelegation() {
        const tbody = document.getElementById('profilesTableBody');
        if (!tbody) return;

        // Обработчик для чекбоксов
        tbody.addEventListener('change', (e) => {
            if (e.target.classList.contains('profile-checkbox')) {
                const profileId = parseInt(e.target.getAttribute('data-profile-id'));
                const row = e.target.closest('tr');

                if (e.target.checked) {
                    this.selectedProfiles.add(profileId);
                    row.classList.add('selected');
                } else {
                    this.selectedProfiles.delete(profileId);
                    row.classList.remove('selected');
                }

                this.updateDeleteButton();
            }
        });

        // Обработчик для редактируемых ячеек
        tbody.addEventListener('click', (e) => {
            const editableCell = e.target.closest('.editable-cell');
            if (editableCell && !this.editingProfileId) {
                e.stopPropagation();
                const profileId = parseInt(editableCell.getAttribute('data-profile-id'));
                const field = editableCell.getAttribute('data-field');
                this.startEditing(editableCell, profileId, field);
                return;
            }

            // Обработчик для кнопки редактирования настроек
            if (e.target.classList.contains('edit-settings-btn')) {
                const profileId = parseInt(e.target.getAttribute('data-profile-id'));
                this.showEditSettingsModal(profileId);
                return;
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    async checkAuthAndLoadData() {
        try {
            if (window.accountWidget && window.accountWidget.isAuthenticated()) {
                this.currentUser = window.accountWidget.getUser();
                this.profiles = window.accountWidget.getProfiles();
                this.showAuthenticated();
                this.loadAccountData(this.currentUser);
                this.loadProfilesTable(this.profiles);
            } else {
                await this.loadAccountDataFromServer();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showNotAuthenticated();
        }
    }

    async loadAccountDataFromServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/account`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.profiles = data.profiles || [];
                this.showAuthenticated();
                this.loadAccountData(this.currentUser);
                this.loadProfilesTable(this.profiles);
            } else {
                this.showNotAuthenticated();
            }
        } catch (error) {
            console.error('Failed to load account data:', error);
            this.showNotAuthenticated();
        }
    }

    showAuthenticated() {
        const notAuthenticated = document.getElementById('notAuthenticated');
        const authenticatedContent = document.getElementById('authenticatedContent');

        if (notAuthenticated) notAuthenticated.style.display = 'none';
        if (authenticatedContent) authenticatedContent.style.display = 'block';
    }

    showNotAuthenticated() {
        const notAuthenticated = document.getElementById('notAuthenticated');
        const authenticatedContent = document.getElementById('authenticatedContent');

        if (notAuthenticated) notAuthenticated.style.display = 'block';
        if (authenticatedContent) authenticatedContent.style.display = 'none';
    }

    loadAccountData(user) {
        if (!user) return;

        const emailInput = document.getElementById('accountEmail');
        const usernameInput = document.getElementById('accountUsername');
        const createdAtSpan = document.getElementById('accountCreatedAt');
        const profilesCountSpan = document.getElementById('profilesCount');

        if (emailInput) emailInput.value = user.email || '';
        if (usernameInput) usernameInput.value = user.username || '';

        if (createdAtSpan) {
            createdAtSpan.textContent = user.created_at
                ? new Date(user.created_at).toLocaleDateString('ru-RU')
                : '—';
        }

        if (profilesCountSpan) {
            profilesCountSpan.textContent = this.profiles.length;
        }
    }

    loadProfilesTable(profiles) {
        const tbody = document.getElementById('profilesTableBody');
        if (!tbody) return;

        this.selectedProfiles.clear();
        this.updateDeleteButton();

        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table-message">
                        У вас пока нет профилей. Нажмите "Новый профиль" для создания первого профиля.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = profiles.map(profile => `
            <tr data-profile-id="${profile.id}" class="${this.selectedProfiles.has(profile.id) ? 'selected' : ''}">
                <td>
                    <input type="checkbox" class="profile-checkbox"
                           data-profile-id="${profile.id}"
                           ${this.selectedProfiles.has(profile.id) ? 'checked' : ''}>
                </td>
                <td>
                    <div class="editable-cell profile-name-cell"
                         data-profile-id="${profile.id}"
                         data-field="name">
                        ${profile.name || ''}
                    </div>
                </td>
                <td>
                    <div class="editable-cell profile-type-cell"
                         data-profile-id="${profile.id}"
                         data-field="type">
                        ${this.getProfileTypeName(profile.type || 'personal')}
                    </div>
                </td>
                <td>
                    <button class="edit-settings-btn" data-profile-id="${profile.id}">
                        Редактировать
                    </button>
                </td>
                <td>
                    <div class="created-date">
                        ${profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : '—'}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    startEditing(cell, profileId, field) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        this.editingProfileId = profileId;
        this.editingField = field;
        this.originalValue = profile[field];

        // Сохраняем текущее содержимое ячейки
        const originalContent = cell.innerHTML;

        if (field === 'name') {
            cell.innerHTML = `
                <input type="text" class="editable-input"
                       value="${profile.name || ''}"
                       data-profile-id="${profileId}"
                       data-field="${field}">
            `;

            const input = cell.querySelector('.editable-input');
            input.focus();
            input.select();

            // Сохраняем оригинальное содержимое в data-атрибуте
            cell.dataset.originalContent = originalContent;

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveEditing(profileId, field, e.target.value);
                } else if (e.key === 'Escape') {
                    this.cancelEditing();
                }
            });

            select.addEventListener('blur', (e) => {
                if (this.editingProfileId === profileId) {
                    this.saveEditing(profileId, field, e.target.value);
                }
            });
        } else if (field === 'type') {
            const typeOptions = [
                { value: 'personal', label: 'Личный' },
                { value: 'work', label: 'Рабочий' },
                { value: 'game', label: 'Игровой' },
                { value: 'other', label: 'Другой' }
            ];

            cell.innerHTML = `
                <select class="editable-select"
                        data-profile-id="${profileId}"
                        data-field="${field}">
                    ${typeOptions.map(option => `
                        <option value="${option.value}" ${profile.type === option.value ? 'selected' : ''}>
                            ${option.label}
                        </option>
                    `).join('')}
                </select>
            `;

            const select = cell.querySelector('.editable-select');
            select.focus();

            // Сохраняем оригинальное содержимое в data-атрибуте
            cell.dataset.originalContent = originalContent;

            select.addEventListener('change', (e) => {
                this.saveEditing(profileId, field, e.target.value);
            });

            select.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.cancelEditing();
                }
            });

            select.addEventListener('blur', (e) => {
                if (this.editingProfileId === profileId) {
                    this.saveEditing(profileId, field, e.target.value);
                }
            });
        }
    }

    async saveEditing(profileId, field, value) {
        if (value === this.originalValue || !value.trim()) {
            this.cancelEditing();
            return;
        }

        try {
            const updateData = {};
            updateData[field] = field === 'type' ? value : value.trim();

            const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                const updatedProfile = await response.json();

                // Обновляем данные в массиве - явно обновляем поле
                const index = this.profiles.findIndex(p => p.id === profileId);
                if (index !== -1) {
                    // Явно обновляем поле, которое изменили
                    this.profiles[index][field] = value;

                    // Если сервер вернул обновленный профиль, обновляем остальные поля
                    if (updatedProfile && typeof updatedProfile === 'object') {
                        this.profiles[index] = { ...this.profiles[index], ...updatedProfile };
                    }
                }

                // Обновляем виджет
                if (window.accountWidget) {
                    window.accountWidget.profiles = this.profiles;
                    if (window.accountWidget.updateProfilesDisplay) {
                        window.accountWidget.updateProfilesDisplay();
                    }
                }

                this.showAlert('success', 'Профиль обновлен!', 'profileAlert');
                this.cancelEditing();

                // Вместо полной перезагрузки таблицы, обновляем только измененную строку
                this.updateProfileRow(profileId);
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при обновлении профиля', 'profileAlert');
                this.cancelEditing();
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
            this.cancelEditing();
        }
    }

    // Добавьте эту новую функцию в класс
    updateProfileRow(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        const row = document.querySelector(`tr[data-profile-id="${profileId}"]`);
        if (!row) return;

        // Обновляем ячейку с именем
        const nameCell = row.querySelector('.profile-name-cell');
        if (nameCell) {
            nameCell.textContent = profile.name || '';
        }

        // Обновляем ячейку с типом профиля
        const typeCell = row.querySelector('.profile-type-cell');
        if (typeCell) {
            typeCell.textContent = this.getProfileTypeName(profile.type || 'personal');
        }

        // Обновляем дату создания (на случай если она тоже изменилась)
        const dateCell = row.querySelector('.created-date');
        if (dateCell && profile.created_at) {
            dateCell.textContent = new Date(profile.created_at).toLocaleDateString('ru-RU');
        }
    }

    cancelEditing() {
        if (!this.editingProfileId || !this.editingField) return;

        // Восстанавливаем оригинальное содержимое ячейки
        const cell = document.querySelector(`.editable-cell[data-profile-id="${this.editingProfileId}"][data-field="${this.editingField}"]`);
        if (cell && cell.dataset.originalContent) {
            cell.innerHTML = cell.dataset.originalContent;
        }

        this.editingProfileId = null;
        this.editingField = null;
        this.originalValue = null;
    }

    saveCurrentEditing() {
        if (!this.editingProfileId || !this.editingField) return;

        const cell = document.querySelector(`.editable-cell[data-profile-id="${this.editingProfileId}"][data-field="${this.editingField}"]`);
        if (!cell) return;

        if (this.editingField === 'name') {
            const input = cell.querySelector('.editable-input');
            if (input) {
                this.saveEditing(this.editingProfileId, 'name', input.value);
            }
        } else if (this.editingField === 'type') {
            const select = cell.querySelector('.editable-select');
            if (select) {
                this.saveEditing(this.editingProfileId, 'type', select.value);
            }
        }
    }

    showNewProfileModal() {
        const modalHtml = `
            <div class="modal-overlay" id="newProfileModal">
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Новый профиль</h3>
                        <button class="modal-close" id="closeNewProfileModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="newProfileName">Название профиля:</label>
                            <input type="text" id="newProfileName" class="form-control" placeholder="Введите название">
                        </div>
                        <div class="form-group">
                            <label for="newProfileType">Тип профиля:</label>
                            <select id="newProfileType" class="form-control">
                                <option value="personal">Личный</option>
                                <option value="work">Рабочий</option>
                                <option value="game">Игровой</option>
                                <option value="other">Другой</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="json-editor-label">Настройки:</label>
								<div class="tree-actions">
									<button id="expandAllButton">Развернуть все</button>
									<button id="collapseAllButton">Свернуть все</button>
								</div>
							<!-- Контейнер для виджета дерева -->
                            <div id="newProfileTreeEditor"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelNewProfileBtn">Отмена</button>
                        <button class="btn btn-primary" id="saveNewProfileBtn">Создать</button>
                    </div>
                </div>
            </div>
        `;

        // Удаляем старую модалку если есть
        const oldModal = document.getElementById('newProfileModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('newProfileModal');
        const closeBtn = document.getElementById('closeNewProfileModal');
        const cancelBtn = document.getElementById('cancelNewProfileBtn');
        const saveBtn = document.getElementById('saveNewProfileBtn');
        const expandAllBtn = document.getElementById('expandAllButton');
        const collapseAllBtn = document.getElementById('collapseAllButton');
			
        let treeEditor = null;
		let settings = null;

        const showModal = () => {
            setTimeout(() => {
                modal.classList.add('active');

                // Инициализируем древовидный редактор
                const treeContainer = document.getElementById('newProfileTreeEditor');
				if (treeEditor) {
					treeEditor.destroy();
				}
				treeEditor = new TreeEditor({
					container: treeContainer,
					initialData: { limits: {} },
					initialSchema: defaultSchema,
					validationMode: validationMode,
					onDataChange: function(data) {
						settings = data;
					},
					onValidationChange: function(validation) {
						//showAlert(validation.message, validation.type);
					}
				});

                expandAllBtn.addEventListener('click', () => {
                    treeEditor.expandAll();
                });

                collapseAllBtn.addEventListener('click', () => {
                    treeEditor.collapseAll();
                });

                document.getElementById('newProfileName').focus();
            }, 10);
        };

        const hideModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);

        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('newProfileName').value.trim();
            const type = document.getElementById('newProfileType').value;

            if (!name) {
                this.showAlert('error', 'Название профиля обязательно', 'profileAlert');
                return;
            }


            saveBtn.disabled = true;
            saveBtn.textContent = 'Создание...';

            try {
                await this.createProfile({ name, type, settings });
                hideModal();
            } catch (error) {
                console.error('Error creating profile:', error);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Создать';
            }
        });

        // Закрытие по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });

        showModal();
    }

    showEditSettingsModal(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        const modalHtml = `
            <div class="modal-overlay" id="editSettingsModal">
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Настройки профиля "${profile.name}"</h3>
                        <button class="modal-close" id="closeEditSettingsModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <div class="tree-actions">
                                <button id="editExpandAllBtn">Развернуть все</button>
                                <button id="editCollapseAllBtn">Свернуть все</button>
                            </div>
                            <div id="editProfileTreeEditor" class="tree-editor-container"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelEditSettingsBtn">Отмена</button>
                        <button class="btn btn-primary" id="saveEditSettingsBtn">Сохранить</button>
                    </div>
                </div>
            </div>
        `;

        // Удаляем старую модалку если есть
        const oldModal = document.getElementById('editSettingsModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('editSettingsModal');
        const closeBtn = document.getElementById('closeEditSettingsModal');
        const cancelBtn = document.getElementById('cancelEditSettingsBtn');
        const saveBtn = document.getElementById('saveEditSettingsBtn');
        const expandAllBtn = document.getElementById('editExpandAllBtn');
        const collapseAllBtn = document.getElementById('editCollapseAllBtn');
		
        let treeEditor = null;

        const showModal = () => {
            setTimeout(() => {
                modal.classList.add('active');

                // Инициализируем древовидный редактор
				const settings = profile.settings || { limits: {} };
                const treeContainer = document.getElementById('editProfileTreeEditor');
				if (treeEditor) {
					treeEditor.destroy();
				}
				treeEditor = new TreeEditor({
					container: treeContainer,
					initialData: settings,
					initialSchema: defaultSchema,
					validationMode: validationMode,
					onDataChange: function(data) {
						settings = data;
					},
					onValidationChange: function(validation) {
						//showAlert(validation.message, validation.type);
					}
				});

                expandAllBtn.addEventListener('click', () => {
                    treeEditor.expandAll();
                });

                collapseAllBtn.addEventListener('click', () => {
                    treeEditor.collapseAll();
                });

                document.getElementById('editSettingsModal').focus();
            }, 10);
        };

        const hideModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);

        saveBtn.addEventListener('click', async () => {
            // Получаем данные из древовидного редактора
            const settings = treeEditor ? treeEditor.getData() : {};

            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';

            try {
                const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ settings })
                });

                if (response.ok) {
                    const updatedProfile = await response.json();

                    // Обновляем данные в массиве
                    const index = this.profiles.findIndex(p => p.id === profileId);
                    if (index !== -1) {
                        this.profiles[index] = updatedProfile;
                    }

                    // Обновляем виджет
                    if (window.accountWidget) {
                        window.accountWidget.profiles = this.profiles;
                        if (window.accountWidget.updateProfilesDisplay) {
                            window.accountWidget.updateProfilesDisplay();
                        }
                    }

                    this.showAlert('success', 'Настройки профиля обновлены!', 'profileAlert');
                    hideModal();
                } else {
                    const error = await response.json();
                    this.showAlert('error', error.error || 'Ошибка при обновлении настроек', 'profileAlert');
                }
            } catch (error) {
                this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Сохранить';
            }
        });

        // Закрытие по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });

        showModal();
    }

    async createProfile(profileData) {
        try {
            const response = await fetch(`${API_BASE_URL}/profiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showAlert('success', 'Профиль создан!', 'profileAlert');

                // Обновляем список профилей
                await this.loadProfilesFromServer();
                return result;
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при создании профиля', 'profileAlert');
                throw new Error(error.error || 'Ошибка при создании профиля');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
            throw error;
        }
    }

    async deleteSelectedProfiles() {
        if (this.selectedProfiles.size === 0) return;

        if (!confirm(`Вы уверены, что хотите удалить ${this.selectedProfiles.size} профиль(ей)?`)) {
            return;
        }

        const deletePromises = Array.from(this.selectedProfiles).map(profileId =>
            fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                method: 'DELETE',
                credentials: 'include'
            })
        );

        try {
            const results = await Promise.all(deletePromises);
            const allSuccessful = results.every(response => response.ok);

            if (allSuccessful) {
                this.showAlert('success', 'Выбранные профили удалены!', 'profileAlert');
                await this.loadProfilesFromServer();
            } else {
                this.showAlert('error', 'Не удалось удалить некоторые профили', 'profileAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
        }
    }

    updateDeleteButton() {
        const deleteBtn = document.getElementById('deleteSelectedProfileBtn');
        if (!deleteBtn) return;

        if (this.selectedProfiles.size > 0) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = `Удалить (${this.selectedProfiles.size})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Удалить';
        }
    }

    async updateAccount() {
        const formData = {
            username: document.getElementById('accountUsername').value.trim()
        };

        if (!formData.username) {
            this.showAlert('error', 'Имя пользователя не может быть пустым', 'accountAlert');
            return;
        }

        this.setLoadingState(true, 'accountForm');

        try {
            const response = await fetch(`${API_BASE_URL}/account`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showAlert('success', 'Настройки аккаунта обновлены!', 'accountAlert');

                if (window.accountWidget && result.user) {
                    window.accountWidget.currentUser = result.user;
                }
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при обновлении аккаунта', 'accountAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'accountAlert');
        } finally {
            this.setLoadingState(false, 'accountForm');
        }
    }

    async deleteAccount() {
        if (!confirm('Вы уверены, что хотите удалить аккаунт? Это действие невозможно отменить. Все ваши данные и профили будут удалены.')) {
            return;
        }

        if (!confirm('Это последнее предупреждение. Вы точно хотите удалить аккаунт?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/account`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert('Аккаунт удален!');
                window.location.href = '/';
            } else {
                const error = await response.json();
                alert('Ошибка: ' + (error.error || 'Не удалось удалить аккаунт'));
            }
        } catch (error) {
            alert('Ошибка сети: ' + error.message);
        }
    }

    async loadProfilesFromServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/profiles`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const profiles = await response.json();
                this.profiles = profiles;
                this.loadProfilesTable(profiles);

                const profilesCountSpan = document.getElementById('profilesCount');
                if (profilesCountSpan) {
                    profilesCountSpan.textContent = profiles.length;
                }

                if (window.accountWidget) {
                    window.accountWidget.profiles = profiles;
                    if (window.accountWidget.updateProfilesDisplay) {
                        window.accountWidget.updateProfilesDisplay();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    }

    setLoadingState(loading, formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach(btn => {
            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
                btn.innerHTML = btn.textContent + '...';
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
                btn.innerHTML = btn.textContent.replace('...', '');
            }
        });
    }

    showAlert(type, message, containerId) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass}`;
        alert.textContent = message;

        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        container.appendChild(alert);
        alert.style.display = 'block';

        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    getProfileTypeName(type) {
        const types = {
            'personal': 'Личный',
            'work': 'Рабочий',
            'game': 'Игровой',
            'other': 'Другой'
        };
        return types[type] || type;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.accountPage = new AccountPage();
});