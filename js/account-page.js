
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
        await this.checkAuthAndLoadData();
    }

    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // Форма аккаунта
        document.getElementById('accountForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateAccount();
        });

        // Форма создания профиля
        document.getElementById('createProfileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProfile();
        });

        // Удаление аккаунта
        document.getElementById('deleteAccountBtn').addEventListener('click', () => {
            this.deleteAccount();
        });
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
            if (accountWidget && accountWidget.isAuthenticated()) {
                this.currentUser = accountWidget.getUser();
                this.profiles = accountWidget.getProfiles();
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
        document.getElementById('notAuthenticated').style.display = 'none';
        document.getElementById('authenticatedContent').style.display = 'block';
    }

    showNotAuthenticated() {
        document.getElementById('notAuthenticated').style.display = 'block';
        document.getElementById('authenticatedContent').style.display = 'none';
    }

    loadAccountData(user) {
        if (!user) return;

        document.getElementById('accountEmail').value = user.email || '';
        document.getElementById('accountUsername').value = user.username || '';

        if (user.preferences) {
            document.getElementById('accountPreferences').value =
                JSON.stringify(user.preferences, null, 2);
        }

        // Статистика
        document.getElementById('profilesCount').value = this.profiles.length;

        if (user.created_at) {
            document.getElementById('accountCreatedAt').value =
                new Date(user.created_at).toLocaleDateString('ru-RU');
        }
    }

    loadProfilesData(profiles) {
        const container = document.getElementById('profilesList');

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
                        <button class="btn btn-secondary" onclick="accountPage.editProfile(${profile.id})">Ред.</button>
                        <button class="btn btn-secondary" onclick="accountPage.cloneProfile(${profile.id})">Клон</button>
                        <button class="btn btn-danger" onclick="accountPage.deleteProfile(${profile.id})">Уд.</button>
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
            username: document.getElementById('accountUsername').value
        };

        const preferences = document.getElementById('accountPreferences').value;
        if (preferences) {
            try {
                formData.preferences = JSON.parse(preferences);
            } catch (e) {
                this.showAlert('error', 'Неверный формат JSON в настройках', 'accountAlert');
                return;
            }
        }

        this.setLoadingState(true);

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
                if (accountWidget) {
                    accountWidget.currentUser = result.user;
                    accountWidget.updateUserInfo();
                }
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при обновлении аккаунта', 'accountAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'accountAlert');
        } finally {
            this.setLoadingState(false);
        }
    }

    async createProfile() {
        const formData = {
            name: document.getElementById('profileName').value,
            type: document.getElementById('profileType').value
        };

        const settings = document.getElementById('profileSettings').value;
        if (settings) {
            try {
                formData.settings = JSON.parse(settings);
            } catch (e) {
                this.showAlert('error', 'Неверный формат JSON в настройках', 'profileAlert');
                return;
            }
        }

        this.setLoadingState(true);

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
                document.getElementById('createProfileForm').reset();

                // Обновляем список профилей
                await this.loadProfilesFromServer();
            } else {
                const error = await response.json();
                this.showAlert('error', error.error || 'Ошибка при создании профиля', 'profileAlert');
            }
        } catch (error) {
            this.showAlert('error', 'Ошибка сети: ' + error.message, 'profileAlert');
        } finally {
            this.setLoadingState(false);
        }
    }

    async editProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        const newName = prompt('Введите новое название профиля:', profile.name);
        if (newName && newName !== profile.name) {
            try {
                const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ name: newName })
                });

                if (response.ok) {
                    this.showAlert('success', 'Профиль обновлен!', 'profileAlert');
                    await this.loadProfilesFromServer();
                } else {
                    const error = await response.json();
                    alert('Ошибка: ' + (error.error || 'Не удалось обновить профиль'));
                }
            } catch (error) {
                alert('Ошибка сети: ' + error.message);
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
                alert('Ошибка: ' + (error.error || 'Не удалось клонировать профиль'));
            }
        } catch (error) {
            alert('Ошибка сети: ' + error.message);
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
                alert('Ошибка: ' + (error.error || 'Не удалось удалить профиль'));
            }
        } catch (error) {
            alert('Ошибка сети: ' + error.message);
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
                document.getElementById('profilesCount').value = profiles.length;

                // Обновляем виджет если он существует
                if (accountWidget) {
                    accountWidget.profiles = profiles;
                    accountWidget.updateProfilesDisplay();
                }
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    }

    setLoadingState(loading) {
        const buttons = document.querySelectorAll('#accountForm button, #createProfileForm button');
        buttons.forEach(btn => {
            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        });
    }

    showAlert(type, message, containerId) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass}`;
        alert.textContent = message;

        const container = document.getElementById(containerId);
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

// Глобальная переменная для доступа к методам страницы
let accountPage = null;

// Функции для глобального доступа из HTML
function checkAuthAndLoadData() {
    if (accountPage) {
        accountPage.checkAuthAndLoadData();
    }
}

function showNotAuthenticated() {
    if (accountPage) {
        accountPage.showNotAuthenticated();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    accountPage = new AccountPage();
});


const accWidget = new AccountWidget({
    apiBaseUrl: API_BASE_URL,
    alignment: 'right',
    container: '.new-menu-container',
    accountPageUrl: '/account.html',
    showSettings: false,
    showProfiles: false,

    onLogin: (user) => {
        console.log('Пользователь вошел:', user);
        currentUser = user;
    },

    onLogout: () => {
        console.log('Пользователь вышел');
        currentUser = null;
        currentProfile = null;
        profiles = [];
    },

    onAccountUpdate: (user) => {
        console.log('Данные пользователя обновлены:', user);
        currentUser = user;
    },

    onProfileClick: (profile) => {
        console.log('Выбран профиль:', profile);
    },

    onSettingsClick: () => {
        console.log('Toggle settings menu');
    },

    // Коллбек для обновления при загрузке/обновлении страницы
    onAuthRefresh: (user, profilesList) => {
        console.log('Состояние аутентификации обновлено:', user);
        currentUser = user;
        profiles = profilesList || [];
    }
});

// Сохраняем для глобального доступа
accountWidget = accWidget;