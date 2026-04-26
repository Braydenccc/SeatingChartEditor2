<template>
  <div class="inline-report" v-if="report">
    <!-- Header -->
    <div class="in-report-header" :class="gradeClass">
      <div class="in-score-ring">
        <component :is="gradeIconComponent" :size="32" :stroke-width="2" :color="gradeColor" />
        <span class="in-ring-pct" :style="{ color: gradeColor }">{{ Math.round(satPct) }}%</span>
      </div>
      <div class="in-report-summary">
        <div class="in-report-meta">
          耗时 {{ duration ?? 0 }}ms · {{ ruleCount }} 个约束
        </div>
        <div class="in-report-status" :style="{ color: gradeColor }">
          <component :is="gradeIconComponent" :size="14" stroke-width="2" />
          {{ 
            satPct >= 95 ? '排位非常流畅' : 
            satPct >= 75 ? '排位基本符合预设' :
            satPct >= 50 ? '存在规则冲突需留意' : '规则冲突严重' 
          }}
        </div>
      </div>
    </div>

    <!-- Body / Violations List (if any) -->
    <div class="in-report-body" v-if="violatedRules.length > 0">
      <div class="in-group-header fail-header">警告：未满足的规则 ({{ violatedRules.length }})</div>
      <div class="in-rule-rows">
        <div v-for="item in violatedRules" :key="item.rule.id" class="in-rule-row fail">
          <CircleX :size="14" stroke-width="2" />
          <div class="in-row-content">
            <span class="in-row-text">{{ renderRuleText(item.rule) }}</span>
            <span v-if="item.reason" class="in-row-reason">{{ item.reason }}</span>
            <div class="in-row-actions">
              <button class="in-action-btn" @click="emit('focus-rule', item)">定位规则</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="in-report-body" v-if="satisfiedRules.length > 0">
        <div class="in-group-header toggle-btn" @click="showSatisfied = !showSatisfied">
          已满足的规则 ({{ satisfiedRules.length }})
          <ChevronDown :size="14" stroke-width="2" :style="{ transform: showSatisfied ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
      <div class="in-rule-rows" v-show="showSatisfied">
        <div v-for="rule in satisfiedRules" :key="rule.id" class="in-rule-row ok">
          <Check :size="14" stroke-width="2" />
          <div class="in-row-content">
            <span class="in-row-text">{{ renderRuleText(rule) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ruleCount === 0" class="in-no-rules-tip">
      <span style="font-size: 16px;">提示</span>
      <span>本次排位未使用任何约束，为随机结果。</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { AlertTriangle, Check, ChevronDown, CircleAlert, CircleX, ShieldCheck } from 'lucide-vue-next'
import { useSeatRules } from '@/composables/useSeatRules'

const props = defineProps({
  report: { type: Object, default: null },
  duration: { type: Number, default: 0 }
})
const emit = defineEmits(['focus-rule'])

const { renderRuleText } = useSeatRules()
const showSatisfied = ref(false)

const satPct = computed(() => {
  const raw = Number(props.report?.satRate ?? 1) * 100
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, raw))
})
const ruleCount = computed(() => (props.report?.satisfied?.length || 0) + (props.report?.violated?.length || 0))

const violatedRules = computed(() => props.report?.violated || [])
const satisfiedRules = computed(() => props.report?.satisfied || [])

const gradeClass = computed(() => {
  const pct = satPct.value
  if (pct >= 95) return 'grade-a'
  if (pct >= 75) return 'grade-b'
  if (pct >= 50) return 'grade-c'
  return 'grade-d'
})

const gradeColor = computed(() => {
  const pct = satPct.value
  if (pct >= 95) return 'var(--color-success)'
  if (pct >= 75) return 'var(--color-warning)'
  if (pct >= 50) return 'var(--color-warning-hover)'
  return 'var(--color-danger-text)'
})

const gradeIconComponent = computed(() => {
  const pct = satPct.value
  if (pct >= 95) return ShieldCheck
  if (pct >= 75) return Check
  if (pct >= 50) return CircleAlert
  return AlertTriangle
})

</script>

<style scoped>
.inline-report {
  margin-top: 16px;
  background: var(--color-surface);
  border-radius: 10px;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.in-report-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}

.in-report-header.grade-a { background: var(--color-success-bg); }
.in-report-header.grade-b { background: var(--color-warning-bg); }
.in-report-header.grade-c { background: var(--color-warning-bg-light); }
.in-report-header.grade-d { background: var(--color-danger-bg); }

/* 评分环替换为图标+百分比标签 */
.in-score-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 52px;
}

.in-ring-pct {
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.in-report-summary { flex: 1; }

.in-report-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.in-report-status {
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 主体内容 */
.in-report-body {
  border-bottom: 1px solid var(--color-bg-subtle);
}
.in-report-body:last-child {
  border-bottom: none;
}

.in-group-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  padding: 10px 14px;
  background: var(--color-bg-subtle);
}
.in-group-header.fail-header {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-bottom: 1px solid var(--color-danger-bg);
}

.in-group-header.toggle-btn {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  transition: background 0.15s;
}
.in-group-header.toggle-btn:hover {
  background: var(--color-bg-subtle);
}
/* .toggle-icon: replaced by ChevronDown component */

.in-rule-rows {
  display: flex;
  flex-direction: column;
}

.in-rule-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  font-size: 12px;
  border-top: 1px solid var(--color-bg-subtle);
  transition: background 0.15s;
}
.in-rule-row:hover {
  background: var(--color-bg-subtle);
}
.in-rule-row:first-child {
  border-top: none;
}

.in-rule-row.fail { background: var(--color-surface); }
.in-rule-row.ok { }

/* .in-row-icon: size controlled by :size prop */

.in-row-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.in-row-text { color: var(--color-text-primary); line-height: 1.4; }

.in-row-reason {
  font-size: 11px;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  padding: 3px 8px;
  border-radius: 4px;
  align-self: flex-start;
  font-weight: 500;
}

.in-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.in-action-btn {
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  cursor: pointer;
}

.in-action-btn.primary {
  border-color: var(--color-info-text);
  background: var(--color-info-bg);
  color: var(--color-info);
}

.in-no-rules-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
  background: var(--color-bg-subtle);
  border-top: 1px solid var(--color-border);
}
</style>
