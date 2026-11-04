// account-widget.js — переиспользуемый виджет аккаунта (кнопка + выпадающее меню).
//
// Использование:
//   const widget = AccountWidget.getInstance({
//       apiBaseUrl: '/api',                 // префикс API
//       container: '.user-menu-container',  // селектор контейнера (иначе body)
//       alignment: 'right',                 // выравнивание выпадашки
//       accountPageUrl: '/account.html',    // действие пункта «Аккаунт»
//       stylesUrl: '/css/account-widget.css', // подключаемый CSS виджета
//       showSettings: true,                 // пункт «Настройки»
//       showProfiles: true,                 // список профилей в меню
//       onLogin: (user) => {},
//       onLogout: () => {},
//       onAccountUpdate: (user) => {},
//       onProfileClick: (profile) => {},
//       onAuthRefresh: (user, profiles) => {},
//       onSettingsClick: () => {}
//   });
//
// Публичный API: getInstance(), instance, setSettingsEnabled(), updateProfilesDisplay(),
//   updateState(), getUser()/getProfiles()/getCurrentProfile(), setCurrentProfile(),
//   isAuthenticated(), refreshAuthState(), destroy(). Глобально доступны escapeHtml().
//
// Ожидаемый контракт бэкенда (авторизация на HttpOnly cookie + CSRF-заголовок):
//   POST {apiBaseUrl}/auth/login | /auth/register | /auth/logout | /auth/refresh
//   GET  {apiBaseUrl}/account   -> { user, profiles }
//   GET  {apiBaseUrl}/profiles  -> [profile, ...]
//   GET  {apiBaseUrl}/legal     -> { enabled }   // опционально: скрывает согласие ПД
'use strict';

const ACCOUNT_STORAGE_KEY = 'accountWidgetState';
const ACCOUNT_STYLES_ID = 'account-widget-styles';
const CSRF_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const TOKEN_CHECK_INTERVAL_MS = 60000;
const ACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

const PROFILE_TYPE_NAMES = {
    personal: 'Личный',
    work: 'Рабочий',
    game: 'Игровой',
    other: 'Другой'
};

function readCookie(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.escapeHtml = escapeHtml;

// Глобальный хук fetch: подставляет X-CSRF-TOKEN для изменяющих запросов.
// JWT лежит в HttpOnly cookie (недоступна из JS), читаемой является только CSRF-cookie.
(function installCsrfFetch() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        const options = Object.assign({}, init);
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (options.method || (input && input.method) || 'GET').toUpperCase();

        if (CSRF_METHODS.includes(method)) {
            const cookieName = url.includes('/auth/refresh') ? 'csrf_refresh_token' : 'csrf_access_token';
            const token = readCookie(cookieName);
            if (token) {
                const headers = new Headers(options.headers || (input && input.headers) || {});
                if (!headers.has('X-CSRF-TOKEN')) {
                    headers.set('X-CSRF-TOKEN', token);
                }
                options.headers = headers;
            }
        }

        return originalFetch(input, options);
    };
})();

class AccountWidget {
    static instance = null;

    static DEFAULT_OPTIONS = {
        apiBaseUrl: '',
        container: null,
        alignment: 'right',
        accountPageUrl: '/account.html',
        stylesUrl: '/css/account-widget.css',
        showSettings: true,
        showProfiles: true,
        settingsEnabled: true,
        onLogin: null,
        onLogout: null,
        onAccountUpdate: null,
        onProfileClick: null,
        onAuthRefresh: null,
        onSettingsClick: null
    };

    static getInstance(options = {}) {
        if (!AccountWidget.instance) {
            AccountWidget.instance = new AccountWidget(options);
        } else if (options && Object.keys(options).length > 0) {
            AccountWidget.instance.updateOptions(options);
        }
        return AccountWidget.instance;
    }

