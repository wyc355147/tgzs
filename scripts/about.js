/**
 * 文件名：scripts/about.js
 * 作用：铜鼓之声关于页面系统
 * 版本：v3.1.0 (元数据按需加载适配)
 * 功能：关于页面展示、数据统计、编辑团队介绍、渐进动画
 * 修改：适配元数据架构，移除同步正文遍历依赖，支持预计算 wordCount
 */

console.log('关于页面系统加载 (v3.1.0 - 元数据适配)...');

// ===============================
// 关于页面数据配置
// ===============================
const aboutData = {
    hero: {
        title: "关于铜鼓之声",
        subtitle: "用文字记录成长，用思想照亮青春",
        description: "天柱县第五中学校刊，承载师生梦想，传递校园文化"
    },
    stats: {
        label: "Our Stats",
        title: "数据概览"
    },
    mission: {
        title: "我们的使命",
        label: "Our Mission",
        items: [
            {
                icon: "book",
                title: "文化传承",
                desc: "记录校园点滴，传承学校精神，展现师生风采"
            },
            {
                icon: "pen",
                title: "创作平台",
                desc: "为师生提供文学创作、思想交流的广阔平台"
            },
            {
                icon: "light",
                title: "青春引领",
                desc: "用优秀文字照亮青春，用深刻思想引领成长"
            }
        ]
    },
    board: [
        { role: "总编", name: "吴小海", level: "high" },
        { role: "主编", name: "杨汉鲁", level: "high" },
        { role: "执行主编", name: "姜先源", level: "high" }
    ],
    editors: [
        "李琳", "周晓梅", "杨代能", "陈登平",
        "杨继华", "杨天钟", "杨小利"
    ],
    host: {
        name: "天柱县第五中学",
        studio: "白云工作室 BaiyunStudio",
        copyright: "© 2026 铜鼓之声"
    },
    siteLaunchDate: "2025-12-01"
};

// ===============================
// 数据统计计算器 (元数据适配版)
// ===============================
class StatsCalculator {
    constructor() {
        this.stats = {
            totalWords: 0,
            totalArticles: 0,
            runningDays: 0,
            totalIssues: 0,
            totalAuthors: 0
        };
    }

    calculate() {
        const issues = this.getJournalIssues();
        if (!issues || issues.length === 0) {
            console.log('无期刊数据，使用降级方案');
            return this.getFallbackStats();
        }
        console.log('获取到期刊数据:', issues.length, '期');
        
        const allArticles = [];
        const authors = new Set();
        
        issues.forEach((issue, issueIndex) => {
            console.log('处理期刊', issueIndex + 1, ':', issue.metadata?.issueNumber || '未知');
            if (issue.articles && Array.isArray(issue.articles)) {
                console.log('  文章数量:', issue.articles.length);
                issue.articles.forEach(article => {
                    if (article && article.id) {
                        allArticles.push(article);
                        if (article.author) {
                            if (typeof article.author === 'string') {
                                authors.add(article.author.trim());
                            } else if (article.author.name) {
                                authors.add(article.author.name.trim());
                            }
                        }
                    }
                });
            }
        });
        
        this.stats.totalArticles = allArticles.length;
        this.stats.totalWords = this.calculateTotalWords(allArticles);
        this.stats.totalIssues = issues.length;
        this.stats.totalAuthors = authors.size;
        this.stats.runningDays = this.calculateRunningDays();
        
        console.log('统计结果:', this.stats);
        return this.stats;
    }

    getJournalIssues() {
        let issues = [];
        // 核心适配：优先读取元数据收集池
        if (window.allJournalMetaIssues && Array.isArray(window.allJournalMetaIssues) && window.allJournalMetaIssues.length > 0) {
            issues = window.allJournalMetaIssues;
            console.log('StatsCalculator 从 allJournalMetaIssues 获取:', issues.length, '期');
        }
        // 兼容旧版全量数据架构
        else if (window.allJournalIssues && Array.isArray(window.allJournalIssues) && window.allJournalIssues.length > 0) {
            issues = window.allJournalIssues;
            console.log('StatsCalculator 从 allJournalIssues 获取 (兼容模式):', issues.length, '期');
        } else if (window.journalIssues && Array.isArray(window.journalIssues)) {
            issues = window.journalIssues;
        } else if (window.journalIssue) {
            issues = [window.journalIssue];
        }
        return issues;
    }

