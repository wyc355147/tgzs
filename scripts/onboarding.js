/**
 * 文件名：scripts/onboarding.js
 * 作用：铜鼓之声新手引导系统核心逻辑（条形进度条 + 深度适配版）
 * 版本：v9.1.0 (元数据按需加载适配)
 * 功能：条形进度条、按钮防溢出、移动端搜索/标签自动滚动、阅读/书架完整引导
 */

console.log('新手引导系统加载 (v9.1.0 - 元数据适配)...');

class OnboardingSystem {
    constructor() {
        this.storageKey = 'tgzs_onboarding_completed_v9';
        this.currentStep = 0;
        this.desktopSteps = [];
        this.mobileSteps = [];
        this.tooltipWrapper = null;
        this.tooltip = null;
        this.isRunning = false;
        this.isMobile = window.innerWidth <= 768;
        this.highlightElement = null;
        this.scrollAnimationId = null;
        this.returnFromReading = false;
        this.returnFromBookshelf = false;
        
        this.defineDesktopSteps();
        this.defineMobileSteps();
    }

    /**
     * 定义桌面端引导步骤（16 步精简版）
     */
    defineDesktopSteps() {
        this.desktopSteps = [
            {
                id: 'logo',
                target: '.logo',
                title: '欢迎来到铜鼓之声',
                description: '这里是天柱县第五中学校刊的官方平台。点击 Logo 可随时返回首页。',
                position: 'bottom',
                scroll: true
            },
            {
                id: 'nav-home',
                target: '.nav-links li:nth-child(1) a',
                title: '首页导航',
                description: '这是首页入口，显示最新推荐文章和期刊封面。',
                position: 'bottom',
                scroll: true
            },
            {
                id: 'nav-articles',
                target: '.nav-links li:nth-child(2) a',
                title: '文章列表',
                description: '点击这里浏览所有文章列表，支持按分类筛选。',
                position: 'bottom',
                scroll: true
            },
            {
                id: 'nav-about',
                target: '.nav-links li:nth-child(3) a',
                title: '关于我们',
                description: '了解铜鼓之声的创办背景、编辑团队和统计数据。',
                position: 'bottom',
                scroll: true
            },
            {
                id: 'search',
                target: '.sidebar .search-box',
                title: '智能搜索',
                description: '输入关键词即可搜索全站文章、作者或标签。支持搜索历史记录。',
                position: 'right',
                scroll: true,
                forceScroll: true
            },
            {
                id: 'tags',
                target: '.tags-scroll',
                title: '分类标签',
                description: '点击不同标签可筛选感兴趣的文章分类，如师生文苑、校园通讯等。',
                position: 'top',
                scroll: true,
                forceScroll: true
            },
            {
                id: 'article-card',
                target: '.article-card:first-of-type',
                title: '文章卡片',
                description: '这是文章卡片，显示标题、摘要、作者和分类。点击卡片即可进入阅读界面。',
                position: 'right',
                scroll: true,
                action: 'open-article'
            },
            {
                id: 'reading-back',
                target: '#readingBack',
                title: '阅读界面 - 返回按钮',
                description: '点击返回按钮可关闭阅读界面，回到首页继续浏览。',
                position: 'right',
                scroll: true,
                requiresReading: true
            },
            {
                id: 'reading-share',
                target: '#readingShare',
                title: '阅读界面 - 分享按钮',
                description: '点击分享可将文章转发给朋友，支持系统分享或复制链接。',
                position: 'bottom',
                scroll: true,
                requiresReading: true
            },
            {
                id: 'reading-bookmark',
                target: '#readingBookmark',
                title: '阅读界面 - 收藏按钮',
                description: '点击收藏可将文章加入书架，方便日后随时查阅。',
                position: 'bottom',
                scroll: true,
                requiresReading: true
            },
            {
                id: 'reading-content',
                target: '#readingContent',
                title: '阅读界面 - 正文区域',
                description: '这是文章正文区域，采用优化的排版设计，支持舒适的阅读体验。',
                position: 'left',
                scroll: true,
                requiresReading: true
            },
            {
                id: 'reading-close',
                target: '#readingBack',
                title: '返回主页',
                description: '阅读完成后，点击返回按钮回到首页继续浏览其他文章。',
                position: 'right',
                scroll: true,
                requiresReading: true,
                action: 'close-reading'
            },
            {
                id: 'bookshelf',
                target: '#bookshelfToggle',
                title: '我的书架',
                description: '点击这里打开书架。书架支持收藏、历史记录和期刊目录浏览。',
                position: 'left',
                scroll: true,
                action: 'open-bookshelf'
            },
            {
                id: 'bookshelf-tabs',
                target: '.bookshelf-tabs',
                title: '书架 - 三个栏目',
                description: '书架包含三个栏目：铜鼓之声（期刊列表）、收藏（您收藏的文章）、历史（浏览记录）。',
                position: 'bottom',
                scroll: true,
                requiresBookshelf: true,
                action: 'close-bookshelf'
            },
            {
                id: 'theme',
                target: '#themeToggle',
                title: '主题切换',
                description: '点击可切换日间/夜间模式。夜间模式保护视力，适合夜间阅读。',
                position: 'left',
                scroll: true
            },
            {
                id: 'finish',
                target: '.article-grid',
                title: '开始探索',
                description: '恭喜您完成新手引导！现在您可以自由浏览文章了。点击任意文章卡片开始阅读，祝您阅读愉快！',
                position: 'top',
                scroll: true,
                isFinal: true
            }
        ];
    }

