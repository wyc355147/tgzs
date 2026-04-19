/**
 * 铜鼓之声 - 全自动图片缓存管理系统
 * 版本：2.2.0 (元数据按需加载适配 + 移除正文扫描)
 * 功能：自动发现 + 智能预加载 + 容量管理
 * 特点：仅扫描元数据封面 + DOM 懒加载，正文图片由 MutationObserver 捕获
 */
console.log(' 全自动图片缓存系统加载 (v2.2.0 - 纯元数据扫描)...');

// ===============================
// 缓存配置
// ===============================
const ImageCacheConfig = {
    MAX_MEMORY_CACHE: 100,
    MAX_STORAGE_SIZE: 100 * 1024 * 1024,
    CACHE_EXPIRY: 7 * 24 * 60 * 60 * 1000,
    PRELOAD_DISTANCE: 500,
    LAZY_LOAD_THRESHOLD: 200,
    CACHE_KEY_PREFIX: 'tgzs_img_',
    DB_NAME: 'TongGuZhiShengCache',
    DB_VERSION: 2,
    STORE_NAME: 'images',
    AUTO_SCAN_SELECTORS: [
        'img[src]',
        'img[data-src]',
        'img[data-cover]',
        '.carousel-slide img',
        '.article-card img',
        '.reading-content img',
        '.journal-cover img'
    ],
    DEBUG: false,
    IDLE_PRELOAD_DELAY: 1000,
    MAX_CONCURRENT_LOADS: 5
};

