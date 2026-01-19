// Глобальные переменные состояния приложения
let currentUser = null;
let currentProfile = null;
let profiles = [];
let currentSessionId = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 0;
let answersHistory = [];
let availableTags = [];
let selectedTags = [];
let allBlocks = [];
let blocksLoaded = false;
let autoSubmitOnTimeout = true; // По умолчанию автоотправка включена
let timeout = 'auto';           // По умолчанию auto
let numOfQuestions = 3;
let selectedBlocks = [];

// API базовый URL
const API_BASE_URL = '/api';

// DOM элементы
const mainScreen = document.getElementById('mainScreen');
const blocksScreen = document.getElementById('blocksScreen');
const testScreen = document.getElementById('testScreen');
const statsScreen = document.getElementById('statsScreen');
const settingsPanel = document.getElementById('settingsPanel');
const autoSubmitOnTimeoutCheckbox = document.getElementById('autoSubmitOnTimeout');
const timeoutCombobox = document.getElementById('timeoutSelector');
const questionsCombobox = document.getElementById('numQuestionsSelector');

const homeBtn = document.getElementById('homeBtn');
const pageTitle = document.getElementById('pageTitle');

const newTestBtn = document.getElementById('newTestBtn');
const workOnErrorsBtn = document.getElementById('workOnErrorsBtn');
const viewStatsBtn = document.getElementById('viewStatsBtn');

const backFromBlocksBtn = document.getElementById('backFromBlocksBtn');
const startTestBtn = document.getElementById('startTestBtn');

const backFromStatsBtn = document.getElementById('backFromStatsBtn');

const filtersContainer = document.getElementById('filtersContainer');
const filtersList = document.getElementById('filtersList');
const blocksList = document.getElementById('blocksList');
const answersHistoryContainer = document.getElementById('answersHistory');
const questionText = document.getElementById('questionText');
const questionHint = document.getElementById('questionHint');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const resultMessage = document.getElementById('resultMessage');
const timer = document.getElementById('timer');
const currentBlockName = document.getElementById('currentBlockName');
const questionProgress = document.getElementById('questionProgress');
const answerForm = document.getElementById('answerForm');

const statsResults = document.getElementById('statsResults');
const statsFilters = document.getElementById('statsFilters');

// Элементы панели уведомления
const sessionNotification = document.getElementById('sessionNotification');
const notificationRestoreBtn = document.getElementById('notificationRestoreBtn');
const notificationCloseBtn = document.getElementById('notificationCloseBtn');

// Меню пользователя


// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {

	// Назначаем обработчики событий
	setupEventListeners();

	// Предварительно загружаем блоки вопросов при запуске приложения
	loadBlocks();

	// Загружаем профиль, если был логин
	loadLastProfile();

	// Загружаем настройки
	loadSettings();

	// Настраиваем фильтры статистики
	setupStatsFilters();

	// Показываем уведомление об активной сессии через небольшую задержку
    setTimeout(checkActiveSession, 1000);

    // Обновление аккаунта после чего-то там с меню
    setTimeout(updateAppInfo, 1000);
});

function setupEventListeners() {
	// Меню пользователя


	// Главный экран
	newTestBtn.addEventListener('click', showBlocksScreen);
	workOnErrorsBtn.addEventListener('click', showStatsScreenForErrors);
	viewStatsBtn.addEventListener('click', showStatsScreen);


	// Настройки
	autoSubmitOnTimeoutCheckbox.addEventListener('change', function() {
		autoSubmitOnTimeout = this.checked;
		saveSettings();
	});

	timeoutCombobox.addEventListener('change', function() {
		timeout = this.value;
		saveSettings();
	});

	questionsCombobox.addEventListener('change', function() {
		numOfQuestions = this.value;
		saveSettings();
	});

	// Экран выбора блоков
	backFromBlocksBtn.addEventListener('click', showMainScreen);
	startTestBtn.addEventListener('click', startNewTest);

	// Экран тестирования
	submitAnswerBtn.addEventListener('click', submitAnswer);
	answerInput.addEventListener('keypress', function(e) {
		if (e.key === 'Enter') {
			submitAnswer();
		}
	});

	// Экран статистики
	backFromStatsBtn.addEventListener('click', showMainScreen);

	// Кнопка "В начало"
	homeBtn.addEventListener('click', showMainScreen);

    // Панель уведомления
    // Кнопка Restore
    notificationRestoreBtn.addEventListener('click', restoreActiveSession);
    // Кнопка Close
    notificationCloseBtn.addEventListener('click', clearSession);

    // TODO remove
	// Обработка закрытия страницы
	//window.addEventListener('beforeunload', handleBeforeUnload);
}

