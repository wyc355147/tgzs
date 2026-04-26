/**
* 文件名：carousel.js
* 作用：铜鼓之声 - 英雄轮播系统（修复版下载链接跳转问题 - 原生HTML方案）
* 版本：3.2.0 (原生链接修复版)
* 功能：期刊封面轮播 + 手动宣传卡片
* 核心修复：
*   1. 直接在 HTML <a> 标签中使用 target="_blank"，由浏览器原生处理新标签页打开
*   2. 移除 JS 对外部链接的拦截，避免 preventDefault 导致的冲突
*   3. 确保 GitHub Releases 链接正确配置
*/
console.log('轮播系统模块加载 (v3.2.0)...');

// ===============================
// 开发者配置区域
// ===============================
const DISPLAY_ISSUES = [1, 2, 3, 4, 5, 6, 7];
const MANUAL_SLIDES = [
    {
        id: 'manual-2026征文',
        type: 'manual',
        title: '《铜鼓之声》马年新学期征文启事',
        description: '丙午马年，新征程启，邀您共书校园故事',
        cover: 'https://s41.ax1x.com/2026/03/21/penXz2F.jpg',
        actionType: 'reading',
        actionValue: 'W20260000000000000000000[00000]',
        ctaText: '阅读征文启事',
        priority: 1,
        style: ''
    },
    {
        id: 'manual-app-download',
        type: 'manual',
        title: '下载「铜鼓之声」APP',
        description: '随时随地阅读校刊，不错过任何精彩内容',
        cover: 'https://s41.ax1x.com/2026/03/08/pePjeuF.jpg',
        actionType: 'link',
        // 核心修复：确保这里是正确的 GitHub Releases 最新版的链接
        actionValue: 'https://tgzs-app-about.rth1.xyz',
        ctaText: '立即下载',
        priority: 2,
        style: ''
    }
];

const SLIDE_ORDER = 'priority';
const CAROUSEL_CONFIG = {
    autoPlay: true,
    autoPlayInterval: 6000,
    transitionDuration: 500,
    enableTouch: true,
    enableKeyboard: true,
    pauseOnHover: true,
    maxSlides: 10
};

