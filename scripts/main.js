/**
 * 铜鼓之声项目 - 核心交互逻辑（异步按需加载架构 v28.0.0）
 * 版本：v28.0.0 (元数据+异步加载正文)
 * 功能：期刊元数据管理 + 阅读系统 + 搜索 + 标签 + 书架集成
 */
console.log('=== 铜鼓之声系统启动 (v28.0.0 - 异步按需加载) ===');

// ===============================
// 期刊数据管理器 (异步按需加载版)
// ===============================
class JournalManager {
  constructor() {
    this.currentIssue = null;
    this.allIssues = [];
    // 仅缓存元数据（不含正文）
    this.articlesMetaCache = new Map();
    // 独立缓存正文内容（按需加载后缓存）
    this.articlesContentCache = new Map();
    // 防止重复请求同一篇文章
    this.pendingContentRequests = new Map();
    this.loaded = false;
    this.categoryArticleCount = new Map();
    this.categoryNameMap = new Map();
  }

  initialize() {
    console.log('开始初始化期刊管理器 (Meta异步模式)...');
    try {
      // 优先读取元数据全局变量
      if (window.allJournalMetaIssues && Array.isArray(window.allJournalMetaIssues) && window.allJournalMetaIssues.length > 0) {
        this.allIssues = window.allJournalMetaIssues;
        console.log('检测到元数据收集池：' + this.allIssues.length + ' 期期刊元数据');
      }
      // 兼容旧数据结构（降级方案）
      else if (window.allJournalIssues && Array.isArray(window.allJournalIssues) && window.allJournalIssues.length > 0) {
        this.allIssues = window.allJournalIssues;
        console.warn('检测到全量数据（兼容模式），建议迁移到纯元数据架构');
      }
      else if (window.journalIssues && Array.isArray(window.journalIssues)) {
        this.allIssues = window.journalIssues;
        console.warn('检测到 journalIssues 数组（兼容模式）');
      }
      else if (window.journalIssue) {
        this.allIssues = [window.journalIssue];
        console.warn('检测到单期数据（兼容模式）');
      }
      else {
        console.error('期刊数据未找到 - 请检查 meta JS 文件是否加载');
        return false;
      }
      
      // 构建元数据缓存（排除 content 字段）
      this.cacheAllArticlesMeta();
      
      // 设置当前期刊
      if (this.allIssues.length > 0) {
        this.currentIssue = this.allIssues[this.allIssues.length - 1];
        console.log('当前展示期刊：' + (this.currentIssue.metadata?.issueNumber || '未知'));
      }
      
      this.loaded = true;
      console.log('期刊元数据系统初始化完成，共缓存 ' + this.articlesMetaCache.size + ' 篇文章骨架');
      this.logCategoryStats();
      return true;
    } catch (error) {
      console.error('期刊初始化异常:', error);
      return false;
    }
  }

  cacheAllArticlesMeta() {
    console.log('开始聚合所有期刊文章元数据...');
    this.articlesMetaCache.clear();
    this.categoryArticleCount.clear();
    this.categoryNameMap.clear();
    
    this.allIssues.forEach((issue) => {
      if (!issue.articles) return;
      issue.articles.forEach(article => {
        // 核心：排除 content 字段，仅存储元数据
        const { content, ...meta } = article;
        const articleMeta = {
          ...meta,
          issueNumber: issue.metadata?.issueNumber || '未知',
          category: meta.category ? meta.category.trim() : '未分类'
        };
        this.articlesMetaCache.set(articleMeta.id, articleMeta);
        
        // 统计分类
        const category = articleMeta.category;
        this.categoryArticleCount.set(
          category,
          (this.categoryArticleCount.get(category) || 0) + 1
        );
        const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
        this.categoryNameMap.set(normalizedCategory, category);
      });
    });
    console.log('分类统计:', Object.fromEntries(this.categoryArticleCount));
  }

  // ✅ 核心异步方法：获取完整文章（含正文）
  async getArticle(articleId) {
    // 1. 获取元数据（同步）
    const meta = this.articlesMetaCache.get(articleId);
    if (!meta) {
      console.warn('未找到文章元数据:', articleId);
      return null;
    }
    
    // 2. 兼容旧数据：如果元数据中已包含 content（降级情况）
    if (meta.content) {
      return meta;
    }
    
    // 3. 检查正文缓存
    if (this.articlesContentCache.has(articleId)) {
      return { ...meta, content: this.articlesContentCache.get(articleId) };
    }
    
    // 4. 检查是否有进行中的请求（防止重复加载）
    if (this.pendingContentRequests.has(articleId)) {
      const content = await this.pendingContentRequests.get(articleId);
      return { ...meta, content };
    }
    
    // 5. 发起异步加载
    const loadPromise = this.loadArticleContent(articleId);
    this.pendingContentRequests.set(articleId, loadPromise);
    
    try {
      const content = await loadPromise;
      this.articlesContentCache.set(articleId, content);
      return { ...meta, content };
    } catch (error) {
      console.error('文章正文加载失败:', articleId, error);
      // 降级方案：尝试从旧数据源获取（兼容模式）
      if (window.journalManager?.articlesCache?.has(articleId)) {
        const fallback = window.journalManager.articlesCache.get(articleId);
        if (fallback.content) {
          this.articlesContentCache.set(articleId, fallback.content);
          return { ...meta, content: fallback.content };
        }
      }
      // 返回错误提示内容
      return { ...meta, content: '<p>文章内容加载失败，请稍后重试。</p>' };
    } finally {
      this.pendingContentRequests.delete(articleId);
    }
  }

