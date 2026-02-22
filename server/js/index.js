// Глобальные переменные состояния приложения
let currentUser = null;
let currentProfile = null;
let profiles = [];

// API базовый URL
const API_BASE_URL = '/api';

// Функция для обновления информации в приложении
function updateAppInfo() {
    console.log('updateAppInfo Информация приложения обновлена');
}

function storeProfile() {
    // Сохраняем текущий профиль пользователя в localStorage
	if (currentProfile && currentUser) {
		const userSession = {
			lastUser: currentUser,
			lastProfile: currentProfile
		};
		localStorage.setItem('UserSession', JSON.stringify(userSession));
	}
}

function loadLastProfile() {
    if (currentUser === null) {
        return;
    }
    const savedSession = localStorage.getItem('UserSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        lastUser = session.lastUser !== undefined ? session.lastUser : null;
        if (lastUser === null) {
            return;
        }
        lastProfile = session.lastProfile !== undefined ? session.lastProfile : null;
        if (lastProfile && lastUser.id === currentUser.id) {
            currentProfile = lastProfile;
        }
    }
}

const accWidget = AccountWidget.getInstance({
    apiBaseUrl: API_BASE_URL,
    alignment: 'right',
    container: '.user-menu-container',
    accountPageUrl: '/account.html',
    showSettings: false,
    showProfiles: false,

    onLogin: (user) => {
        console.log('Пользователь вошел:', user);
        currentUser = user;

        // Восстанавливаем выбранный профиль если он был
        loadLastProfile();
        updateAppInfo();

        // Применяем настройки профиля
        applyProfileSettings(currentProfile.settings);

        // Для перерисовки имени профиля
        if (currentProfile) {
            accountWidget.currentProfile = currentProfile;
            accountWidget.updateProfilesDisplay();
            loadBlocks();
        }
    },

    onLogout: () => {
        console.log('Пользователь вышел');
        currentUser = null;
        currentProfile = null;
        profiles = [];
        updateAppInfo();
        loadBlocks();
    },

    onAccountUpdate: (user) => {
        console.log('Данные пользователя обновлены:', user);
        currentUser = user;
        updateAppInfo();
        loadBlocks();
    },

    onProfileClick: (profile) => {
        console.log('Выбран профиль:', profile);

        // Сохраняем текущие настройки
        saveSettings();

        currentProfile = profile;


        // Сохраняем последний использованных профиль
        storeProfile();

        updateAppInfo();

        // Применяем настройки профиля
        applyProfileSettings(profile.settings);
    },

    onSettingsClick: () => {
        console.log('Toggle settings menu');
        toggleSettings();
    },

    // Коллбек для обновления при загрузке/обновлении страницы
    onAuthRefresh: (user, profilesList) => {
        console.log('Состояние аутентификации обновлено:', user);
        currentUser = user;
        profiles = profilesList || [];

        loadLastProfile();
        loadSettings();
        updateAppInfo();

        // Применяем настройки профиля
        applyProfileSettings(currentProfile.settings);

        // Для перерисовки имени профиля
        if (currentProfile) {
            accountWidget.currentProfile = currentProfile;
            accountWidget.updateProfilesDisplay();
        }
    }
});

function applyProfileSettings(settings) {
    // Пример применения настроек профиля
    if (settings.theme) {
        document.body.style.backgroundColor = settings.theme === 'dark' ? '#1a202c' : 'white';
        document.body.style.color = settings.theme === 'dark' ? 'white' : 'black';
    }

    console.log('Применены настройки профиля:', settings);
}

// Сохраняем для глобального доступа
accountWidget = accWidget;