// Конфигурация по умолчанию
const DEFAULT_CONFIG = {
    url: 'http://192.168.15.7:11434/',
    apiMode: 'chat',
    model: 'llama2',
    temperature: 0.7,
    contextLength: 2048
};

// Текущий чат
let currentChat = [];
let isStreaming = false;

// Инициализация при загрузке
$(document).ready(function() {
    // Восстанавливаем размер split панели
    restoreSplitSize();

    // Инициализация элементов
    initElements();

    // Загружаем настройки
    loadSettings();

    // Загружаем историю и промпты
    loadChatHistory();
    loadPrompts();

    // Проверяем подключение
    testConnection();

    // Обработка нажатия Enter для отправки сообщения
    $('#message-input').textbox('textbox').keydown(function(e) {
        if (e.ctrlKey && e.keyCode === 13) {
            sendMessage();
        }
    });
});

// Инициализация элементов EasyUI
function initElements() {
    // Инициализация текстовых полей
    $('#ollama-url').textbox();
    $('#message-input').textbox({
        multiline: true,
        prompt: 'Введите сообщение...'
    });
    $('#chat-prompt').textbox({ multiline: true });
    $('#generate-prompt').textbox({ multiline: true });

    // Инициализация комбобоксов
    $('#api-mode').combobox({
        value: 'chat',
        data: [
            {value: 'chat', text: 'Chat (/api/chat)'},
            {value: 'generate', text: 'Generate (/api/generate)'}
        ],
        onSelect: function() {
            updateTemperatureDisplay();
        }
    });

    // Инициализация numberspinner для температуры
    $('#temperature').numberspinner({
        min: 0,
        max: 2,
        step: 0.1,
        value: 0.7,
        precision: 1,
        onChange: function(value) {
            updateTemperatureDisplay();
        }
    });

    // Инициализация спиннера длины контекста
    $('#context-length').numberspinner({
        min: 512,
        max: 8192,
        value: 2048,
        increment: 256
    });

    // Инициализация комбобокса моделей
    $('#model').combobox({
        valueField: 'name',
        textField: 'name',
        value: 'llama2'
    });

    // Инициализация вкладок промптов
    $('.easyui-tabs').tabs();

    // Инициализация меню
    $('.easyui-menubutton').menubutton();

    // Инициализация split панели
    $('#main-split').layout({
        onResize: function() {
            saveSplitSize();
        }
    });
}

// Обновление отображения температуры
function updateTemperatureDisplay() {
    const temp = $('#temperature').numberspinner('getValue');
    // Теперь отображение значения происходит автоматически в numberspinner
}

// Сохранение размера split панели
function saveSplitSize() {
    try {
        const westPanel = $('.layout-panel-west');
        const width = westPanel.width();
        localStorage.setItem('ollamaSplitWidth', width);
    } catch (error) {
        console.error('Ошибка сохранения размера split:', error);
    }
}

// Восстановление размера split панели
function restoreSplitSize() {
    try {
        const savedWidth = localStorage.getItem('ollamaSplitWidth');
        if (savedWidth) {
            setTimeout(() => {
                $('#main-split').layout('panel', 'west').panel('resize', {
                    width: parseInt(savedWidth)
                });
            }, 100);
        }
    } catch (error) {
        console.error('Ошибка восстановления размера split:', error);
    }
}

// Открытие диалога настроек
function openSettingsDialog() {
    $('#settings-dialog').dialog('open');
}

// Открытие диалога промптов
function openPromptsDialog() {
    // Загружаем текущие промпты перед открытием диалога
    const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || '{}');
    $('#chat-prompt').textbox('setValue', prompts.chat || '');
    $('#generate-prompt').textbox('setValue', prompts.generate || '');

    $('#prompts-dialog').dialog('open');
}

// Загрузка доступных моделей
async function loadModels() {
    try {
        const baseUrl = normalizeUrl($('#ollama-url').textbox('getValue'));
        const url = baseUrl + 'api/tags';

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const models = data.models || [];

        // Обновляем данные в комбобоксе
        $('#model').combobox('loadData', models);

        // Устанавливаем сохраненную модель
        const savedModel = localStorage.getItem('ollamaModel');
        if (savedModel) {
            const modelExists = models.some(m => m.name === savedModel);
            if (modelExists) {
                $('#model').combobox('setValue', savedModel);
                console.log('Установлена сохраненная модель:', savedModel);
            } else if (models.length > 0) {
                $('#model').combobox('setValue', models[0].name);
            }
        }

        updateStatus(true);
        return true;
    } catch (error) {
        console.error('Ошибка загрузки моделей:', error);
        updateStatus(false);
        $.messager.alert('Ошибка', `Не удалось загрузить список моделей: ${error.message}`, 'error');
        return false;
    }
}