  // ✅ 新增：动态加载单篇文章内容文件
  async loadArticleContent(articleId) {
    const scriptUrl = 'journals/articles/' + articleId + '.js';
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      
      script.onload = () => {
        // 约定：文章文件将内容挂载到 window.__tempArticleContent
        if (window.__tempArticleContent) {
          const content = window.__tempArticleContent;
          delete window.__tempArticleContent; // 清理全局变量
          resolve(content);
        } else {
          reject(new Error('Content variable not found after script load'));
        }
        // 移除已加载的 script 标签
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
      
      script.onerror = () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject(new Error('Failed to load article script: ' + scriptUrl));
      };
      
      document.body.appendChild(script);
    });
  }

  // 同步获取元数据（用于列表渲染、搜索等）
  getArticleMeta(articleId) {
    return this.articlesMetaCache.get(articleId);
  }

  getAllArticles() {
    return Array.from(this.articlesMetaCache.values()).sort((a, b) => {
      return b.id.localeCompare(a.id);
    });
  }

  getArticlesByCategory(category) {
    if (!category) return [];
    const articles = [];
    const normalizedInput = category.trim().toLowerCase().replace(/\s+/g, '');
    for (const articleMeta of this.articlesMetaCache.values()) {
      const articleCategory = articleMeta.category || '';
      const normalizedArticleCategory = articleCategory.trim().toLowerCase().replace(/\s+/g, '');
      if (
        articleCategory.trim() === category.trim() ||
        normalizedArticleCategory === normalizedInput ||
        articleCategory.includes(category) ||
        category.includes(articleCategory)
      ) {
        articles.push(articleMeta);
      }
    }
    return articles;
  }

  getRandomArticles(count = 20, category = null) {
    let pool = [];
    if (category && category !== "推荐") {
      pool = this.getArticlesByCategory(category);
    } else {
      pool = this.getAllArticles();
    }
    if (pool.length === 0) return [];
    const actualCount = Math.min(count, pool.length);
    const poolCopy = [...pool];
    const shuffled = JournalManager.shuffleArray(poolCopy);
    return shuffled.slice(0, actualCount);
  }

  static shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  searchArticles(query) {
    const results = [];
    const normalizedQuery = query.toLowerCase().trim();
    for (const articleMeta of this.articlesMetaCache.values()) {
      const title = articleMeta.title?.toLowerCase() || '';
      const category = articleMeta.category?.toLowerCase() || '';
      const authorName = articleMeta.author?.name?.toLowerCase() || '';
      const excerpt = articleMeta.excerpt?.toLowerCase() || '';
      const articleId = articleMeta.id?.toLowerCase() || '';
      if (
        title.includes(normalizedQuery) ||
        category.includes(normalizedQuery) ||
        authorName.includes(normalizedQuery) ||
        excerpt.includes(normalizedQuery) ||
        articleId.includes(normalizedQuery)
      ) {
        results.push(articleMeta);
      }
    }
    console.log('搜索 "' + query + '": 找到', results.length, '篇文章 (元数据搜索)');
    return results;
  }

  getMetadata() {
    return this.currentIssue?.metadata || null;
  }

  getIssueInfo() {
    const metadata = this.getMetadata();
    if (!metadata) return '选自最新期刊';
    const issueNumber = metadata.issueNumber;
    if (issueNumber) return '选自第' + issueNumber + '期';
    return '选自最新期刊';
  }

  getCategoryArticleCount(category) {
    return this.categoryArticleCount.get(category) || 0;
  }

  categoryExists(category) {
    return this.categoryArticleCount.has(category) && this.categoryArticleCount.get(category) > 0;
  }

  getAllCategories() {
    return Array.from(this.categoryArticleCount.keys());
  }

  logCategoryStats() {
    console.log('========== 分类文章统计 ==========');
    for (const [category, count] of this.categoryArticleCount.entries()) {
      console.log('   ' + category + ': ' + count + ' 篇');
    }
    console.log('==================================');
  }
}

console.log('初始化期刊管理器...');
const journalManager = new JournalManager();
window.journalManager = journalManager;

// ===============================
// 侧边栏吸附优化器 (保持不变)
// ===============================
class SidebarStickyOptimizer {
  constructor() {
    this.sidebar = null;
    this.footer = null;
    this.defaultTop = 96;
    this.gap = 70;
    this.scrollHandler = null;
    this.resizeHandler = null;
    this.rafId = null;
  }

  init() {
    if (window.innerWidth <= 992) return;
    this.sidebar = document.querySelector('.sidebar');
    this.footer = document.querySelector('.footer');
    if (!this.sidebar || !this.footer) {
      console.warn('未找到 sidebar 或 footer，跳过吸附优化');
      return;
    }
    console.log('初始化侧边栏吸附优化器...');
    this.bindEvents();
    this.optimize();
  }

