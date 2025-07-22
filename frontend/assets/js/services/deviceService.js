/**
 * Device Service - Cihaz yönetimi iş mantığı
 * SOLID Principles: Single Responsibility, Dependency Inversion
 */

class DeviceService {
    constructor(apiEndpoints) {
        this.api = apiEndpoints;
        this.devices = [];
        this.listeners = new Set();
    }

    // ===========================================
    // DEVICE CRUD OPERATIONS
    // ===========================================

    /**
     * Tüm cihazları yükle ve cache'e al
     */
    async loadDevices() {
        try {
            const result = await this.api.getDevices();
            
            if (result.success) {
                this.devices = result.data.devices || [];
                this._notifyListeners('devicesLoaded', this.devices);
                return {
                    success: true,
                    devices: this.devices,
                    count: this.devices.length
                };
            }
            
            throw new Error(result.error || 'Failed to load devices');
            
        } catch (error) {
            console.error('DeviceService.loadDevices:', error);
            this._notifyListeners('error', error.message);
            return {
                success: false,
                error: error.message,
                devices: []
            };
        }
    }

    /**
     * Yeni cihaz ekle
     */
    async addDevice(deviceData) {
        try {
            // Validation
            const validation = this._validateDeviceData(deviceData);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            const result = await this.api.createDevice(deviceData);
            
            if (result.success) {
                // Cache'i güncelle
                await this.loadDevices();
                
                this._notifyListeners('deviceAdded', result.data.device);
                return {
                    success: true,
                    device: result.data.device,
                    message: 'Device added successfully'
                };
            }
            
            throw new Error(result.data?.detail || 'Failed to add device');
            
        } catch (error) {
            console.error('DeviceService.addDevice:', error);
            this._notifyListeners('error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cihaz sil
     */
    async deleteDevice(deviceId) {
        try {
            const result = await this.api.deleteDevice(deviceId);
            
            if (result.success) {
                // Cache'den kaldır
                this.devices = this.devices.filter(d => d.id !== deviceId);
                
                this._notifyListeners('deviceDeleted', deviceId);
                return {
                    success: true,
                    message: 'Device deleted successfully'
                };
            }
            
            throw new Error(result.data?.detail || 'Failed to delete device');
            
        } catch (error) {
            console.error('DeviceService.deleteDevice:', error);
            this._notifyListeners('error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===========================================
    // DEVICE QUERY METHODS
    // ===========================================

    /**
     * ID ile cihaz bul
     */
    getDeviceById(deviceId) {
        return this.devices.find(device => device.id === parseInt(deviceId));
    }

    /**
     * IP ile cihaz bul
     */
    getDeviceByIP(ip) {
        return this.devices.find(device => device.ip === ip);
    }

    /**
     * Tipe göre cihazları filtrele
     */
    getDevicesByType(type) {
        return this.devices.filter(device => device.type === type);
    }

    /**
     * Arama fonksiyonu
     */
    searchDevices(query) {
        const searchTerm = query.toLowerCase();
        return this.devices.filter(device => 
            device.name.toLowerCase().includes(searchTerm) ||
            device.ip.includes(searchTerm) ||
            device.type.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Aktif cihazları al (cache'den)
     */
    getAllDevices() {
        return [...this.devices]; // Shallow copy
    }

    /**
     * Cihaz istatistikleri
     */
    getDeviceStats() {
        const typeStats = {};
        this.devices.forEach(device => {
            typeStats[device.type] = (typeStats[device.type] || 0) + 1;
        });

        return {
            total: this.devices.length,
            byType: typeStats,
            withVault: this.devices.filter(d => d.vault_path).length,
            withoutVault: this.devices.filter(d => !d.vault_path).length
        };
    }

    // ===========================================
    // VALIDATION
    // ===========================================

    /**
     * Cihaz verilerini doğrula
     * @private
     */
    _validateDeviceData(deviceData) {
        const required = ['name', 'ip', 'type'];
        const errors = [];

        // Required fields kontrolü
        required.forEach(field => {
            if (!deviceData[field] || deviceData[field].trim() === '') {
                errors.push(`${field} is required`);
            }
        });

        // IP format kontrolü
        if (deviceData.ip && !this._isValidIP(deviceData.ip)) {
            errors.push('Invalid IP address format');
        }

        // Duplicate IP kontrolü
        if (deviceData.ip && this.getDeviceByIP(deviceData.ip)) {
            errors.push('IP address already exists');
        }

        // Device type kontrolü
        const validTypes = ['cisco_ios', 'cisco_asa', 'mikrotik', 'ubuntu', 'windows', 'juniper'];
        if (deviceData.type && !validTypes.includes(deviceData.type)) {
            errors.push('Invalid device type');
        }

        return {
            valid: errors.length === 0,
            message: errors.join(', '),
            errors
        };
    }

    /**
     * IP adresi format kontrolü
     * @private
     */
    _isValidIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
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
                console.error('DeviceService listener error:', error);
            }
        });
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    /**
     * Cihaz tipine göre ikon al
     */
    getDeviceIcon(deviceType) {
        const icons = {
            'cisco_ios': '🔌',
            'cisco_asa': '🔥',
            'mikrotik': '📡',
            'ubuntu': '🐧',
            'windows': '🪟',
            'juniper': '🌿',
            'default': '📱'
        };
        return icons[deviceType] || icons.default;
    }

    /**
     * Cihaz tipine göre renk al
     */
    getDeviceColor(deviceType) {
        const colors = {
            'cisco_ios': '#1976d2',
            'cisco_asa': '#d32f2f',
            'mikrotik': '#388e3c',
            'ubuntu': '#ff9800',
            'windows': '#2196f3',
            'juniper': '#4caf50',
            'default': '#757575'
        };
        return colors[deviceType] || colors.default;
    }

    /**
     * Cihaz tipine göre açıklama al
     */
    getDeviceTypeDescription(deviceType) {
        const descriptions = {
            'cisco_ios': 'Cisco IOS Switch/Router',
            'cisco_asa': 'Cisco ASA Firewall',
            'mikrotik': 'MikroTik RouterOS',
            'ubuntu': 'Ubuntu Linux Server',
            'windows': 'Windows Server',
            'juniper': 'Juniper Network Device',
            'default': 'Network Device'
        };
        return descriptions[deviceType] || descriptions.default;
    }

    /**
     * Export devices to JSON
     */
    exportDevices() {
        const exportData = {
            devices: this.devices,
            exportDate: new Date().toISOString(),
            totalDevices: this.devices.length,
            stats: this.getDeviceStats()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devices-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        return {
            success: true,
            message: 'Devices exported successfully',
            filename: a.download
        };
    }

    /**
     * Import devices from JSON
     */
    async importDevices(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.devices || !Array.isArray(importData.devices)) {
                throw new Error('Invalid import file format');
            }

            const results = {
                success: 0,
                failed: 0,
                errors: []
            };

            for (const deviceData of importData.devices) {
                try {
                    const result = await this.addDevice(deviceData);
                    if (result.success) {
                        results.success++;
                    } else {
                        results.failed++;
                        results.errors.push(`${deviceData.name}: ${result.error}`);
                    }
                } catch (error) {
                    results.failed++;
                    results.errors.push(`${deviceData.name}: ${error.message}`);
                }
            }

            return {
                success: results.failed === 0,
                message: `Import completed: ${results.success} successful, ${results.failed} failed`,
                results
            };

        } catch (error) {
            console.error('DeviceService.importDevices:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cache temizle
     */
    clearCache() {
        this.devices = [];
        this._notifyListeners('cacheCleared', null);
    }

    /**
     * Service durumu
     */
    getStatus() {
        return {
            deviceCount: this.devices.length,
            listenerCount: this.listeners.size,
            lastUpdate: this.lastUpdate || null,
            isReady: this.devices.length > 0
        };
    }
}

// Global instance
const deviceService = new DeviceService(api);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeviceService, deviceService };
}