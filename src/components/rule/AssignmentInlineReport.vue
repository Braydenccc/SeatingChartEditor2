<template>
  <div class="inline-report" v-if="report">
    <!-- Header -->
    <div class="in-report-header" :class="gradeClass">
      <div class="in-score-ring">
        <svg viewBox="0 0 40 40" class="in-ring-svg">
          <circle class="in-ring-bg" cx="20" cy="20" r="16" />
          <circle class="in-ring-fill" cx="20" cy="20" r="16"
            :style="{ stroke: gradeColor, strokeDasharray: `${satPct * circumference / 100} ${circumference - satPct * circumference / 100}` }" />
        </svg>
        <span class="in-ring-pct">{{ Math.round(satPct) }}%</span>
      </div>
      <div class="in-report-summary">
        <div class="in-report-meta">
          耗时 {{ duration ?? 0 }}ms · {{ ruleCount }} 个约束
        </div>
        <div class="in-report-status" :style="{ color: gradeColor }">
          {{ gradeIcon }} {{ 
            satPct >= 95 ? '排位非常流畅' : 
            satPct >= 75 ? '排位基本符合预设' :
            satPct >= 50 ? '存在规则冲突需留意' : '规则冲突严重' 
          }}
        </div>
      </div>
    </div>

    <!-- Body / Violations List (if any) -->
    <div class="in-report-body" v-if="violatedRules.length > 0">
      <div class="in-group-header fail-header">⚠️ 未满足的规则 ({{ violatedRules.length }})</div>
      <div class="in-rule-rows">
        <div v-for="item in violatedRules" :key="item.rule.id" class="in-rule-row fail">
          <span class="in-row-icon">❌</span>
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
        ✅ 成功满足的规则 ({{ satisfiedRules.length }})
        <span class="toggle-icon">{{ showSatisfied ? '收起 ∧' : '展开 ∨' }}</span>
      </div>
      <div class="in-rule-rows" v-show="showSatisfied">
        <div v-for="rule in satisfiedRules" :key="rule.id" class="in-rule-row ok">
          <span class="in-row-icon">✅</span>
          <div class="in-row-content">
            <span class="in-row-text">{{ renderRuleText(rule) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ruleCount === 0" class="in-no-rules-tip">
      <span style="font-size: 16px;">💡</span>
      <span>本次排位未使用任何约束，为随机结果。</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSeatRules } from '@/composables/useSeatRules'

const props = defineProps({
  report: { type: Object, default: null },
  duration: { type: Number, default: 0 }
})
const emit = defineEmits(['focus-rule'])

const { renderRuleText } = useSeatRules()
const showSatisfied = ref(false)

const circumference = 2 * Math.PI * 16 // r=16, ≈100.53

const satPct = computed(() => ((props.report?.satRate ?? 1) * 100))
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
  if (pct >= 95) return '#22c55e'
  if (pct >= 75) return '#f59e0b'
  if (pct >= 50) return '#f97316'
  return '#ef4444'
})

const gradeIcon = computed(() => {
  const pct = satPct.value
  if (pct >= 95) return '🎉'
  if (pct >= 75) return '✨'
  if (pct >= 50) return '📊'
  return '⚠️'
})

</script>

<style scoped>
.inline-report {
  margin-top: 16px;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
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
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.in-report-header.grade-a { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
.in-report-header.grade-b { background: linear-gradient(135deg, #fffbeb, #fef9c3); }
.in-report-header.grade-c { background: linear-gradient(135deg, #fff7ed, #ffedd5); }
.in-report-header.grade-d { background: linear-gradient(135deg, #fef2f2, #fee2e2); }

/* 评分环 */
.in-score-ring {
  position: relative;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
}

.in-ring-svg {
  width: 42px;
  height: 42px;
  transform: rotate(-90deg);
}

.in-ring-bg {
  fill: none;
  stroke: rgba(0,0,0,0.06);
  stroke-width: 3.5;
}

.in-ring-fill {
  fill: none;
  stroke-width: 3.5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.8s ease;
}

.in-ring-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #334155;
}

.in-report-summary { flex: 1; }

.in-report-meta {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}

.in-report-status {
  font-size: 13px;
  font-weight: 700;
}

/* 主体内容 */
.in-report-body {
  border-bottom: 1px solid #f1f5f9;
}
.in-report-body:last-child {
  border-bottom: none;
}

.in-group-header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  padding: 10px 14px;
  background: #f8fafc;
}
.in-group-header.fail-header {
  background: #fef2f2;
  color: #b91c1c;
  border-bottom: 1px solid #fee2e2;
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
  background: #f1f5f9;
}
.toggle-icon {
  color: #94a3b8;
  font-size: 11px;
  font-weight: normal;
}

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
  border-top: 1px solid #f1f5f9;
  transition: background 0.15s;
}
.in-rule-row:hover {
  background: #f8fafc;
}
.in-rule-row:first-child {
  border-top: none;
}

.in-rule-row.fail { background: white; }
.in-rule-row.ok { }

.in-row-icon { font-size: 13px; margin-top: 1px; }

.in-row-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.in-row-text { color: #334155; line-height: 1.4; }

.in-row-reason {
  font-size: 11px;
  color: #dc2626;
  background: #fee2e2;
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
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  cursor: pointer;
}

.in-action-btn.primary {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.in-no-rules-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
</style>