  bindEvents() {
    this.scrollHandler = () => {
      if (this.rafId) return;
      this.rafId = requestAnimationFrame(() => {
        this.optimize();
        this.rafId = null;
      });
    };
    this.resizeHandler = () => {
      if (window.innerWidth <= 992) {
        this.sidebar.style.top = 'auto';
      } else {
        this.sidebar.style.top = this.defaultTop + 'px';
        this.optimize();
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  optimize() {
    if (!this.sidebar || !this.footer) return;
    if (window.innerWidth <= 992) return;
    
    const scrollTop = window.scrollY;
    const footerRect = this.footer.getBoundingClientRect();
    const footerTop = footerRect.top + scrollTop;
    const sidebarHeight = this.sidebar.offsetHeight;
    const maxSidebarBottom = footerTop - this.gap;
    const currentSidebarBottom = scrollTop + this.defaultTop + sidebarHeight;
    
    if (currentSidebarBottom > maxSidebarBottom) {
      const newTop = maxSidebarBottom - scrollTop - sidebarHeight;
      this.sidebar.style.top = newTop + 'px';
    } else {
      this.sidebar.style.top = this.defaultTop + 'px';
    }
  }

  destroy() {
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}

const sidebarOptimizer = new SidebarStickyOptimizer();
window.sidebarOptimizer = sidebarOptimizer;

// ===============================
// 搜索系统管理器 (适配元数据)
// ===============================
class SearchManager {
  constructor() {
    this.articleGrid = null;
    this.articlesSection = null;
    this.sidebarSearchInput = null;
    this.originalSectionHeaderHTML = null;
    this.isSearchActive = false;
    this.dropdownElement = null;
    this.scrollHandler = null;
    this.resizeHandler = null;
    this.scrollListenerAttached = false;
    this.searchResultsCache = [];
  }

  init() {
    console.log('初始化搜索管理系统...');
    this.articleGrid = document.querySelector('.article-grid');
    this.articlesSection = document.querySelector('#articles');
    this.sidebarSearchInput = document.querySelector('.sidebar .search-box input');
    
    if (!this.articleGrid) {
      console.error('未找到文章网格容器 (.article-grid)');
      return;
    }
    
    const originalHeader = this.articlesSection.querySelector('.section-header');
    if (originalHeader) {
      this.originalSectionHeaderHTML = originalHeader.innerHTML;
      console.log('保存原始标题 HTML');
    }
    
    this.bindEvents();
    console.log('搜索管理系统初始化完成');
  }

  bindEvents() {
    if (this.sidebarSearchInput) {
      this.sidebarSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = this.sidebarSearchInput.value.trim();
          if (query) {
            this.performSearch(query);
          } else {
            this.resetToOriginalView();
          }
        }
      });
      
      const searchBtn = this.sidebarSearchInput.parentElement.querySelector('svg');
      if (searchBtn) {
        searchBtn.addEventListener('click', () => {
          const query = this.sidebarSearchInput.value.trim();
          if (query) {
            this.performSearch(query);
          } else {
            this.resetToOriginalView();
          }
        });
      }
      
      let debounceTimer;
      this.sidebarSearchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const query = this.sidebarSearchInput.value.trim();
          if (query) {
            this.performSearch(query);
          } else if (this.isSearchActive) {
            this.resetToOriginalView();
          }
        }, 300);
      });
      
      this.sidebarSearchInput.addEventListener('focus', () => {
        this.onSearchBoxFocused();
      });
      
      this.sidebarSearchInput.addEventListener('blur', () => {
        this.onSearchBoxBlurred();
      });
    }
    
    window.addEventListener('scroll', () => {
      this.hideSearchHistory();
    }, { passive: true });
  }

  onSearchBoxFocused() {
    this.dropdownElement = document.getElementById('search-history-dropdown');
    if (this.dropdownElement && window.searchHistoryManager) {
      window.searchHistoryManager.renderHistoryDropdown(this.sidebarSearchInput.value);
      this.attachScrollAndResizeListener();
    }
  }

  onSearchBoxBlurred() {
    this.detachScrollAndResizeListener();
  }

  hideSearchHistory() {
    if (this.dropdownElement) {
      this.dropdownElement.style.display = 'none';
    }
    this.detachScrollAndResizeListener();
  }

  handleScrollOrResize = () => {
    if (this.dropdownElement && this.dropdownElement.style.display === 'block') {
      this.updateDropdownPosition();
    }
  };

  updateDropdownPosition() {
    const searchBox = document.querySelector('.sidebar .search-box');
    if (!searchBox || !this.dropdownElement) return;
    
    const searchRect = searchBox.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    this.dropdownElement.style.width = searchRect.width + 'px';
    this.dropdownElement.style.minWidth = '280px';
    
    let leftPosition = searchRect.left;
    if (leftPosition + searchRect.width > viewportWidth - 10) {
      leftPosition = viewportWidth - searchRect.width - 10;
    }
    if (leftPosition < 10) leftPosition = 10;
    
    const topPosition = searchRect.bottom + 8;
    
    this.dropdownElement.style.position = 'fixed';
    this.dropdownElement.style.left = leftPosition + 'px';
    this.dropdownElement.style.top = topPosition + 'px';
    this.dropdownElement.style.right = 'auto';
    this.dropdownElement.style.bottom = 'auto';
    this.dropdownElement.style.zIndex = '1100';
  }

  attachScrollAndResizeListener() {
    if (this.scrollListenerAttached) return;
    this.scrollHandler = this.handleScrollOrResize.bind(this);
    this.resizeHandler = this.handleScrollOrResize.bind(this);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    this.scrollListenerAttached = true;
  }

  detachScrollAndResizeListener() {
    if (!this.scrollListenerAttached) return;
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.scrollListenerAttached = false;
  }

  performSearch(query) {
    console.log('执行搜索：' + query);
    this.isSearchActive = true;
    
    if (window.searchHistoryManager) {
      window.searchHistoryManager.addSearchQuery(query);
    }
    
    const results = journalManager.searchArticles(query);
    this.searchResultsCache = results;
    this.replaceSectionHeader(query, results.length);
    this.renderSearchResults(results, query);
  }

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
        " onmouseover="this.style.background='var(--bg-secondary)';this.style.color='var(--text-primary)'" onmouseout="this.style.background='var(--bg-tertiary)';this.style.color='var(--text-secondary)'">
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

  renderSearchResults(results, query) {
    if (!this.articleGrid) {
      console.error('未找到文章网格容器');
      return;
    }
    
    console.log('开始渲染搜索结果:', results.length, '篇');
    
    if (results.length === 0) {
      this.showNoResults(query);
      return;
    }
    
    const existingNoResults = this.articleGrid.querySelector('.search-no-results');
    if (existingNoResults) existingNoResults.remove();
    
    const fragment = document.createDocumentFragment();
    const issueInfo = journalManager.getIssueInfo() || '选自最新期刊';
    
    results.forEach((article, index) => {
      const hasCover = article.cover && article.cover.trim().length > 0;
      const coverHtml = hasCover
        ? '<div class="card-image"><img src="' + article.cover + '" alt="' + article.title + '" loading="lazy"></div>'
        : '';
      
      let avatarLetter = '?';
      if (article.author && article.author.name) {
        const firstName = article.author.name.trim().charAt(0);
        if (firstName && firstName !== '<' && firstName !== '&' && firstName !== '>') {
          avatarLetter = firstName;
        }
      }
      
      const articleIssueInfo = article.issueNumber ? '第' + article.issueNumber + '期' : issueInfo;
      
      const card = document.createElement('article');
      card.className = 'article-card glass';
      card.style.setProperty('--i', index);
      card.dataset.article = article.id;
      card.tabIndex = 0;
      card.role = 'button';
      card.setAttribute('aria-label', '阅读：' + article.title);
      card.style.opacity = '0';
      card.style.animation = 'fadeInUp 0.4s ease forwards ' + (index * 0.05) + 's';
      
      const highlightedTitle = this.highlightText(article.title, query);
      const highlightedAuthor = this.highlightText(article.author.name, query);
      const highlightedCategory = this.highlightText(article.category, query);
      const excerpt = article.excerpt || this.extractExcerpt(article, query);
      
      card.innerHTML = `
        ${coverHtml}
        <div class="card-content">
          <h3 class="card-title">${highlightedTitle}</h3>
          <p class="card-excerpt">${excerpt}</p>
          <div class="card-meta">
            <span class="card-author">
              <span class="avatar">${avatarLetter}</span>
              ${highlightedAuthor}
            </span>
            <span class="card-meta-divider">|</span>
            <span class="card-issue">${articleIssueInfo}</span>
            <span class="card-meta-divider">|</span>
            <span class="card-category-tag">${highlightedCategory}</span>
          </div>
        </div>
      `;
      
      fragment.appendChild(card);
    });
    
    this.articleGrid.innerHTML = '';
    this.articleGrid.appendChild(fragment);
    console.log('搜索结果显示 ' + results.length + ' 篇文章');
  }

  highlightText(text, query) {
    if (!query || query.trim() === '') return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  extractExcerpt(article, query, length = 120) {
    let text = article.excerpt;
    if (!text && article.content) text = article.content;
    if (!text || typeof text !== 'string') return '点击阅读正文...';
    const plainText = text.replace(/!\[.*?\]\(.*?\)|\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*_~`#\-\+\=]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    const queryIndex = plainText.toLowerCase().indexOf(query.toLowerCase());
    if (queryIndex !== -1 && queryIndex > 20) {
      const start = Math.max(0, queryIndex - 20);
      const excerpt = plainText.substring(start, start + length);
      return (queryIndex > 20 ? '...' : '') + excerpt + '...';
    }
    return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
  }

  showNoResults(query) {
    const existingNoResults = this.articleGrid.querySelector('.search-no-results');
    if (existingNoResults) existingNoResults.remove();
    
    this.articleGrid.innerHTML = '';
    
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
            请尝试其他关键词或检查拼写
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:32px">
            <button class="search-back-btn" id="searchBackToHome" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 20px;
                background: var(--accent-primary);
                color: var(--bg-primary);
                border: none;
                border-radius: 10px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
                line-height: 1;
            ">
                <span style="display:inline-block; line-height:1;">返回推荐页</span>
            </button>
            <button class="search-back-btn" id="searchClearInput" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 20px;
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
                line-height: 1;
            ">
                <span style="display:inline-block; line-height:1;">清空搜索</span>
            </button>
        </div>
        <div style="margin-top:0;padding:20px;background:var(--bg-secondary);border-radius:12px;max-width:500px;width:100%">
            <p style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);margin-bottom:12px">搜索提示：</p>
            <ul style="font-size:0.85rem;color:var(--text-tertiary);text-align:left;line-height:1.8;padding-left:20px;margin:0">
                <li>尝试使用更短或更通用的关键词</li>
                <li>检查拼写是否正确</li>
                <li>支持搜索文章标题、文章ID、作者、分类标签</li>
                <li>浏览推荐文章发现更多内容</li>
            </ul>
        </div>
    `;
    this.articleGrid.appendChild(noResults);
    
    setTimeout(() => {
        const backToHomeBtn = document.getElementById('searchBackToHome');
        const clearInputBtn = document.getElementById('searchClearInput');
        
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                this.resetToOriginalView();
            });
            backToHomeBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 12px var(--accent-glow)';
            });
            backToHomeBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        }
        
        if (clearInputBtn) {
            clearInputBtn.addEventListener('click', () => {
                this.sidebarSearchInput.value = '';
                this.resetToOriginalView();
            });
            clearInputBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.borderColor = 'var(--accent-primary)';
                this.style.color = 'var(--accent-primary)';
            });
            clearInputBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.borderColor = 'var(--border-color)';
                this.style.color = 'var(--text-primary)';
            });
        }
    }, 100);
    
    console.log('显示无结果页面');
  }

  resetToOriginalView() {
    if (!this.articlesSection || !this.originalSectionHeaderHTML) return;
    
    const currentHeader = this.articlesSection.querySelector('.section-header');
    if (currentHeader) {
      currentHeader.innerHTML = this.originalSectionHeaderHTML;
      console.log('原始标题已恢复');
    }
    
    if (this.sidebarSearchInput) {
      this.sidebarSearchInput.value = '';
    }
    
    this.isSearchActive = false;
    this.searchResultsCache = [];
    
    if (window.globalReadingInstance) {
      window.globalReadingInstance.updateHomePage();
    }
    
    console.log('已返回推荐页');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const searchManager = new SearchManager();
window.searchManager = searchManager;

// ===============================
// 全局函数定义
// ===============================
let globalReadingInstance = null;

// 修改为异步调用
async function openReading(articleId) {
  console.log('打开文章:', articleId);
  if (globalReadingInstance) {
    await globalReadingInstance.open(articleId);
  } else {
    console.error('阅读实例未初始化');
  }
}
window.openReading = openReading;

// ===============================
// 全屏阅读系统（异步加载集成版）
// ===============================
class ReadingSystem {
  constructor() {
    this.view = document.getElementById('readingView');
    this.scroll = document.getElementById('readingScroll');
    this.header = document.getElementById('readingHeader');
    this.content = document.getElementById('readingContent');
    this.progressBar = document.getElementById('progressBar');
    this.heroImageContainer = document.querySelector('.reading-hero-image');
    
    this.fontSize = {
      min: 16,
      max: 24,
      step: 1,
      current: 17,
      key: 'tg_font_size'
    };
    
    this.floatTopBtn = null;
    this.currentTagContext = "推荐";
    this.isReady = false;
    this.currentArticleId = null;
    this.menuDropdown = null;
    this.menuMoreBtn = null;
    this.refreshClickCount = 0;
    
    console.log('阅读系统初始化完成 (异步模式)');
  }

  markAsReady() {
    this.isReady = true;
    console.log('ReadingSystem 已就绪');
  }

  checkReady() {
    if (!this.isReady) {
      console.warn('ReadingSystem 未就绪，尝试延迟初始化...');
      return false;
    }
    return true;
  }

  initFontSize() {
    const saved = localStorage.getItem(this.fontSize.key);
    if (saved) this.fontSize.current = parseInt(saved);
    this.applyFontSize();
  }

  applyFontSize() {
    document.documentElement.style.setProperty('--reading-font-size', this.fontSize.current + 'px');
    localStorage.setItem(this.fontSize.key, this.fontSize.current);
  }

  increaseFontSize() {
    if (this.fontSize.current < this.fontSize.max) {
      this.fontSize.current += this.fontSize.step;
      this.applyFontSize();
    }
  }

  decreaseFontSize() {
    if (this.fontSize.current > this.fontSize.min) {
      this.fontSize.current -= this.fontSize.step;
      this.applyFontSize();
    }
  }

  handleCoverImage(article) {
    const heroContainer = document.querySelector('.reading-hero-image');
    const heroImage = document.getElementById('readingHeroImage');
    const hasCover = article.cover && article.cover.trim().length > 0;
    
    if (hasCover) {
      heroImage.src = article.cover;
      heroImage.alt = article.title || '文章封面';
      heroContainer.classList.remove('no-image');
      heroImage.style.display = 'block';
    } else {
      heroContainer.classList.add('no-image');
      heroImage.removeAttribute('src');
      heroImage.style.display = 'none';
    }
  }

  injectDisclaimer() {
    const contentEl = document.getElementById('readingContent');
    if (!contentEl) return;
    if (contentEl.querySelector('.reading-disclaimer')) {
      return;
    }
    const disclaimerEl = document.createElement('div');
    disclaimerEl.className = 'reading-disclaimer';
    disclaimerEl.innerHTML = `
      <div class="disclaimer-line"></div>
      <p class="disclaimer-text">
        <strong>特别声明：</strong>以上内容（如有图片或视频亦包括在内）为内容作者投稿，「铜鼓之声」仅提供信息存储服务。
      </p>
    `;
    contentEl.appendChild(disclaimerEl);
    console.log('特别声明已注入');
  }

  renderArticle(article) {
    console.log('开始渲染文章:', article.title);
    
    this.view.style.zIndex = '4000';

    const md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true
    });
    
    document.getElementById('readingTitle').textContent = article.title;
    document.getElementById('readingTitlePreview').textContent = article.title;
    document.getElementById('readingSubtitle').textContent = article.subtitle || '';
    document.getElementById('readingAuthorName').textContent = article.author.name;
    document.getElementById('readingAuthorAvatar').textContent = article.author.name.charAt(0);
    
    this.handleCoverImage(article);
    
    document.getElementById('readingContent').innerHTML = md.render(article.content);
    
    this.updateReadingMeta(article);
    this.injectDisclaimer();
    this.showRelatedArticles(article);
    
    document.body.classList.add('reading-active');
    this.view.classList.add('active');
    this.initFontSize();
    this.updateReadingThemeUI();
    
    this.scroll.scrollTop = 0;
    this.updateProgress();
    
    this.scroll.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    this.bindFloatTopButton();
    this.bindMenuEvents();
    
    setTimeout(() => {
      this.scroll.scrollTop = 0;
      this.scroll.focus?.();
    }, 100);
    
    console.log('文章渲染完成:', article.title);
  }

  bindFloatTopButton() {
    this.floatTopBtn = document.getElementById('floatTop');
    if (this.floatTopBtn) {
      const newBtn = this.floatTopBtn.cloneNode(true);
      this.floatTopBtn.parentNode.replaceChild(newBtn, this.floatTopBtn);
      this.floatTopBtn = newBtn;
      this.floatTopBtn.addEventListener('click', () => {
        this.scrollToTop();
      });
      console.log('返回顶部按钮已绑定');
    }
  }

  bindMenuEvents() {
    this.menuMoreBtn = document.getElementById('readingMore');
    this.menuDropdown = document.getElementById('readingMenuDropdown');
    const copyLinkBtn = document.getElementById('menuCopyLink');
    const copyIdBtn = document.getElementById('menuCopyID');
    
    if (!this.menuMoreBtn || !this.menuDropdown) {
      console.warn('菜单元素未找到');
      return;
    }
    
    const newMoreBtn = this.menuMoreBtn.cloneNode(true);
    this.menuMoreBtn.parentNode.replaceChild(newMoreBtn, this.menuMoreBtn);
    this.menuMoreBtn = newMoreBtn;
    
    this.menuMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = this.menuDropdown.style.display === 'block';
      this.menuDropdown.style.display = isVisible ? 'none' : 'block';
      this.menuMoreBtn.classList.toggle('active', !isVisible);
    });
    
    if (copyLinkBtn) {
      const newCopyLinkBtn = copyLinkBtn.cloneNode(true);
      copyLinkBtn.parentNode.replaceChild(newCopyLinkBtn, copyLinkBtn);
      newCopyLinkBtn.addEventListener('click', () => {
        const link = this.generateArticleLink();
        this.copyToClipboard(link, '链接已复制');
        this.hideMenu();
      });
    }
    
    if (copyIdBtn) {
      const newCopyIdBtn = copyIdBtn.cloneNode(true);
      copyIdBtn.parentNode.replaceChild(newCopyIdBtn, copyIdBtn);
      newCopyIdBtn.addEventListener('click', () => {
        if (this.currentArticleId) {
          this.copyToClipboard(this.currentArticleId, '文章 ID 已复制');
          this.hideMenu();
        }
      });
    }
    
    document.addEventListener('click', (e) => {
      if (this.menuDropdown && !this.menuDropdown.contains(e.target) && !this.menuMoreBtn.contains(e.target)) {
        this.hideMenu();
      }
    });
    
    console.log('菜单事件已绑定');
  }

  hideMenu() {
    if (this.menuDropdown) {
      this.menuDropdown.style.display = 'none';
    }
    if (this.menuMoreBtn) {
      this.menuMoreBtn.classList.remove('active');
    }
  }

  copyToClipboard(text, successMsg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(successMsg);
      });
    } else {
      showToast('浏览器不支持剪贴板');
    }
  }

  generateArticleLink() {
    const url = new URL(window.location.origin + window.location.pathname);
    if (this.currentArticleId) {
      url.searchParams.set('article', this.currentArticleId);
    }
    return url.toString();
  }

  scrollToTop() {
    if (this.scroll) {
      this.scroll.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      setTimeout(() => {
        this.scroll.scrollTop = 0;
      }, 500);
      console.log('已滚动到顶部');
    }
  }

  updateReadingMeta(article) {
    const metaContainer = document.querySelector('.reading-meta');
    const issueInfo = article.issueNumber ? '选自第' + article.issueNumber + '期' : journalManager.getIssueInfo();
    const authorAbout = article.author.role || '';
    
    const metaHtml = `
      <div class="reading-author">
        <span class="avatar" id="readingAuthorAvatar">${article.author.name.charAt(0)}</span>
        <div class="reading-author-info">
          <div class="name" id="readingAuthorName">${article.author.name}</div>
          ${authorAbout ? '<div class="role" id="readingAuthorRole">' + authorAbout + '</div>' : '<div class="role" id="readingAuthorRole" style="display:none"></div>'}
        </div>
      </div>
      ${issueInfo ? '<span class="reading-meta-divider">|</span>' : ''}
      ${issueInfo ? '<span class="reading-issue">' + issueInfo + '</span>' : ''}
      <span class="reading-meta-divider">|</span>
      <span class="reading-category-tag">${article.category}</span>
    `;
    metaContainer.innerHTML = metaHtml;
  }

  showRelatedArticles(currentArticle) {
    const relatedGrid = document.getElementById('relatedGrid');
    const allArticles = journalManager.getAllArticles();
    const filteredArticles = allArticles.filter(article => article.id !== currentArticle.id);
    
    if (filteredArticles.length === 0) {
      relatedGrid.innerHTML = '<p style="color:var(--text-tertiary);text-align:center">暂无推荐文章</p>';
      return;
    }
    
    const randomCount = Math.min(2, filteredArticles.length);
    const shuffled = JournalManager.shuffleArray([...filteredArticles]);
    const relatedArticles = shuffled.slice(0, randomCount);
    
    relatedGrid.innerHTML = relatedArticles.map(article => `
      <div class="related-card" data-article-id="${article.id}" style="cursor:pointer">
        <div class="card-title">${article.title}</div>
        <div class="card-meta">
          <span>${article.author.name}</span>
          <span>·</span>
          <span>${article.category}</span>
        </div>
      </div>
    `).join('');
    
    const relatedCards = relatedGrid.querySelectorAll('.related-card');
    relatedCards.forEach((card, index) => {
      const articleId = relatedArticles[index].id;
      card.addEventListener('click', async () => {
        console.log('点击推荐文章:', articleId);
        await this.open(articleId);
      });
    });
    
    console.log('随机推荐文章已加载:', relatedArticles.length, '篇');
  }

  showContentLoading() {
    const contentEl = document.getElementById('readingContent');
    if (!contentEl) return;
    
    this._originalContent = contentEl.innerHTML;
    
    contentEl.innerHTML = `
      <div style="padding:40px 24px;text-align:center">
        <div style="width:60px;height:4px;background:var(--border-color);border-radius:2px;margin:0 auto 20px;animation:loadingPulse 1.5s ease-in-out infinite"></div>
        <div style="height:16px;background:var(--border-color);border-radius:8px;margin:0 auto 12px;max-width:80%;animation:loadingPulse 1.5s ease-in-out infinite 0.2s"></div>
        <div style="height:16px;background:var(--border-color);border-radius:8px;margin:0 auto 12px;max-width:60%;animation:loadingPulse 1.5s ease-in-out infinite 0.4s"></div>
        <div style="height:16px;background:var(--border-color);border-radius:8px;margin:24px auto 12px;max-width:90%;animation:loadingPulse 1.5s ease-in-out infinite 0.6s"></div>
        <div style="height:16px;background:var(--border-color);border-radius:8px;margin:0 auto 12px;max-width:70%;animation:loadingPulse 1.5s ease-in-out infinite 0.8s"></div>
        <p style="color:var(--text-tertiary);font-size:0.9rem;margin-top:24px">内容加载中...</p>
      </div>
    `;
    
    if (!document.getElementById('reading-loading-keyframes')) {
      const style = document.createElement('style');
      style.id = 'reading-loading-keyframes';
      style.textContent = `
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    console.log('显示文章内容加载状态');
  }

  hideContentLoading() {
    console.log('隐藏文章内容加载状态');
  }

  // ✅ 核心修复：异步打开文章
  async open(articleId) {
    console.log('尝试打开文章:', articleId);
    
    this.showContentLoading();
    
    try {
      // 异步获取完整文章
      const article = await journalManager.getArticle(articleId);
      
      if (!article) {
        console.error('文章不存在或加载失败:', articleId);
        this.hideContentLoading();
        showToast('文章加载失败，请稍后重试');
        return;
      }
      
      this.currentArticleId = articleId;
      
      if (window.bookshelfSystem?.isInitialized) {
        window.bookshelfSystem.addHistory(articleId);
      }
      
      this.renderArticle(article);
      this.updateURL(articleId);
      this.hideContentLoading();
      
      setTimeout(() => {
        if (this.scroll) {
          this.scroll.scrollTop = 0;
          setTimeout(() => {
            this.scroll.scrollTop = 0;
          }, 100);
        }
      }, 50);
      
      console.log('文章加载并渲染完成:', article.title);
      
    } catch (error) {
      console.error('打开文章时发生异常:', articleId, error);
      this.hideContentLoading();
      showToast('文章加载异常，请检查网络连接');
      
      // 降级方案：尝试从旧缓存获取
      const fallbackArticle = journalManager.articlesCache?.get(articleId);
      if (fallbackArticle?.content) {
        console.log('使用降级方案：从旧缓存加载文章');
        this.currentArticleId = articleId;
        if (window.bookshelfSystem?.isInitialized) {
          window.bookshelfSystem.addHistory(articleId);
        }
        this.renderArticle(fallbackArticle);
        this.updateURL(articleId);
      }
    }
  }

  updateURL(articleId) {
    const url = new URL(window.location);
    url.searchParams.set('article', articleId);
    window.history.pushState({ articleId }, '', url);
  }

  cleanURL() {
    const url = new URL(window.location);
    url.searchParams.delete('article');
    window.history.replaceState({}, '', url);
  }

  close() {
    console.log('关闭阅读界面');
    
    const shouldReturnToBookshelf = window.returnFromBookshelfReading?.();
    
    this.view.classList.remove('active');
    document.body.classList.remove('reading-active');
    this.scroll.removeEventListener('scroll', this.onScroll);
    
    const heroContainer = document.querySelector('.reading-hero-image');
    if (heroContainer) heroContainer.classList.remove('no-image');
    
    this.hideMenu();
    this.cleanURL();
    this.currentArticleId = null;
    
    if (shouldReturnToBookshelf) {
      console.log('返回到书架页面，跳过书架关闭');
      return;
    }
  }

  onScroll() {
    this.updateProgress();
  }

  updateProgress() {
    const { scrollTop, scrollHeight, clientHeight } = this.scroll;
    const scrolled = (scrollTop / (scrollHeight - clientHeight)) * 100;
    const clampedScrolled = Math.min(Math.max(scrolled, 0), 100);
    this.progressBar.style.transform = 'scaleX(' + (clampedScrolled / 100) + ')';
  }

  updateHeaderScroll() {
    const scrolled = this.scroll.scrollTop > 50;
    this.header.classList.toggle('scrolled', scrolled);
  }

  formatDate(dateStr) {
    if (!dateStr) return '近期发布';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return year + '年' + month + '月';
  }

  updateHomePage(tagId = null) {
    console.log('开始更新首页内容...');
    
    if (tagId) {
      this.currentTagContext = tagId;
      console.log('标签上下文已更新:', this.currentTagContext);
    }
    
    const hero = document.querySelector('.carousel-slide.active');
    const latestIssue = journalManager.currentIssue;
    
    if (hero && latestIssue) {
      hero.querySelector('.carousel-title').textContent = latestIssue.metadata.title;
      hero.querySelector('img').src = latestIssue.metadata.cover;
      const descEl = hero.querySelector('.carousel-desc');
      if (descEl) {
        const publishDate = latestIssue.metadata.publishDate;
        descEl.textContent = this.formatDate(publishDate) + '发布';
      }
    }
    
    const articleGrid = document.querySelector('.article-grid');
    if (!articleGrid) {
      console.error('未找到文章网格容器');
      return;
    }
    
    const randomArticles = journalManager.getRandomArticles(20, this.currentTagContext);
    const issueInfo = journalManager.getIssueInfo() || '选自最新期刊';
    
    console.log('当前标签：' + this.currentTagContext + ', 获取到 ' + randomArticles.length + ' 篇文章');
    
    if (randomArticles.length === 0) {
      const categoryName = this.currentTagContext === "推荐" ? "所有" : '"' + this.currentTagContext + '"';
      articleGrid.innerHTML = `
        <div class="search-no-results" style="grid-column: 1/-1; padding: 60px 20px; text-align: center;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:16px">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <h3>${categoryName}分类暂无文章</h3>
          <p>该分类内容正在更新中，敬请期待</p>
          ${this.currentTagContext !== "推荐" ? '<p style="margin-top:12px"><a href="#" onclick="window.globalReadingInstance.updateHomePage(\'推荐\');return false;" style="color:var(--accent-primary)">返回推荐页</a></p>' : ''}
        </div>
      `;
      return;
    }
    
    const fragment = document.createDocumentFragment();
    randomArticles.forEach((article, index) => {
      const hasCover = article.cover && article.cover.trim().length > 0;
      const coverHtml = hasCover
        ? '<div class="card-image"><img src="' + article.cover + '" alt="' + article.title + '" loading="lazy"></div>'
        : '';
      
      let avatarLetter = '?';
      if (article.author && article.author.name) {
        const firstName = article.author.name.trim().charAt(0);
        if (firstName && firstName !== '<' && firstName !== '&' && firstName !== '>') {
          avatarLetter = firstName;
        }
      }
      
      const articleIssueInfo = article.issueNumber ? '第' + article.issueNumber + '期' : issueInfo;
      
      const card = document.createElement('article');
      card.className = 'article-card glass';
      card.style.setProperty('--i', index);
      card.dataset.article = article.id;
      card.tabIndex = 0;
      card.role = 'button';
      card.setAttribute('aria-label', '阅读：' + article.title);
      card.style.opacity = '0';
      card.style.animation = 'fadeInUp 0.4s ease forwards ' + (index * 0.05) + 's';
      
      card.innerHTML = `
        ${coverHtml}
        <div class="card-content">
          <h3 class="card-title">${article.title}</h3>
          <p class="card-excerpt">${article.excerpt || this.extractExcerpt(article)}</p>
          <div class="card-meta">
            <span class="card-author">
              <span class="avatar">${avatarLetter}</span>
              ${article.author.name}
            </span>
            <span class="card-meta-divider">|</span>
            <span class="card-issue">${articleIssueInfo}</span>
            <span class="card-meta-divider">|</span>
            <span class="card-category-tag">${article.category}</span>
          </div>
        </div>
      `;
      
      fragment.appendChild(card);
    });
    
    articleGrid.innerHTML = '';
    articleGrid.appendChild(fragment);
    console.log('随机推荐已生成：' + randomArticles.length + ' 个 (标签：' + this.currentTagContext + ')');
  }

  refreshRecommendations() {
    console.log('刷新推荐列表...');
    console.log('当前标签上下文:', this.currentTagContext);
    this.refreshClickCount++;
    console.log('换一批点击次数:', this.refreshClickCount);
    
    this.updateHomePage();
    
    const articlesSection = document.querySelector('#articles');
    if (articlesSection) {
      articlesSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      setTimeout(() => {
        window.scrollTo({
          top: articlesSection.offsetTop - 100,
          behavior: 'smooth'
        });
      }, 100);
    }
    
    const tagText = this.currentTagContext === "推荐" ? "" : '"' + this.currentTagContext + '"';
    showToast('已为您刷新' + tagText + '推荐');
    console.log('刷新完成');
  }

  extractExcerpt(articleOrContent, length = 100) {
    let text = typeof articleOrContent === 'string' ? articleOrContent : articleOrContent?.excerpt;
    if (!text && typeof articleOrContent === 'object' && articleOrContent.content) {
      text = articleOrContent.content;
    }
    if (!text || typeof text !== 'string') {
      return '点击阅读正文...';
    }
    const plainText = text.replace(/!\[.*?\]\(.*?\)|\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*_~`#\-\+\=]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
  }

  updateReadingThemeUI() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.getElementById('themeToggleReading');
    if (btn) {
      btn.innerHTML = isDark ?
        '<svg class="icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' :
        '<svg class="icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      btn.title = isDark ? '浅色模式' : '深色模式';
    }
  }

  getCurrentTagContext() {
    return this.currentTagContext;
  }

  setTagContext(tagId) {
    this.currentTagContext = tagId;
    console.log('标签上下文已设置:', tagId);
  }

  checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    if (articleId) {
      console.log('检测到深层链接，准备打开文章:', articleId);
      setTimeout(() => {
        openReading(articleId);
      }, 500);
    }
  }
}

