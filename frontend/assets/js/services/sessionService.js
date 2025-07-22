/**
 * Session Service - Oturum ve geçici veri yönetimi
 * SOLID Principles: Single Responsibility, Open/Closed
 */

class SessionService {
    constructor() {
        this.prefix = 'pam_';
        this.maxHistorySize = 100;
        this.maxRecentConnections = 10;
        this.maxCacheAge = 60 * 60 * 1000; // 1 hour in milliseconds
        
        this.eventListeners = new Set();
        
        // Initialize cleanup
        this.initializeCleanup();
    }

    // ===========================================
    // SSH SESSION MANAGEMENT
    // ===========================================

    /**
     * SSH oturum verilerini kaydet
     */
    setSSHSession(sessionData) {
        try {
            const data = {
                ...sessionData,
                timestamp: new Date().toISOString(),
                sessionId: this.generateSessionId()
            };
            
            // Her alanı ayrı ayrı kaydet (güvenlik için)
            Object.keys(data).forEach(key => {
                if (key === 'password') {
                    // Şifreyi encode et (basic obfuscation)
                    sessionStorage.setItem(`${this.prefix}ssh_${key}`, btoa(data[key]));
                } else {
                    sessionStorage.setItem(`${this.prefix}ssh_${key}`, data[key]);
                }
            });
            
            this._notifyListeners('sessionSaved', { sessionData: { ...data, password: '***' } });
            console.log('SSH session data saved:', { ...data, password: '***' });
            return true;
            
        } catch (error) {
            console.error('SessionService.setSSHSession:', error);
            this._notifyListeners('sessionError', { error: error.message });
            return false;
        }
    }

    /**
     * SSH oturum verilerini al
     */
    getSSHSession() {
        try {
            const sessionKeys = [
                'deviceId', 'deviceName', 'deviceIP', 'deviceType',
                'username', 'password', 'port', 'timestamp', 'sessionId'
            ];
            
            const sessionData = {};
            let hasData = false;
            
            sessionKeys.forEach(key => {
                const value = sessionStorage.getItem(`${this.prefix}ssh_${key}`);
                if (value) {
                    if (key === 'port') {
                        sessionData[key] = parseInt(value);
                    } else if (key === 'password') {
                        // Şifreyi decode et
                        try {
                            sessionData[key] = atob(value);
                        } catch (e) {
                            sessionData[key] = value; // Fallback
                        }
                    } else {
                        sessionData[key] = value;
                    }
                    hasData = true;
                }
            });
            
            if (hasData && this.isSessionValid(sessionData)) {
                return sessionData;
            }
            
            return null;
            
        } catch (error) {
            console.error('SessionService.getSSHSession:', error);
            return null;
        }
    }

    /**
     * SSH oturum verilerini temizle
     */
    clearSSHSession() {
        try {
            const sessionKeys = [
                'deviceId', 'deviceName', 'deviceIP', 'deviceType',
                'username', 'password', 'port', 'timestamp', 'sessionId'
            ];
            
            sessionKeys.forEach(key => {
                sessionStorage.removeItem(`${this.prefix}ssh_${key}`);
            });
            
            this._notifyListeners('sessionCleared', {});
            console.log('SSH session data cleared');
            return true;
            
        } catch (error) {
            console.error('SessionService.clearSSHSession:', error);
            return false;
        }
    }