// ===============================
// 工具函数
// ===============================
function isValidManualSlide(slide) {
    if (!slide || typeof slide !== 'object') return false;
    const required = ['id', 'title', 'description', 'cover', 'actionType', 'actionValue'];
    for (const field of required) {
        if (!slide[field] || (typeof slide[field] === 'string' && slide[field].trim() === '')) {
            console.warn('手动卡片 "' + (slide.id || '未知') + '" 缺少必填字段：' + field);
            return false;
        }
    }
    const validActions = ['reading', 'link', 'about', 'custom'];
    if (!validActions.includes(slide.actionType)) {
        console.warn('手动卡片 "' + slide.id + '" 的 actionType "' + slide.actionType + '" 无效');
        return false;
    }
    return true;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '近期发布';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

// ===============================
// 轮播系统类
// ===============================
class CarouselSystem {
    constructor() {
        this.track = null;
        this.dotsContainer = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.carouselEl = null;
        this.currentSlide = 0;
        this.slides = [];
        this.autoPlayTimer = null;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.isDragging = false;
        this.carouselData = [];
        this.journalManagerReady = false;
        this.eventsBound = false;
        
        // 轮播图动画独立控制（固定 1 秒）
        this.carouselAnimationTimer = null;
        this.carouselAnimationComplete = false;
        
        console.log('轮播系统实例已创建 (v3.2.0)');
    }

    init() {
        console.log('开始初始化轮播系统...');
        this.track = document.getElementById('carouselTrack');
        this.dotsContainer = document.querySelector('.carousel-dots');
        this.prevBtn = document.getElementById('carouselPrev');
        this.nextBtn = document.getElementById('carouselNext');
        this.carouselEl = document.querySelector('.carousel');
        
        if (!this.track || !this.dotsContainer) {
            console.error('轮播系统：缺少必要的 DOM 元素');
            return false;
        }
        
        this.cleanup();
        this.waitForJournalManager();
        return true;
    }

    cleanup() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
        if (this.carouselAnimationTimer) {
            clearTimeout(this.carouselAnimationTimer);
            this.carouselAnimationTimer = null;
        }
        if (this.carouselEl && this.eventsBound) {
            this.carouselEl.removeEventListener('mouseenter', this.stopAutoPlay);
            this.carouselEl.removeEventListener('mouseleave', this.startAutoPlay);
        }
        this.eventsBound = false;
        console.log('轮播系统旧事件已清理');
    }

    waitForJournalManager() {
        const checkInterval = setInterval(() => {
            if (window.journalManager?.loaded) {
                clearInterval(checkInterval);
                this.journalManagerReady = true;
                console.log('期刊管理器已就绪');
                this.buildCarouselData();
                this.renderSlides();
                this.bindEvents();
                this.startAutoPlay();
                this.startCarouselAnimation();
                console.log('轮播系统初始化完成');
            }
        }, 200);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.journalManagerReady) {
                console.warn('期刊管理器加载超时，使用降级方案');
                this.buildCarouselData();
                this.renderSlides();
                this.bindEvents();
                this.startCarouselAnimation();
            }
        }, 10000);
    }

    // 轮播图动画独立控制（固定 1 秒，仅美观）
    startCarouselAnimation() {
        console.log('轮播图动画启动（固定 1 秒，仅美观）');
        this.carouselAnimationTimer = setTimeout(() => {
            this.carouselAnimationComplete = true;
            console.log('轮播图动画完成');
        }, 1000);
    }

    buildCarouselData() {
        this.carouselData = [];
        
        if (Array.isArray(MANUAL_SLIDES)) {
            MANUAL_SLIDES.forEach(slide => {
                if (isValidManualSlide(slide)) {
                    this.carouselData.push({ ...slide, _isManual: true });
                    console.log('添加手动卡片:', slide.title);
                }
            });
        }
        
        if (this.journalManagerReady && window.journalManager?.allIssues) {
            const filtered = window.journalManager.allIssues
                .filter(issue => {
                    const num = issue.metadata?.issueNumber;
                    if (!num) return false;
                    return DISPLAY_ISSUES.length === 0 || DISPLAY_ISSUES.includes(parseInt(num));
                })
                .sort((a, b) => parseInt(a.metadata.issueNumber) - parseInt(b.metadata.issueNumber));
            
            filtered.forEach(issue => {
                const meta = issue.metadata || {};
                const firstArticle = issue.articles?.[0] || null;
                this.carouselData.push({
                    id: 'journal-' + (meta.issueNumber || 'unknown'),
                    type: 'journal',
                    title: meta.title || '第' + (meta.issueNumber || '?') + '期',
                    description: meta.description || formatDate(meta.publishDate) + '发布',
                    cover: meta.cover || '',
                    actionType: 'reading',
                    actionValue: firstArticle?.id || null,
                    ctaText: '立即阅读',
                    issueNumber: null,
                    _isManual: false,
                    priority: 999
                });
            });
            console.log('添加期刊卡片:', filtered.length, '张');
        }
        
        this.sortSlides();
        if (this.carouselData.length > CAROUSEL_CONFIG.maxSlides) {
            this.carouselData = this.carouselData.slice(0, CAROUSEL_CONFIG.maxSlides);
        }
        
        if (this.carouselData.length === 0) {
            console.warn('无可用卡片，使用默认降级卡片');
            this.carouselData.push({
                id: 'default-001',
                type: 'manual',
                title: '欢迎来到铜鼓之声',
                description: '内容正在更新中，敬请期待',
                cover: 'https://picsum.photos/seed/default/1400/600',
                actionType: 'link',
                actionValue: '#articles',
                ctaText: '浏览文章',
                priority: 999,
                _isManual: true
            });
        }
        
        console.log('最终卡片数:', this.carouselData.length);
    }

    sortSlides() {
        const order = SLIDE_ORDER;
        if (order === 'priority') {
            this.carouselData.sort((a, b) => (a.priority || 999) - (b.priority || 999));
        } else if (order === 'manual-first') {
            this.carouselData.sort((a, b) => (b._isManual ? 1 : 0) - (a._isManual ? 1 : 0));
        } else if (order === 'journal-first') {
            this.carouselData.sort((a, b) => (a._isManual ? 1 : 0) - (b._isManual ? 1 : 0));
        } else if (order === 'mixed') {
            const manual = this.carouselData.filter(s => s._isManual);
            const journal = this.carouselData.filter(s => !s._isManual);
            const mixed = [];
            const max = Math.max(manual.length, journal.length);
            for (let i = 0; i < max; i++) {
                if (manual[i]) mixed.push(manual[i]);
                if (journal[i]) mixed.push(journal[i]);
            }
            this.carouselData = mixed;
        }
    }

    renderSlides() {
        if (!this.track || this.carouselData.length === 0) {
            return;
        }
        
        this.track.innerHTML = '';
        this.dotsContainer.innerHTML = '';
        this.slides = [];
        
        this.carouselData.forEach((slide, index) => {
            const slideEl = this.createSlide(slide, index);
            this.track.appendChild(slideEl);
            this.slides.push(slideEl);
            
            const dot = this.createDot(index);
            this.dotsContainer.appendChild(dot);
        });
        
        if (this.slides[0]) {
            this.slides[0].classList.add('active');
            const dots = this.dotsContainer.querySelectorAll('.carousel-dot');
            if (dots[0]) dots[0].classList.add('active');
        }
        
        console.log('幻灯片渲染完成:', this.slides.length, '张');
    }

    /**
     * 创建幻灯片 DOM
     * 核心修复：
     * 1. 对于 link 类型且非锚点的外部链接，直接在 HTML 中添加 target="_blank" 和 rel="noopener noreferrer"
     * 2. 移除 inline onclick，避免与 addEventListener 冲突
     */
    createSlide(slide, index) {
        const slideEl = document.createElement('div');
        slideEl.className = ('carousel-slide ' + (slide.style || '')).trim();
        slideEl.dataset.index = index;
        slideEl.dataset.slideId = slide.id;
        slideEl.dataset.slideType = slide.type || 'manual';
        slideEl.setAttribute('aria-hidden', index !== 0 ? 'true' : 'false');
        slideEl.setAttribute('aria-label', slide.title);
        
        let ctaHtml = '';
        if (slide.actionValue) {
            // 判断是否为外部链接
            const isExternalLink = slide.actionType === 'link' && !slide.actionValue.startsWith('#');
            
            // 构建属性字符串
            let attrs = `href="${escapeHtml(slide.actionValue)}"`;
            if (isExternalLink) {
                // 核心修复：外部链接强制新标签页打开，并添加安全属性
                attrs += ` target="_blank" rel="noopener noreferrer"`;
            }
            
            ctaHtml = 
                `<a ${attrs} class="carousel-cta" ` +
                `data-slide-id="${slide.id}" ` +
                `data-action-type="${slide.actionType}" ` +
                `data-action-value="${slide.actionValue}">` +
                escapeHtml(slide.ctaText || '立即查看') +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M5 12h14M12 5l7 7-7 7"/>' +
                '</svg></a>';
        }
            
        slideEl.innerHTML =
            '<div class="carousel-image-container">' +
            '<img src="' + escapeHtml(slide.cover) + '" alt="' + escapeHtml(slide.title) +
            '" loading="' + (index === 0 ? 'eager' : 'lazy') + '" class="carousel-slide-image">' +
            '<div class="carousel-image-overlay"></div></div>' +
            '<div class="carousel-content"><h1 class="carousel-title">' +
            escapeHtml(slide.title) + '</h1><p class="carousel-desc">' +
            escapeHtml(slide.description || '') + '</p>' + ctaHtml + '</div>';
            
        return slideEl;
    }

    createDot(index) {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        dot.dataset.index = index;
        dot.setAttribute('role', 'button');
        dot.setAttribute('tabindex', '0');
        dot.setAttribute('aria-label', '跳转到第' + (index + 1) + '张');
        dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
        return dot;
    }

    bindEvents() {
        if (this.eventsBound) {
            console.warn('事件已绑定，跳过重复绑定');
            return;
        }
        
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('上一张按钮点击');
                this.prev();
            }, true);
        }
        
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('下一张按钮点击');
                this.next();
            }, true);
        }
        
        this.dotsContainer?.addEventListener('click', (e) => {
            const dot = e.target.closest('.carousel-dot');
            if (dot) {
                e.preventDefault();
                e.stopPropagation();
                this.goTo(parseInt(dot.dataset.index));
            }
        }, true);
        
        // 核心修复：对于 CTA 点击，仅处理内部逻辑（如阅读、关于），外部链接交给浏览器原生处理
        this.track?.addEventListener('click', (e) => {
            const cta = e.target.closest('.carousel-cta');
            if (cta) {
                const actionType = cta.dataset.actionType;
                const actionValue = cta.dataset.actionValue;
                
                // 如果是外部链接，不做任何 JS 干预，让浏览器原生行为生效（新标签页打开）
                if (actionType === 'link' && !actionValue.startsWith('#')) {
                    // 不阻止默认行为，不阻止冒泡，让 <a> 标签正常工作
                    console.log('外部链接点击，由浏览器原生处理');
                    return;
                }
                
                // 内部链接或特殊动作才需要 JS 干预
                e.preventDefault();
                e.stopPropagation();
                
                this.handleSlideAction(
                    cta.dataset.slideId,
                    actionType,
                    actionValue
                );
            }
        }, true);
        
        if (CAROUSEL_CONFIG.enableTouch && this.carouselEl) {
            this.bindTouchEvents();
        }
        
        if (CAROUSEL_CONFIG.pauseOnHover && this.carouselEl) {
            this.carouselEl.addEventListener('mouseenter', () => this.stopAutoPlay());
            this.carouselEl.addEventListener('mouseleave', () => this.startAutoPlay());
        }
        
        if (CAROUSEL_CONFIG.enableKeyboard) {
            document.addEventListener('keydown', (e) => {
                if (this.carouselEl?.matches(':hover')) {
                    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); this.prev(); }
                    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); this.next(); }
                }
            }, true);
        }
        
        document.addEventListener('visibilitychange', () => {
            document.hidden ? this.stopAutoPlay() : this.startAutoPlay();
        });
        
        this.eventsBound = true;
        console.log('事件监听器已绑定 (捕获阶段)');
    }

    bindTouchEvents() {
        if (!this.carouselEl) return;
        
        this.carouselEl.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.isDragging = true;
            this.stopAutoPlay();
        }, { passive: true });
        
        this.carouselEl.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                this.touchCurrentX = e.touches[0].clientX;
            }
        }, { passive: true });
        
        this.carouselEl.addEventListener('touchend', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            const diff = this.touchStartX - this.touchCurrentX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? this.next() : this.prev();
            }
            this.startAutoPlay();
        });
    }

    handleSlideAction(slideId, actionType, actionValue) {
        console.log('幻灯片动作:', { slideId, actionType, actionValue });
        
        switch (actionType) {
            case 'reading':
                if (typeof window.openReading === 'function') {
                    window.openReading(actionValue);
                } else if (window.globalReadingInstance) {
                    window.globalReadingInstance.open(actionValue);
                }
                break;
                
            case 'link':
                // 内部锚点：平滑滚动
                if (actionValue.startsWith('#')) {
                    const target = document.querySelector(actionValue);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
                // 外部链接已在 bindEvents 中放行，此处无需处理
                break;
                
            case 'about':
                if (window.aboutSystem) window.aboutSystem.open();
                break;
                
            case 'custom':
                if (typeof window[actionValue] === 'function') window[actionValue]();
                break;
                
            default:
                console.warn('未知动作类型:', actionType);
        }
    }

    goTo(index) {
        if (index === this.currentSlide || this.isTransitioning) return;
        if (index < 0 || index >= this.slides.length) return;
        
        this.isTransitioning = true;
        
        this.slides[this.currentSlide]?.classList.remove('active');
        this.slides[this.currentSlide]?.setAttribute('aria-hidden', 'true');
        const dots = this.dotsContainer?.querySelectorAll('.carousel-dot');
        dots?.[this.currentSlide]?.classList.remove('active');
        dots?.[this.currentSlide]?.setAttribute('aria-current', 'false');
        
        this.currentSlide = index;
        
        this.slides[this.currentSlide]?.classList.add('active');
        this.slides[this.currentSlide]?.setAttribute('aria-hidden', 'false');
        dots?.[this.currentSlide]?.classList.add('active');
        dots?.[this.currentSlide]?.setAttribute('aria-current', 'true');
        
        if (this.track) {
            this.track.style.transform = 'translateX(-' + (this.currentSlide * 100) + '%)';
        }
        
        setTimeout(() => { this.isTransitioning = false; }, CAROUSEL_CONFIG.transitionDuration);
        console.log('切换到幻灯片:', index);
    }

    next() {
        const nextIndex = (this.currentSlide + 1) % this.slides.length;
        this.goTo(nextIndex);
    }

    prev() {
        const prevIndex = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
        console.log('计算上一张索引:', this.currentSlide, '→', prevIndex);
        this.goTo(prevIndex);
    }

    startAutoPlay() {
        if (!CAROUSEL_CONFIG.autoPlay) return;
        this.stopAutoPlay();
        this.autoPlayTimer = setInterval(() => this.next(), CAROUSEL_CONFIG.autoPlayInterval);
    }

    stopAutoPlay() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
    }

    addManualSlide(slideConfig) {
        if (!isValidManualSlide(slideConfig)) return false;
        if (this.carouselData.some(s => s.id === slideConfig.id)) {
            console.warn('卡片 ID 已存在:', slideConfig.id);
            return false;
        }
        this.carouselData.push({
            ...slideConfig,
            type: 'manual',
            _isManual: true,
            priority: slideConfig.priority || 999
        });
        this.sortSlides();
        this.renderSlides();
        console.log('动态添加卡片:', slideConfig.title);
        return true;
    }

    removeSlide(slideId) {
        const idx = this.carouselData.findIndex(s => s.id === slideId);
        if (idx === -1) return false;
        this.carouselData.splice(idx, 1);
        this.renderSlides();
        console.log('移除卡片:', slideId);
        return true;
    }

    getAllSlides() {
        return [...this.carouselData];
    }

    destroy() {
        this.stopAutoPlay();
        this.cleanup();
        console.log('轮播系统已销毁');
    }
}

// ===============================
// 系统初始化
// ===============================
let carouselInstance = null;

function initCarousel() {
    if (carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
    }
    carouselInstance = new CarouselSystem();
    carouselInstance.init();
    window.carouselInstance = carouselInstance;
    return carouselInstance;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('轮播模块等待初始化...');
    setTimeout(initCarousel, 800);
});

window.initCarousel = initCarousel;
window.CAROUSEL_CONFIG = CAROUSEL_CONFIG;
window.DISPLAY_ISSUES = DISPLAY_ISSUES;
window.MANUAL_SLIDES = MANUAL_SLIDES;

console.log('轮播系统模块加载完成 (v3.2.0)');