// ===============================
// 工具函数
// ===============================
const ImageCacheUtils = {
    generateCacheKey(url, width = null, height = null) {
        const params = new URLSearchParams();
        if (width) params.append('w', width);
        if (height) params.append('h', height);
        const queryString = params.toString();
        const baseUrl = url.split('?')[0];
        return `${ImageCacheConfig.CACHE_KEY_PREFIX}${btoa(baseUrl + (queryString ? '?' + queryString : ''))}`;
    },
    
    parseCacheKey(cacheKey) {
        if (!cacheKey.startsWith(ImageCacheConfig.CACHE_KEY_PREFIX)) return null;
        try {
            const encoded = cacheKey.slice(ImageCacheConfig.CACHE_KEY_PREFIX.length);
            return atob(encoded);
        } catch {
            return null;
        }
    },
    
    estimateSize(blob) {
        return blob?.size || 0;
    },
    
    isExpired(timestamp) {
        return Date.now() - timestamp > ImageCacheConfig.CACHE_EXPIRY;
    },
    
    log(...args) {
        if (ImageCacheConfig.DEBUG) {
            console.log('[ImageCache]', ...args);
        }
    },
    
    error(...args) {
        console.error('[ImageCache]', ...args);
    },
    
    isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.trim() === '') return false;
        if (url.startsWith('data:')) return false;
        if (url.startsWith('blob:')) return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    // ✅ 核心修复：仅扫描元数据中的封面图片，不触碰 content 字段
    extractAllImageUrls() {
        const urls = new Set();
        
        // 1. 扫描所有 img 标签（DOM 已存在）
        document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.dataset.src || img.dataset.cover;
            if (this.isValidUrl(src)) {
                urls.add(src);
            }
        });
        
        // 2. 扫描 CSS 背景图片
        document.querySelectorAll('[style*="background"]').forEach(el => {
            const style = el.getAttribute('style');
            const matches = style.match(/url\(['"]?(.*?)['"]?\)/g);
            if (matches) {
                matches.forEach(match => {
                    const url = match.replace(/url\(['"]?(.*?)['"]?\)/, '$1');
                    if (this.isValidUrl(url)) {
                        urls.add(url);
                    }
                });
            }
        });
        
        // 3. ✅ 仅提取元数据中的封面图片（不遍历 content）
        if (window.allJournalMetaIssues && Array.isArray(window.allJournalMetaIssues)) {
            window.allJournalMetaIssues.forEach(issue => {
                // 提取期刊封面
                if (issue.metadata?.cover && typeof issue.metadata.cover === 'string') {
                    const cover = issue.metadata.cover.trim();
                    if (this.isValidUrl(cover)) {
                        urls.add(cover);
                    }
                }
                // 提取文章封面（元数据中已包含，无 content）
                if (issue.articles && Array.isArray(issue.articles)) {
                    issue.articles.forEach(article => {
                        if (article.cover && typeof article.cover === 'string') {
                            const cover = article.cover.trim();
                            if (this.isValidUrl(cover)) {
                                urls.add(cover);
                            }
                        }
                        // ✅ 关键修复：不再访问 article.content
                        // 正文图片由 MutationObserver 在阅读页面渲染时动态捕获
                    });
                }
            });
        } else if (window.allJournalIssues && Array.isArray(window.allJournalIssues)) {
            // 兼容旧版全量数据（降级方案，仍避免扫描 content）
            window.allJournalIssues.forEach(issue => {
                if (issue.metadata?.cover) {
                    const cover = issue.metadata.cover.trim();
                    if (this.isValidUrl(cover)) urls.add(cover);
                }
                if (issue.articles) {
                    issue.articles.forEach(article => {
                        if (article.cover) {
                            const cover = article.cover.trim();
                            if (this.isValidUrl(cover)) urls.add(cover);
                        }
                        // 降级模式下也不扫描 content，防止性能回退
                    });
                }
            });
        }
        
        return Array.from(urls);
    }
};

// ===============================
// 内存缓存池（LRU 算法）
// ===============================
class MemoryCachePool {
    constructor(maxSize = ImageCacheConfig.MAX_MEMORY_CACHE) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.accessOrder = [];
    }
    
    get(key) {
        if (!this.cache.has(key)) return null;
        
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
        
        const item = this.cache.get(key);
        
        if (ImageCacheUtils.isExpired(item.timestamp)) {
            this.delete(key);
            return null;
        }
        
        ImageCacheUtils.log('内存缓存命中:', key);
        return item.blob;
    }
    
    set(key, blob, metadata = {}) {
        while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
            ImageCacheUtils.log('LRU 淘汰:', oldestKey);
        }
        
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
        
        this.cache.set(key, {
            blob,
            timestamp: Date.now(),
            size: ImageCacheUtils.estimateSize(blob),
            ...metadata
        });
        
        ImageCacheUtils.log('内存缓存写入:', key, '大小:', ImageCacheUtils.estimateSize(blob), 'B');
    }
    
    delete(key) {
        const deleted = this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        return deleted;
    }
    
    clear() {
        this.cache.clear();
        this.accessOrder = [];
        ImageCacheUtils.log('内存缓存已清空');
    }
    
    getStats() {
        let totalSize = 0;
        for (const item of this.cache.values()) {
            totalSize += item.size;
        }
        return {
            count: this.cache.size,
            maxSize: this.maxSize,
            totalSize,
            accessOrder: [...this.accessOrder]
        };
    }
}

// ===============================
// IndexedDB 持久缓存
// ===============================
class StorageCache {
    constructor() {
        this.db = null;
        this.initPromise = this._initDB();
        this.sizeTracker = {
            current: 0,
            max: ImageCacheConfig.MAX_STORAGE_SIZE
        };
    }
    
    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(ImageCacheConfig.DB_NAME, ImageCacheConfig.DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(ImageCacheConfig.STORE_NAME)) {
                    const store = db.createObjectStore(ImageCacheConfig.STORE_NAME, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('url', 'url', { unique: false });
                    store.createIndex('size', 'size', { unique: false });
                    ImageCacheUtils.log('IndexedDB 存储创建成功');
                }
            };
            
            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this._calculateCurrentSize();
                ImageCacheUtils.log('IndexedDB 连接成功，当前使用:', this.sizeTracker.current, 'B');
                resolve(this.db);
            };
            
            request.onerror = (event) => {
                ImageCacheUtils.error('IndexedDB 初始化失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    async _calculateCurrentSize() {
        if (!this.db) return 0;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readonly');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                let total = 0;
                for (const item of request.result) {
                    total += item.size || 0;
                }
                this.sizeTracker.current = total;
                resolve(total);
            };
            
            request.onerror = () => resolve(0);
        });
    }
    
    async _ensureReady() {
        if (!this.db) {
            await this.initPromise;
        }
    }
    
    async get(key) {
        await this._ensureReady();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readonly');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            const request = store.get(key);
            
            request.onsuccess = () => {
                const item = request.result;
                
                if (!item) {
                    resolve(null);
                    return;
                }
                
                if (ImageCacheUtils.isExpired(item.timestamp)) {
                    this.delete(key);
                    resolve(null);
                    return;
                }
                
                ImageCacheUtils.log('持久缓存命中:', key);
                resolve(item.blob);
            };
            
            request.onerror = () => {
                ImageCacheUtils.error('读取缓存失败:', key);
                resolve(null);
            };
        });
    }
    
    async set(key, blob, metadata = {}) {
        await this._ensureReady();
        
        const size = ImageCacheUtils.estimateSize(blob);
        
        if (this.sizeTracker.current + size > this.sizeTracker.max) {
            await this._cleanupOldest(size);
        }
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            
            const record = {
                key,
                blob,
                url: ImageCacheUtils.parseCacheKey(key),
                timestamp: Date.now(),
                size,
                ...metadata
            };
            
            const request = store.put(record);
            
            request.onsuccess = () => {
                this.sizeTracker.current += size;
                ImageCacheUtils.log('持久缓存写入:', key, '大小:', size, 'B');
                resolve(true);
            };
            
            request.onerror = () => {
                ImageCacheUtils.error('写入缓存失败:', key);
                resolve(false);
            };
        });
    }
    
    async _cleanupOldest(neededSpace) {
        await this._ensureReady();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            const index = store.index('timestamp');
            const request = index.openCursor();
            
            const toDelete = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && this.sizeTracker.current + neededSpace > this.sizeTracker.max) {
                    toDelete.push(cursor.value.key);
                    this.sizeTracker.current -= cursor.value.size || 0;
                    cursor.continue();
                } else {
                    let deleteCount = 0;
                    const deleteNext = () => {
                        if (toDelete.length === 0) {
                            ImageCacheUtils.log('缓存清理完成，释放:', deleteCount, '项');
                            resolve(deleteCount);
                            return;
                        }
                        const key = toDelete.shift();
                        store.delete(key).onsuccess = () => {
                            deleteCount++;
                            deleteNext();
                        };
                    };
                    deleteNext();
                }
            };
            
            request.onerror = () => resolve(0);
        });
    }
    
    async delete(key) {
        await this._ensureReady();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            const getRequest = store.get(key);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    this.sizeTracker.current -= item.size || 0;
                }
                const deleteRequest = store.delete(key);
                deleteRequest.onsuccess = () => {
                    ImageCacheUtils.log('持久缓存删除:', key);
                    resolve(true);
                };
                deleteRequest.onerror = () => resolve(false);
            };
            
            getRequest.onerror = () => resolve(false);
        });
    }
    
    async clear() {
        await this._ensureReady();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([ImageCacheConfig.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ImageCacheConfig.STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => {
                this.sizeTracker.current = 0;
                ImageCacheUtils.log('持久缓存已清空');
                resolve(true);
            };
            
            request.onerror = () => resolve(false);
        });
    }
    
    async getStats() {
        await this._ensureReady();
        
        return {
            currentSize: this.sizeTracker.current,
            maxSize: this.sizeTracker.max,
            usagePercent: (this.sizeTracker.current / this.sizeTracker.max * 100).toFixed(2) + '%'
        };
    }
}

