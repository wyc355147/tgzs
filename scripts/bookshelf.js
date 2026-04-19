/**
 * 书架系统 - 全屏管理界面（修复收藏作者与期数显示）
 * 版本：v18.2.0
 * 修复：作者显示“佚名”问题、期刊号缺失问题
 */
console.log('书架系统模块加载 (v18.2.0 - 修复作者与期数)...');

class BookshelfSystem {
    constructor() {
        this.view = null;
        this.scroll = null;
        this.currentTab = 'journals';
        this.navigationStack = [];
        this.isBatchMode = false;
        this.selectedItems = new Set();
        this.historySortOrder = 'desc';
        this.isInitialized = false;
        this.eventsBound = false;
        this.currentDirectoryIssue = null;
        this.openedFromPage = null;
        this.returnToDirectoryIssue = null;
        this.shouldReturnToDirectory = false;
        this.FAVORITES_KEY = 'tgzs_bookshelf_favorites_v43';
        this.HISTORY_KEY = 'tgzs_bookshelf_history_v43';
        this.activeModal = null;
        console.log('书架系统实例创建完成 (v18.2.0)');
    }

    init() {
        console.log('开始初始化书架系统...');
        this.createDOM();
        this.bindEvents();
        this.loadFavorites();
        this.loadHistory();
        this.isInitialized = true;
        console.log('书架系统初始化完成');
        return true;
    }

