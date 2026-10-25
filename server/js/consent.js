// Уведомление об использовании cookie и обработке персональных данных (152-ФЗ).
// Показывается новым пользователям; при отказе cookie не сохраняются, показ
// повторяется только в рамках текущей сессии.
(function () {
    'use strict';

    const STORAGE_KEY = 'pd_consent_v1';
    const SESSION_DECLINE_KEY = 'pd_consent_declined';

    function hasConsent() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'accepted';
        } catch (e) {
            return false;
        }
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
            localStorage.setItem(STORAGE_KEY, 'accepted');
        } catch (e) {
            // localStorage может быть недоступен (приватный режим) — используем cookie
        }
        try {
            document.cookie = STORAGE_KEY + '=accepted; max-age=' + (365 * 24 * 60 * 60) +
                '; path=/; SameSite=Lax';
        } catch (e) {
            // ignore
        }
    }

    // Для зарегистрированного пользователя сохраняем согласие и дату в БД.
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
            <p>Мы используем файлы cookie. Используя сайт, вы предоставляете согласие на обработку
            ваших персональных данных. Для работы части функций сайта (вход, профили, статистика)
            необходимы cookie. Подробнее — в
            <a href="${legal.policy_url}" target="_blank" rel="noopener">Политике обработки персональных данных</a>.</p>
            <label class="cookie-consent-check">
                <input type="checkbox" id="cookieConsentCheck">
                <span>Даю согласие на обработку своих персональных данных и использование файлов cookie</span>
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

        const check = banner.querySelector('#cookieConsentCheck');
        const acceptBtn = banner.querySelector('#cookieConsentAccept');
        const declineBtn = banner.querySelector('#cookieConsentDecline');

        check.addEventListener('change', function () {
            acceptBtn.disabled = !check.checked;
        });

        acceptBtn.addEventListener('click', async function () {
            if (!check.checked) {
                return;
            }
            storeConsent();
            await persistForRegisteredUser();
            hide(banner);
        });

        declineBtn.addEventListener('click', function () {
            // Пользователь не согласен: cookie не сохраняем, повторный показ —
            // только в текущей сессии.
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

        let legal = { enabled: false, policy_url: '/policy' };
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