    calculateTotalWords(articles) {
        let total = 0;
        articles.forEach(article => {
            // 核心适配：数据拆分后正文按需加载，优先使用构建时预计算的字数
            if (typeof article.wordCount === 'number' && article.wordCount >= 0) {
                total += article.wordCount;
                return;
            }
            // 兼容旧数据：完整内容存在时进行实时计算
            if (article.content) {
                const plainText = article.content
                    .replace(/!\[.*?\]\(.*?\)/g, '')
                    .replace(/\[.*?\]\(.*?\)/g, '$1')
                    .replace(/[#*_~`>\-+|=]/g, '')
                    .replace(/\s+/g, '')
                    .trim();
                total += plainText.length;
            } else {
                // 降级方案：元数据阶段仅统计标题、副标题与摘要长度（避免白屏或报错）
                if (article.title) total += article.title.length;
                if (article.subtitle) total += article.subtitle.length;
                if (article.excerpt) total += article.excerpt.length;
            }
        });
        return total;
    }

    calculateRunningDays() {
        const launchDate = new Date(aboutData.siteLaunchDate);
        const today = new Date();
        const diffTime = Math.abs(today - launchDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    getFallbackStats() {
        return {
            totalWords: 0,
            totalArticles: 0,
            runningDays: this.calculateRunningDays(),
            totalIssues: 0,
            totalAuthors: 0
        };
    }

    formatNumber(num) {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + '千';
        }
        return num.toLocaleString();
    }
}

// ===============================
// 关于页面系统类
// ===============================
class AboutSystem {
    constructor() {
        this.view = null;
        this.scroll = null;
        this.isInitialized = false;
        this.styleElement = null;
        this.observer = null;
        this.coverTimer = null;
        this.currentCoverIndex = 0;
        this.covers = [];
        this.sections = [];
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.lastScrollY = 0;
        this.scrollDirection = 0;
        this.isMobile = false;
        this.statsCalculator = new StatsCalculator();
    }

    init() {
        this.isMobile = window.innerWidth <= 768;
        this.loadCovers();
        this.injectStyles();
        this.createDOM();
        this.bindEvents();
        this.interceptNavLinks();
        this.isInitialized = true;
    }

    loadCovers() {
        const coverSet = new Set();
        if (window.allJournalMetaIssues && Array.isArray(window.allJournalMetaIssues)) {
            window.allJournalMetaIssues.forEach(issue => {
                const cover = issue?.metadata?.cover;
                if (cover && typeof cover === 'string' && cover.trim().length > 0) {
                    coverSet.add(cover.trim());
                }
            });
        }
        if (window.allJournalIssues && Array.isArray(window.allJournalIssues)) {
            window.allJournalIssues.forEach(issue => {
                const cover = issue?.metadata?.cover;
                if (cover && typeof cover === 'string' && cover.trim().length > 0) {
                    coverSet.add(cover.trim());
                }
            });
        }
        if (window.journalIssues && Array.isArray(window.journalIssues)) {
            window.journalIssues.forEach(issue => {
                const cover = issue?.metadata?.cover;
                if (cover && typeof cover === 'string' && cover.trim().length > 0) {
                    coverSet.add(cover.trim());
                }
            });
        }
        if (window.journalIssue && window.journalIssue.metadata?.cover) {
            const cover = window.journalIssue.metadata.cover;
            if (cover && typeof cover === 'string' && cover.trim().length > 0) {
                coverSet.add(cover.trim());
            }
        }
        this.covers = Array.from(coverSet);
        if (this.covers.length === 0) {
            this.covers = [

            ];
        }
    }

    injectStyles() {
        if (document.getElementById('about-system-styles')) return;
        const style = document.createElement('style');
        style.id = 'about-system-styles';
        style.textContent = `
            .about-view {
                position: fixed;
                inset: 0;
                background: var(--bg-primary);
                z-index: 3000;
                display: flex;
                flex-direction: column;
                opacity: 0;
                visibility: hidden;
                transform: scale(0.97);
                transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                overflow: hidden;
            }
            .about-view.active {
                opacity: 1;
                visibility: visible;
                transform: scale(1);
            }
            .about-cover-bg {
                position: absolute;
                inset: 0;
                z-index: 0;
                overflow: hidden;
            }
            .about-cover-slide {
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
                opacity: 0;
                transform: scale(1.05);
                transition: opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1),
                            transform 8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .about-cover-slide.active {
                opacity: 0.15;
                transform: scale(1);
            }
            .about-cover-slide::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, transparent 0%, var(--bg-primary) 100%);
                opacity: 0.7;
            }
            [data-theme="dark"] .about-cover-slide::after {
                background: linear-gradient(180deg, rgba(9, 9, 11, 0.8) 0%, var(--bg-primary) 100%);
            }
            .about-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 72px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 32px;
                z-index: 3002;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                background: transparent;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                border: none;
                border-bottom: 1px solid transparent;
            }
            .about-header.scrolled {
                background: var(--bg-overlay);
                border-bottom: 1px solid var(--border-light);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                height: 64px;
            }
            .about-back {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 18px;
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.85);
                border: 1px solid rgba(0, 0, 0, 0.1);
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 500;
                font-size: 0.9rem;
                color: var(--text-secondary);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            [data-theme="dark"] .about-back {
                background: rgba(24, 24, 27, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .about-back:hover {
                background: rgba(255, 255, 255, 0.95);
                color: var(--text-primary);
                transform: translateX(-3px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            }
            [data-theme="dark"] .about-back:hover {
                background: rgba(24, 24, 27, 0.95);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            }
            .about-back svg {
                transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .about-back:hover svg {
                transform: translateX(-3px);
            }
            .about-header-title {
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--text-primary);
                letter-spacing: -0.01em;
            }
            .about-scroll {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                scroll-behavior: auto;
                position: relative;
                z-index: 1;
                -webkit-overflow-scrolling: touch;
            }
            .about-container {
                max-width: 1200px;
                margin: 0 auto;
                position: relative;
                width: 100%;
                overflow-x: hidden;
            }
            .about-hero {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 140px 24px 80px;
                position: relative;
            }
            .about-hero-content {
                position: relative;
                z-index: 1;
                max-width: 800px;
            }
            .about-hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 20px;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 30px;
                font-size: 0.85rem;
                color: var(--text-secondary);
                margin-bottom: 24px;
                box-shadow: var(--shadow-sm);
                opacity: 0;
                transform: translateY(30px);
                animation: aboutFadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
            }
            .about-hero-title {
                font-size: clamp(2.5rem, 6vw, 4.5rem);
                font-weight: 800;
                line-height: 1.1;
                margin-bottom: 24px;
                color: var(--text-primary);
                letter-spacing: -0.03em;
                opacity: 0;
                transform: translateY(40px);
                animation: aboutFadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards;
                background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .about-hero-subtitle {
                font-size: clamp(1.1rem, 2.5vw, 1.5rem);
                color: var(--text-secondary);
                margin-bottom: 20px;
                font-weight: 400;
                opacity: 0;
                transform: translateY(40px);
                animation: aboutFadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
            }
            .about-hero-desc {
                font-size: 1.05rem;
                color: var(--text-tertiary);
                max-width: 600px;
                margin: 0 auto;
                line-height: 1.7;
                opacity: 0;
                transform: translateY(40px);
                animation: aboutFadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.65s forwards;
            }
            .about-hero-scroll {
                position: absolute;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                gap: 8px;
                opacity: 0;
                animation: aboutFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards;
                cursor: pointer;
                padding: 10px 16px;
                border-radius: 20px;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-hero-scroll:hover {
                background: var(--bg-secondary);
                gap: 10px;
            }
            .about-hero-scroll span {
                font-size: 0.8rem;
                color: var(--text-tertiary);
                letter-spacing: 0.1em;
                text-transform: uppercase;
                font-weight: 500;
                line-height: 1;
            }
            .about-hero-scroll-icon {
                width: 20px;
                height: 20px;
                animation: aboutBounce 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                color: var(--text-tertiary);
                flex-shrink: 0;
            }
            .about-section {
                min-height: 100vh;
                padding: 100px 24px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                position: relative;
            }
            .about-section-header {
                text-align: center;
                margin-bottom: 70px;
                opacity: 0;
                transform: translateY(50px);
                transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-section-header.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-section-label {
                display: inline-block;
                font-size: 0.85rem;
                font-weight: 700;
                color: var(--accent-primary);
                text-transform: uppercase;
                letter-spacing: 0.2em;
                margin-bottom: 16px;
                padding: 6px 18px;
                background: var(--bg-secondary);
                border-radius: 20px;
                border: 1px solid var(--border-color);
            }
            .about-section-title {
                font-size: clamp(2rem, 4vw, 3rem);
                font-weight: 800;
                color: var(--text-primary);
                letter-spacing: -0.02em;
                line-height: 1.15;
            }
            .about-stats-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 0;
                max-width: 1000px;
                margin: 0 auto;
                width: 100%;
                position: relative;
            }
            .about-stat-item {
                text-align: center;
                padding: 40px 20px;
                position: relative;
                opacity: 0;
                transform: translateY(40px);
                transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-stat-item.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-stat-item:not(:last-child)::after {
                content: '';
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 1px;
                height: 60%;
                background: linear-gradient(180deg,
                    transparent 0%,
                    var(--border-color) 20%,
                    var(--border-color) 80%,
                    transparent 100%);
            }
            .about-stat-icon {
                width: 56px;
                height: 56px;
                margin: 0 auto 20px;
                background: linear-gradient(135deg, var(--accent-primary), var(--accent-hover));
                border-radius: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--bg-primary);
                box-shadow: 0 8px 24px var(--accent-glow);
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-stat-item:hover .about-stat-icon {
                transform: scale(1.1) rotate(5deg);
                box-shadow: 0 12px 32px var(--accent-glow);
            }
            .about-stat-value {
                font-size: 3rem;
                font-weight: 800;
                color: var(--text-primary);
                margin-bottom: 12px;
                letter-spacing: -0.03em;
                background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-stat-item:hover .about-stat-value {
                transform: scale(1.05);
            }
            .about-stat-label {
                font-size: 0.95rem;
                color: var(--text-secondary);
                font-weight: 500;
                letter-spacing: 0.05em;
                text-transform: uppercase;
            }
            .about-mission-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 32px;
                max-width: 1100px;
                margin: 0 auto;
                width: 100%;
            }
            .about-mission-card {
                padding: 48px 36px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                opacity: 0;
                transform: translateY(60px);
                width: 100%;
            }
            .about-mission-card.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-mission-card:hover {
                transform: translateY(-12px) scale(1.02);
                box-shadow: var(--shadow-lg);
                border-color: var(--accent-primary);
            }
            .about-mission-icon {
                width: 72px;
                height: 72px;
                margin: 0 auto 28px;
                background: linear-gradient(135deg, var(--accent-primary), var(--accent-hover));
                border-radius: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--bg-primary);
                box-shadow: 0 12px 32px var(--accent-glow);
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-mission-card:hover .about-mission-icon {
                transform: rotate(12deg) scale(1.1);
            }
            .about-mission-card h3 {
                font-size: 1.35rem;
                font-weight: 700;
                margin-bottom: 14px;
                color: var(--text-primary);
            }
            .about-mission-card p {
                font-size: 1rem;
                color: var(--text-secondary);
                line-height: 1.75;
            }
            .about-team-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 28px;
                max-width: 1000px;
                margin: 0 auto 56px;
                width: 100%;
            }
            .about-team-card {
                display: flex;
                align-items: center;
                gap: 24px;
                padding: 32px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 22px;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                opacity: 0;
                transform: translateY(50px);
                width: 100%;
            }
            .about-team-card.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-team-card:hover {
                transform: translateY(-8px);
                box-shadow: var(--shadow-md);
                border-color: var(--accent-primary);
            }
            .about-team-avatar {
                width: 68px;
                height: 68px;
                border-radius: 22px;
                background: linear-gradient(135deg, var(--accent-primary), var(--accent-hover));
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--bg-primary);
                font-size: 1.6rem;
                font-weight: 800;
                flex-shrink: 0;
                box-shadow: 0 8px 28px var(--accent-glow);
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-team-card:hover .about-team-avatar {
                transform: scale(1.08) rotate(-5deg);
            }
            .about-team-info {
                flex: 1;
                min-width: 0;
            }
            .about-team-role {
                font-size: 0.8rem;
                font-weight: 700;
                color: var(--accent-primary);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin-bottom: 8px;
            }
            .about-team-name {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            .about-editors-section {
                max-width: 900px;
                margin: 0 auto;
                padding: 50px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 26px;
                text-align: center;
                opacity: 0;
                transform: translateY(50px);
                transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                width: 100%;
            }
            .about-editors-section.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-editors-title {
                font-size: 1.2rem;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 26px;
                letter-spacing: -0.01em;
            }
            .about-editors-list {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 14px 24px;
                margin-bottom: 20px;
            }
            .about-editor-item {
                font-size: 1rem;
                color: var(--text-secondary);
                padding: 8px 18px;
                background: var(--bg-primary);
                border-radius: 14px;
                border: 1px solid var(--border-color);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                font-weight: 500;
            }
            .about-editor-item:hover {
                background: var(--accent-primary);
                color: var(--bg-primary);
                border-color: var(--accent-primary);
                transform: translateY(-3px);
            }
            .about-editors-note {
                font-size: 0.85rem;
                color: var(--text-tertiary);
                font-style: italic;
            }
            .about-host {
                min-height: 80vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .about-host-card {
                max-width: 750px;
                width: 100%;
                padding: 70px 50px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 30px;
                text-align: center;
                opacity: 0;
                transform: translateY(60px);
                transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                overflow: hidden;
            }
            .about-host-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover), var(--accent-primary));
                background-size: 200% 100%;
                animation: aboutGradientShift 3s ease infinite;
            }
            @keyframes aboutGradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            .about-host-card.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .about-host-label {
                font-size: 0.85rem;
                font-weight: 700;
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.2em;
                margin-bottom: 20px;
            }
            .about-host-name {
                font-size: clamp(1.8rem, 4vw, 2.5rem);
                font-weight: 800;
                color: var(--text-primary);
                margin-bottom: 24px;
                letter-spacing: -0.02em;
            }
            .about-host-studio {
                display: inline-block;
                padding: 12px 30px;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 24px;
                font-size: 0.95rem;
                color: var(--text-secondary);
                font-weight: 500;
                margin-bottom: 40px;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-host-studio:hover {
                border-color: var(--accent-primary);
                color: var(--accent-primary);
            }
            .about-host-divider {
                width: 80px;
                height: 3px;
                background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover));
                margin: 0 auto 40px;
                border-radius: 2px;
            }
            .about-host-copyright {
                font-size: 0.9rem;
                color: var(--text-tertiary);
            }
            .about-footer {
                padding: 70px 24px;
                background: var(--bg-secondary);
                border-top: 1px solid var(--border-color);
                text-align: center;
            }
            .about-footer-links {
                display: flex;
                justify-content: center;
                gap: 40px;
                flex-wrap: wrap;
                margin-bottom: 28px;
            }
            .about-footer-link {
                font-size: 0.9rem;
                color: var(--text-secondary);
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                font-weight: 500;
                position: relative;
            }
            .about-footer-link::after {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 0;
                width: 0;
                height: 2px;
                background: var(--accent-primary);
                transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-footer-link:hover {
                color: var(--accent-primary);
            }
            .about-footer-link:hover::after {
                width: 100%;
            }
            .about-footer-text {
                font-size: 0.85rem;
                color: var(--text-tertiary);
            }
            .about-scroll-indicator {
                position: fixed;
                right: 32px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                gap: 12px;
                z-index: 3001;
                opacity: 0;
                visibility: hidden;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .about-view.active .about-scroll-indicator {
                opacity: 1;
                visibility: visible;
            }
            @media (max-width: 1024px) {
                .about-scroll-indicator {
                    display: none;
                }
            }
            .scroll-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--border-color);
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
            }
            .scroll-dot::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                background: var(--accent-glow);
                opacity: 0;
                transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .scroll-dot:hover::after {
                opacity: 1;
            }
            .scroll-dot.active {
                background: var(--accent-primary);
                transform: scale(1.3);
            }
            .scroll-dot:hover {
                transform: scale(1.4);
            }
            @keyframes aboutFadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(40px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes aboutFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes aboutBounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(8px); }
                60% { transform: translateY(4px); }
            }
            @media (max-width: 768px) {
                .about-header {
                    padding: 0 20px;
                    height: 64px;
                }
                .about-header.scrolled {
                    height: 56px;
                }
                .about-hero {
                    padding: 100px 20px 60px;
                    min-height: 90vh;
                }
                .about-section {
                    padding: 60px 20px;
                    min-height: auto;
                }
                .about-stats-grid {
                    grid-template-columns: 1fr !important;
                    gap: 0 !important;
                }
                .about-stat-item {
                    padding: 30px 20px !important;
                }
                .about-stat-item:not(:last-child)::after {
                    width: 60% !important;
                    height: 1px !important;
                    top: auto !important;
                    bottom: 0 !important;
                    right: 50% !important;
                    transform: translateX(50%) !important;
                    background: linear-gradient(90deg,
                        transparent 0%,
                        var(--border-color) 20%,
                        var(--border-color) 80%,
                        transparent 100%) !important;
                }
                .about-stat-value {
                    font-size: 2.5rem !important;
                }
                .about-stat-icon {
                    width: 48px !important;
                    height: 48px !important;
                }
                .about-mission-grid,
                .about-team-grid {
                    grid-template-columns: 1fr !important;
                    gap: 20px !important;
                }
                .about-mission-card,
                .about-team-card {
                    padding: 28px 20px !important;
                    width: 100% !important;
                }
                .about-host-card {
                    padding: 50px 28px;
                }
                .about-editors-section {
                    padding: 36px 20px;
                }
                .about-editors-list {
                    gap: 10px 16px;
                }
                .about-footer-links {
                    gap: 24px;
                }
                .about-hero-title {
                    font-size: 2.5rem;
                }
                .about-section-title {
                    font-size: 2rem;
                }
                .about-container {
                    overflow-x: hidden !important;
                    width: 100% !important;
                    padding: 0 4px;
                }
                .about-hero-scroll {
                    bottom: 40px;
                    padding: 8px 14px;
                }
                .about-hero-scroll span {
                    font-size: 0.75rem;
                }
                .about-hero-scroll-icon {
                    width: 18px;
                    height: 18px;
                }
            }
            @media (max-width: 480px) {
                .about-hero-title {
                    font-size: 2rem;
                }
                .about-hero-subtitle {
                    font-size: 1.1rem;
                }
                .about-mission-icon {
                    width: 58px;
                    height: 58px;
                }
                .about-team-avatar {
                    width: 56px;
                    height: 56px;
                    font-size: 1.3rem;
                }
                .about-footer-links {
                    gap: 18px;
                }
                .about-back span {
                    display: none;
                }
                .about-back {
                    padding: 10px 14px;
                }
                .about-stat-value {
                    font-size: 2rem !important;
                }
            }
        `;
        document.head.appendChild(style);
        this.styleElement = style;
    }

    createDOM() {
        if (document.getElementById('aboutView')) return;
        const view = document.createElement('div');
        view.id = 'aboutView';
        view.className = 'about-view';
        view.setAttribute('role', 'dialog');
        view.setAttribute('aria-modal', 'true');
        view.setAttribute('aria-label', '关于页面');
        const stats = this.statsCalculator.calculate();
        view.innerHTML = `
            <div class="about-cover-bg" id="aboutCoverBg"></div>
            <header class="about-header" id="aboutHeader">
                <button class="about-back" id="aboutBack" aria-label="返回">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span class="about-header-title">关于铜鼓之声</span>
                </button>
                <div style="width:60px"></div>
            </header>
            <div class="about-scroll-indicator" id="aboutScrollIndicator"></div>
            <div class="about-scroll" id="aboutScroll">
                <div class="about-container">
                    <section class="about-hero" data-section="hero">
                        <div class="about-hero-content">
                            <div class="about-hero-badge">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                </svg>
                                天柱县第五中学校刊
                            </div>
                            <h1 class="about-hero-title">${this.escapeHtml(aboutData.hero.title)}</h1>
                            <p class="about-hero-subtitle">${this.escapeHtml(aboutData.hero.subtitle)}</p>
                            <p class="about-hero-desc">${this.escapeHtml(aboutData.hero.description)}</p>
                        </div>
                        <div class="about-hero-scroll" id="aboutHeroScroll">
                            <span>了解更多</span>
                            <svg class="about-hero-scroll-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12l7 7 7-7"/>
                            </svg>
                        </div>
                    </section>
                    <section class="about-section" data-section="stats">
                        <div class="about-section-header">
                            <span class="about-section-label">${this.escapeHtml(aboutData.stats.label)}</span>
                            <h2 class="about-section-title">${this.escapeHtml(aboutData.stats.title)}</h2>
                        </div>
                        <div class="about-stats-grid">
                            <div class="about-stat-item" data-delay="0">
                                <div class="about-stat-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <polyline points="10 9 9 9 8 9"/>
                                    </svg>
                                </div>
                                <div class="about-stat-value">${this.statsCalculator.formatNumber(stats.totalWords)}</div>
                                <div class="about-stat-label">总字数</div>
                            </div>
                            <div class="about-stat-item" data-delay="0.1">
                                <div class="about-stat-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                </div>
                                <div class="about-stat-value">${this.statsCalculator.formatNumber(stats.totalArticles)}</div>
                                <div class="about-stat-label">文章篇数</div>
                            </div>
                            <div class="about-stat-item" data-delay="0.2">
                                <div class="about-stat-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                </div>
                                <div class="about-stat-value">${this.statsCalculator.formatNumber(stats.runningDays)}</div>
                                <div class="about-stat-label">运行天数</div>
                            </div>
                            <div class="about-stat-item" data-delay="0.3">
                                <div class="about-stat-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                    </svg>
                                </div>
                                <div class="about-stat-value">${this.statsCalculator.formatNumber(stats.totalIssues)}</div>
                                <div class="about-stat-label">期刊数量</div>
                            </div>
                            <div class="about-stat-item" data-delay="0.4">
                                <div class="about-stat-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                </div>
                                <div class="about-stat-value">${this.statsCalculator.formatNumber(stats.totalAuthors)}</div>
                                <div class="about-stat-label">作者数量</div>
                            </div>
                        </div>
                    </section>
                    <section class="about-section" data-section="mission">
                        <div class="about-section-header">
                            <span class="about-section-label">${this.escapeHtml(aboutData.mission.label)}</span>
                            <h2 class="about-section-title">${this.escapeHtml(aboutData.mission.title)}</h2>
                        </div>
                        <div class="about-mission-grid">
                            ${aboutData.mission.items.map((item, index) => `
                                <div class="about-mission-card" data-delay="${index * 0.15}">
                                    <div class="about-mission-icon">
                                        ${this.getIconSVG(item.icon)}
                                    </div>
                                    <h3>${this.escapeHtml(item.title)}</h3>
                                    <p>${this.escapeHtml(item.desc)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                    <section class="about-section" data-section="team">
                        <div class="about-section-header">
                            <span class="about-section-label">Our Team</span>
                            <h2 class="about-section-title">编辑委员会</h2>
                        </div>
                        <div class="about-team-grid">
                            ${aboutData.board.map((member, index) => `
                                <div class="about-team-card" data-delay="${index * 0.1}">
                                    <div class="about-team-avatar">${this.escapeHtml(member.name.charAt(0))}</div>
                                    <div class="about-team-info">
                                        <div class="about-team-role">${this.escapeHtml(member.role)}</div>
                                        <div class="about-team-name">${this.escapeHtml(member.name)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="about-editors-section" data-delay="0.3">
                            <h3 class="about-editors-title">编辑团队</h3>
                            <div class="about-editors-list">
                                ${aboutData.editors.map(name => `
                                    <span class="about-editor-item">${this.escapeHtml(name)}</span>
                                `).join('')}
                            </div>
                            <p class="about-editors-note">(排名不分先后)</p>
                        </div>
                    </section>
                    <section class="about-section about-host" data-section="host">
                        <div class="about-host-card" data-delay="0">
                            <div class="about-host-label">主办单位</div>
                            <h3 class="about-host-name">${this.escapeHtml(aboutData.host.name)}</h3>
                            <div class="about-host-divider"></div>
                            <p class="about-host-copyright">${this.escapeHtml(aboutData.host.copyright)}</p>
                        </div>
                    </section>
                    <footer class="about-footer">
<div style="display:flex;justify-content:center;gap:28px;margin-bottom:20px;flex-wrap:wrap">
    <a href="https://wyc355147.github.io/tgzs-Submission-guidelines/" target="_blank" rel="noopener noreferrer" style="font-weight:500; cursor: pointer;">投稿指南</a>
    <a href="https://wyc355147.github.io/tgzs-Use-declaration/" target="_blank" rel="noopener noreferrer" style="font-weight:500; cursor: pointer;">使用声明</a>
</div>
                        <p class="about-footer-text">© 2026 铜鼓之声 · 白云工作室 BaiyunStudio · 天柱县第五中学</p>
                    </footer>
                </div>
            </div>
        `;
        document.body.appendChild(view);
        this.view = view;
        this.scroll = document.getElementById('aboutScroll');
        this.initCoverCarousel();
        this.initScrollIndicator();
    }

    initCoverCarousel() {
        const coverBg = document.getElementById('aboutCoverBg');
        if (!coverBg) return;
        coverBg.innerHTML = this.covers.map((cover, index) => `
            <div class="about-cover-slide ${index === 0 ? 'active' : ''}"
                style="background-image: url('${cover}')"
                data-index="${index}"></div>
        `).join('');
        this.startCoverCarousel();
    }

    startCoverCarousel() {
        if (this.coverTimer) clearInterval(this.coverTimer);
        this.coverTimer = setInterval(() => {
            const slides = document.querySelectorAll('.about-cover-slide');
            if (slides.length === 0) return;
            slides[this.currentCoverIndex].classList.remove('active');
            this.currentCoverIndex = (this.currentCoverIndex + 1) % slides.length;
            slides[this.currentCoverIndex].classList.add('active');
        }, 3000);
    }

    stopCoverCarousel() {
        if (this.coverTimer) {
            clearInterval(this.coverTimer);
            this.coverTimer = null;
        }
    }

    initScrollIndicator() {
        const indicator = document.getElementById('aboutScrollIndicator');
        if (!indicator) return;
        this.sections = Array.from(document.querySelectorAll('.about-section, .about-hero'));
        if (this.sections.length === 0) return;
        indicator.innerHTML = this.sections.map((_, index) => `
            <div class="scroll-dot ${index === 0 ? 'active' : ''}"
                data-index="${index}"
                title="跳转到第${index + 1}部分"></div>
        `).join('');
        indicator.querySelectorAll('.scroll-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                this.scrollToSection(index);
            });
        });
    }

    scrollToSection(index) {
        if (index < 0 || index >= this.sections.length) return;
        const section = this.sections[index];
        if (section && this.scroll) {
            this.scroll.scrollTo({
                top: section.offsetTop - 50,
                behavior: 'smooth'
            });
        }
    }

    getIconSVG(type) {
        const icons = {
            book: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>`,
            pen: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
            </svg>`,
            light: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18h6a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z"/>
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2.26C4.19 13.47 3 11.38 3 9a7 7 0 0 1 9-7z"/>
            </svg>`
        };
        return icons[type] || icons.book;
    }

    bindEvents() {
        const backBtn = document.getElementById('aboutBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.close());
        }
        const heroScroll = document.getElementById('aboutHeroScroll');
        if (heroScroll) {
            heroScroll.addEventListener('click', () => {
                this.scrollToSection(2);
            });
        }
        if (this.scroll) {
            this.scroll.addEventListener('scroll', () => {
                const header = document.getElementById('aboutHeader');
                if (header) {
                    header.classList.toggle('scrolled', this.scroll.scrollTop > 80);
                }
                this.updateScrollIndicator();
                this.throttleSectionAnimation();
            }, { passive: true });
        }
        this.initScrollObserver();
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.view.classList.contains('active')) {
                this.close();
            }
        });
        if (this.scroll) {
            this.scroll.addEventListener('wheel', (e) => {
                this.handleSmartScroll(e);
            }, { passive: false });
        }
        if (this.scroll) {
            this.scroll.addEventListener('touchstart', (e) => {
                this.lastScrollY = this.scroll.scrollTop;
            }, { passive: true });
        }
        if (this.scroll) {
            this.scroll.addEventListener('touchmove', (e) => {
                this.scrollDirection = this.scroll.scrollTop > this.lastScrollY ? 1 : -1;
                this.lastScrollY = this.scroll.scrollTop;
            }, { passive: true });
        }
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
        });
    }

    handleSmartScroll(e) {
        if (!this.scroll || this.isScrolling) return;
        const scrollTop = this.scroll.scrollTop;
        if (this.isMobile) {
            const currentSection = this.getCurrentSection();
            if (currentSection) {
                const sectionTop = currentSection.offsetTop;
                const sectionBottom = sectionTop + currentSection.offsetHeight;
                const sectionScrollable = currentSection.scrollHeight > this.scroll.clientHeight;
                if (sectionScrollable && scrollTop > sectionTop + 100 && scrollTop < sectionBottom - this.scroll.clientHeight - 100) {
                    return;
                }
            }
        }
        const delta = Math.abs(e.deltaY);
        if (delta < 30) return;
        const nearSectionBoundary = this.sections.some(section => {
            const sectionTop = section.offsetTop;
            const distance = Math.abs(scrollTop - sectionTop);
            return distance < 120;
        });
        if (nearSectionBoundary) {
            e.preventDefault();
            this.isScrolling = true;
            const direction = e.deltaY > 0 ? 1 : -1;
            let targetIndex = 0;
            this.sections.forEach((section, index) => {
                if (direction > 0 && section.offsetTop > scrollTop) {
                    if (targetIndex === 0 || section.offsetTop < this.sections[targetIndex].offsetTop) {
                        targetIndex = index;
                    }
                } else if (direction < 0 && section.offsetTop < scrollTop) {
                    targetIndex = index;
                }
            });
            this.scrollToSection(targetIndex);
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
            }, 600);
        }
    }

    getCurrentSection() {
        if (!this.scroll) return null;
        const scrollTop = this.scroll.scrollTop + this.scroll.clientHeight / 3;
        for (const section of this.sections) {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            if (scrollTop >= sectionTop && scrollTop < sectionBottom) {
                return section;
            }
        }
        return this.sections[0];
    }

    updateScrollIndicator() {
        if (!this.scroll) return;
        const scrollTop = this.scroll.scrollTop + this.scroll.clientHeight / 2;
        this.sections.forEach((section, index) => {
            const dot = document.querySelector(`.scroll-dot[data-index="${index}"]`);
            if (!dot) return;
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            if (scrollTop >= sectionTop - 100 && scrollTop < sectionBottom - 100) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    throttleSectionAnimation() {
        if (this.scrollTimeout) return;
        this.scrollTimeout = setTimeout(() => {
            this.checkSectionVisibility();
            this.scrollTimeout = null;
        }, 100);
    }

    checkSectionVisibility() {
        if (!this.scroll) return;
        const scrollTop = this.scroll.scrollTop;
        const viewportHeight = this.scroll.clientHeight;
        this.sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            if (scrollTop + viewportHeight > sectionTop + 100 && scrollTop < sectionBottom - 100) {
                const header = section.querySelector('.about-section-header');
                if (header) {
                    header.classList.add('visible');
                }
            }
        });
    }

    initScrollObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseFloat(entry.target.dataset.delay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay * 1000);
                    this.observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            root: this.scroll,
            rootMargin: '0px 0px -80px 0px'
        });
        setTimeout(() => {
            const animatedElements = document.querySelectorAll(
                '.about-stat-item, .about-mission-card, .about-team-card, .about-editors-section, .about-host-card'
            );
            animatedElements.forEach(el => this.observer.observe(el));
        }, 300);
    }

    interceptNavLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href="#about"]');
            if (link) {
                e.preventDefault();
                this.open();
            }
        });
    }

    open() {
        if (!this.view) return;
        this.isMobile = window.innerWidth <= 768;
        this.view.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (this.scroll) this.scroll.scrollTop = 0;
        this.startCoverCarousel();
        setTimeout(() => {
            const animatedElements = document.querySelectorAll(
                '.about-stat-item, .about-mission-card, .about-team-card, .about-editors-section, .about-host-card, .about-section-header'
            );
            animatedElements.forEach(el => {
                el.classList.remove('visible');
                this.observer.observe(el);
            });
            this.updateScrollIndicator();
        }, 100);
    }

    close() {
        if (!this.view) return;
        this.view.classList.remove('active');
        document.body.style.overflow = '';
        this.stopCoverCarousel();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===============================
// 初始化系统
// ===============================
const aboutSystem = new AboutSystem();
window.aboutSystem = aboutSystem;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        aboutSystem.init();
    }, 500);
});

window.refreshAboutPage = function() {
    if (window.aboutSystem) {
        window.aboutSystem.init();
    }
};