/**
 * SSH Service - SSH bağlantı ve komut yönetimi
 * SOLID Principles: Single Responsibility, Open/Closed
 */

class SSHService {
    constructor(apiEndpoints, sessionService) {
        this.api = apiEndpoints;
        this.session = sessionService;
        this.connections = new Map(); // Aktif bağlantıları takip et
        this.listeners = new Set();
    }

    // ===========================================
    // CONNECTION MANAGEMENT
    // ===========================================

    /**
     * SSH bağlantısını test et
     */
    async testConnection(deviceId, credentials) {
        try {
            this._notifyListeners('connectionTesting', { deviceId, credentials: { ...credentials, password: '***' } });
            
            const result = await this.api.testSSHConnection(deviceId, credentials);
            
            if (result.success && result.data.status === 'success') {
                // Başarılı bağlantıyı kaydet
                this.connections.set(deviceId, {
                    deviceId,
                    credentials,
                    status: 'connected',
                    connectedAt: new Date().toISOString(),
                    testResults: result.data.test_results
                });

                this._notifyListeners('connectionSuccess', {
                    deviceId,
                    device: result.data.device,
                    testResults: result.data.test_results
                });

                return {
                    success: true,
                    device: result.data.device,
                    testResults: result.data.test_results,
                    message: result.data.message
                };
            }
            
            throw new Error(result.data?.message || result.error || 'Connection failed');
            
        } catch (error) {
            console.error('SSHService.testConnection:', error);
            this._notifyListeners('connectionError', { deviceId, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Tek komut çalıştır
     */
    async executeCommand(deviceId, credentials, command) {
        try {
            if (!command || command.trim() === '') {
                throw new Error('Command cannot be empty');
            }

            this._notifyListeners('commandExecuting', { deviceId, command });
            
            const result = await this.api.executeCommand(deviceId, credentials, command);
            
            if (result.success && result.data.status === 'completed') {
                const commandResult = {
                    deviceId,
                    command,
                    result: result.data.result,
                    device: result.data.device,
                    executedAt: new Date().toISOString()
                };

                this._notifyListeners('commandCompleted', commandResult);
                
                return {
                    success: true,
                    ...commandResult
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Command execution failed');
            
        } catch (error) {
            console.error('SSHService.executeCommand:', error);
            this._notifyListeners('commandError', { deviceId, command, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Birden fazla komut çalıştır
     */
    async executeMultipleCommands(deviceId, credentials, commands, delay = 1.0) {
        try {
            if (!commands || commands.length === 0) {
                throw new Error('Commands array cannot be empty');
            }

            this._notifyListeners('multiCommandExecuting', { deviceId, commands });
            
            const result = await this.api.executeMultipleCommands(deviceId, credentials, commands, delay);
            
            if (result.success && result.data.status === 'completed') {
                const batchResult = {
                    deviceId,
                    commands,
                    results: result.data.results,
                    device: result.data.device,
                    totalTime: result.data.total_execution_time,
                    executedAt: new Date().toISOString()
                };

                this._notifyListeners('multiCommandCompleted', batchResult);
                
                return {
                    success: true,
                    ...batchResult
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Multiple command execution failed');
            
        } catch (error) {
            console.error('SSHService.executeMultipleCommands:', error);
            this._notifyListeners('multiCommandError', { deviceId, commands, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===========================================
    // DEVICE HEALTH & INFO
    // ===========================================

    /**
     * Cihaz sağlık kontrolü
     */
    async healthCheck(deviceId, credentials) {
        try {
            this._notifyListeners('healthCheckStarting', { deviceId });
            
            const result = await this.api.healthCheckDevice(deviceId, credentials);
            
            if (result.success) {
                const healthResult = {
                    deviceId,
                    status: result.data.status,
                    healthScore: result.data.health_score,
                    details: result.data.details,
                    device: result.data.device,
                    checkedAt: new Date().toISOString()
                };

                this._notifyListeners('healthCheckCompleted', healthResult);
                
                return {
                    success: true,
                    ...healthResult
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Health check failed');
            
        } catch (error) {
            console.error('SSHService.healthCheck:', error);
            this._notifyListeners('healthCheckError', { deviceId, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Hızlı cihaz bilgisi al
     */
    async getQuickInfo(deviceId, credentials) {
        try {
            this._notifyListeners('quickInfoStarting', { deviceId });
            
            const result = await this.api.getQuickDeviceInfo(deviceId, credentials);
            
            if (result.success && result.data.status === 'completed') {
                const infoResult = {
                    deviceId,
                    device: result.data.device,
                    results: result.data.results,
                    collectedAt: result.data.info_collected
                };

                this._notifyListeners('quickInfoCompleted', infoResult);
                
                return {
                    success: true,
                    ...infoResult
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Quick info collection failed');
            
        } catch (error) {
            console.error('SSHService.getQuickInfo:', error);
            this._notifyListeners('quickInfoError', { deviceId, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Kullanılabilir komutları al
     */
    async getAvailableCommands(deviceId) {
        try {
            const result = await this.api.getAvailableCommands(deviceId);
            
            if (result.success) {
                return {
                    success: true,
                    commands: result.data.available_commands,
                    device: result.data.device
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Failed to get available commands');
            
        } catch (error) {
            console.error('SSHService.getAvailableCommands:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===========================================
    // BATCH OPERATIONS
    // ===========================================

    /**
     * Birden fazla cihaza aynı komutu gönder
     */
    async executeBatchCommand(deviceCredentialsList, command) {
        const results = [];
        
        for (const { deviceId, credentials } of deviceCredentialsList) {
            try {
                const result = await this.executeCommand(deviceId, credentials, command);
                results.push({
                    deviceId,
                    success: result.success,
                    result: result.success ? result.result : null,
                    error: result.success ? null : result.error
                });
            } catch (error) {
                results.push({
                    deviceId,
                    success: false,
                    result: null,
                    error: error.message
                });
            }
        }

        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            command,
            executedAt: new Date().toISOString()
        };

        this._notifyListeners('batchCommandCompleted', { summary, results });

        return {
            success: summary.failed === 0,
            summary,
            results
        };
    }

    /**
     * Birden fazla cihazın sağlık kontrolü
     */
    async batchHealthCheck(deviceCredentialsList) {
        const results = [];
        
        for (const { deviceId, credentials } of deviceCredentialsList) {
            try {
                const result = await this.healthCheck(deviceId, credentials);
                results.push({
                    deviceId,
                    success: result.success,
                    healthData: result.success ? {
                        status: result.status,
                        healthScore: result.healthScore,
                        details: result.details
                    } : null,
                    error: result.success ? null : result.error
                });
            } catch (error) {
                results.push({
                    deviceId,
                    success: false,
                    healthData: null,
                    error: error.message
                });
            }
        }

        const summary = {
            total: results.length,
            healthy: results.filter(r => r.success && r.healthData?.status === 'healthy').length,
            degraded: results.filter(r => r.success && r.healthData?.status === 'degraded').length,
            unhealthy: results.filter(r => !r.success || r.healthData?.status === 'unhealthy').length,
            checkedAt: new Date().toISOString()
        };

        this._notifyListeners('batchHealthCheckCompleted', { summary, results });

        return {
            success: summary.unhealthy === 0,
            summary,
            results
        };
    }

    // ===========================================
    // SESSION MANAGEMENT
    // ===========================================

    /**
     * Terminal session oluştur
     */
    createTerminalSession(deviceId, credentials, device) {
        const sessionData = {
            deviceId,
            deviceName: device.name,
            deviceIP: device.ip,
            deviceType: device.type,
            username: credentials.username,
            password: credentials.password,
            port: credentials.port,
            createdAt: new Date().toISOString()
        };

        // Session storage'a kaydet
        this.session.setSSHSession(sessionData);
        
        // Bağlantıyı aktif olarak işaretle
        this.connections.set(deviceId, {
            ...sessionData,
            status: 'active'
        });

        this._notifyListeners('sessionCreated', sessionData);
        
        return sessionData;
    }

    /**
     * Terminal URL oluştur
     */
    createTerminalURL(sessionData) {
        return this.api.createSSHUrl(sessionData.deviceId, sessionData);
    }

    /**
     * Session sonlandır
     */
    closeSession(deviceId) {
        this.connections.delete(deviceId);
        this.session.clearSSHSession();
        this._notifyListeners('sessionClosed', { deviceId });
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    /**
     * Bağlantı durumu kontrolü
     */
    isConnected(deviceId) {
        const connection = this.connections.get(deviceId);
        return connection && connection.status === 'connected';
    }

    /**
     * Aktif bağlantıları al
     */
    getActiveConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * Komut geçmişi
     */
    getCommandHistory(deviceId) {
        // Bu veri session service'den alınabilir
        return this.session.getCommandHistory(deviceId) || [];
    }

    // ===========================================
    // EVENT SYSTEM
    // ===========================================

    /**
     * Event listener ekle
     */
    addEventListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * Event listener kaldır
     */
    removeEventListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Event fırlat
     * @private
     */
    _notifyListeners(eventType, data) {
        this.listeners.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('SSHService listener error:', error);
            }
        });
    }

    // ===========================================
    // VALIDATION
    // ===========================================

    /**
     * SSH credentials doğrula
     */
    validateCredentials(credentials) {
        const errors = [];

        if (!credentials.username || credentials.username.trim() === '') {
            errors.push('Username is required');
        }

        if (!credentials.password || credentials.password.trim() === '') {
            errors.push('Password is required');
        }

        if (credentials.port && (credentials.port < 1 || credentials.port > 65535)) {
            errors.push('Port must be between 1 and 65535');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Global instance (sessionService dependency will be injected)
let sshService;

// Initialize after sessionService is available
function initializeSSHService(sessionService) {
    sshService = new SSHService(api, sessionService);
    return sshService;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SSHService, initializeSSHService };
}