// Нормализация URL
function normalizeUrl(url) {
    if (!url.endsWith('/')) {
        url += '/';
    }
    return url;
}

// Сохранение настроек в LocalStorage
function saveSettings() {
    try {
        const settings = {
            url: $('#ollama-url').textbox('getValue'),
            apiMode: $('#api-mode').combobox('getValue'),
            model: $('#model').combobox('getValue'),
            temperature: $('#temperature').numberspinner('getValue'), // ИЗМЕНЕНО: numberspinner вместо slider
            contextLength: $('#context-length').numberspinner('getValue')
        };

        console.log('Сохранение настроек:', settings);

        localStorage.setItem('ollamaSettings', JSON.stringify(settings));
        localStorage.setItem('ollamaModel', settings.model);

        $('#settings-dialog').dialog('close');

        $.messager.show({
            title: 'Сохранено',
            msg: 'Настройки сохранены',
            timeout: 2000,
            showType: 'slide'
        });
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        $.messager.alert('Ошибка', 'Не удалось сохранить настройки', 'error');
    }
}

// Сохранение промптов
function savePrompts() {
    try {
        const prompts = {
            chat: $('#chat-prompt').textbox('getValue'),
            generate: $('#generate-prompt').textbox('getValue')
        };

        localStorage.setItem('ollamaPrompts', JSON.stringify(prompts));

        $('#prompts-dialog').dialog('close');

        $.messager.show({
            title: 'Сохранено',
            msg: 'Промпты сохранены',
            timeout: 2000
        });
    } catch (error) {
        console.error('Ошибка сохранения промптов:', error);
        $.messager.alert('Ошибка', 'Не удалось сохранить промпты', 'error');
    }
}

// Загрузка настроек из LocalStorage
function loadSettings() {
    try {
        const saved = localStorage.getItem('ollamaSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            console.log('Загружаем настройки:', settings);

            // Устанавливаем значения
            $('#ollama-url').textbox('setValue', settings.url || DEFAULT_CONFIG.url);
            $('#api-mode').combobox('setValue', settings.apiMode || DEFAULT_CONFIG.apiMode);
            $('#temperature').numberspinner('setValue', settings.temperature || DEFAULT_CONFIG.temperature); // ИЗМЕНЕНО: numberspinner вместо slider
            $('#context-length').numberspinner('setValue', settings.contextLength || DEFAULT_CONFIG.contextLength);

            // Обновляем отображение температуры
            updateTemperatureDisplay();

            // Сохраняем модель для последующей установки
            if (settings.model) {
                localStorage.setItem('ollamaModel', settings.model);
            }

            // Загружаем модели с задержкой, чтобы комбобокс успел инициализироваться
            setTimeout(() => {
                loadModels();
            }, 500);

        } else {
            // Используем настройки по умолчанию
            $('#ollama-url').textbox('setValue', DEFAULT_CONFIG.url);
            $('#api-mode').combobox('setValue', DEFAULT_CONFIG.apiMode);
            $('#temperature').numberspinner('setValue', DEFAULT_CONFIG.temperature); // ИЗМЕНЕНО: numberspinner вместо slider
            $('#context-length').numberspinner('setValue', DEFAULT_CONFIG.contextLength);
            updateTemperatureDisplay();

            // Загружаем модели
            setTimeout(() => {
                loadModels();
            }, 500);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        // Используем настройки по умолчанию при ошибке
        $('#ollama-url').textbox('setValue', DEFAULT_CONFIG.url);
        $('#api-mode').combobox('setValue', DEFAULT_CONFIG.apiMode);
        $('#temperature').numberspinner('setValue', DEFAULT_CONFIG.temperature); // ИЗМЕНЕНО: numberspinner вместо slider
        $('#context-length').numberspinner('setValue', DEFAULT_CONFIG.contextLength);
        updateTemperatureDisplay();

        setTimeout(() => {
            loadModels();
        }, 500);
    }
}

// Загрузка промптов
function loadPrompts() {
    try {
        const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || '{}');
        // Промпты загружаются только при открытии диалога
    } catch (error) {
        console.error('Ошибка загрузки промптов:', error);
    }
}

