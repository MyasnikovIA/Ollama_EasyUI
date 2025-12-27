// Конфигурация по умолчанию
const DEFAULT_CONFIG = {
    url: 'http://192.168.15.7:11434/',
    restApiUrl: 'http://127.0.0.1:11435/', // Добавлено по умолчанию
    apiMode: 'chat',
    model: 'llama2',
    embeddingModel: 'nomic-embed-text',
    temperature: 0.7,
    contextLength: 2048
};

// Константы с промптами по умолчанию
const DEFAULT_PROMPTS = {
    chat: `Ты полезный AI ассистент с доступом к базе знаний.

История предыдущего диалога:
{history}

Информация из базы знаний для текущего вопроса:
{context}

Текущий вопрос пользователя: {query}

Учти историю диалога и предоставленную информацию из базы знаний.
Если в информации из базы знаний есть ответ - используй её.
Если информации недостаточно - используй свои знания.
Отвечай точно, информативно и учитывай контекст всего диалога.

Ответ:`,

    generate: `Ты полезный AI ассистент с доступом к базе знаний.

Информация из базы знаний для текущего вопроса:
{context}

Запрос пользователя: {query}

Используй предоставленную информацию из базы знаний для ответа.
Если информации недостаточно - используй свои знания.
Отвечай точно и информативно.

Ответ:`
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
    $('#rest-api-url').textbox(); // Добавлено
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

    // Инициализация комбобокса embedding моделей
    $('#embedding-model').combobox({
        valueField: 'name',
        textField: 'name',
        value: 'nomic-embed-text'
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
    try {
        // Загружаем сохраненные промпты
        const savedPrompts = localStorage.getItem('ollamaPrompts');
        let prompts = DEFAULT_PROMPTS;

        if (savedPrompts) {
            try {
                prompts = JSON.parse(savedPrompts);
            } catch (e) {
                console.error('Ошибка парсинга сохраненных промптов:', e);
            }
        }

        // Устанавливаем значения
        $('#chat-prompt').textbox('setValue', prompts.chat || DEFAULT_PROMPTS.chat);
        $('#generate-prompt').textbox('setValue', prompts.generate || DEFAULT_PROMPTS.generate);

        $('#prompts-dialog').dialog('open');
    } catch (error) {
        console.error('Ошибка открытия диалога промптов:', error);
        $.messager.alert('Ошибка', 'Не удалось открыть настройки промптов', 'error');
    }
}

// Восстановление промптов по умолчанию
function restoreDefaultPrompts() {
    $.messager.confirm('Подтверждение', 'Восстановить промпты по умолчанию?', function(r) {
        if (r) {
            try {
                $('#chat-prompt').textbox('setValue', DEFAULT_PROMPTS.chat);
                $('#generate-prompt').textbox('setValue', DEFAULT_PROMPTS.generate);

                $.messager.show({
                    title: 'Успешно',
                    msg: 'Промпты восстановлены по умолчанию',
                    timeout: 2000
                });
            } catch (error) {
                console.error('Ошибка восстановления промптов:', error);
                $.messager.alert('Ошибка', 'Не удалось восстановить промпты', 'error');
            }
        }
    });
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
        const allModels = data.models || [];

        if (allModels.length === 0) {
            console.warn('Нет доступных моделей');
            updateStatus(true);
            return false;
        }

        // Логируем все модели для отладки
        console.log('Все модели:', allModels.map(m => m.name));

        // Фильтруем модели для embedding (содержат "embed" в названии)
        const embeddingModels = allModels.filter(model =>
            model.name.toLowerCase().includes('embed') ||
            model.name.toLowerCase().includes('bge') || // Chinese embedding models
            model.name.toLowerCase().includes('instruct') || // Некоторые embedding модели
            model.name.toLowerCase().includes('nomic') // nomic-embed-text
        );

        // Модели для ответов (chat/generate) - ВСЕ остальные модели
        const chatModels = allModels.filter(model =>
            !embeddingModels.includes(model)
        );

        console.log('Embedding модели:', embeddingModels.map(m => m.name));
        console.log('Chat модели:', chatModels.map(m => m.name));

        // Обновляем данные в комбобоксах
        $('#model').combobox('loadData', allModels); // Все модели для ответов
        $('#embedding-model').combobox('loadData', embeddingModels.length > 0 ? embeddingModels : allModels);

        // Устанавливаем сохраненную модель для ответов
        const savedModel = localStorage.getItem('ollamaModel');
        if (savedModel) {
            const modelExists = allModels.some(m => m.name === savedModel);
            if (modelExists) {
                $('#model').combobox('setValue', savedModel);
                console.log('Установлена сохраненная chat модель:', savedModel);
            } else if (allModels.length > 0) {
                $('#model').combobox('setValue', allModels[0].name);
            }
        } else if (allModels.length > 0) {
            $('#model').combobox('setValue', allModels[0].name);
        }

        // Устанавливаем сохраненную модель для embedding
        const savedEmbeddingModel = localStorage.getItem('ollamaEmbeddingModel');
        if (savedEmbeddingModel) {
            const embeddingModelExists = embeddingModels.some(m => m.name === savedEmbeddingModel) ||
                                       (embeddingModels.length === 0 && allModels.some(m => m.name === savedEmbeddingModel));
            if (embeddingModelExists) {
                $('#embedding-model').combobox('setValue', savedEmbeddingModel);
                console.log('Установлена сохраненная embedding модель:', savedEmbeddingModel);
            } else if (embeddingModels.length > 0) {
                // Ищем первую embedding модель
                const firstEmbeddingModel = embeddingModels[0].name;
                $('#embedding-model').combobox('setValue', firstEmbeddingModel);
                console.log('Установлена первая embedding модель:', firstEmbeddingModel);
            } else if (allModels.length > 0) {
                // Fallback: используем первую модель если нет embedding моделей
                $('#embedding-model').combobox('setValue', allModels[0].name);
                console.log('Установлена первая модель как embedding (fallback):', allModels[0].name);
            }
        } else if (embeddingModels.length > 0) {
            // Устанавливаем первую embedding модель по умолчанию
            const defaultEmbeddingModel = embeddingModels.find(m =>
                m.name.toLowerCase().includes('nomic-embed-text')
            )?.name || embeddingModels[0].name;

            $('#embedding-model').combobox('setValue', defaultEmbeddingModel);
            console.log('Установлена embedding модель по умолчанию:', defaultEmbeddingModel);
        } else if (allModels.length > 0) {
            // Fallback: если нет embedding моделей, используем первую модель
            $('#embedding-model').combobox('setValue', allModels[0].name);
            console.log('Установлена первая модель как embedding (no embedding models found):', allModels[0].name);
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
            restApiUrl: $('#rest-api-url').textbox('getValue'), // Добавлено
            apiMode: $('#api-mode').combobox('getValue'),
            model: $('#model').combobox('getValue'),
            embeddingModel: $('#embedding-model').combobox('getValue'),
            temperature: $('#temperature').numberspinner('getValue'),
            contextLength: $('#context-length').numberspinner('getValue')
        };

        console.log('Сохранение настроек:', settings);

        localStorage.setItem('ollamaSettings', JSON.stringify(settings));
        localStorage.setItem('ollamaModel', settings.model);
        localStorage.setItem('ollamaEmbeddingModel', settings.embeddingModel);

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
            $('#rest-api-url').textbox('setValue', settings.restApiUrl || DEFAULT_CONFIG.restApiUrl); // Добавлено
            $('#api-mode').combobox('setValue', settings.apiMode || DEFAULT_CONFIG.apiMode);
            $('#temperature').numberspinner('setValue', settings.temperature || DEFAULT_CONFIG.temperature);
            $('#context-length').numberspinner('setValue', settings.contextLength || DEFAULT_CONFIG.contextLength);

            // Обновляем отображение температуры
            updateTemperatureDisplay();

            // Сохраняем модели для последующей установки
            if (settings.model) {
                localStorage.setItem('ollamaModel', settings.model);
            }
            if (settings.embeddingModel) {
                localStorage.setItem('ollamaEmbeddingModel', settings.embeddingModel);
            }

            // Загружаем модели с задержкой
            setTimeout(() => {
                loadModels();
            }, 500);

        } else {
            // Используем настройки по умолчанию
            $('#ollama-url').textbox('setValue', DEFAULT_CONFIG.url);
            $('#rest-api-url').textbox('setValue', DEFAULT_CONFIG.restApiUrl); // Добавлено
            $('#api-mode').combobox('setValue', DEFAULT_CONFIG.apiMode);
            $('#temperature').numberspinner('setValue', DEFAULT_CONFIG.temperature);
            $('#context-length').numberspinner('setValue', DEFAULT_CONFIG.contextLength);
            updateTemperatureDisplay();

            setTimeout(() => {
                loadModels();
            }, 500);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        // Используем настройки по умолчанию при ошибке
        $('#ollama-url').textbox('setValue', DEFAULT_CONFIG.url);
        $('#rest-api-url').textbox('setValue', DEFAULT_CONFIG.restApiUrl); // Добавлено
        $('#api-mode').combobox('setValue', DEFAULT_CONFIG.apiMode);
        $('#temperature').numberspinner('setValue', DEFAULT_CONFIG.temperature);
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

// Получение контекста из REST API
async function getContextFromRestApi(query, mode) {
    try {
        const restApiUrl = $('#rest-api-url').textbox('getValue').trim();

        if (!restApiUrl) {
            return query; // Возвращаем оригинальный запрос если REST API не настроен
        }

        // Получаем промпт в зависимости от режима
        const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || JSON.stringify(DEFAULT_PROMPTS));
        const systemPrompt = mode === 'chat' ? prompts.chat : prompts.generate;

        // Получаем историю для chat режима
        let history = '';
        if (mode === 'chat' && currentChat.length > 0) {
            history = currentChat.map(msg => {
                if (msg.role === 'user') {
                    return `User: ${msg.content}`;
                } else if (msg.role === 'assistant') {
                    return `Assistant: ${msg.content}`;
                }
                return '';
            }).filter(msg => msg !== '').join('\n');
        }

        // Подготавливаем данные для отправки
        const requestData = {
            embedding_model: $('#embedding-model').combobox('getValue'),
            api_mode: mode,
            system_prompt: systemPrompt,
            query: query,
            history: mode === 'chat' ? history : null
        };

        console.log('Отправка запроса в REST API для контекста:', requestData);

        const response = await fetch(restApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`REST API вернул ошибку: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.context && data.context.trim() !== '') {
            console.log('Получен контекст из REST API:', data.context.substring(0, 100) + '...');
            return data.context;
        } else {
            console.warn('REST API вернул пустой контекст, используем оригинальный запрос');
            return query;
        }

    } catch (error) {
        console.error('Ошибка получения контекста из REST API:', error);
        // В случае ошибки возвращаем оригинальный запрос
        return query;
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
    const temperature = $('#temperature').numberspinner('getValue');
    const contextLength = $('#context-length').numberspinner('getValue');

    if (!model) {
        $.messager.alert('Ошибка', 'Не выбрана модель. Загрузите список моделей.', 'error');
        return;
    }

    isStreaming = true;
    $('#typing-indicator').show();

    try {
        // Проверяем, нужно ли получать контекст из REST API
        const restApiUrl = $('#rest-api-url').textbox('getValue').trim();
        let processedMessage = message;

        if (restApiUrl) {
            // Получаем обогащенный контекст из REST API
            try {
                processedMessage = await getContextFromRestApi(message, apiMode);
                console.log('Используется сообщение с контекстом из REST API');
            } catch (error) {
                console.error('Ошибка получения контекста, используем оригинальное сообщение:', error);
            }
        }

        if (apiMode === 'chat') {
            await sendChatMessage(baseUrl, model, temperature, contextLength, processedMessage, message);
        } else {
            await sendGenerateMessage(baseUrl, model, temperature, contextLength, processedMessage, message);
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
async function sendChatMessage(baseUrl, model, temperature, contextLength, processedMessage, originalMessage) {
    // Получаем промпт для chat
    const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || JSON.stringify(DEFAULT_PROMPTS));
    const systemPrompt = prompts.chat || '';

    // Заменяем плейсхолдеры в промпте
    let finalPrompt = systemPrompt;

    // Формируем историю
    let history = '';
    if (currentChat.length > 0) {
        history = currentChat.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                return `Assistant: ${msg.content}`;
            }
            return '';
        }).filter(msg => msg !== '').join('\n');
    }

    // Заменяем плейсхолдеры
    finalPrompt = finalPrompt.replace('{history}', history);
    finalPrompt = finalPrompt.replace('{query}', originalMessage);

    // Если есть контекст из REST API, добавляем его
    if (processedMessage !== originalMessage) {
        finalPrompt = finalPrompt.replace('{context}', processedMessage);
    } else {
        finalPrompt = finalPrompt.replace('{context}', 'Нет информации из базы знаний.');
    }

    const messages = [...currentChat];

    // Добавляем системный промпт если он есть
    if (finalPrompt && (messages.length === 0 || messages[0].role !== 'system')) {
        messages.unshift({ role: 'system', content: finalPrompt });
    }

    // Добавляем сообщение пользователя (оригинальное сообщение)
    messages.push({ role: 'user', content: originalMessage });

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
                            // Добавляем кнопку копирования полного ответа
                            addCopyFullResponseButton(aiMessageDiv[0], aiResponse);
                        }
                    }, 100);

                    // Добавляем только user и assistant сообщения в историю (не system)
                    const messagesToSave = messages.filter(msg => msg.role !== 'system');
                    messagesToSave.push({ role: 'assistant', content: aiResponse });
                    currentChat = messagesToSave;
                    saveCurrentChat(originalMessage);
                }
            } catch (parseError) {
                console.warn('Ошибка парсинга строки:', parseError);
            }
        }
    }
}

// Отправка сообщения через /api/generate
async function sendGenerateMessage(baseUrl, model, temperature, contextLength, processedMessage, originalMessage) {
    // Получаем промпт для generate
    const prompts = JSON.parse(localStorage.getItem('ollamaPrompts') || JSON.stringify(DEFAULT_PROMPTS));
    const systemPrompt = prompts.generate || '';

    // Заменяем плейсхолдеры в промпте
    let finalPrompt = systemPrompt;

    // Заменяем плейсхолдеры
    finalPrompt = finalPrompt.replace('{query}', originalMessage);

    // Если есть контекст из REST API, добавляем его
    if (processedMessage !== originalMessage) {
        finalPrompt = finalPrompt.replace('{context}', processedMessage);
    } else {
        finalPrompt = finalPrompt.replace('{context}', 'Нет информации из базы знаний.');
    }

    let prompt = '';

    // Добавляем системный промпт если он есть
    if (finalPrompt) {
        prompt += finalPrompt + '\n\n';
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
    prompt += `User: ${originalMessage}\nAssistant: `;

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
                            // Добавляем кнопку копирования полного ответа
                            addCopyFullResponseButton(aiMessageDiv[0], aiResponse);
                        }
                    }, 100);

                    currentChat.push(
                        { role: 'user', content: originalMessage },
                        { role: 'assistant', content: aiResponse }
                    );
                    saveCurrentChat(originalMessage);
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

// Функция для добавления кнопки копирования полного ответа
function addCopyFullResponseButton(element, responseText) {
    // Проверяем, нет ли уже кнопки
    if ($(element).find('.copy-full-response-btn').length > 0) {
        return;
    }

    const buttonHtml = `
        <div class="copy-full-response-container">
            <button class="copy-full-response-btn" onclick="copyFullResponseToClipboard(this, '${escapeHtml(responseText)}')">
                <span class="copy-full-response-text">Копировать полный ответ</span>
                <span class="copied-full-response-text" style="display:none;">Ответ скопирован!</span>
            </button>
        </div>
    `;

    $(element).append(buttonHtml);
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

// Функция для копирования полного ответа в буфер обмена
function copyFullResponseToClipboard(button, responseText) {
    // Декодируем текст из экранированного HTML
    const textArea = document.createElement('textarea');
    textArea.innerHTML = responseText;
    const decodedText = textArea.value;

    navigator.clipboard.writeText(decodedText).then(() => {
        // Показываем сообщение об успешном копировании
        const copyText = $(button).find('.copy-full-response-text');
        const copiedText = $(button).find('.copied-full-response-text');

        copyText.hide();
        copiedText.show();

        // Возвращаем обратно через 2 секунды
        setTimeout(() => {
            copyText.show();
            copiedText.hide();
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        $.messager.alert('Ошибка', 'Не удалось скопировать ответ', 'error');
    });
}

// Функция для экранирования HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '\n': '\\n',
        '\r': '\\r'
    };
    return text.replace(/[&<>"'\n\r]/g, function(m) { return map[m]; });
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

// Функция для обрезки текста с учетом ширины контейнера
function truncateTextToFit(element, text) {
    const container = $(element);
    const maxWidth = container.width() - 40; // 40px для иконки и отступов
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Используем шрифт дерева EasyUI
    context.font = '14px "Helvetica Neue",Helvetica,Arial,sans-serif';

    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    // Бинарный поиск для определения максимальной длины
    let left = 1;
    let right = text.length;
    let result = '';

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const testText = text.substring(0, mid) + '...';
        const width = context.measureText(testText).width;

        if (width <= maxWidth) {
            result = testText;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return result || '...';
}

// Сохранение текущего чата (обновленная версия)
function saveCurrentChat(firstUserMessage) {
    if (currentChat.length > 0) {
        localStorage.setItem('ollamaCurrentChat', JSON.stringify(currentChat));

        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');

        // Создаем заголовок из первого сообщения пользователя
        let chatTitle = 'Новый чат';

        // Ищем первое сообщение пользователя
        const firstUserMsg = firstUserMessage ||
                            currentChat.find(msg => msg.role === 'user')?.content ||
                            '';

        if (firstUserMsg) {
            chatTitle = firstUserMsg.trim();
            if (chatTitle === '') {
                chatTitle = 'Новый чат';
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
                        // Добавляем кнопку копирования для загруженных сообщений
                        addCopyFullResponseButton(element, msg.content);
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
                    const currentChatTitle = currentChat[0]?.content || 'Новый чат';
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

// Функция для обновления ширины текста в истории чатов
function updateChatHistoryWidth() {
    $('#chat-history .tree-node').each(function() {
        const node = $(this);
        const textSpan = node.find('.tree-title');
        const originalText = textSpan.data('original-text') || textSpan.text();

        // Сохраняем оригинальный текст
        if (!textSpan.data('original-text')) {
            textSpan.data('original-text', originalText);
        }

        // Обрезаем текст с учетом ширины
        const truncatedText = truncateTextToFit(node.closest('.tree-node'), originalText);
        textSpan.text(truncatedText);
    });
}

// Инициализация контекстного меню при загрузке истории
function loadChatHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('ollamaChatHistory') || '[]');

        // Создаем данные для дерева
        const treeData = history.map((chat, index) => ({
            id: index,
            text: chat.title || `Чат ${index + 1}`,
            iconCls: 'icon-chat'
        }));

        $('#chat-history').tree({
            data: treeData,
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

        // Обновляем ширину текста после загрузки дерева
        setTimeout(() => {
            updateChatHistoryWidth();
        }, 100);

        // Инициализация контекстного меню
        initContextMenu();

        // Обработка изменения размера окна
        $(window).on('resize', function() {
            setTimeout(() => {
                updateChatHistoryWidth();
            }, 100);
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