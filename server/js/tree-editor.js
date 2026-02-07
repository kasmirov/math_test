// Класс древовидного редактора
class TreeEditor {
    constructor(options = {}) {
        // Конфигурация
        this.container = options.container;
        this.onDataChange = options.onDataChange || (() => {});
        this.onValidationChange = options.onValidationChange || (() => {});
        
        // Генерация уникальных ID для этого экземпляра
        this.instanceId = 'tree-editor-' + Math.random().toString(36).substr(2, 9);

        // Состояние
        this.data = options.initialData || {};
        this.schema = options.initialSchema || {};
        this.expandedNodes = new Set();
        this.contextMenuTarget = null;
        this.isAddingValue = false;
        this.isRenaming = false;
        this.isRootContext = false;
        this.updateTimeout = null;
        this.validationMode = options.validationMode || 'warning';

        // DOM элементы
        this.contextMenu = null;
        this.nodeModal = null;

        if (!this.container) {
            console.error('Container element is required');
            return;
        }

        this.init();
    }

    // Инициализация редактора
    init() {
        this.createTreeStructure();
        this.createContextMenu();
        this.createNodeModal();
        this.setupEventListeners();
        this.renderTree();
    }

    // Генерация уникальных ID
    getElementId(name) {
        return `${this.instanceId}-${name}`;
    }

    // Создание структуры дерева
    createTreeStructure() {
        this.container.innerHTML = `
            <div class="tree-container" id="${this.getElementId('treeContainer')}">
                <div class="tree" id="${this.getElementId('tree')}"></div>
            </div>
        `;
    }

    // Создание контекстного меню
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'context-menu';
        this.contextMenu.id = this.getElementId('contextMenu');
        this.contextMenu.innerHTML = `
            <div class="context-menu-item" id="${this.getElementId('addChildNodeBtn')}">
                <div class="context-menu-icon">➕</div>
                <div id="${this.getElementId('addChildNodeText')}">Добавить дочерний узел</div>
            </div>
            <div class="context-menu-item" id="${this.getElementId('addChildValueBtn')}">
                <div class="context-menu-icon">#️⃣</div>
                <div>Добавить значение</div>
            </div>
            <div class="context-menu-item" id="${this.getElementId('renameNodeBtn')}">
                <div class="context-menu-icon">✏️</div>
                <div>Переименовать</div>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" id="${this.getElementId('deleteNodeBtn')}">
                <div class="context-menu-icon">🗑️</div>
                <div>Удалить</div>
            </div>
        `;

