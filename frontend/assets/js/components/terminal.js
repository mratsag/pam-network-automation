/**
 * PAM Network Terminal Application
 * Complete SSH Terminal with Backend Integration
 * Version: 1.0.0
 */

/**
 * API Client - Backend ile iletişim
 */
class APIClient {
    constructor(baseURL = 'http://localhost:8000') {
        this.baseURL = baseURL;
        this.timeout = 30000;
    }

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
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'HTTP ' + response.status + ': ' + response.statusText);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed: ' + endpoint, error);
            throw error;
        }
    }

    async getDevices() {
        return this.request('/devices');
    }

    async getDevice(deviceId) {
        return this.request('/devices/' + deviceId);
    }

    async testConnection(deviceId, credentials) {
        return this.request('/connections/test/' + deviceId, {
            method: 'POST',
            body: credentials
        });
    }

    async executeCommand(deviceId, credentials, command) {
        return this.request('/connections/execute/' + deviceId, {
            method: 'POST',
            body: { ...credentials, command }
        });
    }

    async executeMultipleCommands(deviceId, credentials, commands) {
        return this.request('/connections/execute-multiple/' + deviceId, {
            method: 'POST',
            body: { ...credentials, commands }
        });
    }

    async healthCheck(deviceId, credentials) {
        return this.request('/connections/health-check/' + deviceId, {
            method: 'POST',
            body: credentials
        });
    }

    async getAvailableCommands(deviceId) {
        return this.request('/connections/available-commands/' + deviceId);
    }

    async getQuickInfo(deviceId, credentials) {
        return this.request('/connections/quick-info/' + deviceId, {
            method: 'POST',
            body: credentials
        });
    }
}

/**
 * Session Service - Oturum ve veri yönetimi
 */
// SessionService sınıfı bu dosyadan kaldırıldı. Artık services/sessionService.js kullanılacak.

/**
 * SSH Service - SSH işlemleri
 */
class SSHService {
    constructor(apiClient, sessionService) {
        this.api = apiClient;
        this.sessionService = sessionService;
        this.connectionCache = new Map();
    }

