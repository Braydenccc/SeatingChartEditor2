/**
 * XSS 防护工具函数
 */

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的安全文本
 */
export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 转义 HTML 并保留换行符（转换为 <br/>）
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的安全 HTML
 */
export function escapeHtmlWithBreaks(text) {
  return escapeHtml(text).replace(/\n/g, '<br/>')
}
