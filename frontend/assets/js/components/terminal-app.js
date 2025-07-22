/**
 * Terminal Application Controller - SSH Terminal Ana Kontrolcü
 * SOLID Principles: Single Responsibility, Dependency Injection
 */

/**
 * Terminal API Client - Terminal için özel API client
 */
class TerminalAPIClient {
    constructor(baseURL = 'http://127.0.0.1:8000') {
        this.baseURL = baseURL;
        this.timeout = 30000; // 30 saniye
    }

    /**
     * HTTP request wrapper
     */
    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.timeout,
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log(`🌐 ${config.method} ${url}`, config.body ? { data: config.body } : '');
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'HTTP ' + response.status + ': ' + response.statusText);
            }

            const responseData = await response.json();
            
            console.log(`✅ ${config.method} ${url} - ${response.status}`, { 
                status: response.status,
                data: responseData 
            });
            
            return {
                success: true,
                status: response.status,
                data: responseData,
                response
            };

        } catch (error) {
            console.error(`❌ ${config.method} ${url}:`, error);
            
            return {
                success: false,
                status: 0,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data = null, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'POST', 
            body: data 
        });
    }

    /**
     * Terminal specific endpoints
     */
    async executeCommand(deviceId, credentials, command) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            command: command,
            port: credentials.port || 22
        };
        return await this.post(`/connections/execute/${deviceId}`, payload);
    }

    async executeMultipleCommands(deviceId, credentials, commands, delay = 1.0) {
        const payload = {
            device_id: deviceId,
            username: credentials.username,
            password: credentials.password,
            commands: commands,
            port: credentials.port || 22,
            delay: delay
        };
        return await this.post(`/connections/execute-multiple/${deviceId}`, payload);
    }

    async getAvailableCommands(deviceId) {
        return await this.get(`/connections/available-commands/${deviceId}`);
    }

    async healthCheck() {
        try {
            const result = await this.get('/health');
            return {
                healthy: result.success,
                ...result
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
}

/**
 * Terminal Session Service - Terminal için session yönetimi
 */
class TerminalSessionService {
    constructor() {
        this.storagePrefix = 'pam_terminal_';
        this.sessionKey = 'ssh_session';
        this.historyKey = 'command_history';
        this.preferencesKey = 'user_preferences';
    }

    setSSHSession(sessionData) {
        const data = {
            ...sessionData,
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId()
        };
        
        // Şifreyi encode et
        if (data.password) {
            data.password = btoa(data.password);
        }
        
        sessionStorage.setItem(this.storagePrefix + this.sessionKey, JSON.stringify(data));
        console.log('SSH session data saved:', { ...data, password: '***' });
        return true;
    }

    getSSHSession() {
        try {
            // URL parametrelerini kontrol et
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('deviceId')) {
                return {
                    deviceId: parseInt(urlParams.get('deviceId')),
                    deviceName: urlParams.get('deviceName') || 'Unknown Device',
                    deviceIP: urlParams.get('deviceIP') || 'unknown',
                    deviceType: urlParams.get('deviceType') || 'unknown',
                    username: urlParams.get('username'),
                    password: urlParams.get('password'),
                    port: parseInt(urlParams.get('port')) || 22
                };
            }

            // Session storage'dan al
            const data = sessionStorage.getItem(this.storagePrefix + this.sessionKey);
            if (!data) {
                // Fallback: ana session service'i kontrol et
                const fallbackData = sessionStorage.getItem('pam_ssh_session');
                if (fallbackData) {
                    const session = JSON.parse(fallbackData);
                    if (session.password) {
                        try {
                            session.password = atob(session.password);
                        } catch (e) {
                            console.warn('Failed to decode password');
                        }
                    }
                    return session;
                }
                return null;
            }
            
            const session = JSON.parse(data);
            
            // Şifreyi decode et
            if (session.password) {
                try {
                    session.password = atob(session.password);
                } catch (e) {
                    console.warn('Failed to decode SSH password');
                }
            }
            
            return session;
            
        } catch (error) {
            console.error('Get SSH session error:', error);
            return null;
        }
    }

    clearSSHSession() {
        sessionStorage.removeItem(this.storagePrefix + this.sessionKey);
        sessionStorage.removeItem('pam_ssh_session'); // Fallback'i de temizle
        console.log('SSH session data cleared');
    }

    generateSessionId() {
        return `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    addToCommandHistory(deviceId, command) {
        const historyKey = `${this.storagePrefix}${this.historyKey}_${deviceId}`;
        let history = this.getCommandHistory(deviceId) || [];
        
        const historyItem = {
            command,
            timestamp: new Date().toISOString(),
            deviceId: parseInt(deviceId)
        };
        
        history.unshift(historyItem);
        
        if (history.length > 100) {
            history = history.slice(0, 100);
        }
        
        sessionStorage.setItem(historyKey, JSON.stringify(history));
        return true;
    }

    getCommandHistory(deviceId) {
        try {
            const historyKey = `${this.storagePrefix}${this.historyKey}_${deviceId}`;
            const historyData = sessionStorage.getItem(historyKey);
            
            if (!historyData) return [];
            
            const history = JSON.parse(historyData);
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
            console.error('Get command history error:', error);
            return [];
        }
    }

    getUserPreferences() {
        try {
            const prefKey = `${this.storagePrefix}${this.preferencesKey}`;
            const prefData = sessionStorage.getItem(prefKey);
            
            const defaultPrefs = {
                terminalFontSize: 14,
                terminalFontFamily: 'Consolas, Monaco, monospace',
                theme: 'dark',
                autoScroll: true,
                soundEnabled: true,
                showQuickCommands: true
            };
            
            return prefData ? { ...defaultPrefs, ...JSON.parse(prefData) } : defaultPrefs;
            
        } catch (error) {
            console.error('Get user preferences error:', error);
            return {
                terminalFontSize: 14,
                terminalFontFamily: 'Consolas, Monaco, monospace',
                theme: 'dark',
                autoScroll: true,
                soundEnabled: true,
                showQuickCommands: true
            };
        }
    }

    setUserPreferences(preferences) {
        try {
            const prefKey = `${this.storagePrefix}${this.preferencesKey}`;
            const currentPrefs = this.getUserPreferences();
            
            const updatedPrefs = {
                ...currentPrefs,
                ...preferences,
                updatedAt: new Date().toISOString()
            };
            
            sessionStorage.setItem(prefKey, JSON.stringify(updatedPrefs));
            return true;
            
        } catch (error) {
            console.error('Set user preferences error:', error);
            return false;
        }
    }
}

/**
 * Terminal SSH Service - SSH işlemleri
 */
class TerminalSSHService {
    constructor(apiClient, sessionService) {
        this.api = apiClient;
        this.session = sessionService;
        this.listeners = new Set();
    }

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
                
                // Add to history
                this.session.addToCommandHistory(deviceId, command);
                
                return {
                    success: true,
                    ...commandResult
                };
            }
            
            throw new Error(result.data?.detail || result.error || 'Command execution failed');
            
        } catch (error) {
            console.error('SSH Command execution error:', error);
            this._notifyListeners('commandError', { deviceId, command, error: error.message });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

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
            console.error('Get available commands error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    addEventListener(callback) {
        this.listeners.add(callback);
    }

    removeEventListener(callback) {
        this.listeners.delete(callback);
    }

    _notifyListeners(eventType, data) {
        this.listeners.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('SSH Service listener error:', error);
            }
        });
    }
}

/**
 * Authentication Service - Kimlik doğrulama kontrolü
 */
class TerminalAuthService {
    constructor() {
        this.sessionKey = 'pam_user_session';
        this.sshSessionKey = 'pam_terminal_ssh_session';
    }

    /**
     * Kullanıcı oturum kontrolü
     */
    getUserSession() {
        try {
            const sessionData = sessionStorage.getItem(this.sessionKey);
            if (!sessionData) return null;

            const session = JSON.parse(sessionData);
            
            // Session süresini kontrol et
            if (new Date() > new Date(session.expiresAt)) {
                this.clearSession();
                return null;
            }

            return session;
        } catch (error) {
            console.error('Get session error:', error);
            return null;
        }
    }

    /**
     * SSH session verilerini al
     */
    getSSHSession() {
        if (this.sessionService) {
            return this.sessionService.getSSHSession();
        }
        
        // Fallback implementation
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('deviceId') && urlParams.has('username')) {
                return {
                    deviceId: parseInt(urlParams.get('deviceId')),
                    deviceName: urlParams.get('deviceName') || 'Unknown Device',
                    deviceIP: urlParams.get('deviceIP') || 'unknown',
                    deviceType: urlParams.get('deviceType') || 'unknown',
                    username: urlParams.get('username'),
                    password: urlParams.get('password') || '',
                    port: parseInt(urlParams.get('port')) || 22
                };
            }

            const sessionData = sessionStorage.getItem('pam_ssh_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                if (session.password) {
                    try {
                        session.password = atob(session.password);
                    } catch (e) {
                        console.warn('Failed to decode SSH password');
                    }
                }
                return session;
            }

            return null;
        } catch (error) {
            console.error('Get SSH session error:', error);
            return null;
        }
    }

    /**
     * Session temizle
     */
    clearSession() {
        sessionStorage.removeItem(this.sessionKey);
        sessionStorage.removeItem(this.sshSessionKey);
    }

    /**
     * Kimlik doğrulama kontrolü
     */
    isAuthenticated() {
        const userSession = this.getUserSession();
        const sshSession = this.getSSHSession();
        
        return !!userSession && !!sshSession;
    }

    /**
     * Yetki kontrolü
     */
    hasPermission(permission) {
        const session = this.getUserSession();
        if (!session) return false;

        return session.permissions.includes('all') || 
               session.permissions.includes(permission);
    }
}

/**
 * Terminal Application Controller
 */
class TerminalApplication {
    constructor() {
        this.authService = new TerminalAuthService();
        this.apiClient = null;
        this.sessionService = null;
        this.sshService = null;
        this.terminal = null;
        
        // Application state
        this.userSession = null;
        this.sshSession = null;
        this.isInitialized = false;
        this.sessionStartTime = null;
        this.commandCount = 0;
        this.lastActivity = new Date();
        
        // Settings
        this.settings = {
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, monospace',
            theme: 'dark',
            autoScroll: true,
            soundEnabled: true,
            showQuickCommands: true
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        console.log('🚀 Terminal Application - Initializing...');
        
        try {
            // Show auth check screen
            this.showAuthCheckScreen();
            
            // Check authentication
            if (!await this.checkAuthentication()) {
                return; // Authentication failed
            }
            
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize services
            await this.initializeServices();
            
            // Setup components
            await this.setupTerminalComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start monitoring
            this.startMonitoring();
            
            // Hide loading and show terminal
            this.showTerminalApp();
            
            this.isInitialized = true;
            console.log('✅ Terminal Application initialized successfully');
            
        } catch (error) {
            console.error('❌ Terminal initialization failed:', error);
            this.showError('Terminal başlatılamadı: ' + error.message);
        }
    }
    
    /**
     * Kimlik doğrulama kontrolü
     */
    async checkAuthentication() {
        try {
            document.getElementById('authCheckMessage').textContent = 'Kullanıcı kimliği kontrol ediliyor...';
            
            // User session kontrolü
            this.userSession = this.authService.getUserSession();
            if (!this.userSession) {
                throw new Error('Kullanıcı oturumu bulunamadı. Lütfen giriş yapın.');
            }
            
            document.getElementById('authCheckMessage').textContent = 'SSH session verisi kontrol ediliyor...';
            
            // SSH session kontrolü
            this.sshSession = this.authService.getSSHSession();
            if (!this.sshSession) {
                throw new Error('SSH session verisi bulunamadı. Ana sayfaya yönlendiriliyorsunuz...');
            }
            
            // Permission kontrolü
            if (!this.authService.hasPermission('network_read')) {
                throw new Error('SSH terminal erişim yetkiniz yok.');
            }
            
            document.getElementById('authCheckMessage').textContent = 'Kimlik doğrulama başarılı!';
            
            console.log('✅ Authentication successful:', {
                user: this.userSession.username,
                device: this.sshSession.deviceName
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            this.showAuthError(error.message);
            
            // Auto redirect after 5 seconds
            setTimeout(() => {
                if (error.message.includes('SSH session')) {
                    window.location.href = 'index.html';
                } else {
                    window.location.href = 'login.html';
                }
            }, 5000);
            
            return false;
        }
    }
    
    /**
     * Show auth check screen
     */
    showAuthCheckScreen() {
        document.getElementById('authCheckScreen').style.display = 'flex';
        document.getElementById('terminalLoading').classList.add('d-none');
        document.getElementById('terminalApp').classList.add('d-none');
    }
    
    /**
     * Show auth error
     */
    showAuthError(message) {
        const authError = document.getElementById('authError');
        const authErrorMessage = document.getElementById('authErrorMessage');
        
        authErrorMessage.textContent = message;
        authError.classList.remove('d-none');
    }
    
    /**
     * Show loading screen
     */
    showLoadingScreen() {
        document.getElementById('authCheckScreen').style.display = 'none';
        document.getElementById('terminalLoading').classList.remove('d-none');
        document.getElementById('terminalApp').classList.add('d-none');
        
        // Animate loading steps
        this.animateLoadingSteps();
    }
    
    /**
     * Animate loading steps
     */
    animateLoadingSteps() {
        const steps = ['step1', 'step2', 'step3'];
        let currentStep = 0;
        
        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                const stepElement = document.getElementById(steps[currentStep]);
                if (stepElement) {
                    stepElement.classList.add('active');
                }
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, 800);
    }
    
    /**
     * Show terminal app
     */
    showTerminalApp() {
        document.getElementById('authCheckScreen').style.display = 'none';
        document.getElementById('terminalLoading').classList.add('d-none');
        document.getElementById('terminalApp').classList.remove('d-none');
        
        // Focus terminal input
        setTimeout(() => {
            const input = document.getElementById('terminalInput');
            if (input) input.focus();
        }, 100);
    }
    
    /**
     * Initialize services
     */
    async initializeServices() {
        document.getElementById('loadingMessage').textContent = 'Servisler başlatılıyor...';
        
        try {
            // Create API client
            this.apiClient = new TerminalAPIClient();
            
            // Create session service
            this.sessionService = new TerminalSessionService();
            
            // Create SSH service
            this.sshService = new TerminalSSHService(this.apiClient, this.sessionService);
            
            // Load settings
            this.loadSettings();
            
            console.log('✅ Services initialized');
            
        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            throw new Error('Servisler başlatılamadı: ' + error.message);
        }
    }
    
    /**
     * Setup terminal components
     */
    async setupTerminalComponents() {
        document.getElementById('loadingMessage').textContent = 'Terminal bileşenleri hazırlanıyor...';
        
        try {
            // Create event bus
            this.eventBus = this.createEventBus();
            
            // Create terminal
            this.terminal = new Terminal(
                document.getElementById('terminalOutput').parentElement,
                this.sshService,
                this.sessionService,
                this.eventBus
            );
            
            // Setup terminal events
            this.setupTerminalEvents();
            
            // Update UI with session data
            this.updateSessionUI();
            
            console.log('✅ Terminal components ready');
            
        } catch (error) {
            console.error('❌ Terminal component setup failed:', error);
            throw new Error('Terminal bileşenleri hazırlanamadı: ' + error.message);
        }
    }
    
    /**
     * Setup terminal events
     */
    setupTerminalEvents() {
        this.eventBus.on('commandExecuted', (data) => {
            this.commandCount++;
            this.updateStatusBar();
            this.lastActivity = new Date();
            
            if (this.settings.soundEnabled) {
                this.playSound('command');
            }
        });
        
        this.eventBus.on('sessionStarted', (data) => {
            this.sessionStartTime = new Date();
            this.updateDeviceInfo(data.sessionData);
        });
        
        this.eventBus.on('connectionError', (data) => {
            this.showNotification('Bağlantı hatası: ' + data.error, 'error');
            this.updateConnectionStatus('error');
        });
    }
    
    /**
     * Update session UI
     */
    updateSessionUI() {
        if (!this.sshSession) return;
        
        // Update device info
        const deviceName = document.getElementById('deviceName');
        const deviceType = document.getElementById('deviceType');
        const connectionInfo = document.getElementById('connectionInfo');
        const terminalPrompt = document.getElementById('terminalPrompt');
        
        if (deviceName) {
            deviceName.textContent = this.sshSession.deviceName || 'Unknown Device';
        }
        
        if (deviceType) {
            deviceType.textContent = this.sshSession.deviceType || 'unknown';
        }
        
        if (connectionInfo) {
            connectionInfo.textContent = `${this.sshSession.username}@${this.sshSession.deviceIP}:${this.sshSession.port}`;
        }
        
        if (terminalPrompt) {
            terminalPrompt.textContent = `${this.sshSession.username}@${this.sshSession.deviceName || 'device'}:~$`;
        }
        
        // Update connection status
        this.updateConnectionStatus('connected');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Control buttons
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                this.handleControlAction(actionBtn.dataset.action);
            }
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalShortcuts(e);
        });
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.terminal && this.terminal.isConnected) {
                e.preventDefault();
                e.returnValue = 'SSH oturumunuz aktif. Sayfayı kapatmak istediğinizden emin misiniz?';
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.terminal) {
                this.terminal.resize();
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.terminal) {
                this.terminal.focusInput();
            }
        });
    }
    
    /**
     * Handle control actions
     */
    handleControlAction(action) {
        switch (action) {
            case 'clear':
                if (this.terminal) this.terminal.clearTerminal();
                break;
                
            case 'help':
                if (this.terminal) this.terminal.showHelpMessage();
                break;
                
            case 'save':
                this.saveSession();
                break;
                
            case 'settings':
                this.showSettingsModal();
                break;
                
            case 'new-tab':
                this.openNewTab();
                break;
                
            case 'disconnect':
                this.disconnect();
                break;
                
            default:
                console.warn('Unknown action:', action);
        }
    }
    
    /**
     * Handle global shortcuts
     */
    handleGlobalShortcuts(e) {
        // Ctrl+L: Clear terminal
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            if (this.terminal) this.terminal.clearTerminal();
        }
        
        // Ctrl+Shift+C: Copy selection
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            this.copySelection();
        }
        
        // Ctrl+Shift+V: Paste from clipboard
        if (e.ctrlKey && e.shiftKey && e.key === 'V') {
            e.preventDefault();
            this.pasteFromClipboard();
        }
        
        // F11: Toggle fullscreen
        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }
        
        // Ctrl+Plus/Minus: Font size
        if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            this.changeFontSize(1);
        } else if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            this.changeFontSize(-1);
        }
    }
    
    /**
     * Start monitoring
     */
    startMonitoring() {
        // Update session time every second
        setInterval(() => {
            this.updateSessionTime();
            this.updateLastActivity();
        }, 1000);
        
        // Update status bar every 5 seconds
        setInterval(() => {
            this.updateStatusBar();
        }, 5000);
    }
    
    /**
     * Update session time
     */
    updateSessionTime() {
        if (!this.sessionStartTime) return;
        
        const sessionTime = document.getElementById('sessionTime');
        const sessionDuration = document.getElementById('sessionDuration');
        
        const now = new Date();
        const diff = now - this.sessionStartTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const timeString = hours.toString().padStart(2, '0') + ':' + 
                          minutes.toString().padStart(2, '0') + ':' + 
                          seconds.toString().padStart(2, '0');
        
        if (sessionTime) {
            sessionTime.textContent = timeString;
        }
        
        if (sessionDuration) {
            sessionDuration.textContent = 'Session: ' + hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
        }
    }
    
    /**
     * Update last activity
     */
    updateLastActivity() {
        const lastActivity = document.getElementById('lastActivity');
        if (!lastActivity) return;
        
        const now = new Date();
        const diff = now - this.lastActivity;
        const minutes = Math.floor(diff / (1000 * 60));
        
        let activityText = 'Active';
        if (minutes > 0) {
            activityText = 'Idle: ' + minutes + 'm';
        }
        
        lastActivity.textContent = activityText;
    }
    
    /**
     * Update status bar
     */
    updateStatusBar() {
        const commandCount = document.getElementById('commandCount');
        const connectionQuality = document.getElementById('connectionQuality');
        
        if (commandCount) {
            commandCount.textContent = 'Commands: ' + this.commandCount;
        }
        
        if (connectionQuality) {
            const quality = Math.random() > 0.1 ? 'Stable' : 'Slow';
            const icon = Math.random() > 0.1 ? '🟢' : '🟡';
            connectionQuality.textContent = icon + ' ' + quality;
        }
    }
    
    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        const statusDot = document.getElementById('connectionStatus');
        if (!statusDot) return;
        
        const statusMap = {
            'connected': 'status-online',
            'connecting': 'status-warning',
            'error': 'status-offline',
            'disconnected': 'status-offline'
        };
        
        statusDot.className = 'status-dot ' + (statusMap[status] || 'status-unknown');
    }
    
    /**
     * Load settings
     */
    loadSettings() {
        const userPrefs = this.sessionService.getUserPreferences();
        this.settings = {
            ...this.settings,
            fontSize: userPrefs.terminalFontSize || 14,
            fontFamily: userPrefs.terminalFontFamily || 'Consolas, Monaco, monospace',
            theme: userPrefs.theme || 'dark',
            autoScroll: userPrefs.autoScroll !== false,
            soundEnabled: userPrefs.soundEnabled !== false,
            showQuickCommands: userPrefs.showQuickCommands !== false
        };
        
        this.applySettings();
    }
    
    /**
     * Apply settings
     */
    applySettings() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.style.fontSize = this.settings.fontSize + 'px';
            output.style.fontFamily = this.settings.fontFamily;
        }
        
        const input = document.getElementById('terminalInput');
        if (input) {
            input.style.fontSize = this.settings.fontSize + 'px';
            input.style.fontFamily = this.settings.fontFamily;
        }
        
        document.body.className = 'terminal-page theme-' + this.settings.theme;
        
        const quickCommands = document.getElementById('quickCommands');
        if (quickCommands) {
            quickCommands.style.display = this.settings.showQuickCommands ? 'block' : 'none';
        }
    }
    
    /**
     * Save session
     */
    saveSession() {
        const output = document.getElementById('terminalOutput');
        const sessionData = 'SSH Terminal Session Log\n' +
                           '========================\n' +
                           'Device: ' + (this.sshSession ? this.sshSession.deviceName : 'Unknown') + ' (' + (this.sshSession ? this.sshSession.deviceIP : 'unknown') + ')\n' +
                           'User: ' + (this.sshSession ? this.sshSession.username : 'unknown') + '\n' +
                           'Type: ' + (this.sshSession ? this.sshSession.deviceType : 'unknown') + '\n' +
                           'Session Time: ' + new Date().toLocaleString() + '\n\n' +
                           'Terminal Output:\n' +
                           (output ? output.textContent : '') + '\n\n' +
                           'Command History:\n' +
                           (this.terminal ? this.terminal.commandHistory.map((cmd, i) => (i + 1) + '. ' + cmd).join('\n') : '');
        
        const blob = new Blob([sessionData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ssh-session-' + (this.sshSession ? this.sshSession.deviceName : 'unknown') + '-' + new Date().toISOString().slice(0, 19) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Session kaydedildi!', 'success');
    }
    
    /**
     * Show settings modal
     */
    showSettingsModal() {
        this.showNotification('Settings modal coming soon...', 'info');
    }
    
    /**
     * Open new tab
     */
    openNewTab() {
        const url = window.location.href;
        window.open(url, '_blank');
    }
    
    
    /**
     * Copy selection
     */
    copySelection() {
        try {
            const selection = window.getSelection();
            if (selection.toString()) {
                navigator.clipboard.writeText(selection.toString());
                this.showNotification('Metin kopyalandı', 'success');
            }
        } catch (error) {
            console.warn('Copy failed:', error);
        }
    }
    
    /**
     * Paste from clipboard
     */
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            const input = document.getElementById('terminalInput');
            if (input) {
                input.value += text;
                input.focus();
            }
        } catch (error) {
            console.warn('Paste failed:', error);
        }
    }
    
    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Change font size
     */
    changeFontSize(delta) {
        this.settings.fontSize = Math.max(10, Math.min(24, this.settings.fontSize + delta));
        this.applySettings();
        this.sessionService.setUserPreferences({ terminalFontSize: this.settings.fontSize });
        this.showNotification('Font size: ' + this.settings.fontSize + 'px', 'info');
    }
    
    /**
     * Play sound
     */
    playSound(type) {
        if (!this.settings.soundEnabled) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = type === 'command' ? 800 : 400;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // Sound failed, ignore
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = 'notification notification-' + type;
        notification.style.cssText = `
            background: var(--terminal-bg-secondary); 
            border: 1px solid var(--terminal-border-primary); 
            color: var(--terminal-text-primary); 
            padding: 1rem; 
            margin-bottom: 0.5rem; 
            border-radius: 6px; 
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        notification.textContent = message;
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
        
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        
        container.appendChild(notification);
    }
    
    /**
     * Show error
     */
    showError(message) {
        console.error('Terminal Application Error:', message);
        this.showNotification(message, 'error');
        
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = message;
            loadingMessage.style.color = 'var(--terminal-accent-red)';
        }
    }
    
    /**
     * Create event bus
     */
    createEventBus() {
        const listeners = {};
        
        return {
            on: (event, callback) => {
                if (!listeners[event]) {
                    listeners[event] = [];
                }
                listeners[event].push(callback);
            },
            
            off: (event, callback) => {
                if (listeners[event]) {
                    listeners[event] = listeners[event].filter(cb => cb !== callback);
                }
            },
            
            emit: (event, data) => {
                if (listeners[event]) {
                    listeners[event].forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error('Event handler error:', error);
                        }
                    });
                }
            }
        };
    }
    
    /**
     * Update device info
     */
    updateDeviceInfo(sessionData) {
        if (!sessionData) return;
        
        const deviceName = document.getElementById('deviceName');
        const deviceType = document.getElementById('deviceType');
        const connectionInfo = document.getElementById('connectionInfo');
        const terminalPrompt = document.getElementById('terminalPrompt');
        
        if (deviceName) {
            deviceName.textContent = sessionData.deviceName || 'Unknown Device';
        }
        
        if (deviceType) {
            deviceType.textContent = sessionData.deviceType || 'unknown';
        }
        
        if (connectionInfo) {
            connectionInfo.textContent = sessionData.username + '@' + sessionData.deviceIP + ':' + sessionData.port;
        }
        
        if (terminalPrompt) {
            terminalPrompt.textContent = sessionData.username + '@' + (sessionData.deviceName || 'device') + ':~$';
                ;
        }
        
        this.updateConnectionStatus('connected');
    }
    
    /**
     * Get application state
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            userSession: this.userSession ? { ...this.userSession, password: '***' } : null,
            sshSession: this.sshSession ? { ...this.sshSession, password: '***' } : null,
            sessionStartTime: this.sessionStartTime,
            commandCount: this.commandCount,
            settings: this.settings,
            terminal: this.terminal ? this.terminal.getState() : null
        };
    }
    
    /**
     * Destroy application
     */
    destroy() {
        if (this.terminal) {
            this.terminal.destroy();
        }
        
        this.isInitialized = false;
        console.log('Terminal Application destroyed');
    }

    showCommandHistory() {
        if (this.terminal && typeof this.terminal.showCommandHistory === 'function') {
            this.terminal.showCommandHistory();
        } else {
            this.showError('Komut geçmişi fonksiyonu bulunamadı.');
        }
    }

    customizeQuickCommands() {
        if (this.terminal && typeof this.terminal.customizeQuickCommands === 'function') {
            this.terminal.customizeQuickCommands();
        } else {
            this.showError('Quick commands özelleştirme fonksiyonu bulunamadı.');
        }
    }

    toggleQuickCommands() {
        if (this.terminal && typeof this.terminal.toggleQuickCommands === 'function') {
            this.terminal.toggleQuickCommands();
        } else {
            this.showError('Quick commands göster/gizle fonksiyonu bulunamadı.');
        }
    }
}