    constructor(options = {}) {
        if (AccountWidget.instance) {
            AccountWidget.instance.updateOptions(options);
            return AccountWidget.instance;
        }

        this.options = { ...AccountWidget.DEFAULT_OPTIONS, ...options };

        this.currentUser = null;
        this.profiles = [];
        this.currentProfile = null;

        this.legalEnabled = true;
        this.isRefreshing = false;
        this.isInitialized = false;
        this.lastActivityTime = Date.now();
        this.tokenCheckInterval = null;
        this.container = null;
        this.dropdown = null;
        this._listenersContainer = null;
        this._documentListenersAttached = false;

        this.restoreFromStorage();

        AccountWidget.instance = this;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // --- состояние ---

    restoreFromStorage() {
        try {
            const raw = sessionStorage.getItem(ACCOUNT_STORAGE_KEY);
            if (!raw) {
                this._setAnonymousState();
                return;
            }

            const state = JSON.parse(raw);
            this.currentUser = state.currentUser || null;
            this.profiles = state.profiles || [];
            this.currentProfile = state.currentProfile || null;

            if (this.currentProfile && this.profiles.length > 0 &&
                !this.profiles.some(p => p.id === this.currentProfile.id)) {
                this.currentProfile = null;
            }
        } catch (error) {
            this._setAnonymousState();
        }
    }

    saveToStorage() {
        try {
            sessionStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify({
                currentUser: this.currentUser,
                profiles: this.profiles,
                currentProfile: this.currentProfile,
                timestamp: Date.now()
            }));
        } catch (error) {
            // sessionStorage может быть недоступен (приватный режим)
        }
    }

    clearStorage() {
        try {
            sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
        } catch (error) {
            // ignore
        }
    }

    _setAnonymousState() {
        this.currentUser = null;
        this.profiles = [];
        this.currentProfile = null;
    }

