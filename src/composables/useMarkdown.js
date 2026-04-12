// 简单的 Markdown 解析器
export function useMarkdown() {
  // 将 Markdown 转换为 HTML
  const parseMarkdown = (markdown) => {
    if (!markdown) return ''
    
    let html = markdown
    
    // 标题转换
    html = html.replace(/^# (.*$)/gm, '<h1 class="guide-title">$1</h1>')
    html = html.replace(/^## (.*$)/gm, '<h2 class="guide-title">$1</h2>')
    html = html.replace(/^### (.*$)/gm, '<h3 class="rule-type-title">$1</h3>')
    html = html.replace(/^#### (.*$)/gm, '<h4 class="priority-title">$1</h4>')
    
    // 粗体转换
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // 列表转换
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>')
    html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    
    // 段落
    html = html.replace(/^(?!<[hul])(.*)$/gm, '<p class="guide-text">$1</p>')
    
    // 引用块
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    
    // 分隔线
    html = html.replace(/^---$/gm, '<hr>')
    
    // 处理列表包装
    html = html.replace(/(<li>.*<\/li>\s*)+/g, (match) => {
      if (match.includes('class="guide-step"')) return match
      return `<ul class="rule-type-list">${match}</ul>`
    })
    
    return html
  }
  
  return {
    parseMarkdown
  }
}