function setupStatsFilters() {
	// Очищаем контейнер
	statsFilters.innerHTML = '';

	// Добавляем фильтр по дате "с"
	const dateFromGroup = document.createElement('div');
	dateFromGroup.className = 'filter-group';
	dateFromGroup.innerHTML = `
		<label for="dateFrom">Дата с:</label>
		<input type="date" class="filter-input" id="dateFrom">
	`;
	statsFilters.appendChild(dateFromGroup);

	// Добавляем фильтр по дате "по"
	const dateToGroup = document.createElement('div');
	dateToGroup.className = 'filter-group';
	dateToGroup.innerHTML = `
		<label for="dateTo">Дата по:</label>
		<input type="date" class="filter-input" id="dateTo">
	`;
	statsFilters.appendChild(dateToGroup);

	// Добавляем фильтр по блокам
	const blockGroup = document.createElement('div');
	blockGroup.className = 'filter-group';
	blockGroup.innerHTML = `
		<label for="blockFilter">Блок вопросов:</label>
		<select class="filter-input" id="blockFilter">
			<option value="">Все блоки</option>
		</select>
	`;
	statsFilters.appendChild(blockGroup);

	// Заполняем фильтр блоками
	populateBlockFilter();

	// Добавляем обработчики изменений
	document.getElementById('dateFrom').addEventListener('change', function() {
		if (statsScreen.style.display === 'block') {
			// TODO
			// const isForErrors = statsTitle.textContent === 'Работа над ошибками';
			const isForErrors = false;
			loadStatistics(isForErrors);
		}
	});

	document.getElementById('dateTo').addEventListener('change', function() {
		if (statsScreen.style.display === 'block') {
			// TODO
			// const isForErrors = statsTitle.textContent === 'Работа над ошибками';
			const isForErrors = false;
			loadStatistics(isForErrors);
		}
	});

	document.getElementById('blockFilter').addEventListener('change', function() {
		if (statsScreen.style.display === 'block') {
			// TODO
			// const isForErrors = statsTitle.textContent === 'Работа над ошибками';
			const isForErrors = false;
			loadStatistics(isForErrors);
		}
	});
}

function populateBlockFilter() {
	const blockFilter = document.getElementById('blockFilter');
	if (!blockFilter) return;

	// Сохраняем текущее значение
	const currentValue = blockFilter.value;

	blockFilter.innerHTML = '<option value="">Все блоки</option>';
	allBlocks.forEach(block => {
		const option = document.createElement('option');
		option.value = block.id;
		option.textContent = block.name;
		blockFilter.appendChild(option);
	});

	// Восстанавливаем выбранное значение
	blockFilter.value = currentValue;
}

function loadSettings() {
    if (!currentUser || !currentUser.id || !currentProfile || !currentProfile.id) {
        return;
    }
    const storageKey = `testSettings_${currentUser.id}_${currentProfile.id}`;
    const savedSettings = localStorage.getItem(storageKey);
	if (savedSettings) {
		const settings = JSON.parse(savedSettings);

		autoSubmitOnTimeout = settings.autoSubmitOnTimeout !== undefined ? settings.autoSubmitOnTimeout : true;
		autoSubmitOnTimeoutCheckbox.checked = autoSubmitOnTimeout;

		timeout = settings.timeout !== undefined ? settings.timeout : 'auto';
		timeoutCombobox.value = timeout

		numOfQuestions = settings.numOfQuestions !== undefined ? settings.numOfQuestions : 3;
		questionsCombobox.value = numOfQuestions;
	}
}

function saveSettings() {
    if (!currentUser || !currentUser.id || !currentProfile || !currentProfile.id) {
        // Не удалось сохранить настройки: отсутствуют данные пользователя или профиля
        return;
    }
	const settings = {
		autoSubmitOnTimeout: autoSubmitOnTimeout,
		timeout: timeout,
		numOfQuestions: numOfQuestions
	};
	const storageKey = `testSettings_${currentUser.id}_${currentProfile.id}`;
	localStorage.setItem(storageKey, JSON.stringify(settings));
}

function toggleSettings() {
	settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
}


function handleBeforeUnload(e) {

}

function showMainScreen() {
	mainScreen.style.display = 'block';
	blocksScreen.style.display = 'none';
	testScreen.style.display = 'none';
	statsScreen.style.display = 'none';

    // Показываем уведомление о сессии, если она есть
    checkActiveSession();

	// Скрываем кнопку "В начало"
	homeBtn.style.display = 'none';

	// Обновляем заголовок страницы
	pageTitle.textContent = 'Математические тесты';
}