    async testConnection(deviceId, credentials) {
        try {
            const result = await this.api.testConnection(deviceId, credentials);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeCommand(deviceId, credentials, command) {
        try {
            const result = await this.api.executeCommand(deviceId, credentials, command);
            this.sessionService.addToCommandHistory(deviceId, command);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeMultipleCommands(deviceId, credentials, commands) {
        try {
            const result = await this.api.executeMultipleCommands(deviceId, credentials, commands);
            commands.forEach(cmd => {
                this.sessionService.addToCommandHistory(deviceId, cmd);
            });
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAvailableCommands(deviceId) {
        try {
            const result = await this.api.getAvailableCommands(deviceId);
            return { success: true, commands: result.available_commands };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async healthCheck(deviceId, credentials) {
        try {
            const result = await this.api.healthCheck(deviceId, credentials);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

/**
 * Event Bus - Component'lar arası iletişim
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('EventBus error in ' + event + ':', error);
                }
            });
        }
    }
}

/**
 * Terminal Component - SSH Terminal UI bileşeni
 */
class Terminal {
    constructor(container, sshService, sessionService, eventBus) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.sshService = sshService;
        this.sessionService = sessionService;
        this.eventBus = eventBus;
        
        this.sessionData = null;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.isConnected = false;
        this.isExecuting = false;
        this.quickCommands = [];
        
        this.init();
    }

    async init() {
        await this.loadSession();
        this.setupEventListeners();
        await this.loadQuickCommands();
        this.showWelcomeMessage();
        this.focusInput();
        
        console.log('Terminal initialized');
        this.eventBus.emit('sessionStarted', { sessionData: this.sessionData });
    }

    async loadSession() {
        this.sessionData = this.sessionService.getSSHSession();
        
        if (!this.sessionData) {
            this.showError('Session verisi bulunamadı. Ana sayfaya yönlendiriliyorsunuz...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        this.isConnected = true;
        this.commandHistory = this.sessionService.getCommandHistory(this.sessionData.deviceId) || [];
        this.historyIndex = this.commandHistory.length;
    }

    setupEventListeners() {
        const input = document.getElementById('terminalInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (!input || !sendBtn) {
            console.error('Terminal input elements not found');
            return;
        }
        
        input.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        sendBtn.addEventListener('click', () => {
            this.sendCommand();
        });
        
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                this.handleControlAction(actionBtn.dataset.action);
            }
            
            const quickCmd = e.target.closest('[data-command]');
            if (quickCmd) {
                this.insertCommand(quickCmd.dataset.command);
            }
        });
        
        const terminalOutput = document.getElementById('terminalOutput');
        if (terminalOutput) {
            terminalOutput.addEventListener('click', () => {
                this.focusInput();
            });
        }
    }

    handleKeyDown(e) {
        const input = e.target;
        
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.sendCommand();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory('up');
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory('down');
                break;
                
            case 'Tab':
                e.preventDefault();
                this.handleTabCompletion();
                break;
                
            case 'Escape':
                input.value = '';
                break;
                
            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.clearTerminal();
                }
                break;
        }
    }

    async sendCommand() {
        const input = document.getElementById('terminalInput');
        if (!input) return;
        
        const command = input.value.trim();
        
        if (!command || this.isExecuting) return;
        
        if (command !== this.commandHistory[this.commandHistory.length - 1]) {
            this.commandHistory.push(command);
            this.sessionService.addToCommandHistory(this.sessionData.deviceId, command);
        }
        this.historyIndex = this.commandHistory.length;
        
        input.value = '';
        
        if (await this.handleBuiltInCommand(command)) {
            return;
        }
        
        await this.executeRemoteCommand(command);
        this.eventBus.emit('commandExecuted', { command, sessionData: this.sessionData });
    }

    async handleBuiltInCommand(command) {
        const cmd = command.toLowerCase().trim();
        
        switch (cmd) {
            case 'clear':
            case 'cls':
                this.clearTerminal();
                return true;
                
            case 'help':
                this.showHelpMessage();
                return true;
                
            case 'history':
                this.showCommandHistory();
                return true;
                
            case 'exit':
            case 'quit':
                this.disconnect();
                return true;
                
            case 'whoami':
                this.appendOutput({
                    command: command,
                    success: true,
                    output: this.sessionData ? this.sessionData.username : 'unknown',
                    local: true
                });
                return true;
                
            case 'pwd':
                this.appendOutput({
                    command: command,
                    success: true,
                    output: '~',
                    local: true
                });
                return true;
                
            default:
                return false;
        }
    }

    async executeRemoteCommand(command) {
        this.setExecutionState(true);
        
        this.appendOutput({
            command: command,
            executing: true
        });
        
        const credentials = {
            username: this.sessionData.username,
            password: this.sessionData.password,
            port: this.sessionData.port
        };
        
        try {
            const result = await this.sshService.executeCommand(
                this.sessionData.deviceId,
                credentials,
                command
            );
            
            this.removeLastOutput();
            
            if (result.success) {
                const stdout = (result.result && result.result.result && result.result.result.stdout) || 
                               (result.result && result.result.stdout) || '';
                const stderr = (result.result && result.result.result && result.result.result.stderr) || 
                               (result.result && result.result.stderr) || '';
                const execTime = (result.result && result.result.result && result.result.result.execution_time) || 
                                (result.result && result.result.execution_time) || 0;
                
                this.appendOutput({
                    command: command,
                    success: true,
                    output: stdout,
                    error: stderr,
                    executionTime: execTime
                });
            } else {
                this.appendOutput({
                    command: command,
                    success: false,
                    error: result.error || 'Command execution failed',
                    executionTime: 0
                });
            }
        } catch (error) {
            this.removeLastOutput();
            
            this.appendOutput({
                command: command,
                success: false,
                error: error.message,
                executionTime: 0
            });
            
            this.eventBus.emit('connectionError', { error: error.message });
        } finally {
            this.setExecutionState(false);
        }
    }

    appendOutput(data) {
        const output = document.getElementById('terminalOutput');
        if (!output) return;
        
        const outputElement = this.createOutputElement(data);
        output.appendChild(outputElement);
        this.scrollToBottom();
    }

    removeLastOutput() {
        const output = document.getElementById('terminalOutput');
        if (!output) return;
        
        const lastChild = output.lastElementChild;
        if (lastChild) {
            lastChild.remove();
        }
    }

    createOutputElement(data) {
        const div = document.createElement('div');
        div.className = 'command-output';
        
        if (data.executing) {
            div.innerHTML = '<div class="command-header">' + this.getPrompt() + ' ' + data.command + '</div>' +
                           '<div class="command-timestamp">' + new Date().toLocaleString() + '</div>' +
                           '<div class="command-result loading">Executing...</div>';
        } else {
            const resultClass = data.local ? 'local-command' : 
                               data.success ? 'command-success' : 'command-error';
            
            let html = '<div class="command-header">' + this.getPrompt() + ' ' + data.command + '</div>' +
                      '<div class="command-timestamp">' + new Date().toLocaleString() + '</div>' +
                      '<div class="command-result ' + resultClass + '">';
            
            if (data.output) {
                html += '<div class="command-output-text">' + this.escapeHtml(data.output) + '</div>';
            }
            
            if (data.error) {
                html += '<div class="command-error-text">' + this.escapeHtml(data.error) + '</div>';
            }
            
            if (data.executionTime !== undefined) {
                html += '<div class="execution-stats">' +
                       '<span class="stat-item">' +
                       '<span class="' + (data.success ? 'success-icon' : 'error-icon') + '">' +
                       (data.success ? 'OK' : 'ERR') +
                       '</span>' +
                       'Execution time: ' + data.executionTime + 's' +
                       '</span>' +
                       '</div>';
            }
            
            html += '</div>';
            div.innerHTML = html;
        }
        
        div.style.opacity = '0';
        div.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            div.style.transition = 'all 0.3s ease';
            div.style.opacity = '1';
            div.style.transform = 'translateY(0)';
        }, 10);
        
        return div;
    }

    navigateHistory(direction) {
        const input = document.getElementById('terminalInput');
        if (!input) return;
        
        if (direction === 'up' && this.historyIndex > 0) {
            this.historyIndex--;
            input.value = this.commandHistory[this.historyIndex];
        } else if (direction === 'down') {
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
                input.value = this.commandHistory[this.historyIndex];
            } else {
                this.historyIndex = this.commandHistory.length;
                input.value = '';
            }
        }
        
        setTimeout(() => {
            input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
    }

    handleTabCompletion() {
        const input = document.getElementById('terminalInput');
        if (!input) return;
        
        const currentValue = input.value;
        
        const suggestions = this.quickCommands
            .filter(cmd => cmd.startsWith(currentValue))
            .slice(0, 5);
        
        if (suggestions.length === 1) {
            input.value = suggestions[0];
        } else if (suggestions.length > 1) {
            this.showTabSuggestions(suggestions);
        }
    }

    showTabSuggestions(suggestions) {
        this.appendOutput({
            command: 'tab-completion',
            success: true,
            output: 'Available commands:\n' + suggestions.join('  '),
            local: true
        });
    }

    handleControlAction(action) {
        switch (action) {
            case 'clear':
                this.clearTerminal();
                break;
                
            case 'help':
                this.showHelpMessage();
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
        }
    }

    clearTerminal() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.innerHTML = '';
        }
        this.showWelcomeMessage();
        this.focusInput();
    }

    showWelcomeMessage() {
        const welcomeMsg = {
            command: 'system-message',
            success: true,
            output: 'PAM SSH Terminal v1.0\n' +
                   '================================\n\n' +
                   'Connected to: ' + (this.sessionData ? this.sessionData.deviceName : 'Unknown Device') + '\n' +
                   'User: ' + (this.sessionData ? this.sessionData.username : 'unknown') + '\n' +
                   'Host: ' + (this.sessionData ? this.sessionData.deviceIP : 'unknown') + ':' + (this.sessionData ? this.sessionData.port : 22) + '\n' +
                   'Type: ' + (this.sessionData ? this.sessionData.deviceType : 'unknown') + '\n' +
                   'Session started: ' + new Date().toLocaleString() + '\n\n' +
                   'Tips:\n' +
                   '• Use arrow keys to navigate command history\n' +
                   '• Press Tab for command completion\n' +
                   '• Type \'help\' for available commands\n' +
                   '• Type \'clear\' to clear the screen\n' +
                   '• Use Ctrl+L as shortcut for clear',
            local: true
        };
        
        this.appendOutput(welcomeMsg);
    }

    showHelpMessage() {
        const helpMsg = {
            command: 'help',
            success: true,
            output: 'SSH Terminal Help\n' +
                   '==================\n\n' +
                   'Built-in Commands:\n' +
                   '• help      - Show this help message\n' +
                   '• clear     - Clear the terminal screen\n' +
                   '• history   - Show command history\n' +
                   '• exit      - Disconnect and close terminal\n' +
                   '• whoami    - Show current username\n' +
                   '• pwd       - Show current directory\n\n' +
                   'Keyboard Shortcuts:\n' +
                   '• Arrow Up/Down  - Navigate command history\n' +
                   '• Tab            - Command completion\n' +
                   '• Ctrl+L         - Clear screen\n' +
                   '• Enter          - Execute command\n' +
                   '• Esc            - Clear input\n\n' +
                   'Device Commands:\n' +
                   '• All other commands are executed on the remote device\n' +
                   '• Use quick command buttons below for common operations',
            local: true
        };
        
        this.appendOutput(helpMsg);
    }

    showCommandHistory() {
        if (this.commandHistory.length === 0) {
            this.appendOutput({
                command: 'history',
                success: true,
                output: 'No commands in history yet.',
                local: true
            });
            return;
        }
        
        const historyOutput = this.commandHistory
            .map((cmd, index) => (index + 1).toString().padStart(3) + ': ' + cmd)
            .join('\n');
        
        this.appendOutput({
            command: 'history',
            success: true,
            output: 'Command History (' + this.commandHistory.length + ' commands):\n' + historyOutput,
            local: true
        });
    }

    async loadQuickCommands() {
        if (!this.sessionData || !this.sessionData.deviceId) return;
        
        try {
            const result = await this.sshService.getAvailableCommands(this.sessionData.deviceId);
            
            if (result.success && result.commands) {
                this.quickCommands = Object.values(result.commands);
                this.updateQuickCommandsUI();
            }
        } catch (error) {
            console.warn('Failed to load quick commands:', error);
            
            const defaultCommands = this.getDefaultCommands(this.sessionData ? this.sessionData.deviceType : null);
            this.quickCommands = defaultCommands;
            this.updateQuickCommandsUI();
        }
    }

    getDefaultCommands(deviceType) {
        const commandMap = {
            'cisco_ios': ['show version', 'show ip int brief', 'show running-config'],
            'mikrotik': ['/system resource print', '/interface print', '/ip address print'],
            'ubuntu': ['ls -la', 'ps aux', 'df -h', 'free -m'],
            'windows': ['dir', 'ipconfig', 'tasklist']
        };
        
        return commandMap[deviceType] || ['help', 'whoami', 'pwd'];
    }

    updateQuickCommandsUI() {
        const quickCommandsList = document.getElementById('quickCommandsList');
        if (!quickCommandsList) return;
        
        const existingCmds = quickCommandsList.querySelectorAll('.quick-cmd:not([data-command="help"]):not([data-command="clear"]):not([data-command="whoami"]):not([data-command="pwd"])');
        existingCmds.forEach(cmd => cmd.remove());
        
        this.quickCommands.slice(0, 6).forEach(command => {
            if (!['help', 'clear', 'whoami', 'pwd'].includes(command)) {
                const cmdElement = document.createElement('div');
                cmdElement.className = 'quick-cmd';
                cmdElement.dataset.command = command;
                cmdElement.textContent = command.length > 15 ? command.substring(0, 15) + '...' : command;
                cmdElement.title = command;
                
                quickCommandsList.appendChild(cmdElement);
            }
        });
    }

    insertCommand(command) {
        const input = document.getElementById('terminalInput');
        if (!input) return;
        
        input.value = command;
        input.focus();
        input.setSelectionRange(command.length, command.length);
    }

    setExecutionState(executing) {
        this.isExecuting = executing;
        
        const sendBtn = document.getElementById('sendBtn');
        const sendIcon = sendBtn ? sendBtn.querySelector('.send-icon') : null;
        const sendLoading = sendBtn ? sendBtn.querySelector('.send-loading') : null;
        const input = document.getElementById('terminalInput');
        
        if (executing) {
            if (sendBtn) sendBtn.disabled = true;
            if (input) input.disabled = true;
            if (sendIcon) sendIcon.classList.add('d-none');
            if (sendLoading) sendLoading.classList.remove('d-none');
        } else {
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.disabled = false;
            if (sendIcon) sendIcon.classList.remove('d-none');
            if (sendLoading) sendLoading.classList.add('d-none');
        }
    }

    saveSession() {
        const output = document.getElementById('terminalOutput');
        const sessionData = 'SSH Terminal Session Log\n' +
                           '========================\n' +
                           'Device: ' + (this.sessionData ? this.sessionData.deviceName : 'Unknown') + ' (' + (this.sessionData ? this.sessionData.deviceIP : 'unknown') + ')\n' +
                           'User: ' + (this.sessionData ? this.sessionData.username : 'unknown') + '\n' +
                           'Type: ' + (this.sessionData ? this.sessionData.deviceType : 'unknown') + '\n' +
                           'Session Time: ' + new Date().toLocaleString() + '\n\n' +
                           'Terminal Output:\n' +
                           (output ? output.textContent : '') + '\n\n' +
                           'Command History:\n' +
                           this.commandHistory.map((cmd, i) => (i + 1) + '. ' + cmd).join('\n');
        
        const blob = new Blob([sessionData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ssh-session-' + (this.sessionData ? this.sessionData.deviceName : 'unknown') + '-' + new Date().toISOString().slice(0, 19) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        
        this.showSuccessMessage('Session kaydedildi!');
    }

    showSettingsModal() {
        this.showSuccessMessage('Settings modal coming soon...');
    }

    openNewTab() {
        const url = window.location.href;
        window.open(url, '_blank');
    }

    disconnect() {
        if (confirm('SSH oturumunu sonlandırmak istediğinizden emin misiniz?')) {
            this.isConnected = false;
            this.sessionService.clearSSHSession();
            this.updateConnectionStatus(false);
            
            this.appendOutput({
                command: 'disconnect',
                success: true,
                output: 'SSH oturumu sonlandırıldı.\nAna sayfaya yönlendiriliyorsunuz...',
                local: true
            });
            
            setTimeout(() => {
                if (window.opener) {
                    window.close();
                } else {
                    window.location.href = 'index.html';
                }
            }, 2000);
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        
        if (statusDot) {
            if (connected) {
                statusDot.className = 'status-dot status-online';
            } else {
                statusDot.className = 'status-dot status-offline';
            }
        }
    }

    focusInput() {
        const input = document.getElementById('terminalInput');
        if (input && !input.disabled) {
            input.focus();
        }
    }

    scrollToBottom() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.scrollTop = output.scrollHeight;
        }
    }

    getPrompt() {
        return (this.sessionData ? this.sessionData.username : 'user') + '@' + (this.sessionData ? this.sessionData.deviceName : 'device') + ':~$';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.appendOutput({
            command: 'error',
            success: false,
            error: message,
            local: true
        });
    }

    showSuccessMessage(message) {
        this.appendOutput({
            command: 'success',
            success: true,
            output: 'OK: ' + message,
            local: true
        });
    }

    getState() {
        return {
            isConnected: this.isConnected,
            isExecuting: this.isExecuting,
            sessionData: this.sessionData ? { ...this.sessionData, password: '***' } : null,
            commandHistoryCount: this.commandHistory.length,
            quickCommandsCount: this.quickCommands.length
        };
    }

    resize() {
        this.scrollToBottom();
    }

    toggleQuickCommands() {
        const quickCommands = document.getElementById('quickCommands');
        if (quickCommands) {
            const isVisible = quickCommands.style.display !== 'none';
            quickCommands.style.display = isVisible ? 'none' : 'block';
        }
    }

    customizeQuickCommands() {
        this.showSuccessMessage('Quick commands customization coming soon...');
    }

    destroy() {
        this.isConnected = false;
        this.sessionService.clearSSHSession();
        console.log('Terminal destroyed');
    }
}

/**
 * Terminal Application Controller
 */


/**
 * Terminal Factory
 */
class TerminalFactory {
    static createTerminal(container, sshService, sessionService, eventBus) {
        return new Terminal(container, sshService, sessionService, eventBus);
    }
    
    static createFullPageTerminal(sshService, sessionService, eventBus) {
        document.body.className = 'terminal-page';
        return new Terminal(document.body, sshService, sessionService, eventBus);
    }
}


const styleSheet = document.createElement('style');
document.head.appendChild(styleSheet);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        Terminal, 
        TerminalFactory, 
        TerminalApplication,
        APIClient,
        SessionService,
        SSHService,
        EventBus
    };
}

// Global error handling
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.terminalApp) {
        window.terminalApp.showError('Beklenmeyen hata: ' + event.reason.message);
    }
});

console.log('Terminal JavaScript modules loaded successfully');