// ===============================
// 自动图片加载器（核心类）
// ===============================
class AutoImageLoader {
    constructor() {
        this.memoryCache = new MemoryCachePool();
        this.storageCache = new StorageCache();
        this.pendingRequests = new Map();
        this.lazyObserver = null;
        this.preloadQueue = [];
        this.isProcessingPreload = false;
        this.loadedUrls = new Set();
        this.currentLoadCount = 0;
        this.maxConcurrent = ImageCacheConfig.MAX_CONCURRENT_LOADS;
        this.scanObserver = null;
        this.idleCallback = null;
        
        console.log(' 全自动图片加载器初始化完成（纯元数据扫描）');
    }
    
    init() {
        this._initLazyLoading();
        this._initAutoScan();
        this._initIdlePreload();
        this._scanAndCacheAllImages();
        console.log(' 全自动图片缓存系统已启动');
    }
    
    _initLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.lazyObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            const src = img.dataset.src || img.src;
                            if (src && !img.dataset.loaded) {
                                this.loadAndApply(img, src);
                                img.dataset.loaded = 'true';
                            }
                            this.lazyObserver.unobserve(img);
                        }
                    });
                },
                { rootMargin: `${ImageCacheConfig.LAZY_LOAD_THRESHOLD}px` }
            );
            console.log(' 懒加载观察者已启用');
        }
    }
    
    _initAutoScan() {
        if ('MutationObserver' in window) {
            this.scanObserver = new MutationObserver((mutations) => {
                let shouldScan = false;
                
                mutations.forEach(mutation => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.tagName === 'IMG') {
                                    shouldScan = true;
                                }
                                const imgs = node.querySelectorAll?.('img') || [];
                                if (imgs.length > 0) {
                                    shouldScan = true;
                                }
                            }
                        });
                    }
                });
                
                if (shouldScan) {
                    this._debounceScan();
                }
            });
            
            this.scanObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log(' DOM 自动扫描已启用');
        }
    }
    
    _debounceScan() {
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        this.scanTimeout = setTimeout(() => {
            this._scanAndCacheAllImages();
        }, 500);
    }
    
    _initIdlePreload() {
        if ('requestIdleCallback' in window) {
            const scheduleIdlePreload = () => {
                this.idleCallback = requestIdleCallback((deadline) => {
                    if (deadline.timeRemaining() > 50) {
                        this._processPreloadQueue();
                    }
                    scheduleIdlePreload();
                }, { timeout: ImageCacheConfig.IDLE_PRELOAD_DELAY });
            };
            scheduleIdlePreload();
            console.log(' 空闲时预加载已启用');
        } else {
            setInterval(() => {
                this._processPreloadQueue();
            }, ImageCacheConfig.IDLE_PRELOAD_DELAY);
        }
    }
    
    _scanAndCacheAllImages() {
        const urls = ImageCacheUtils.extractAllImageUrls();
        console.log(' 自动发现图片:', urls.length, '张 (仅封面)');
        
        const viewportHeight = window.innerHeight;
        const priorityUrls = [];
        const normalUrls = [];
        
        urls.forEach(url => {
            const img = document.querySelector(`img[src="${url}"], img[data-src="${url}"]`);
            if (img) {
                const rect = img.getBoundingClientRect();
                if (rect.top < viewportHeight * 1.5) {
                    priorityUrls.push(url);
                } else {
                    normalUrls.push(url);
                }
            } else {
                normalUrls.push(url);
            }
        });
        
        this.preload(priorityUrls, { priority: true });
        this.preload(normalUrls, { priority: false });
    }
    
    async load(url, options = {}) {
        const {
            width = null,
            height = null,
            priority = false,
            skipCache = false
        } = options;
        
        if (!ImageCacheUtils.isValidUrl(url)) {
            ImageCacheUtils.error('无效 URL:', url);
            return null;
        }
        
        const cacheKey = ImageCacheUtils.generateCacheKey(url, width, height);
        
        if (!skipCache) {
            const memoryBlob = this.memoryCache.get(cacheKey);
            if (memoryBlob) {
                return memoryBlob;
            }
            
            const storageBlob = await this.storageCache.get(cacheKey);
            if (storageBlob) {
                this.memoryCache.set(cacheKey, storageBlob, { url });
                return storageBlob;
            }
        }
        
        if (this.pendingRequests.has(cacheKey)) {
            ImageCacheUtils.log('合并重复请求:', url);
            return this.pendingRequests.get(cacheKey);
        }
        
        if (this.currentLoadCount >= this.maxConcurrent) {
            ImageCacheUtils.log('并发限制，加入队列:', url);
            return new Promise((resolve) => {
                this.preloadQueue.unshift({ url, options, resolve, priority });
            });
        }
        
        this.currentLoadCount++;
        const fetchPromise = this._fetchWithCache(url, cacheKey, skipCache)
            .finally(() => {
                this.currentLoadCount--;
                this.pendingRequests.delete(cacheKey);
                this._processPreloadQueue();
            });
        
        this.pendingRequests.set(cacheKey, fetchPromise);
        
        try {
            const blob = await fetchPromise;
            return blob;
        } catch (error) {
            ImageCacheUtils.error('图片加载失败:', url, error);
            throw error;
        }
    }
    
    async _fetchWithCache(url, cacheKey, skipCache) {
        try {
            ImageCacheUtils.log('网络请求:', url);
            
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
                cache: 'force-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            
            if (!skipCache) {
                this.memoryCache.set(cacheKey, blob, { url });
                await this.storageCache.set(cacheKey, blob, { url });
            }
            
            this.loadedUrls.add(url);
            
            return blob;
        } catch (error) {
            ImageCacheUtils.error('图片加载失败:', url, error);
            throw error;
        }
    }
    
    async loadAndApply(imgElement, url, options = {}) {
        try {
            const blob = await this.load(url, options);
            const objectUrl = URL.createObjectURL(blob);
            
            if (imgElement.dataset.objectUrl) {
                URL.revokeObjectURL(imgElement.dataset.objectUrl);
            }
            
            imgElement.src = objectUrl;
            imgElement.dataset.objectUrl = objectUrl;
            imgElement.dataset.cached = 'true';
            
            if (options.onLoad) {
                options.onLoad(imgElement);
            }
            
            return true;
        } catch {
            if (imgElement.dataset.src) {
                imgElement.src = imgElement.dataset.src;
            }
            if (options.onError) {
                options.onError(imgElement);
            }
            return false;
        }
    }
    
    async preload(urls, options = {}) {
        const { priority = false } = options;
        
        for (const url of urls) {
            if (!this.loadedUrls.has(url) && !this.preloadQueue.some(item => item.url === url)) {
                this.preloadQueue.push({ url, priority, timestamp: Date.now() });
            }
        }
        
        this.preloadQueue.sort((a, b) => {
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return a.timestamp - b.timestamp;
        });
        
        this._processPreloadQueue();
    }
    
    async _processPreloadQueue() {
        if (this.isProcessingPreload || this.preloadQueue.length === 0) {
            return;
        }
        
        this.isProcessingPreload = true;
        
        const batchSize = this.maxConcurrent - this.currentLoadCount;
        const batch = this.preloadQueue.splice(0, Math.max(1, batchSize));
        
        for (const { url, priority } of batch) {
            try {
                await this.load(url, { priority });
            } catch {
                // 预加载失败不影响主流程
            }
        }
        
        this.isProcessingPreload = false;
        
        if (this.preloadQueue.length > 0) {
            setTimeout(() => this._processPreloadQueue(), 100);
        }
    }
    
    observe(imgElement) {
        if (this.lazyObserver && imgElement.dataset.src) {
            const rect = imgElement.getBoundingClientRect();
            if (rect.top < window.innerHeight + ImageCacheConfig.LAZY_LOAD_THRESHOLD &&
                rect.bottom > -ImageCacheConfig.LAZY_LOAD_THRESHOLD) {
                this.loadAndApply(imgElement, imgElement.dataset.src);
                imgElement.dataset.loaded = 'true';
            } else {
                this.lazyObserver.observe(imgElement);
            }
        }
    }
    
    unobserve(imgElement) {
        if (this.lazyObserver) {
            this.lazyObserver.unobserve(imgElement);
        }
    }
    
    async getStats() {
        const memory = this.memoryCache.getStats();
        const storage = await this.storageCache.getStats();
        
        return {
            memory,
            storage,
            pendingRequests: this.pendingRequests.size,
            preloadQueue: this.preloadQueue.length,
            loadedUrls: this.loadedUrls.size,
            currentLoadCount: this.currentLoadCount
        };
    }
    
    async clear(options = {}) {
        const { memory = true, storage = true } = options;
        
        if (memory) {
            this.memoryCache.clear();
        }
        if (storage) {
            await this.storageCache.clear();
        }
        
        this.loadedUrls.clear();
        this.preloadQueue = [];
        
        document.querySelectorAll('img[data-object-url]').forEach(img => {
            if (img.dataset.objectUrl) {
                URL.revokeObjectURL(img.dataset.objectUrl);
                delete img.dataset.objectUrl;
            }
        });
        
        console.log(' 图片缓存已清理');
    }
    
    destroy() {
        if (this.lazyObserver) {
            this.lazyObserver.disconnect();
        }
        if (this.scanObserver) {
            this.scanObserver.disconnect();
        }
        if (this.idleCallback) {
            cancelIdleCallback(this.idleCallback);
        }
        this.clear();
        console.log(' 图片加载器已销毁');
    }
}