// ===============================
// 主题系统 (保持不变)
// ===============================
const theme = {
  key: 'tg_theme',
  get: () => localStorage.getItem(theme.key) || 'light',
  set: (val) => {
    localStorage.setItem(theme.key, val);
    document.documentElement.setAttribute('data-theme', val);
    theme.updateIcons();
  },
  toggle: () => theme.set(theme.get() === 'light' ? 'dark' : 'light'),
  updateIcons: () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon) sunIcon.style.display = isDark ? 'none' : 'block';
    if (moonIcon) moonIcon.style.display = isDark ? 'block' : 'none';
  }
};

// ===============================
// 导航栏管理器 (保持不变)
// ===============================
class NavigationManager {
  constructor() {
    this.navLinks = document.querySelectorAll('#navLinks a');
    this.sections = document.querySelectorAll('section[id], .hero');
    this.activeLink = null;
  }

  init() {
    if (this.navLinks.length === 0) {
      console.warn('未找到导航链接');
      return;
    }
    console.log('初始化导航栏管理器...');
    this.bindClickEvents();
    this.bindScrollSpy();
    this.updateActiveByHash();
  }

  bindClickEvents() {
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        this.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        this.activeLink = link;
        console.log('导航切换:', link.textContent);
      });
    });
  }

  bindScrollSpy() {
    const scrollSpyHandler = () => {
      const scrollPosition = window.scrollY + 150;
      let found = false;
      
      this.sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          const targetLink = document.querySelector('#navLinks a[href="#' + sectionId + '"]');
          if (targetLink) {
            this.navLinks.forEach(l => l.classList.remove('active'));
            targetLink.classList.add('active');
            this.activeLink = targetLink;
            found = true;
          }
        }
      });
      
      if (window.scrollY < 100) {
        const homeLink = document.querySelector('#navLinks a[href="#"]');
        if (homeLink) {
          this.navLinks.forEach(l => l.classList.remove('active'));
          homeLink.classList.add('active');
          this.activeLink = homeLink;
          found = true;
        }
      }
    };
    
    window.addEventListener('scroll', scrollSpyHandler, { passive: true });
    scrollSpyHandler();
  }

  updateActiveByHash() {
    const hash = window.location.hash;
    if (hash) {
      const targetLink = document.querySelector('#navLinks a[href="' + hash + '"]');
      if (targetLink) {
        this.navLinks.forEach(l => l.classList.remove('active'));
        targetLink.classList.add('active');
        this.activeLink = targetLink;
      }
    }
  }
}

