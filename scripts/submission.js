/**
* 文件名：submission.js
* 作用：铜鼓之声投稿引导系统（同步更新版）
* 版本：1.1.0
* 功能：投稿引导模态框展示、投稿指南跳转、邮箱交互、安全防护
* 更新：同步移除放大动画类名，与 CSS 保持一致
*/
console.log('投稿系统模块加载 (v1.1.0)...');

// ===============================
// 投稿系统配置
// ===============================
const SUBMISSION_CONFIG = {
    // 投稿指南链接
    guidelinesUrl: 'https://wyc355147.github.io/tgzs-Submission-guidelines/',
    // 投稿邮箱
    email: 'wyc_355147@163.com',
    // 邮箱主题预设
    emailSubject: '铜鼓之声投稿申请',
    // 模态框动画时长 (毫秒)
    animationDuration: 300,
    // 最小显示时间，确保用户看到提示 (毫秒)
    minDisplayTime: 1500
};

// ===============================
// 投稿系统类
// ===============================
class SubmissionSystem {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.eventsBound = false;
        console.log('SubmissionSystem 实例已创建');
    }

    /**
     * 初始化投稿系统
     */
    init() {
        console.log('初始化投稿系统...');
        this.createModal();
        this.bindEvents();
        this.eventsBound = true;
        console.log('投稿系统初始化完成');
    }

    /**
     * 创建投稿引导模态框 DOM
     */
    createModal() {
        if (document.getElementById('submissionModal')) {
            console.log('投稿模态框已存在，跳过创建');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'submissionModal';
        modal.className = 'submission-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', '投稿引导');
        modal.innerHTML = `
            <div class="submission-modal-backdrop"></div>
            <div class="submission-modal-content">
                <button class="submission-modal-close" aria-label="关闭">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <div class="submission-modal-header">
                    <div class="submission-modal-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </div>
                    <h2 class="submission-modal-title">投稿申请</h2>
                </div>
                
                <div class="submission-modal-body">
                    <div class="submission-notice">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <p class="submission-notice-text">
                            为确保投稿内容符合「铜鼓之声」的收录标准，<strong>投稿前请务必阅读投稿指南</strong>，了解稿件格式、内容要求及审核流程。
                        </p>
                    </div>
                    
                    <div class="submission-actions">
                        <a href="${SUBMISSION_CONFIG.guidelinesUrl}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           class="submission-btn submission-btn-primary"
                           id="guidelinesBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            阅读投稿指南
                        </a>
                    </div>
                    
                    <div class="submission-divider">
                        <span>或</span>
                    </div>
                    
                    <div class="submission-email-section">
                        <p class="submission-email-label">确认已阅读指南后，可通过邮箱投稿：</p>
                        <a href="mailto:${SUBMISSION_CONFIG.email}?subject=${encodeURIComponent(SUBMISSION_CONFIG.emailSubject)}" 
                           class="submission-email-link"
                           id="emailLink">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <span class="submission-email-address">${SUBMISSION_CONFIG.email}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                        <p class="submission-email-hint">点击将打开您的默认邮箱客户端</p>
                    </div>
                </div>
                
                <div class="submission-modal-footer">
                    <button class="submission-btn submission-btn-secondary" id="closeModalBtn">
                        暂不投稿
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
        console.log('投稿模态框 DOM 已创建');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 导航栏投稿按钮
        const submitBtn = document.querySelector('.nav-actions .btn-primary');
        if (submitBtn) {
            const newBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newBtn, submitBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.open();
            });
            console.log('投稿按钮事件已绑定');
        }

        // 模态框关闭按钮
        const closeBtn = this.modal?.querySelector('.submission-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // 底部关闭按钮
        const footerCloseBtn = this.modal?.querySelector('#closeModalBtn');
        if (footerCloseBtn) {
            footerCloseBtn.addEventListener('click', () => this.close());
        }

        // 点击背景关闭
        const backdrop = this.modal?.querySelector('.submission-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.close());
        }

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 邮箱链接点击统计
        const emailLink = this.modal?.querySelector('#emailLink');
        if (emailLink) {
            emailLink.addEventListener('click', () => {
                console.log('用户点击邮箱投稿链接');
            });
        }

        // 指南链接点击统计
        const guidelinesBtn = this.modal?.querySelector('#guidelinesBtn');
        if (guidelinesBtn) {
            guidelinesBtn.addEventListener('click', () => {
                console.log('用户点击投稿指南链接');
            });
        }

        console.log('投稿系统事件绑定完成');
    }

    /**
     * 打开投稿引导模态框
     */
    open() {
        if (!this.modal || this.isOpen) return;

        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        this.modal.classList.add('active');

        // 核心修复：移除放大动画，仅使用淡入 + 位移
        // 确保最小显示时间，避免闪退
        setTimeout(() => {
            if (this.modal) {
                // 核心修复：仅添加 'ready' 类触发位移动画，不添加 'scale' 相关类
                this.modal.classList.add('ready');
            }
        }, SUBMISSION_CONFIG.minDisplayTime);

        console.log('投稿引导模态框已打开');
    }

    /**
     * 关闭投稿引导模态框
     */
    close() {
        if (!this.modal || !this.isOpen) return;

        this.isOpen = false;
        document.body.style.overflow = '';
        // 核心修复：仅移除 'ready' 类，不处理 scale 相关类
        this.modal.classList.remove('active', 'ready');

        console.log('投稿引导模态框已关闭');
    }

    /**
     * 销毁实例，清理资源
     */
    destroy() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.eventsBound = false;
        console.log('投稿系统已销毁');
    }
}

// ===============================
// 全局实例与导出
// ===============================
let submissionSystem = null;

/**
 * 获取投稿系统单例
 */
function getSubmissionSystem() {
    if (!submissionSystem) {
        submissionSystem = new SubmissionSystem();
    }
    return submissionSystem;
}

/**
 * 打开投稿引导（全局调用）
 */
function openSubmission() {
    getSubmissionSystem().open();
}

// ===============================
// 自动初始化
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    console.log('投稿模块等待初始化...');
    setTimeout(() => {
        getSubmissionSystem().init();
    }, 500);
});

// 导出全局 API
window.openSubmission = openSubmission;
window.SubmissionSystem = SubmissionSystem;
window.SUBMISSION_CONFIG = SUBMISSION_CONFIG;

console.log('投稿系统模块加载完成 (v1.1.0)');