/**
 * Device Card Component - Cihaz kartı UI bileşeni
 * SOLID Principles: Single Responsibility, Open/Closed
 */

class DeviceCard {
    constructor(device, deviceService, eventBus) {
        this.device = device;
        this.deviceService = deviceService;
        this.eventBus = eventBus;
        this.element = null;
        this.isSelected = false;
    }

    /**
     * Kart HTML'ini oluştur
     */
    render() {
        const icon = this.deviceService.getDeviceIcon(this.device.type);
        const color = this.deviceService.getDeviceColor(this.device.type);
        const description = this.deviceService.getDeviceTypeDescription(this.device.type);
        const statusClass = this._getStatusClass();
        
        const cardHTML = `
            <div class="card device-card ${statusClass}" data-device-id="${this.device.id}">
                <div class="card-header">
                    <div class="device-header">
                        <div class="device-icon" style="color: ${color}">${icon}</div>
                        <div class="device-title">
                            <h3 class="device-name">${this.device.name}</h3>
                            <span class="device-subtitle">${description}</span>
                        </div>
                        <div class="device-status">
                            <div class="status-indicator ${this._getStatusIndicator()}"></div>
                        </div>
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="device-details">
                        <div class="detail-item">
                            <span class="detail-label">📍 IP Address:</span>
                            <span class="detail-value">${this.device.ip}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">🆔 Device ID:</span>
                            <span class="detail-value">#${this.device.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">🔧 Type:</span>
                            <span class="detail-value">${this.device.type}</span>
                        </div>
                        ${this.device.vault_path ? `
                        <div class="detail-item">
                            <span class="detail-label">🔐 Vault:</span>
                            <span class="detail-value vault-path">${this.device.vault_path}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="device-tags">
                        <span class="device-tag" style="background-color: ${color}20; color: ${color}; border-color: ${color}40;">
                            ${this.device.type}
                        </span>
                        ${this.device.vault_path ? '<span class="device-tag vault-tag">🔐 Vault</span>' : ''}
                    </div>
                </div>
                
                <div class="card-footer">
                    <div class="device-actions">
                        <button class="btn btn-primary device-action-btn" 
                                data-action="ssh-connect" 
                                title="SSH Bağlantısı Kur">
                            🔗 SSH Bağlan
                        </button>
                        <button class="btn btn-secondary device-action-btn" 
                                data-action="quick-test" 
                                title="Hızlı Bağlantı Testi">
                            ⚡ Test
                        </button>
                        <button class="btn btn-info device-action-btn" 
                                data-action="health-check" 
                                title="Sağlık Durumu Kontrolü">
                            ❤️ Health
                        </button>
                        <div class="dropdown device-dropdown">
                            <button class="btn btn-secondary dropdown-toggle" 
                                    data-action="more-options" 
                                    title="Diğer Seçenekler">
                                ⋮
                            </button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" data-action="edit-device">✏️ Düzenle</button>
                                <button class="dropdown-item" data-action="clone-device">📋 Kopyala</button>
                                <button class="dropdown-item" data-action="export-config">💾 Export</button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item text-danger" data-action="delete-device">🗑️ Sil</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="device-metadata">
                        <small class="text-muted">
                            Son güncelleme: ${this._formatDate(this.device.updated_at)}
                        </small>
                    </div>
                </div>
                
                <!-- Loading Overlay -->
                <div class="card-loading d-none">
                    <div class="loading-spinner"></div>
                    <span>İşlem yapılıyor...</span>
                </div>
                
                <!-- Selection Checkbox -->
                <div class="card-selection">
                    <input type="checkbox" class="selection-checkbox" value="${this.device.id}">
                </div>
            </div>
        `;

        // Create element
        const template = document.createElement('div');
        template.innerHTML = cardHTML;
        this.element = template.firstElementChild;
        
        // Setup event listeners
        this._setupEventListeners();
        
        return this.element;
    }

    /**
     * Event listener'ları kur
     * @private
     */
    _setupEventListeners() {
        if (!this.element) return;

        // Action button clicks
        this.element.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                const action = actionBtn.dataset.action;
                this._handleAction(action, e);
            }
        });

        // Card selection
        const checkbox = this.element.querySelector('.selection-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                this.setSelected(e.target.checked);
            });
        }

        // Card hover effects
        this.element.addEventListener('mouseenter', () => {
            this.element.classList.add('card-hover');
        });

        this.element.addEventListener('mouseleave', () => {
            this.element.classList.remove('card-hover');
        });

        // Double click to SSH connect
        this.element.addEventListener('dblclick', () => {
            this._handleAction('ssh-connect');
        });
    }

    /**
     * Action'ları işle
     * @private
     */
    _handleAction(action, event = null) {
        this.eventBus.emit('deviceAction', {
            action,
            device: this.device,
            element: this.element,
            event
        });

        // Visual feedback
        this._showActionFeedback(action);
    }

    /**
     * Action için visual feedback
     * @private
     */
    _showActionFeedback(action) {
        const actionNames = {
            'ssh-connect': '🔗 SSH Bağlanıyor...',
            'quick-test': '⚡ Test Ediliyor...',
            'health-check': '❤️ Kontrol Ediliyor...',
            'edit-device': '✏️ Düzenleniyor...',
            'delete-device': '🗑️ Siliniyor...'
        };

        if (actionNames[action]) {
            this.showLoading(actionNames[action]);
        }
    }

    /**
     * Kart güncellemesi
     */
    update(newDevice) {
        this.device = { ...this.device, ...newDevice };
        
        // Re-render specific parts
        this._updateDeviceDetails();
        this._updateDeviceStatus();
        
        this.eventBus.emit('deviceUpdated', {
            device: this.device,
            element: this.element
        });
    }

    /**
     * Device details güncelle
     * @private
     */
    _updateDeviceDetails() {
        const nameElement = this.element.querySelector('.device-name');
        const ipElement = this.element.querySelector('.detail-value');
        
        if (nameElement) nameElement.textContent = this.device.name;
        if (ipElement) ipElement.textContent = this.device.ip;
    }

    /**
     * Device status güncelle
     * @private
     */
    _updateDeviceStatus() {
        const statusIndicator = this.element.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${this._getStatusIndicator()}`;
        }
    }

    /**
     * Loading durumunu göster/gizle
     */
    showLoading(message = 'Yükleniyor...') {
        const loadingOverlay = this.element.querySelector('.card-loading');
        const loadingText = loadingOverlay.querySelector('span');
        
        loadingText.textContent = message;
        loadingOverlay.classList.remove('d-none');
        this.element.classList.add('card-processing');
    }

    hideLoading() {
        const loadingOverlay = this.element.querySelector('.card-loading');
        loadingOverlay.classList.add('d-none');
        this.element.classList.remove('card-processing');
    }

    /**
     * Kart seçimi
     */
    setSelected(selected) {
        this.isSelected = selected;
        const checkbox = this.element.querySelector('.selection-checkbox');
        
        if (checkbox) {
            checkbox.checked = selected;
        }
        
        if (selected) {
            this.element.classList.add('card-selected');
        } else {
            this.element.classList.remove('card-selected');
        }

        this.eventBus.emit('deviceSelectionChanged', {
            device: this.device,
            selected,
            element: this.element
        });
    }

    /**
     * Kart durumunu belirle
     * @private
     */
    _getStatusClass() {
        // Bu veri backend'den gelebilir veya son ping durumuna göre ayarlanabilir
        if (this.device.status === 'online') return 'card-online';
        if (this.device.status === 'offline') return 'card-offline';
        return 'card-unknown';
    }

    /**
     * Status indicator sınıfı
     * @private
     */
    _getStatusIndicator() {
        switch (this.device.status) {
            case 'online': return 'status-online';
            case 'offline': return 'status-offline';
            case 'warning': return 'status-warning';
            default: return 'status-unknown';
        }
    }

    /**
     * Tarih formatlama
     * @private
     */
    _formatDate(dateString) {
        if (!dateString) return 'Bilinmiyor';
        
        try {
            return new Date(dateString).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Geçersiz tarih';
        }
    }

    /**
     * Kartı DOM'dan kaldır
     */
    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.eventBus.emit('deviceRemoved', {
            device: this.device
        });
    }

    /**
     * Kart verisini al
     */
    getData() {
        return {
            device: this.device,
            isSelected: this.isSelected,
            element: this.element
        };
    }

    /**
     * CSS sınıfı ekle
     */
    addClass(className) {
        if (this.element) {
            this.element.classList.add(className);
        }
    }

    /**
     * CSS sınıfı kaldır
     */
    removeClass(className) {
        if (this.element) {
            this.element.classList.remove(className);
        }
    }

    /**
     * Animasyon efektleri
     */
    animate(animation) {
        if (!this.element) return;

        const animations = {
            shake: 'animate-shake',
            bounce: 'animate-bounce',
            pulse: 'animate-pulse',
            fadeIn: 'animate-fadeIn',
            slideIn: 'animate-slideIn'
        };

        const animationClass = animations[animation];
        if (animationClass) {
            this.element.classList.add(animationClass);
            
            // Remove animation class after animation completes
            setTimeout(() => {
                this.element.classList.remove(animationClass);
            }, 1000);
        }
    }
}

/**
 * Device Card Factory - Kart oluşturucu
 */
class DeviceCardFactory {
    constructor(deviceService, eventBus) {
        this.deviceService = deviceService;
        this.eventBus = eventBus;
    }

    /**
     * Yeni kart oluştur
     */
    createCard(device) {
        return new DeviceCard(device, this.deviceService, this.eventBus);
    }

    /**
     * Toplu kart oluştur
     */
    createCards(devices) {
        return devices.map(device => this.createCard(device));
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeviceCard, DeviceCardFactory };
}