<template>
  <div class="help-panel">
    <section class="manual-hero">
      <div>
        <p class="manual-kicker">用户手册</p>
        <h3>{{ userManual.title }}</h3>
        <p>{{ userManual.subtitle }}</p>
      </div>
      <div class="manual-meta">
        <span>更新日期</span>
        <strong>{{ userManual.updatedAt }}</strong>
      </div>
    </section>

    <section class="manual-section quick-start">
      <div class="section-heading">
        <BookOpen :size="18" />
        <h4>快速开始</h4>
      </div>
      <ol>
        <li v-for="item in userManual.quickStart" :key="item">{{ item }}</li>
      </ol>
    </section>

    <div class="manual-layout">
      <nav class="manual-toc" aria-label="用户手册目录">
        <a v-for="section in userManual.sections" :key="section.id" :href="`#manual-${section.id}`">
          {{ section.title }}
        </a>
      </nav>

      <div class="manual-content">
        <section
          v-for="section in userManual.sections"
          :id="`manual-${section.id}`"
          :key="section.id"
          class="manual-section"
        >
          <div class="section-heading">
            <ChevronRight :size="18" />
            <div>
              <h4>{{ section.title }}</h4>
              <p>{{ section.summary }}</p>
            </div>
          </div>

          <div class="manual-blocks">
            <article v-for="(block, index) in section.blocks" :key="`${section.id}-${index}`" class="manual-block">
              <h5 v-if="block.title">{{ block.title }}</h5>
              <p v-if="block.body" class="block-body">{{ block.body }}</p>
              <ol v-if="block.steps?.length" class="block-list">
                <li v-for="step in block.steps" :key="step">{{ step }}</li>
              </ol>
              <ul v-if="block.bullets?.length" class="block-list">
                <li v-for="bullet in block.bullets" :key="bullet">{{ bullet }}</li>
              </ul>
              <p v-if="block.tip" class="manual-tip" :class="block.tip.kind">{{ block.tip.text }}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, ChevronRight } from 'lucide-vue-next'
import { userManual } from '@/constants/userManual'
</script>

<style scoped>
.help-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.manual-hero,
.manual-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.manual-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
}

.manual-kicker {
  margin: 0 0 6px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.manual-hero h3,
.section-heading h4,
.manual-block h5 {
  margin: 0;
  color: var(--color-text-primary);
}

.manual-hero h3 {
  font-size: 20px;
  font-weight: 700;
}

.manual-hero p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.manual-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 110px;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.manual-meta span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.manual-meta strong {
  color: var(--color-text-primary);
  font-size: 13px;
}

.manual-section {
  padding: 16px;
  scroll-margin-top: 12px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--color-primary);
}

.section-heading h4 {
  font-size: 16px;
  font-weight: 700;
}

.section-heading p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.quick-start ol,
.block-list {
  margin: 12px 0 0;
  padding-left: 22px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.quick-start li,
.block-list li {
  margin-bottom: 6px;
}

.manual-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.manual-toc {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.manual-toc a {
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-decoration: none;
}

.manual-toc a:hover {
  background: var(--color-bg-subtle);
  color: var(--color-primary);
}

.manual-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.manual-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.manual-block {
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
}

.manual-block h5 {
  font-size: 14px;
  font-weight: 700;
}

.block-body {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.manual-tip {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.manual-tip.info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.manual-tip.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

@media (max-width: 900px) {
  .manual-layout {
    grid-template-columns: 1fr;
  }

  .manual-toc {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .manual-toc::-webkit-scrollbar {
    display: none;
  }

  .manual-toc a {
    flex-shrink: 0;
    white-space: nowrap;
  }
}

@media (max-width: 640px) {
  .manual-hero {
    flex-direction: column;
  }

  .manual-meta {
    width: 100%;
  }

  .manual-blocks {
    grid-template-columns: 1fr;
  }
}
</style>
