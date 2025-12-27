        // ==================== SemanticChunker Library ====================
        class SemanticChunker {
            constructor(ollamaBaseUrl, embeddingModel, similarityThreshold = 0.7) {
                this.ollamaBaseUrl = ollamaBaseUrl;
                this.embeddingModel = embeddingModel;
                this.similarityThreshold = similarityThreshold;
            }

            /**
             * 1. Получить список моделей для Embedding
             */
            async getEmbeddingModels() {
                try {
                    const response = await fetch(`${this.ollamaBaseUrl}/api/tags`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.models || [];
                } catch (error) {
                    console.error('Error fetching models:', error);
                    throw error;
                }
            }

            /**
             * 2. Получить эмбеддинг для текста
             */
            async getEmbedding(text) {
                if (!text || text.trim().length === 0) {
                    throw new Error('Text cannot be empty');
                }

                try {
                    const response = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: this.embeddingModel,
                            prompt: text
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                    }

                    const data = await response.json();

                    if (!data.embedding || !Array.isArray(data.embedding)) {
                        throw new Error('Invalid response format: missing embedding array');
                    }

                    return data.embedding;
                } catch (error) {
                    console.error('Error getting embedding:', error);
                    throw error;
                }
            }

            /**
             * Разбить текст на предложения
             */
            splitIntoSentences(text) {
                if (!text || text.trim().length === 0) {
                    return [];
                }

                // Простая логика разбиения на предложения
                const sentences = text.split(/(?<=[.!?])\s+/);
                return sentences
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
            }

            /**
             * Косинусное сходство между векторами
             */
            cosineSimilarity(vectorA, vectorB) {
                if (vectorA.length !== vectorB.length) {
                    throw new Error('Vectors must have the same length');
                }

                let dotProduct = 0;
                let normA = 0;
                let normB = 0;

                for (let i = 0; i < vectorA.length; i++) {
                    dotProduct += vectorA[i] * vectorB[i];
                    normA += vectorA[i] * vectorA[i];
                    normB += vectorB[i] * vectorB[i];
                }

                if (normA === 0 || normB === 0) {
                    return 0;
                }

                return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            }

            /**
             * Вычислить средний эмбеддинг
             */
            calculateAverageEmbedding(embeddings, startIndex, count) {
                if (count === 0) return new Array(embeddings[0]?.length || 0).fill(0);

                const dimensions = embeddings[startIndex].length;
                const average = new Array(dimensions).fill(0);

                for (let i = startIndex; i < startIndex + count; i++) {
                    const embedding = embeddings[i];
                    for (let j = 0; j < dimensions; j++) {
                        average[j] += embedding[j];
                    }
                }

                for (let j = 0; j < dimensions; j++) {
                    average[j] /= count;
                }

                return average;
            }

            /**
             * Основной метод: семантический чанкинг
             */
            async semanticChunking(text, maxChunkSize = 1000) {
                console.log('Starting semantic chunking...');
                console.log(`Similarity threshold: ${this.similarityThreshold}`);
                console.log(`Text length: ${text.length} characters`);

                // 1. Разбить на предложения
                const sentences = this.splitIntoSentences(text);
                console.log(`Split into ${sentences.length} sentences`);

                if (sentences.length === 0) {
                    return [];
                }

                // 2. Получить эмбеддинги для каждого предложения
                console.log('Getting embeddings for sentences...');
                const embeddings = [];
                for (let i = 0; i < sentences.length; i++) {
                    try {
                        const embedding = await this.getEmbedding(sentences[i]);
                        embeddings.push(embedding);

                        // Небольшая задержка, чтобы не перегружать сервер
                        if (i < sentences.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (error) {
                        console.error(`Error getting embedding for sentence ${i}:`, error);
                        // Используем нулевой вектор в случае ошибки
                        const zeroVector = new Array(embeddings[0]?.length || 384).fill(0);
                        embeddings.push(zeroVector);
                    }
                }

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
                        similarity = 0;
                    }

                    // Проверить, нужно ли начинать новый чанк
                    const shouldStartNewChunk =
                        similarity < this.similarityThreshold ||
                        this.getTotalLength(currentChunkSentences) + currentSentence.length > maxChunkSize;

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

                        // Начинаем новый чанк
                        currentChunkSentences = [];
                    }

                    currentChunkSentences.push(currentSentence);
                    lastEmbedding = currentEmbedding;
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
                }

                console.log(`Created ${chunks.length} semantic chunks`);
                return chunks;
            }

            /**
             * Вспомогательный метод: общая длина предложений
             */
            getTotalLength(sentences) {
                return sentences.reduce((total, sentence) => total + sentence.length, 0) +
                       (sentences.length > 0 ? sentences.length - 1 : 0); // пробелы между предложениями
            }

            /**
             * Установить порог схожести
             */
            setSimilarityThreshold(threshold) {
                if (threshold < 0.0 || threshold > 1.0) {
                    throw new Error('Similarity threshold must be between 0.0 and 1.0');
                }
                this.similarityThreshold = threshold;
            }

            /**
             * Получить информацию о конфигурации
             */
            getConfigInfo() {
                return `SemanticChunker Config: model=${this.embeddingModel}, similarityThreshold=${this.similarityThreshold}, url=${this.ollamaBaseUrl}`;
            }
        }

        // ==================== UI Logic ====================
        let semanticChunker = null;

        // Обновление значения порога схожести
        document.getElementById('similarityThreshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = e.target.value;
        });

        // Инициализация SemanticChunker
        function initializeChunker() {
            const ollamaUrl = document.getElementById('ollamaUrl').value;
            const embeddingModel = document.getElementById('embeddingModel').value;
            const similarityThreshold = parseFloat(document.getElementById('similarityThreshold').value);

            semanticChunker = new SemanticChunker(ollamaUrl, embeddingModel, similarityThreshold);
            console.log('SemanticChunker initialized:', semanticChunker.getConfigInfo());
        }

        // Показать/скрыть загрузку
        function showLoading(show) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }

        // Показать сообщение об ошибке
        function showError(message) {
            const container = document.getElementById('errorContainer');
            container.innerHTML = `<div class="error">❌ ${message}</div>`;
            container.style.display = 'block';
            setTimeout(() => {
                container.style.display = 'none';
            }, 5000);
        }

        // Показать сообщение об успехе
        function showSuccess(message) {
            const container = document.getElementById('successContainer');
            container.innerHTML = `<div class="success">✅ ${message}</div>`;
            container.style.display = 'block';
            setTimeout(() => {
                container.style.display = 'none';
            }, 3000);
        }

        // Отобразить список моделей
        function displayModels(models) {
            const container = document.getElementById('modelsResult');
            if (!models || models.length === 0) {
                container.innerHTML = '<p>Нет доступных моделей</p>';
                return;
            }

            let html = '<h4>Доступные модели для эмбеддингов:</h4><ul>';
            models.forEach(model => {
                const sizeMB = model.size ? ` (${Math.round(model.size / 1024 / 1024)} MB)` : '';
                html += `<li><strong>${model.name}</strong>${sizeMB}</li>`;
            });
            html += '</ul>';
            container.innerHTML = html;
        }

        // Отобразить чанки
        function displayChunks(chunks) {
            const container = document.getElementById('chunksResult');
            if (!chunks || chunks.length === 0) {
                container.innerHTML = '<p>Не удалось создать чанки</p>';
                return;
            }

            let html = `<h4>Создано ${chunks.length} семантических чанков:</h4>`;

            chunks.forEach((chunk, index) => {
                const vectorPreview = chunk.embedding
                    .slice(0, 5)
                    .map(v => v.toFixed(4))
                    .join(', ');

                html += `
                    <div class="chunk">
                        <div class="chunk-header">Чанк ${index + 1} (позиция: ${chunk.position}, длина: ${chunk.length} символов)</div>
                        <div><strong>Текст:</strong> ${chunk.text}</div>
                        <div class="vector-preview">
                            <strong>Вектор [5 из ${chunk.embedding.length}]:</strong> [${vectorPreview}, ...]
                        </div>
                    </div>
                `;
            });

            // Добавить итоговый массив массивов
            const embeddingsArray = chunks.map(chunk => chunk.embedding);
            html += `<h4>Итоговый массив векторов:</h4>`;
            html += `<pre>${JSON.stringify(embeddingsArray, null, 2)}</pre>`;

            container.innerHTML = html;
        }

        // 1. Получить модели
        document.getElementById('getModelsBtn').addEventListener('click', async () => {
            try {
                initializeChunker();
                showLoading(true);

                const models = await semanticChunker.getEmbeddingModels();
                displayModels(models);
                showSuccess(`Найдено ${models.length} моделей`);

                // Обновить список моделей в select
                const modelSelect = document.getElementById('embeddingModel');
                const currentModel = modelSelect.value;

                // Добавить найденные модели в список
                models.forEach(model => {
                    const optionExists = Array.from(modelSelect.options)
                        .some(opt => opt.value === model.name);
                    if (!optionExists) {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    }
                });

                // Вернуть выбранную модель, если она существует
                if (models.some(m => m.name === currentModel)) {
                    modelSelect.value = currentModel;
                }

            } catch (error) {
                showError(`Ошибка при получении моделей: ${error.message}`);
                console.error(error);
            } finally {
                showLoading(false);
            }
        });

        // 2. Создать чанки
        document.getElementById('processBtn').addEventListener('click', async () => {
            try {
                initializeChunker();
                showLoading(true);

                const queryText = document.getElementById('queryText').value;
                if (!queryText.trim()) {
                    throw new Error('Введите текст для обработки');
                }

                const chunks = await semanticChunker.semanticChunking(queryText, 1000);
                displayChunks(chunks);
                showSuccess(`Создано ${chunks.length} семантических чанков`);

            } catch (error) {
                showError(`Ошибка при создании чанков: ${error.message}`);
                console.error(error);
            } finally {
                showLoading(false);
            }
        });

        // Инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', () => {
            initializeChunker();
            console.log('SemanticChunker library loaded and ready');
        });
