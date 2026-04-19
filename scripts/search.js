/**
 * 铜鼓之声 - 搜索系统模块（元数据按需加载架构适配）
 * 版本：2.7.0 (元数据搜索适配)
 * 功能：仅基于标题/作者/分类/摘要搜索，不再依赖正文内容
 */

console.log('搜索系统模块加载 (v2.7.0 - 元数据搜索适配)...');

// ===============================
// 搜索历史管理器
// ===============================
class SearchHistoryManager {
    constructor() {
        this.MAX_HISTORY_ITEMS = Infinity;
        this.STORAGE_KEY = 'tgzs_search_history_v27';
        this.history = this.loadHistory();
        this.isProcessingSearch = false;
        this.clearHistory = this.clearHistory.bind(this);
        this.renderHistoryDropdown = this.renderHistoryDropdown.bind(this);
        this.createHistoryDropdown();
        this.setupGlobalEventListeners();
        console.log('搜索历史管理器初始化完成');
    }

    loadHistory() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const history = JSON.parse(stored);
                console.log('加载 ' + history.length + ' 条搜索历史记录');
                return history;
            }
        } catch (error) {
            console.error('加载搜索历史失败:', error);
        }
        return [];
    }

    saveHistory() {
        try {
            const historyWithTimestamp = this.history.map(item => ({
                ...item,
                lastUpdated: new Date().toISOString()
            }));
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(historyWithTimestamp));
        } catch (error) {
            console.error('保存搜索历史失败:', error);
        }
    }

    addSearchQuery(query, isFromHistory = false) {
        if (this.isProcessingSearch) return;
        this.isProcessingSearch = true;
        try {
            if (!query || typeof query !== 'string' || query.trim() === '') return;
            const normalizedQuery = query.trim();
            const now = new Date();
            const existingIndex = this.history.findIndex(item =>
                item.query.toLowerCase() === normalizedQuery.toLowerCase()
            );
            if (existingIndex !== -1) {
                const existingItem = this.history[existingIndex];
                if (!isFromHistory) {
                    existingItem.count = (existingItem.count || 0) + 1;
                }
                existingItem.lastSearched = now.toISOString();
                existingItem.relevance = this.calculateRelevance(existingItem, now);
                this.history.splice(existingIndex, 1);
                this.history.unshift(existingItem);
            } else {
                this.history.unshift({
                    id: this.generateId(),
                    query: normalizedQuery,
                    firstSearched: now.toISOString(),
                    lastSearched: now.toISOString(),
                    count: 1,
                    relevance: 1.0
                });
            }
            this.saveHistory();
        } finally {
            setTimeout(() => {
                this.isProcessingSearch = false;
            }, 100);
        }
    }

    calculateRelevance(item, now) {
        const lastSearched = new Date(item.lastSearched);
        const daysSinceLastSearch = (now - lastSearched) / (1000 * 60 * 60 * 24);
        const frequencyScore = Math.min((item.count || 1) / 10, 1);
        const recencyScore = Math.max(0, 1 - (daysSinceLastSearch / 30));
        return (frequencyScore * 0.6) + (recencyScore * 0.4);
    }

    generateId() {
        return 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getHistory() {
        return [...this.history].sort((a, b) =>
            new Date(b.lastSearched) - new Date(a.lastSearched)
        );
    }

    clearHistory() {
        this.history = [];
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('已清除所有搜索历史记录');
            this.showClearSuccessToast();
        } catch (error) {
            console.error('清除搜索历史失败:', error);
        }
    }

    showClearSuccessToast() {
        const toast = document.createElement('div');
        toast.className = 'search-toast';
        toast.textContent = '搜索历史已清空';
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 2000);
    }

    renderHistoryDropdown(currentQuery = '') {
        const historyDropdown = document.getElementById('search-history-dropdown');
        if (!historyDropdown) return;
        const sortedHistory = this.getHistory();
        let filteredHistory = currentQuery.trim() === ''
            ? sortedHistory
            : this.filterHistoryByQuery(sortedHistory, currentQuery);
        historyDropdown.innerHTML = '';
        if (filteredHistory.length === 0) {
            historyDropdown.innerHTML = `
                <div class="history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:12px">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <p>暂无搜索历史</p>
                    <p class="history-empty-subtext">搜索记录将显示在这里</p>
                </div>
            `;
            historyDropdown.style.display = 'block';
            return;
        }
        const historyItemsContainer = document.createElement('div');
        historyItemsContainer.className = 'history-items-container';
        const maxItemsToShow = currentQuery.trim() === '' ? 8 : 10;
        filteredHistory.slice(0, maxItemsToShow).forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.query = item.query;
            const lastSearched = new Date(item.lastSearched);
            const now = new Date();
            const timeDiff = now - lastSearched;
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            let timeText = '';
            if (days > 0) {
                timeText = days === 1 ? '昨天' : days + '天前';
            } else if (hours > 0) {
                timeText = hours + '小时前';
            } else {
                timeText = '刚刚';
            }
            const highlightedQuery = currentQuery.trim() === ''
                ? item.query
                : this.highlightQuery(item.query, currentQuery);
            historyItem.innerHTML = `
                <div class="history-item-content">
                    <div class="history-query">${highlightedQuery}</div>
                    <div class="history-meta">
                        <span class="history-count">${item.count || 1}次</span>
                        <span class="history-time">${timeText}</span>
                    </div>
                </div>
                <button class="history-delete" aria-label="删除此搜索记录">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6L18 18"></path>
                    </svg>
                </button>
            `;
            historyItemsContainer.appendChild(historyItem);
        });
        if (currentQuery.trim() === '') {
            const clearSection = document.createElement('div');
            clearSection.className = 'history-clear-section';
            clearSection.innerHTML = `
                <button class="history-clear-button" id="clear-history-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    清空搜索历史
                </button>
            `;
            historyDropdown.appendChild(clearSection);
        }
        historyDropdown.appendChild(historyItemsContainer);
        historyDropdown.style.display = 'block';
        this.positionHistoryDropdown();
        this.setupHistoryEventListeners();
    }

    filterHistoryByQuery(history, query) {
        const normalizedQuery = query.trim().toLowerCase();
        if (normalizedQuery === '') return history;
        return history.filter(item =>
            item.query.toLowerCase().includes(normalizedQuery)
        );
    }

    highlightQuery(text, query) {
        if (!query || query.trim() === '') return text;
        const normalizedQuery = query.trim().toLowerCase();
        const textLower = text.toLowerCase();
        const startIndex = textLower.indexOf(normalizedQuery);
        if (startIndex === -1) return text;
        const endIndex = startIndex + normalizedQuery.length;
        return text.substring(0, startIndex) + '<span class="history-query-highlight">' + text.substring(startIndex, endIndex) + '</span>' + text.substring(endIndex);
    }

    positionHistoryDropdown() {
        const historyDropdown = document.getElementById('search-history-dropdown');
        const searchBox = document.querySelector('.search-box');
        if (!historyDropdown || !searchBox) return;
        const searchRect = searchBox.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        historyDropdown.style.width = Math.max(searchRect.width, 300) + 'px';
        historyDropdown.style.minWidth = '300px';
        let leftPosition = searchRect.left;
        if (leftPosition + searchRect.width > viewportWidth - 20) {
            leftPosition = viewportWidth - searchRect.width - 20;
        }
        if (leftPosition < 10) leftPosition = 10;
        const topPosition = searchRect.bottom + 8;
        historyDropdown.style.position = 'fixed';
        historyDropdown.style.left = leftPosition + 'px';
        historyDropdown.style.top = topPosition + 'px';
        historyDropdown.style.right = 'auto';
        historyDropdown.style.bottom = 'auto';
        historyDropdown.style.maxHeight = '400px';
        historyDropdown.style.overflowY = 'auto';
        historyDropdown.style.zIndex = '1100';
    }

    setupHistoryEventListeners() {
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.history-delete')) return;
                const query = item.dataset.query;
                if (query) this.handleHistoryItemClick(query);
            });
        });
        document.querySelectorAll('.history-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const historyItem = button.closest('.history-item');
                if (historyItem) {
                    const query = historyItem.dataset.query;
                    this.deleteHistoryItem(query);
                }
            });
        });
        const clearButton = document.getElementById('clear-history-button');
        if (clearButton) {
            clearButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showClearConfirmation();
            });
        }
        const closeHandler = (e) => {
            const historyDropdown = document.getElementById('search-history-dropdown');
            const searchBox = document.querySelector('.search-box');
            if (historyDropdown && searchBox &&
                !historyDropdown.contains(e.target) &&
                !searchBox.contains(e.target)) {
                historyDropdown.style.display = 'none';
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                const historyDropdown = document.getElementById('search-history-dropdown');
                if (historyDropdown) historyDropdown.style.display = 'none';
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('keydown', keyHandler);
        }, 100);
    }

    handleHistoryItemClick(query) {
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.value = query;
            if (window.searchManager) {
                window.searchManager.performSearch(query);
            } else if (typeof window.searchArticles === 'function') {
                window.searchArticles(query, true);
            }
            const historyDropdown = document.getElementById('search-history-dropdown');
            if (historyDropdown) historyDropdown.style.display = 'none';
        }
    }

    deleteHistoryItem(query) {
        const normalizedQuery = query.trim().toLowerCase();
        this.history = this.history.filter(item =>
            item.query.toLowerCase() !== normalizedQuery
        );
        this.saveHistory();
        const searchInput = document.querySelector('.search-box input');
        const currentQuery = searchInput ? searchInput.value : '';
        this.renderHistoryDropdown(currentQuery);
        this.showDeleteToast();
    }

    showDeleteToast() {
        const toast = document.createElement('div');
        toast.className = 'search-toast';
        toast.textContent = '已删除记录';
        toast.style.backgroundColor = 'var(--accent-primary)';
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 1500);
    }

    showClearConfirmation() {
        const modal = document.createElement('div');
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="search-modal-content">
                <button class="search-modal-close">&times;</button>
                <div class="search-modal-icon">?</div>
                <h2 class="search-modal-title">确认清空历史记录</h2>
                <p class="search-modal-desc">您确定要清空所有搜索历史记录吗？此操作不可撤销。</p>
                <div class="search-modal-actions">
                    <button class="search-modal-btn search-modal-btn-cancel">取消</button>
                    <button class="search-modal-btn search-modal-btn-confirm">清空历史</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        modal.querySelector('.search-modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
        });
        modal.querySelector('.search-modal-btn-cancel').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
        });
        modal.querySelector('.search-modal-btn-confirm').addEventListener('click', () => {
            this.clearHistory();
            modal.classList.remove('active');
            setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
            const searchInput = document.querySelector('.search-box input');
            const currentQuery = searchInput ? searchInput.value : '';
            this.renderHistoryDropdown(currentQuery);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
            }
        });
    }

    createHistoryDropdown() {
        if (document.getElementById('search-history-dropdown')) return;
        const dropdown = document.createElement('div');
        dropdown.id = 'search-history-dropdown';
        dropdown.className = 'search-history-dropdown';
        document.body.appendChild(dropdown);
    }

    setupGlobalEventListeners() {
        const searchInput = document.querySelector('.search-box input');
        if (!searchInput) return;
        searchInput.addEventListener('focus', () => {
            setTimeout(() => {
                this.renderHistoryDropdown(searchInput.value);
            }, 100);
        });
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const currentQuery = searchInput.value.trim();
            debounceTimer = setTimeout(() => {
                this.renderHistoryDropdown(currentQuery);
            }, 300);
        });
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const historyDropdown = document.getElementById('search-history-dropdown');
                if (historyDropdown) historyDropdown.style.display = 'none';
            }, 200);
        });
    }
}