    /**
     * 定义移动端引导步骤（14 步精简版）
     */
    defineMobileSteps() {
        this.mobileSteps = [
            {
                id: 'logo',
                target: '.logo',
                title: '欢迎来到铜鼓之声',
                description: '这里是天柱县第五中学校刊的官方平台。点击 Logo 可随时返回首页。',
                position: 'bottom',
                scroll: true
            },
            {
                id: 'mobile-menu',
                target: '.mobile-menu-toggle',
                title: '移动菜单',
                description: '点击这里展开/收起导航菜单。在手机上，所有导航功能都收纳在这里。',
                position: 'top',
                scroll: true,
                action: 'open-mobile-menu'
            },
            {
                id: 'nav-home-mobile',
                target: '.nav-links li:nth-child(1) a',
                title: '首页导航',
                description: '这是首页入口，显示最新推荐文章和期刊封面。',
                position: 'bottom',
                scroll: true,
                requiresMobileMenu: true
            },
            {
                id: 'nav-articles-mobile',
                target: '.nav-links li:nth-child(2) a',
                title: '文章列表',
                description: '点击这里浏览所有文章列表，支持按分类筛选。',
                position: 'bottom',
                scroll: true,
                requiresMobileMenu: true
            },
            {
                id: 'nav-about-mobile',
                target: '.nav-links li:nth-child(3) a',
                title: '关于我们',
                description: '了解铜鼓之声的创办背景、编辑团队和统计数据。',
                position: 'bottom',
                scroll: true,
                requiresMobileMenu: true
            },
            {
                id: 'close-mobile-menu',
                target: '.mobile-menu-toggle.active',
                title: '关闭菜单',
                description: '再次点击菜单按钮可关闭导航菜单，返回首页继续浏览。',
                position: 'top',
                scroll: true,
                action: 'close-mobile-menu'
            },
            {
                id: 'search-mobile',
                target: '.sidebar .search-box',
                title: '智能搜索',
                description: '输入关键词即可搜索全站文章、作者或标签。支持搜索历史记录。',
                position: 'right',
                scroll: true,
                forceScroll: true
            },
            {
                id: 'tags-mobile',
                target: '.tags-scroll',
                title: '分类标签',
                description: '左右滑动可查看更多标签，点击不同标签可筛选感兴趣的文章分类。',
                position: 'top',
                scroll: true,
                forceScroll: true
            },
            {
                id: 'bookshelf-mobile',
                target: '#bookshelfToggle',
                title: '我的书架',
                description: '点击这里打开书架。书架支持收藏、历史记录和期刊目录浏览。',
                position: 'left',
                scroll: true,
                action: 'open-bookshelf'
            },
            {
                id: 'bookshelf-tabs-mobile',
                target: '.bookshelf-tabs',
                title: '书架 - 三个栏目',
                description: '书架包含三个栏目：铜鼓之声（期刊列表）、收藏（您收藏的文章）、历史（浏览记录）。',
                position: 'bottom',
                scroll: true,
                requiresBookshelf: true,
                action: 'close-bookshelf'
            },
            {
                id: 'theme-mobile',
                target: '#themeToggle',
                title: '主题切换',
                description: '点击可切换日间/夜间模式。夜间模式保护视力，适合夜间阅读。',
                position: 'left',
                scroll: true
            },
            {
                id: 'article-mobile',
                target: '.article-card:first-of-type',
                title: '文章卡片',
                description: '这是文章卡片，显示标题、摘要、作者和分类。点击卡片即可进入阅读界面。',
                position: 'right',
                scroll: true,
                action: 'open-article'
            },
            {
                id: 'reading-close-mobile',
                target: '#readingBack',
                title: '返回主页',
                description: '阅读完成后，点击返回按钮回到首页继续浏览其他文章。',
                position: 'right',
                scroll: true,
                requiresReading: true,
                action: 'close-reading'
            },
            {
                id: 'finish-mobile',
                target: '.article-grid',
                title: '开始探索',
                description: '恭喜您完成新手引导！现在您可以自由浏览文章了。点击任意文章卡片开始阅读，祝您阅读愉快！',
                position: 'top',
                scroll: true,
                isFinal: true
            }
        ];
    }

