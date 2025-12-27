// semantic_chunker.js
// ------------------------------------------------------------------
// <script type="text/javascript" src="semantic_chunker.js"></script>
// ------------------------------------------------------------------

// ==================== SemanticChunker Browser Library ====================
/**
 * Класс для семантического чанкинга текста с использованием Ollama API
 * Работает полностью на стороне браузера
*/

/*
                     // Создание экземпляра
                    const chunker = new SemanticChunker(
                        'http://localhost:11434', // URL Ollama
                        'all-minilm:22m',         // Модель эмбеддинга
                        0.7                       // Порог схожести
                    );

                    // 1. Получить модели
                    const models = await chunker.getEmbeddingModels();
                    console.log('Модели:', models);

                    // 2. Получить массив массивов эмбеддингов
                    const text = "Ваш текст...";
                    const embeddings = await chunker.getChunkEmbeddings(text, 1000);
                    console.log('Эмбеддинги:', embeddings); // [[...], [...], ...]

 */
class SemanticChunker {
    /**
     * Конструктор SemanticChunker
     * @param {string} ollamaBaseUrl - URL сервера Ollama (например, "http://localhost:11434")
     * @param {string} embeddingModel - Модель для эмбеддингов (например, "all-minilm:22m")
     * @param {number} similarityThreshold - Порог схожести (0.0-1.0)
     * @param {number} requestDelay - Задержка между запросами в миллисекундах
     */
    constructor(
        ollamaBaseUrl = "http://localhost:11434", 
        embeddingModel = "all-minilm:22m", 
        similarityThreshold = 0.7,
        requestDelay = 100
    ) {
        this.ollamaBaseUrl = ollamaBaseUrl.endsWith('/') 
            ? ollamaBaseUrl.slice(0, -1) 
            : ollamaBaseUrl;
        this.embeddingModel = embeddingModel;
        this.similarityThreshold = similarityThreshold;
        this.requestDelay = requestDelay;
        
        // Валидация параметров
        if (similarityThreshold < 0.0 || similarityThreshold > 1.0) {
            throw new Error('Порог схожести должен быть между 0.0 и 1.0');
        }
        if (requestDelay < 0) {
            throw new Error('Задержка запросов должна быть положительным числом');
        }
        
        console.log('🧠 SemanticChunker инициализирован:', this.getConfigInfo());
    }

