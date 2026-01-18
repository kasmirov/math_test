// API базовый URL
const API_BASE_URL = '/api';

class AccountPage {
    constructor() {
        this.currentUser = null;
        this.profiles = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initAccountWidget();
        await this.checkAuthAndLoadData();
    }

    initAccountWidget() {
        // Инициализируем виджет с настройками для страницы аккаунта
        const accountWidget = new AccountWidget({
            apiBaseUrl: API_BASE_URL,
            alignment: 'right',
            container: '.new-menu-container',
            accountPageUrl: '/account.html',
            showSettings: false,
            showProfiles: false,

            onLogin: (user) => {
                console.log('Пользователь вошел:', user);
                this.currentUser = user;
                this.showAuthenticated();
                this.loadAccountData(user);
                this.loadProfilesFromServer();
            },

            onLogout: () => {
                console.log('Пользователь вышел');
                this.currentUser = null;
                this.profiles = [];
                this.showNotAuthenticated();
            },

            onAccountUpdate: (user) => {
                console.log('Данные пользователя обновлены:', user);
                this.currentUser = user;
                this.loadAccountData(user);
            },

            onProfileClick: (profile) => {
                console.log('Выбран профиль:', profile);
            },

            onAuthRefresh: (user, profilesList) => {
                console.log('Состояние аутентификации обновлено:', user);
                this.currentUser = user;
                this.profiles = profilesList || [];
                if (user) {
                    this.showAuthenticated();
                    this.loadAccountData(user);
                    this.loadProfilesData(this.profiles);
                }
            }
        });

        // Сохраняем для глобального доступа
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

        // Форма создания профиля
        const createProfileForm = document.getElementById('createProfileForm');
        if (createProfileForm) {
            createProfileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createProfile();
            });
        }

        // Удаление аккаунта
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                this.deleteAccount();
            });
        }
    }

    switchTab(tabName) {
        // Обновляем активные вкладки
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    async checkAuthAndLoadData() {
        try {
            // Используем глобальный виджет для проверки аутентификации
            if (window.accountWidget && window.accountWidget.isAuthenticated()) {
                this.currentUser = window.accountWidget.getUser();
                this.profiles = window.accountWidget.getProfiles();
                this.showAuthenticated();
                this.loadAccountData(this.currentUser);
                this.loadProfilesData(this.profiles);
            } else {
                // Если виджет не аутентифицирован, пробуем самостоятельно
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
                this.loadProfilesData(this.profiles);
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

    loadProfilesData(profiles) {
        const container = document.getElementById('profilesList');
        if (!container) return;

        if (!profiles || profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>У вас пока нет профилей</p>
                    <p style="font-size: 12px;">Создайте первый профиль, используя форму слева</p>
                </div>
            `;
            return;
        }

        container.innerHTML = profiles.map(profile => `
            <div class="profile-card" data-profile-id="${profile.id}">
                <div class="profile-header">
                    <div>
                        <div class="profile-name">${profile.name}</div>
                        <div class="profile-type">${this.getProfileTypeName(profile.type)}</div>
                    </div>
                    <div class="profile-actions">
                        <button class="btn btn-secondary edit-profile-btn" data-profile-id="${profile.id}">Ред.</button>
                        <button class="btn btn-secondary clone-profile-btn" data-profile-id="${profile.id}">Клон</button>
                        <button class="btn btn-danger delete-profile-btn" data-profile-id="${profile.id}">Уд.</button>
                    </div>
                </div>
                ${Object.keys(profile.settings || {}).length > 0 ? `
                    <div class="profile-settings">
                        ${JSON.stringify(profile.settings, null, 2)}
                    </div>
                ` : ''}
                <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
                    Создан: ${new Date(profile.created_at).toLocaleDateString('ru-RU')}
                </div>
            </div>
        `).join('');

        // Добавляем обработчики для кнопок профилей
        this.setupProfileEventListeners();
    }

    setupProfileEventListeners() {
        // Редактирование профиля
        document.querySelectorAll('.edit-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = parseInt(e.target.getAttribute('data-profile-id'));
                this.editProfile(profileId);
            });
        });

        // Клонирование профиля
        document.querySelectorAll('.clone-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = parseInt(e.target.getAttribute('data-profile-id'));
                this.cloneProfile(profileId);
            });
        });

        // Удаление профиля
        document.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = parseInt(e.target.getAttribute('data-profile-id'));
                this.deleteProfile(profileId);
            });
        });
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

                // Обновляем данные в виджете
                if (window.accountWidget && result.user) {
                    window.accountWidget.currentUser = result.user;
                    // Если у виджета есть метод updateUserInfo, используем его
                    if (window.accountWidget.updateUserInfo) {
                        window.accountWidget.updateUserInfo();
                    }
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

    async createProfile() {
        const nameInput = document.getElementById('profileName');
        const typeSelect = document.getElementById('profileType');

        if (!nameInput || !typeSelect) return;

        const formData = {
            name: nameInput.value.trim(),
            type: typeSelect.value
        };

        if (!formData.name) {
            this.showAlert('error', 'Название профиля не может быть пустым', 'profileAlert');
            return;
        }

        this.setLoadingState(true, 'createProfileForm');

        try {
            const response = await fetch(`${API_BASE_URL}/profiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showAlert('success', 'Профиль создан!', 'profileAlert');
                nameInput.value = '';

                // Обновляем список профилей
                await this.loadProfilesFromServer();
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при создании профиля', 'profileAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
        } finally {
            this.setLoadingState(false, 'createProfileForm');
        }
    }

    async editProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        const newName = prompt('Введите новое название профиля:', profile.name);
        if (newName && newName.trim() && newName !== profile.name) {
            try {
                const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ name: newName.trim() })
                });

                if (response.ok) {
                    this.showAlert('success', 'Профиль обновлен!', 'profileAlert');
                    await this.loadProfilesFromServer();
                } else {
                    const error = await response.json();
                    this.showAlert('error', error.error || 'Не удалось обновить профиль', 'profileAlert');
                }
            } catch (error) {
                this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
            }
        }
    }

    async cloneProfile(profileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/profiles/${profileId}/clone`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                this.showAlert('success', 'Профиль клонирован!', 'profileAlert');
                await this.loadProfilesFromServer();
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Не удалось клонировать профиль', 'profileAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
        }
    }

    async deleteProfile(profileId) {
        if (!confirm('Вы уверены, что хотите удалить этот профиль?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.showAlert('success', 'Профиль удален!', 'profileAlert');
                await this.loadProfilesFromServer();
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Не удалось удалить профиль', 'profileAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
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
                // Перенаправляем на главную страницу
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
                this.loadProfilesData(profiles);

                // Обновляем счетчик профилей
                const profilesCountSpan = document.getElementById('profilesCount');
                if (profilesCountSpan) {
                    profilesCountSpan.textContent = profiles.length;
                }

                // Обновляем виджет если он существует
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
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.accountPage = new AccountPage();
});