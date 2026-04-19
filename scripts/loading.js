/**
* 文件名：loading.js
* 作用：铜鼓之声加载系统核心逻辑（成功案例适配 + 调试指令强制绑定版）
* 版本：14.0.0
* 特点：纯 rotateY 动画兼容、调试指令强制生效、滚动锁定、生命周期管理
*/
console.log('加载优化系统初始化 (v14.0.0)...');

class LoadingManager {
  constructor() {
    this.overlay = null;
    this.isLoaded = false;
    this.debugMode = false;
    this.forceHideTimer = null;
    this.startTime = Date.now();
    this.journalReady = false;
    this.readingReady = false;
    this.carouselAnimationComplete = false;
    this.carouselAnimationTimer = null;
    // 性能阈值配置
    this.minDisplayTime = 800;
    this.maxWaitTime = 10000;
    // 滚动锁定状态
    this.originalBodyOverflow = '';
    this.originalBodyPosition = '';
    this.scrollY = 0;
    
    console.log('LoadingManager 实例已创建');
  }

  init() {
    console.log('LoadingManager 初始化...');
    this.overlay = document.getElementById('loadingOverlay');
    if (!this.overlay) {
      console.log('加载界面不存在，创建新实例');
      this.createOverlay();
    }
    this.lockScroll();
    this.startCarouselAnimation();
    this.startForceHideTimer();
    this.initDebugMode();
    console.log('加载管理器已初始化');
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="book-loader">
        <div class="book-spine"></div>
        <div class="book-page static-left"></div>
        <div class="book-page static-right"></div>
        <div class="book-page active"></div>
        <div class="book-page active"></div>
        <div class="book-page active"></div>
        <div class="book-page active"></div>
      </div>
      <div class="loading-debug-indicator" id="loadingDebugIndicator" style="display:none">
        <span>调试模式</span>
        <button id="loadingDebugStop">停止</button>
      </div>
    `;
    document.body.insertBefore(overlay, document.body.firstChild);
    this.overlay = overlay;
    console.log('加载界面 DOM 已创建');
  }

  lockScroll() {
    this.originalBodyOverflow = document.body.style.overflow;
    this.originalBodyPosition = document.body.style.position;
    this.scrollY = window.scrollY;
    document.body.classList.add('loading-active');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollY}px`;
    document.body.style.width = '100%';
    console.log('页面滚动已锁定');
  }

  unlockScroll() {
    document.body.classList.remove('loading-active');
    document.body.style.overflow = this.originalBodyOverflow;
    document.body.style.touchAction = '';
    document.body.style.position = this.originalBodyPosition;
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, this.scrollY);
    console.log('页面滚动已解锁');
  }

  startCarouselAnimation() {
    if (this.carouselAnimationTimer) clearTimeout(this.carouselAnimationTimer);
    this.carouselAnimationTimer = setTimeout(() => {
      this.carouselAnimationComplete = true;
      console.log('轮播图动画完成');
      this.checkAllReady();
    }, 1000);
  }

  markJournalReady() {
    this.journalReady = true;
    console.log('期刊数据已就绪');
    this.checkAllReady();
  }

  markReadingReady() {
    this.readingReady = true;
    console.log('阅读系统已就绪');
    this.checkAllReady();
  }

  checkAllReady() {
    if (this.isLoaded && !this.debugMode) return;
    const coreModulesReady = this.journalReady && this.readingReady;
    const carouselAnimationDone = this.carouselAnimationComplete;
    console.log('加载状态检查:', { allReady: coreModulesReady && carouselAnimationDone, debugMode: this.debugMode });
    if (coreModulesReady && carouselAnimationDone && !this.debugMode) {
      this.hide();
    }
  }

  startForceHideTimer() {
    this.forceHideTimer = setTimeout(() => {
      if (!this.isLoaded && !this.debugMode) {
        console.warn('加载超时，强制显示内容');
        this.hide();
      }
    }, this.maxWaitTime);
  }

  hide() {
    if (this.isLoaded || this.debugMode) return;
    const elapsedTime = Date.now() - this.startTime;
    const remainingTime = Math.max(0, this.minDisplayTime - elapsedTime);
    console.log('加载完成，等待隐藏:', remainingTime + 'ms');
    if (this.forceHideTimer) clearTimeout(this.forceHideTimer);
    if (this.carouselAnimationTimer) clearTimeout(this.carouselAnimationTimer);
    setTimeout(() => {
      this.isLoaded = true;
      this.unlockScroll();
      if (this.overlay) {
        this.overlay.classList.add('hidden');
        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
          }
        }, 600);
      }
    }, remainingTime);
  }

  initDebugMode() {
    const stopBtn = document.getElementById('loadingDebugStop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopDebugMode());
    }
  }

  startDebugMode() {
    console.log('===========================================');
    console.log(' 启动调试模式...');
    console.log('===========================================');
    this.debugMode = true;
    this.isLoaded = false;
    if (!this.overlay) this.createOverlay();
    this.overlay.classList.remove('hidden');
    const indicator = this.overlay.querySelector('#loadingDebugIndicator');
    if (indicator) indicator.style.display = 'flex';
    this.lockScroll();
    if (this.forceHideTimer) clearTimeout(this.forceHideTimer);
    if (this.carouselAnimationTimer) clearTimeout(this.carouselAnimationTimer);
    // 重新绑定停止按钮（动态创建时）
    setTimeout(() => {
      const newStopBtn = document.getElementById('loadingDebugStop');
      if (newStopBtn) newStopBtn.onclick = () => this.stopDebugMode();
    }, 50);
    console.log(' 调试模式已激活，加载界面将持续运行');
    console.log(' 输入 tgzs.debug.loading.stop() 或点击右下角按钮停止');
  }

  stopDebugMode() {
    console.log('停止调试模式，恢复自动隐藏流程');
    this.debugMode = false;
    const indicator = document.getElementById('loadingDebugIndicator');
    if (indicator) indicator.style.display = 'none';
    this.checkAllReady();
  }

  destroy() {
    if (this.forceHideTimer) clearTimeout(this.forceHideTimer);
    if (this.carouselAnimationTimer) clearTimeout(this.carouselAnimationTimer);
    this.unlockScroll();
    if (this.overlay && this.overlay.parentNode) this.overlay.remove();
  }
}

let loadingManager = null;

function getLoadingManager() {
  if (!loadingManager) loadingManager = new LoadingManager();
  return loadingManager;
}

// 全局 API 暴露
window.LoadingSystem = {
  hide: function() { if (loadingManager) loadingManager.hide(); },
  markJournalReady: function() { if (loadingManager) loadingManager.markJournalReady(); },
  markReadingReady: function() { if (loadingManager) loadingManager.markReadingReady(); },
  debug: {
    loading: {
      start: function() { getLoadingManager().startDebugMode(); },
      stop: function() { if (loadingManager) loadingManager.stopDebugMode(); }
    }
  }
};

/**
* 核心修复：强制绑定控制台调试指令
* 确保在任何加载阶段输入都能 100% 响应
*/
window.tgzs = {
  debug: {
    loading: {
      start: function() {
        console.log(' tgzs.debug.loading.start() 触发');
        getLoadingManager().startDebugMode();
      },
      stop: function() {
        if (loadingManager) loadingManager.stopDebugMode();
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded，初始化加载系统...');
  getLoadingManager().init();
});

console.log('加载优化模块加载完成 (v14.0.0)');