import type { CanvasNode, Project } from '@/types'

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function styleValueToString(value: unknown): string {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string') return value
  return ''
}

function styleObjectToInline(style: React.CSSProperties): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${toKebabCase(key)}: ${styleValueToString(value)};`)
    .join(' ')
}

function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeString(value: unknown): string {
  return String(value ?? '').replace(/"/g, '\\"')
}

function splitByComma(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function splitRows(value: unknown): string[][] {
  if (typeof value !== 'string') return []
  return value
    .split(';')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split('|').map((cell) => cell.trim()))
}

function renderNodeHtml(node: CanvasNode): string {
  const baseStyle = styleObjectToInline({
    position: 'absolute',
    left: `${node.position.x}px`,
    top: `${node.position.y}px`,
    width: typeof node.size.width === 'number' ? `${node.size.width}px` : node.size.width,
    height: typeof node.size.height === 'number' ? `${node.size.height}px` : node.size.height,
    boxSizing: 'border-box',
    ...node.style
  })

  switch (node.type) {
    case 'container':
      return `<div style="${baseStyle}"></div>`
    case 'button':
      return `<button style="${baseStyle}">${escapeText(node.props.text || 'Button')}</button>`
    case 'text':
      return `<p style="${baseStyle}">${escapeText(node.props.content || 'Text')}</p>`
    case 'heading': {
      const level = Number(node.props.level) || 2
      const safeLevel = Math.max(1, Math.min(6, level))
      return `<h${safeLevel} style="${baseStyle}">${escapeText(node.props.text || 'Heading')}</h${safeLevel}>`
    }
    case 'image':
      return `<img style="${baseStyle}" src="${escapeString(node.props.src || '')}" alt="${escapeString(node.props.alt || 'Image')}" />`
    case 'input':
      return `<input style="${baseStyle}" type="${escapeString(node.props.type || 'text')}" placeholder="${escapeString(node.props.placeholder || '')}" />`
    case 'textarea':
      return `<textarea style="${baseStyle}" rows="${Number(node.props.rows) || 4}" placeholder="${escapeString(node.props.placeholder || '')}"></textarea>`
    case 'card':
      return `<div style="${baseStyle}"><div style="font-weight: 600; margin-bottom: 8px;">${escapeText(node.props.title || 'Card')}</div><div style="color: #6b7280;">Card content</div></div>`
    case 'checkbox':
      return `<label style="${baseStyle}"><input type="checkbox" ${node.props.checked ? 'checked' : ''} /> ${escapeText(node.props.label || 'Check me')}</label>`
    case 'select':
      return `<select style="${baseStyle}"><option>${escapeText(node.props.placeholder || 'Select...')}</option></select>`
    case 'link':
      return `<a style="${baseStyle}" href="${escapeString(node.props.href || '#')}">${escapeText(node.props.text || 'Link')}</a>`
    case 'badge':
      return `<span style="${baseStyle}">${escapeText(node.props.text || 'Badge')}</span>`
    case 'divider':
      return `<div style="${baseStyle}"></div>`
    case 'avatar':
      if (node.props.src) {
        return `<img style="${baseStyle}" src="${escapeString(node.props.src)}" alt="Avatar" />`
      }
      return `<div style="${baseStyle}">${escapeText(node.props.initials || '??')}</div>`
    case 'label':
      return `<label style="${baseStyle}">${escapeText(node.props.text || 'Label')}</label>`
    case 'navbar': {
      const links = splitByComma(node.props.links)
      const linksHtml = links.map((item) => `<span>${escapeText(item)}</span>`).join('')
      return `<div style="${baseStyle}; display: flex; align-items: center; justify-content: space-between; gap: 16px;"><strong>${escapeText(node.props.brand || 'Brand')}</strong><div style="display: flex; gap: 14px;">${linksHtml}</div></div>`
    }
    case 'tabs': {
      const tabs = splitByComma(node.props.tabs)
      const active = Math.max(0, Math.min(tabs.length - 1, Number(node.props.activeTab) || 0))
      const tabsHtml = tabs
        .map((tab, index) => `<span style="padding: 8px 10px; border-bottom: ${index === active ? '2px solid #3b82f6' : '2px solid transparent'};">${escapeText(tab)}</span>`)
        .join('')
      return `<div style="${baseStyle}"><div style="display: flex; border-bottom: 1px solid #e5e7eb;">${tabsHtml}</div><div style="padding: 12px; color: #6b7280;">Tab content preview</div></div>`
    }
    case 'breadcrumb': {
      const items = splitByComma(node.props.items)
      const html = items.map((item, index) => {
        const suffix = index < items.length - 1 ? ' / ' : ''
        return `<span>${escapeText(item)}</span>${suffix}`
      }).join('')
      return `<nav style="${baseStyle}">${html}</nav>`
    }
    case 'pagination': {
      const currentPage = Math.max(1, Number(node.props.currentPage) || 1)
      const totalPages = Math.max(1, Number(node.props.totalPages) || 1)
      const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1)
      const html = pages.map((page) => `<span style="display: inline-flex; min-width: 26px; height: 26px; border: 1px solid #d1d5db; border-radius: 6px; align-items: center; justify-content: center; background: ${page === currentPage ? '#2563eb' : '#fff'}; color: ${page === currentPage ? '#fff' : '#374151'};">${page}</span>`).join(' ')
      return `<div style="${baseStyle}; display: flex; align-items: center; gap: 8px;"><span>&lt;</span>${html}<span>&gt;</span></div>`
    }
    case 'alert': {
      const variant = (node.props.variant || 'warning') as string
      const palette: Record<string, { bg: string; border: string; text: string }> = {
        info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
        success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
        warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
        error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }
      }
      const colors = palette[variant] || palette.warning
      return `<div style="${baseStyle}; background: ${colors.bg}; border-color: ${colors.border}; color: ${colors.text};"><div style="font-weight: 700; margin-bottom: 4px;">${escapeText(node.props.title || 'Alert')}</div><div>${escapeText(node.props.message || 'Message')}</div></div>`
    }
    case 'progress': {
      const value = Math.max(0, Math.min(100, Number(node.props.value) || 0))
      return `<div style="${baseStyle}"><div style="display: flex; justify-content: space-between; font-size: 12px;"><span>${escapeText(node.props.label || 'Progress')}</span><span>${value}%</span></div><div style="height: 8px; border-radius: 9999px; overflow: hidden; background: #e5e7eb;"><div style="height: 100%; width: ${value}%; background: #3b82f6;"></div></div></div>`
    }
    case 'toast':
      return `<div style="${baseStyle}">${escapeText(node.props.message || 'Notification')}</div>`
    case 'modal':
      return `<div style="${baseStyle}"><div style="font-weight: 700; margin-bottom: 8px;">${escapeText(node.props.title || 'Modal')}</div><p style="margin: 0 0 12px 0; color: #6b7280;">${escapeText(node.props.body || 'Body')}</p><div style="display: flex; justify-content: flex-end; gap: 8px;"><button>${escapeText(node.props.cancelText || 'Cancel')}</button><button>${escapeText(node.props.confirmText || 'Confirm')}</button></div></div>`
    case 'radio': {
      const options = splitByComma(node.props.options)
      const selected = String(node.props.selected || '')
      const html = options.map((option) => `<label style="display: flex; gap: 8px;"><input type="radio" ${option === selected ? 'checked' : ''} />${escapeText(option)}</label>`).join('')
      return `<div style="${baseStyle}"><div style="font-weight: 600; margin-bottom: 8px;">${escapeText(node.props.label || 'Choose one')}</div>${html}</div>`
    }
    case 'switch':
      return `<div style="${baseStyle}; display: flex; justify-content: space-between; align-items: center;"><span>${escapeText(node.props.label || 'Switch')}</span><span>${node.props.checked ? 'On' : 'Off'}</span></div>`
    case 'slider': {
      const min = Number(node.props.min) || 0
      const max = Number(node.props.max) || 100
      const value = Math.max(min, Math.min(max, Number(node.props.value) || min))
      const progress = max === min ? 0 : ((value - min) / (max - min)) * 100
      return `<div style="${baseStyle}"><div style="display: flex; justify-content: space-between; font-size: 12px;"><span>${escapeText(node.props.label || 'Slider')}</span><span>${value}</span></div><div style="height: 6px; border-radius: 9999px; background: #e5e7eb;"><div style="height: 100%; width: ${progress}%; border-radius: inherit; background: #2563eb;"></div></div></div>`
    }
    case 'table': {
      const headers = splitByComma(node.props.headers)
      const rows = splitRows(node.props.rows)
      const thead = headers.map((header) => `<th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeText(header)}</th>`).join('')
      const tbody = rows.map((row) => `<tr>${row.map((cell) => `<td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeText(cell)}</td>`).join('')}</tr>`).join('')
      return `<div style="${baseStyle}"><table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`
    }
    case 'list': {
      const items = splitByComma(node.props.items)
      const tag = node.props.ordered ? 'ol' : 'ul'
      const html = items.map((item) => `<li>${escapeText(item)}</li>`).join('')
      return `<${tag} style="${baseStyle}; padding-left: 20px;">${html}</${tag}>`
    }
    case 'statistic':
      return `<div style="${baseStyle}"><div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">${escapeText(node.props.label || 'Statistic')}</div><div style="font-size: 28px; font-weight: 700;">${escapeText(node.props.value || '0')}</div><div style="font-size: 12px; color: #059669;">${escapeText(node.props.trend || '+0%')}</div></div>`
    case 'timeline': {
      const events = splitRows(node.props.events)
      const html = events.map((event) => `<div style="display: flex; gap: 8px;"><span style="color: #3b82f6;">•</span><span><strong>${escapeText(event[0] || 'Event')}</strong> <small>${escapeText(event[1] || '')}</small></span></div>`).join('')
      return `<div style="${baseStyle}">${html}</div>`
    }
    default:
      return `<div style="${baseStyle}"></div>`
  }
}

