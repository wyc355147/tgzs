/**
*  铜鼓之声 v27.4 - 标签管理系统 (元数据适配版)
* 版本：1.4.0 (适配元数据按需加载架构，移除正文依赖)
*/
console.log(' 标签管理系统加载 (元数据适配版)...');

// ===============================
//  标签配置
// ===============================
const tagsConfig = [
    { id: "推荐", name: "推荐", active: true },
    { id: "师生文苑", name: "师生文苑", active: false },
    { id: "鳌山阅读", name: "鳌山阅读", active: false },
    { id: "党建引领", name: "党建引领", active: false },
    { id: "德育教育", name: "德育教育", active: false },
    { id: "教海拾贝", name: "教海拾贝", active: false },
    { id: "心情驿站", name: "心情驿站", active: false },
    { id: "校园榜样", name: "校园榜样", active: false },
    { id: "校园通讯", name: "校园通讯", active: false },
    { id: "民族地区基础教育质量提升行动专项计划项目", name: "高质量发展", active: false },
    { id: "百日誓师专版", name: "百日誓师", active: false },
    { id: "教改专题", name: "教改专题", active: false },
];

// ===============================
//  标签管理器类
// ===============================
class TagsManager {
    constructor() {
        this.tagsContainer = null;
        this.articleGrid = null;
        this.currentTag = "推荐";
        this.tags = JSON.parse(JSON.stringify(tagsConfig));
        this.isInitialized = false;
        this.readingSystemReady = false;
        console.log(' 标签管理器初始化...');
    }

    init() {
        this.tagsContainer = document.querySelector('.tags-scroll');
        this.articleGrid = document.querySelector('.article-grid');
        if (!this.tagsContainer || !this.articleGrid) {
            console.warn(' 未找到标签容器或文章网格');
            return false;
        }
        this.renderTags();
        this.bindEvents();
        this.isInitialized = true;
        
        //  修复：延迟检查 ReadingSystem 就绪状态
        setTimeout(() => {
            this.checkReadingSystemReady();
        }, 500);
        
        console.log(' 标签管理器初始化完成');
        return true;
    }

    //  新增：检查 ReadingSystem 是否就绪
    checkReadingSystemReady() {
        if (window.globalReadingInstance && window.globalReadingInstance.isReady) {
            this.readingSystemReady = true;
            console.log(' ReadingSystem 已就绪，标签系统将使用主渲染逻辑');
        } else {
            this.readingSystemReady = false;
            console.warn(' ReadingSystem 未就绪，标签系统将使用 fallback 逻辑');
            //  修复：如果未就绪，尝试延迟重试
            setTimeout(() => this.checkReadingSystemReady(), 500);
        }
    }

    renderTags() {
        if (!this.tagsContainer) return;
        this.tagsContainer.innerHTML = this.tags.map(tag => {
            const displayName = tag.name.length > 4 && tag.id !== tag.name ? tag.name :
                (tag.name.length > 6 ? tag.name.substring(0, 6) + '...' : tag.name);
            return `
<span class="tag-pill ${tag.active ? 'active' : ''}"
    data-tag-id="${tag.id}"
    title="${tag.id}"
    role="button"
    tabindex="0"
    aria-pressed="${tag.active}">
    ${displayName}
</span>
`;
        }).join('');
        console.log(` 已渲染 ${this.tags.length} 个标签`);
    }