    /**
     * 1. Получить список доступных моделей Ollama
     * @returns {Promise<Array<{name: string, size?: number, modified_at?: string}>>}
     */
    async getEmbeddingModels() {
        try {
            console.log(`🌐 Запрос моделей с ${this.ollamaBaseUrl}/api/tags`);
            
            const response = await fetch(`${this.ollamaBaseUrl}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const models = data.models || [];
            
            console.log(`✅ Получено ${models.length} моделей`);
            return models;
            
        } catch (error) {
            console.error('❌ Ошибка при получении моделей:', error);
            throw new Error(`Не удалось получить модели: ${error.message}`);
        }
    }

    /**
     * Получить эмбеддинг для текста через Ollama API
     * @param {string} text - Текст для векторизации
     * @returns {Promise<number[]>} - Массив чисел (векторное представление)
     */
    async getEmbedding(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Текст не может быть пустым');
        }

        try {
            const cleanText = text.trim();
            console.log(`🔍 Получение эмбеддинга для текста (${cleanText.length} символов)`);
            
            const response = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: cleanText
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Неверный формат ответа: отсутствует массив эмбеддингов');
            }

            console.log(`✅ Получен эмбеддинг размером ${data.embedding.length} измерений`);
            return data.embedding;
            
        } catch (error) {
            console.error('❌ Ошибка при получении эмбеддинга:', error);
            throw new Error(`Не удалось получить эмбеддинг: ${error.message}`);
        }
    }

    /**
     * Получить эмбеддинги для массива текстов
     * @param {string[]} texts - Массив текстов
     * @returns {Promise<number[][]>} - Массив эмбеддингов
     */
    async getEmbeddings(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('Тексты должны быть массивом');
        }

        const embeddings = [];
        
        console.log(`🔄 Получение эмбеддингов для ${texts.length} текстов...`);
        
        for (let i = 0; i < texts.length; i++) {
            try {
                const embedding = await this.getEmbedding(texts[i]);
                embeddings.push(embedding);
                
                // Добавляем задержку между запросами
                if (i < texts.length - 1 && this.requestDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.requestDelay));
                }
                
                console.log(`✓ Текст ${i + 1}/${texts.length} обработан`);
                
            } catch (error) {
                console.error(`⚠️ Ошибка при получении эмбеддинга для текста ${i}:`, error);
                // В случае ошибки создаем нулевой вектор
                const zeroVector = embeddings[0] 
                    ? new Array(embeddings[0].length).fill(0)
                    : new Array(384).fill(0); // Дефолтная размерность
                embeddings.push(zeroVector);
            }
        }
        
        console.log(`✅ Получено ${embeddings.length} эмбеддингов`);
        return embeddings;
    }

    /**
     * Разбить текст на предложения
     * @param {string} text - Исходный текст
     * @returns {string[]} - Массив предложений
     */
    splitIntoSentences(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // Улучшенная логика разбиения на предложения
        const cleanText = text
            .replace(/\s+/g, ' ') // Нормализация пробелов
            .replace(/\n/g, ' ')  // Замена переносов строк на пробелы
            .trim();
        
        if (cleanText.length === 0) {
            return [];
        }
        
        // Разбиение по окончанию предложений с поддержкой аббревиатур
        const sentences = cleanText
            .split(/(?<=[.!?])\s+(?=[А-ЯA-Z])/i)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        console.log(`✂️ Текст разбит на ${sentences.length} предложений`);
        return sentences;
    }

    /**
     * Вычислить косинусное сходство между двумя векторами
     * @param {number[]} vectorA - Первый вектор
     * @param {number[]} vectorB - Второй вектор
     * @returns {number} - Косинусное сходство (0-1)
     */
    cosineSimilarity(vectorA, vectorB) {
        if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
            throw new Error('Оба аргумента должны быть массивами');
        }
        
        if (vectorA.length !== vectorB.length) {
            throw new Error('Векторы должны иметь одинаковую длину');
        }

        if (vectorA.length === 0) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            const a = vectorA[i];
            const b = vectorB[i];
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        
        // Ограничиваем значение от -1 до 1 (на случай числовых ошибок)
        return Math.max(-1, Math.min(1, similarity));
    }

    /**
     * Вычислить средний эмбеддинг для группы векторов
     * @param {number[][]} embeddings - Массив эмбеддингов
     * @param {number} startIndex - Начальный индекс
     * @param {number} count - Количество векторов для усреднения
     * @returns {number[]} - Средний вектор
     */
    calculateAverageEmbedding(embeddings, startIndex, count) {
        if (!Array.isArray(embeddings) || embeddings.length === 0) {
            return [];
        }

        if (count === 0 || startIndex < 0 || startIndex >= embeddings.length) {
            return embeddings[0] ? [...embeddings[0]] : [];
        }

        const actualCount = Math.min(count, embeddings.length - startIndex);
        const dimensions = embeddings[startIndex].length;
        const average = new Array(dimensions).fill(0);

        for (let i = startIndex; i < startIndex + actualCount; i++) {
            const embedding = embeddings[i];
            for (let j = 0; j < dimensions; j++) {
                average[j] += embedding[j];
            }
        }

        for (let j = 0; j < dimensions; j++) {
            average[j] /= actualCount;
        }

        return average;
    }

    /**
     * Общая длина предложений в символах (с учетом пробелов)
     * @param {string[]} sentences - Массив предложений
     * @returns {number} - Общая длина
     */
    getTotalLength(sentences) {
        if (!Array.isArray(sentences) || sentences.length === 0) {
            return 0;
        }
        
        const totalChars = sentences.reduce((total, sentence) => total + sentence.length, 0);
        const spaces = sentences.length - 1; // Пробелы между предложениями
        return totalChars + spaces;
    }

    /**
     * Основной метод: семантический чанкинг текста
     * @param {string} text - Текст для чанкинга
     * @param {number} maxChunkSize - Максимальный размер чанка в символах
     * @returns {Promise<Array<{text: string, embedding: number[], position: number, length: number}>>}
     */
    async semanticChunking(text, maxChunkSize = 1000) {
        if (!text || typeof text !== 'string') {
            throw new Error('Текст должен быть непустой строкой');
        }

        if (maxChunkSize <= 0) {
            throw new Error('Максимальный размер чанка должен быть положительным числом');
        }

        console.log('🚀 Начинаем семантический чанкинг...');
        console.log(`📊 Порог схожести: ${this.similarityThreshold}`);
        console.log(`📝 Длина текста: ${text.length} символов`);
        console.log(`⚙️ Макс. размер чанка: ${maxChunkSize} символов`);

        // 1. Разбить на предложения
        const sentences = this.splitIntoSentences(text);
        
        if (sentences.length === 0) {
            console.log('ℹ️ Нечего обрабатывать - текст пустой');
            return [];
        }

        // 2. Получить эмбеддинги для каждого предложения
        console.log('🔍 Получаем эмбеддинги для предложений...');
        const embeddings = await this.getEmbeddings(sentences);

        // 3. Группировка предложений семантически
        const chunks = [];
        let currentChunkSentences = [sentences[0]];
        let lastEmbedding = embeddings[0];

        for (let i = 1; i < sentences.length; i++) {
            const currentSentence = sentences[i];
            const currentEmbedding = embeddings[i];

            // Вычислить схожесть
            let similarity = 0;
            try {
                similarity = this.cosineSimilarity(lastEmbedding, currentEmbedding);
            } catch (e) {
                console.warn(`⚠️ Ошибка при вычислении схожести для предложения ${i}:`, e);
                similarity = 0;
            }

            // Проверить, нужно ли начинать новый чанк
            const totalLength = this.getTotalLength([...currentChunkSentences, currentSentence]);
            const shouldStartNewChunk = 
                similarity < this.similarityThreshold || 
                totalLength > maxChunkSize;

            if (shouldStartNewChunk && currentChunkSentences.length > 0) {
                // Сохраняем текущий чанк
                const chunkText = currentChunkSentences.join(' ');
                const chunkStartIndex = i - currentChunkSentences.length;
                const chunkEmbedding = this.calculateAverageEmbedding(
                    embeddings, 
                    chunkStartIndex, 
                    currentChunkSentences.length
                );
                
                chunks.push({
                    text: chunkText,
                    embedding: chunkEmbedding,
                    position: chunkStartIndex,
                    length: chunkText.length
                });

                console.log(`📦 Создан чанк ${chunks.length}: ${chunkText.length} символов`);

                // Начинаем новый чанк
                currentChunkSentences = [currentSentence];
                lastEmbedding = currentEmbedding;
            } else {
                // Добавляем к текущему чанку
                currentChunkSentences.push(currentSentence);
                lastEmbedding = currentEmbedding;
            }
        }

        // Добавить последний чанк
        if (currentChunkSentences.length > 0) {
            const chunkText = currentChunkSentences.join(' ');
            const chunkStartIndex = sentences.length - currentChunkSentences.length;
            const chunkEmbedding = this.calculateAverageEmbedding(
                embeddings,
                chunkStartIndex,
                currentChunkSentences.length
            );
            
            chunks.push({
                text: chunkText,
                embedding: chunkEmbedding,
                position: chunkStartIndex,
                length: chunkText.length
            });
            
            console.log(`📦 Создан последний чанк: ${chunkText.length} символов`);
        }

        console.log(`✅ Создано ${chunks.length} семантических чанков`);
        return chunks;
    }

    /**
     * 2. Получить массив массивов эмбеддингов чанков
     * @param {string} text - Текст для обработки
     * @param {number} maxChunkSize - Максимальный размер чанка
     * @returns {Promise<number[][]>} - Массив массивов эмбеддингов [[...], [...], ...]
     */
    async getChunkEmbeddings(text, maxChunkSize = 1000) {
        try {
            console.log('🎯 Получение эмбеддингов чанков...');
            
            const chunks = await this.semanticChunking(text, maxChunkSize);
            const embeddings = chunks.map(chunk => chunk.embedding);
            
            console.log(`✅ Получено ${embeddings.length} массивов эмбеддингов`);
            return embeddings;
            
        } catch (error) {
            console.error('❌ Ошибка при получении эмбеддингов чанков:', error);
            throw error;
        }
    }

    /**
     * Быстрый семантический чанкинг (без получения эмбеддингов для каждого предложения)
     * @param {string} text - Текст для чанкинга
     * @param {number} maxChunkSize - Максимальный размер чанка
     * @returns {string[]} - Массив чанков
     */
    quickSemanticChunking(text, maxChunkSize = 1000) {
        if (!text || typeof text !== 'string') {
            throw new Error('Текст должен быть непустой строкой');
        }

        console.log('⚡ Быстрый семантический чанкинг...');
        
        const sentences = this.splitIntoSentences(text);
        const chunks = [];
        let currentChunk = [];

        for (const sentence of sentences) {
            if (this.getTotalLength([...currentChunk, sentence]) > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [sentence];
            } else {
                currentChunk.push(sentence);
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
        }

        console.log(`✅ Создано ${chunks.length} чанков`);
        return chunks;
    }

    /**
     * Установить порог схожести
     * @param {number} threshold - Новый порог схожести (0.0-1.0)
     */
    setSimilarityThreshold(threshold) {
        if (threshold < 0.0 || threshold > 1.0) {
            throw new Error('Порог схожести должен быть между 0.0 и 1.0');
        }
        this.similarityThreshold = threshold;
        console.log(`🔄 Порог схожести установлен: ${threshold}`);
    }

    /**
     * Установить задержку между запросами
     * @param {number} delay - Задержка в миллисекундах
     */
    setRequestDelay(delay) {
        if (delay < 0) {
            throw new Error('Задержка запросов должна быть положительным числом');
        }
        this.requestDelay = delay;
        console.log(`🔄 Задержка запросов установлена: ${delay}ms`);
    }

    /**
     * Изменить модель эмбеддинга
     * @param {string} model - Новая модель
     */
    setEmbeddingModel(model) {
        if (!model || typeof model !== 'string') {
            throw new Error('Модель должна быть непустой строкой');
        }
        this.embeddingModel = model;
        console.log(`🔄 Модель эмбеддинга установлена: ${model}`);
    }

    /**
     * Изменить URL сервера Ollama
     * @param {string} url - Новый URL
     */
    setOllamaUrl(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('URL должен быть непустой строкой');
        }
        this.ollamaBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        console.log(`🔄 URL Ollama установлен: ${url}`);
    }

    /**
     * Получить информацию о конфигурации
     * @returns {object} - Объект с информацией о конфигурации
     */
    getConfigInfo() {
        return {
            ollamaUrl: this.ollamaBaseUrl,
            embeddingModel: this.embeddingModel,
            similarityThreshold: this.similarityThreshold,
            requestDelay: this.requestDelay
        };
    }

    /**
     * Проверить подключение к Ollama серверу
     * @returns {Promise<boolean>} - true если сервер доступен
     */
    async testConnection() {
        try {
            console.log(`🔗 Проверка подключения к ${this.ollamaBaseUrl}...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const isConnected = response.ok;
            console.log(isConnected ? '✅ Подключение успешно' : '❌ Подключение не удалось');
            return isConnected;
            
        } catch (error) {
            console.error('❌ Ошибка при проверке подключения:', error.message);
            return false;
        }
    }

    /**
     * Универсальный метод для выполнения обеих задач
     * @param {string} text - Текст для обработки (опционально)
     * @returns {Promise<{models: Array, embeddings?: number[][]}>}
     */
    async process(text = null) {
        const result = {};
        
        try {
            // 1. Получить модели
            console.log('📋 Получение списка моделей...');
            result.models = await this.getEmbeddingModels();
            
            // 2. Если передан текст, получить эмбеддинги чанков
            if (text) {
                console.log('🧩 Создание семантических чанков...');
                result.embeddings = await this.getChunkEmbeddings(text);
            }
            
            console.log('✅ Обработка завершена');
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка при обработке:', error);
            throw error;
        }
    }
}

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
    window.SemanticChunker = SemanticChunker;
}