// ===============================
// 搜索系统主类（元数据搜索适配）
// ===============================
class SearchSystem {
    constructor() {
        this.searchInput = null;
        this.searchBtn = null;
        this.topSearchBtn = null;
        this.articlesContainer = null;
        this.articlesSection = null;
        this.isSearching = false;
        this.isSearchExpanded = false;
        this.originalSectionHeaderHTML = null;
        console.log('搜索系统初始化 (v2.7.0 - 元数据搜索)...');
    }

    init() {
        this.searchInput = document.querySelector('.search-box input');
        this.searchBtn = document.querySelector('.search-box svg, .search-box button');
        this.topSearchBtn = document.getElementById('searchToggle');
        this.articlesContainer = document.querySelector('.article-grid');
        this.articlesSection = document.querySelector('#articles');
        
        if (!this.searchInput) {
            console.warn('搜索输入框未找到');
            return false;
        }
        
        // 保存原始标题 HTML，用于返回推荐页
        if (this.articlesSection) {
            const originalHeader = this.articlesSection.querySelector('.section-header');
            if (originalHeader) {
                this.originalSectionHeaderHTML = originalHeader.innerHTML;
                console.log('已保存原始标题 HTML');
            }
        }
        
        if (window.searchManager) {
            console.log('检测到 SearchManager，搜索系统将仅处理历史记录，UI 由 SearchManager 接管');
            this.setupSearchButton();
            this.addSearchStyles();
            return true;
        }
        
        this.setupSearchButton();
        this.setupEventListeners();
        this.addSearchStyles();
        console.log('搜索系统初始化完成 (元数据模式)');
        return true;
    }

