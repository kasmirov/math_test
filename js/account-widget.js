class AccountWidget {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || '',
            container: options.container || null,
            alignment: options.alignment || 'right',
            accountPageUrl: options.accountPageUrl || '/account.html',
            onLogin: options.onLogin || (() => {}),
            onLogout: options.onLogout || (() => {}),
            onAccountUpdate: options.onAccountUpdate || (() => {}),
            onProfileClick: options.onProfileClick || null,
            onAuthRefresh: options.onAuthRefresh || (() => {}),
            onSettingsClick: options.onSettingsClick || (() => {}),
            ...options
        };

        this.currentUser = null;
        this.profiles = [];
        this.isRefreshing = false;
        this.isInitialized = false;
        this.currentProfile = null;
        this.tokenCheckInterval = null;
        this.lastActivityTime = Date.now();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        if (this.isInitialized) return;

        this.createStyles();
        this.render();
        this.setupEventListeners();
        // Автоматически стартуем проверку токенов
        this.startTokenMonitoring();

        setTimeout(async () => {
            await this.checkAuth();
        }, 100);

        this.isInitialized = true;
    }

    createStyles() {
        if (document.getElementById('account-widget-styles')) return;

        const styles = `
            .account-widget {
                position: relative;
                display: inline-block;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .account-btn {
                padding: 10px 20px;
                border: 1px solid #e1e5e9;
                border-radius: 20px;
                background: white;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                transition: all 0.3s ease;
                white-space: nowrap;
                min-width: 90px;
                text-align: center;
                color: #2d3748;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                font-weight: 500;
            }

            .account-btn:hover {
                background: #f7fafc;
                border-color: #cbd5e0;
                box-shadow: 0 4px 6px rgba(0,0,0,0.07);
                transform: translateY(-1px);
            }

            .account-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 8px;
                min-width: 240px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                z-index: 1000;
                display: none;
                font-family: inherit;
            }

            .account-dropdown.show {
                display: block;
                animation: fadeIn 0.2s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .account-widget.right-aligned .account-dropdown {
                left: auto;
                right: 0;
            }

            .auth-tabs {
                padding: 0;
                border-radius: 12px;
                overflow: hidden;
            }

            .auth-tab-headers {
                display: flex;
                border-bottom: 1px solid #f1f5f9;
                background: #f8fafc;
            }

            .auth-tab-header {
                flex: 1;
                padding: 12px;
                border: none;
                background: none;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                transition: all 0.3s ease;
                font-weight: 500;
                color: #64748b;
            }

            .auth-tab-header.active {
                background: white;
                color: #3b82f6;
                border-bottom: 2px solid #3b82f6;
            }

            .auth-tab-header:hover:not(.active) {
                background: #f1f5f9;
                color: #475569;
            }

            .auth-tab-content {
                padding: 20px;
            }

            .auth-tab-pane {
                display: none;
            }

            .auth-tab-pane.active {
                display: block;
            }

            .auth-form {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .auth-form input {
                padding: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
                transition: border-color 0.3s ease;
                background: #fafbfc;
            }

            .auth-form input:focus {
                outline: none;
                border-color: #3b82f6;
                background: white;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .auth-form button {
                padding: 10px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                font-weight: 600;
                transition: all 0.3s ease;
            }

            .auth-form button:hover {
                background: #2563eb;
            }

            .auth-form button:disabled {
                background: #94a3b8;
                cursor: not-allowed;
            }

            .account-menu {
                padding: 0;
                border-radius: 12px;
                overflow: hidden;
            }

            .account-menu-item {
                display: block;
                width: 100%;
                padding: 10px 16px;
                border: none;
                background: none;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                transition: background-color 0.2s ease;
                text-decoration: none;
                color: #374151;
                box-sizing: border-box;
                font-weight: 500;
                border-bottom: 1px solid #f8fafc;
            }

            .account-menu-item:hover {
                background: #f8fafc;
            }

            .account-menu-item:last-child {
                border-bottom: none;
            }

            .account-divider {
                height: 1px;
                background: #f1f5f9;
                margin: 0;
            }

            .profiles-section {
                max-height: 300px;
                overflow-y: auto;
            }

            .profiles-header {
                padding: 2px 16px; /* Уменьшена высота вдвое */
                font-weight: 600;
                color: #1f2937;
                font-size: 14px;
            }

            .profile-item {
                padding: 10px 16px;
                font-size: 14px;
                border-bottom: 1px solid #f8fafc;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .profile-item:hover {
                background: #f0f9ff;
            }

            .profile-item.active {
                background: #dbeafe;
                border-left: 3px solid #3b82f6;
            }

            .profile-item:last-child {
                border-bottom: none;
            }

            .profile-name {
                font-weight: 500;
                color: #1f2937;
                margin-bottom: 2px;
            }

            .profile-type {
                color: #6b7280;
                font-size: 12px;
                font-weight: 400;
            }

            .current-profile-badge {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                margin-left: 8px;
                font-weight: 500;
            }

            .loading {
                opacity: 0.7;
                pointer-events: none;
            }

            .alert {
                padding: 10px 12px;
                border-radius: 6px;
                margin-bottom: 12px;
                display: none;
                font-size: 14px;
                font-family: inherit;
            }

            .alert-success {
                background: #dcfce7;
                color: #166534;
                border: 1px solid #bbf7d0;
            }

            .alert-error {
                background: #fee2e2;
                color: #991b1b;
                border: 1px solid #fecaca;
            }

            .profiles-section::-webkit-scrollbar {
                width: 6px;
            }

            .profiles-section::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }

            .profiles-section::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }

            .profiles-section::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'account-widget-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    render() {
        const container = document.createElement('div');
        container.className = `account-widget ${this.options.alignment === 'right' ? 'right-aligned' : ''}`;
        container.innerHTML = this.getWidgetHTML();

        if (this.options.container) {
            const targetContainer = document.querySelector(this.options.container);
            if (targetContainer) {
                if (this.options.container !== 'body') {
                    targetContainer.innerHTML = '';
                }
                targetContainer.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        } else {
            document.body.appendChild(container);
        }

        this.container = container;
    }

    getWidgetHTML() {
        return `
            <button class="account-btn" id="accountMainBtn">Войти</button>
            <div class="account-dropdown" id="accountDropdown">
                ${this.getAuthHTML()}
            </div>
        `;
    }

    getAuthHTML() {
        if (this.currentUser) {
            return this.getAccountMenuHTML();
        } else {
            return this.getAuthTabsHTML();
        }
    }

    getAuthTabsHTML() {
        return `
            <div class="auth-tabs">
                <div class="auth-tab-headers">
                    <button class="auth-tab-header active" data-tab="login">Логин</button>
                    <button class="auth-tab-header" data-tab="register">Регистрация</button>
                </div>
                <div class="auth-tab-content">
                    <div class="auth-tab-pane active" id="login-tab">
                        <form class="auth-form" id="loginForm">
                            <input type="email" placeholder="Email" required id="loginEmail">
                            <input type="password" placeholder="Пароль" required id="loginPassword">
                            <button type="submit">Войти</button>
                        </form>
                    </div>
                    <div class="auth-tab-pane" id="register-tab">
                        <form class="auth-form" id="registerForm">
                            <input type="email" placeholder="Email" required id="regEmail">
                            <input type="text" placeholder="Имя пользователя" required id="regUsername">
                            <input type="password" placeholder="Пароль" required id="regPassword">
                            <button type="submit">Зарегистрироваться</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    getAccountMenuHTML() {
        return `
            <div class="account-menu">
                <button class="account-menu-item" data-action="settings">Настройки</button>
                <button class="account-menu-item" data-action="account">Аккаунт</button>
                <button class="account-menu-item" data-action="switch-account">Сменить аккаунт</button>
                <button class="account-menu-item" data-action="logout">Выйти</button>
                <div class="account-divider"></div>
                <div class="profiles-section">
                    <div class="profiles-header">Профили</div>
                    ${this.getProfilesListHTML()}
                </div>
            </div>
        `;
    }

    getProfilesListHTML() {
        if (!this.profiles.length) {
            return '<div class="profile-item" style="color: #9ca3af; cursor: default;">Нет профилей</div>';
        }

        return this.profiles.map(profile => {
            const isActive = this.currentProfile && this.currentProfile.id === profile.id;
            return `
                <div class="profile-item ${isActive ? 'active' : ''}"
                     data-profile-id="${profile.id}"
                     data-profile-name="${profile.name}">
                    <div class="profile-name">${profile.name}</div>
                    <div class="profile-type">${this.getProfileTypeName(profile.type)}</div>
                </div>
            `;
        }).join('');
    }

    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            if (e.target.id === 'accountMainBtn') {
                e.stopPropagation();
                this.toggleDropdown();
            }

            if (e.target.classList.contains('auth-tab-header')) {
                const tabName = e.target.getAttribute('data-tab');
                this.switchAuthTab(tabName);
            }

            if (e.target.classList.contains('account-menu-item') && e.target.getAttribute('data-action')) {
                const action = e.target.getAttribute('data-action');
                this.handleAccountAction(action);
            }

            if (e.target.classList.contains('profile-item') || e.target.closest('.profile-item')) {
                const profileItem = e.target.classList.contains('profile-item') ? e.target : e.target.closest('.profile-item');
                const profileId = profileItem.getAttribute('data-profile-id');

                if (profileId) {
                    const profileName = profileItem.getAttribute('data-profile-name');
                    this.handleProfileClick(parseInt(profileId), profileName);
                }
            }
        });

        this.container.addEventListener('submit', (e) => {
            e.preventDefault();
            if (e.target.id === 'loginForm') {
                this.login();
            } else if (e.target.id === 'registerForm') {
                this.register();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    toggleDropdown() {
        const dropdown = this.container.querySelector('#accountDropdown');

        if (dropdown.classList.contains('show')) {
            this.hideDropdown();
        } else {
            dropdown.innerHTML = this.getAuthHTML();
            dropdown.classList.add('show');
        }
    }

    hideDropdown() {
        const dropdown = this.container.querySelector('#accountDropdown');
        dropdown.classList.remove('show');
    }

    switchAuthTab(tabName) {
        this.container.querySelectorAll('.auth-tab-header').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        this.container.querySelectorAll('.auth-tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    handleAccountAction(action) {
        switch (action) {
            case 'settings':
                this.showSettings();
                this.hideDropdown();
                break;
            case 'account':
                if (this.options.accountPageUrl) {
                    window.location.href = this.options.accountPageUrl;
                }
                this.hideDropdown();
                break;
            case 'switch-account':
                // Показываем форму авторизации и оставляем меню открытым
                this.showAuthForm();
                break;
            case 'logout':
                this.logout();
                this.hideDropdown();
                break;
        }
    }

    showSettings() {
        if (this.options.onSettingsClick) {
            this.options.onSettingsClick();
        }
    }

    // Новый метод для показа формы авторизации
    showAuthForm() {
        const dropdown = this.container.querySelector('#accountDropdown');
        dropdown.innerHTML = this.getAuthTabsHTML();
        // Оставляем dropdown открытым
    }

    handleProfileClick(profileId, profileName) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        this.currentProfile = profile;
        this.updateProfilesDisplay();

        if (this.options.onProfileClick) {
            this.options.onProfileClick(profile);
        }

        this.hideDropdown();
        console.log(`Профиль выбран: ${profileName} (ID: ${profileId})`);
    }

    async makeRequest(url, options = {}) {
        this.setLoadingState(true);

        try {
            const fullUrl = this.options.apiBaseUrl + url;
            const response = await fetch(fullUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                credentials: 'include',
                ...options
            });

            // Если получили 401 - пробуем обновить токен
            if (response.status === 401 &&
                !url.includes('/auth/refresh') &&
                !url.includes('/auth/login') &&
                this.isAuthenticated()) {

                console.log('Получен 401, пытаемся обновить токен...');
                const refreshSuccess = await this.refreshToken();

                if (refreshSuccess) {
                    // Повторяем исходный запрос с новым токеном
                    return this.makeRequest(url, options);
                } else {
                    // Не удалось обновить - разлогиниваем
                    await this.logout();
                    throw new Error('Authentication failed');
                }
            }

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {}
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error('Request error:', error);
            if (!error.message.includes('Not authenticated') &&
                !error.message.includes('Authentication failed')) {
                this.showAlert('error', error.message);
            }
            throw error;
        } finally {
            this.setLoadingState(false);
        }
    }

    destroy() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }
    }

    setLoadingState(loading) {
        const btn = this.container?.querySelector('#accountMainBtn');
        if (btn) {
            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        }
    }

    startTokenMonitoring() {
        // Проверяем состояние токена каждые 3 минуты
        this.tokenCheckInterval = setInterval(() => {
            this.checkAndRefreshToken();
        }, 1 * 60000); // 1 минута

        // Следим за активностью пользователя
        document.addEventListener('click', () => this.updateActivityTime());
        document.addEventListener('keypress', () => this.updateActivityTime());
    }

    updateActivityTime() {
        this.lastActivityTime = Date.now();
    }

    async checkAndRefreshToken() {
        // Не обновляем если пользователь не авторизован
        if (!this.isAuthenticated() || this.isRefreshing) {
            return;
        }

        // Проверяем, был ли пользователь активен в последние 5 минут
        const inactiveFor = Date.now() - this.lastActivityTime;
        if (inactiveFor > 5 * 60 * 1000) {
            console.log('Пользователь неактивен, пропускаем обновление токена');
            return;
        }

        try {
            this.isRefreshing = true;

            // Пытаемся обновить токен
            const success = await this.refreshToken();

            if (success) {
                console.log('Токен успешно обновлен');
                this.options.onAuthRefresh(this.currentUser, this.profiles);
            }
        } catch (error) {
            console.warn('Не удалось обновить токен:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    async refreshToken() {
        try {
            const response = await fetch(this.options.apiBaseUrl + '/auth/refresh', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                return true;
            } else {
                // Если refresh не удался, разлогиниваем пользователя
                await this.logout();
                return false;
            }
        } catch (error) {
            console.error('Ошибка при обновлении токена:', error);
            return false;
        }
    }

    async checkAuth() {
        try {
            const result = await this.makeRequest('/account');
            if (result && result.user) {
                this.currentUser = result.user;
                this.profiles = result.profiles || [];
                await this.onAuthSuccess();

                this.options.onAuthRefresh(this.currentUser, this.profiles);
                return true;
            }
        } catch (error) {
            console.log('Authentication check failed:', error.message);
            this.onLogout();
        }
        return false;
    }

    async login() {
        const email = this.container.querySelector('#loginEmail').value;
        const password = this.container.querySelector('#loginPassword').value;

        if (!email || !password) {
            this.showAlert('error', 'Заполните все поля', 'login-tab');
            return;
        }

        try {
            const result = await this.makeRequest('/auth/login', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            if (result && result.user) {
                this.currentUser = result.user;

                try {
                    const accountData = await this.makeRequest('/account');
                    if (accountData && accountData.profiles) {
                        this.profiles = accountData.profiles;
                    }
                } catch (e) {
                    await this.loadProfiles();
                }

                await this.onAuthSuccess();
                this.options.onLogin(this.currentUser);
                this.container.querySelector('#loginForm').reset();
                this.hideDropdown();
            }
        } catch (error) {
            this.showAlert('error', error.message, 'login-tab');
        }
    }

    async register() {
        const email = this.container.querySelector('#regEmail').value;
        const username = this.container.querySelector('#regUsername').value;
        const password = this.container.querySelector('#regPassword').value;

        if (!email || !username || !password) {
            this.showAlert('error', 'Заполните все поля', 'register-tab');
            return;
        }

        if (password.length < 6) {
            this.showAlert('error', 'Пароль должен быть не менее 6 символов', 'register-tab');
            return;
        }

        try {
            const result = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, username, password })
            });

            if (result && result.user) {
                this.currentUser = result.user;

                try {
                    const accountData = await this.makeRequest('/account');
                    if (accountData && accountData.profiles) {
                        this.profiles = accountData.profiles;
                    }
                } catch (e) {
                    await this.loadProfiles();
                }

                await this.onAuthSuccess();
                this.options.onLogin(this.currentUser);
                this.container.querySelector('#registerForm').reset();
                this.hideDropdown();
            }
        } catch (error) {
            this.showAlert('error', error.message, 'register-tab');
        }
    }

    async logout() {
        try {
            await this.makeRequest('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            // Ignore errors during logout
        } finally {
            this.currentUser = null;
            this.profiles = [];
            this.currentProfile = null;
            this.onLogout();
            this.options.onLogout();
        }
    }

    async loadProfiles() {
        try {
            const result = await this.makeRequest('/profiles');
            if (result && !result.error) {
                this.profiles = result;
                this.updateProfilesDisplay();
            }
        } catch (error) {
            // Error handled in makeRequest
        }
    }

    async onAuthSuccess() {
        const btn = this.container.querySelector('#accountMainBtn');
        if (this.currentProfile) {
            btn.innerHTML = `${this.currentUser.username} <span style="font-size: 10px; opacity: 0.8;">(${this.currentProfile.name})</span>`;
        } else {
            btn.textContent = this.currentUser.username;
        }

        const dropdown = this.container.querySelector('#accountDropdown');
        dropdown.innerHTML = this.getAccountMenuHTML();
    }

    onLogout() {
        const btn = this.container.querySelector('#accountMainBtn');
        btn.textContent = 'Войти';

        const dropdown = this.container.querySelector('#accountDropdown');
        dropdown.innerHTML = this.getAuthTabsHTML();
    }

    updateProfilesDisplay() {
        const dropdown = this.container.querySelector('#accountDropdown');
        const profilesSection = dropdown.querySelector('.profiles-section');
        if (profilesSection) {
            profilesSection.innerHTML = `
                <div class="profiles-header">Профили</div>
                ${this.getProfilesListHTML()}
            `;
        }

        const btn = this.container.querySelector('#accountMainBtn');
        if (this.currentProfile) {
            btn.innerHTML = `${this.currentUser.username} <span style="font-size: 10px; opacity: 0.8;">(${this.currentProfile.name})</span>`;
        } else {
            btn.textContent = this.currentUser.username;
        }
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

    showAlert(type, message, containerId = null) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass}`;
        alert.textContent = message;

        let targetContainer;
        if (containerId) {
            targetContainer = this.container.querySelector(`#${containerId}`);
        } else {
            targetContainer = this.container.querySelector('.auth-tab-content');
        }

        if (targetContainer) {
            const existingAlert = targetContainer.querySelector('.alert');
            if (existingAlert) {
                existingAlert.remove();
            }
            targetContainer.insertBefore(alert, targetContainer.firstChild);
        }

        alert.style.display = 'block';

        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    // Публичные методы
    getUser() {
        return this.currentUser;
    }

    getProfiles() {
        return this.profiles;
    }

    getCurrentProfile() {
        return this.currentProfile;
    }

    setCurrentProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            this.currentProfile = profile;
            this.updateProfilesDisplay();
        }
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    async refreshAuthState() {
        return await this.checkAuth();
    }
}

// Глобальная переменная для доступа извне
let accountWidget = null;