const navigationManager = new NavigationManager();
window.navigationManager = navigationManager;

// ===============================
// 初始化系统
// ===============================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 内容加载完成，开始初始化系统...');
    window.loadingStartTime = Date.now();

    // 1. 初始化主题系统
    theme.updateIcons();

    // 2. 初始化期刊管理器（仅加载元数据）
    const journalInitialized = journalManager.initialize();
    if (!journalInitialized) {
        console.error('期刊元数据系统初始化失败');
    }

    // 通知加载系统：期刊元数据已就绪
    if (window.LoadingSystem && typeof window.LoadingSystem.markJournalReady === 'function') {
        window.LoadingSystem.markJournalReady();
    }

    // 3. 初始化阅读系统
    globalReadingInstance = new ReadingSystem();
    window.globalReadingInstance = globalReadingInstance;
    globalReadingInstance.initFontSize();
    globalReadingInstance.markAsReady();

    // 通知加载系统：阅读系统已就绪
    if (window.LoadingSystem && typeof window.LoadingSystem.markReadingReady === 'function') {
        window.LoadingSystem.markReadingReady();
    }

    // 4. 初始化其他核心模块
    if (journalInitialized && journalManager.loaded) {
        const carousel = new CarouselSystem();
        carousel.init();
        sidebarOptimizer.init();
        searchManager.init();
        navigationManager.init();

        // 渲染首页推荐
        globalReadingInstance.updateHomePage();
        console.log('首页内容已加载 (元数据模式)');
        globalReadingInstance.checkDeepLink();

        // 延迟绑定卡片点击事件
        setTimeout(function bindArticleCardEvents() {
            console.log('绑定文章卡片点击事件...');
            document.addEventListener('click', function(event) {
                const card = event.target.closest('.article-card');
                if (card) {
                    const articleId = card.dataset.article;
                    if (articleId) {
                        openReading(articleId);
                    }
                }
            });
            document.addEventListener('keydown', function(event) {
                if (event.target.classList.contains('article-card') && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    const articleId = event.target.dataset.article;
                    if (articleId) {
                        openReading(articleId);
                    }
                }
            });
        }, 100);
    }

    // 5. 绑定全局导航与交互事件
    document.getElementById('themeToggle')?.addEventListener('click', theme.toggle);
    
    document.getElementById('searchToggle')?.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const articlesSection = document.querySelector('#articles');
        if (articlesSection) {
            const dropdown = document.getElementById('search-history-dropdown');
            if (dropdown) dropdown.style.display = 'none';
            searchManager.detachScrollAndResizeListener();
            articlesSection.scrollIntoView({ behavior: 'smooth' });
            setTimeout(function() {
                const sidebarSearchInput = document.querySelector('.sidebar .search-box input');
                if (sidebarSearchInput) {
                    sidebarSearchInput.focus();
                    setTimeout(function() {
                        if (window.searchHistoryManager) {
                            window.searchHistoryManager.renderHistoryDropdown(sidebarSearchInput.value);
                        }
                    }, 500);
                }
            }, 300);
        }
    });

    const refreshBtn = document.getElementById('refreshRecommendations');
    if (refreshBtn) {
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        newRefreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (globalReadingInstance) globalReadingInstance.refreshRecommendations();
        });
    }

    const mobileToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    mobileToggle?.addEventListener('click', function() {
        mobileToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });
    document.querySelectorAll('#navLinks a').forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 992) {
                navLinks.classList.remove('active');
                mobileToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    document.getElementById('readingBack')?.addEventListener('click', function() {
        globalReadingInstance.close();
    });
    if (globalReadingInstance.scroll) {
        globalReadingInstance.scroll.addEventListener('scroll', function() {
            globalReadingInstance.updateHeaderScroll();
        });
    }

    document.addEventListener('click', function(e) {
        const tagEl = e.target.closest('.tag-pill');
        if (tagEl && window.tagsManager) {
            const tagId = tagEl.dataset.tagId;
            if (tagId) {
                e.preventDefault();
                window.tagsManager.handleTagClick(tagId);
            }
        }
    });

    console.log('铜鼓之声系统初始化完成 (异步按需加载架构)');
});