// ===============================
// 全局实例与导出
// ===============================
let globalImageLoader = null;

function getImageLoader() {
    if (!globalImageLoader) {
        globalImageLoader = new AutoImageLoader();
    }
    return globalImageLoader;
}

async function loadImage(url, options = {}) {
    return getImageLoader().load(url, options);
}

async function loadImageToElement(imgElement, url, options = {}) {
    return getImageLoader().loadAndApply(imgElement, url, options);
}

function enableLazyLoading(selector = 'img[data-src]') {
    const loader = getImageLoader();
    document.querySelectorAll(selector).forEach(img => {
        loader.observe(img);
    });
    console.log(' 懒加载已启用，选择器:', selector);
}

function preloadImages(urls, options = {}) {
    return getImageLoader().preload(urls, options);
}

async function getCacheStats() {
    return getImageLoader().getStats();
}

async function clearImageCache(options = {}) {
    return getImageLoader().clear(options);
}

function rescanImages() {
    getImageLoader()._scanAndCacheAllImages();
}

// ===============================
// 自动初始化
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    const loader = getImageLoader();
    loader.init();
    console.log(' 全自动图片缓存系统自动初始化完成 (纯元数据模式)');
});

window.addEventListener('beforeunload', () => {
    if (globalImageLoader) {
        document.querySelectorAll('img[data-object-url]').forEach(img => {
            if (img.dataset.objectUrl) {
                URL.revokeObjectURL(img.dataset.objectUrl);
            }
        });
    }
});

// 导出全局 API
window.ImageCache = {
    load: loadImage,
    loadToElement: loadImageToElement,
    enableLazyLoading,
    preload: preloadImages,
    getStats: getCacheStats,
    clear: clearImageCache,
    getInstance: getImageLoader,
    rescan: rescanImages
};

// 页面可见性变化时重新扫描
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => rescanImages(), 1000);
    }
});

// 窗口大小变化时重新扫描
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => rescanImages(), 500);
});

console.log(' 全自动图片缓存模块加载完成 (v2.2.0)');