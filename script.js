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
// Контекстное меню для истории чатов
let selectedChatId = null;

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

// Обновить функцию initElements:
function initElements() {
    // Инициализация MenuButton в header
    $('.easyui-menubutton').menubutton({
        plain: false,
        iconCls: 'icon-more',
        hasDownArrow: true
    });

    // Инициализация основного split layout чата
    $('#main-chat-split').layout({
        onResize: function() {
            saveChatSplitSize();
        }
    });

    // Восстанавливаем размер split панели чата
    setTimeout(() => {
        restoreChatSplitSize();
    }, 200);

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

    // Инициализация главного split панели
    $('#main-split').layout({
        onResize: function() {
            saveSplitSize();
        }
    });

    // Восстанавливаем размер главной split панели
    setTimeout(() => {
        restoreSplitSize();
    }, 100);
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
                        // Автоматическое форматирование кода при получении ответа
                        setTimeout(() => {
                            formatCodeBlocksInMessage(aiMessageDiv[0]);
                        }, 50);
                        const chatMessages = $('#chat-messages')[0];
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }

                if (data.done === true) {
                    // Форматируем финальный блок кода
                    setTimeout(() => {
                        const aiMessageDiv = $('#' + aiMessageId);
                        if (aiMessageDiv.length) {
                            formatCodeBlocksInMessage(aiMessageDiv[0]);
                        }
                    }, 100);

                    // Добавляем только user и assistant сообщения в историю (не system)
                    const messagesToSave = messages.filter(msg => msg.role !== 'system');
                    messagesToSave.push({ role: 'assistant', content: aiResponse });
                    currentChat = messagesToSave;
                    saveCurrentChat(userMessage);
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
                        // Автоматическое форматирование кода при получении ответа
                        setTimeout(() => {
                            formatCodeBlocksInMessage(aiMessageDiv[0]);
                        }, 50);
                        const chatMessages = $('#chat-messages')[0];
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }

                if (data.done === true) {
                    // Форматируем финальный блок кода
                    setTimeout(() => {
                        const aiMessageDiv = $('#' + aiMessageId);
                        if (aiMessageDiv.length) {
                            formatCodeBlocksInMessage(aiMessageDiv[0]);
                        }
                    }, 100);

                    currentChat.push(
                        { role: 'user', content: userMessage },
                        { role: 'assistant', content: aiResponse }
                    );
                    saveCurrentChat(userMessage);
                }
            } catch (parseError) {
                console.warn('Ошибка парсинга строки:', parseError);
            }
        }
    }
}

// Функция для форматирования блоков кода в сообщении
function formatCodeBlocksInMessage(element) {
    const text = $(element).text();

    // Ищем блоки кода обрамленные ```
    const codeBlockRegex = /```([\s\S]*?)```/g;
    let match;
    let newHtml = text;
    let offset = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const codeContent = match[1].trim();

        // Определяем язык (если указан)
        const firstLine = codeContent.split('\n')[0];
        let language = '';
        let actualCode = codeContent;

        if (firstLine && /^[a-zA-Z0-9+#-]+$/.test(firstLine) && firstLine.length < 20) {
            language = firstLine.toLowerCase();
            actualCode = codeContent.substring(firstLine.length).trim();
        }

        // Создаем HTML для блока кода
        const codeBlockHtml = `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${language || 'code'}</span>
                    <button class="copy-code-btn" onclick="copyCodeToClipboard(this)">
                        <span class="copy-text">Копировать</span>
                        <span class="copied-text" style="display:none;">Скопировано!</span>
                    </button>
                </div>
                <pre><code class="hljs ${language}">${actualCode}</code></pre>
            </div>
        `;

        // Заменяем текст на HTML
        const matchIndex = newHtml.indexOf(fullMatch, offset);
        if (matchIndex !== -1) {
            newHtml = newHtml.substring(0, matchIndex) + codeBlockHtml +
                     newHtml.substring(matchIndex + fullMatch.length);
            offset = matchIndex + codeBlockHtml.length;
        }
    }

    // Если нашли блоки кода, обновляем содержимое
    if (newHtml !== text) {
        $(element).html(newHtml);

        // Применяем подсветку синтаксиса
        $(element).find('pre code').each(function() {
            hljs.highlightElement(this);
        });
    }
}

