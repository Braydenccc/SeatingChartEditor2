<template>
  <div ref="panelRef" class="help-panel">
    <header class="manual-header">
      <div class="manual-heading">
        <BookOpen :size="20" />
        <div>
          <p class="manual-kicker">用户手册</p>
          <h3>{{ userManual.title }}</h3>
          <p>{{ userManual.subtitle }}</p>
        </div>
      </div>
      <div class="manual-meta">
        <span>更新日期</span>
        <strong>{{ userManual.updatedAt }}</strong>
      </div>
    </header>

    <nav class="manual-toc" aria-label="用户手册目录">
      <button
        v-for="section in userManual.sections"
        :key="section.id"
        type="button"
        @click="scrollToSection(section.id)"
      >
        {{ section.title }}
      </button>
    </nav>

    <article class="manual-doc" v-html="manualHtml"></article>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { userManual, type UserManualSection } from '@/constants/userManual'

const panelRef = ref<HTMLElement | null>(null)

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderInline = (value: string) => {
  let html = escapeHtml(value)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return html
}

const parseTableCells = (line: string) => {
  const trimmed = line.trim()
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutEdges.split('|').map(cell => cell.trim())
}

const isTableSeparator = (line: string) => {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim())
}

const renderTable = (rows: string[]) => {
  if (rows.length < 2 || !isTableSeparator(rows[1])) {
    return rows.map(row => `<p>${renderInline(row)}</p>`).join('')
  }

  const headerCells = parseTableCells(rows[0])
  const bodyRows = rows.slice(2).map(parseTableCells)
  const header = headerCells.map(cell => `<th>${renderInline(cell)}</th>`).join('')
  const body = bodyRows
    .map(row => `<tr>${row.map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('')

  return `<div class="manual-table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`
}

const headingIdFor = (title: string, sections: UserManualSection[]) => {
  const section = sections.find(item => item.title === title)
  return section ? `manual-${section.id}` : ''
}

const renderManualMarkdown = (markdown: string, sections: UserManualSection[]) => {
  const lines = markdown.trim().split(/\r?\n/)
  const html: string[] = []
  const paragraph: string[] = []
  const tableRows: string[] = []
  let listType: 'ol' | 'ul' | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph.length = 0
  }

  const flushList = () => {
    if (!listType) return
    html.push(`</${listType}>`)
    listType = null
  }

  const flushTable = () => {
    if (!tableRows.length) return
    html.push(renderTable([...tableRows]))
    tableRows.length = 0
  }

  const ensureList = (nextType: 'ol' | 'ul') => {
    if (listType === nextType) return
    flushList()
    html.push(`<${nextType}>`)
    listType = nextType
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      flushTable()
      continue
    }

    if (trimmed.includes('|') && (trimmed.startsWith('|') || trimmed.endsWith('|'))) {
      flushParagraph()
      flushList()
      tableRows.push(trimmed)
      continue
    }

    flushTable()

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      const title = headingMatch[2]
      const id = level === 2 ? headingIdFor(title, sections) : ''
      const idAttr = id ? ` id="${id}"` : ''
      html.push(`<h${level}${idAttr}>${renderInline(title)}</h${level}>`)
      continue
    }

    const quoteMatch = /^>\s+(.+)$/.exec(trimmed)
    if (quoteMatch) {
      flushParagraph()
      flushList()
      html.push(`<blockquote>${renderInline(quoteMatch[1])}</blockquote>`)
      continue
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed)
    if (orderedMatch) {
      flushParagraph()
      ensureList('ol')
      html.push(`<li>${renderInline(orderedMatch[1])}</li>`)
      continue
    }

    const unorderedMatch = /^-\s+(.+)$/.exec(trimmed)
    if (unorderedMatch) {
      flushParagraph()
      ensureList('ul')
      html.push(`<li>${renderInline(unorderedMatch[1])}</li>`)
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()
  flushTable()

  return html.join('\n')
}

const manualHtml = computed(() => renderManualMarkdown(userManual.markdown, userManual.sections))

const getScrollParent = (element: HTMLElement): HTMLElement => {
  let parent = element.parentElement

  while (parent) {
    const style = window.getComputedStyle(parent)
    const canScroll = /(auto|scroll)/.test(style.overflowY)

    if (canScroll && parent.scrollHeight > parent.clientHeight) {
      return parent
    }

    parent = parent.parentElement
  }

  return document.scrollingElement as HTMLElement
}

const scrollToSection = (sectionId: string) => {
  const target = panelRef.value?.querySelector<HTMLElement>(`#manual-${sectionId}`)
  if (!target) return

  const scroller = getScrollParent(target)
  const scrollerRect = scroller.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  scroller.scrollTo({
    top: scroller.scrollTop + targetRect.top - scrollerRect.top - 12,
    behavior: 'smooth'
  })
}
</script>

<style scoped>
.help-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
}

.manual-header,
.manual-toc,
.manual-doc {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.manual-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
}

.manual-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--color-primary);
}

.manual-kicker {
  margin: 0 0 6px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
}

.manual-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 22px;
  font-weight: 700;
}

.manual-header p {
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

.manual-toc {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
}

.manual-toc button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.manual-toc button:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-subtle);
  color: var(--color-primary);
}

.manual-doc {
  padding: 26px 30px;
}

.manual-doc :deep(h1),
.manual-doc :deep(h2),
.manual-doc :deep(h3) {
  color: var(--color-text-primary);
  line-height: 1.35;
}

.manual-doc :deep(h1) {
  margin: 0 0 18px;
  font-size: 28px;
}

.manual-doc :deep(h2) {
  margin: 34px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 22px;
  scroll-margin-top: 12px;
}

.manual-doc :deep(h2:first-child) {
  margin-top: 0;
}

.manual-doc :deep(h3) {
  margin: 24px 0 10px;
  font-size: 17px;
}

.manual-doc :deep(p),
.manual-doc :deep(li),
.manual-doc :deep(blockquote),
.manual-doc :deep(td),
.manual-doc :deep(th) {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.8;
}

.manual-doc :deep(p) {
  margin: 0 0 12px;
}

.manual-doc :deep(ol),
.manual-doc :deep(ul) {
  margin: 0 0 16px;
  padding-left: 24px;
}

.manual-doc :deep(li) {
  margin-bottom: 6px;
}

.manual-doc :deep(blockquote) {
  margin: 14px 0 18px;
  padding: 12px 14px;
  border-left: 4px solid var(--color-primary);
  background: var(--color-info-bg);
  border-radius: 0 8px 8px 0;
}

.manual-doc :deep(code) {
  padding: 2px 5px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 0.95em;
}

.manual-doc :deep(.manual-table-wrap) {
  margin: 14px 0 18px;
  overflow-x: auto;
}

.manual-doc :deep(table) {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
}

.manual-doc :deep(th),
.manual-doc :deep(td) {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.manual-doc :deep(th) {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-weight: 700;
}

@media (max-width: 640px) {
  .help-panel {
    max-width: none;
  }

  .manual-header {
    flex-direction: column;
  }

  .manual-meta {
    width: 100%;
  }

  .manual-doc {
    padding: 20px 16px;
  }

  .manual-doc :deep(h1) {
    font-size: 24px;
  }

  .manual-doc :deep(h2) {
    font-size: 20px;
  }
}
</style>