    setupSearchButton() {
        if (this.topSearchBtn) {
            this.topSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSearchBox();
            });
            console.log('顶部搜索按钮已绑定');
        }
        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.addEventListener('click', (e) => {
                if (!this.isSearchExpanded) {
                    this.expandSearchBox();
                }
            });
        }
    }

    toggleSearchBox() {
        if (this.isSearchExpanded) {
            this.collapseSearchBox();
        } else {
            this.expandSearchBox();
        }
    }

    expandSearchBox() {
        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.classList.add('expanded');
            this.isSearchExpanded = true;
            this.searchInput.focus();
            console.log('搜索框已展开');
        }
    }

    collapseSearchBox() {
        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.classList.remove('expanded');
            this.isSearchExpanded = false;
            this.searchInput.blur();
            const historyDropdown = document.getElementById('search-history-dropdown');
            if (historyDropdown) historyDropdown.style.display = 'none';
            console.log('搜索框已收起');
        }
    }

    setupEventListeners() {
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const query = this.searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                } else {
                    this.resetToOriginalView();
                }
            });
        }
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = this.searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                } else {
                    this.resetToOriginalView();
                }
            }
        });
        this.searchInput.placeholder = '搜索文章标题、作者、标签...';
        this.searchInput.title = '支持搜索文章标题、作者、分类标签';
    }

    performSearch(query, isFromHistory = false) {
        if (this.isSearching) return;
        this.isSearching = true;
        console.log('搜索文章：' + query);
        
        // 添加搜索历史记录
        if (window.searchHistoryManager && !isFromHistory) {
            window.searchHistoryManager.addSearchQuery(query);
        }
        
        // 如果存在 SearchManager，委托给它处理
        if (window.searchManager) {
            window.searchManager.performSearch(query);
            this.isSearching = false;
            return;
        }
        
        // 隐藏搜索历史下拉框
        const historyDropdown = document.getElementById('search-history-dropdown');
        if (historyDropdown) historyDropdown.style.display = 'none';
        
        // 检查文章库是否加载（元数据模式）
        if (!window.journalManager || !window.journalManager.articlesMetaCache) {
            console.error('元数据缓存尚未加载');
            this.showNoResults('文章库尚未加载，请稍后重试');
            this.isSearching = false;
            return;
        }
        
        // 执行搜索（仅基于元数据）
        const results = this.searchArticles(query);
        this.renderSearchResults(results, query);
        
        setTimeout(() => {
            this.isSearching = false;
        }, 100);
    }

    // 核心适配：仅遍历元数据缓存，不依赖正文
    searchArticles(query) {
        const results = [];
        const normalizedQuery = query.toLowerCase().trim();
        // 核心适配：仅遍历元数据缓存，不再加载正文
        const metaCache = window.journalManager?.articlesMetaCache;
        if (!metaCache) {
            console.warn('元数据缓存未就绪，无法执行搜索');
            return results;
        }
        for (const [id, meta] of metaCache) {
            const titleMatch = meta.title?.toLowerCase().includes(normalizedQuery);
            const authorMatch = meta.author?.name?.toLowerCase().includes(normalizedQuery);
            const categoryMatch = meta.category?.toLowerCase().includes(normalizedQuery);
            const excerptMatch = meta.excerpt?.toLowerCase().includes(normalizedQuery);
            const idMatch = meta.id?.toLowerCase() === normalizedQuery;
            
            if (titleMatch || authorMatch || categoryMatch || excerptMatch || idMatch) {
                results.push({
                    ...meta,
                    matchType: titleMatch ? 'title' : authorMatch ? 'author' : categoryMatch ? 'category' : 'excerpt',
                    relevance: this.calculateRelevance(meta, normalizedQuery)
                });
            }
        }
        results.sort((a, b) => b.relevance - a.relevance);
        console.log('找到 ' + results.length + ' 个相关结果 (元数据搜索)');
        return results;
    }

    // 核心适配：基于元数据字段计算相关性
    calculateRelevance(article, query) {
        let score = 0;
        if (article.title?.toLowerCase().includes(query)) score += 10;
        if (article.author?.name?.toLowerCase().includes(query)) score += 5;
        if (article.category?.toLowerCase().includes(query)) score += 3;
        if (article.excerpt?.toLowerCase().includes(query)) score += 1;
        if (article.id?.toLowerCase() === query) score += 20;
        return score;
    }

    renderSearchResults(results, query) {
        if (!this.articlesContainer) {
            console.error('文章容器未找到');
            return;
        }
        
        // 替换标题为搜索标题
        this.replaceSectionHeader(query, results.length);
        
        // 清空文章网格
        this.articlesContainer.innerHTML = '';
        
        // 移除可能存在的旧无结果提示
        const existingNoResults = this.articlesContainer.querySelector('.search-no-results');
        if (existingNoResults) existingNoResults.remove();
        
        // 无结果处理 - 核心修复
        if (results.length === 0) {
            this.showNoResults(query);
            return;
        }
        
        // 渲染搜索结果
        const displayResults = results.slice(0, 50);
        displayResults.forEach((article, index) => {
            const card = this.createArticleCard(article, query, index);
            this.articlesContainer.appendChild(card);
        });
        
        // 滚动到文章区
        this.articlesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 核心修复：替换标题区域
    replaceSectionHeader(query, count) {
        if (!this.articlesSection || !this.originalSectionHeaderHTML) {
            console.error('无法替换标题区域：缺少必要元素');
            return;
        }
        const headerContainer = this.articlesSection.querySelector('.section-header');
        if (!headerContainer) {
            console.error('无法找到标题容器进行替换');
            return;
        }
        const searchHeaderHTML = `
            <div class="section-title">
                <button class="search-back-btn" id="searchBackBtn" aria-label="返回推荐页" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    margin-right: 12px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    返回
                </button>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px; vertical-align: middle;">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                搜索 "<strong>${this.escapeHtml(query)}</strong>" 的结果
            </div>
            <div class="section-subtitle">
                找到 <strong>${count}</strong> 个结果
            </div>
        `;
        headerContainer.innerHTML = searchHeaderHTML;
        
        // 绑定返回按钮事件
        setTimeout(() => {
            const backBtn = document.getElementById('searchBackBtn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.resetToOriginalView();
                });
            }
        }, 100);
        console.log('搜索标题已替换');
    }

    // 核心修复：显示无结果页面
    showNoResults(query) {
        if (!this.articlesContainer) return;
        
        // 确保清空原有内容
        this.articlesContainer.innerHTML = '';
        
        const noResults = document.createElement('div');
        noResults.className = 'search-no-results';
        noResults.style.cssText = `
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 80px 20px;
            color: var(--text-tertiary);
            animation: fadeInUp 0.4s ease forwards;
        `;
        noResults.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:20px">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <h3 style="font-size:1.25rem;color:var(--text-primary);margin-bottom:12px;font-weight:600">未找到相关文章</h3>
            <p style="font-size:0.95rem;margin-bottom:8px;max-width:400px;line-height:1.6">
                没有搜索到与 "<strong>${this.escapeHtml(query)}</strong>" 相关的内容
            </p>
            <p style="font-size:0.85rem;margin-bottom:24px;color:var(--text-tertiary)">
                当前支持搜索标题、作者、分类与摘要
            </p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
                <button class="search-back-btn" id="searchBackToHome" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    background: var(--accent-primary);
                    color: var(--bg-primary);
                    border: none;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    </svg>
                    返回推荐页
                </button>
                <button class="search-back-btn" id="searchClearInput" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    清空搜索
                </button>
            </div>
            <div style="margin-top:32px;padding:20px;background:var(--bg-secondary);border-radius:12px;max-width:500px;width:100%">
                <p style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);margin-bottom:12px">搜索提示：</p>
                <ul style="font-size:0.85rem;color:var(--text-tertiary);text-align:left;line-height:1.8;padding-left:20px">
                    <li>尝试使用更短或更通用的关键词</li>
                    <li>检查拼写是否正确</li>
                    <li>支持搜索文章标题、作者、分类标签与摘要</li>
                    <li>浏览推荐文章发现更多内容</li>
                </ul>
            </div>
        `;
        this.articlesContainer.appendChild(noResults);
        
        // 绑定按钮事件
        setTimeout(() => {
            const backToHomeBtn = document.getElementById('searchBackToHome');
            const clearInputBtn = document.getElementById('searchClearInput');
            if (backToHomeBtn) {
                backToHomeBtn.addEventListener('click', () => {
                    this.resetToOriginalView();
                });
            }
            if (clearInputBtn) {
                clearInputBtn.addEventListener('click', () => {
                    this.searchInput.value = '';
                    this.resetToOriginalView();
                });
            }
        }, 100);
        
        console.log('显示无结果页面');
    }

    // 返回推荐页
    resetToOriginalView() {
        if (!this.articlesSection || !this.originalSectionHeaderHTML) {
            console.warn('无法返回推荐页：缺少原始标题 HTML');
            return;
        }
        const currentHeader = this.articlesSection.querySelector('.section-header');
        if (currentHeader) {
            currentHeader.innerHTML = this.originalSectionHeaderHTML;
            console.log('原始标题已恢复');
        }
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.articlesContainer) {
            this.articlesContainer.innerHTML = '';
        }
        // 核心适配：调用 ReadingSystem 的元数据刷新逻辑
        if (window.globalReadingInstance && typeof window.globalReadingInstance.updateHomePage === 'function') {
            window.globalReadingInstance.updateHomePage();
        }
        console.log('已返回推荐页');
    }

    // 核心适配：基于元数据创建卡片，不再依赖正文
    createArticleCard(article, query, index) {
        const card = document.createElement('article');
        card.className = 'article-card glass';
        card.dataset.article = article.id;
        card.style.animation = 'fadeInUp 0.4s ease forwards ' + (index * 0.05) + 's';
        card.style.opacity = '0';
        const hasCover = article.cover && article.cover.trim().length > 0;
        const coverHtml = hasCover
            ? '<div class="card-image"><img src="' + article.cover + '" alt="' + article.title + '" loading="lazy"></div>'
            : '';
        const highlightedTitle = this.highlightText(article.title, query);
        const highlightedAuthor = this.highlightText(article.author?.name || '佚名', query);
        // 核心适配：优先使用预计算摘要，降级使用标题或占位符
        const excerptText = article.excerpt || article.title || '暂无摘要内容';
        const highlightedExcerpt = this.highlightText(excerptText, query);
        const categoryText = this.highlightText(article.category || '未分类', query);
        card.innerHTML = `
            ${coverHtml}
            <div class="card-content">
                <div class="card-category">
                    <span class="category-badge">${categoryText}</span>
                </div>
                <h3 class="card-title">${highlightedTitle}</h3>
                <p class="card-excerpt">${highlightedExcerpt}</p>
                <div class="card-meta">
                    <span class="card-author">
                        <span class="avatar">${(article.author?.name || '佚名').charAt(0)}</span>
                        ${highlightedAuthor}
                    </span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            if (typeof window.openReading === 'function') {
                window.openReading(article.id);
            }
        });
        return card;
    }

    highlightText(text, query) {
        if (!query || query.trim() === '') return text;
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(' + escapedQuery + ')', 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addSearchStyles() {
        const styleId = 'search-system-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .search-history-dropdown {
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-lg);
                backdrop-filter: blur(var(--glass-blur));
                -webkit-backdrop-filter: blur(var(--glass-blur));
                animation: searchDropdownFadeIn 0.2s ease;
            }
            @keyframes searchDropdownFadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .history-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                border-radius: var(--radius-md);
                transition: all var(--transition-fast);
            }
            .history-item:hover {
                background: var(--bg-secondary);
            }
            .history-item-content { flex: 1; min-width: 0; }
            .history-query {
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .history-query-highlight {
                color: var(--accent-primary);
                font-weight: 600;
            }
            .history-meta {
                display: flex;
                gap: 12px;
                font-size: 0.75rem;
                color: var(--text-tertiary);
            }
            .history-delete {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: var(--text-tertiary);
                cursor: pointer;
                border-radius: 50%;
                opacity: 0;
                transition: all var(--transition-fast);
            }
            .history-item:hover .history-delete { opacity: 1; }
            .history-delete:hover {
                background: var(--bg-tertiary);
                color: var(--text-primary);
            }
            .history-empty {
                padding: 40px 20px;
                text-align: center;
                color: var(--text-tertiary);
            }
            .history-empty-subtext {
                font-size: 0.8rem;
                margin-top: 8px;
                color: var(--text-tertiary);
            }
            .history-clear-section {
                padding: 8px 12px;
                border-top: 1px solid var(--border-color);
            }
            .history-clear-button {
                width: 100%;
                padding: 10px;
                background: transparent;
                color: var(--text-secondary);
                border: none;
                text-align: left;
                cursor: pointer;
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                gap: 8px;
                border-radius: var(--radius-md);
                transition: all var(--transition-fast);
            }
            .history-clear-button:hover {
                color: var(--text-primary);
                background: var(--bg-secondary);
            }
            .history-items-container {
                max-height: 300px;
                overflow-y: auto;
            }
            .search-highlight {
                background: rgba(255, 193, 7, 0.25);
                padding: 1px 4px;
                border-radius: 3px;
                font-weight: 600;
                color: var(--accent-primary);
            }
            [data-theme="dark"] .search-highlight {
                background: rgba(255, 193, 7, 0.2);
            }
            .search-toast {
                position: fixed;
                bottom: 90px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: var(--bg-primary);
                color: var(--text-primary);
                padding: 12px 24px;
                border-radius: var(--radius-lg);
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-lg);
                font-size: 0.9rem;
                font-weight: 500;
                z-index: 9999;
                opacity: 0;
                transition: all 0.3s var(--ease-smooth);
                backdrop-filter: blur(var(--glass-blur));
                -webkit-backdrop-filter: blur(var(--glass-blur));
            }
            .search-modal {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s var(--ease-smooth);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }
            .search-modal.active {
                opacity: 1;
                visibility: visible;
            }
            .search-modal-content {
                background: var(--bg-primary);
                border-radius: var(--radius-xl);
                padding: 32px;
                max-width: 420px;
                width: 90%;
                position: relative;
                transform: scale(0.95);
                transition: transform 0.3s var(--ease-smooth);
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-lg);
            }
            .search-modal.active .search-modal-content {
                transform: scale(1);
            }
            .search-modal-close {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 32px;
                height: 32px;
                border: none;
                background: var(--bg-secondary);
                border-radius: 50%;
                font-size: 1.25rem;
                cursor: pointer;
                color: var(--text-secondary);
                transition: all var(--transition-fast);
            }
            .search-modal-close:hover {
                background: var(--bg-tertiary);
                color: var(--text-primary);
            }
            .search-modal-icon {
                font-size: 3rem;
                text-align: center;
                margin-bottom: 16px;
            }
            .search-modal-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--text-primary);
                text-align: center;
                margin-bottom: 12px;
            }
            .search-modal-desc {
                font-size: 0.9rem;
                color: var(--text-secondary);
                text-align: center;
                line-height: 1.6;
                margin-bottom: 24px;
            }
            .search-modal-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .search-modal-btn {
                padding: 12px 28px;
                border-radius: var(--radius-lg);
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all var(--transition-fast);
                border: none;
            }
            .search-modal-btn-cancel {
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
            }
            .search-modal-btn-cancel:hover {
                background: var(--bg-tertiary);
            }
            .search-modal-btn-confirm {
                background: var(--danger, #ef4444);
                color: white;
            }
            .search-modal-btn-confirm:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            .search-box {
                transition: all var(--transition-normal);
            }
            .search-box.expanded {
                border-color: var(--accent-primary);
                box-shadow: 0 0 0 4px var(--accent-glow);
                background: var(--bg-primary);
            }
            .search-box.expanded input {
                color: var(--text-primary);
            }
            .search-box.expanded svg {
                color: var(--accent-primary);
            }
            .search-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all var(--transition-fast);
            }
            .search-back-btn:hover {
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border-color: var(--accent-primary);
                transform: translateX(-2px);
                box-shadow: var(--shadow-sm);
            }
            .search-no-results {
                grid-column: 1 / -1;
                animation: fadeInUp 0.4s ease forwards;
            }
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @media (max-width: 768px) {
                .search-history-dropdown {
                    min-width: 280px !important;
                    left: 10px !important;
                    right: 10px !important;
                }
                .search-modal-content {
                    padding: 24px;
                }
                .search-modal-actions {
                    flex-direction: column;
                }
                .search-modal-btn {
                    width: 100%;
                }
                .search-no-results {
                    padding: 60px 16px !important;
                }
                .search-no-results h3 {
                    font-size: 1.1rem !important;
                }
                .search-no-results p {
                    font-size: 0.85rem !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ===============================
// 初始化搜索系统
// ===============================
function initSearchSystem() {
    if (!window.journalManager || !window.journalManager.loaded) {
        console.log('等待期刊管理器加载...');
        setTimeout(initSearchSystem, 200);
        return;
    }
    setTimeout(() => {
        if (!window.searchHistoryManager) {
            window.searchHistoryManager = new SearchHistoryManager();
        }
        if (!window.searchSystem) {
            window.searchSystem = new SearchSystem();
            const initialized = window.searchSystem.init();
            if (initialized) {
                console.log('搜索系统模块初始化完成 (元数据模式)');
            } else {
                console.error('搜索系统初始化失败');
            }
        }
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('搜索模块等待初始化...');
    initSearchSystem();
});

window.searchArticles = function(query, isFromHistory = false) {
    if (window.searchSystem) {
        window.searchSystem.performSearch(query, isFromHistory);
    } else {
        console.error('搜索系统未初始化');
    }
};