    createDOM() {
        if (document.getElementById('bookshelfView')) return;
        const view = document.createElement('div');
        view.id = 'bookshelfView';
        view.className = 'bookshelf-view';
        view.setAttribute('role', 'dialog');
        view.setAttribute('aria-modal', 'true');
        view.setAttribute('aria-label', '我的书架');
        view.innerHTML = `
            <header class="bookshelf-header" id="bookshelfHeader">
                <button class="bookshelf-back" id="bookshelfBack" aria-label="返回">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>书架</span>
                </button>
                <div class="bookshelf-tabs">
                    <button class="bookshelf-tab active" data-tab="journals">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        铜鼓之声
                    </button>
                    <button class="bookshelf-tab" data-tab="favorites">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        收藏
                    </button>
                    <button class="bookshelf-tab" data-tab="history">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        历史
                    </button>
                </div>
            </header>
            <div class="bookshelf-floating-toolbar hidden" id="floatingToolbar">
                <button class="batch-toggle-btn" id="batchToggleBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    批量管理
                </button>
                <div class="history-sort-group" id="historySortGroup">
                    <button class="history-sort-btn active" data-order="desc">最近</button>
                    <button class="history-sort-btn" data-order="asc">最早</button>
                </div>
            </div>
            <div class="bookshelf-scroll" id="bookshelfScroll">
                <div class="bookshelf-container">
                    <div class="bookshelf-content active" id="bookshelfJournals">
                        <div class="journals-grid" id="journalsGrid"></div>
                    </div>
                    <div class="bookshelf-content" id="bookshelfFavorites">
                        <div id="favoritesContainer"></div>
                    </div>
                    <div class="bookshelf-content" id="bookshelfHistory">
                        <div id="historyContainer"></div>
                    </div>
                </div>
            </div>
            <div class="batch-toolbar" id="batchToolbar">
                <div class="batch-toolbar-left">
                    <div class="batch-counter" id="batchCounter">0 项已选</div>
                    <button class="batch-select-all" id="batchSelectAll">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        全选
                    </button>
                </div>
                <div class="batch-actions">
                    <button class="batch-btn batch-cancel" id="batchCancel">取消</button>
                    <button class="batch-btn batch-delete" id="batchDelete">删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(view);
        this.view = view;
        this.scroll = document.getElementById('bookshelfScroll');
        console.log('书架 DOM 结构创建完成');
    }

    bindEvents() {
        if (this.eventsBound) return;
        const toggleBtn = document.getElementById('bookshelfToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.open();
            });
        }
        const backBtn = document.getElementById('bookshelfBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.handleBack());
        }
        document.querySelectorAll('.bookshelf-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
        document.querySelectorAll('.history-sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const order = btn.dataset.order;
                document.querySelectorAll('.history-sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.historySortOrder = order;
                this.renderHistory();
            });
        });
        const batchToggleBtn = document.getElementById('batchToggleBtn');
        if (batchToggleBtn) {
            batchToggleBtn.addEventListener('click', () => this.toggleBatchMode());
        }
        document.getElementById('batchSelectAll')?.addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('batchCancel')?.addEventListener('click', () => this.exitBatchMode());
        document.getElementById('batchDelete')?.addEventListener('click', () => this.batchDelete());
        this.scroll?.addEventListener('scroll', () => {
            const header = document.getElementById('bookshelfHeader');
            if (header) header.classList.toggle('scrolled', this.scroll.scrollTop > 40);
        }, { passive: true });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.view?.classList.contains('active')) {
                this.handleBack();
            }
        });
        this.view?.addEventListener('click', (e) => {
            if (e.target === this.view && window.innerWidth <= 768) {
                this.close();
            }
        });
        this.eventsBound = true;
        console.log('书架事件绑定完成');
    }

    open() {
        if (!this.view) return;
        let initialTab = 'journals';
        if (this.openedFromPage === 'favorites' || this.openedFromPage === 'history') {
            initialTab = this.openedFromPage;
            console.log('检测到返回标记，恢复到标签页:', initialTab);
        }
        this.currentTab = initialTab;
        this.isBatchMode = false;
        this.selectedItems.clear();
        this.exitBatchMode();
        this.openedFromPage = null;
        this.switchTab(initialTab);
        this.view.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.scroll.scrollTop = 0;
        setTimeout(() => this.renderJournals(), 300);
        console.log('书架页面已打开，初始标签页:', initialTab);
    }

    close() {
        if (!this.view) return;
        this.view.classList.remove('active');
        document.body.style.overflow = '';
        console.log('书架页面已关闭');
    }

    handleBack() {
        if (this.currentDirectoryIssue) {
            this.showJournalsGrid();
            this.currentDirectoryIssue = null;
            return;
        }
        if (this.navigationStack.length > 0) {
            const prevState = this.navigationStack.pop();
            if (prevState.type === 'directory') {
                this.showJournalsGrid();
                return;
            }
        }
        this.close();
    }

    switchTab(tabId) {
        if (this.isBatchMode && this.currentTab !== tabId) {
            console.log('标签页切换，退出批量管理模式');
            this.exitBatchMode();
        }
        document.querySelectorAll('.bookshelf-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tabId);
        });
        document.querySelectorAll('.bookshelf-content').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(`bookshelf${this.capitalize(tabId)}`)?.classList.add('active');
        this.currentTab = tabId;
        this.updateToolbar();
        switch (tabId) {
            case 'journals': this.renderJournals(); break;
            case 'favorites': this.renderFavorites(); break;
            case 'history': this.renderHistory(); break;
        }
        this.scroll.scrollTop = 0;
        console.log('切换到书架标签页:', tabId);
    }

    updateToolbar() {
        const toolbar = document.getElementById('floatingToolbar');
        const historySortGroup = document.getElementById('historySortGroup');
        if (!toolbar) return;
        if (this.currentTab === 'favorites' || this.currentTab === 'history') {
            toolbar.classList.remove('hidden');
        } else {
            toolbar.classList.add('hidden');
        }
        if (this.currentTab === 'history') {
            historySortGroup?.classList.add('visible');
        } else {
            historySortGroup?.classList.remove('visible');
        }
    }

    renderJournals() {
        const grid = document.getElementById('journalsGrid');
        if (!grid) return;
        if (!window.journalManager?.allIssues) {
            grid.innerHTML = this.renderEmptyState('期刊数据加载中...', '稍后自动刷新');
            return;
        }
        const issues = [...window.journalManager.allIssues].sort((a, b) =>
            parseInt(b.metadata?.issueNumber || 0) - parseInt(a.metadata?.issueNumber || 0)
        );
        if (issues.length === 0) {
            grid.innerHTML = this.renderEmptyState('暂无期刊数据', '内容正在更新中，敬请期待');
            return;
        }
        grid.innerHTML = issues.map(issue => {
            const meta = issue.metadata || {};
            const cover = meta.cover || 'https://picsum.photos/seed/issue/300/400';
            const title = meta.title || `第${meta.issueNumber || '?'}期`;
            const date = meta.publishDate ? this.formatDate(meta.publishDate) : '近期发布';
            return `
                <div class="journal-card" data-issue-number="${meta.issueNumber || ''}" aria-label="阅读${title}">
                    <div class="journal-cover">
                        <img src="${this.escapeHtml(cover)}" alt="${this.escapeHtml(title)}" loading="lazy">
                    </div>
                    <div class="journal-info">
                        <div class="journal-title">${this.escapeHtml(title)}</div>
                        <div class="journal-meta">${this.escapeHtml(date)}</div>
                    </div>
                </div>
            `;
        }).join('');
        grid.querySelectorAll('.journal-card').forEach(card => {
            card.addEventListener('click', () => {
                const issueNumber = card.dataset.issueNumber;
                this.showDirectory(issueNumber);
            });
        });
        console.log('渲染期刊列表:', issues.length, '期');
    }

    showDirectory(issueNumber) {
        const issue = window.journalManager?.allIssues?.find(i =>
            i.metadata?.issueNumber?.toString() === issueNumber?.toString()
        );
        if (!issue) {
            console.error('未找到期刊:', issueNumber);
            showToast('期刊数据不存在');
            return;
        }
        this.currentDirectoryIssue = issueNumber;
        this.navigationStack.push({ type: 'directory', issueNumber });
        const container = document.getElementById('bookshelfJournals');
        if (!container) return;
        const meta = issue.metadata || {};
        const title = meta.title || `第${issueNumber}期`;
        const categories = new Map();
        issue.articles?.forEach(article => {
            const cat = article.category || '未分类';
            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat).push(article);
        });
        let directoryHTML = `
            <div class="directory-wrapper">
                <div class="directory-header">
                    <button class="directory-back" id="directoryBackBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        返回期刊列表
                    </button>
                    <div class="directory-title">${this.escapeHtml(title)}</div>
                </div>
                <div class="directory-content">
        `;
        Array.from(categories.entries()).forEach(([category, articles]) => {
            const articleCount = articles.length;
            directoryHTML += `
                <section class="directory-section">
                    <h2 class="directory-section-title">
                        ${this.escapeHtml(category)}
                        <span class="directory-section-count">${articleCount}篇</span>
                    </h2>
                    <div class="directory-articles">
            `;
            articles.forEach((article) => {
                let avatarLetter = this.extractAuthorName(article.author).charAt(0) || '?';
                const excerpt = article.excerpt || '点击阅读正文...';
                directoryHTML += `
                    <article class="article-card glass" data-article-id="${article.id}" style="cursor: pointer;">
                        <div class="card-content">
                            <h3 class="card-title">${this.escapeHtml(article.title)}</h3>
                            <p class="card-excerpt">${this.escapeHtml(excerpt)}</p>
                            <div class="card-meta">
                                <span class="card-author">
                                    <span class="avatar">${avatarLetter}</span>
                                    ${this.escapeHtml(this.extractAuthorName(article.author))}
                                </span>
                                <span class="card-meta-divider">|</span>
                                <span class="card-category-tag">${this.escapeHtml(article.category || '未分类')}</span>
                            </div>
                        </div>
                    </article>
                `;
            });
            directoryHTML += `</div></section>`;
        });
        directoryHTML += `</div></div>`;
        container.innerHTML = directoryHTML;
        const backBtn = container.querySelector('#directoryBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showJournalsGrid();
            });
        }
        container.querySelectorAll('[data-article-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const articleId = card.dataset.articleId;
                if (articleId) this.openArticle(articleId, 'directory');
            });
        });
        this.scroll.scrollTop = 0;
        console.log('显示期刊目录:', issueNumber, '共', issue.articles?.length || 0, '篇文章');
    }

    showJournalsGrid() {
        const container = document.getElementById('bookshelfJournals');
        if (!container) return;
        container.innerHTML = `<div class="journals-grid" id="journalsGrid"></div>`;
        this.currentDirectoryIssue = null;
        this.renderJournals();
    }

    openArticle(articleId, fromPage = null) {
        if (!articleId) return;
        this.openedFromPage = fromPage || this.currentTab;
        if (this.currentDirectoryIssue) {
            this.shouldReturnToDirectory = true;
            this.returnToDirectoryIssue = this.currentDirectoryIssue;
        }
        this.addHistory(articleId);
        this.close();
        setTimeout(() => {
            if (typeof window.openReading === 'function') {
                window.openReading(articleId);
            } else if (window.globalReadingInstance) {
                window.globalReadingInstance.open(articleId);
            }
        }, 100);
        console.log('打开文章:', articleId, '来源页面:', this.openedFromPage);
    }

    returnFromReading() {
        if (this.openedFromPage === 'directory' && this.returnToDirectoryIssue) {
            console.log('从阅读页返回，恢复到目录:', this.returnToDirectoryIssue);
            this.open();
            setTimeout(() => {
                this.showDirectory(this.returnToDirectoryIssue);
                this.shouldReturnToDirectory = false;
                this.returnToDirectoryIssue = null;
                this.openedFromPage = null;
            }, 300);
            return true;
        }
        if (this.openedFromPage === 'favorites' || this.openedFromPage === 'history') {
            console.log('从阅读页返回，恢复到标签页:', this.openedFromPage);
            this.open();
            setTimeout(() => {
                this.switchTab(this.openedFromPage);
                this.openedFromPage = null;
            }, 300);
            return true;
        }
        return false;
    }

    toggleFavorite(articleId, articleData = null) {
        if (!articleId) return false;
        const favorites = this.loadFavorites();
        if (favorites[articleId]) {
            delete favorites[articleId];
            this.saveFavorites(favorites);
            console.log('已取消收藏:', articleId);
            return false;
        } else {
            let meta = articleData;
            if (!meta) {
                meta = window.journalManager?.getArticleMeta?.(articleId);
            }
            if (!meta) {
                console.error('无法获取文章元数据:', articleId);
                return false;
            }
            // ✅ 修复：保存 issueNumber
            favorites[articleId] = {
                title: meta.title || '未知标题',
                cover: meta.cover || '',
                author: this.extractAuthorName(meta.author),
                category: meta.category || '未分类',
                excerpt: meta.excerpt || '',
                issueNumber: meta.issueNumber || '', // 新增期刊号
                timestamp: Date.now()
            };
            this.saveFavorites(favorites);
            console.log('已收藏:', articleId, '期刊:', meta.issueNumber);
            return true;
        }
    }

    isFavorited(articleId) {
        const favorites = this.loadFavorites();
        return !!favorites[articleId];
    }

    loadFavorites() {
        try {
            const stored = localStorage.getItem(this.FAVORITES_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('收藏加载失败:', e);
            return {};
        }
    }

    saveFavorites(favorites) {
        try {
            localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
            if (window.globalReadingInstance?.currentArticleId) {
                const btn = document.getElementById('readingBookmark');
                if (btn) {
                    const isFavorited = !!favorites[window.globalReadingInstance.currentArticleId];
                    btn.classList.toggle('active', isFavorited);
                }
            }
            if (this.view?.classList.contains('active') && this.currentTab === 'favorites') {
                this.renderFavorites();
            }
        } catch (e) {
            console.error('收藏保存失败:', e);
        }
    }

    deleteFavorite(articleId) {
        const favorites = this.loadFavorites();
        if (favorites[articleId]) {
            delete favorites[articleId];
            this.saveFavorites(favorites);
            showToast('已取消收藏');
            return true;
        }
        return false;
    }

    // ✅ 辅助方法：安全提取作者姓名
    extractAuthorName(author) {
        if (!author) return '佚名';
        if (typeof author === 'string') return author.trim() || '佚名';
        if (author.name && typeof author.name === 'string') return author.name.trim() || '佚名';
        return '佚名';
    }

    renderFavorites() {
        const container = document.getElementById('favoritesContainer');
        if (!container) return;
        const favorites = this.loadFavorites();
        const favoriteIds = Object.keys(favorites).sort((a, b) =>
            favorites[b].timestamp - favorites[a].timestamp
        );
        this.updateToolbar();
        if (favoriteIds.length === 0) {
            container.innerHTML = `
                <div class="bookshelf-empty">
                    <div class="bookshelf-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <h3>暂无收藏文章</h3>
                    <p>点击文章右上角的收藏按钮，即可将喜欢的文章加入书架</p>
                </div>
            `;
            return;
        }
        container.innerHTML = favoriteIds.map((articleId, index) => {
            const fav = favorites[articleId];
            const meta = window.journalManager?.getArticleMeta?.(articleId) || {};
            const title = fav.title || meta.title || '未知标题';
            // ✅ 修复：优先使用收藏中的 author，其次元数据
            const authorName = fav.author || this.extractAuthorName(meta.author);
            const category = fav.category || meta.category || '未分类';
            const excerpt = fav.excerpt || meta.excerpt || '摘要加载中...';
            // ✅ 修复：获取期刊号
            const issueNumber = fav.issueNumber || meta.issueNumber || '';
            const articleIssueInfo = issueNumber ? `第${issueNumber}期` : '';
            let avatarLetter = authorName.charAt(0) || '?';
            if (['<', '&', '>'].includes(avatarLetter)) avatarLetter = '?';
            return `
                <article class="article-card glass bookmark-card ${this.isBatchMode ? 'batch-mode' : ''}" 
                         data-article-id="${articleId}" 
                         style="animation:bookshelfFadeInUp 0.5s ease forwards ${index * 0.05}s; opacity:0">
                    ${this.isBatchMode ? `
                        <div class="batch-checkbox ${this.selectedItems.has(articleId) ? 'checked' : ''}" 
                             data-article-id="${articleId}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    ` : ''}
                    <div class="card-content">
                        <h3 class="card-title">${this.escapeHtml(title)}</h3>
                        <p class="card-excerpt">${this.escapeHtml(excerpt)}</p>
                        <div class="card-meta">
                            <span class="card-author">
                                <span class="avatar">${avatarLetter}</span>
                                ${this.escapeHtml(authorName)}
                            </span>
                            <span class="card-meta-divider">|</span>
                            ${articleIssueInfo ? `<span class="card-issue">${articleIssueInfo}</span><span class="card-meta-divider">|</span>` : ''}
                            <span class="card-category-tag">${this.escapeHtml(category)}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        this.bindCardEvents(container, 'favorites');
        console.log('渲染收藏列表:', favoriteIds.length, '篇');
    }

