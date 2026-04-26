<template>
  <div class="about-panel">
    <div class="about-section">
      <h3>关于 BraydenSCE V2</h3>
      <p class="about-desc">座位表编辑器 开发版本</p>
    </div>

    <div class="about-section">
      <h4>项目信息</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">版本</span>
          <span class="info-value">开发版本</span>
        </div>
        <div class="info-item">
          <span class="info-label">框架</span>
          <span class="info-value">Vue 3 + Vite</span>
        </div>
        <div class="info-item">
          <span class="info-label">桌面端</span>
          <span class="info-value">Tauri / Electron</span>
        </div>
      </div>
    </div>

    <div class="about-section">
      <h4>相关链接</h4>
      <div class="links-grid">
        <a href="https://github.com/BraydenSYLee/seat-chart-editor" target="_blank" class="link-item">
          <Github :size="18" />
          <span>GitHub 仓库</span>
        </a>
        <a href="https://afdian.com/a/brayden" target="_blank" class="link-item">
          <Heart :size="18" />
          <span>爱发电 byccc</span>
        </a>
        <a href="https://host.retiehe.com/" target="_blank" class="link-item">
          <Cloud :size="18" />
          <span>热铁盒网页托管</span>
        </a>
      </div>
    </div>

    <div class="about-section">
      <h4>技术栈</h4>
      <div class="tech-tags">
        <span class="tech-tag">Vue 3</span>
        <span class="tech-tag">Vite</span>
        <span class="tech-tag">TypeScript</span>
        <span class="tech-tag">Tauri</span>
        <span class="tech-tag">@vueuse/core</span>
        <span class="tech-tag">lucide-vue-next</span>
        <span class="tech-tag">xlsx-js-style</span>
      </div>
    </div>

    <div class="about-section footer-section">
      <p class="copyright">由 <a href="https://host.retiehe.com/" target="_blank">热铁盒网页托管</a> 提供服务</p>
    </div>
  </div>
</template>

<script setup>
import { Github, Heart, Cloud } from 'lucide-vue-next'
</script>

<style scoped>
.about-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.about-section {
  background: var(--color-bg-card);
  border-radius: 8px;
  padding: 16px;
}

.about-section h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.about-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.about-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.info-value {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.links-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-surface);
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text-primary);
  font-size: 14px;
  transition: all 0.2s;
}

.link-item:hover {
  background: var(--color-bg-selected);
  color: var(--color-primary);
  transform: translateX(4px);
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-tag {
  padding: 4px 10px;
  background: var(--color-primary);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.footer-section {
  text-align: center;
  background: transparent;
}

.copyright {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.copyright a {
  color: var(--color-primary);
  text-decoration: none;
}

.copyright a:hover {
  text-decoration: underline;
}
</style>
