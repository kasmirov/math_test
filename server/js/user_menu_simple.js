// Виджет меню пользователя для "простых" страниц (лендинг, инструкция,
// правовые страницы): нужен только блок аккаунта в шапке, без профилей,
// настроек, тестов и статистики.
const accWidget = AccountWidget.getInstance({
    apiBaseUrl: '/api',
    alignment: 'right',
    container: '.user-menu-container',
    accountPageUrl: '/account.html',
    showSettings: false,
    showProfiles: false
});

// Сохраняем для глобального доступа
accountWidget = accWidget;