function showBlocksScreen() {
	/*
	if (!currentUser) {
		alert('Пожалуйста, выберите пользователя для начала теста');
		return;
	}
	*/

	mainScreen.style.display = 'none';
	blocksScreen.style.display = 'block';
	testScreen.style.display = 'none';
	statsScreen.style.display = 'none';

	// восстанавливаем selectedBlocks из визуального состояния
	// при первом отображении экрана
	if (!blocksLoaded) {
		loadBlocks();
	} else {
		// Если блоки уже загружены, синхронизируем selectedBlocks с визуальным состоянием
		syncSelectedBlocksFromUI();
	}

    // Показываем уведомление о сессии, если она есть
    checkActiveSession();

	// Показываем кнопку "В начало"
	homeBtn.style.display = 'flex';

	// Обновляем заголовок страницы
	pageTitle.textContent = 'Новый тест';

	// Если блоки еще не загружены, загружаем их
	if (!blocksLoaded) {
		loadBlocks();
	}
}

function syncSelectedBlocksFromUI() {
	// Получаем все карточки блоков
	const blockCards = document.querySelectorAll('.block-card');
	const newSelectedBlocks = [];

	blockCards.forEach(card => {
		if (card.classList.contains('selected')) {
			// Извлекаем ID блока из данных карточки
			const blockIdElement = card.querySelector('.block-id');
			if (blockIdElement) {
				const blockId = parseInt(blockIdElement.textContent);
				newSelectedBlocks.push(blockId);
			}
		}
	});

	// Обновляем selectedBlocks
	selectedBlocks = newSelectedBlocks;
}

/*
    ****************************
    ******  Test screen  *******
    ****************************
*/
function showTestScreen() {
	mainScreen.style.display = 'none';
	blocksScreen.style.display = 'none';
	testScreen.style.display = 'block';
	statsScreen.style.display = 'none';

	// Скрываем уведомление при переходе на экран теста
    hideSessionNotification();

	// Показываем кнопку "В начало"
	homeBtn.style.display = 'flex';

	// Обновляем заголовок страницы
	pageTitle.textContent = 'Тестирование';

	// Обновляем историю ответов
	updateAnswersHistory();
}

async function showStatsScreen() {
	if (!currentUser) {
		alert('Пожалуйста, выберите пользователя для просмотра статистики');
		return;
	}

	mainScreen.style.display = 'none';
	blocksScreen.style.display = 'none';
	testScreen.style.display = 'none';
	statsScreen.style.display = 'block';

	// Показываем кнопку "В начало"
	homeBtn.style.display = 'flex';

	// Обновляем заголовок страницы
	pageTitle.textContent = 'Статистика';

	// statsTitle.textContent = 'Статистика';
	// statsSubtitle.textContent = 'Просмотр результатов';

	// Если блоки еще не загружены, загружаем их перед отображением статистики
	if (!blocksLoaded) {
		await loadBlocks();
	}

	loadStatistics();
}

async function showStatsScreenForErrors() {
	if (!currentUser) {
		alert('Пожалуйста, выберите пользователя для работы над ошибками');
		return;
	}

	mainScreen.style.display = 'none';
	blocksScreen.style.display = 'none';
	testScreen.style.display = 'none';
	statsScreen.style.display = 'block';

	// Показываем кнопку "В начало"
	homeBtn.style.display = 'flex';

	// Обновляем заголовок страницы
	pageTitle.textContent = 'Работа над ошибками';

	// statsTitle.textContent = 'Работа над ошибками';
	// statsSubtitle.textContent = 'Анализ неправильных ответов';

	// Если блоки еще не загружены, загружаем их перед отображением статистики
	if (!blocksLoaded) {
		await loadBlocks();
	}

	loadStatistics(true);
}

async function loadBlocks() {
	// Если блоки уже загружаются, не делаем повторный запрос
	if (blocksList.innerHTML.includes('loading') && !blocksLoaded) {
		return;
	}

	blocksList.innerHTML = '<div class="loading">Загрузка блоков вопросов...</div>';

	try {
		const response = await fetch(`${API_BASE_URL}/test/blocks`);
		if (!response.ok) {
			throw new Error(`Ошибка загрузки: ${response.status}`);
		}

		const data = await response.json();
		allBlocks = data.blocks;
		availableTags = data.available_tags;
		blocksLoaded = true;

		renderFilters();
		renderBlocks(allBlocks);
		populateBlockFilter();

	} catch (error) {
		console.error('Ошибка при загрузке блоков:', error);
		blocksList.innerHTML = `
			<div class="error-message">
				Не удалось загрузить блоки вопросов. Проверьте подключение к серверу.
			</div>
		`;
	}
}

