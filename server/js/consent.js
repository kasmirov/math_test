// Уведомление об использовании файлов cookie.
// Согласие на обработку персональных данных оформляется в форме регистрации
// (см. /consent); баннер лишь информирует о ПД и запрашивает согласие на cookie.
// Показывается новым пользователям; при отказе cookie не сохраняются, показ
// повторяется только в рамках текущей сессии.
//
// Источник истины — cookie `cookie_consent_v1`: очистка cookie браузером
// сбрасывает согласие, и баннер показывается снова.
(function () {
    'use strict';

    const COOKIE_KEY = 'cookie_consent_v1';   // согласие на использование cookie
    const SESSION_DECLINE_KEY = 'pd_consent_declined';
    const ONE_YEAR = 365 * 24 * 60 * 60;

    function readCookie(name) {
        try {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : null;
        } catch (e) {
            return null;
        }
    }

    function hasConsent() {
        return readCookie(COOKIE_KEY) === 'accepted';
    }

    function wasDeclined() {
        try {
            return sessionStorage.getItem(SESSION_DECLINE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function storeConsent() {
        try {
            document.cookie = COOKIE_KEY + '=accepted; max-age=' + ONE_YEAR + '; path=/; SameSite=Lax';
        } catch (e) {
            // ignore
        }
    }

    // Для зарегистрированного пользователя сохраняем согласие на cookie и дату в БД.
    // Для анонимных запрос вернёт 401 — это ожидаемо и молча игнорируется.
    async function persistForRegisteredUser() {
        try {
            await fetch('/api/account', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cookies_agreement: true })
            });
        } catch (e) {
            // ignore
        }
    }

    function buildBanner(legal) {
        const banner = document.createElement('div');
        banner.className = 'cookie-consent';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Уведомление об использовании cookie');
        banner.innerHTML = `
            <p>Мы используем файлы cookie. Для работы части функций сайта (вход, профили, статистика)
            они необходимы. Порядок обработки персональных данных описан в
            <a href="${legal.policy_url}" target="_blank" rel="noopener">Политике обработки персональных данных</a>;
            согласие на обработку персональных данных оформляется при регистрации
            (<a href="${legal.consent_url}" target="_blank" rel="noopener">текст согласия</a>).</p>
            <label class="cookie-consent-check">
                <input type="checkbox" id="cookieConsentCheck">
                <span>Согласен(на) на использование файлов cookie</span>
            </label>
            <div class="cookie-consent-actions">
                <button type="button" class="btn" id="cookieConsentAccept" disabled>Согласен</button>
                <button type="button" class="btn btn-secondary" id="cookieConsentDecline">Отказаться</button>
            </div>
        `;
        return banner;
    }

    function showBanner(legal) {
        const banner = buildBanner(legal);
        document.body.appendChild(banner);
        requestAnimationFrame(() => banner.classList.add('show'));

        const cookieCheck = banner.querySelector('#cookieConsentCheck');
        const acceptBtn = banner.querySelector('#cookieConsentAccept');
        const declineBtn = banner.querySelector('#cookieConsentDecline');

        cookieCheck.addEventListener('change', function () {
            acceptBtn.disabled = !cookieCheck.checked;
        });

        acceptBtn.addEventListener('click', async function () {
            if (!cookieCheck.checked) {
                return;
            }
            storeConsent();
            await persistForRegisteredUser();
            hide(banner);
        });

        declineBtn.addEventListener('click', function () {
            // Пользователь не согласен: согласие не сохраняем, повторный показ —
            // только в текущей сессии. Файлы cookie (кроме строго необходимых
            // для входа) не устанавливаются.
            try {
                sessionStorage.setItem(SESSION_DECLINE_KEY, '1');
            } catch (e) {
                // ignore
            }
            hide(banner);
        });
    }

    function hide(banner) {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 300);
    }

    async function init() {
        if (hasConsent() || wasDeclined()) {
            return;
        }

        let legal = { enabled: false, policy_url: '/policy', consent_url: '/consent' };
        try {
            const response = await fetch('/api/legal');
            if (response.ok) {
                legal = await response.json();
            }
        } catch (e) {
            return;
        }

        // В минимальном (локальном/персональном) режиме предупреждение не показываем.
        if (!legal.enabled || hasConsent() || wasDeclined()) {
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => showBanner(legal));
        } else {
            showBanner(legal);
        }
    }

    init();
})();