function renderNodeReact(node: CanvasNode): string {
  const style = {
    position: 'absolute',
    left: `${node.position.x}px`,
    top: `${node.position.y}px`,
    width: typeof node.size.width === 'number' ? `${node.size.width}px` : node.size.width,
    height: typeof node.size.height === 'number' ? `${node.size.height}px` : node.size.height,
    boxSizing: 'border-box',
    ...node.style
  }
  const styleString = JSON.stringify(style, null, 2)
  const styleExpr = styleString

  switch (node.type) {
    case 'container':
      return `<div style={${styleExpr}} />`
    case 'button':
      return `<button style={${styleExpr}}>${escapeText(node.props.text || 'Button')}</button>`
    case 'text':
      return `<p style={${styleExpr}}>${escapeText(node.props.content || 'Text')}</p>`
    case 'heading': {
      const level = Number(node.props.level) || 2
      const safeLevel = Math.max(1, Math.min(6, level))
      return `<h${safeLevel} style={${styleExpr}}>${escapeText(node.props.text || 'Heading')}</h${safeLevel}>`
    }
    case 'image':
      return `<img style={${styleExpr}} src="${escapeString(node.props.src || '')}" alt="${escapeString(node.props.alt || 'Image')}" />`
    case 'input':
      return `<input style={${styleExpr}} type="${escapeString(node.props.type || 'text')}" placeholder="${escapeString(node.props.placeholder || '')}" />`
    case 'textarea':
      return `<textarea style={${styleExpr}} rows={${Number(node.props.rows) || 4}} placeholder="${escapeString(node.props.placeholder || '')}" />`
    case 'card':
      return `<div style={${styleExpr}}><div style={{ fontWeight: 600, marginBottom: '8px' }}>${escapeText(node.props.title || 'Card')}</div><div style={{ color: '#6b7280' }}>Card content</div></div>`
    case 'checkbox':
      return `<label style={${styleExpr}}><input type="checkbox" defaultChecked={${Boolean(node.props.checked)}} /> ${escapeText(node.props.label || 'Check me')}</label>`
    case 'select':
      return `<select style={${styleExpr}}><option>${escapeText(node.props.placeholder || 'Select...')}</option></select>`
    case 'link':
      return `<a style={${styleExpr}} href="${escapeString(node.props.href || '#')}">${escapeText(node.props.text || 'Link')}</a>`
    case 'badge':
      return `<span style={${styleExpr}}>${escapeText(node.props.text || 'Badge')}</span>`
    case 'divider':
      return `<div style={${styleExpr}} />`
    case 'avatar':
      if (node.props.src) {
        return `<img style={${styleExpr}} src="${escapeString(node.props.src)}" alt="Avatar" />`
      }
      return `<div style={${styleExpr}}>${escapeText(node.props.initials || '??')}</div>`
    case 'label':
      return `<label style={${styleExpr}}>${escapeText(node.props.text || 'Label')}</label>`
    case 'navbar': {
      const links = splitByComma(node.props.links)
      const linksJsx = links.map((item) => `<span>${escapeText(item)}</span>`).join('')
      return `<div style={{ ...${styleExpr}, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}><strong>${escapeText(node.props.brand || 'Brand')}</strong><div style={{ display: 'flex', gap: '14px' }}>${linksJsx}</div></div>`
    }
    case 'tabs': {
      const tabs = splitByComma(node.props.tabs)
      const active = Math.max(0, Math.min(tabs.length - 1, Number(node.props.activeTab) || 0))
      const tabsJsx = tabs.map((tab, index) => `<span style={{ padding: '8px 10px', borderBottom: '${index === active ? '2px solid #3b82f6' : '2px solid transparent'}' }}>${escapeText(tab)}</span>`).join('')
      return `<div style={${styleExpr}}><div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>${tabsJsx}</div><div style={{ padding: '12px', color: '#6b7280' }}>Tab content preview</div></div>`
    }
    case 'breadcrumb': {
      const items = splitByComma(node.props.items)
      const content = items.map((item, index) => `${escapeText(item)}${index < items.length - 1 ? ' / ' : ''}`).join('')
      return `<nav style={${styleExpr}}>${content}</nav>`
    }
    case 'pagination': {
      const currentPage = Math.max(1, Number(node.props.currentPage) || 1)
      const totalPages = Math.max(1, Number(node.props.totalPages) || 1)
      const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1)
      const pageJsx = pages.map((page) => `<span style={{ display: 'inline-flex', minWidth: '26px', height: '26px', border: '1px solid #d1d5db', borderRadius: '6px', alignItems: 'center', justifyContent: 'center', background: '${page === currentPage ? '#2563eb' : '#fff'}', color: '${page === currentPage ? '#fff' : '#374151'}' }}>{${page}}</span>`).join(' ')
      return `<div style={{ ...${styleExpr}, display: 'flex', alignItems: 'center', gap: '8px' }}><span>{'<'}</span>${pageJsx}<span>{'>'}</span></div>`
    }
    case 'alert': {
      const variant = (node.props.variant || 'warning') as string
      const palette: Record<string, { bg: string; border: string; text: string }> = {
        info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
        success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
        warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
        error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }
      }
      const colors = palette[variant] || palette.warning
      return `<div style={{ ...${styleExpr}, background: '${colors.bg}', borderColor: '${colors.border}', color: '${colors.text}' }}><div style={{ fontWeight: 700, marginBottom: '4px' }}>${escapeText(node.props.title || 'Alert')}</div><div>${escapeText(node.props.message || 'Message')}</div></div>`
    }
    case 'progress': {
      const value = Math.max(0, Math.min(100, Number(node.props.value) || 0))
      return `<div style={${styleExpr}}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>${escapeText(node.props.label || 'Progress')}</span><span>${value}%</span></div><div style={{ height: '8px', borderRadius: '9999px', overflow: 'hidden', background: '#e5e7eb' }}><div style={{ height: '100%', width: '${value}%', background: '#3b82f6' }} /></div></div>`
    }
    case 'toast':
      return `<div style={${styleExpr}}>${escapeText(node.props.message || 'Notification')}</div>`
    case 'modal':
      return `<div style={${styleExpr}}><div style={{ fontWeight: 700, marginBottom: '8px' }}>${escapeText(node.props.title || 'Modal')}</div><p style={{ margin: '0 0 12px 0', color: '#6b7280' }}>${escapeText(node.props.body || 'Body')}</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button>${escapeText(node.props.cancelText || 'Cancel')}</button><button>${escapeText(node.props.confirmText || 'Confirm')}</button></div></div>`
    case 'radio': {
      const options = splitByComma(node.props.options)
      const selected = String(node.props.selected || '')
      const optionsJsx = options.map((option) => `<label style={{ display: 'flex', gap: '8px' }}><input type="radio" defaultChecked={${option === selected}} />${escapeText(option)}</label>`).join('')
      return `<div style={${styleExpr}}><div style={{ fontWeight: 600, marginBottom: '8px' }}>${escapeText(node.props.label || 'Choose one')}</div>${optionsJsx}</div>`
    }
    case 'switch':
      return `<div style={{ ...${styleExpr}, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>${escapeText(node.props.label || 'Switch')}</span><span>${node.props.checked ? 'On' : 'Off'}</span></div>`
    case 'slider': {
      const min = Number(node.props.min) || 0
      const max = Number(node.props.max) || 100
      const value = Math.max(min, Math.min(max, Number(node.props.value) || min))
      const progress = max === min ? 0 : ((value - min) / (max - min)) * 100
      return `<div style={${styleExpr}}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>${escapeText(node.props.label || 'Slider')}</span><span>${value}</span></div><div style={{ height: '6px', borderRadius: '9999px', background: '#e5e7eb' }}><div style={{ height: '100%', width: '${progress}%', borderRadius: 'inherit', background: '#2563eb' }} /></div></div>`
    }
    case 'table': {
      const headers = splitByComma(node.props.headers)
      const rows = splitRows(node.props.rows)
      const headerJsx = headers.map((header) => `<th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb' }}>${escapeText(header)}</th>`).join('')
      const bodyJsx = rows.map((row) => `<tr>${row.map((cell) => `<td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>${escapeText(cell)}</td>`).join('')}</tr>`).join('')
      return `<div style={${styleExpr}}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}><thead><tr>${headerJsx}</tr></thead><tbody>${bodyJsx}</tbody></table></div>`
    }
    case 'list': {
      const items = splitByComma(node.props.items)
      const listTag = node.props.ordered ? 'ol' : 'ul'
      const listItems = items.map((item) => `<li>${escapeText(item)}</li>`).join('')
      return `<${listTag} style={{ ...${styleExpr}, paddingLeft: '20px' }}>${listItems}</${listTag}>`
    }
    case 'statistic':
      return `<div style={${styleExpr}}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>${escapeText(node.props.label || 'Statistic')}</div><div style={{ fontSize: '28px', fontWeight: 700 }}>${escapeText(node.props.value || '0')}</div><div style={{ fontSize: '12px', color: '#059669' }}>${escapeText(node.props.trend || '+0%')}</div></div>`
    case 'timeline': {
      const events = splitRows(node.props.events)
      const eventsJsx = events.map((event) => `<div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#3b82f6' }}>•</span><span><strong>${escapeText(event[0] || 'Event')}</strong> <small>${escapeText(event[1] || '')}</small></span></div>`).join('')
      return `<div style={${styleExpr}}>${eventsJsx}</div>`
    }
    default:
      return `<div style={${styleExpr}} />`
  }
}