function renderFilters() {
	filtersList.innerHTML = '';

	if (availableTags.length === 0) {
		filtersContainer.style.display = 'none';
		return;
	}

	filtersContainer.style.display = 'block';

	availableTags.forEach(tag => {
		const filterBtn = document.createElement('button');
		filterBtn.className = 'filter-btn';
		filterBtn.textContent = tag;
		filterBtn.dataset.tag = tag;

		if (selectedTags.includes(tag)) {
			filterBtn.classList.add('active');
		}

		filterBtn.addEventListener('click', function() {
			toggleTagFilter(tag);
		});

		filtersList.appendChild(filterBtn);
	});
}

function toggleTagFilter(tag) {
	const index = selectedTags.indexOf(tag);

	if (index === -1) {
		selectedTags.push(tag);
	} else {
		selectedTags.splice(index, 1);
	}

	renderFilters();
	filterAndRenderBlocks();
}

function filterAndRenderBlocks() {
	let filteredBlocks = allBlocks;

	if (selectedTags.length > 0) {
		filteredBlocks = allBlocks.filter(block =>
			selectedTags.some(tag => block.tags.includes(tag))
		);
	}

	renderBlocks(filteredBlocks);
}

function renderBlocks(blocks) {
	blocksList.innerHTML = '';

	if (blocks.length === 0) {
		const noBlocksMessage = document.createElement('div');
		noBlocksMessage.className = 'no-blocks-message';
		noBlocksMessage.textContent = 'Нет блоков, соответствующих выбранным фильтрам';
		blocksList.appendChild(noBlocksMessage);
		return;
	}

	blocks.forEach(block => {
		const blockCard = document.createElement('div');
		blockCard.className = 'block-card';
		if (selectedBlocks.includes(block.id)) {
			blockCard.classList.add('selected');
		}

		const tagsHtml = block.tags.map(tag =>
			`<span class="tag">${tag}</span>`
		).join('');

		blockCard.innerHTML = `
			<div class="block-id">${block.id}</div>
			<h3>${block.name}</h3>
			<p>${block.description}</p>
			<p>Количество вопросов: ${block.question_count}</p>
			<div style="margin-bottom: 10px;">${tagsHtml}</div>
		`;

		// Обработчик выбора блока
		blockCard.addEventListener('click', function() {
			// Сначала обновляем визуальное состояние
			blockCard.classList.toggle('selected');
			// Затем синхронизируем с selectedBlocks
			toggleBlockSelection(block.id);
		});

		blocksList.appendChild(blockCard);
	});
}

function toggleBlockSelection(blockId) {
	const index = selectedBlocks.indexOf(blockId);

	if (index === -1) {
		selectedBlocks.push(blockId);
	} else {
		selectedBlocks.splice(index, 1);
	}

	// Обновляем отображение выбранных блоков
	renderBlocks(allBlocks.filter(block =>
		selectedTags.length === 0 ||
		selectedTags.some(tag => block.tags.includes(tag))
	));
}