// ===============================
// 键盘快捷键
// ===============================
document.addEventListener('keydown', (e) => {
  if (!globalReadingInstance || !document.querySelector('.reading-view.active')) return;
  
  if (e.key === 'Escape') {
    globalReadingInstance.close();
  } else if (e.key === '+' || e.key === '=') {
    globalReadingInstance.increaseFontSize();
  } else if (e.key === '-' || e.key === '_') {
    globalReadingInstance.decreaseFontSize();
  } else if (e.key === 'ArrowUp') {
    globalReadingInstance.scroll.scrollBy({ top: -100, behavior: 'smooth' });
  } else if (e.key === 'ArrowDown') {
    globalReadingInstance.scroll.scrollBy({ top: 100, behavior: 'smooth' });
  }
});

// ===============================
// Toast 提示系统
// ===============================
function showToast(message, duration = 2000) {
  const old = document.getElementById('toast');
  if (old) old.remove();
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 12px 24px;
    border-radius: 14px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    font-size: 0.9rem;
    font-weight: 500;
    z-index: 9999;
    opacity: 0;
    transition: all 0.3s var(--ease-smooth);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===============================
// 收藏/分享交互（书架集成）
// ===============================
function toggleBookmark(btn) {
  if (!globalReadingInstance?.currentArticleId) return;
  
  const articleId = globalReadingInstance.currentArticleId;
  const articleMeta = journalManager.getArticleMeta?.(articleId) || 
                     journalManager.articlesCache?.get(articleId);
  
  if (!articleMeta) {
    console.warn('无法获取文章元数据:', articleId);
    return;
  }
  
  if (window.bookshelfSystem?.isInitialized) {
    const isFavorited = window.bookshelfSystem.toggleFavorite(articleId, {
      title: articleMeta.title,
      cover: articleMeta.cover,
      author: articleMeta.author?.name,
      category: articleMeta.category,
      excerpt: articleMeta.excerpt,
      timestamp: Date.now()
    });
    btn.classList.toggle('active', isFavorited);
    showToast(isFavorited ? '已加入收藏' : '已取消收藏');
  } else {
    btn.classList.toggle('active');
    const isBookmarked = btn.classList.contains('active');
    showToast(isBookmarked ? '已加入收藏' : '已取消收藏');
  }
}

document.getElementById('readingBookmark')?.addEventListener('click', function() {
  toggleBookmark(this);
});

function shareArticle() {
  const articleTitle = document.getElementById('readingTitle')?.textContent || '铜鼓之声';
  const shareUrl = globalReadingInstance?.generateArticleLink?.() || window.location.href;
  const Url = "https://tgzs.rth1.xyz";
  const shareText = '推荐一篇好文章《' + articleTitle + '》\n' + shareUrl + '\n更多精彩，尽在铜鼓之声';
  
  if (navigator.share) {
    navigator.share({
      title: articleTitle,
      text: shareText,
      url: Url
    }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(shareUrl);
    showToast('链接已复制');
  }
}

document.getElementById('readingShare')?.addEventListener('click', shareArticle);

// ===============================
// 深层链接与历史管理
// ===============================
window.addEventListener('popstate', (event) => {
  if (globalReadingInstance && globalReadingInstance.view.classList.contains('active')) {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('article')) {
      globalReadingInstance.close();
    }
  }
});

// ===============================
//  内容保护系统
// ===============================
(function() {
  console.log('内容保护系统已启动');
  
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, { passive: false });
  
  document.addEventListener('keydown', function(e) {
    if (
      (e.ctrlKey && (e.key === 'c' || e.key === 'C')) ||
      (e.ctrlKey && (e.key === 'x' || e.key === 'X')) ||
      (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
      e.key === 'F12'
    ) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });
  
  document.addEventListener('copy', function(e) {
    e.preventDefault();
    return false;
  }, { passive: false });
  
  document.addEventListener('cut', function(e) {
    e.preventDefault();
    return false;
  }, { passive: false });
  
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('dragstart', function(e) {
      e.preventDefault();
      return false;
    });
  });
})();

// ===============================
// 全局异步错误边界
// ===============================
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的 Promise 拒绝:', event.reason);
    event.preventDefault();
});

console.log('=== 铜鼓之声系统核心逻辑加载完毕 (v28.0.0) ===');