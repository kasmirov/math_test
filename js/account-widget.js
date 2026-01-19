class AccountWidget {
    constructor(options = {}) {
        // Если экземпляр уже существует, возвращаем его с обновленными опциями
        if (AccountWidget.instance) {
            AccountWidget.instance.updateOptions(options);
            return AccountWidget.instance;
        }

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
            showSettings: options.showSettings !== undefined ? options.showSettings : true,
            showProfiles: options.showProfiles !== undefined ? options.showProfiles : true,
            ...options
        };

        this.currentUser = null;
        this.profiles = [];
        this.isRefreshing = false;
        this.isInitialized = false;
        this.currentProfile = null;
        this.tokenCheckInterval = null;
        this.lastActivityTime = Date.now();

        // Сохраняем экземпляр как статическое свойство
        AccountWidget.instance = this;

        // Инициализируем сразу если DOM готов, иначе ждем загрузки
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // Статическое свойство для хранения единственного экземпляра
    static instance = null;

    // Статическое свойство для общих данных между всеми страницами
    static sharedState = {
        currentUser: null,
        profiles: [],
        currentProfile: null
    };

    // Статический метод для получения экземпляра
    static getInstance(options = {}) {
        if (!AccountWidget.instance) {
            AccountWidget.instance = new AccountWidget(options);
        } else if (options) {
            AccountWidget.instance.updateOptions(options);
        }
        return AccountWidget.instance;
    }

    // Метод для обновления опций существующего экземпляра
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        // Перерисовываем виджет с новыми опциями
        if (this.isInitialized) {
            this.render();
            this.setupEventListeners();
        }
        return this;
    }

    // Метод для обновления состояния извне
    updateState(user = null, profiles = null, currentProfile = null) {
        if (user !== null) {
            this.currentUser = user;
            AccountWidget.sharedState.currentUser = user;
        }
        if (profiles !== null) {
            this.profiles = profiles;
            AccountWidget.sharedState.profiles = profiles;
        }
        if (currentProfile !== null) {
            this.currentProfile = currentProfile;
            AccountWidget.sharedState.currentProfile = currentProfile;
        }

        // Обновляем UI если виджет уже инициализирован
        if (this.isInitialized && this.currentUser) {
            this.updateUI();
        }

        return this;
    }

    // Обновление UI виджета
    updateUI() {
        const btn = this.container?.querySelector('#accountMainBtn');
        if (!btn) return;

        if (this.currentUser) {
            if (this.options.showProfiles && this.currentProfile) {
                btn.innerHTML = `${this.currentUser.username} <span style="font-size: 10px; opacity: 0.8;">(${this.currentProfile.name})</span>`;
            } else {
                btn.textContent = this.currentUser.username;
            }
        } else {
            btn.textContent = 'Войти';
        }
    }

    // Обновление отображения профилей в дропдауне
    updateProfilesDisplay() {
        if (!this.options.showProfiles || !this.container) return;

        const dropdown = this.container.querySelector('#accountDropdown');
        if (!dropdown) return;

        // Если дропдаун открыт и показывает меню аккаунта, обновляем его
        if (dropdown.classList.contains('show') && this.currentUser) {
            const profilesSection = dropdown.querySelector('.profiles-section');
            if (profilesSection) {
                profilesSection.innerHTML = `
                    <div class="profiles-header">Профили</div>
                    ${this.getProfilesListHTML()}
                `;
            }
        }

        // Обновляем кнопку
        this.updateUI();
    }

    async init() {
        if (this.isInitialized) return;

        // Загружаем состояние из sharedState если есть
        if (AccountWidget.sharedState.currentUser) {
            this.currentUser = AccountWidget.sharedState.currentUser;
            this.profiles = AccountWidget.sharedState.profiles || [];
            this.currentProfile = AccountWidget.sharedState.currentProfile;
        }

        this.createStyles();
        this.render();
        this.setupEventListeners();
        this.startTokenMonitoring();

        // Запускаем проверку аутентификации с небольшой задержкой
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
                padding: 2px 16px;
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
        // Удаляем старый контейнер если есть
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }

        // Создаем новый контейнер
        this.container = document.createElement('div');
        this.container.className = `account-widget ${this.options.alignment === 'right' ? 'right-aligned' : ''}`;
        this.container.innerHTML = this.getWidgetHTML();

        // Вставляем в целевой контейнер
        if (this.options.container) {
            const targetContainer = document.querySelector(this.options.container);
            if (targetContainer) {
                if (this.options.container !== 'body') {
                    targetContainer.innerHTML = '';
                }
                targetContainer.appendChild(this.container);
            } else {
                document.body.appendChild(this.container);
            }
        } else {
            document.body.appendChild(this.container);
        }

        // Обновляем UI если пользователь уже авторизован
        if (this.currentUser) {
            this.updateUI();
        }
    }

    getWidgetHTML() {
        return `
            <button class="account-btn" id="accountMainBtn">${this.currentUser ? this.currentUser.username : 'Войти'}</button>
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
        let menuItems = [];

        if (this.options.showSettings) {
            menuItems.push('<button class="account-menu-item" data-action="settings">Настройки</button>');
        }

        menuItems.push('<button class="account-menu-item" data-action="account">Аккаунт</button>');
        menuItems.push('<button class="account-menu-item" data-action="switch-account">Сменить аккаунт</button>');
        menuItems.push('<button class="account-menu-item" data-action="logout">Выйти</button>');

        let profilesSection = '';
        if (this.options.showProfiles) {
            profilesSection = `
                <div class="account-divider"></div>
                <div class="profiles-section">
                    <div class="profiles-header">Профили</div>
                    ${this.getProfilesListHTML()}
                </div>
            `;
        }

        return `
            <div class="account-menu">
                ${menuItems.join('')}
                ${profilesSection}
            </div>
        `;
    }

    getProfilesListHTML() {
        if (!this.options.showProfiles) {
            return '';
        }

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
        if (!this.container) return;

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

            if (this.options.showProfiles && (e.target.classList.contains('profile-item') || e.target.closest('.profile-item'))) {
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
            if (!this.container?.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    toggleDropdown() {
        const dropdown = this.container?.querySelector('#accountDropdown');
        if (!dropdown) return;

        if (dropdown.classList.contains('show')) {
            this.hideDropdown();
        } else {
            dropdown.innerHTML = this.getAuthHTML();
            dropdown.classList.add('show');
        }
    }

    hideDropdown() {
        const dropdown = this.container?.querySelector('#accountDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
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
                if (this.options.showSettings) {
                    this.showSettings();
                    this.hideDropdown();
                }
                break;
            case 'account':
                if (this.options.accountPageUrl) {
                    window.location.href = this.options.accountPageUrl;
                }
                this.hideDropdown();
                break;
            case 'switch-account':
                this.showAuthForm();
                break;
            case 'logout':
                this.logout();
                this.hideDropdown();
                break;
        }
    }

    showSettings() {
        if (this.options.showSettings && this.options.onSettingsClick) {
            this.options.onSettingsClick();
        }
    }

    showAuthForm() {
        const dropdown = this.container?.querySelector('#accountDropdown');
        if (dropdown) {
            dropdown.innerHTML = this.getAuthTabsHTML();
        }
    }

    handleProfileClick(profileId, profileName) {
        if (!this.options.showProfiles) return;

        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        this.currentProfile = profile;
        AccountWidget.sharedState.currentProfile = profile;

        this.updateProfilesDisplay();

        if (this.options.onProfileClick) {
            this.options.onProfileClick(profile);
        }

        this.hideDropdown();
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

            if (response.status === 401 &&
                !url.includes('/auth/refresh') &&
                !url.includes('/auth/login') &&
                this.isAuthenticated()) {

                console.log('Получен 401, пытаемся обновить токен...');
                const refreshSuccess = await this.refreshToken();

                if (refreshSuccess) {
                    return this.makeRequest(url, options);
                } else {
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

    startTokenMonitoring() {
        this.tokenCheckInterval = setInterval(() => {
            this.checkAndRefreshToken();
        }, 1 * 60000);

        document.addEventListener('click', () => this.updateActivityTime());
        document.addEventListener('keypress', () => this.updateActivityTime());
    }

    updateActivityTime() {
        this.lastActivityTime = Date.now();
    }

    async checkAndRefreshToken() {
        if (!this.isAuthenticated() || this.isRefreshing) {
            return;
        }

        const inactiveFor = Date.now() - this.lastActivityTime;
        if (inactiveFor > 5 * 60 * 1000) {
            console.log('Пользователь неактивен, пропускаем обновление токена');
            return;
        }

        try {
            this.isRefreshing = true;
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
                this.profiles = this.options.showProfiles ? (result.profiles || []) : [];

                // Сохраняем в общее состояние
                AccountWidget.sharedState.currentUser = this.currentUser;
                AccountWidget.sharedState.profiles = this.profiles;

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
        const email = this.container?.querySelector('#loginEmail')?.value;
        const password = this.container?.querySelector('#loginPassword')?.value;

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
                AccountWidget.sharedState.currentUser = this.currentUser;

                if (this.options.showProfiles) {
                    try {
                        const accountData = await this.makeRequest('/account');
                        if (accountData && accountData.profiles) {
                            this.profiles = accountData.profiles;
                            AccountWidget.sharedState.profiles = this.profiles;
                        }
                    } catch (e) {
                        await this.loadProfiles();
                    }
                } else {
                    this.profiles = [];
                    AccountWidget.sharedState.profiles = [];
                }

                await this.onAuthSuccess();
                this.options.onLogin(this.currentUser);
                this.container.querySelector('#loginForm')?.reset();
                this.hideDropdown();
            }
        } catch (error) {
            this.showAlert('error', error.message, 'login-tab');
        }
    }

    async register() {
        const email = this.container?.querySelector('#regEmail')?.value;
        const username = this.container?.querySelector('#regUsername')?.value;
        const password = this.container?.querySelector('#regPassword')?.value;

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
                AccountWidget.sharedState.currentUser = this.currentUser;

                if (this.options.showProfiles) {
                    try {
                        const accountData = await this.makeRequest('/account');
                        if (accountData && accountData.profiles) {
                            this.profiles = accountData.profiles;
                            AccountWidget.sharedState.profiles = this.profiles;
                        }
                    } catch (e) {
                        await this.loadProfiles();
                    }
                } else {
                    this.profiles = [];
                    AccountWidget.sharedState.profiles = [];
                }

                await this.onAuthSuccess();
                this.options.onLogin(this.currentUser);
                this.container.querySelector('#registerForm')?.reset();
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
            // Игнорируем ошибки при выходе
        } finally {
            this.currentUser = null;
            this.profiles = [];
            this.currentProfile = null;

            // Очищаем общее состояние
            AccountWidget.sharedState.currentUser = null;
            AccountWidget.sharedState.profiles = [];
            AccountWidget.sharedState.currentProfile = null;

            this.onLogout();
            this.options.onLogout();
        }
    }

    async loadProfiles() {
        if (!this.options.showProfiles) return;

        try {
            const result = await this.makeRequest('/profiles');
            if (result && !result.error) {
                this.profiles = result;
                AccountWidget.sharedState.profiles = this.profiles;
                this.updateProfilesDisplay();
            }
        } catch (error) {
            // Ошибка обработана в makeRequest
        }
    }

    async onAuthSuccess() {
        // Сохраняем состояние
        AccountWidget.sharedState.currentUser = this.currentUser;
        AccountWidget.sharedState.profiles = this.profiles;
        AccountWidget.sharedState.currentProfile = this.currentProfile;

        const btn = this.container?.querySelector('#accountMainBtn');
        if (btn) {
            if (this.options.showProfiles && this.currentProfile) {
                btn.innerHTML = `${this.currentUser.username} <span style="font-size: 10px; opacity: 0.8;">(${this.currentProfile.name})</span>`;
            } else {
                btn.textContent = this.currentUser.username;
            }
        }

        const dropdown = this.container?.querySelector('#accountDropdown');
        if (dropdown) {
            dropdown.innerHTML = this.getAccountMenuHTML();
        }
    }

    onLogout() {
        // Очищаем общее состояние
        AccountWidget.sharedState.currentUser = null;
        AccountWidget.sharedState.profiles = [];
        AccountWidget.sharedState.currentProfile = null;

        const btn = this.container?.querySelector('#accountMainBtn');
        if (btn) {
            btn.textContent = 'Войти';
        }

        const dropdown = this.container?.querySelector('#accountDropdown');
        if (dropdown) {
            dropdown.innerHTML = this.getAuthTabsHTML();
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
            targetContainer = this.container?.querySelector(`#${containerId}`);
        } else {
            targetContainer = this.container?.querySelector('.auth-tab-content');
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
        return this.options.showProfiles ? this.profiles : [];
    }

    getCurrentProfile() {
        return this.options.showProfiles ? this.currentProfile : null;
    }

    setCurrentProfile(profileId) {
        if (!this.options.showProfiles) return;

        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            this.currentProfile = profile;
            AccountWidget.sharedState.currentProfile = profile;
            this.updateProfilesDisplay();
        }
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    async refreshAuthState() {
        return await this.checkAuth();
    }

    destroy() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }

        if (this.container && this.container.parentNode) {
            this.container.remove();
        }

        AccountWidget.instance = null;
    }
}

// Глобальная переменная для обратной совместимости
let accountWidget = null;