async function startNewTest() {
	// Перед началом теста убедимся, что selectedBlocks синхронизированы
	syncSelectedBlocksFromUI();

	if (selectedBlocks.length === 0) {
		alert('Пожалуйста, выберите хотя бы один блок вопросов');
		return;
	}

    // Чистим активную сессию если есть
    clearSession();

	// Показываем экран теста и настраиваем начальное состояние
	blocksScreen.style.display = 'none';
	testScreen.style.display = 'block';

	// Сбрасываем состояние
	answersHistory = [];
	updateAnswersHistory();

	// Показываем состояние загрузки
	questionText.textContent = 'Создание сессии тестирования...';
	currentBlockName.textContent = 'Раздел: Загрузка...';
	questionProgress.textContent = '[0/0]';
	answerInput.disabled = true;
	submitAnswerBtn.disabled = true;
	resultMessage.style.display = 'none';

	try {
		const params = new URLSearchParams();
		selectedBlocks.forEach(blockId => {
			params.append('block_id', blockId);
		});

		params.append('num_of_questions', numOfQuestions)

		if (timeout != 'auto')
		{
		    params.append('timeout', timeout)
		}

		const response = await fetch(`${API_BASE_URL}/test/session/new?${params}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
                profile_id: currentProfile && currentProfile.id ? currentProfile.id : null
			})
		});

		if (!response.ok) {
			throw new Error(`Ошибка создания сессии: ${response.status}`);
		}

		const responseData = await response.json();
		currentSessionId = responseData.session_uuid;

		// Сохраняем сессию
		saveSession(currentSessionId);

		// Загружаем первый вопрос
		await loadNextQuestion();

	} catch (error) {
		console.error('Ошибка при создании сессии:', error);
		questionText.innerHTML = `
			<div class="error-message">
				Не удалось начать тест. Проверьте подключение к серверу.
			</div>
			<button class="btn" onclick="showBlocksScreen()">Вернуться к выбору блоков</button>
		`;
		answerForm.style.display = 'none';
	}
}

async function loadNextQuestion() {
	try {
		const response = await fetch(`${API_BASE_URL}/test/session/${currentSessionId}`);

		if (!response.ok) {
			throw new Error(`Ошибка загрузки вопроса: ${response.status}`);
		}

		const questionData = await response.json();

		// Проверяем, не завершен ли тест
		if (questionData.message === "Тест завершен") {
			showTestCompletion();
			return;
		}

		currentQuestion = questionData;

		// Обновляем интерфейс
		currentBlockName.textContent = `Раздел: ${currentQuestion.block_name}`;
		questionProgress.textContent = `[${currentQuestion.current_question_number}/${currentQuestion.total_questions_in_block}]`;
        questionText.innerHTML = currentQuestion.text;

        // Обрабатываем LaTeX формулы для текущего вопроса
        renderMathJax(questionText);

        // Показываем подсказку если есть
        if (currentQuestion.block_hint) {
            questionHint.style.display = 'block';
			questionHint.innerHTML = currentQuestion.block_hint;
		}
		else {
		    questionHint.style.display = 'none';
		}

		answerInput.value = '';
		resultMessage.style.display = 'none';

		// Активируем поле ввода
		answerInput.disabled = false;
		submitAnswerBtn.disabled = false;
		answerForm.style.display = 'block';
		answerInput.focus();

		// Запускаем таймер
		timeLeft = currentQuestion.time_limit;
		updateTimerDisplay();

		if (timerInterval) {
			clearInterval(timerInterval);
		}

		timerInterval = setInterval(function() {
			timeLeft--;
			updateTimerDisplay();

			if (timeLeft <= 0) {
				clearInterval(timerInterval);
				handleTimeout();
			}
		}, 1000);

	} catch (error) {
		console.error('Ошибка при загрузке вопроса:', error);
		questionText.innerHTML = `
			<div class="error-message">
				Не удалось загрузить вопрос. Проверьте подключение к серверу.
			</div>
			<button class="btn" onclick="showMainScreen()">Вернуться на главную</button>
		`;
		answerForm.style.display = 'none';

		// Если сессия не найдена, очищаем данные
		if (error.message.includes('404')) {
			clearSession();
		}
	}
}

function updateTimerDisplay() {
	const minutes = Math.floor(timeLeft / 60);
	const seconds = timeLeft % 60;
	timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

	// Меняем цвет таймера в зависимости от оставшегося времени
	if (timeLeft <= 10) {
		timer.className = 'timer danger';
	} else if (timeLeft <= 30) {
		timer.className = 'timer warning';
	} else {
		timer.className = 'timer';
	}
}

function handleTimeout() {
	if (autoSubmitOnTimeout) {
		// Автоматически отправляем текущий ответ
		submitAnswer(true);
	} else {
		// Показываем сообщение о таймауте
		resultMessage.textContent = 'Время вышло! Вы все еще можете отправить ответ.';
		resultMessage.className = 'result-message result-timeout';
		resultMessage.style.display = 'block';
	}
}

async function submitAnswer(isTimeout = false) {
	if (!currentQuestion) return;

	const userAnswer = answerInput.value.trim();

	// Останавливаем таймер
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}

	// Блокируем кнопку отправки и поле ввода
	submitAnswerBtn.disabled = true;
	answerInput.disabled = true;

	try {
		const response = await fetch(`${API_BASE_URL}/test/session/${currentSessionId}/answer`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				profile_id: currentProfile && currentProfile.id ? currentProfile.id : null,
				answer: userAnswer
			})
		});

		if (!response.ok) {
			throw new Error(`Ошибка отправки ответа: ${response.status}`);
		}

		const result = await response.json();

		// Сохраняем ответ в истории
		const answerItem = {
			question: currentQuestion.text,
			userAnswer: userAnswer,
			correctAnswer: result.correct_answer,
			isCorrect: result.is_correct,
			isTimeout: result.is_timeout,
			blockName: currentQuestion.block_name
		};

		answersHistory.push(answerItem);
		updateAnswersHistory();

		// Сохраняем обновленную сессию
		saveSession(currentSessionId);

		// Показываем результат
		if (result.is_correct && !result.is_timeout) {
			resultMessage.textContent = 'Правильно!';
			resultMessage.className = 'result-message result-correct';
		} else if (result.is_correct && result.is_timeout) {
			resultMessage.textContent = `Правильно, но время вышло!`;
			resultMessage.className = 'result-message result-correct-timeout';
		} else if (!result.is_correct && result.is_timeout) {
			resultMessage.textContent = `К сожалению, время вышло! Правильный ответ: ${result.correct_answer}`;
			resultMessage.className = 'result-message result-timeout';
		} else {
			resultMessage.textContent = `Неправильно! Правильный ответ: ${result.correct_answer}`;
			resultMessage.className = 'result-message result-incorrect';
		}

		resultMessage.style.display = 'block';

		// Через 5 секунд обрабатываем следующий шаг
		setTimeout(async () => {
			if (result.has_next_question) {
				await loadNextQuestion();
			} else {
				await loadSessionResults();
			}
		}, 5000);

	} catch (error) {
		console.error('Ошибка при отправке ответа:', error);
		resultMessage.innerHTML = `
			<div class="error-message">
				Не удалось отправить ответ. Проверьте подключение к серверу.
			</div>
		`;
		resultMessage.style.display = 'block';

		// Разблокируем поле ввода при ошибке
		answerInput.disabled = false;
		submitAnswerBtn.disabled = false;

		// Если сессия не найдена, очищаем данные
		if (error.message.includes('404')) {
			clearSession();
		}
	}
}

async function loadSessionResults() {
	try {
		const response = await fetch(`${API_BASE_URL}/test/session/${currentSessionId}/results`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				profile_id: currentProfile && currentProfile.id ? currentProfile.id : null
			})
		});

		if (!response.ok) {
			throw new Error(`Ошибка загрузки результатов: ${response.status}`);
		}

		const results = await response.json();
		showTestCompletion(results);

	} catch (error) {
		console.error('Ошибка при загрузке результатов:', error);
		showTestCompletion();
	}
}

function updateAnswersHistory() {
    answersHistoryContainer.innerHTML = '<h3>История ответов</h3>';

    if (answersHistory.length === 0) {
        answersHistoryContainer.innerHTML += '<p>Ответов пока нет</p>';
        return;
    }

    const blocks = {};
    answersHistory.forEach(answer => {
        if (!blocks[answer.blockName]) {
            blocks[answer.blockName] = [];
        }
        blocks[answer.blockName].push(answer);
    });

    Object.keys(blocks).forEach(blockName => {
        const blockAnswers = blocks[blockName];
        const correctCount = blockAnswers.filter(a => a.isCorrect && !a.isTimeout).length;
        const correctTimeoutCount = blockAnswers.filter(a => a.isCorrect && a.isTimeout).length;
        const incorrectCount = blockAnswers.filter(a => !a.isCorrect && !a.isTimeout).length;
        const totalCount = blockAnswers.length;

        const blockHeader = document.createElement('div');
        blockHeader.innerHTML = `<h4>${blockName} (✓${correctCount} ⏰${correctTimeoutCount} ✗${incorrectCount})</h4>`;
        answersHistoryContainer.appendChild(blockHeader);

        blockAnswers.forEach(answer => {
            const answerItem = document.createElement('div');

            // Форматируем текст вопроса и ответов с поддержкой LaTeX
            const formattedQuestion = answer.question;
            const formattedUserAnswer = answer.userAnswer;
            const formattedCorrectAnswer = answer.correctAnswer;

            if (answer.isCorrect && !answer.isTimeout) {
                answerItem.className = 'answer-item correct';
                answerItem.innerHTML = `
                    <div><strong>Вопрос:</strong> ${formattedQuestion}</div>
                    <div><strong>Ваш ответ:</strong> ${formattedUserAnswer}</div>
                    <div><strong style="color: var(--success-color);">✓ Правильно</strong></div>
                `;
            } else if (answer.isCorrect && answer.isTimeout) {
                answerItem.className = 'answer-item correct-timeout';
                answerItem.innerHTML = `
                    <div><strong>Вопрос:</strong> ${formattedQuestion}</div>
                    <div><strong>Ваш ответ:</strong> ${formattedUserAnswer}</div>
                    <div><strong style="color: var(--warning-color);">✓ Правильно, но время вышло</strong></div>
                `;
            } else {
                answerItem.className = 'answer-item incorrect';
                answerItem.innerHTML = `
                    <div><strong>Вопрос:</strong> ${formattedQuestion}</div>
                    <div><strong>Ваш ответ:</strong> ${formattedUserAnswer}</div>
                    <div><strong style="color: var(--danger-color);">✗ Неправильно</strong></div>
                    <div><strong>Правильный ответ:</strong> ${formattedCorrectAnswer}</div>
                `;
            }

            answersHistoryContainer.appendChild(answerItem);
        });
    });

    // Обрабатываем LaTeX формулы в истории ответов
    renderMathJax(answersHistoryContainer);

    // Прокручиваем до самого низа
    answersHistoryContainer.scrollTo({
        top: answersHistoryContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function showTestCompletion(results = null) {
	const correctAnswers = answersHistory.filter(a => a.isCorrect && !a.isTimeout).length;
	const correctTimeoutAnswers = answersHistory.filter(a => a.isCorrect && a.isTimeout).length;
	const totalAnswers = answersHistory.length;
	const percentage = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

	let resultsHtml = `
		<div class="test-completion">
			<h3>Тест завершен!</h3>
			<div class="completion-stats">
				<p>Правильных ответов: ${correctAnswers} из ${totalAnswers}</p>
				<p>Правильных ответов с истекшим временем: ${correctTimeoutAnswers}</p>
				<p>Процент правильных: ${percentage}%</p>
	`;

	if (results) {
		resultsHtml += `
				<p>Общее время: ${results.total_time || 'N/A'}</p>
				<p>Среднее время на вопрос: ${results.avg_time_sec || 'N/A'}</p>
		`;
	}

	resultsHtml += `
			</div>
			<button class="btn" onclick="showMainScreen()">Вернуться в начало</button>
		</div>
	`;

	questionText.innerHTML = resultsHtml;
	answerForm.style.display = 'none';
	resultMessage.style.display = 'none';
	renderMathJax(questionText);
	questionHint.style.display = 'none';

	// Очищаем данные сессии после завершения теста
	clearSession();
}

async function loadStatistics(forErrors = false) {
	statsResults.innerHTML = '<div class="loading">Загрузка статистики...</div>';

	try {
		const dateFrom = document.getElementById('dateFrom').value;
		const dateTo = document.getElementById('dateTo').value;
		const selectedBlock = document.getElementById('blockFilter').value;

		const params = new URLSearchParams();

		if (dateFrom) params.append('date_from', dateFrom);
		if (dateTo) params.append('date_to', dateTo);
		if (selectedBlock) params.append('block_id', selectedBlock);

		const response = await fetch(`${API_BASE_URL}/stats?${params}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				profile_id: currentProfile && currentProfile.id ? currentProfile.id : null
			})
			});

		if (!response.ok) {
			throw new Error(`Ошибка загрузки статистики: ${response.status}`);
		}

		const stats = await response.json();

		let filteredStats = stats;
		if (forErrors) {
			filteredStats = stats.filter(stat => stat.percentage < 100);
		}

		renderStatistics(filteredStats);
	} catch (error) {
		console.error('Ошибка при загрузке статистики:', error);
		statsResults.innerHTML = `
			<div class="error-message">
				Не удалось загрузить статистику. Проверьте подключение к серверу.
			</div>
		`;
	}
}

