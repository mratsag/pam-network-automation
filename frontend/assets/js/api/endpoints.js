/**
 * API Endpoints - Tüm API endpoint'leri merkezi yönetim
 * SOLID Principles: Single Responsibility, Interface Segregation
 */

class ApiEndpoints {
    constructor(client) {
        this.client = client;
    }

    // ===========================================
    // DEVICE ENDPOINTS
    // ===========================================

    /**
     * Tüm cihazları listele
     */
    async getDevices() {
        return await this.client.get('/devices');
    }

    /**
     * Tek cihaz bilgisi
     */
    async getDevice(deviceId) {
        return await this.client.get(`/devices/${deviceId}`);
    }

    /**
     * Yeni cihaz ekle
     */
    async createDevice(deviceData) {
        return await this.client.post('/devices', deviceData);
    }

    /**
     * Cihaz güncelle
     */
    async updateDevice(deviceId, deviceData) {
        return await this.client.put(`/devices/${deviceId}`, deviceData);
    }

    /**
     * Cihaz sil
     */
    async deleteDevice(deviceId) {
        return await this.client.delete(`/devices/${deviceId}`);
    }

    // ===========================================
    // SSH CONNECTION ENDPOINTS
    // ===========================================

    /**
     * SSH bağlantısını test et
     */
    async testSSHConnection(deviceId, credentials) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            port: credentials.port || 22
        };
        return await this.client.post(`/connections/test/${deviceId}`, payload);
    }

    /**
     * Tek komut çalıştır
     */
    async executeCommand(deviceId, credentials, command) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            command: command,
            port: credentials.port || 22
        };
        return await this.client.post(`/connections/execute/${deviceId}`, payload);
    }

    /**
     * Çoklu komut çalıştır
     */
    async executeMultipleCommands(deviceId, credentials, commands, delay = 1.0) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            commands: commands,
            port: credentials.port || 22,
            delay: delay
        };
        return await this.client.post(`/connections/execute-multiple/${deviceId}`, payload);
    }

    /**
     * Cihaz sağlık kontrolü
     */
    async healthCheckDevice(deviceId, credentials) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            port: credentials.port || 22
        };
        return await this.client.post(`/connections/health-check/${deviceId}`, payload);
    }

    /**
     * Kullanılabilir komutları al
     */
    async getAvailableCommands(deviceId) {
        return await this.client.get(`/connections/available-commands/${deviceId}`);
    }

    /**
     * Hızlı cihaz bilgisi al
     */
    async getQuickDeviceInfo(deviceId, credentials) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            port: credentials.port || 22
        };
        return await this.client.post(`/connections/quick-info/${deviceId}`, payload);
    }

    // ===========================================
    // USER ENDPOINTS
    // ===========================================

    /**
     * Tüm kullanıcıları listele
     */
    async getUsers() {
        return await this.client.get('/users');
    }

    /**
     * Yeni kullanıcı ekle
     */
    async createUser(userData) {
        return await this.client.post('/users', userData);
    }

    // ===========================================
    // SYSTEM ENDPOINTS
    // ===========================================

    /**
     * Sistem durumu
     */
    async getHealth() {
        return await this.client.get('/health');
    }

    /**
     * API bilgileri
     */
    async getApiInfo() {
        return await this.client.get('/api/info');
    }

    /**
     * PAM test
     */
    async testPAM() {
        return await this.client.get('/test/pam');
    }

    // ===========================================
    // BATCH OPERATIONS (Toplu İşlemler)
    // ===========================================

    /**
     * Birden fazla cihaza aynı komutu gönder
     */
    async executeCommandOnMultipleDevices(deviceCredentials, command) {
        const promises = deviceCredentials.map(({ deviceId, credentials }) => 
            this.executeCommand(deviceId, credentials, command)
        );
        
        return await Promise.allSettled(promises);
    }

    /**
     * Birden fazla cihazın sağlık kontrolü
     */
    async healthCheckMultipleDevices(deviceCredentials) {
        const promises = deviceCredentials.map(({ deviceId, credentials }) => 
            this.healthCheckDevice(deviceId, credentials)
        );
        
        return await Promise.allSettled(promises);
    }

    // ===========================================
    // HELPER METHODS
    // ===========================================

    /**
     * Credentials objesi oluştur
     */
    createCredentials(username, password, port = 22) {
        return { username, password, port };
    }

    /**
     * Batch operation result'ları parse et
     */
    parseBatchResults(results) {
        return results.map((result, index) => ({
            index,
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }

    /**
     * SSH bağlantı URL'si oluştur
     */
    createSSHUrl(deviceId, credentials) {
        const params = new URLSearchParams({
            deviceId: deviceId.toString(),
            username: credentials.username,
            password: credentials.password,
            port: credentials.port.toString()
        });
        return `terminal.html?${params.toString()}`;
    }
}

// Global instance
const api = new ApiEndpoints(apiClient);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiEndpoints, api };
}