        document.body.appendChild(this.contextMenu);
    }

    // Создание модального окна
    createNodeModal() {
        this.nodeModal = document.createElement('div');
        this.nodeModal.className = 'tree-editor-modal-overlay';
        this.nodeModal.id = this.getElementId('nodeModal');
        this.nodeModal.innerHTML = `
            <div class="tree-editor-modal">
                <h3 id="${this.getElementId('modalTitle')}">Добавить новый узел</h3>
                <div class="tree-editor-form-group">
                    <label for="${this.getElementId('nodeName')}">Имя узла:</label>
                    <input type="text" id="${this.getElementId('nodeName')}"
                           list="${this.getElementId('nodeSuggestions')}"
                           placeholder="Введите имя узла">
                    <datalist id="${this.getElementId('nodeSuggestions')}"></datalist>
                    <div id="${this.getElementId('nodeSuggestionsInfo')}" class="suggestion"></div>
                    <div id="${this.getElementId('nodeNameValidation')}" class="schema-validation-message"></div>
                </div>
                <div class="tree-editor-form-group" id="${this.getElementId('valueTypeGroup')}" style="display: none;">
                    <label for="${this.getElementId('nodeValue')}">Значение:</label>
                    <input type="number" id="${this.getElementId('nodeValue')}" placeholder="Введите значение">
                    <div id="${this.getElementId('nodeValueValidation')}" class="schema-validation-message"></div>
                </div>
                <div class="tree-editor-modal-actions">
                    <button id="${this.getElementId('cancelNodeButton')}" class="secondary">Отмена</button>
                    <button id="${this.getElementId('confirmNodeButton')}">Добавить</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.nodeModal);
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Контекстное меню
        document.getElementById(this.getElementId('addChildNodeBtn')).addEventListener('click', () => this.addChildNode());
        document.getElementById(this.getElementId('addChildValueBtn')).addEventListener('click', () => this.addChildValue());
        document.getElementById(this.getElementId('renameNodeBtn')).addEventListener('click', () => this.renameNode());
        document.getElementById(this.getElementId('deleteNodeBtn')).addEventListener('click', () => this.deleteNode());

        // Модальное окно
        document.getElementById(this.getElementId('cancelNodeButton')).addEventListener('click', () => this.cancelNodeModal());
        document.getElementById(this.getElementId('confirmNodeButton')).addEventListener('click', () => this.confirmNodeModal());
        document.getElementById(this.getElementId('nodeName')).addEventListener('input', () => this.validateNodeName());
        document.getElementById(this.getElementId('nodeValue')).addEventListener('input', () => this.validateNodeValue());

        // Контекстное меню для контейнера дерева
        const treeContainer = document.getElementById(this.getElementId('treeContainer'));
        if (treeContainer) {
            treeContainer.addEventListener('contextmenu', (event) => {
                this.showContextMenu(event, null, true);
            });
        }

        // Обработчики для закрытия по клику вне области
        this.setupGlobalListeners();
    }

    // Настройка глобальных обработчиков
    setupGlobalListeners() {
        // Закрытие контекстного меню при клике вне его
        this.globalClickListener = (event) => {
            if (this.contextMenu &&
                this.contextMenu.style.display === 'block' &&
                !this.contextMenu.contains(event.target)) {
                this.closeContextMenu();
            }
        };

        document.addEventListener('click', this.globalClickListener);

        // Закрытие модального окна при клике на оверлей
        if (this.nodeModal) {
            this.nodeModal.addEventListener('click', (event) => {
                if (event.target === this.nodeModal) {
                    this.cancelNodeModal();
                }
            });
        }
    }

    // Основные методы дерева
    renderTree() {
        const tree = document.getElementById(this.getElementId('tree'));

        if (!tree) {
            console.error('Tree element not found');
            return;
        }

        if (!this.data || Object.keys(this.data).length === 0) {
            tree.innerHTML = '<div class="empty-message">Нет данных для отображения</div>';
            return;
        }

        let html = '';

        const buildTreeHtml = (data, path = '', depth = 0) => {
            for (const [key, value] of Object.entries(data)) {
                const nodePath = path ? `${path}.${key}` : key;
                const isObject = typeof value === 'object' && value !== null;
                const isExpanded = this.expandedNodes.has(nodePath);
                const schemaDesc = this.getSchemaDescription(nodePath);

                const schemaValidation = this.validateSchemaExistence(nodePath);
                const hasSchemaWarning = schemaValidation.type === 'warning';

                if (isObject) {
                    const headerClass = hasSchemaWarning ? 'tree-node-header invalid-schema' : 'tree-node-header';

                    html += `
                        <div class="tree-node" data-path="${nodePath}">
                            <div class="${headerClass}"
                                 style="padding-left: 0px;">
                                <div class="toggle-icon">
                                    ${isExpanded ? '▼' : '▶'}
                                </div>
                                <span class="key">${key}</span>
                                ${hasSchemaWarning ? '<span class="invalid-schema-indicator" title="Отсутствует в схеме"></span>' : ''}
                                ${schemaDesc ? `<span class="suggestion">${schemaDesc}</span>` : ''}
                            </div>
                            <div class="tree-node-content ${isExpanded ? 'expanded' : 'collapsed'}">
                    `;
                    buildTreeHtml(value, nodePath, depth + 1);
                    html += `
                            </div>
                        </div>
                    `;
                } else {
                    const valueValidation = this.validateValue(nodePath, value);
                    const hasValueError = valueValidation.type === 'error';
                    const hasValueWarning = valueValidation.type === 'warning';

                    let containerClass = 'value-input-container';
                    let inputClass = 'value-input';
                    let messageClass = 'validation-message';

                    if (hasValueError) {
                        containerClass += ' invalid';
                        inputClass += ' invalid';
                        messageClass += ' validation-error';
                    } else if (hasValueWarning || hasSchemaWarning) {
                        containerClass += ' warning';
                        inputClass += ' warning';
                        messageClass += ' validation-warning';
                    }

                    if (hasSchemaWarning) {
                        containerClass += ' warning';
                        inputClass += ' warning';
                    }

                    const validationMessage = hasValueError || hasValueWarning ? valueValidation.message :
                                           hasSchemaWarning ? 'Узел отсутствует в схеме' : '';

                    html += `
                        <div class="tree-node" data-path="${nodePath}">
                            <div class="${containerClass}"
                                 style="padding-left: 0px;">
                                <span class="key">${key}:</span>
                                <input type="number"
                                       class="${inputClass}"
                                       value="${value}"
                                       data-path="${nodePath}">
                                ${validationMessage ? `<span class="${messageClass}">${validationMessage}</span>` : ''}
                            </div>
                        </div>
                    `;
                }
            }
        };

        buildTreeHtml(this.data);
        tree.innerHTML = html;

        // Добавляем обработчики событий для сгенерированных элементов
        this.attachTreeEventHandlers();
    }

    // Привязка обработчиков к элементам дерева
    attachTreeEventHandlers() {
        // Обработчики для заголовков узлов
        const tree = document.getElementById(this.getElementId('tree'));
        if (!tree) return;

        tree.querySelectorAll('.tree-node-header').forEach(header => {
            const node = header.closest('.tree-node');
            const path = node.dataset.path;

            header.addEventListener('click', () => this.toggleNode(path));

            header.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event, path, true);
            });
        });

        // Обработчики для полей ввода значений
        tree.querySelectorAll('.value-input-container').forEach(container => {
            const node = container.closest('.tree-node');
            const path = node.dataset.path;
            const input = container.querySelector('.value-input');

            if (input) {
                input.addEventListener('change', () => this.updateValue(path, input.value));
                input.addEventListener('input', () => this.debouncedUpdate(path, input.value));
            }

            container.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event, path, false);
            });
        });
    }

    // Остальные методы остаются без изменений, но нужно заменить getElementById на this.getElementId

    // Методы контекстного меню
    showContextMenu(event, path, isObject) {
        event.preventDefault();
        event.stopPropagation();

        this.contextMenuTarget = { path, isObject };
        this.isRootContext = (path === null);

        const addChildNodeText = document.getElementById(this.getElementId('addChildNodeText'));

        if (addChildNodeText) {
            if (path === null) {
                addChildNodeText.textContent = 'Добавить корневой узел';
            } else {
                addChildNodeText.textContent = 'Добавить дочерний узел';
            }
        }

        if (this.contextMenu) {
            this.contextMenu.style.display = 'block';

            const contextMenuRect = this.contextMenu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = event.clientX;
            let top = event.clientY;

            if (left + contextMenuRect.width > viewportWidth) {
                left = viewportWidth - contextMenuRect.width;
            }

            if (top + contextMenuRect.height > viewportHeight) {
                top = viewportHeight - contextMenuRect.height;
            }

            if (left < 0) left = 0;
            if (top < 0) top = 0;

            this.contextMenu.style.left = `${left}px`;
            this.contextMenu.style.top = `${top}px`;
        }
    }

    closeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }

    addChildNode() {
        this.closeContextMenu();
        this.isAddingValue = false;
        this.isRenaming = false;
        this.openNodeModal('Добавить дочерний узел');
    }

    addChildValue() {
        this.closeContextMenu();
        this.isAddingValue = true;
        this.isRenaming = false;
        this.openNodeModal('Добавить значение');
    }

    renameNode() {
        this.closeContextMenu();
        this.isRenaming = true;
        this.isAddingValue = false;

        const oldName = this.contextMenuTarget ? this.contextMenuTarget.path.split('.').pop() : '';
        this.openNodeModal('Переименовать узел', oldName);
    }

    openNodeModal(title, currentName = '') {
        const modalTitle = document.getElementById(this.getElementId('modalTitle'));
        const nodeNameInput = document.getElementById(this.getElementId('nodeName'));
        const valueTypeGroup = document.getElementById(this.getElementId('valueTypeGroup'));
        const suggestionsList = document.getElementById(this.getElementId('nodeSuggestions'));
        const suggestionsInfo = document.getElementById(this.getElementId('nodeSuggestionsInfo'));
        const confirmButton = document.getElementById(this.getElementId('confirmNodeButton'));

        if (!modalTitle || !nodeNameInput) return;

        modalTitle.textContent = title;
        nodeNameInput.value = currentName;

        if (confirmButton) {
            if (this.isRenaming) {
                confirmButton.textContent = 'Переименовать';
            } else {
                confirmButton.textContent = 'Добавить';
            }
        }

        // Проверяем флаги ПЕРЕД использованием this.contextMenuTarget
        const shouldShowValueInput = this.isAddingValue ||
                                   (this.isRenaming && this.contextMenuTarget && !this.contextMenuTarget.isObject);

        if (valueTypeGroup) {
            if (shouldShowValueInput) {
                valueTypeGroup.style.display = 'block';
                const nodeValueInput = document.getElementById(this.getElementId('nodeValue'));

                if (nodeValueInput) {
                    if (this.isRenaming && this.contextMenuTarget) {
                        const keys = this.contextMenuTarget.path.split('.');
                        let current = this.data;
                        for (let i = 0; i < keys.length - 1; i++) {
                            current = current[keys[i]];
                        }
                        nodeValueInput.value = current[keys[keys.length - 1]];
                    } else {
                        nodeValueInput.value = '';
                    }
                }

                this.validateNodeValue();
            } else {
                valueTypeGroup.style.display = 'none';
            }
        }

        const parentPath = this.isRootContext ? '' : (this.contextMenuTarget ? this.contextMenuTarget.path : '');
        const suggestions = this.getSuggestionsForPath(parentPath);

        if (suggestionsList) {
            suggestionsList.innerHTML = '';

            suggestions.forEach(suggestion => {
                const option = document.createElement('option');
                option.value = suggestion;
                suggestionsList.appendChild(option);
            });
        }

        if (suggestionsInfo) {
            if (suggestions.length > 0 && this.schema && Object.keys(this.schema).length > 0) {
                suggestionsInfo.textContent = `Допустимые имена: ${suggestions.join(', ')}`;
            } else if (this.schema && Object.keys(this.schema).length > 0) {
                suggestionsInfo.textContent = 'Нет доступных вариантов в схеме';
            } else {
                suggestionsInfo.textContent = 'Схема не загружена, можно использовать любое имя';
            }
        }

        if (this.nodeModal) {
            this.nodeModal.style.display = 'flex';
            nodeNameInput.focus();
            this.validateNodeName();
        }
    }

    validateNodeName() {
        const nodeNameInput = document.getElementById(this.getElementId('nodeName'));
        const nodeNameValidation = document.getElementById(this.getElementId('nodeNameValidation'));

        if (!nodeNameInput || !nodeNameValidation) return false;

        const nodeName = nodeNameInput.value.trim();
        const parentPath = this.isRootContext ? '' : (this.contextMenuTarget ? this.contextMenuTarget.path : '');
        const newPath = parentPath ? `${parentPath}.${nodeName}` : nodeName;

        nodeNameValidation.textContent = '';
        nodeNameValidation.className = 'schema-validation-message';

        if (!nodeName) {
            nodeNameValidation.textContent = 'Имя обязательно';
            nodeNameValidation.className = 'schema-validation-message error';
            return false;
        }

        if (this.validationMode === 'strict' && this.schema && Object.keys(this.schema).length > 0) {
            if (!this.schema[newPath]) {
                nodeNameValidation.textContent = 'Узел отсутствует в схеме';
                nodeNameValidation.className = 'schema-validation-message error';
                return false;
            }
        } else if (this.validationMode === 'warning' && this.schema && Object.keys(this.schema).length > 0) {
            if (!this.schema[newPath]) {
                nodeNameValidation.textContent = 'Узел отсутствует в схеме';
                nodeNameValidation.className = 'schema-validation-message warning';
                return true;
            }
        }

        return true;
    }

    validateNodeValue() {
        // Проверяем, нужно ли валидировать значение
        if (!this.isAddingValue && !(this.isRenaming && this.contextMenuTarget && !this.contextMenuTarget.isObject)) {
            return true;
        }

        const nodeValueInput = document.getElementById(this.getElementId('nodeValue'));
        const nodeValueValidation = document.getElementById(this.getElementId('nodeValueValidation'));

        if (!nodeValueInput || !nodeValueValidation) return true;

        const nodeNameInput = document.getElementById(this.getElementId('nodeName'));
        const nodeName = nodeNameInput ? nodeNameInput.value.trim() : '';
        const parentPath = this.isRootContext ? '' : (this.contextMenuTarget ? this.contextMenuTarget.path : '');
        const newPath = parentPath ? `${parentPath}.${nodeName}` : nodeName;
        const value = nodeValueInput.value;

        nodeValueValidation.textContent = '';
        nodeValueValidation.className = 'schema-validation-message';

        if (value === '') {
            if (this.isAddingValue) {
                nodeValueValidation.textContent = 'Значение обязательно';
                nodeValueValidation.className = 'schema-validation-message error';
                return false;
            }
            return true;
        }

        if (isNaN(Number(value))) {
            nodeValueValidation.textContent = 'Значение должно быть числом';
            nodeValueValidation.className = 'schema-validation-message error';
            return false;
        }

        if (this.schema && this.schema[newPath]) {
            const validationResult = this.validateValue(newPath, value);

            if (validationResult.type === 'error' && this.validationMode === 'strict') {
                nodeValueValidation.textContent = validationResult.message;
                nodeValueValidation.className = 'schema-validation-message error';
                return false;
            } else if (validationResult.type === 'warning' || validationResult.type === 'error') {
                nodeValueValidation.textContent = validationResult.message;
                nodeValueValidation.className = 'schema-validation-message warning';
                return true;
            }
        }

        return true;
    }

    confirmNodeModal() {
        if (!this.validateNodeName() || !this.validateNodeValue()) {
            return;
        }

        const nodeNameInput = document.getElementById(this.getElementId('nodeName'));
        if (!nodeNameInput) return;

        const nodeName = nodeNameInput.value.trim();

        if (this.isRenaming) {
            this.renameNodeAction(nodeName);
        } else {
            this.addNodeAction(nodeName);
        }

        this.cancelNodeModal();
    }

    addNodeAction(nodeName) {
        let parentObj, newPath;

        if (this.isRootContext) {
            parentObj = this.data;
            newPath = nodeName;
        } else if (this.contextMenuTarget) {
            const keys = this.contextMenuTarget.path.split('.');
            let current = this.data;
            for (const key of keys) {
                current = current[key];
            }
            parentObj = current;
            newPath = `${this.contextMenuTarget.path}.${nodeName}`;
        } else {
            return;
        }

        if (parentObj[nodeName]) {
            if (this.onValidationChange) {
                this.onValidationChange({ type: 'error', message: 'Узел с таким именем уже существует', path: newPath });
            }
            return;
        }

        if (this.validationMode === 'strict' && this.schema && Object.keys(this.schema).length > 0) {
            if (!this.schema[newPath]) {
                if (this.onValidationChange) {
                    this.onValidationChange({
                        type: 'error',
                        message: 'Невозможно добавить узел, отсутствующий в схеме (строгий режим)',
                        path: newPath
                    });
                }
                return;
            }
        }

        if (this.isAddingValue) {
            const nodeValueInput = document.getElementById(this.getElementId('nodeValue'));
            if (!nodeValueInput) return;

            const nodeValue = nodeValueInput.value;
            const numValue = Number(nodeValue);

            if (this.schema && this.schema[newPath]) {
                const validationResult = this.validateValue(newPath, numValue);
                if (validationResult.type === 'error' && this.validationMode === 'strict') {
                    if (this.onValidationChange) {
                        this.onValidationChange({
                            type: 'error',
                            message: `Ошибка валидации: ${validationResult.message}`,
                            path: newPath
                        });
                    }
                    return;
                }
            }

            parentObj[nodeName] = numValue;

            if (this.schema && this.schema[newPath]) {
                const validationResult = this.validateValue(newPath, numValue);
                if (validationResult.type === 'warning' && this.onValidationChange) {
                    this.onValidationChange({
                        type: 'warning',
                        message: `Предупреждение: ${validationResult.message}`,
                        path: newPath
                    });
                }
            }
        } else {
            parentObj[nodeName] = {};
        }

        if (!this.isRootContext && this.contextMenuTarget) {
            this.expandedNodes.add(this.contextMenuTarget.path);
        }

        this.renderTree();
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }
    }

    renameNodeAction(newName) {
        if (!this.contextMenuTarget) return;

        const oldPath = this.contextMenuTarget.path;
        const keys = oldPath.split('.');

        if (keys.length === 1) {
            if (this.data[newName]) {
                if (this.onValidationChange) {
                    this.onValidationChange({ type: 'error', message: 'Узел с таким именем уже существует', path: oldPath });
                }
                return;
            }
            this.data[newName] = this.data[keys[0]];
            delete this.data[keys[0]];

            this.expandedNodes.delete(oldPath);
            this.expandedNodes.add(newName);
        } else {
            let parent = this.data;
            for (let i = 0; i < keys.length - 1; i++) {
                parent = parent[keys[i]];
            }

            if (parent[newName]) {
                if (this.onValidationChange) {
                    this.onValidationChange({ type: 'error', message: 'Узел с таким именем уже существует', path: oldPath });
                }
                return;
            }

            const oldKey = keys[keys.length - 1];
            parent[newName] = parent[oldKey];
            delete parent[oldKey];

            const newPath = keys.slice(0, -1).concat(newName).join('.');
            this.expandedNodes.delete(oldPath);
            this.expandedNodes.add(newPath);
        }

        if (this.isAddingValue || !this.contextMenuTarget.isObject) {
            const nodeValueInput = document.getElementById(this.getElementId('nodeValue'));
            if (!nodeValueInput) return;

            const nodeValue = nodeValueInput.value;
            const numValue = Number(nodeValue);
            const newPath = keys.slice(0, -1).concat(newName).join('.');

            if (this.schema && this.schema[newPath]) {
                const validationResult = this.validateValue(newPath, numValue);
                if (validationResult.type === 'error' && this.validationMode === 'strict') {
                    if (this.onValidationChange) {
                        this.onValidationChange({
                            type: 'error',
                            message: `Ошибка валидации: ${validationResult.message}`,
                            path: newPath
                        });
                    }
                    return;
                }
            }

            let current = this.data;
            const newKeys = newPath.split('.');
            for (let i = 0; i < newKeys.length - 1; i++) {
                current = current[newKeys[i]];
            }
            current[newKeys[newKeys.length - 1]] = numValue;

            if (this.schema && this.schema[newPath]) {
                const validationResult = this.validateValue(newPath, numValue);
                if (validationResult.type === 'warning' && this.onValidationChange) {
                    this.onValidationChange({
                        type: 'warning',
                        message: `Предупреждение: ${validationResult.message}`,
                        path: newPath
                    });
                }
            }
        }

        this.renderTree();
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }
    }

    deleteNode() {
        if (!this.contextMenuTarget || !confirm('Вы уверены, что хотите удалить этот узел?')) {
            this.closeContextMenu();
            return;
        }

        const keys = this.contextMenuTarget.path.split('.');

        if (keys.length === 1) {
            delete this.data[keys[0]];
        } else {
            let current = this.data;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            delete current[keys[keys.length - 1]];
        }

        this.expandedNodes.delete(this.contextMenuTarget.path);

        this.renderTree();
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }
        this.closeContextMenu();
    }

    cancelNodeModal() {
        const nodeNameInput = document.getElementById(this.getElementId('nodeName'));
        const nodeValueInput = document.getElementById(this.getElementId('nodeValue'));

        if (this.nodeModal) {
            this.nodeModal.style.display = 'none';
        }

        if (nodeNameInput) {
            nodeNameInput.value = '';
        }

        if (nodeValueInput) {
            nodeValueInput.value = '';
        }

        this.contextMenuTarget = null;
        this.isRenaming = false;
        this.isAddingValue = false;
        this.isRootContext = false;
    }

    // Остальные методы без изменений, но с заменой getElementId где нужно
    toggleNode(path) {
        if (this.expandedNodes.has(path)) {
            this.expandedNodes.delete(path);
        } else {
            this.expandedNodes.add(path);
        }
        this.renderTree();
    }

    debouncedUpdate(path, value) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.updateValue(path, value);
        }, 300);
    }

    updateValue(path, newValue) {
        const validationResult = this.validateValue(path, newValue);
        const numValue = Number(newValue);

        if (isNaN(numValue)) {
            if (this.onValidationChange) {
                this.onValidationChange({ type: 'error', message: 'Введите корректное число', path });
            }
            const tree = document.getElementById(this.getElementId('tree'));
            if (tree) {
                const input = tree.querySelector(`input[data-path="${path}"]`);
                if (input) {
                    const keys = path.split('.');
                    let current = this.data;
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    input.value = current[keys[keys.length - 1]];
                }
            }
            return;
        }

        if (validationResult.type === 'error' && this.validationMode === 'strict') {
            if (this.onValidationChange) {
                this.onValidationChange({ type: 'error', message: validationResult.message, path });
            }

            const tree = document.getElementById(this.getElementId('tree'));
            if (tree) {
                const input = tree.querySelector(`input[data-path="${path}"]`);
                if (input) {
                    const keys = path.split('.');
                    let current = this.data;
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    input.value = current[keys[keys.length - 1]];
                }
            }
            return;
        }

        const keys = path.split('.');
        let current = this.data;

        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }

        const lastKey = keys[keys.length - 1];
        current[lastKey] = numValue;

        if (validationResult.type === 'warning' && this.onValidationChange) {
            this.onValidationChange({ type: 'warning', message: validationResult.message, path });
        } else if (validationResult.type === 'error' && this.onValidationChange) {
            this.onValidationChange({ type: 'error', message: validationResult.message, path });
        }

        this.renderTree();
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }
    }

    // Вспомогательные методы
    getAllNodeKeys(obj) {
        const keys = new Set();

        function traverse(currentObj, path) {
            if (typeof currentObj === 'object' && currentObj !== null) {
                if (path) keys.add(path);
                for (const [key, value] of Object.entries(currentObj)) {
                    const newPath = path ? `${path}.${key}` : key;
                    if (typeof value === 'object' && value !== null) {
                        traverse(value, newPath);
                    }
                }
            }
        }

        traverse(obj, '');
        return keys;
    }

    validateValue(path, value) {
        if (this.validationMode === 'off' || !this.schema || !this.schema[path]) {
            return { type: null, message: null };
        }

        const schemaRule = this.schema[path];
        const numValue = Number(value);

        if (schemaRule.type === 'number') {
            if (isNaN(numValue)) {
                return { type: 'error', message: 'Значение должно быть числом' };
            }

            if (schemaRule.min !== undefined && numValue < schemaRule.min) {
                return {
                    type: this.validationMode === 'strict' ? 'error' : 'warning',
                    message: `Значение должно быть не меньше ${schemaRule.min}`
                };
            }

            if (schemaRule.max !== undefined && numValue > schemaRule.max) {
                return {
                    type: this.validationMode === 'strict' ? 'error' : 'warning',
                    message: `Значение должно быть не больше ${schemaRule.max}`
                };
            }
        }

        return { type: null, message: null };
    }

    validateSchemaExistence(path) {
        if (this.validationMode === 'off' || !this.schema || Object.keys(this.schema).length === 0) {
            return { type: null, message: null };
        }

        if (!this.schema[path]) {
            return {
                type: this.validationMode === 'strict' ? 'error' : 'warning',
                message: 'Узел отсутствует в схеме'
            };
        }

        return { type: null, message: null };
    }

    getSuggestionsForPath(parentPath) {
        if (!this.schema) return [];

        if (!parentPath) {
            return Object.keys(this.schema).filter(key => !key.includes('.'));
        }

        const suggestions = [];
        const prefix = parentPath + '.';

        for (const [path, rule] of Object.entries(this.schema)) {
            if (path.startsWith(prefix)) {
                const remaining = path.substring(prefix.length);
                const nextPart = remaining.split('.')[0];
                if (nextPart && !suggestions.includes(nextPart)) {
                    suggestions.push(nextPart);
                }
            }
        }

        return suggestions;
    }

    getSchemaDescription(path) {
        if (!this.schema || !this.schema[path]) return '';
        return this.schema[path].description || '';
    }

    // Публичные методы API
    setData(data) {
        this.data = JSON.parse(JSON.stringify(data));
        this.renderTree();
    }

    getData() {
        return JSON.parse(JSON.stringify(this.data));
    }

    setSchema(schema) {
        this.schema = JSON.parse(JSON.stringify(schema));
        this.renderTree();
    }

    getSchema() {
        return JSON.parse(JSON.stringify(this.schema));
    }

    setValidationMode(mode) {
        this.validationMode = mode;
        this.renderTree();
    }

    expandAll() {
        this.expandedNodes = this.getAllNodeKeys(this.data);
        this.renderTree();
    }

    collapseAll() {
        this.expandedNodes.clear();
        this.renderTree();
    }

    // Деструктор для очистки
    destroy() {
        // Удаляем глобальные обработчики
        if (this.globalClickListener) {
            document.removeEventListener('click', this.globalClickListener);
        }

        // Удаляем контекстное меню
        if (this.contextMenu && this.contextMenu.parentNode) {
            this.contextMenu.parentNode.removeChild(this.contextMenu);
        }

        // Удаляем модальное окно
        if (this.nodeModal && this.nodeModal.parentNode) {
            this.nodeModal.parentNode.removeChild(this.nodeModal);
        }

        // Очищаем контейнер
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}