function renderStatistics(stats) {
	statsResults.innerHTML = '';

	if (stats.length === 0) {
		statsResults.innerHTML = '<p>Нет данных для отображения</p>';
		return;
	}

	stats.forEach(stat => {
		const statCard = document.createElement('div');
		statCard.className = 'stat-card';
		statCard.innerHTML = `
			<h3>${stat.block_name}</h3>
			<div class="stat-value">${stat.percentage}%</div>
			<div class="progress-bar">
				<div class="progress-fill" style="width: ${stat.percentage}%"></div>
			</div>
			<div>Правильных ответов: ${stat.correct_answers} из ${stat.total_answers}</div>
			<div>Правильных с таймаутом: ${stat.correct_timeout_answers || 0}</div>
		`;
		statsResults.appendChild(statCard);
	});
}

function renderMathJax(element) {
    if (window.MathJax) {
        MathJax.typesetPromise([element]).catch(function(err) {
            console.error('Ошибка рендеринга MathJax:', err);
        });
    }
}

// Механизм работы с сессиями

// Сохранение сессии (при старте теста и при отправке ответа)
function saveSession(currentSessionId) {
	// Сохраняем текущую сессию в localStorage
	if (currentSessionId && currentUser && currentProfile) {
		const activeTestSession = {
			sessionId: currentSessionId,
			userId: currentUser.id,
			userName: currentUser.username,
			profileId: currentProfile.id,
			profileName: currentProfile.name,
			answersHistory: answersHistory,
			startTime: new Date().toISOString()
		};

		localStorage.setItem('activeTestSession', JSON.stringify(activeTestSession));
	}
}