    addHistory(articleId) {
        if (!articleId) return;
        try {
            let history = this.loadHistory();
            const existingIndex = history.findIndex(item => item.articleId === articleId);
            if (existingIndex !== -1) {
                history.splice(existingIndex, 1);
            }
            history.unshift({ articleId, timestamp: Date.now() });
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
            if (this.view?.classList.contains('active') && this.currentTab === 'history') {
                this.renderHistory();
            }
            console.log('已记录浏览历史:', articleId);
        } catch (e) {
            console.error('历史记录保存失败:', e);
        }
    }

    loadHistory() {
        try {
            const stored = localStorage.getItem(this.HISTORY_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('历史记录加载失败:', e);
            return [];
        }
    }

    deleteHistory(articleId) {
        try {
            let history = this.loadHistory();
            history = history.filter(item => item.articleId !== articleId);
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
            if (this.view?.classList.contains('active') && this.currentTab === 'history') {
                this.renderHistory();
            }
            showToast('已删除历史记录');
            return true;
        } catch (e) {
            console.error('历史记录删除失败:', e);
            return false;
        }
    }

    clearHistory() {
        try {
            localStorage.removeItem(this.HISTORY_KEY);
            if (this.view?.classList.contains('active') && this.currentTab === 'history') {
                this.renderHistory();
            }
            showToast('历史记录已清空');
        } catch (e) {
            console.error('清空历史记录失败:', e);
        }
    }

    renderHistory() {
        const container = document.getElementById('historyContainer');
        if (!container) return;
        let history = this.loadHistory();
        if (this.historySortOrder === 'desc') {
            history.sort((a, b) => b.timestamp - a.timestamp);
        } else {
            history.sort((a, b) => a.timestamp - b.timestamp);
        }
        this.updateToolbar();
        if (history.length === 0) {
            container.innerHTML = `
                <div class="bookshelf-empty">
                    <div class="bookshelf-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </div>
                    <h3>暂无浏览历史</h3>
                    <p>阅读文章后，历史记录将自动保存在此处</p>
                </div>
            `;
            return;
        }
        container.innerHTML = history.map((item, index) => {
            const meta = window.journalManager?.getArticleMeta?.(item.articleId);
            if (!meta) return '';
            const authorName = this.extractAuthorName(meta.author);
            let avatarLetter = authorName.charAt(0) || '?';
            if (['<', '&', '>'].includes(avatarLetter)) avatarLetter = '?';
            const excerpt = meta.excerpt || '摘要加载中...';
            // ✅ 修复：显示期刊号
            const issueNumber = meta.issueNumber || '';
            const articleIssueInfo = issueNumber ? `第${issueNumber}期` : '';
            return `
                <article class="article-card glass history-card ${this.isBatchMode ? 'batch-mode' : ''}" 
                         data-article-id="${item.articleId}" 
                         style="animation:bookshelfFadeInUp 0.5s ease forwards ${index * 0.05}s; opacity:0">
                    ${this.isBatchMode ? `
                        <div class="batch-checkbox ${this.selectedItems.has(item.articleId) ? 'checked' : ''}" 
                             data-article-id="${item.articleId}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    ` : ''}
                    <div class="card-content">
                        <h3 class="card-title">${this.escapeHtml(meta.title)}</h3>
                        <p class="card-excerpt">${this.escapeHtml(excerpt)}</p>
                        <div class="card-meta">
                            <span class="card-author">
                                <span class="avatar">${avatarLetter}</span>
                                ${this.escapeHtml(authorName)}
                            </span>
                            <span class="card-meta-divider">|</span>
                            ${articleIssueInfo ? `<span class="card-issue">${articleIssueInfo}</span><span class="card-meta-divider">|</span>` : ''}
                            <span class="card-category-tag">${this.escapeHtml(meta.category || '未分类')}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        this.bindCardEvents(container, 'history');
        console.log('渲染历史列表:', history.length, '条');
    }

    bindCardEvents(container, tabType) {
        container.querySelectorAll('.bookmark-card, .history-card, .article-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.batch-checkbox')) return;
                if (this.isBatchMode) {
                    this.toggleBatchSelection(card.dataset.articleId);
                } else {
                    this.openArticle(card.dataset.articleId, tabType);
                }
            });
        });
        container.querySelectorAll('.batch-checkbox').forEach(box => {
            box.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleBatchSelection(box.dataset.articleId);
            });
        });
    }

    toggleBatchMode() {
        this.isBatchMode = !this.isBatchMode;
        const toggleBtn = document.getElementById('batchToggleBtn');
        if (toggleBtn) toggleBtn.classList.toggle('active', this.isBatchMode);
        if (this.isBatchMode) {
            this.selectedItems.clear();
            document.body.classList.add('batch-mode-active');
            document.getElementById('batchToolbar')?.classList.add('active');
            document.getElementById('batchCounter').textContent = '0 项已选';
            this.updateSelectAllButton();
        } else {
            this.selectedItems.clear();
            document.body.classList.remove('batch-mode-active');
            document.getElementById('batchToolbar')?.classList.remove('active');
            document.getElementById('batchCounter').textContent = '0 项已选';
        }
        if (this.currentTab === 'favorites') {
            this.renderFavorites();
        } else if (this.currentTab === 'history') {
            this.renderHistory();
        }
    }

    exitBatchMode() {
        this.isBatchMode = false;
        this.selectedItems.clear();
        document.body.classList.remove('batch-mode-active');
        document.getElementById('batchToolbar')?.classList.remove('active');
        document.getElementById('batchCounter').textContent = '0 项已选';
        document.getElementById('batchToggleBtn')?.classList.remove('active');
        if (this.currentTab === 'favorites') {
            this.renderFavorites();
        } else if (this.currentTab === 'history') {
            this.renderHistory();
        }
    }

    toggleBatchSelection(articleId) {
        if (this.selectedItems.has(articleId)) {
            this.selectedItems.delete(articleId);
        } else {
            this.selectedItems.add(articleId);
        }
        document.getElementById('batchCounter').textContent = `${this.selectedItems.size} 项已选`;
        document.querySelectorAll(`.batch-checkbox[data-article-id="${articleId}"]`).forEach(box => {
            box.classList.toggle('checked', this.selectedItems.has(articleId));
        });
        this.updateSelectAllButton();
    }

    toggleSelectAll() {
        const containerId = this.currentTab === 'favorites' ? 'favoritesContainer' : 'historyContainer';
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = container.querySelectorAll('.bookmark-card, .history-card');
        const totalItems = cards.length;
        const selectedCount = this.selectedItems.size;
        if (selectedCount >= totalItems && totalItems > 0) {
            this.selectedItems.clear();
            container.querySelectorAll('.batch-checkbox').forEach(box => box.classList.remove('checked'));
        } else {
            cards.forEach(card => {
                const articleId = card.dataset.articleId;
                if (articleId) this.selectedItems.add(articleId);
            });
            container.querySelectorAll('.batch-checkbox').forEach(box => box.classList.add('checked'));
        }
        document.getElementById('batchCounter').textContent = `${this.selectedItems.size} 项已选`;
        this.updateSelectAllButton();
    }

    updateSelectAllButton() {
        const containerId = this.currentTab === 'favorites' ? 'favoritesContainer' : 'historyContainer';
        const container = document.getElementById(containerId);
        const selectAllBtn = document.getElementById('batchSelectAll');
        if (!container || !selectAllBtn) return;
        const cards = container.querySelectorAll('.bookmark-card, .history-card');
        const totalItems = cards.length;
        const selectedCount = this.selectedItems.size;
        if (totalItems > 0 && selectedCount >= totalItems) {
            selectAllBtn.classList.add('selected');
            selectAllBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                取消全选
            `;
        } else {
            selectAllBtn.classList.remove('selected');
            selectAllBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                全选
            `;
        }
    }

    batchDelete() {
        if (this.selectedItems.size === 0) {
            showToast('请先选择要删除的项目');
            return;
        }
        this.showDeleteConfirmModal(() => {
            if (this.currentTab === 'favorites') {
                const favorites = this.loadFavorites();
                this.selectedItems.forEach(id => delete favorites[id]);
                this.saveFavorites(favorites);
            } else if (this.currentTab === 'history') {
                let history = this.loadHistory();
                history = history.filter(item => !this.selectedItems.has(item.articleId));
                localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
                this.renderHistory();
            }
            showToast(`已删除 ${this.selectedItems.size} 项`);
            this.exitBatchMode();
        });
    }

    showDeleteConfirmModal(onConfirm) {
        if (this.activeModal) {
            this.activeModal.remove();
            this.activeModal = null;
        }
        const modal = document.createElement('div');
        modal.className = 'bookshelf-modal';
        modal.innerHTML = `
            <div class="bookshelf-modal-content">
                <button class="bookshelf-modal-close">&times;</button>
                <div class="bookshelf-modal-icon">⚠</div>
                <h2 class="bookshelf-modal-title">确认删除</h2>
                <p class="bookshelf-modal-desc">确定要删除选中的 ${this.selectedItems.size} 项吗？此操作不可撤销。</p>
                <div class="bookshelf-modal-actions">
                    <button class="bookshelf-modal-btn bookshelf-modal-btn-cancel">取消</button>
                    <button class="bookshelf-modal-btn bookshelf-modal-btn-confirm">删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.activeModal = modal;
        setTimeout(() => modal.classList.add('active'), 10);
        modal.querySelector('.bookshelf-modal-close')?.addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('.bookshelf-modal-btn-cancel')?.addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('.bookshelf-modal-btn-confirm')?.addEventListener('click', () => {
            this.closeModal(modal);
            if (typeof onConfirm === 'function') onConfirm();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        setTimeout(() => {
            if (modal.parentNode) modal.remove();
            if (this.activeModal === modal) this.activeModal = null;
        }, 300);
    }

    renderEmptyState(title, desc) {
        return `
            <div class="bookshelf-empty">
                <div class="bookshelf-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 20.5L12 3.5M12 20.5C10.067 20.5 8.5 18.933 8.5 17C8.5 15.067 10.067 13.5 12 13.5C13.933 13.5 15.5 15.067 15.5 17C15.5 18.933 13.933 20.5 12 20.5ZM12 20.5V17"/>
                    </svg>
                </div>
                <h3>${this.escapeHtml(title)}</h3>
                <p>${this.escapeHtml(desc)}</p>
            </div>
        `;
    }

    extractExcerpt(text, length = 100) {
        if (!text || typeof text !== 'string') return '内容不可用';
        const plainText = text.replace(/!\[.*?\]\(.*?\)|\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[*_~`#\-\+\=]/g, '')
            .replace(/\n/g, ' ')
            .trim();
        return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
    }

    formatDate(dateStr) {
        if (!dateStr) return '近期发布';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

const bookshelfSystem = new BookshelfSystem();
window.bookshelfSystem = bookshelfSystem;

document.addEventListener('DOMContentLoaded', () => {
    const initBookshelf = () => {
        if (window.journalManager?.loaded) {
            bookshelfSystem.init();
            if (window.globalReadingInstance) {
                window.globalReadingInstance.toggleFavorite = (articleId) => bookshelfSystem.toggleFavorite(articleId);
                window.globalReadingInstance.isFavorited = (articleId) => bookshelfSystem.isFavorited(articleId);
            }
            console.log('书架系统已集成到主应用');
        } else {
            setTimeout(initBookshelf, 200);
        }
    };
    initBookshelf();
});

window.toggleFavorite = (articleId, articleData) => bookshelfSystem.toggleFavorite(articleId, articleData);
window.isFavorited = (articleId) => bookshelfSystem.isFavorited(articleId);
window.addHistory = (articleId) => bookshelfSystem.addHistory(articleId);
window.returnFromBookshelfReading = () => {
    if (window.bookshelfSystem?.isInitialized) return window.bookshelfSystem.returnFromReading();
    return false;
};