// Отправка сообщения
async function sendMessage() {
    if (isStreaming) {
        $.messager.alert('Внимание', 'Дождитесь завершения текущего ответа', 'warning');
        return;
    }

    const message = $('#message-input').textbox('getValue').trim();
    if (!message) return;

    // Добавление сообщения пользователя
    addMessageToChat('user', message);
    $('#message-input').textbox('clear');

    // Получение текущих настроек
    const baseUrl = normalizeUrl($('#ollama-url').textbox('getValue'));
    const apiMode = $('#api-mode').combobox('getValue');
    const model = $('#model').combobox('getValue');
    const temperature = $('#temperature').numberspinner('getValue'); // ИЗМЕНЕНО: numberspinner вместо slider
    const contextLength = $('#context-length').numberspinner('getValue');

    if (!model) {
        $.messager.alert('Ошибка', 'Не выбрана модель. Загрузите список моделей.', 'error');
        return;
    }

    isStreaming = true;
    $('#typing-indicator').show();

    try {
        if (apiMode === 'chat') {
            await sendChatMessage(baseUrl, model, temperature, contextLength, message);
        } else {
            await sendGenerateMessage(baseUrl, model, temperature, contextLength, message);
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        $.messager.alert('Ошибка', `Не удалось отправить сообщение: ${error.message}`, 'error');

        const errorElement = addMessageToChat('ai', `Ошибка: ${error.message}`);
        $(errorElement).css('background', '#ffebee').css('border-left-color', '#f44336');
    } finally {
        isStreaming = false;
        $('#typing-indicator').hide();

        setTimeout(() => {
            const chatMessages = $('#chat-messages')[0];
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
    }
}

// Отправка сообщения через /api/chat
async function sendChatMessage(baseUrl, model, temperature, contextLength, userMessage) {
    // Получаем промпт для chat
    const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || '{}');
    const systemPrompt = prompts.chat || '';

    const messages = [...currentChat];

    // Добавляем системный промпт если он есть
    if (systemPrompt && (messages.length === 0 || messages[0].role !== 'system')) {
        messages.unshift({ role: 'system', content: systemPrompt });
    }

    // Добавляем сообщение пользователя
    messages.push({ role: 'user', content: userMessage });

    const requestData = {
        model: model,
        messages: messages,
        stream: true,
        options: {
            temperature: parseFloat(temperature),
            num_ctx: parseInt(contextLength)
        }
    };

    console.log('Отправка запроса на:', baseUrl + 'api/chat');

    const response = await fetch(baseUrl + 'api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let aiResponse = '';

    const aiMessageElement = addMessageToChat('ai', '');
    const aiMessageId = 'ai-message-' + Date.now();
    $(aiMessageElement).attr('id', aiMessageId);

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.trim() === '') continue;

            try {
                const dataLine = line.startsWith('data: ') ? line.substring(6) : line;
                if (dataLine.trim() === '') continue;

                const data = JSON.parse(dataLine);

                let contentChunk = '';
                if (data.message && data.message.content !== undefined) {
                    contentChunk = data.message.content;
                } else if (data.response !== undefined) {
                    contentChunk = data.response;
                } else if (data.content !== undefined) {
                    contentChunk = data.content;
                } else if (data.chunk !== undefined) {
                    contentChunk = data.chunk;
                }

                if (contentChunk) {
                    aiResponse += contentChunk;
                    const aiMessageDiv = $('#' + aiMessageId);
                    if (aiMessageDiv.length) {
                        aiMessageDiv.text(aiResponse);
                        const chatMessages = $('#chat-messages')[0];
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }

                if (data.done === true) {
                    // Добавляем только user и assistant сообщения в историю (не system)
                    const messagesToSave = messages.filter(msg => msg.role !== 'system');
                    messagesToSave.push({ role: 'assistant', content: aiResponse });
                    currentChat = messagesToSave;
                    saveCurrentChat();
                }
            } catch (parseError) {
                console.warn('Ошибка парсинга строки:', parseError);
            }
        }
    }
}

// Отправка сообщения через /api/generate
async function sendGenerateMessage(baseUrl, model, temperature, contextLength, userMessage) {
    // Получаем промпт для generate
    const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || '{}');
    const systemPrompt = prompts.generate || '';

    let prompt = '';

    // Добавляем системный промпт если он есть
    if (systemPrompt) {
        prompt += systemPrompt + '\n\n';
    }

    // Добавляем историю
    currentChat.forEach(msg => {
        if (msg.role === 'user') {
            prompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
            prompt += `Assistant: ${msg.content}\n`;
        }
    });

    // Добавляем текущее сообщение пользователя
    prompt += `User: ${userMessage}\nAssistant: `;

    const requestData = {
        model: model,
        prompt: prompt,
        stream: true,
        options: {
            temperature: parseFloat(temperature),
            num_ctx: parseInt(contextLength)
        }
    };

    console.log('Отправка запроса на:', baseUrl + 'api/generate');

    const response = await fetch(baseUrl + 'api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let aiResponse = '';

    const aiMessageElement = addMessageToChat('ai', '');
    const aiMessageId = 'ai-message-' + Date.now();
    $(aiMessageElement).attr('id', aiMessageId);

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.trim() === '') continue;

            try {
                const dataLine = line.startsWith('data: ') ? line.substring(6) : line;
                if (dataLine.trim() === '') continue;

                const data = JSON.parse(dataLine);

                if (data.response !== undefined) {
                    aiResponse += data.response;
                    const aiMessageDiv = $('#' + aiMessageId);
                    if (aiMessageDiv.length) {
                        aiMessageDiv.text(aiResponse);
                        const chatMessages = $('#chat-messages')[0];
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }

                if (data.done === true) {
                    currentChat.push(
                        { role: 'user', content: userMessage },
                        { role: 'assistant', content: aiResponse }
                    );
                    saveCurrentChat();
                }
            } catch (parseError) {
                console.warn('Ошибка парсинга строки:', parseError);
            }
        }
    }
}