// Функция для копирования кода в буфер обмена
function copyCodeToClipboard(button) {
    const codeBlock = $(button).closest('.code-block-container').find('code');
    const codeText = codeBlock.text();

    navigator.clipboard.writeText(codeText).then(() => {
        // Показываем сообщение об успешном копировании
        const copyText = $(button).find('.copy-text');
        const copiedText = $(button).find('.copied-text');

        copyText.hide();
        copiedText.show();

        // Возвращаем обратно через 2 секунды
        setTimeout(() => {
            copyText.show();
            copiedText.hide();
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        $.messager.alert('Ошибка', 'Не удалось скопировать код', 'error');
    });
}

// Добавление сообщения в чат
function addMessageToChat(role, content) {
    const chatDiv = $('#chat-messages');
    const messageDiv = $('<div></div>')
        .addClass(role === 'user' ? 'message-user' : 'message-ai');

    // Если это AI сообщение, добавляем возможность форматирования кода
    if (role === 'ai') {
        messageDiv.text(content);
        // Форматируем блоки кода через небольшой таймаут
        setTimeout(() => {
            formatCodeBlocksInMessage(messageDiv[0]);
        }, 100);
    } else {
        messageDiv.text(content);
    }

    const messageId = role + '-message-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    messageDiv.attr('id', messageId);

    chatDiv.append(messageDiv);
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

// Сохранение размера split панели чата
function saveChatSplitSize() {
    try {
        const southPanel = $('#main-chat-split').layout('panel', 'south');
        const height = southPanel.panel('options').height;
        localStorage.setItem('ollamaChatSplitHeight', height);
    } catch (error) {
        console.error('Ошибка сохранения размера split чата:', error);
    }
}

// Восстановление размера split панели чата
function restoreChatSplitSize() {
    try {
        const savedHeight = localStorage.getItem('ollamaChatSplitHeight');
        if (savedHeight) {
            setTimeout(() => {
                $('#main-chat-split').layout('panel', 'south').panel('resize', {
                    height: parseInt(savedHeight)
                });
            }, 100);
        }
    } catch (error) {
        console.error('Ошибка восстановления размера split чата:', error);
    }
}

// Сохранение текущего чата (обновленная версия)
function saveCurrentChat(firstUserMessage) {
    if (currentChat.length > 0) {
        localStorage.setItem('ollamaCurrentChat', JSON.stringify(currentChat));

        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');

        // Создаем заголовок из первых 15 символов первого сообщения пользователя
        let chatTitle = 'Новый чат';

        // Ищем первое сообщение пользователя
        const firstUserMsg = firstUserMessage ||
                            currentChat.find(msg => msg.role === 'user')?.content ||
                            '';

        if (firstUserMsg) {
            // Берем первые 15 символов и обрезаем пробелы
            chatTitle = firstUserMsg.trim().substring(0, 15);
            if (firstUserMsg.length > 15) {
                chatTitle += '...';
            }
        }

        // Проверяем, нет ли уже такого чата в истории
        const existingIndex = history.findIndex(chat =>
            chat.messages.length > 0 &&
            chat.messages[0]?.content === currentChat[0]?.content
        );

        if (existingIndex !== -1) {
            // Обновляем существующий чат
            history[existingIndex] = {
                title: chatTitle,
                messages: currentChat,
                timestamp: new Date().toISOString()
            };
        } else {
            // Добавляем новый чат в начало
            history.unshift({
                title: chatTitle,
                messages: currentChat,
                timestamp: new Date().toISOString()
            });
        }

        // Сохраняем только последние 20 чатов
        localStorage.setItem('ollamaChatHistory', JSON.stringify(history.slice(0, 20)));
        loadChatHistory();
    }
}

// Обновите функцию loadChat для установки selectedChatId
function loadChat(chatIndex) {
    try {
        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');
        if (history[chatIndex]) {
            currentChat = history[chatIndex].messages;
            selectedChatId = chatIndex;
            $('#chat-messages').empty();

            currentChat.forEach(msg => {
                const element = addMessageToChat(msg.role, msg.content);
                // Форматируем блоки кода для загруженных сообщений
                if (msg.role === 'assistant') {
                    setTimeout(() => {
                        formatCodeBlocksInMessage(element);
                    }, 100);
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки чата:', error);
    }
}

// Инициализация контекстного меню
function initContextMenu() {
    $('#history-context-menu').menu({
        onClick: function(item) {
            // Обработка кликов происходит через onclick в HTML
        }
    });
}

// Удаление выбранного чата
function deleteChat() {
    if (selectedChatId === null) {
        $.messager.alert('Ошибка', 'Чат не выбран', 'error');
        return;
    }

    $.messager.confirm('Подтверждение', 'Удалить выбранный чат?', function(r) {
        if (r) {
            try {
                const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');

                // Удаляем выбранный чат
                history.splice(selectedChatId, 1);

                // Сохраняем обновленную историю
                localStorage.setItem('ollamaChatHistory', JSON.stringify(history));

                // Если удаляем текущий чат, очищаем область чата
                if (currentChat.length > 0) {
                    // Проверяем, не является ли текущий чат удаляемым
                    const currentChatTitle = currentChat[0]?.content?.substring(0, 15) + '...' || 'Новый чат';
                    const deletedChatTitle = history[selectedChatId]?.title || '';

                    if (currentChatTitle.includes(deletedChatTitle) || deletedChatTitle.includes(currentChatTitle)) {
                        currentChat = [];
                        $('#chat-messages').empty();
                        localStorage.removeItem('ollamaCurrentChat');
                    }
                }

                // Обновляем дерево истории
                loadChatHistory();

                $.messager.show({
                    title: 'Успешно',
                    msg: 'Чат удален',
                    timeout: 2000,
                    showType: 'slide'
                });

                selectedChatId = null;
            } catch (error) {
                console.error('Ошибка удаления чата:', error);
                $.messager.alert('Ошибка', 'Не удалось удалить чат', 'error');
            }
        }
    });
}

// Очистка всей истории чатов
function clearAllHistory() {
    $.messager.confirm('Подтверждение', 'Очистить всю историю чатов?', function(r) {
        if (r) {
            try {
                // Очищаем историю
                localStorage.removeItem('ollamaChatHistory');

                // Очищаем текущий чат
                currentChat = [];
                $('#chat-messages').empty();
                localStorage.removeItem('ollamaCurrentChat');

                // Обновляем дерево истории
                loadChatHistory();

                $.messager.show({
                    title: 'Успешно',
                    msg: 'История чатов очищена',
                    timeout: 2000,
                    showType: 'slide'
                });

                selectedChatId = null;
            } catch (error) {
                console.error('Ошибка очистки истории:', error);
                $.messager.alert('Ошибка', 'Не удалось очистить историю', 'error');
            }
        }
    });
}

// Инициализация контекстного меню при загрузке истории
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
            },
            onContextMenu: function(e, node) {
                e.preventDefault();
                selectedChatId = node.id;
                $('#history-context-menu').menu('show', {
                    left: e.pageX,
                    top: e.pageY
                });
            }
        });

        // Инициализация контекстного меню
        initContextMenu();
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