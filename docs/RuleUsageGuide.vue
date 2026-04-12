<template>
  <div class="usage-guide">
    <div class="guide-section">
      <h4 class="guide-title">一、快速入门</h4>
      <div class="guide-content">
        <p class="guide-text">规则系统允许您为智能排位设定约束条件，帮助系统生成更符合需求的座位安排。</p>
        <div class="guide-steps">
          <div class="guide-step">
            <span class="step-number">1</span>
            <span class="step-text">在「规则总览」标签页点击「快速模式」，选择适合的场景模板</span>
          </div>
          <div class="guide-step">
            <span class="step-number">2</span>
            <span class="step-text">调整适用对象（个人或标签）和参数</span>
          </div>
          <div class="guide-step">
            <span class="step-number">3</span>
            <span class="step-text">选择优先级后点击「添加规则」</span>
          </div>
          <div class="guide-step">
            <span class="step-number">4</span>
            <span class="step-text">在「排位」标签页运行智能排位</span>
          </div>
        </div>
      </div>
    </div>

    <div class="guide-section">
      <h4 class="guide-title">二、规则类型详解</h4>
      <div class="guide-content">
        <div class="rule-type-grid">
          <div class="rule-type-card">
            <h5 class="rule-type-title">A. 对象位置规则</h5>
            <ul class="rule-type-list">
              <li><strong>排范围</strong>：指定学生必须/尽量在某几排</li>
              <li><strong>避开窗边</strong>：让学生远离靠墙的座位</li>
              <li><strong>选区</strong>：限制学生在自定义选区内</li>
              <li><strong>分组范围</strong>：指定学生必须在某些大组</li>
              <li><strong>均匀分散</strong>：让标签学生尽量分散</li>
              <li><strong>聚集一起</strong>：让标签学生尽量坐在一起</li>
            </ul>
          </div>
          <div class="rule-type-card">
            <h5 class="rule-type-title">B. 对象关系规则</h5>
            <ul class="rule-type-list">
              <li><strong>必须同桌</strong>：指定学生必须坐在一起</li>
              <li><strong>禁止同桌</strong>：指定学生不能坐在一起</li>
              <li><strong>距离限制</strong>：控制学生之间的最小/最大距离</li>
              <li><strong>不遮挡视线</strong>：矮个子学生不被高个子挡住</li>
              <li><strong>同组/不同组</strong>：控制学生是否在同一大组</li>
              <li><strong>相邻排</strong>：让学生坐在相邻的排</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="guide-section">
      <h4 class="guide-title">三、优先级说明</h4>
      <div class="guide-content">
        <div class="priority-grid">
          <div class="priority-card required">
            <h5 class="priority-title">强制必须</h5>
            <p class="priority-desc">最高优先级，系统必须满足，否则排位失败</p>
          </div>
          <div class="priority-card prefer">
            <h5 class="priority-title">建议尽量</h5>
            <p class="priority-desc">中等优先级，系统会尽量满足但不强制</p>
          </div>
          <div class="priority-card optional">
            <h5 class="priority-title">可选参考</h5>
            <p class="priority-desc">最低优先级，作为优化目标参考</p>
          </div>
        </div>
      </div>
    </div>

    <div class="guide-section">
      <h4 class="guide-title">四、对象选择</h4>
      <div class="guide-content">
        <div class="subject-guide">
          <div class="subject-item">
            <h5 class="subject-title">个人对象</h5>
            <p class="subject-desc">针对单个学生设置规则，适用于特殊需求的学生</p>
          </div>
          <div class="subject-item">
            <h5 class="subject-title">标签对象</h5>
            <p class="subject-desc">通过标签批量设置规则，适用于某类学生（如"住宿生"、"班干部"等）</p>
          </div>
        </div>
        <p class="guide-tip">提示：可以同时添加多个对象，规则会同时应用到所有选择的对象上。</p>
      </div>
    </div>

    <div class="guide-section">
      <h4 class="guide-title">五、高级技巧</h4>
      <div class="guide-content">
        <ul class="tips-list">
          <li><strong>组合规则</strong>：使用"且/或"逻辑组合多个条件，创建复杂规则</li>
          <li><strong>取反规则</strong>：点击"是/非"按钮，将规则结果取反</li>
          <li><strong>批量操作</strong>：在规则列表中勾选多条规则，可批量修改优先级或启用/停用</li>
          <li><strong>冲突检测</strong>：系统会自动检测规则冲突，请查看警告信息</li>
          <li><strong>导出/导入</strong>：可将规则导出为JSON文件，在不同工作区间复用</li>
        </ul>
      </div>
    </div>

    <div class="tip-actions center">
      <slot name="action-button"></slot>
    </div>
  </div>
</template>

<script setup>
// 这个组件仅包含模板和样式，便于在 docs 文件夹中编辑
</script>

<style scoped>
.usage-guide {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #eef2f6;
}

.guide-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 700;
  color: #23587b;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guide-text {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.step-number {
  width: 24px;
  height: 24px;
  background: #23587b;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-text {
  font-size: 13px;
  color: #334155;
  line-height: 1.6;
}

.rule-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.rule-type-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
}

.rule-type-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.rule-type-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-type-list li {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

.priority-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.priority-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  border: 2px solid #e2e8f0;
  text-align: center;
}

.priority-card.required {
  border-color: #fee2e2;
  background: #fee2e2;
}

.priority-card.prefer {
  border-color: #fef9c3;
  background: #fef9c3;
}

.priority-card.optional {
  border-color: #f1f5f9;
  background: #f1f5f9;
}

.priority-title {
  margin: 0 0 6px 0;
  font-size: 13px;
  font-weight: 700;
}

.priority-card.required .priority-title {
  color: #dc2626;
}

.priority-card.prefer .priority-title {
  color: #b45309;
}

.priority-card.optional .priority-title {
  color: #475569;
}

.priority-desc {
  margin: 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

.subject-guide {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.subject-item {
  background: white;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
}

.subject-title {
  margin: 0 0 6px 0;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.subject-desc {
  margin: 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

.guide-tip {
  margin: 0;
  padding: 10px 12px;
  background: #eff6ff;
  border-radius: 8px;
  border: 1px solid #bfdbfe;
  font-size: 12px;
  color: #1d4ed8;
  line-height: 1.5;
}

.tips-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tips-list li {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.tip-actions {
  margin-top: 12px;
}

.tip-actions.center {
  display: flex;
  justify-content: center;
}

/* 响应式样式 */
@media (max-width: 768px) {
  .rule-type-grid,
  .priority-grid,
  .subject-guide {
    grid-template-columns: 1fr;
  }
}
</style>