// Добавление сообщения в чат
function addMessageToChat(role, content) {
    const chatDiv = $('#chat-messages');
    const messageDiv = $('<div></div>')
        .addClass(role === 'user' ? 'message-user' : 'message-ai')
        .text(content);

    chatDiv.append(messageDiv);

    const messageId = role + '-message-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    messageDiv.attr('id', messageId);

    chatDiv.scrollTop(chatDiv[0].scrollHeight);

    return messageDiv[0];
}

// Очистка текущего чата
function clearChat() {
    $.messager.confirm('Подтверждение', 'Очистить текущий чат?', function(r) {
        if (r) {
            currentChat = [];
            $('#chat-messages').empty();
            localStorage.removeItem('ollamaCurrentChat');
        }
    });
}

// Сохранение текущего чата
function saveCurrentChat() {
    if (currentChat.length > 0) {
        localStorage.setItem('ollamaCurrentChat', JSON.stringify(currentChat));

        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');
        const chatTitle = currentChat[0]?.content?.substring(0, 50) + '...' || 'Новый чат';

        history.unshift({
            title: chatTitle,
            messages: currentChat,
            timestamp: new Date().toISOString()
        });

        localStorage.setItem('ollamaChatHistory', JSON.stringify(history.slice(0, 20)));
        loadChatHistory();
    }
}

// Загрузка чата из истории
function loadChat(chatIndex) {
    try {
        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');
        if (history[chatIndex]) {
            currentChat = history[chatIndex].messages;
            $('#chat-messages').empty();

            currentChat.forEach(msg => {
                addMessageToChat(msg.role, msg.content);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки чата:', error);
    }
}

// Загрузка истории чатов
function loadChatHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');
        $('#chat-history').tree({
            data: history.map((chat, index) => ({
                id: index,
                text: chat.title || `Чат ${index + 1}`,
                iconCls: 'icon-chat'
            })),
            onClick: function(node) {
                loadChat(node.id);
            }
        });
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
    }
}

// Тест подключения
async function testConnection() {
    try {
        const baseUrl = normalizeUrl($('#ollama-url').textbox('getValue'));
        const url = baseUrl + 'api/tags';

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateStatus(true);

            let message = 'Подключение к Ollama успешно установлено';
            if (data.models && data.models.length > 0) {
                message += `\nДоступно моделей: ${data.models.length}`;
                message += `\nПервая модель: ${data.models[0].name}`;
            }

            $.messager.alert('Успех', message, 'info');
            return true;
        } else {
            updateStatus(false);
            throw new Error(`Сервер вернул ошибку: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        updateStatus(false);
        $.messager.alert('Ошибка',
            `Не удалось подключиться к Ollama:\n${error.message}\n\n` +
            `Проверьте:\n` +
            `1. Запущен ли Ollama сервер\n` +
            `2. Правильный ли IP адрес и порт\n` +
            `3. Доступность сервера из браузера`,
            'error');
        return false;
    }
}

// Обновление статуса подключения
function updateStatus(isConnected) {
    const statusBar = $('#status-bar');
    const indicator = statusBar.find('.status-indicator');

    indicator.removeClass('status-connected status-disconnected');

    if (isConnected) {
        indicator.addClass('status-connected');
        statusBar.find('span:last').text('Подключено');
    } else {
        indicator.addClass('status-disconnected');
        statusBar.find('span:last').text('Не подключено');
    }
}