/**
 * Global Application Instance and Initialization
 */

// Global terminal instance
let terminalApp;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Terminal Application...');
    
    // Create terminal application instance
    try {
        terminalApp = new TerminalApplication();
        
        // Make globally accessible for debugging and interaction
        window.terminal = terminalApp;
        window.terminalApp = terminalApp;
        
        console.log('✅ Terminal Application ready');
    } catch (error) {
        console.error('❌ Failed to initialize terminal:', error);
        
        // Show error message
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = 'Terminal başlatılamadı: ' + error.message;
            loadingMessage.style.color = 'var(--terminal-accent-red)';
        }
        
        const step3 = document.getElementById('step3');
        if (step3) {
            step3.classList.add('active');
            step3.style.color = 'var(--terminal-accent-red)';
            step3.textContent = '❌ Başlatma hatası: ' + error.message;
        }
    }
});

// Global error handling
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.terminalApp) {
        window.terminalApp.showError('Beklenmeyen hata: ' + event.reason.message);
    }
});

window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    
    if (window.terminalApp) {
        window.terminalApp.showError('Uygulama hatası: ' + e.error.message);
    }
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', function() {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log('🚀 Terminal page loaded in ' + loadTime + 'ms');
    });
}

// Service Worker Registration (Future enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/terminal-sw.js').then(console.log).catch(console.error);
    });
}

// CSS Animations for notifications
const notificationStyles = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.notification {
    transform: translateX(0);
    transition: all 0.3s ease;
}

.notification:hover {
    transform: translateX(-5px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4) !important;
}
`;

// Inject notification styles
if (!document.getElementById('terminal-notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'terminal-notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

console.log('📦 Terminal JavaScript modules loaded successfully');