    bindEvents() {
        this.tagsContainer.addEventListener('click', (e) => {
            const tagEl = e.target.closest('.tag-pill');
            if (tagEl) {
                const tagId = tagEl.dataset.tagId;
                this.handleTagClick(tagId);
            }
        });

        this.tagsContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const tagEl = e.target.closest('.tag-pill');
                if (tagEl) {
                    e.preventDefault();
                    const tagId = tagEl.dataset.tagId;
                    this.handleTagClick(tagId);
                }
            }
        });

        window.addEventListener('scroll', () => {
            if (window.searchManager) {
                window.searchManager.hideSearchHistory();
            }
        }, { passive: true });
    }

    //  修复：处理标签点击
    handleTagClick(tagId) {
        console.log(` 点击标签：${tagId}`);
        
        // 验证标签 ID
        const tagExists = this.tags.some(tag => tag.id === tagId);
        if (!tagExists) {
            console.warn(' 无效的标签 ID:', tagId);
            return;
        }

        // 1. 更新标签状态
        this.updateTagState(tagId);
        
        // 2.  修复：优先使用 ReadingSystem 渲染
        if (this.readingSystemReady && window.globalReadingInstance) {
            //  修复：先设置 ReadingSystem 的标签上下文
            window.globalReadingInstance.setTagContext(tagId);
            // 再更新首页（会保持标签上下文）
            window.globalReadingInstance.updateHomePage(tagId);
            console.log(' ReadingSystem 标签上下文已同步:', tagId);
        } else {
            console.warn(' ReadingSystem 未就绪，使用 fallback 逻辑');
            // Fallback：直接从数据池随机抽取并渲染
            this.renderArticlesByTag(tagId);
        }

        // 3. 清空搜索
        if (window.searchManager && window.searchManager.isSearchActive) {
            window.searchManager.resetToOriginalView();
        }

        // 4. 滚动到文章区
        const articlesSection = document.querySelector('#articles');
        if (articlesSection) {
            articlesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    updateTagState(activeTagId) {
        this.tags.forEach(tag => {
            tag.active = (tag.id === activeTagId);
        });
        this.currentTag = activeTagId;
        this.renderTags();
    }

    //  修复：Fallback 渲染逻辑（基于元数据 excerpt）
    renderArticlesByTag(tagId) {
        if (!this.articleGrid || !window.journalManager) {
            console.error(' 无法渲染：缺少 articleGrid 或 journalManager');
            return;
        }

        //  修复：从 JournalManager 获取随机文章（支持不足 20 篇返回全部）
        const randomArticles = window.journalManager.getRandomArticles(20, tagId);
        const issueInfo = window.journalManager.getIssueInfo() || '选自最新期刊';

        console.log(` Fallback 渲染：${tagId}, 获取到 ${randomArticles.length} 篇文章`);

        if (randomArticles.length === 0) {
            this.showNoTagResults(tagId);
            return;
        }

        const fragment = document.createDocumentFragment();
        randomArticles.forEach((article, index) => {
            const hasCover = article.cover && article.cover.trim().length > 0;
            const coverHtml = hasCover
                ? `<div class="card-image"><img src="${article.cover}" alt="${article.title}" loading="lazy"></div>`
                : '';
            
            let avatarLetter = '?';
            if (article.author && article.author.name) {
                const firstName = article.author.name.trim().charAt(0);
                if (firstName && firstName !== '<' && firstName !== '&' && firstName !== '>') {
                    avatarLetter = firstName;
                }
            }

            const articleIssueInfo = article.issueNumber ? `第${article.issueNumber}期` : issueInfo;
            
            const card = document.createElement('article');
            card.className = 'article-card glass';
            card.style.setProperty('--i', index);
            card.dataset.article = article.id;
            card.tabIndex = 0;
            card.role = 'button';
            card.setAttribute('aria-label', `阅读：${article.title}`);
            card.style.opacity = '0';
            card.style.animation = `fadeInUp 0.4s ease forwards ${index * 0.05}s`;

            card.innerHTML = `
                ${coverHtml}
                <div class="card-content">
                    <h3 class="card-title">${article.title}</h3>
                    <p class="card-excerpt">${this.escapeHtml(article.excerpt || '点击阅读正文...')}</p>
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

        this.articleGrid.innerHTML = '';
        this.articleGrid.appendChild(fragment);
        console.log(` Fallback 渲染完成：${randomArticles.length} 篇`);
    }

    // 安全版本的摘要提取（降级兼容，不再依赖正文 content）
    extractExcerpt(content, length = 100) {
        if (!content || typeof content !== 'string') {
            return '点击阅读正文...';
        }
        const plainText = content.replace(/!\[.*?\]\(.*?\)|\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[*_~`#\-\+\=]/g, '')
            .replace(/\n/g, ' ')
            .trim();
        return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
    }

    // HTML 转义（XSS 防护）
    escapeHtml(text) {
        if (!text || typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 旧的 fallback 逻辑（已废弃，保留占位）
    filterArticlesByTag(tagId) {
        console.warn('[Deprecation] filterArticlesByTag 已废弃，请使用 renderArticlesByTag 或 ReadingSystem.updateHomePage');
        // 不执行实际过滤，避免混淆
        return;
    }

    showNoTagResults(tagName) {
        if (!this.articleGrid) return;
        const noResults = document.createElement('div');
        noResults.className = 'search-no-results';
        noResults.innerHTML = `
<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:16px">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
</svg>
<h3>"${tagName}" 分类暂无文章</h3>
<p>该分类内容正在更新中，敬请期待</p>
`;
        this.articleGrid.appendChild(noResults);
    }

    resetToRecommended() {
        this.handleTagClick("推荐");
    }

    getCurrentTag() {
        return this.currentTag;
    }
}

// 创建全局实例
const tagsManager = new TagsManager();
window.tagsManager = tagsManager;

// 导出工具函数
window.filterByTag = function(tagId) {
    if (window.tagsManager?.isInitialized) {
        window.tagsManager.handleTagClick(tagId);
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    const initTags = () => {
        if (window.journalManager?.loaded) {
            tagsManager.init();
        } else {
            setTimeout(initTags, 100);
        }
    };
    initTags();
});