function clearSession() {
	// Очищаем данные текущего теста из localStorage
	localStorage.removeItem('activeTestSession');
	currentSessionId = null;

	// Скрываем уведомление
    hideSessionNotification();
}

function restoreActiveSession() {
	// Восстанавливаем активную сессию без диалога
	if (currentSessionId) {
	    hideSessionNotification();
		showTestScreen();
		loadNextQuestion();
	}
}


function checkActiveSession_old() {
	// Проверяем наличие активной сессии в localStorage
	const savedSession = localStorage.getItem('activeTestSession');

	if (savedSession && currentUser) {
		const savedSessionData = JSON.parse(savedSession);

		// Проверяем, что сессия принадлежит текущему пользователю
		if (savedSessionData.userId === currentUser.id) {
			// Сохраняем данные сессии в глобальные переменные
			currentSessionId = savedSessionData.sessionId;
			answersHistory = savedSessionData.answersHistory || [];

            // Если мы не на экране тестирования, показываем уведомление
            if (testScreen.style.display !== 'block') {
                showSessionNotification();
            }
		} else {
			// Сессия принадлежит другому пользователю - очищаем
			localStorage.removeItem('activeTestSession');
			hideSessionNotification();
		}
	}
}

// Функции панели нотификации
function checkActiveSession() {
    // Проверяем наличие активной сессии и показываем уведомление, если нужно
    const savedSession = localStorage.getItem('activeTestSession');

    if (savedSession && currentUser) {
        const savedSessionData = JSON.parse(savedSession);

        // Проверяем принадлежность сессии текущему пользователю
        if (savedSessionData.userId === currentUser.id && savedSessionData.profileId === currentProfile.id) {
			// Сохраняем данные сессии в глобальные переменные
			currentSessionId = savedSessionData.sessionId;
			answersHistory = savedSessionData.answersHistory || [];

            // Не показываем уведомление, если мы уже на экране тестирования
            if (testScreen.style.display === 'block') {
                hideSessionNotification();
                return;
            }

            // Показываем уведомление
            showSessionNotification();
            return;
        }
    }
    hideSessionNotification();
}

