/**
 * API Client - HTTP istekleri için merkezi sınıf
 * SOLID Principles: Single Responsibility, Open/Closed
 */

class ApiClient {
    constructor(baseURL = 'http://127.0.0.1:8000') {
        this.baseURL = baseURL;
        this.timeout = 30000; // 30 saniye
    }

    /**
     * HTTP GET isteği
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    async get(endpoint, options = {}) {
        return this._request('GET', endpoint, null, options);
    }

    /**
     * HTTP POST isteği
     * @param {string} endpoint 
     * @param {Object} data 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    async post(endpoint, data = null, options = {}) {
        return this._request('POST', endpoint, data, options);
    }

    /**
     * HTTP PUT isteği
     * @param {string} endpoint 
     * @param {Object} data 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    async put(endpoint, data = null, options = {}) {
        return this._request('PUT', endpoint, data, options);
    }

    /**
     * HTTP DELETE isteği
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    async delete(endpoint, options = {}) {
        return this._request('DELETE', endpoint, null, options);
    }

    /**
     * Merkezi HTTP istek fonksiyonu
     * @private
     */
    async _request(method, endpoint, data, options) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // POST/PUT istekleri için body ekle
        if (data && ['POST', 'PUT'].includes(method)) {
            config.body = JSON.stringify(data);
        }

        // Timeout kontrolü
        const timeoutId = setTimeout(() => {
            throw new Error(`Request timeout after ${this.timeout}ms`);
        }, this.timeout);

        try {
            console.log(`🌐 ${method} ${url}`, data ? { data } : '');
            
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            
            // Response kontrolü
            const responseData = await this._handleResponse(response);
            
            console.log(`✅ ${method} ${url} - ${response.status}`, { 
                status: response.status,
                data: responseData 
            });
            
            return {
                success: response.ok,
                status: response.status,
                data: responseData,
                response
            };

        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`❌ ${method} ${url}:`, error);
            
            return {
                success: false,
                status: 0,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Response işleme
     * @private
     */
    async _handleResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Base URL'i değiştir
     */
    setBaseURL(url) {
        this.baseURL = url;
    }

    /**
     * Timeout süresini değiştir
     */
    setTimeout(ms) {
        this.timeout = ms;
    }

    /**
     * Sağlık kontrolü
     */
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

// Global instance
const apiClient = new ApiClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, apiClient };
}