export function exportAsHtml(project: Project, nodes: CanvasNode[]): string {
  const rendered = nodes.map((node) => `    ${renderNodeHtml(node)}`).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(project.name)}</title>
</head>
<body style="margin: 0; font-family: ${project.designSystem.typography.fontFamily}, sans-serif; background: ${project.designSystem.colors.background.value}; color: ${project.designSystem.colors.text.value};">
  <main style="position: relative; width: 1200px; height: 800px; margin: 24px auto; border: 1px dashed #d1d5db;">
${rendered}
  </main>
</body>
</html>`
}

export function exportAsReact(project: Project, nodes: CanvasNode[]): string {
  const rendered = nodes.map((node) => `      ${renderNodeReact(node)}`).join('\n')

  return `import React from 'react'

export default function ${project.name.replace(/[^a-zA-Z0-9]/g, '') || 'ExportedPage'}() {
  return (
    <main
      style={{
        position: 'relative',
        width: '1200px',
        height: '800px',
        margin: '24px auto',
        border: '1px dashed #d1d5db',
        fontFamily: '${escapeString(project.designSystem.typography.fontFamily)}, sans-serif',
        background: '${escapeString(project.designSystem.colors.background.value)}',
        color: '${escapeString(project.designSystem.colors.text.value)}'
      }}
    >
${rendered}
    </main>
  )
}
`
}

export function exportAsVue(project: Project, nodes: CanvasNode[]): string {
  const rendered = nodes.map((node) => `    ${renderNodeHtml(node)}`).join('\n')

  return `<template>
  <main class="canvas-root">
${rendered}
  </main>
</template>

<script setup lang="ts">
// Generated by aiuiedit
</script>

<style scoped>
.canvas-root {
  position: relative;
  width: 1200px;
  height: 800px;
  margin: 24px auto;
  border: 1px dashed #d1d5db;
  font-family: ${project.designSystem.typography.fontFamily}, sans-serif;
  background: ${project.designSystem.colors.background.value};
  color: ${project.designSystem.colors.text.value};
}
</style>
`
}
