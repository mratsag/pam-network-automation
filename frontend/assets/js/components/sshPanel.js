/**
 * SSH Panel Component - SSH bağlantı paneli UI bileşeni
 * SOLID Principles: Single Responsibility, Dependency Inversion
 */

class SSHPanel {
    constructor(container, sshService, sessionService, eventBus) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.sshService = sshService;
        this.sessionService = sessionService;
        this.eventBus = eventBus;
        
        this.currentDevice = null;
        this.currentCredentials = null;
        this.isVisible = false;
        this.isConnecting = false;
        
        this.init();
    }

    /**
     * Panel'i başlat
     */
    init() {
        this.render();
        this.setupEventListeners();
        this.loadRecentConnections();
        
        // SSH service events'lerini dinle
        this.sshService.addEventListener((eventType, data) => {
            this.handleSSHEvent(eventType, data);
        });
    }

    /**
     * Panel HTML'ini oluştur
     */
    render() {
        this.container.innerHTML = `
            <div class="ssh-panel" id="sshPanelContent" style="display: none;">
                <!-- Panel Header -->
                <div class="panel-header">
                    <div class="panel-title">
                        <h2>🔌 SSH Bağlantı Paneli</h2>
                        <button class="btn btn-sm btn-danger panel-close" data-action="close">
                            ❌ Kapat
                        </button>
                    </div>
                </div>

                <!-- Device Info -->
                <div class="device-info-section" id="deviceInfoSection" style="display: none;">
                    <div class="device-info-card">
                        <div class="device-summary">
                            <div class="device-icon-large" id="deviceIconLarge">📱</div>
                            <div class="device-details-large">
                                <h3 id="selectedDeviceName">-</h3>
                                <div class="device-meta">
                                    <span id="selectedDeviceIP">-</span>
                                    <span class="separator">|</span>
                                    <span id="selectedDeviceType">-</span>
                                </div>
                                <div class="device-status-badge" id="deviceStatusBadge">
                                    <span class="status-dot"></span>
                                    <span class="status-text">Bağlantı Bekleniyor</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SSH Credentials Form -->
                <div class="credentials-section">
                    <h3>🔐 SSH Kimlik Bilgileri</h3>
                    
                    <!-- Recent Connections -->
                    <div class="recent-connections" id="recentConnections" style="display: none;">
                        <label>📋 Son Bağlantılar:</label>
                        <div class="recent-list" id="recentConnectionsList">
                            <!-- Recent connections will be populated here -->
                        </div>
                    </div>

                    <form id="sshCredentialsForm">
                        <input type="hidden" id="selectedDeviceId" value="">
                        
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="sshUsername">
                                    👤 Kullanıcı Adı:
                                    <span class="required">*</span>
                                </label>
                                <input type="text" 
                                       id="sshUsername" 
                                       name="username" 
                                       class="form-control" 
                                       required 
                                       placeholder="admin"
                                       autocomplete="username">
                                <div class="form-hint">SSH kullanıcı adını girin</div>
                            </div>

                            <div class="form-group">
                                <label for="sshPassword">
                                    🔑 Şifre:
                                    <span class="required">*</span>
                                </label>
                                <div class="password-input-group">
                                    <input type="password" 
                                           id="sshPassword" 
                                           name="password" 
                                           class="form-control" 
                                           required 
                                           placeholder="••••••••"
                                           autocomplete="current-password">
                                    <button type="button" class="password-toggle" data-action="toggle-password">
                                        👁️
                                    </button>
                                </div>
                                <div class="form-hint">SSH şifrenizi girin</div>
                            </div>

                            <div class="form-group">
                                <label for="sshPort">
                                    🔌 Port:
                                </label>
                                <input type="number" 
                                       id="sshPort" 
                                       name="port" 
                                       class="form-control" 
                                       value="22" 
                                       min="1" 
                                       max="65535">
                                <div class="form-hint">SSH port (varsayılan: 22)</div>
                            </div>
                        </div>

                        <!-- Advanced Options -->
                        <div class="advanced-options" id="advancedOptions" style="display: none;">
                            <h4>🔧 Gelişmiş Seçenekler</h4>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="saveCredentials" name="saveCredentials">
                                    💾 Kimlik bilgilerini hatırla (güvenli)
                                </label>
                            </div>

                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="autoConnect" name="autoConnect">
                                    ⚡ Otomatik bağlan
                                </label>
                            </div>

                            <div class="form-group">
                                <label for="connectionTimeout">⏱️ Bağlantı Zaman Aşımı (saniye):</label>
                                <input type="number" 
                                       id="connectionTimeout" 
                                       name="timeout" 
                                       class="form-control" 
                                       value="15" 
                                       min="5" 
                                       max="60">
                            </div>
                        </div>

                        <!-- Toggle Advanced -->
                        <div class="form-actions-secondary">
                            <button type="button" 
                                    class="btn btn-link btn-sm" 
                                    data-action="toggle-advanced">
                                🔧 Gelişmiş Seçenekler
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Action Buttons -->
                <div class="action-buttons">
                    <div class="primary-actions">
                        <button type="button" 
                                class="btn btn-success btn-lg connection-btn" 
                                data-action="test-connection"
                                id="testConnectionBtn">
                            <span class="btn-icon">🔗</span>
                            <span class="btn-text">Bağlantıyı Test Et</span>
                            <div class="btn-loading d-none">
                                <div class="loading-spinner-small"></div>
                            </div>
                        </button>
                    </div>

                    <div class="secondary-actions">
                        <button type="button" 
                                class="btn btn-info" 
                                data-action="quick-info">
                            📊 Hızlı Bilgi
                        </button>
                        <button type="button" 
                                class="btn btn-warning" 
                                data-action="health-check">
                            ❤️ Sağlık Kontrolü
                        </button>
                        <button type="button" 
                                class="btn btn-secondary" 
                                data-action="ping-test">
                            🏓 Ping Test
                        </button>
                    </div>
                </div>

                <!-- Results Section -->
                <div class="results-section" id="resultsSection" style="display: none;">
                    <div class="results-header">
                        <h3>📋 Bağlantı Sonuçları</h3>
                        <button type="button" 
                                class="btn btn-sm btn-secondary" 
                                data-action="clear-results">
                            🗑️ Temizle
                        </button>
                    </div>
                    <div class="results-content" id="resultsContent">
                        <!-- Results will be populated here -->
                    </div>
                </div>

                <!-- Terminal Launch Section -->
                <div class="terminal-section" id="terminalSection" style="display: none;">
                    <div class="terminal-launch-card">
                        <div class="terminal-info">
                            <h4>🖥️ SSH Terminal Hazır</h4>
                            <p>Bağlantı başarılı! SSH terminal'ini açabilirsiniz.</p>
                        </div>
                        <div class="terminal-actions">
                            <button type="button" 
                                    class="btn btn-success btn-lg" 
                                    data-action="open-terminal">
                                🖥️ Terminal Aç
                            </button>
                            <button type="button" 
                                    class="btn btn-info" 
                                    data-action="open-terminal-new-tab">
                                🗔 Yeni Sekmede Aç
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Connection History -->
                <div class="history-section" id="historySection" style="display: none;">
                    <h4>📜 Bağlantı Geçmişi</h4>
                    <div class="history-list" id="historyList">
                        <!-- History items will be populated here -->
                    </div>
                </div>
            </div>
        `;

        this.panelElement = this.container.querySelector('#sshPanelContent');
    }

    /**
     * Event listener'ları kur
     */
    setupEventListeners() {
        // Panel içindeki tüm action button'ları dinle
        this.container.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                this.handleAction(actionBtn.dataset.action, e);
            }
        });

        // Form submit
        const form = this.container.querySelector('#sshCredentialsForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAction('test-connection');
        });

        // Password toggle
        this.container.addEventListener('click', (e) => {
            if (e.target.matches('.password-toggle')) {
                this.togglePasswordVisibility();
            }
        });

        // Input validations
        this.setupInputValidation();
    }

    /**
     * Input validation kurulumu
     */
    setupInputValidation() {
        const usernameInput = this.container.querySelector('#sshUsername');
        const passwordInput = this.container.querySelector('#sshPassword');
        const portInput = this.container.querySelector('#sshPort');

        // Real-time validation
        usernameInput.addEventListener('input', () => {
            this.validateUsername(usernameInput.value);
        });

        passwordInput.addEventListener('input', () => {
            this.validatePassword(passwordInput.value);
        });

        portInput.addEventListener('input', () => {
            this.validatePort(portInput.value);
        });
    }

    /**
     * Panel'i aç ve cihazı set et
     */
    open(device) {
        this.currentDevice = device;
        this.updateDeviceInfo(device);
        this.show();
        this.loadDeviceHistory(device.id);
        this.fillCredentialsFromHistory(device);
        
        this.eventBus.emit('sshPanelOpened', { device });
    }

    /**
     * Panel'i göster
     */
    show() {
        this.panelElement.style.display = 'block';
        this.isVisible = true;
        
        // Smooth scroll to panel
        this.panelElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

        // Focus first input
        setTimeout(() => {
            const firstInput = this.container.querySelector('#sshUsername');
            if (firstInput) firstInput.focus();
        }, 300);
    }

    /**
     * Panel'i gizle
     */
    hide() {
        this.panelElement.style.display = 'none';
        this.isVisible = false;
        this.clearResults();
        this.currentDevice = null;
        this.currentCredentials = null;
        
        this.eventBus.emit('sshPanelClosed', {});
    }

    /**
     * Cihaz bilgilerini güncelle
     */
    updateDeviceInfo(device) {
        const deviceSection = this.container.querySelector('#deviceInfoSection');
        const deviceIcon = this.container.querySelector('#deviceIconLarge');
        const deviceName = this.container.querySelector('#selectedDeviceName');
        const deviceIP = this.container.querySelector('#selectedDeviceIP');
        const deviceType = this.container.querySelector('#selectedDeviceType');
        const deviceId = this.container.querySelector('#selectedDeviceId');

        if (deviceSection) deviceSection.style.display = 'block';
        if (deviceIcon) deviceIcon.textContent = this.getDeviceIcon(device.type);
        if (deviceName) deviceName.textContent = device.name;
        if (deviceIP) deviceIP.textContent = device.ip;
        if (deviceType) deviceType.textContent = device.type;
        if (deviceId) deviceId.value = device.id;
    }

    /**
     * Action'ları işle
     */
    async handleAction(action, event = null) {
        switch (action) {
            case 'close':
                this.hide();
                break;
                
            case 'test-connection':
                await this.testConnection();
                break;
                
            case 'quick-info':
                await this.getQuickInfo();
                break;
                
            case 'health-check':
                await this.performHealthCheck();
                break;
                
            case 'ping-test':
                await this.performPingTest();
                break;
                
            case 'open-terminal':
                this.openTerminal();
                break;
                
            case 'open-terminal-new-tab':
                this.openTerminalNewTab();
                break;
                
            case 'toggle-password':
                this.togglePasswordVisibility();
                break;
                
            case 'toggle-advanced':
                this.toggleAdvancedOptions();
                break;
                
            case 'clear-results':
                this.clearResults();
                break;

            case 'save-connection':
                this.saveConnectionToHistory();
                break;

            default:
                console.warn('Unknown action:', action);
        }
    }

    /**
     * SSH bağlantısını test et
     */
    async testConnection() {
        if (this.isConnecting) return;
        
        const credentials = this.getCredentials();
        if (!this.validateCredentials(credentials)) return;

        this.setConnectionState('connecting');
        
        try {
            const result = await this.sshService.testConnection(
                this.currentDevice.id, 
                credentials
            );

            if (result.success) {
                this.handleConnectionSuccess(result);
            } else {
                this.handleConnectionError(result);
            }
        } catch (error) {
            this.handleConnectionError({ error: error.message });
        } finally {
            this.setConnectionState('idle');
        }
    }

    /**
     * Bağlantı durumunu set et
     */
    setConnectionState(state) {
        const btn = this.container.querySelector('#testConnectionBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        
        this.isConnecting = state === 'connecting';
        
        switch (state) {
            case 'connecting':
                btn.disabled = true;
                btnText.textContent = 'Bağlanıyor...';
                btnLoading.classList.remove('d-none');
                break;
                
            case 'connected':
                btn.disabled = false;
                btnText.textContent = '✅ Bağlantı Başarılı';
                btnLoading.classList.add('d-none');
                btn.classList.remove('btn-success');
                btn.classList.add('btn-success');
                break;
                
            case 'error':
                btn.disabled = false;
                btnText.textContent = '❌ Tekrar Dene';
                btnLoading.classList.add('d-none');
                btn.classList.remove('btn-success');
                btn.classList.add('btn-danger');
                break;
                
            default: // idle
                btn.disabled = false;
                btnText.textContent = 'Bağlantıyı Test Et';
                btnLoading.classList.add('d-none');
                btn.classList.remove('btn-danger');
                btn.classList.add('btn-success');
        }
    }

    /**
     * Bağlantı başarılı durumu
     */
    handleConnectionSuccess(result) {
        this.setConnectionState('connected');
        this.currentCredentials = this.getCredentials();
        
        // Show results
        this.showResult({
            type: 'success',
            title: '✅ SSH Bağlantısı Başarılı!',
            content: `
                <div class="result-details">
                    <div class="detail-row">
                        <span class="label">Cihaz:</span>
                        <span class="value">${result.device.name} (${result.device.ip})</span>
                    </div>
                    ${result.testResults ? `
                    <div class="detail-row">
                        <span class="label">Test Sonuçları:</span>
                        <span class="value">${result.testResults.successful_tests}/${result.testResults.total_tests} başarılı</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="label">Bağlantı Zamanı:</span>
                        <span class="value">${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            `
        });

        // Show terminal section
        this.showTerminalSection();
        
        // Save to history
        this.saveConnectionToHistory();
        
        this.eventBus.emit('sshConnectionSuccess', { 
            device: this.currentDevice, 
            credentials: this.currentCredentials,
            result 
        });
    }

    /**
     * Bağlantı hatası durumu
     */
    handleConnectionError(result) {
        this.setConnectionState('error');
        
        this.showResult({
            type: 'error',
            title: '❌ SSH Bağlantısı Başarısız!',
            content: `
                <div class="error-details">
                    <div class="error-message">${result.error}</div>
                    <div class="error-suggestions">
                        <h5>Çözüm Önerileri:</h5>
                        <ul>
                            <li>Kullanıcı adı ve şifresini kontrol edin</li>
                            <li>Cihazın IP adresinin doğru olduğundan emin olun</li>
                            <li>SSH servisinin çalıştığını kontrol edin</li>
                            <li>Firewall ayarlarını kontrol edin</li>
                        </ul>
                    </div>
                </div>
            `
        });
        
        this.eventBus.emit('sshConnectionError', { 
            device: this.currentDevice, 
            result 
        });
    }

    /**
     * Sonuç göster
     */
    showResult(resultData) {
        const resultsSection = this.container.querySelector('#resultsSection');
        const resultsContent = this.container.querySelector('#resultsContent');
        
        const resultHTML = `
            <div class="result-item result-${resultData.type}">
                <div class="result-header">
                    <h4>${resultData.title}</h4>
                    <small class="result-timestamp">${new Date().toLocaleString()}</small>
                </div>
                <div class="result-content">
                    ${resultData.content}
                </div>
            </div>
        `;
        
        resultsContent.innerHTML = resultHTML;
        resultsSection.style.display = 'block';
        
        // Scroll to results
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    /**
     * Terminal bölümünü göster
     */
    showTerminalSection() {
        const terminalSection = this.container.querySelector('#terminalSection');
        terminalSection.style.display = 'block';
    }

    /**
     * Terminal aç (mevcut sekmede)
     */
    openTerminal() {
        if (!this.currentCredentials) {
            this.showError('Lütfen önce bağlantı testini yapın.');
            return;
        }

        // SSH session verilerini kaydet
        const sessionData = {
            deviceId: this.currentDevice.id,
            deviceName: this.currentDevice.name,
            deviceIP: this.currentDevice.ip,
            deviceType: this.currentDevice.type,
            username: this.currentCredentials.username,
            password: this.currentCredentials.password,
            port: this.currentCredentials.port,
            createdAt: new Date().toISOString()
        };

        // Session storage'a kaydet
        this.sessionService.setSSHSession(sessionData);

        // Terminal sayfasına yönlendir
        window.location.href = 'terminal.html';
    }

    /**
     * Terminal aç (yeni sekmede)
     */
    openTerminalNewTab() {
        if (!this.currentCredentials) {
            this.showError('Lütfen önce bağlantı testini yapın.');
            return;
        }

        // SSH session verilerini kaydet
        const sessionData = {
            deviceId: this.currentDevice.id,
            deviceName: this.currentDevice.name,
            deviceIP: this.currentDevice.ip,
            deviceType: this.currentDevice.type,
            username: this.currentCredentials.username,
            password: this.currentCredentials.password,
            port: this.currentCredentials.port,
            createdAt: new Date().toISOString()
        };

        // Session storage'a kaydet
        this.sessionService.setSSHSession(sessionData);

        // Yeni sekmede terminal aç
        window.open('terminal.html', '_blank');
    }

    /**
     * Şifre görünürlüğünü toggle et
     */
    togglePasswordVisibility() {
        const passwordInput = this.container.querySelector('#sshPassword');
        const toggleBtn = this.container.querySelector('.password-toggle');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    }

    /**
     * Gelişmiş seçenekleri toggle et
     */
    toggleAdvancedOptions() {
        const advancedOptions = this.container.querySelector('#advancedOptions');
        const toggleBtn = this.container.querySelector('[data-action="toggle-advanced"]');
        
        if (advancedOptions.style.display === 'none') {
            advancedOptions.style.display = 'block';
            toggleBtn.textContent = '🔼 Gelişmiş Seçenekleri Gizle';
        } else {
            advancedOptions.style.display = 'none';
            toggleBtn.textContent = '🔧 Gelişmiş Seçenekler';
        }
    }

    /**
     * Kimlik bilgilerini al
     */
    getCredentials() {
        const form = this.container.querySelector('#sshCredentialsForm');
        const formData = new FormData(form);
        
        return {
            username: formData.get('username'),
            password: formData.get('password'),
            port: parseInt(formData.get('port')) || 22,
            timeout: parseInt(formData.get('timeout')) || 15
        };
    }

    /**
     * Kimlik bilgilerini doğrula
     */
    validateCredentials(credentials) {
        const errors = [];

        if (!credentials.username?.trim()) {
            errors.push('Kullanıcı adı gerekli');
        }

        if (!credentials.password?.trim()) {
            errors.push('Şifre gerekli');
        }

        if (credentials.port < 1 || credentials.port > 65535) {
            errors.push('Port 1-65535 arasında olmalı');
        }

        if (errors.length > 0) {
            this.showError('Validasyon Hatası: ' + errors.join(', '));
            return false;
        }

        return true;
    }

    /**
     * Kullanıcı adını doğrula
     */
    validateUsername(username) {
        const input = this.container.querySelector('#sshUsername');
        const isValid = username && username.trim().length > 0;
        
        if (isValid) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
        
        return isValid;
    }

    /**
     * Şifreyi doğrula
     */
    validatePassword(password) {
        const input = this.container.querySelector('#sshPassword');
        const isValid = password && password.length > 0;
        
        if (isValid) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
        
        return isValid;
    }

    /**
     * Port'u doğrula
     */
    validatePort(port) {
        const input = this.container.querySelector('#sshPort');
        const portNum = parseInt(port);
        const isValid = portNum >= 1 && portNum <= 65535;
        
        if (isValid) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
        
        return isValid;
    }

    /**
     * Son bağlantıları yükle
     */
    loadRecentConnections() {
        const recent = this.sessionService.getRecentConnections();
        if (recent.length === 0) return;

        const recentSection = this.container.querySelector('#recentConnections');
        const recentList = this.container.querySelector('#recentConnectionsList');
        
        recentList.innerHTML = recent.slice(0, 5).map(conn => `
            <div class="recent-connection-item" data-device-id="${conn.deviceId}">
                <div class="recent-info">
                    <strong>${conn.deviceName}</strong>
                    <small>${conn.username}@${conn.deviceIP}:${conn.port}</small>
                </div>
                <button class="btn btn-sm btn-outline-primary" 
                        onclick="sshPanel.fillFromRecent('${JSON.stringify(conn).replace(/'/g, '\\\'')}')"}>
                    Kullan
                </button>
            </div>
        `).join('');
        
        recentSection.style.display = 'block';
    }

    /**
     * Son bağlantıdan doldur
     */
    fillFromRecent(connectionData) {
        const conn = typeof connectionData === 'string' ? JSON.parse(connectionData) : connectionData;
        
        this.container.querySelector('#sshUsername').value = conn.username;
        this.container.querySelector('#sshPort').value = conn.port;
        // Password'u güvenlik nedeniyle doldurmuyoruz
    }

    /**
     * Bağlantıyı geçmişe kaydet
     */
    saveConnectionToHistory() {
        if (!this.currentDevice || !this.currentCredentials) return;
        
        this.sessionService.addToRecentConnections(
            this.currentDevice, 
            this.currentCredentials
        );
    }

    /**
     * Sonuçları temizle
     */
    clearResults() {
        const resultsSection = this.container.querySelector('#resultsSection');
        const resultsContent = this.container.querySelector('#resultsContent');
        const terminalSection = this.container.querySelector('#terminalSection');
        
        resultsContent.innerHTML = '';
        resultsSection.style.display = 'none';
        terminalSection.style.display = 'none';
        
        this.setConnectionState('idle');
    }

    /**
     * SSH service event'lerini işle
     */
    handleSSHEvent(eventType, data) {
        switch (eventType) {
            case 'connectionSuccess':
                if (data.deviceId === this.currentDevice?.id) {
                    this.handleConnectionSuccess(data);
                }
                break;
                
            case 'connectionError':
                if (data.deviceId === this.currentDevice?.id) {
                    this.handleConnectionError(data);
                }
                break;
        }
    }

    /**
     * Hata göster
     */
    showError(message) {
        this.showResult({
            type: 'error',
            title: '⚠️ Hata',
            content: `<div class="error-message">${message}</div>`
        });
    }

    /**
     * Başarı mesajı göster
     */
    showSuccess(message) {
        this.showResult({
            type: 'success',
            title: '✅ Başarılı',
            content: `<div class="success-message">${message}</div>`
        });
    }

    /**
     * Cihaz ikonu al
     */
    getDeviceIcon(deviceType) {
        const icons = {
            'cisco_ios': '🔌',
            'cisco_asa': '🔥',
            'mikrotik': '📡',
            'ubuntu': '🐧',
            'windows': '🪟',
            'juniper': '🌿'
        };
        return icons[deviceType] || '📱';
    }

    /**
     * Panel durumu
     */
    getState() {
        return {
            isVisible: this.isVisible,
            isConnecting: this.isConnecting,
            currentDevice: this.currentDevice,
            hasCredentials: !!this.currentCredentials
        };
    }

    /**
     * Panel'i sıfırla
     */
    reset() {
        this.hide();
        this.currentDevice = null;
        this.currentCredentials = null;
        this.isConnecting = false;
        
        // Form'u temizle
        const form = this.container.querySelector('#sshCredentialsForm');
        if (form) form.reset();
        
        this.clearResults();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SSHPanel };
}