function showSessionNotification() {
    sessionNotification.style.display = 'block';
    document.body.classList.add('has-notification');
}

function hideSessionNotification() {
    sessionNotification.style.display = 'none';
    document.body.classList.remove('has-notification');
}

// Функция для обновления информации в приложении
function updateAppInfo() {
/*
    const user = accountWidget ? accountWidget.getUser() : null;
    const profile = accountWidget ? accountWidget.getCurrentProfile() : null;
    const profilesList = accountWidget ? accountWidget.getProfiles() : [];

    document.getElementById('currentUser').textContent = user ? user.username : 'Не авторизован';
    document.getElementById('currentProfile').textContent = profile ? `${profile.name} (${profile.type})` : 'Не выбран';
    document.getElementById('profilesCount').textContent = profilesList.length;
*/
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
    container: '.new-menu-container',
    accountPageUrl: '/account.html',

    onLogin: (user) => {
        console.log('Пользователь вошел:', user);
        currentUser = user;

        // Восстанавливаем выбранный профиль если он был
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
    },

    onLogout: () => {
        console.log('Пользователь вышел');
        currentUser = null;
        currentProfile = null;
        profiles = [];
        updateAppInfo();
    },

    onAccountUpdate: (user) => {
        console.log('Данные пользователя обновлены:', user);
        currentUser = user;
        updateAppInfo();
    },

    onProfileClick: (profile) => {
        console.log('Выбран профиль:', profile);

        // Сохраняем текущие настройки
        saveSettings();

        currentProfile = profile;

        // Загружаем настройки для выбранного профиля
        loadSettings();

        // Сохраняем последний использованных профиль
        storeProfile();

        updateAppInfo();

        // Если перешли в другой профиль надо чекнуть сессию
        checkActiveSession();

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

        //TODO ? Восстанавливаем выбранный профиль если он был
        //loadLastProfile();
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