    /**
     * Session ID oluştur
     */
    generateSessionId() {
        return `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Session geçerliliği kontrol et
     */
    isSessionValid(sessionData = null) {
        const session = sessionData || this.getSSHSession();
        if (!session || !session.timestamp) return false;
        
        // 24 saat sonra session'ı invalid say
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
        
        return hoursDiff < 24;
    }

    // ===========================================
    // COMMAND HISTORY MANAGEMENT
    // ===========================================

    /**
     * Komut geçmişine ekle
     */
    addToCommandHistory(deviceId, command) {
        try {
            const historyKey = `${this.prefix}history_${deviceId}`;
            let history = this.getCommandHistory(deviceId) || [];
            
            // Aynı komut varsa kaldır (duplicates önlemek için)
            history = history.filter(item => item.command !== command);
            
            // Yeni komutu başa ekle
            const historyItem = {
                command,
                timestamp: new Date().toISOString(),
                deviceId: parseInt(deviceId),
                sessionId: this.getSSHSession()?.sessionId || null
            };
            
            history.unshift(historyItem);
            
            // Maksimum boyutu aş
            if (history.length > this.maxHistorySize) {
                history = history.slice(0, this.maxHistorySize);
            }
            
            sessionStorage.setItem(historyKey, JSON.stringify(history));
            
            this._notifyListeners('commandAdded', { deviceId, command, historyItem });
            return true;
            
        } catch (error) {
            console.error('SessionService.addToCommandHistory:', error);
            return false;
        }
    }

    /**
     * Komut geçmişini al
     */
    getCommandHistory(deviceId) {
        try {
            const historyKey = `${this.prefix}history_${deviceId}`;
            const historyData = sessionStorage.getItem(historyKey);
            
            if (!historyData) return [];
            
            const history = JSON.parse(historyData);
            
            // Eski formatı yeni formata çevir (backward compatibility)
            return history.map(item => {
                if (typeof item === 'string') {
                    return {
                        command: item,
                        timestamp: new Date().toISOString(),
                        deviceId: parseInt(deviceId)
                    };
                }
                return item;
            });
            
        } catch (error) {
            console.error('SessionService.getCommandHistory:', error);
            return [];
        }
    }

    /**
     * Komut geçmişini temizle
     */
    clearCommandHistory(deviceId) {
        try {
            const historyKey = `${this.prefix}history_${deviceId}`;
            sessionStorage.removeItem(historyKey);
            
            this._notifyListeners('historyCleared', { deviceId });
            return true;
            
        } catch (error) {
            console.error('SessionService.clearCommandHistory:', error);
            return false;
        }
    }

    /**
     * Tüm komut geçmişlerini temizle
     */
    clearAllCommandHistory() {
        try {
            const keys = Object.keys(sessionStorage);
            const historyKeys = keys.filter(key => key.startsWith(`${this.prefix}history_`));
            
            historyKeys.forEach(key => {
                sessionStorage.removeItem(key);
            });
            
            this._notifyListeners('allHistoryCleared', { count: historyKeys.length });
            console.log(`Cleared ${historyKeys.length} command histories`);
            return historyKeys.length;
            
        } catch (error) {
            console.error('SessionService.clearAllCommandHistory:', error);
            return 0;
        }
    }

    /**
     * En çok kullanılan komutları al
     */
    getMostUsedCommands(deviceId = null, limit = 10) {
        try {
            let allHistory = [];
            
            if (deviceId) {
                allHistory = this.getCommandHistory(deviceId);
            } else {
                // Tüm cihazların geçmişini al
                const keys = Object.keys(sessionStorage);
                const historyKeys = keys.filter(key => key.startsWith(`${this.prefix}history_`));
                
                historyKeys.forEach(key => {
                    const historyData = sessionStorage.getItem(key);
                    if (historyData) {
                        const history = JSON.parse(historyData);
                        allHistory = allHistory.concat(history);
                    }
                });
            }
            
            // Komutları say
            const commandCounts = {};
            allHistory.forEach(item => {
                const command = typeof item === 'string' ? item : item.command;
                commandCounts[command] = (commandCounts[command] || 0) + 1;
            });
            
            // Sırala ve limitle
            return Object.entries(commandCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, limit)
                .map(([command, count]) => ({ command, count }));
                
        } catch (error) {
            console.error('SessionService.getMostUsedCommands:', error);
            return [];
        }
    }

    // ===========================================
    // RECENT CONNECTIONS MANAGEMENT
    // ===========================================

    /**
     * Son bağlantılara ekle
     */
    addToRecentConnections(deviceData, credentials) {
        try {
            const recentKey = `${this.prefix}recent_connections`;
            let recent = this.getRecentConnections();
            
            const connectionData = {
                deviceId: deviceData.id,
                deviceName: deviceData.name,
                deviceIP: deviceData.ip,
                deviceType: deviceData.type,
                username: credentials.username,
                port: credentials.port,
                lastConnected: new Date().toISOString(),
                connectionCount: 1
            };
            
            // Aynı cihaz varsa güncelle
            const existingIndex = recent.findIndex(conn => conn.deviceId === deviceData.id);
            if (existingIndex >= 0) {
                connectionData.connectionCount = recent[existingIndex].connectionCount + 1;
                recent.splice(existingIndex, 1);
            }
            
            // Başa ekle
            recent.unshift(connectionData);
            
            // Maksimum limit
            if (recent.length > this.maxRecentConnections) {
                recent = recent.slice(0, this.maxRecentConnections);
            }
            
            localStorage.setItem(recentKey, JSON.stringify(recent));
            
            this._notifyListeners('recentConnectionAdded', { connectionData });
            return true;
            
        } catch (error) {
            console.error('SessionService.addToRecentConnections:', error);
            return false;
        }
    }

    /**
     * Son bağlantıları al
     */
    getRecentConnections() {
        try {
            const recentKey = `${this.prefix}recent_connections`;
            const recentData = localStorage.getItem(recentKey);
            
            if (!recentData) return [];
            
            const recent = JSON.parse(recentData);
            
            // Süresi dolmuş bağlantıları filtrele (30 gün)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            return recent.filter(conn => {
                const lastConnected = new Date(conn.lastConnected);
                return lastConnected > thirtyDaysAgo;
            });
            
        } catch (error) {
            console.error('SessionService.getRecentConnections:', error);
            return [];
        }
    }

    /**
     * Son bağlantıları temizle
     */
    clearRecentConnections() {
        try {
            const recentKey = `${this.prefix}recent_connections`;
            localStorage.removeItem(recentKey);
            
            this._notifyListeners('recentConnectionsCleared', {});
            return true;
            
        } catch (error) {
            console.error('SessionService.clearRecentConnections:', error);
            return false;
        }
    }

    /**
     * Belirli bir cihazın bağlantı geçmişini al
     */
    getConnectionHistory(deviceId) {
        const recent = this.getRecentConnections();
        return recent.filter(conn => conn.deviceId === deviceId)
                    .sort((a, b) => new Date(b.lastConnected) - new Date(a.lastConnected));
    }

    // ===========================================
    // USER PREFERENCES MANAGEMENT
    // ===========================================

    /**
     * Kullanıcı tercihlerini kaydet
     */
    setUserPreferences(preferences) {
        try {
            const prefKey = `${this.prefix}preferences`;
            const currentPrefs = this.getUserPreferences();
            
            const updatedPrefs = {
                ...currentPrefs,
                ...preferences,
                updatedAt: new Date().toISOString()
            };
            
            localStorage.setItem(prefKey, JSON.stringify(updatedPrefs));
            
            this._notifyListeners('preferencesUpdated', { preferences: updatedPrefs });
            return true;
            
        } catch (error) {
            console.error('SessionService.setUserPreferences:', error);
            return false;
        }
    }

    /**
     * Kullanıcı tercihlerini al
     */
    getUserPreferences() {
        try {
            const prefKey = `${this.prefix}preferences`;
            const prefData = localStorage.getItem(prefKey);
            
            const defaultPrefs = {
                theme: 'dark',
                terminalFontSize: 14,
                terminalFontFamily: 'Consolas, Monaco, monospace',
                autoConnect: false,
                saveHistory: true,
                maxHistorySize: 100,
                showQuickCommands: true,
                autoScroll: true,
                soundEnabled: true,
                notifications: true,
                autoSave: false,
                language: 'tr'
            };
            
            return prefData ? { ...defaultPrefs, ...JSON.parse(prefData) } : defaultPrefs;
            
        } catch (error) {
            console.error('SessionService.getUserPreferences:', error);
            return this.getDefaultPreferences();
        }
    }

    /**
     * Default tercihleri al
     */
    getDefaultPreferences() {
        return {
            theme: 'dark',
            terminalFontSize: 14,
            terminalFontFamily: 'Consolas, Monaco, monospace',
            autoConnect: false,
            saveHistory: true,
            maxHistorySize: 100,
            showQuickCommands: true,
            autoScroll: true,
            soundEnabled: true,
            notifications: true,
            autoSave: false,
            language: 'tr'
        };
    }

    /**
     * Tercihleri sıfırla
     */
    resetUserPreferences() {
        try {
            const prefKey = `${this.prefix}preferences`;
            localStorage.removeItem(prefKey);
            
            this._notifyListeners('preferencesReset', {});
            return true;
            
        } catch (error) {
            console.error('SessionService.resetUserPreferences:', error);
            return false;
        }
    }

    // ===========================================
    // CACHE MANAGEMENT
    // ===========================================

    /**
     * Cache verisi kaydet (expiration ile)
     */
    setCacheData(key, data, expirationMinutes = 60) {
        try {
            const cacheKey = `${this.prefix}cache_${key}`;
            const cacheData = {
                data,
                timestamp: new Date().toISOString(),
                expiration: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString(),
                key: key
            };
            
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
            return true;
            
        } catch (error) {
            console.error('SessionService.setCacheData:', error);
            return false;
        }
    }

    /**
     * Cache verisini al (expiration kontrolü ile)
     */
    getCacheData(key) {
        try {
            const cacheKey = `${this.prefix}cache_${key}`;
            const cacheData = sessionStorage.getItem(cacheKey);
            
            if (!cacheData) return null;
            
            const parsed = JSON.parse(cacheData);
            const now = new Date();
            const expiration = new Date(parsed.expiration);
            
            if (now > expiration) {
                // Süresi dolmuş, sil
                sessionStorage.removeItem(cacheKey);
                return null;
            }
            
            return parsed.data;
            
        } catch (error) {
            console.error('SessionService.getCacheData:', error);
            return null;
        }
    }

    /**
     * Cache verisini sil
     */
    removeCacheData(key) {
        try {
            const cacheKey = `${this.prefix}cache_${key}`;
            sessionStorage.removeItem(cacheKey);
            return true;
            
        } catch (error) {
            console.error('SessionService.removeCacheData:', error);
            return false;
        }
    }

    /**
     * Tüm cache'i temizle
     */
    clearAllCache() {
        try {
            const keys = Object.keys(sessionStorage);
            const cacheKeys = keys.filter(key => key.startsWith(`${this.prefix}cache_`));
            
            cacheKeys.forEach(key => {
                sessionStorage.removeItem(key);
            });
            
            this._notifyListeners('cacheCleared', { count: cacheKeys.length });
            console.log(`Cleared ${cacheKeys.length} cache entries`);
            return cacheKeys.length;
            
        } catch (error) {
            console.error('SessionService.clearAllCache:', error);
            return 0;
        }
    }

    /**
     * Cache istatistiklerini al
     */
    getCacheStats() {
        try {
            const keys = Object.keys(sessionStorage);
            const cacheKeys = keys.filter(key => key.startsWith(`${this.prefix}cache_`));
            
            let totalSize = 0;
            let expiredCount = 0;
            const now = new Date();
            
            const cacheItems = cacheKeys.map(key => {
                const data = sessionStorage.getItem(key);
                const size = new Blob([data || '']).size;
                totalSize += size;
                
                try {
                    const parsed = JSON.parse(data);
                    const expiration = new Date(parsed.expiration);
                    const isExpired = now > expiration;
                    
                    if (isExpired) expiredCount++;
                    
                    return {
                        key: parsed.key,
                        size,
                        created: parsed.timestamp,
                        expiration: parsed.expiration,
                        isExpired
                    };
                } catch (e) {
                    return {
                        key: key.replace(`${this.prefix}cache_`, ''),
                        size,
                        created: null,
                        expiration: null,
                        isExpired: false
                    };
                }
            });
            
            return {
                totalItems: cacheKeys.length,
                totalSize,
                totalSizeFormatted: this._formatBytes(totalSize),
                expiredCount,
                items: cacheItems
            };
            
        } catch (error) {
            console.error('SessionService.getCacheStats:', error);
            return null;
        }
    }

    // ===========================================
    // APPLICATION STATE MANAGEMENT
    // ===========================================

    /**
     * Uygulama durumunu kaydet
     */
    setAppState(key, value) {
        try {
            const stateKey = `${this.prefix}state_${key}`;
            const stateData = {
                value,
                timestamp: new Date().toISOString()
            };
            
            sessionStorage.setItem(stateKey, JSON.stringify(stateData));
            
            this._notifyListeners('appStateChanged', { key, value });
            return true;
            
        } catch (error) {
            console.error('SessionService.setAppState:', error);
            return false;
        }
    }

    /**
     * Uygulama durumunu al
     */
    getAppState(key, defaultValue = null) {
        try {
            const stateKey = `${this.prefix}state_${key}`;
            const stateData = sessionStorage.getItem(stateKey);
            
            if (stateData) {
                const parsed = JSON.parse(stateData);
                return parsed.value;
            }
            
            return defaultValue;
            
        } catch (error) {
            console.error('SessionService.getAppState:', error);
            return defaultValue;
        }
    }

    /**
     * Uygulama durumunu sil
     */
    removeAppState(key) {
        try {
            const stateKey = `${this.prefix}state_${key}`;
            sessionStorage.removeItem(stateKey);
            
            this._notifyListeners('appStateRemoved', { key });
            return true;
            
        } catch (error) {
            console.error('SessionService.removeAppState:', error);
            return false;
        }
    }

    /**
     * Tüm app state'leri al
     */
    getAllAppStates() {
        try {
            const keys = Object.keys(sessionStorage);
            const stateKeys = keys.filter(key => key.startsWith(`${this.prefix}state_`));
            
            const states = {};
            
            stateKeys.forEach(key => {
                const stateData = sessionStorage.getItem(key);
                if (stateData) {
                    const parsed = JSON.parse(stateData);
                    const stateKey = key.replace(`${this.prefix}state_`, '');
                    states[stateKey] = parsed.value;
                }
            });
            
            return states;
            
        } catch (error) {
            console.error('SessionService.getAllAppStates:', error);
            return {};
        }
    }

    // ===========================================
    // DATA EXPORT/IMPORT
    // ===========================================

    /**
     * Session verilerini export et
     */
    exportSessionData() {
        try {
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    source: 'PAM Network Management'
                },
                preferences: this.getUserPreferences(),
                recentConnections: this.getRecentConnections(),
                commandHistories: this._getAllCommandHistories(),
                appStates: this.getAllAppStates(),
                cacheStats: this.getCacheStats()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pam-session-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            return {
                success: true,
                message: 'Session data exported successfully',
                filename: a.download
            };
            
        } catch (error) {
            console.error('SessionService.exportSessionData:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Session verilerini import et
     */
    async importSessionData(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.metadata || importData.metadata.source !== 'PAM Network Management') {
                throw new Error('Invalid import file format');
            }
            
            const results = {
                preferences: false,
                recentConnections: false,
                commandHistories: 0,
                appStates: 0,
                errors: []
            };
            
            // Import preferences
            if (importData.preferences) {
                try {
                    this.setUserPreferences(importData.preferences);
                    results.preferences = true;
                } catch (error) {
                    results.errors.push(`Preferences import failed: ${error.message}`);
                }
            }
            
            // Import recent connections
            if (importData.recentConnections && Array.isArray(importData.recentConnections)) {
                try {
                    const recentKey = `${this.prefix}recent_connections`;
                    localStorage.setItem(recentKey, JSON.stringify(importData.recentConnections));
                    results.recentConnections = true;
                } catch (error) {
                    results.errors.push(`Recent connections import failed: ${error.message}`);
                }
            }
            
            // Import command histories
            if (importData.commandHistories) {
                Object.entries(importData.commandHistories).forEach(([deviceId, history]) => {
                    try {
                        const historyKey = `${this.prefix}history_${deviceId}`;
                        sessionStorage.setItem(historyKey, JSON.stringify(history));
                        results.commandHistories++;
                    } catch (error) {
                        results.errors.push(`Command history import failed for device ${deviceId}: ${error.message}`);
                    }
                });
            }
            
            // Import app states
            if (importData.appStates) {
                Object.entries(importData.appStates).forEach(([key, value]) => {
                    try {
                        this.setAppState(key, value);
                        results.appStates++;
                    } catch (error) {
                        results.errors.push(`App state import failed for ${key}: ${error.message}`);
                    }
                });
            }
            
            this._notifyListeners('dataImported', { results });
            
            return {
                success: results.errors.length === 0,
                results,
                message: `Import completed with ${results.errors.length} errors`
            };
            
        } catch (error) {
            console.error('SessionService.importSessionData:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===========================================
    // CLEANUP & MAINTENANCE
    // ===========================================

    /**
     * Cleanup sistemini başlat
     */
    initializeCleanup() {
        // Sayfa yüklendiğinde ilk cleanup
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.performMaintenance();
            });
        } else {
            this.performMaintenance();
        }
        
        // 5 dakikada bir cleanup
        setInterval(() => {
            this.performMaintenance();
        }, 5 * 60 * 1000);
    }

    /**
     * Bakım işlemlerini gerçekleştir
     */
    performMaintenance() {
        const results = {
            expiredCacheCleared: 0,
            oldHistoriesCleared: 0,
            oldConnectionsCleared: 0
        };
        
        // Süresi dolmuş cache'leri temizle
        results.expiredCacheCleared = this.cleanupExpiredCache();
        
        // Eski komut geçmişlerini temizle
        results.oldHistoriesCleared = this.cleanupOldCommandHistories();
        
        // Eski bağlantıları temizle
        results.oldConnectionsCleared = this.cleanupOldConnections();
        
        // Son maintenance zamanını kaydet
        this.setAppState('lastMaintenance', new Date().toISOString());
        
        this._notifyListeners('maintenanceCompleted', { results });
        
        return results;
    }

    /**
     * Süresi dolmuş cache'leri temizle
     */
    cleanupExpiredCache() {
        try {
            const keys = Object.keys(sessionStorage);
            const cacheKeys = keys.filter(key => key.startsWith(`${this.prefix}cache_`));
            let cleanedCount = 0;
            const now = new Date();
            
            cacheKeys.forEach(key => {
                try {
                    const data = sessionStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        const expiration = new Date(parsed.expiration);
                        
                        if (now > expiration) {
                            sessionStorage.removeItem(key);
                            cleanedCount++;
                        }
                    }
                } catch (error) {
                    // Bozuk veri varsa sil
                    sessionStorage.removeItem(key);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} expired cache entries`);
            }
            
            return cleanedCount;
            
        } catch (error) {
            console.error('SessionService.cleanupExpiredCache:', error);
            return 0;
        }
    }

    /**
     * Eski komut geçmişlerini temizle
     */
    cleanupOldCommandHistories() {
        try {
            const keys = Object.keys(sessionStorage);
            const historyKeys = keys.filter(key => key.startsWith(`${this.prefix}history_`));
            let cleanedCount = 0;
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            historyKeys.forEach(key => {
                try {
                    const data = sessionStorage.getItem(key);
                    if (data) {
                        const history = JSON.parse(data);
                        
                        // Eski kayıtları filtrele
                        const filteredHistory = history.filter(item => {
                            const timestamp = typeof item === 'string' ? new Date() : new Date(item.timestamp);
                            return timestamp > thirtyDaysAgo;
                        });
                        
                        if (filteredHistory.length !== history.length) {
                            if (filteredHistory.length === 0) {
                                sessionStorage.removeItem(key);
                            } else {
                                sessionStorage.setItem(key, JSON.stringify(filteredHistory));
                            }
                            cleanedCount++;
                        }
                    }
                } catch (error) {
                    // Bozuk veri varsa sil
                    sessionStorage.removeItem(key);
                    cleanedCount++;
                }
            });
            
            return cleanedCount;
            
        } catch (error) {
            console.error('SessionService.cleanupOldCommandHistories:', error);
            return 0;
        }
    }

    /**
     * Eski bağlantıları temizle
     */
    cleanupOldConnections() {
        try {
            const recentKey = `${this.prefix}recent_connections`;
            const recentData = localStorage.getItem(recentKey);
            
            if (!recentData) return 0;
            
            const recent = JSON.parse(recentData);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const filteredRecent = recent.filter(conn => {
                const lastConnected = new Date(conn.lastConnected);
                return lastConnected > thirtyDaysAgo;
            });
            
            if (filteredRecent.length !== recent.length) {
                localStorage.setItem(recentKey, JSON.stringify(filteredRecent));
                return recent.length - filteredRecent.length;
            }
            
            return 0;
            
        } catch (error) {
            console.error('SessionService.cleanupOldConnections:', error);
            return 0;
        }
    }

    /**
     * Tüm session verilerini temizle
     */
    clearAllSessionData() {
        try {
            const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith(this.prefix));
            const localKeys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
            
            sessionKeys.forEach(key => sessionStorage.removeItem(key));
            localKeys.forEach(key => localStorage.removeItem(key));
            
            const totalCleared = sessionKeys.length + localKeys.length;
            
            this._notifyListeners('allDataCleared', { count: totalCleared });
            console.log(`Cleared ${totalCleared} total entries`);
            
            return totalCleared;
            
        } catch (error) {
            console.error('SessionService.clearAllSessionData:', error);
            return 0;
        }
    }

    // ===========================================
    // UTILITY & HELPER METHODS
    // ===========================================

    /**
     * Storage kullanım bilgilerini al
     */
    getStorageInfo() {
        try {
            const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith(this.prefix));
            const localKeys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
            
            let sessionSize = 0;
            let localSize = 0;
            
            const breakdown = {
                session: {},
                local: {}
            };
            
            // Session storage analizi
            sessionKeys.forEach(key => {
                const data = sessionStorage.getItem(key);
                const size = new Blob([data || '']).size;
                sessionSize += size;
                
                const category = this._getCategoryFromKey(key);
                breakdown.session[category] = (breakdown.session[category] || 0) + size;
            });
            
            // Local storage analizi
            localKeys.forEach(key => {
                const data = localStorage.getItem(key);
                const size = new Blob([data || '']).size;
                localSize += size;
                
                const category = this._getCategoryFromKey(key);
                breakdown.local[category] = (breakdown.local[category] || 0) + size;
            });
            
            return {
                sessionStorage: {
                    totalEntries: sessionKeys.length,
                    totalSize: sessionSize,
                    totalSizeFormatted: this._formatBytes(sessionSize),
                    breakdown: breakdown.session
                },
                localStorage: {
                    totalEntries: localKeys.length,
                    totalSize: localSize,
                    totalSizeFormatted: this._formatBytes(localSize),
                    breakdown: breakdown.local
                },
                totalSize: sessionSize + localSize,
                totalSizeFormatted: this._formatBytes(sessionSize + localSize),
                totalEntries: sessionKeys.length + localKeys.length
            };
            
        } catch (error) {
            console.error('SessionService.getStorageInfo:', error);
            return null;
        }
    }

    /**
     * Service durumu
     */
    getServiceStatus() {
        const info = this.getStorageInfo();
        const preferences = this.getUserPreferences();
        const session = this.getSSHSession();
        
        return {
            initialized: true,
            version: '1.0',
            storageInfo: info,
            hasActiveSession: !!session,
            sessionValid: this.isSessionValid(session),
            preferences: preferences,
            recentConnectionsCount: this.getRecentConnections().length,
            lastMaintenance: this.getAppState('lastMaintenance'),
            cacheStats: this.getCacheStats()
        };
    }

    // ===========================================
    // EVENT SYSTEM
    // ===========================================

    /**
     * Event listener ekle
     */
    addEventListener(callback) {
        this.eventListeners.add(callback);
    }

    /**
     * Event listener kaldır
     */
    removeEventListener(callback) {
        this.eventListeners.delete(callback);
    }

    /**
     * Event fırlat
     * @private
     */
    _notifyListeners(eventType, data) {
        this.eventListeners.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('SessionService listener error:', error);
            }
        });
    }

    // ===========================================
    // PRIVATE HELPER METHODS
    // ===========================================

    /**
     * Tüm komut geçmişlerini al
     * @private
     */
    _getAllCommandHistories() {
        const keys = Object.keys(sessionStorage);
        const historyKeys = keys.filter(key => key.startsWith(`${this.prefix}history_`));
        
        const histories = {};
        
        historyKeys.forEach(key => {
            const deviceId = key.replace(`${this.prefix}history_`, '');
            const historyData = sessionStorage.getItem(key);
            
            if (historyData) {
                try {
                    histories[deviceId] = JSON.parse(historyData);
                } catch (error) {
                    console.warn(`Failed to parse history for device ${deviceId}:`, error);
                }
            }
        });
        
        return histories;
    }

    /**
     * Key'den category çıkar
     * @private
     */
    _getCategoryFromKey(key) {
        const parts = key.replace(this.prefix, '').split('_');
        return parts[0] || 'unknown';
    }

    /**
     * Bytes formatla
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Debug bilgileri
     */
    getDebugInfo() {
        return {
            prefix: this.prefix,
            maxHistorySize: this.maxHistorySize,
            maxRecentConnections: this.maxRecentConnections,
            maxCacheAge: this.maxCacheAge,
            serviceStatus: this.getServiceStatus(),
            storageInfo: this.getStorageInfo(),
            sessionData: this.getSSHSession() ? { ...this.getSSHSession(), password: '***' } : null,
            preferences: this.getUserPreferences(),
            recentConnections: this.getRecentConnections().map(conn => ({ ...conn })),
            eventListenersCount: this.eventListeners.size
        };
    }
    /**
     * SSH oturum verilerini kaydet
     */
    setSSHSession(sessionData) {
        try {
            const data = {
                ...sessionData,
                timestamp: new Date().toISOString(),
                sessionId: this.generateSessionId()
            };
            
            // Session storage'a kaydet (şifreyi encode et)
            const sessionToSave = { ...data };
            if (sessionToSave.password) {
                sessionToSave.password = btoa(sessionToSave.password); // Base64 encode
            }
            
            sessionStorage.setItem(`${this.prefix}ssh_session`, JSON.stringify(sessionToSave));
            
            this._notifyListeners('sshSessionSaved', { sessionData: { ...data, password: '***' } });
            console.log('SSH session data saved:', { ...data, password: '***' });
            return true;
            
        } catch (error) {
            console.error('SessionService.setSSHSession:', error);
            this._notifyListeners('sessionError', { error: error.message });
            return false;
        }
    }

    /**
     * SSH oturum verilerini al
     */
    getSSHSession() {
        try {
            const sessionData = sessionStorage.getItem(`${this.prefix}ssh_session`);
            
            if (!sessionData) return null;
            
            const session = JSON.parse(sessionData);
            
            // Şifreyi decode et
            if (session.password) {
                try {
                    session.password = atob(session.password); // Base64 decode
                } catch (e) {
                    console.warn('Failed to decode SSH password');
                }
            }
            
            // Session geçerliliğini kontrol et (24 saat)
            if (session.timestamp) {
                const sessionTime = new Date(session.timestamp);
                const now = new Date();
                const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
                
                if (hoursDiff > 24) {
                    this.clearSSHSession();
                    return null;
                }
            }
            
            return session;
            
        } catch (error) {
            console.error('SessionService.getSSHSession:', error);
            return null;
        }
    }

    /**
     * SSH oturum verilerini temizle
     */
    clearSSHSession() {
        try {
            sessionStorage.removeItem(`${this.prefix}ssh_session`);
            this._notifyListeners('sshSessionCleared', {});
            console.log('SSH session data cleared');
            return true;
            
        } catch (error) {
            console.error('SessionService.clearSSHSession:', error);
            return false;
        }
    }

    /**
     * Session ID oluştur
     */
    generateSessionId() {
        return `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // ===========================================
    // URL'DEN SESSION VERİSİ ALMA
    // ===========================================
    /**
     * URL parametrelerinden session verisi al
     */
    getSessionFromURL() {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('deviceId')) {
            return {
                deviceId: parseInt(urlParams.get('deviceId')),
                deviceName: urlParams.get('deviceName'),
                deviceIP: urlParams.get('deviceIP'),
                deviceType: urlParams.get('deviceType'),
                username: urlParams.get('username'),
                password: urlParams.get('password'),
                port: parseInt(urlParams.get('port')) || 22
            };
        }

        return null;
    }
}

// Global instance
const sessionService = new SessionService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionService, sessionService };
}