    // --- опции ---

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (this.isInitialized) {
            this.render();
            this.setupEventListeners();
        }
        return this;
    }

    updateState(user = null, profiles = null, currentProfile = null) {
        if (user !== null) {
            this.currentUser = user;
        }
        if (profiles !== null) {
            this.profiles = profiles;
        }
        if (currentProfile !== null) {
            this.currentProfile = currentProfile;
        }
        this.saveToStorage();
        this.updateUI();
        return this;
    }

    // --- жизненный цикл ---

    async init() {
        if (this.isInitialized) {
            return;
        }

        this.createStyles();
        this.render();
        this.setupEventListeners();
        this.startTokenMonitoring();
        this.loadLegalConfig();

        if (this.currentUser) {
            this.updateUI();
        }

        setTimeout(() => this.getAccountInfo(), 100);

        this.isInitialized = true;

        window.addEventListener('pageshow', () => {
            if (this.isAuthenticated()) {
                this.updateUI();
            }
        });
    }

    destroy() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
            this.tokenCheckInterval = null;
        }
        this.container?.remove();
        this.container = null;
        this.dropdown = null;
        AccountWidget.instance = null;
    }

    createStyles() {
        if (!this.options.stylesUrl || document.getElementById(ACCOUNT_STYLES_ID)) {
            return;
        }
        const link = document.createElement('link');
        link.id = ACCOUNT_STYLES_ID;
        link.rel = 'stylesheet';
        link.href = this.options.stylesUrl;
        document.head.appendChild(link);
    }

    // --- рендеринг ---

    render() {
        this.container?.remove();

        this.container = document.createElement('div');
        this.container.className = 'account-widget' + (this.options.alignment === 'right' ? ' right-aligned' : '');
        this.container.innerHTML = this.getWidgetHTML();

        const target = this.options.container ? document.querySelector(this.options.container) : null;
        if (target) {
            if (this.options.container !== 'body') {
                target.innerHTML = '';
            }
            target.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }

        this.dropdown = this.container.querySelector('#accountDropdown');

        if (this.currentUser) {
            this.updateUI();
        }
    }

    updateUI() {
        this._renderMainButton();
    }

    _renderMainButton() {
        const btn = this.container?.querySelector('#accountMainBtn');
        if (btn) {
            btn.innerHTML = this._mainButtonLabelHTML();
        }
    }

    _mainButtonLabelHTML() {
        if (!this.currentUser) {
            return 'Войти';
        }
        if (this.options.showProfiles && this.currentProfile) {
            return `${escapeHtml(this.currentUser.username)} <span style="font-size: 12px; opacity: 0.8;">(${escapeHtml(this.currentProfile.name)})</span>`;
        }
        return escapeHtml(this.currentUser.username);
    }

    updateProfilesDisplay() {
        const dropdown = this.container?.querySelector('#accountDropdown');
        if (dropdown?.classList.contains('show') && this.currentUser) {
            const menu = dropdown.querySelector('.account-menu');
            if (menu) {
                const section = menu.querySelector('.profiles-section');
                if (section) {
                    section.innerHTML = `<div class="profiles-header">Профили</div>${this.getProfilesListHTML()}`;
                } else {
                    dropdown.innerHTML = this.getAccountMenuHTML();
                }
            }
        }
        this.updateUI();
    }

    getWidgetHTML() {
        return `
            <button class="account-btn" id="accountMainBtn">${this._mainButtonLabelHTML()}</button>
            <div class="account-dropdown" id="accountDropdown">
                ${this.getAuthHTML()}
            </div>
        `;
    }

    getAuthHTML() {
        return this.currentUser ? this.getAccountMenuHTML() : this.getAuthTabsHTML();
    }

    getAuthTabsHTML() {
        const consentBlock = this.legalEnabled ? `
            <label class="auth-consent-check">
                <input type="checkbox" id="regPersonalDataAgreement" required>
                <span>Даю согласие на обработку своих персональных данных</span>
            </label>
            <a class="auth-consent-link" href="/consent" target="_blank" rel="noopener">Согласие на обработку персональных данных</a>
        ` : '';

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
                            ${consentBlock}
                            <button type="submit">Зарегистрироваться</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    getAccountMenuHTML() {
        const items = [];

        if (this.options.showSettings) {
            const disabled = this.options.settingsEnabled === false ? ' disabled' : '';
            items.push(`<button class="account-menu-item" data-action="settings"${disabled}>Настройки</button>`);
        }
        items.push('<button class="account-menu-item" data-action="account">Аккаунт</button>');
        items.push('<button class="account-menu-item" data-action="switch-account">Сменить аккаунт</button>');
        items.push('<button class="account-menu-item" data-action="logout">Выйти</button>');

        const profilesSection = this.options.showProfiles ? `
            <div class="account-divider"></div>
            <div class="profiles-section">
                <div class="profiles-header">Профили</div>
                ${this.getProfilesListHTML()}
            </div>
        ` : '';

        return `<div class="account-menu">${items.join('')}${profilesSection}</div>`;
    }

    getProfilesListHTML() {
        if (!this.profiles.length) {
            return '<div class="profile-item" style="color: #9ca3af; cursor: default;">Нет профилей</div>';
        }

        return this.profiles.map(profile => {
            const isActive = this.currentProfile && this.currentProfile.id === profile.id;
            return `
                <div class="profile-item ${isActive ? 'active' : ''}"
                     data-profile-id="${profile.id}">
                    <div class="profile-name">${escapeHtml(profile.name)}</div>
                    <div class="profile-type">${this.getProfileTypeName(profile.type)}</div>
                </div>
            `;
        }).join('');
    }

    // --- события ---
    // Слушатели контейнера навешиваются на конкретный элемент (render создаёт новый),
    // документные — один раз за жизнь экземпляра.

    setupEventListeners() {
        if (!this.container) {
            return;
        }

        if (this._listenersContainer !== this.container) {
            this._listenersContainer = this.container;
            this.container.addEventListener('click', (e) => this._onContainerClick(e));
            this.container.addEventListener('submit', (e) => this._onContainerSubmit(e));
        }

        if (!this._documentListenersAttached) {
            this._documentListenersAttached = true;

            // capture-фаза: обработчики внутри виджета заменяют innerHTML дропдауна,
            // из-за чего кликнутый элемент отсоединяется от DOM и на bubble-фазе
            // contains() вернул бы false, закрывая только что показанную форму.
            document.addEventListener('click', (e) => this._onDocumentClick(e), true);
            document.addEventListener('keydown', (e) => this._onDocumentKeydown(e));
        }
    }

    _onContainerClick(e) {
        const mainBtn = e.target.closest?.('#accountMainBtn');
        if (mainBtn) {
            e.stopPropagation();
            this.toggleDropdown();
            return;
        }

        if (e.target.classList.contains('auth-tab-header')) {
            this.switchAuthTab(e.target.getAttribute('data-tab'));
            return;
        }

        const menuItem = e.target.closest?.('.account-menu-item');
        if (menuItem && !menuItem.disabled && menuItem.getAttribute('data-action')) {
            this.handleAccountAction(menuItem.getAttribute('data-action'));
            return;
        }

        if (this.options.showProfiles) {
            const profileId = e.target.closest?.('.profile-item')?.getAttribute('data-profile-id');
            if (profileId) {
                this.handleProfileClick(parseInt(profileId, 10));
            }
        }
    }

    _onContainerSubmit(e) {
        e.preventDefault();
        if (e.target.id === 'loginForm') {
            this.login();
        } else if (e.target.id === 'registerForm') {
            this.register();
        }
    }

    _onDocumentClick(e) {
        if (this.container && !this.container.contains(e.target)) {
            this.hideDropdown();
        }
    }

    _onDocumentKeydown(e) {
        if (e.key === 'Escape' && this.dropdown?.classList.contains('show')) {
            this.hideDropdown();
        }
    }

    toggleDropdown() {
        if (!this.dropdown) {
            return;
        }
        this.dropdown.classList.contains('show') ? this.hideDropdown() : this.showDropdown();
    }

    showDropdown() {
        if (!this.dropdown) {
            return;
        }
        this.dropdown.innerHTML = this.getAuthHTML();
        this.dropdown.classList.add('show');
    }

    hideDropdown() {
        this.dropdown?.classList.remove('show');
    }

    showAuthForm() {
        if (!this.dropdown) {
            return;
        }
        this.dropdown.innerHTML = this.getAuthTabsHTML();
        this.dropdown.classList.add('show');
        setTimeout(() => this.dropdown?.querySelector('#loginEmail')?.focus(), 10);
    }

    switchAuthTab(tabName) {
        if (!this.container) {
            return;
        }
        this.container.querySelectorAll('.auth-tab-header').forEach(tab =>
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName));
        this.container.querySelectorAll('.auth-tab-pane').forEach(pane =>
            pane.classList.toggle('active', pane.id === `${tabName}-tab`));
    }

    handleAccountAction(action) {
        switch (action) {
            case 'settings':
                if (this.options.showSettings && this.options.settingsEnabled !== false) {
                    this._safeCall(this.options.onSettingsClick);
                    this.hideDropdown();
                }
                break;
            case 'account':
                if (this.options.accountPageUrl) {
                    window.location.href = this.options.accountPageUrl;
                }
                break;
            case 'switch-account':
                this.showAuthForm();
                break;
            case 'logout':
                this.hideDropdown();
                this.logout();
                break;
        }
    }

    setSettingsEnabled(enabled) {
        this.options.settingsEnabled = !!enabled;
        const item = this.dropdown?.querySelector('.account-menu-item[data-action="settings"]');
        if (item) {
            item.disabled = !this.options.settingsEnabled;
        }
    }

    handleProfileClick(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            return;
        }
        this.currentProfile = profile;
        this.saveToStorage();
        this.updateProfilesDisplay();
        this._safeCall(this.options.onProfileClick, profile);
        this.hideDropdown();
    }

    // --- сеть ---

    async makeRequest(url, options = {}) {
        this.setLoadingState(true);
        try {
            const response = await fetch(this.options.apiBaseUrl + url, {
                ...options,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
            });

            // Просроченный access-токен: обновляем и повторяем запрос один раз.
            if (response.status === 401 && this.isAuthenticated() &&
                !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
                if (await this.refreshToken()) {
                    return this.makeRequest(url, options);
                }
                await this.logout();
                throw new Error('Authentication failed');
            }

            if (!response.ok) {
                let message = `HTTP error! status: ${response.status}`;
                try {
                    const data = await response.json();
                    message = data.error || message;
                } catch (e) {
                    // тело не JSON — оставляем статус
                }
                throw new Error(message);
            }

            return await response.json();
        } catch (error) {
            if (!error.message.includes('Not authenticated') &&
                !error.message.includes('Authentication failed')) {
                this.showAlert('error', error.message);
            }
            throw error;
        } finally {
            this.setLoadingState(false);
        }
    }

    async loadLegalConfig() {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/legal`);
            if (!response.ok) {
                return;
            }
            const config = await response.json();
            this.legalEnabled = config.enabled !== false;
            if (this.dropdown?.classList.contains('show') && !this.currentUser) {
                this.dropdown.innerHTML = this.getAuthHTML();
            }
        } catch (e) {
            // оставляем значение по умолчанию (согласие показывается)
        }
    }

    async getAccountInfo() {
        try {
            const result = await this.makeRequest('/account');
            if (result?.user) {
                this.currentUser = result.user;
                this.profiles = result.profiles || [];

                if (this.profiles.length > 0) {
                    const savedId = this.currentProfile?.id;
                    const saved = savedId ? this.profiles.find(p => p.id === savedId) : null;
                    this.currentProfile = saved || this.profiles[0] || null;
                }

                this.saveToStorage();
                this.updateUI();
                this._safeCall(this.options.onAuthRefresh, this.currentUser, this.profiles);
                return true;
            }
            await this.logout();
        } catch (error) {
            if (!this.currentUser) {
                this.onLogout();
            }
        }
        return false;
    }

    async loadProfiles() {
        try {
            const result = await this.makeRequest('/profiles');
            if (result && !result.error) {
                this.profiles = result;
                this.saveToStorage();
                this.updateProfilesDisplay();
            }
        } catch (error) {
            // ошибка уже обработана в makeRequest
        }
    }

    async refreshToken() {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            if (response.ok) {
                return true;
            }
            await this.logout();
            return false;
        } catch (error) {
            return false;
        }
    }

    // --- поддержание сессии ---

    startTokenMonitoring() {
        this.tokenCheckInterval = setInterval(() => this._checkAndRefreshToken(), TOKEN_CHECK_INTERVAL_MS);
        document.addEventListener('click', () => this._updateActivityTime());
        document.addEventListener('keypress', () => this._updateActivityTime());
    }

    _updateActivityTime() {
        this.lastActivityTime = Date.now();
    }

    async _checkAndRefreshToken() {
        if (!this.isAuthenticated() || this.isRefreshing) {
            return;
        }
        if (Date.now() - this.lastActivityTime > ACTIVITY_TIMEOUT_MS) {
            return;
        }

        try {
            this.isRefreshing = true;
            if (await this.refreshToken()) {
                this._safeCall(this.options.onAuthRefresh, this.currentUser, this.profiles);
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    // --- аутентификация ---

    async login() {
        const email = this.container?.querySelector('#loginEmail')?.value;
        const password = this.container?.querySelector('#loginPassword')?.value;

        if (!email || !password) {
            this.showAlert('error', 'Заполните все поля', 'login-tab');
            return;
        }

        let result;
        try {
            result = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
        } catch (error) {
            this._setAnonymousState();
            this.showAlert('error', error.message, 'login-tab');
            return;
        }

        if (result?.user) {
            await this._completeAuth(result.user, '#loginForm');
        }
    }

    async register() {
        const email = this.container?.querySelector('#regEmail')?.value;
        const username = this.container?.querySelector('#regUsername')?.value;
        const password = this.container?.querySelector('#regPassword')?.value;
        const consentCheckbox = this.container?.querySelector('#regPersonalDataAgreement');
        const personalDataAgreement = !!consentCheckbox?.checked;

        if (!email || !username || !password) {
            this.showAlert('error', 'Заполните все поля', 'register-tab');
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            this.showAlert('error', `Пароль должен быть не менее ${MIN_PASSWORD_LENGTH} символов`, 'register-tab');
            return;
        }
        if (consentCheckbox?.required && !personalDataAgreement) {
            this.showAlert('error', 'Необходимо согласие на обработку персональных данных', 'register-tab');
            return;
        }

        let result;
        try {
            result = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    username,
                    password,
                    personal_data_agreement: personalDataAgreement,
                    cookies_agreement: readCookie('cookie_consent_v1') === 'accepted'
                })
            });
        } catch (error) {
            this.showAlert('error', error.message, 'register-tab');
            return;
        }

        if (result?.user) {
            await this._completeAuth(result.user, '#registerForm');
        }
    }

    async _completeAuth(user, formSelector) {
        this.currentUser = user;
        await this._syncProfileData();

        this.saveToStorage();
        this.container?.querySelector(formSelector)?.reset();
        this.hideDropdown();
        await this.onAuthSuccess();

        this._safeCall(this.options.onLogin, this.currentUser);
    }

    async _syncProfileData() {
        try {
            const account = await this.makeRequest('/account');
            if (account?.profiles) {
                this.profiles = account.profiles;
                this.currentProfile = this.profiles[0] || null;
            }
        } catch (error) {
            await this.loadProfiles();
        }
    }

    async logout() {
        try {
            await this.makeRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            // выход выполняется в любом случае
        } finally {
            this._setAnonymousState();
            this.onLogout();
            this._safeCall(this.options.onLogout);
        }
    }

    onAuthSuccess() {
        this.saveToStorage();
        this._renderMainButton();
        if (this.dropdown) {
            this.dropdown.innerHTML = this.getAccountMenuHTML();
        }
    }

    onLogout() {
        this.clearStorage();
        this._renderMainButton();
        if (this.dropdown) {
            this.dropdown.innerHTML = this.getAuthTabsHTML();
        }
    }

    // --- утилиты ---

    setLoadingState(loading) {
        const btn = this.container?.querySelector('#accountMainBtn');
        if (!btn) {
            return;
        }
        btn.classList.toggle('loading', loading);
        btn.disabled = loading;
    }

    showAlert(type, message, containerId = null) {
        const target = containerId
            ? this.container?.querySelector(`#${containerId}`)
            : this.container?.querySelector('.auth-tab-content');
        if (!target) {
            return;
        }

        target.querySelector('.alert')?.remove();

        const alert = document.createElement('div');
        alert.className = `alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
        alert.textContent = message;
        alert.style.display = 'block';
        target.insertBefore(alert, target.firstChild);

        setTimeout(() => alert.remove(), 5000);
    }

    getProfileTypeName(type) {
        return PROFILE_TYPE_NAMES[type] || type;
    }

    // Вызов пользовательского коллбека: ошибка в нём не должна ломать состояние виджета.
    _safeCall(callback, ...args) {
        if (typeof callback !== 'function') {
            return;
        }
        try {
            const result = callback(...args);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => console.error('AccountWidget callback error:', error));
            }
        } catch (error) {
            console.error('AccountWidget callback error:', error);
        }
    }

    // --- публичный API ---

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
            this.saveToStorage();
            this.updateProfilesDisplay();
        }
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    async refreshAuthState() {
        return this.getAccountInfo();
    }
}

// Глобальная переменная для обратной совместимости
let accountWidget = null;
