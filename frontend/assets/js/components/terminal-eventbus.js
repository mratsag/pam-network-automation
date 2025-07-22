/**
 * Terminal Event Bus - Merkezi olay yönetimi sistemi
 * SOLID Principles: Single Responsibility, Observer Pattern
 */

/**
 * Event Bus Implementation
 * Terminal bileşenleri arasında gevşek bağlı iletişim sağlar
 */
class TerminalEventBus {
    constructor() {
        this.listeners = new Map();
        this.history = [];
        this.maxHistorySize = 100;
        this.debugMode = false;
    }

    /**
     * Event listener ekle
     * @param {string} event - Olay adı
     * @param {Function} callback - Callback fonksiyonu
     * @param {Object} options - Seçenekler
     */
    on(event, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const listenerInfo = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            id: this._generateId(),
            addedAt: new Date().toISOString()
        };

        this.listeners.get(event).push(listenerInfo);
        
        // Priority'ye göre sırala (yüksek priority önce çalışır)
        this.listeners.get(event).sort((a, b) => b.priority - a.priority);

        if (this.debugMode) {
            console.log(`📢 Event listener added: ${event}`, listenerInfo);
        }

        return listenerInfo.id;
    }

    /**
     * Bir kerelik event listener ekle
     * @param {string} event - Olay adı
     * @param {Function} callback - Callback fonksiyonu
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    }

    /**
     * Event listener kaldır
     * @param {string} event - Olay adı
     * @param {Function|string} callbackOrId - Callback fonksiyonu veya listener ID
     */
    off(event, callbackOrId) {
        if (!this.listeners.has(event)) {
            return false;
        }

        const listeners = this.listeners.get(event);
        let removedCount = 0;

        for (let i = listeners.length - 1; i >= 0; i--) {
            const listener = listeners[i];
            
            if (typeof callbackOrId === 'string') {
                // ID ile kaldır
                if (listener.id === callbackOrId) {
                    listeners.splice(i, 1);
                    removedCount++;
                }
            } else {
                // Callback fonksiyonu ile kaldır
                if (listener.callback === callbackOrId) {
                    listeners.splice(i, 1);
                    removedCount++;
                }
            }
        }

        // Eğer hiç listener kalmadıysa event'i sil
        if (listeners.length === 0) {
            this.listeners.delete(event);
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`📢 Removed ${removedCount} listener(s) for event: ${event}`);
        }

        return removedCount > 0;
    }

    /**
     * Tüm listener'ları kaldır
     * @param {string} event - Olay adı (opsiyonel, belirtilmezse tümü)
     */
    removeAllListeners(event = null) {
        if (event) {
            const removed = this.listeners.has(event);
            this.listeners.delete(event);
            
            if (this.debugMode && removed) {
                console.log(`📢 Removed all listeners for event: ${event}`);
            }
            
            return removed;
        } else {
            const eventCount = this.listeners.size;
            this.listeners.clear();
            
            if (this.debugMode && eventCount > 0) {
                console.log(`📢 Removed all listeners for ${eventCount} events`);
            }
            
            return eventCount > 0;
        }
    }

    /**
     * Event fırlat
     * @param {string} event - Olay adı
     * @param {*} data - Olay verisi
     * @param {Object} options - Seçenekler
     */
    emit(event, data = null, options = {}) {
        const eventInfo = {
            event,
            data,
            timestamp: new Date().toISOString(),
            id: this._generateId(),
            source: options.source || 'unknown'
        };

        // Event geçmişine ekle
        this._addToHistory(eventInfo);

        if (this.debugMode) {
            console.log(`📢 Event emitted: ${event}`, eventInfo);
        }

        if (!this.listeners.has(event)) {
            if (this.debugMode) {
                console.log(`📢 No listeners for event: ${event}`);
            }
            return 0;
        }

        const listeners = this.listeners.get(event);
        let executedCount = 0;
        const toRemove = [];

        for (const listener of listeners) {
            try {
                listener.callback(data, eventInfo);
                executedCount++;

                // Bir kerelik listener'ları işaretle
                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`📢 Error in event listener for '${event}':`, error);
                
                // Hatalı listener'ı bildir
                this.emit('listenerError', {
                    event,
                    error: error.message,
                    listener: listener.id
                }, { source: 'eventBus' });
            }
        }

        // Bir kerelik listener'ları kaldır
        toRemove.forEach(listener => {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        });

        if (this.debugMode) {
            console.log(`📢 Event '${event}' executed ${executedCount} listener(s)`);
        }

        return executedCount;
    }

    /**
     * Asenkron event fırlat
     * @param {string} event - Olay adı
     * @param {*} data - Olay verisi
     * @param {Object} options - Seçenekler
     */
    async emitAsync(event, data = null, options = {}) {
        const eventInfo = {
            event,
            data,
            timestamp: new Date().toISOString(),
            id: this._generateId(),
            source: options.source || 'unknown'
        };

        this._addToHistory(eventInfo);

        if (this.debugMode) {
            console.log(`📢 Async event emitted: ${event}`, eventInfo);
        }

        if (!this.listeners.has(event)) {
            return 0;
        }

        const listeners = this.listeners.get(event);
        let executedCount = 0;
        const toRemove = [];
        const promises = [];

        for (const listener of listeners) {
            const promise = Promise.resolve().then(async () => {
                try {
                    await listener.callback(data, eventInfo);
                    executedCount++;

                    if (listener.once) {
                        toRemove.push(listener);
                    }
                } catch (error) {
                    console.error(`📢 Error in async event listener for '${event}':`, error);
                    
                    this.emit('listenerError', {
                        event,
                        error: error.message,
                        listener: listener.id
                    }, { source: 'eventBus' });
                }
            });

            promises.push(promise);
        }

        await Promise.all(promises);

        // Bir kerelik listener'ları kaldır
        toRemove.forEach(listener => {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        });

        return executedCount;
    }

    /**
     * Event'in listener'ı olup olmadığını kontrol et
     * @param {string} event - Olay adı
     */
    hasListeners(event) {
        return this.listeners.has(event) && this.listeners.get(event).length > 0;
    }

    /**
     * Event'in listener sayısını al
     * @param {string} event - Olay adı
     */
    listenerCount(event) {
        if (!this.listeners.has(event)) {
            return 0;
        }
        return this.listeners.get(event).length;
    }

    /**
     * Tüm event'leri listele
     */
    getEvents() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Event istatistiklerini al
     */
    getStats() {
        const events = this.getEvents();
        const totalListeners = events.reduce((sum, event) => {
            return sum + this.listenerCount(event);
        }, 0);

        return {
            totalEvents: events.length,
            totalListeners,
            events: events.map(event => ({
                name: event,
                listenerCount: this.listenerCount(event)
            })),
            historySize: this.history.length,
            maxHistorySize: this.maxHistorySize
        };
    }

    /**
     * Event geçmişini al
     * @param {number} limit - Döndürülecek maksimum event sayısı
     * @param {string} eventFilter - Filtrelenecek event adı
     */
    getHistory(limit = 50, eventFilter = null) {
        let history = [...this.history];

        if (eventFilter) {
            history = history.filter(item => item.event === eventFilter);
        }

        return history.slice(-limit);
    }

    /**
     * Event geçmişini temizle
     */
    clearHistory() {
        const clearedCount = this.history.length;
        this.history = [];

        if (this.debugMode) {
            console.log(`📢 Cleared ${clearedCount} events from history`);
        }

        return clearedCount;
    }

    /**
     * Debug modunu aç/kapat
     * @param {boolean} enabled - Debug modu durumu
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        if (enabled) {
            console.log('📢 EventBus debug mode enabled');
        }
    }

    /**
     * Event pipeline oluştur (event'leri zincirle)
     * @param {Array} events - Event zinciri
     * @param {*} initialData - Başlangıç verisi
     */
    async pipeline(events, initialData = null) {
        let currentData = initialData;

        for (const event of events) {
            if (typeof event === 'string') {
                await this.emitAsync(event, currentData);
            } else if (typeof event === 'object') {
                const { name, transform } = event;
                await this.emitAsync(name, currentData);
                
                if (transform && typeof transform === 'function') {
                    currentData = await transform(currentData);
                }
            }
        }

        return currentData;
    }

    /**
     * Event proxy oluştur (event'leri yönlendir)
     * @param {string} fromEvent - Kaynak event
     * @param {string} toEvent - Hedef event
     * @param {Function} transformer - Veri dönüştürücü (opsiyonel)
     */
    proxy(fromEvent, toEvent, transformer = null) {
        return this.on(fromEvent, (data) => {
            const transformedData = transformer ? transformer(data) : data;
            this.emit(toEvent, transformedData, { source: 'proxy' });
        });
    }

    /**
     * Event grubu oluştur
     * @param {string} groupName - Grup adı
     * @param {Array} events - Event listesi
     */
    createGroup(groupName, events) {
        const groupId = this._generateId();
        
        events.forEach(event => {
            this.on(event, (data) => {
                this.emit(`group:${groupName}`, {
                    event,
                    data,
                    groupId
                }, { source: 'group' });
            });
        });

        return groupId;
    }

    /**
     * Private: ID oluştur
     */
    _generateId() {
        return `eb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Private: Event'i geçmişe ekle
     */
    _addToHistory(eventInfo) {
        this.history.push(eventInfo);

        // Maksimum boyutu aşarsa eski event'leri sil
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * Event bus'ı temizle ve sıfırla
     */
    destroy() {
        this.removeAllListeners();
        this.clearHistory();
        
        if (this.debugMode) {
            console.log('📢 EventBus destroyed');
        }
    }
}

/**
 * Terminal Event Types - Standart event türleri
 */
const TerminalEvents = {
    // Session Events
    SESSION_STARTED: 'session:started',
    SESSION_ENDED: 'session:ended',
    SESSION_TIMEOUT: 'session:timeout',
    
    // Connection Events
    CONNECTION_ESTABLISHED: 'connection:established',
    CONNECTION_LOST: 'connection:lost',
    CONNECTION_ERROR: 'connection:error',
    CONNECTION_RETRY: 'connection:retry',
    
    // Command Events
    COMMAND_SENT: 'command:sent',
    COMMAND_RECEIVED: 'command:received',
    COMMAND_COMPLETED: 'command:completed',
    COMMAND_FAILED: 'command:failed',
    COMMAND_TIMEOUT: 'command:timeout',
    
    // Terminal Events
    TERMINAL_READY: 'terminal:ready',
    TERMINAL_CLEAR: 'terminal:clear',
    TERMINAL_RESIZE: 'terminal:resize',
    TERMINAL_FOCUS: 'terminal:focus',
    TERMINAL_BLUR: 'terminal:blur',
    
    // UI Events
    UI_THEME_CHANGED: 'ui:theme:changed',
    UI_FONT_CHANGED: 'ui:font:changed',
    UI_NOTIFICATION: 'ui:notification',
    UI_MODAL_OPEN: 'ui:modal:open',
    UI_MODAL_CLOSE: 'ui:modal:close',
    
    // Error Events
    ERROR_OCCURRED: 'error:occurred',
    ERROR_RECOVERED: 'error:recovered',
    
    // System Events
    SYSTEM_READY: 'system:ready',
    SYSTEM_SHUTDOWN: 'system:shutdown',
    SYSTEM_MAINTENANCE: 'system:maintenance'
};

/**
 * Event Data Validators - Event verilerini doğrula
 */
const EventValidators = {
    validateCommandEvent: (data) => {
        return data && typeof data.command === 'string' && data.command.length > 0;
    },
    
    validateConnectionEvent: (data) => {
        return data && typeof data.status === 'string';
    },
    
    validateSessionEvent: (data) => {
        return data && (data.sessionId || data.deviceId);
    },
    
    validateUIEvent: (data) => {
        return data && typeof data === 'object';
    }
};

/**
 * Global Event Bus Instance
 */
const terminalEventBus = new TerminalEventBus();

// Global error handling için event bus kullan
window.addEventListener('error', (event) => {
    terminalEventBus.emit(TerminalEvents.ERROR_OCCURRED, {
        type: 'javascript',
        message: event.error.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: new Date().toISOString()
    });
});

window.addEventListener('unhandledrejection', (event) => {
    terminalEventBus.emit(TerminalEvents.ERROR_OCCURRED, {
        type: 'promise',
        message: event.reason.message || event.reason,
        timestamp: new Date().toISOString()
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        TerminalEventBus, 
        TerminalEvents, 
        EventValidators,
        terminalEventBus 
    };
}

// Global access
window.TerminalEventBus = TerminalEventBus;
window.TerminalEvents = TerminalEvents;
window.terminalEventBus = terminalEventBus;

console.log('📢 Terminal EventBus system loaded successfully');