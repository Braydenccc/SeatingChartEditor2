<template>
  <Teleport to="body">
    <div class="intro-overlay" role="presentation">
      <section class="intro-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-intro-title">
        <button class="close-button" type="button" aria-label="关闭简介" title="关闭简介" @click="dismiss">
          <X :size="18" />
        </button>

        <div class="intro-heading">
          <span class="intro-icon">
            <Sparkles :size="24" />
          </span>
          <div>
            <p class="intro-kicker">欢迎使用</p>
            <h2 id="welcome-intro-title">BraydenSCE V2</h2>
          </div>
        </div>

        <p class="intro-summary">
          这是一款面向教师日常排座的座位表编辑器，可以帮助你维护学生名单、配置教室座位、完成手动或智能排位，并导出图片或 Excel。
        </p>

        <div class="feature-grid" aria-label="功能简介">
          <article v-for="feature in features" :key="feature.title" class="feature-item">
            <component :is="feature.icon" :size="19" />
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
          </article>
        </div>

        <div class="tutorial-prompt">
          <BookOpen :size="20" />
          <div>
            <h3>是否看看用户手册？</h3>
            <p>打开用户手册的快速开始内容，带你按步骤完成第一张座位表。</p>
          </div>
        </div>

        <footer class="intro-actions">
          <button class="secondary-action" type="button" @click="dismiss">稍后再说</button>
          <button class="primary-action" type="button" @click="startTutorial">
            <BookOpen :size="18" />
            <span>用户手册</span>
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { BookOpen, Cloud, Grid, Sparkles, Users, Wand2, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { dismissWelcomeIntro } from '@/composables/useWelcomeOnboarding'

const router = useRouter()

const features = [
  {
    title: '名单管理',
    description: '维护学生姓名、学号、标签和属性。',
    icon: Users
  },
  {
    title: '座位配置',
    description: '按真实教室设置分组、行列和空座。',
    icon: Grid
  },
  {
    title: '智能排位',
    description: '结合规则和区域快速生成座位安排。',
    icon: Wand2
  },
  {
    title: '导出同步',
    description: '导出图片或 Excel，也可保存云端继续编辑。',
    icon: Cloud
  }
]

const dismiss = () => {
  dismissWelcomeIntro()
}

const startTutorial = async () => {
  dismissWelcomeIntro()
  await router.push({ path: '/settings', query: { tab: 'about', category: 'help' } })
}
</script>

<style scoped>
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--color-bg-overlay);
}

.intro-dialog {
  position: relative;
  width: min(680px, 100%);
  max-height: min(720px, calc(100dvh - 36px));
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: 0 18px 52px var(--shadow-lg);
  padding: 22px;
}

.close-button {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.close-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.intro-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 42px;
}

.intro-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--color-bg-selected);
  color: var(--color-primary);
}

.intro-kicker {
  margin: 0 0 4px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
}

.intro-heading h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: 0;
}

.intro-summary {
  margin: 18px 0 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.75;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.feature-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  padding: 12px;
}

.feature-item svg {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.feature-item h3,
.tutorial-prompt h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  letter-spacing: 0;
}

.feature-item p,
.tutorial-prompt p {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.tutorial-prompt {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 18px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-info-bg);
  padding: 14px;
}

.tutorial-prompt svg {
  flex: 0 0 auto;
  color: var(--color-primary);
}

.intro-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border-radius: 8px;
  padding: 0 15px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-action {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.primary-action:hover {
  background: var(--color-primary-hover);
}

.secondary-action {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.secondary-action:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

@media (max-width: 640px) {
  .intro-dialog {
    padding: 18px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .intro-actions {
    flex-direction: column-reverse;
  }

  .primary-action,
  .secondary-action {
    width: 100%;
  }
}
</style>