    /**
     * 初始化系统
     */
    init() {
        this.isMobile = window.innerWidth <= 768;
        const isCompleted = localStorage.getItem(this.storageKey);
        if (isCompleted === 'true') {
            console.log('用户已完成新手引导，跳过');
            return;
        }

        setTimeout(() => {
            this.createDOM();
            this.start();
        }, 1500);
    }

    /**
     * 创建 DOM 结构
     */
    createDOM() {
        if (document.getElementById('onboardingTooltipWrapper')) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'onboardingTooltipWrapper';
        wrapper.className = 'onboarding-tooltip-wrapper';
        wrapper.innerHTML = `
            <div class="onboarding-tooltip" role="dialog" aria-modal="true">
                <div class="onboarding-tooltip-header">
                    <div>
                        <h3 class="onboarding-tooltip-title"></h3>
                        <span class="onboarding-tooltip-step"></span>
                    </div>
                    <button class="onboarding-tooltip-close" aria-label="关闭引导">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <p class="onboarding-tooltip-description"></p>
                <div class="onboarding-progress-bar">
                    <div class="onboarding-progress-fill"></div>
                </div>
                <div class="onboarding-progress-text"></div>
                <div class="onboarding-tooltip-actions">
                    <button class="onboarding-btn onboarding-btn-secondary js-onboarding-skip">跳过</button>
                    <button class="onboarding-btn onboarding-btn-primary js-onboarding-next">下一步</button>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);

        this.tooltipWrapper = wrapper;
        this.tooltip = wrapper.querySelector('.onboarding-tooltip');
        
        this.bindEvents();
    }

    /**
     * 绑定事件监听
     */
    bindEvents() {
        this.tooltip.querySelector('.js-onboarding-next').addEventListener('click', () => {
            this.nextStep();
        });

        this.tooltip.querySelector('.js-onboarding-skip').addEventListener('click', () => {
            this.finish(true);
        });

        this.tooltip.querySelector('.onboarding-tooltip-close').addEventListener('click', () => {
            this.finish(true);
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isRunning) {
                return;
            }
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                this.nextStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prevStep();
            } else if (e.key === 'Escape') {
                this.finish(true);
            }
        });

        let resizeTimer;
        window.addEventListener('resize', () => {
            const newIsMobile = window.innerWidth <= 768;
            if (newIsMobile !== this.isMobile) {
                this.isMobile = newIsMobile;
            }
            if (!this.isRunning) {
                return;
            }
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.updateTooltipPosition();
            }, 200);
        });

        window.addEventListener('scroll', () => {
            if (!this.isRunning) {
                return;
            }
            this.updateTooltipPosition();
        }, { passive: true });
    }

    /**
     * 开始引导
     */
    start() {
        const currentSteps = this.isMobile ? this.mobileSteps : this.desktopSteps;
        if (currentSteps.length === 0) {
            return;
        }
        
        this.currentStep = 0;
        this.isRunning = true;
        document.body.style.overflow = 'hidden';
        
        this.renderStep();
        console.log('新手引导已启动（' + (this.isMobile ? '移动端' : '桌面端') + '）');
    }

    /**
     * 渲染当前步骤
     */
    renderStep() {
        const currentSteps = this.isMobile ? this.mobileSteps : this.desktopSteps;
        const step = currentSteps[this.currentStep];
        
        const targetEl = document.querySelector(step.target);

        if (!targetEl) {
            console.warn('未找到步骤 ' + step.id + ' 的目标元素，跳过此步');
            this.nextStep();
            return;
        }

        const titleEl = this.tooltip.querySelector('.onboarding-tooltip-title');
        const descEl = this.tooltip.querySelector('.onboarding-tooltip-description');
        const stepEl = this.tooltip.querySelector('.onboarding-tooltip-step');
        const nextBtn = this.tooltip.querySelector('.js-onboarding-next');
        const progressFill = this.tooltip.querySelector('.onboarding-progress-fill');
        const progressText = this.tooltip.querySelector('.onboarding-progress-text');

        titleEl.textContent = step.title;
        descEl.textContent = step.description;
        stepEl.textContent = '步骤 ' + (this.currentStep + 1);
        
        //  条形进度条更新
        const progressPercent = ((this.currentStep + 1) / currentSteps.length) * 100;
        progressFill.style.width = progressPercent + '%';
        progressText.textContent = (this.currentStep + 1) + ' / ' + currentSteps.length;
        
        if (step.isFinal) {
            nextBtn.textContent = '开始探索';
            this.tooltipWrapper.classList.add('final-step');
        } else if (step.action) {
            nextBtn.textContent = '体验一下';
            this.tooltipWrapper.classList.remove('final-step');
        } else {
            nextBtn.textContent = '下一步';
            this.tooltipWrapper.classList.remove('final-step');
        }

        this.highlightTarget(targetEl);
        
        //  移动端搜索和标签需要强制滚动到可视区域
        if (step.forceScroll && this.isMobile) {
            this.forceScrollToTarget(targetEl, () => {
                this.updateTooltipPosition();
                requestAnimationFrame(() => {
                    this.tooltipWrapper.classList.add('active');
                });
            });
        } else {
            this.scrollToTarget(targetEl, () => {
                this.updateTooltipPosition();
                requestAnimationFrame(() => {
                    this.tooltipWrapper.classList.add('active');
                });
            });
        }
    }

    /**
     * 高亮目标元素
     */
    highlightTarget(targetEl) {
        if (this.highlightElement) {
            this.highlightElement.classList.remove('onboarding-target-highlight');
        }

        this.highlightElement = targetEl;
        targetEl.classList.add('onboarding-target-highlight');
        targetEl.classList.add('onboarding-scroll-target');
    }

    /**
     * 智能滚动到目标元素
     */
    scrollToTarget(targetEl, callback) {
        const rect = targetEl.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const navbarHeight = 72;
        
        const isOffScreen = rect.top < navbarHeight || rect.bottom > viewportHeight - 100;
        
        if (isOffScreen) {
            const scrollY = window.scrollY + rect.top - navbarHeight - 80;
            
            if (this.scrollAnimationId) {
                cancelAnimationFrame(this.scrollAnimationId);
            }
            
            const startY = window.scrollY;
            const targetY = Math.max(0, scrollY);
            const distance = targetY - startY;
            const duration = 600;
            const startTime = performance.now();
            
            const animateScroll = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = this.easeInOutCubic(progress);
                
                window.scrollTo(0, startY + distance * easeProgress);
                
                if (progress < 1) {
                    this.scrollAnimationId = requestAnimationFrame(animateScroll);
                } else {
                    if (callback) {
                        setTimeout(callback, 150);
                    }
                }
            };
            
            this.scrollAnimationId = requestAnimationFrame(animateScroll);
        } else {
            if (callback) {
                callback();
            }
        }
    }

    /**
     * 强制滚动到目标元素（移动端搜索/标签专用）
     */
    forceScrollToTarget(targetEl, callback) {
        const rect = targetEl.getBoundingClientRect();
        const navbarHeight = 72;
        const targetScrollY = window.scrollY + rect.top - navbarHeight - 100;
        
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
        }
        
        const startY = window.scrollY;
        const targetY = Math.max(0, targetScrollY);
        const distance = targetY - startY;
        const duration = 800;
        const startTime = performance.now();
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            window.scrollTo(0, startY + distance * easeProgress);
            
            if (progress < 1) {
                this.scrollAnimationId = requestAnimationFrame(animateScroll);
            } else {
                if (callback) {
                    setTimeout(callback, 200);
                }
            }
        };
        
        this.scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    /**
     * 缓动函数
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 更新提示框位置
     */
    updateTooltipPosition() {
        const currentSteps = this.isMobile ? this.mobileSteps : this.desktopSteps;
        const step = currentSteps[this.currentStep];
        const targetEl = document.querySelector(step.target);
        
        if (!targetEl) {
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const gap = 16;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (this.isMobile) {
            this.tooltipWrapper.style.bottom = '24px';
            this.tooltipWrapper.style.left = '16px';
            this.tooltipWrapper.style.right = '16px';
            this.tooltipWrapper.style.top = 'auto';
            return;
        }

        let top = 0;
        let left = 0;

        switch (step.position) {
            case 'bottom':
                top = rect.bottom + gap;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'top':
                top = rect.top - gap - tooltipRect.height;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.right + gap;
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.left - gap - tooltipRect.width;
                break;
            default:
                top = rect.bottom + gap;
                left = rect.left;
        }

        //  边界检测，确保提示框不溢出屏幕
        if (left < 16) {
            left = 16;
        }
        if (left + tooltipRect.width > viewportWidth - 16) {
            left = viewportWidth - tooltipRect.width - 16;
        }
        if (top < 16) {
            top = rect.bottom + gap;
        }
        if (top + tooltipRect.height > viewportHeight - 16) {
            top = rect.top - gap - tooltipRect.height;
        }

        this.tooltipWrapper.style.top = top + 'px';
        this.tooltipWrapper.style.left = left + 'px';
        this.tooltipWrapper.style.bottom = 'auto';
        this.tooltipWrapper.style.right = 'auto';
    }

    /**
     * 下一步
     */
    nextStep() {
        const currentSteps = this.isMobile ? this.mobileSteps : this.desktopSteps;
        const step = currentSteps[this.currentStep];
        
        this.tooltipWrapper.classList.remove('active');

        setTimeout(() => {
            if (step.action) {
                this.executeAction(step.action);
            } else if (this.currentStep < currentSteps.length - 1) {
                this.currentStep++;
                this.renderStep();
            } else {
                this.finish(false);
            }
        }, 300);
    }

    /**
     * 上一步
     */
    prevStep() {
        if (this.currentStep === 0) {
            return;
        }

        this.tooltipWrapper.classList.remove('active');

        setTimeout(() => {
            this.currentStep--;
            this.renderStep();
        }, 300);
    }

    /**
     * 执行特殊动作（打开文章/书架/菜单等）
     */
    executeAction(action) {
        switch (action) {
            case 'open-article':
                this.openRandomArticle();
                break;
            case 'close-reading':
                this.closeReading();
                break;
            case 'open-bookshelf':
                this.openBookshelf();
                break;
            case 'close-bookshelf':
                this.closeBookshelf();
                break;
            case 'open-mobile-menu':
                this.openMobileMenu();
                break;
            case 'close-mobile-menu':
                this.closeMobileMenu();
                break;
            default:
                this.currentStep++;
                this.renderStep();
        }
    }

    /**
     * 打开移动端菜单
     */
    openMobileMenu() {
        console.log('执行动作：打开移动端菜单');
        
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const navLinks = document.getElementById('navLinks');
        
        if (mobileToggle && navLinks) {
            if (!navLinks.classList.contains('active')) {
                mobileToggle.classList.add('active');
                navLinks.classList.add('active');
                document.body.style.overflow = 'hidden';
                console.log('移动端菜单已打开');
            }
            
            setTimeout(() => {
                this.currentStep++;
                this.renderStep();
            }, 600);
        } else {
            this.currentStep++;
            this.renderStep();
        }
    }

    /**
     * 关闭移动端菜单
     */
    closeMobileMenu() {
        console.log('执行动作：关闭移动端菜单');
        
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const navLinks = document.getElementById('navLinks');
        
        if (mobileToggle && navLinks) {
            mobileToggle.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
            console.log('移动端菜单已关闭');
        }
        
        setTimeout(() => {
            this.currentStep++;
            this.renderStep();
        }, 400);
    }

    /**
     * 随机打开一篇文章（用于新手引导）
     * 核心适配：改用元数据列表，避免访问已废弃的 articlesCache
     */
    openRandomArticle() {
        console.log('执行动作：打开随机文章');
        
        // 优先从元数据缓存获取，降级使用全局兼容方法
        let articles = [];
        if (window.journalManager?.articlesMetaCache) {
            articles = Array.from(window.journalManager.articlesMetaCache.values());
        } else if (window.journalManager?.getAllArticles) {
            articles = window.journalManager.getAllArticles();
        }
        
        if (articles.length > 0) {
            const randomIndex = Math.floor(Math.random() * articles.length);
            const randomArticle = articles[randomIndex];
            
            this.returnFromReading = true;
            
            if (typeof window.openReading === 'function') {
                window.openReading(randomArticle.id);
            } else if (window.globalReadingInstance) {
                window.globalReadingInstance.open(randomArticle.id);
            }
            
            setTimeout(() => {
                this.currentStep++;
                this.renderStep();
            }, 800);
            return;
        }
        
        console.warn('元数据列表为空，跳过随机文章引导步骤');
        this.currentStep++;
        this.renderStep();
    }

    /**
     * 关闭阅读界面
     */
    closeReading() {
        console.log('执行动作：关闭阅读界面');
        
        if (window.globalReadingInstance) {
            window.globalReadingInstance.close();
        }
        
        setTimeout(() => {
            this.currentStep++;
            this.renderStep();
        }, 500);
    }

    /**
     * 打开书架
     */
    openBookshelf() {
        console.log('执行动作：打开书架');
        
        this.returnFromBookshelf = true;
        
        if (window.bookshelfSystem) {
            window.bookshelfSystem.open();
        }
        
        setTimeout(() => {
            this.currentStep++;
            this.renderStep();
        }, 800);
    }

    /**
     * 关闭书架
     */
    closeBookshelf() {
        console.log('执行动作：关闭书架');
        
        if (window.bookshelfSystem) {
            window.bookshelfSystem.close();
        }
        
        setTimeout(() => {
            this.currentStep++;
            this.renderStep();
        }, 500);
    }

    /**
     * 结束引导
     */
    finish(skipped) {
        this.tooltipWrapper.classList.remove('active');
        this.tooltipWrapper.classList.remove('final-step');
        document.body.style.overflow = '';
        
        if (this.highlightElement) {
            this.highlightElement.classList.remove('onboarding-target-highlight');
            this.highlightElement.classList.remove('onboarding-scroll-target');
            this.highlightElement = null;
        }

        if (window.bookshelfSystem && window.bookshelfSystem.view?.classList.contains('active')) {
            window.bookshelfSystem.close();
        }
        
        if (window.globalReadingInstance && window.globalReadingInstance.view?.classList.contains('active')) {
            window.globalReadingInstance.close();
        }

        if (!skipped) {
            localStorage.setItem(this.storageKey, 'true');
            console.log('新手引导完成，状态已保存');
        } else {
            localStorage.setItem(this.storageKey, 'true');
            console.log('用户跳过了新手引导');
        }

        setTimeout(() => {
            this.isRunning = false;
        }, 400);
    }

    /**
     * 重置引导（仅供开发调试使用）
     */
    reset() {
        localStorage.removeItem(this.storageKey);
        console.log('新手引导状态已重置，刷新页面后将重新显示');
    }
}

const onboardingSystem = new OnboardingSystem();
window.onboardingSystem = onboardingSystem;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        onboardingSystem.init();
    }, 1000);
});