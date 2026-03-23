import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/common/Button'
import { Download, ExternalLink, RefreshCcw } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAppStore } from '@/store/useAppStore'
import { useProjectStore } from '@/store/useProjectStore'
import type { Page, Project } from '@/types'

interface RenderedPreviewProps {
  currentProject: Project | null
  currentPage: Page | null
  onCaptureBlocks?: (payload: {
    title: string
    blocks: Array<{
      type: 'heading' | 'text' | 'button' | 'link' | 'image' | 'card'
      text: string
      src?: string
      href?: string
      className?: string
    }>
  }) => void
}

type PreviewMode = 'embedded' | 'snapshot'

type EmbeddedDiagnosticCode = 'loading' | 'loaded' | 'timeout' | 'dns' | 'refused' | 'frame_policy' | 'network'

interface SnapshotSelection {
  id: string
  tag: string
  text: string
  isStructural: boolean
  attributes: {
    href?: string
    src?: string
    alt?: string
    className?: string
    style?: string
  }
}

const STRUCTURAL_TAGS = new Set(['div', 'section', 'article', 'main', 'aside', 'nav'])

interface TailwindOption {
  label: string
  value: string
}

interface TailwindClassGroup {
  key: string
  label: string
  matcher: RegExp
  options: TailwindOption[]
}

type TailwindVariantPrefix = '' | 'sm:' | 'md:' | 'lg:' | 'xl:'

const TAILWIND_VARIANTS: Array<{ label: string; prefix: TailwindVariantPrefix }> = [
  { label: 'Base', prefix: '' },
  { label: 'SM', prefix: 'sm:' },
  { label: 'MD', prefix: 'md:' },
  { label: 'LG', prefix: 'lg:' }
]

const RESPONSIVE_GROUP_KEYS = new Set([
  'display',
  'layout',
  'direction',
  'justify',
  'items',
  'gap',
  'width',
  'maxWidth',
  'padding'
])

const TAILWIND_CLASS_GROUPS: TailwindClassGroup[] = [
  {
    key: 'display',
    label: 'Display',
    matcher: /^(block|inline-block|inline|flex|grid|hidden)$/,
    options: [
      { label: 'Block', value: 'block' },
      { label: 'Inline', value: 'inline' },
      { label: 'Flex', value: 'flex' },
      { label: 'Grid', value: 'grid' },
      { label: 'Hidden', value: 'hidden' }
    ]
  },
  {
    key: 'size',
    label: 'Text Size',
    matcher: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
    options: [
      { label: 'XS', value: 'text-xs' },
      { label: 'SM', value: 'text-sm' },
      { label: 'Base', value: 'text-base' },
      { label: 'LG', value: 'text-lg' },
      { label: 'XL', value: 'text-xl' },
      { label: '2XL', value: 'text-2xl' },
      { label: '3XL', value: 'text-3xl' },
      { label: '4XL', value: 'text-4xl' },
      { label: '5XL', value: 'text-5xl' },
      { label: '6XL', value: 'text-6xl' }
    ]
  },
  {
    key: 'weight',
    label: 'Font Weight',
    matcher: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
    options: [
      { label: 'Thin', value: 'font-thin' },
      { label: 'XLight', value: 'font-extralight' },
      { label: 'Light', value: 'font-light' },
      { label: 'Normal', value: 'font-normal' },
      { label: 'Medium', value: 'font-medium' },
      { label: 'Semi', value: 'font-semibold' },
      { label: 'Bold', value: 'font-bold' },
      { label: 'XBold', value: 'font-extrabold' },
      { label: 'Black', value: 'font-black' }
    ]
  },
  {
    key: 'align',
    label: 'Text Align',
    matcher: /^text-(left|center|right|justify)$/,
    options: [
      { label: 'Left', value: 'text-left' },
      { label: 'Center', value: 'text-center' },
      { label: 'Right', value: 'text-right' },
      { label: 'Justify', value: 'text-justify' }
    ]
  },
  {
    key: 'textColor',
    label: 'Text Color',
    matcher: /^text-(black|white|slate-(500|700|900)|blue-(500|600)|green-(500|600)|red-(500|600))$/,
    options: [
      { label: 'Slate', value: 'text-slate-700' },
      { label: 'Dark', value: 'text-slate-900' },
      { label: 'Blue', value: 'text-blue-600' },
      { label: 'Green', value: 'text-green-600' },
      { label: 'Red', value: 'text-red-600' },
      { label: 'White', value: 'text-white' }
    ]
  },
  {
    key: 'bgColor',
    label: 'Background',
    matcher: /^bg-(white|black|transparent|slate-(100|900)|blue-(500|600)|green-(500|600)|red-(500|600))$/,
    options: [
      { label: 'None', value: 'bg-transparent' },
      { label: 'White', value: 'bg-white' },
      { label: 'Slate', value: 'bg-slate-100' },
      { label: 'Dark', value: 'bg-slate-900' },
      { label: 'Blue', value: 'bg-blue-600' },
      { label: 'Green', value: 'bg-green-600' }
    ]
  },
  {
    key: 'radius',
    label: 'Radius',
    matcher: /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/,
    options: [
      { label: 'None', value: 'rounded-none' },
      { label: 'SM', value: 'rounded-sm' },
      { label: 'MD', value: 'rounded-md' },
      { label: 'LG', value: 'rounded-lg' },
      { label: 'XL', value: 'rounded-xl' },
      { label: '2XL', value: 'rounded-2xl' },
      { label: '3XL', value: 'rounded-3xl' },
      { label: 'Full', value: 'rounded-full' }
    ]
  },
  {
    key: 'shadow',
    label: 'Shadow',
    matcher: /^shadow(-(none|sm|md|lg|xl|2xl|inner))?$/,
    options: [
      { label: 'None', value: 'shadow-none' },
      { label: 'SM', value: 'shadow-sm' },
      { label: 'MD', value: 'shadow-md' },
      { label: 'LG', value: 'shadow-lg' },
      { label: 'XL', value: 'shadow-xl' },
      { label: '2XL', value: 'shadow-2xl' },
      { label: 'Inner', value: 'shadow-inner' }
    ]
  },
  {
    key: 'padding',
    label: 'Padding',
    matcher: /^p-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32)$/,
    options: [
      { label: '0', value: 'p-0' },
      { label: '1', value: 'p-1' },
      { label: '2', value: 'p-2' },
      { label: '3', value: 'p-3' },
      { label: '4', value: 'p-4' },
      { label: '5', value: 'p-5' },
      { label: '6', value: 'p-6' },
      { label: '8', value: 'p-8' },
      { label: '10', value: 'p-10' },
      { label: '12', value: 'p-12' },
      { label: '16', value: 'p-16' }
    ]
  },
  {
    key: 'layout',
    label: 'Layout Mode',
    matcher: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid)$/,
    options: [
      { label: 'Block', value: 'block' },
      { label: 'Inline', value: 'inline' },
      { label: 'Flex', value: 'flex' },
      { label: 'IFlex', value: 'inline-flex' },
      { label: 'Grid', value: 'grid' },
      { label: 'IGrid', value: 'inline-grid' }
    ]
  },
  {
    key: 'direction',
    label: 'Direction',
    matcher: /^flex-(row|row-reverse|col|col-reverse)$/,
    options: [
      { label: 'Row', value: 'flex-row' },
      { label: 'Row Rev', value: 'flex-row-reverse' },
      { label: 'Column', value: 'flex-col' },
      { label: 'Col Rev', value: 'flex-col-reverse' }
    ]
  },
  {
    key: 'justify',
    label: 'Justify',
    matcher: /^justify-(normal|start|center|end|between|around|evenly|stretch)$/,
    options: [
      { label: 'Normal', value: 'justify-normal' },
      { label: 'Start', value: 'justify-start' },
      { label: 'Center', value: 'justify-center' },
      { label: 'End', value: 'justify-end' },
      { label: 'Between', value: 'justify-between' },
      { label: 'Around', value: 'justify-around' },
      { label: 'Evenly', value: 'justify-evenly' }
    ]
  },
  {
    key: 'items',
    label: 'Items',
    matcher: /^items-(start|center|end|stretch|baseline)$/,
    options: [
      { label: 'Start', value: 'items-start' },
      { label: 'Center', value: 'items-center' },
      { label: 'End', value: 'items-end' },
      { label: 'Stretch', value: 'items-stretch' }
    ]
  },
  {
    key: 'gap',
    label: 'Gap',
    matcher: /^gap-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16)$/,
    options: [
      { label: '0', value: 'gap-0' },
      { label: '1', value: 'gap-1' },
      { label: '2', value: 'gap-2' },
      { label: '3', value: 'gap-3' },
      { label: '4', value: 'gap-4' },
      { label: '6', value: 'gap-6' },
      { label: '8', value: 'gap-8' },
      { label: '10', value: 'gap-10' },
      { label: '12', value: 'gap-12' }
    ]
  },
  {
    key: 'width',
    label: 'Width',
    matcher: /^w-(auto|px|0|1\/2|1\/3|2\/3|1\/4|2\/4|3\/4|1\/5|2\/5|3\/5|4\/5|full|screen|svw|lvw|dvw|fit|min|max|96|80|72|64|56|48|40|32|24|20|16)$/,
    options: [
      { label: 'Auto', value: 'w-auto' },
      { label: '1/2', value: 'w-1/2' },
      { label: '1/3', value: 'w-1/3' },
      { label: '2/3', value: 'w-2/3' },
      { label: '1/4', value: 'w-1/4' },
      { label: '3/4', value: 'w-3/4' },
      { label: 'Fit', value: 'w-fit' },
      { label: 'Full', value: 'w-full' },
      { label: 'Screen', value: 'w-screen' },
      { label: '64', value: 'w-64' },
      { label: '80', value: 'w-80' },
      { label: '96', value: 'w-96' }
    ]
  },
  {
    key: 'maxWidth',
    label: 'Max Width',
    matcher: /^max-w-(none|full|screen-sm|screen-md|screen-lg|screen-xl|screen-2xl|prose|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/,
    options: [
      { label: 'None', value: 'max-w-none' },
      { label: 'XS', value: 'max-w-xs' },
      { label: 'SM', value: 'max-w-sm' },
      { label: 'MD', value: 'max-w-md' },
      { label: 'LG', value: 'max-w-lg' },
      { label: 'XL', value: 'max-w-xl' },
      { label: '2XL', value: 'max-w-2xl' },
      { label: '3XL', value: 'max-w-3xl' },
      { label: '4XL', value: 'max-w-4xl' },
      { label: '5XL', value: 'max-w-5xl' },
      { label: '6XL', value: 'max-w-6xl' },
      { label: '7XL', value: 'max-w-7xl' },
      { label: 'Full', value: 'max-w-full' },
      { label: 'Prose', value: 'max-w-prose' },
      { label: 'Screen SM', value: 'max-w-screen-sm' },
      { label: 'Screen MD', value: 'max-w-screen-md' },
      { label: 'Screen LG', value: 'max-w-screen-lg' },
      { label: 'Screen XL', value: 'max-w-screen-xl' },
      { label: 'Screen 2XL', value: 'max-w-screen-2xl' }
    ]
  }
]

function splitClassTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function parseInlineStyle(styleText: string): Record<string, string> {
  return styleText
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, declaration) => {
      const dividerIndex = declaration.indexOf(':')
      if (dividerIndex <= 0) return acc
      const key = declaration.slice(0, dividerIndex).trim().toLowerCase()
      const value = declaration.slice(dividerIndex + 1).trim()
      if (key && value) {
        acc[key] = value
      }
      return acc
    }, {})
}

function stringifyInlineStyle(styleMap: Record<string, string>): string {
  return Object.entries(styleMap)
    .filter(([key, value]) => key.trim() && value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
}

function upsertInlineStyleProperty(styleText: string, property: string, value: string): string {
  const styleMap = parseInlineStyle(styleText)
  const normalizedProperty = property.trim().toLowerCase()
  const nextValue = value.trim()

  if (!normalizedProperty) return styleText

  if (!nextValue) {
    delete styleMap[normalizedProperty]
  } else {
    styleMap[normalizedProperty] = nextValue
  }

  return stringifyInlineStyle(styleMap)
}

function splitVariantToken(token: string): { prefix: TailwindVariantPrefix; base: string } {
  const variantMatch = token.match(/^(sm:|md:|lg:|xl:)(.+)$/)
  if (!variantMatch) {
    return { prefix: '', base: token }
  }

  return {
    prefix: variantMatch[1] as TailwindVariantPrefix,
    base: variantMatch[2]
  }
}

function replaceClassGroup(className: string, group: TailwindClassGroup, nextValue: string, variant: TailwindVariantPrefix = ''): string {
  const tokens = splitClassTokens(className)
  const filtered = tokens.filter((token) => {
    const parsed = splitVariantToken(token)
    return !(parsed.prefix === variant && group.matcher.test(parsed.base))
  })

  if (nextValue) {
    filtered.push(`${variant}${nextValue}`)
  }

  return Array.from(new Set(filtered)).join(' ').trim()
}

function joinPreviewUrl(base: string, route: string): string {
  const normalizedBase = base.trim().replace(/\/+$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  return `${normalizedBase}${normalizedRoute}`
}

function injectInstrumentedSnapshot(html: string, url: string): string {
  const sanitizedHtml = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, ' ')

  const baseTag = `<base href="${url.replace(/"/g, '&quot;')}" />`
  const instrumentationScript = `<script>(function(){
    var counter = 0;
    var active = null;
    var selector = 'h1,h2,h3,h4,h5,h6,p,li,a,button,span,img,section,article,div,main,aside,nav';
    var sizeMap = {
      'text-xs': '12px',
      'text-sm': '14px',
      'text-base': '16px',
      'text-lg': '18px',
      'text-xl': '20px',
      'text-2xl': '24px',
      'text-3xl': '30px',
      'text-4xl': '36px',
      'text-5xl': '48px',
      'text-6xl': '60px'
    };
    var colorMap = {
      'text-slate-700': '#334155',
      'text-slate-900': '#0f172a',
      'text-blue-600': '#2563eb',
      'text-green-600': '#16a34a',
      'text-red-600': '#dc2626',
      'text-white': '#ffffff',
      'bg-transparent': 'transparent',
      'bg-white': '#ffffff',
      'bg-slate-100': '#f1f5f9',
      'bg-slate-900': '#0f172a',
      'bg-blue-600': '#2563eb',
      'bg-green-600': '#16a34a'
    };
    var gapMap = {
      'gap-0': '0px',
      'gap-1': '4px',
      'gap-2': '8px',
      'gap-3': '12px',
      'gap-4': '16px',
      'gap-6': '24px',
      'gap-8': '32px',
      'gap-10': '40px',
      'gap-12': '48px'
    };
    var paddingMap = {
      'p-0': '0px',
      'p-1': '4px',
      'p-2': '8px',
      'p-3': '12px',
      'p-4': '16px',
      'p-5': '20px',
      'p-6': '24px',
      'p-8': '32px',
      'p-10': '40px',
      'p-12': '48px',
      'p-16': '64px'
    };
    var radiusMap = { 'rounded-none': '0px', 'rounded-sm': '2px', 'rounded-md': '6px', 'rounded-lg': '8px', 'rounded-xl': '12px', 'rounded-full': '9999px' };
    var shadowMap = {
      'shadow-none': 'none',
      'shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.1)',
      'shadow-md': '0 4px 6px rgba(15, 23, 42, 0.12)',
      'shadow-lg': '0 10px 15px rgba(15, 23, 42, 0.14)',
      'shadow-xl': '0 20px 25px rgba(15, 23, 42, 0.16)'
    };

    function applyInlinePreviewStyles(el){
      if(!el) return;
      var className = el.getAttribute('class') || '';
      var tokens = className.split(/\s+/).filter(Boolean).map(function(token){
        var parts = token.split(':');
        return parts[parts.length - 1];
      });

      el.style.display = '';
      el.style.flexDirection = '';
      el.style.justifyContent = '';
      el.style.alignItems = '';
      el.style.gap = '';
      el.style.padding = '';
      el.style.width = '';
      el.style.maxWidth = '';
      el.style.textAlign = '';
      el.style.fontWeight = '';
      el.style.fontSize = '';
      el.style.color = '';
      el.style.backgroundColor = '';
      el.style.borderRadius = '';
      el.style.boxShadow = '';

      tokens.forEach(function(token){
        if(token === 'block' || token === 'inline' || token === 'inline-block' || token === 'flex' || token === 'grid' || token === 'hidden') {
          el.style.display = token === 'hidden' ? 'none' : token;
        }
        if(token === 'flex-row') el.style.flexDirection = 'row';
        if(token === 'flex-col') el.style.flexDirection = 'column';
        if(token === 'justify-start') el.style.justifyContent = 'flex-start';
        if(token === 'justify-center') el.style.justifyContent = 'center';
        if(token === 'justify-end') el.style.justifyContent = 'flex-end';
        if(token === 'justify-between') el.style.justifyContent = 'space-between';
        if(token === 'items-start') el.style.alignItems = 'flex-start';
        if(token === 'items-center') el.style.alignItems = 'center';
        if(token === 'items-end') el.style.alignItems = 'flex-end';
        if(token === 'items-stretch') el.style.alignItems = 'stretch';
        if(token === 'text-left' || token === 'text-center' || token === 'text-right' || token === 'text-justify') {
          el.style.textAlign = token.replace('text-', '');
        }
        if(token === 'font-light') el.style.fontWeight = '300';
        if(token === 'font-normal') el.style.fontWeight = '400';
        if(token === 'font-medium') el.style.fontWeight = '500';
        if(token === 'font-semibold') el.style.fontWeight = '600';
        if(token === 'font-bold') el.style.fontWeight = '700';
        if(sizeMap[token]) el.style.fontSize = sizeMap[token];
        if(colorMap[token]) {
          if(token.indexOf('text-') === 0) el.style.color = colorMap[token];
          if(token.indexOf('bg-') === 0) el.style.backgroundColor = colorMap[token];
        }
        if(gapMap[token]) el.style.gap = gapMap[token];
        if(paddingMap[token]) el.style.padding = paddingMap[token];
        if(radiusMap[token]) el.style.borderRadius = radiusMap[token];
        if(shadowMap[token]) el.style.boxShadow = shadowMap[token];
        if(token === 'w-auto' || token === 'w-fit' || token === 'w-full' || token === 'w-screen' || token === 'w-1/2' || token === 'w-1/3' || token === 'w-2/3' || token === 'w-1/4' || token === 'w-3/4' || token === 'w-64' || token === 'w-80' || token === 'w-96') {
          if(token === 'w-auto') el.style.width = 'auto';
          if(token === 'w-fit') el.style.width = 'fit-content';
          if(token === 'w-full') el.style.width = '100%';
          if(token === 'w-screen') el.style.width = '100vw';
          if(token === 'w-1/2') el.style.width = '50%';
          if(token === 'w-1/3') el.style.width = '33.333333%';
          if(token === 'w-2/3') el.style.width = '66.666667%';
          if(token === 'w-1/4') el.style.width = '25%';
          if(token === 'w-3/4') el.style.width = '75%';
          if(token === 'w-64') el.style.width = '16rem';
          if(token === 'w-80') el.style.width = '20rem';
          if(token === 'w-96') el.style.width = '24rem';
        }
        if(token === 'max-w-none') el.style.maxWidth = 'none';
        if(token === 'max-w-xs') el.style.maxWidth = '20rem';
        if(token === 'max-w-sm') el.style.maxWidth = '24rem';
        if(token === 'max-w-md') el.style.maxWidth = '28rem';
        if(token === 'max-w-lg') el.style.maxWidth = '32rem';
        if(token === 'max-w-xl') el.style.maxWidth = '36rem';
        if(token === 'max-w-2xl') el.style.maxWidth = '42rem';
        if(token === 'max-w-3xl') el.style.maxWidth = '48rem';
        if(token === 'max-w-4xl') el.style.maxWidth = '56rem';
        if(token === 'max-w-5xl') el.style.maxWidth = '64rem';
        if(token === 'max-w-6xl') el.style.maxWidth = '72rem';
        if(token === 'max-w-7xl') el.style.maxWidth = '80rem';
        if(token === 'max-w-full') el.style.maxWidth = '100%';
        if(token === 'max-w-prose') el.style.maxWidth = '65ch';
        if(token === 'max-w-screen-sm') el.style.maxWidth = '640px';
        if(token === 'max-w-screen-md') el.style.maxWidth = '768px';
        if(token === 'max-w-screen-lg') el.style.maxWidth = '1024px';
        if(token === 'max-w-screen-xl') el.style.maxWidth = '1280px';
        if(token === 'max-w-screen-2xl') el.style.maxWidth = '1536px';
      });
    }

    function mark(el){
      if(active){ active.style.outline = ''; active.style.outlineOffset = ''; }
      active = el;
      if(active){ active.style.outline = '2px solid #2563eb'; active.style.outlineOffset = '2px'; }
    }
    document.querySelectorAll(selector).forEach(function(el){
      var tagName = (el.tagName || '').toLowerCase();
      var text = (el.textContent || '').trim();
      var className = el.getAttribute('class') || '';
      var isStructural = /^(div|section|article|main|aside|nav)$/.test(tagName);
      if(isStructural && className.trim().length === 0) return;
      if(tagName !== 'img' && text.length < 2) return;
      counter += 1;
      el.setAttribute('data-aiuiedit-id', 'aiuiedit-' + counter);
      el.style.cursor = 'pointer';
    });

    document.addEventListener('click', function(event){
      var target = event.target;
      if(!target || !target.closest) return;
      var el = target.closest('[data-aiuiedit-id]');
      if(!el) return;
      var tag = (el.tagName || '').toLowerCase();
      var isStructural = /^(div|section|article|main|aside|nav)$/.test(tag);
      event.preventDefault();
      event.stopPropagation();
      mark(el);
      window.parent.postMessage({
        type: 'aiuiedit-select',
        payload: {
          id: el.getAttribute('data-aiuiedit-id'),
          tag: tag,
          text: (el.textContent || '').trim(),
          isStructural: isStructural,
          attributes: {
            href: el.getAttribute('href') || undefined,
            src: el.getAttribute('src') || undefined,
            alt: el.getAttribute('alt') || undefined,
            className: el.getAttribute('class') || undefined,
            style: el.getAttribute('style') || undefined
          }
        }
      }, '*');
    }, true);

    window.addEventListener('message', function(event){
      var data = event.data || {};
      if(data.type !== 'aiuiedit-apply-text') return;
      var payload = data.payload || {};
      var id = payload.id;
      var text = payload.text || '';
      var attributes = payload.attributes || {};
      var applyText = payload.applyText !== false;
      if(!id) return;
      var el = document.querySelector('[data-aiuiedit-id="' + id + '"]');
      if(!el) return;
      if(applyText) el.textContent = text;
      if(typeof attributes.href === 'string') el.setAttribute('href', attributes.href);
      if(typeof attributes.src === 'string') el.setAttribute('src', attributes.src);
      if(typeof attributes.alt === 'string') el.setAttribute('alt', attributes.alt);
      if(typeof attributes.className === 'string') {
        el.setAttribute('class', attributes.className);
        applyInlinePreviewStyles(el);
      }
      if(typeof attributes.style === 'string') el.setAttribute('style', attributes.style);
      window.parent.postMessage({
        type: 'aiuiedit-updated',
        payload: {
          id: id,
          text: applyText ? text : (el.textContent || '').trim(),
          attributes: {
            href: el.getAttribute('href') || undefined,
            src: el.getAttribute('src') || undefined,
            alt: el.getAttribute('alt') || undefined,
            className: el.getAttribute('class') || undefined,
            style: el.getAttribute('style') || undefined
          }
        }
      }, '*');
    });
  })();</script>`

  if (/<head\b[^>]*>/i.test(sanitizedHtml)) {
    return sanitizedHtml.replace(/<head\b[^>]*>/i, (match) => `${match}${baseTag}`) + instrumentationScript
  }
  return `<!doctype html><html><head>${baseTag}</head><body>${sanitizedHtml}</body>${instrumentationScript}</html>`
}

export function RenderedPreview({ currentProject, currentPage, onCaptureBlocks }: RenderedPreviewProps) {
  const { settings, setSettings } = useAppStore()
  const { projectPath } = useProjectStore()
  const [draftBaseUrl, setDraftBaseUrl] = useState(settings.livePreviewBaseUrl || 'http://127.0.0.1:8000')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [snapshotHtml, setSnapshotHtml] = useState('')
  const [snapshotTitle, setSnapshotTitle] = useState('Rendered Page')
  const [snapshotBlocks, setSnapshotBlocks] = useState<Array<{
    type: 'heading' | 'text' | 'button' | 'link' | 'image' | 'card'
    text: string
    src?: string
    href?: string
    className?: string
  }>>([])
  const [previewMode, setPreviewMode] = useState<PreviewMode>('embedded')
  const [statusMessage, setStatusMessage] = useState('')
  const [embeddedLoaded, setEmbeddedLoaded] = useState(false)
  const [embeddedDiagnostic, setEmbeddedDiagnostic] = useState<{ code: EmbeddedDiagnosticCode; detail: string } | null>(null)
  const [snapshotFetchStatus, setSnapshotFetchStatus] = useState<{ ok: boolean; error?: string } | null>(null)
  const [snapshotSelection, setSnapshotSelection] = useState<SnapshotSelection | null>(null)
  const [snapshotEditText, setSnapshotEditText] = useState('')
  const [snapshotHref, setSnapshotHref] = useState('')
  const [snapshotSrc, setSnapshotSrc] = useState('')
  const [snapshotAlt, setSnapshotAlt] = useState('')
  const [snapshotClassName, setSnapshotClassName] = useState('')
  const [snapshotStyle, setSnapshotStyle] = useState('')
  const [quickVariant, setQuickVariant] = useState<TailwindVariantPrefix>('')
  const [quickFilter, setQuickFilter] = useState('')
  const timeoutRef = useRef<number | null>(null)
  const snapshotIframeRef = useRef<HTMLIFrameElement | null>(null)

  const route = currentPage?.route || '/'
  const isRoutePreviewable = route.startsWith('/')

  const previewUrl = useMemo(() => {
    const base = settings.livePreviewBaseUrl || 'http://127.0.0.1:8000'
    if (!isRoutePreviewable) return ''
    return joinPreviewUrl(base, route)
  }, [settings.livePreviewBaseUrl, route, isRoutePreviewable])

  const snapshotDocument = useMemo(() => {
    if (!snapshotHtml || !previewUrl) return ''
    return injectInstrumentedSnapshot(snapshotHtml, previewUrl)
  }, [snapshotHtml, previewUrl])

  const snapshotClassTokens = useMemo(() => splitClassTokens(snapshotClassName), [snapshotClassName])
  const snapshotStyleMap = useMemo(() => parseInlineStyle(snapshotStyle), [snapshotStyle])
  const quickFilterLower = quickFilter.trim().toLowerCase()
  const filteredTailwindGroups = useMemo(() => {
    if (!quickFilterLower) return TAILWIND_CLASS_GROUPS
    return TAILWIND_CLASS_GROUPS.filter((group) => group.label.toLowerCase().includes(quickFilterLower))
  }, [quickFilterLower])
  const activeTailwindGroups = useMemo(() => {
    const active = new Set<string>()

    TAILWIND_CLASS_GROUPS.forEach((group) => {
      const isResponsiveGroup = RESPONSIVE_GROUP_KEYS.has(group.key)
      const hasMatch = snapshotClassTokens.some((token) => {
        const parsed = splitVariantToken(token)
        if (isResponsiveGroup && parsed.prefix !== quickVariant) return false
        if (!isResponsiveGroup && parsed.prefix !== '') return false
        return group.matcher.test(parsed.base)
      })

      if (hasMatch) {
        active.add(group.key)
      }
    })

    return active
  }, [snapshotClassTokens, quickVariant])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== snapshotIframeRef.current?.contentWindow) return
      const data = event.data as any
      if (!data?.type) return

      if (data.type === 'aiuiedit-select' && data.payload) {
        const selected: SnapshotSelection = {
          id: data.payload.id,
          tag: data.payload.tag,
          text: data.payload.text || '',
          isStructural: !!data.payload.isStructural,
          attributes: {
            href: data.payload.attributes?.href,
            src: data.payload.attributes?.src,
            alt: data.payload.attributes?.alt,
            className: data.payload.attributes?.className,
            style: data.payload.attributes?.style
          }
        }
        setSnapshotSelection(selected)
        setSnapshotEditText(selected.text)
        setSnapshotHref(selected.attributes.href || '')
        setSnapshotSrc(selected.attributes.src || '')
        setSnapshotAlt(selected.attributes.alt || '')
        setSnapshotClassName(selected.attributes.className || '')
        setSnapshotStyle(selected.attributes.style || '')
      }

      if (data.type === 'aiuiedit-updated' && data.payload && snapshotSelection?.id === data.payload.id) {
        setSnapshotSelection((prev) => prev ? {
          ...prev,
          text: data.payload.text || prev.text,
          attributes: {
            href: data.payload.attributes?.href ?? prev.attributes.href,
            src: data.payload.attributes?.src ?? prev.attributes.src,
            alt: data.payload.attributes?.alt ?? prev.attributes.alt,
            className: data.payload.attributes?.className ?? prev.attributes.className,
            style: data.payload.attributes?.style ?? prev.attributes.style
          }
        } : prev)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [snapshotSelection?.id])

  const hints = useMemo(() => {
    const framework = currentProject?.source?.framework
    if (framework === 'laravel') {
      return [
        'Start your app first: `php artisan serve`',
        'If using Vite assets, also run: `npm run dev`',
        'If embedded mode stays blank, switch to Snapshot mode (bypasses frame restrictions).'
      ]
    }
    if (framework === 'nextjs') {
      return [
        'Start your app first: `npm run dev`',
        'Set Live Preview Base URL to your Next.js dev URL (for example: http://127.0.0.1:3000).'
      ]
    }
    return [
      'Start your app locally in your normal dev environment.',
      'If embedded mode is blank, use Snapshot mode and Capture to Canvas.'
    ]
  }, [currentProject?.source?.framework])

  const saveBaseUrl = async () => {
    const nextUrl = draftBaseUrl.trim()
    if (!nextUrl) return
    const nextSettings = { ...settings, livePreviewBaseUrl: nextUrl }
    setSettings({ livePreviewBaseUrl: nextUrl })
    await window.electron.saveSettings(nextSettings)
  }

  const loadSnapshot = async () => {
    if (!previewUrl) return
    setIsLoadingSnapshot(true)
    try {
      const captured = await window.electron.capturePreviewRoute({ url: previewUrl })
      setSnapshotHtml(captured.html)
      setSnapshotTitle(captured.title)
      setSnapshotBlocks(captured.blocks)
      setSnapshotFetchStatus({ ok: true })
      setStatusMessage(`Snapshot loaded: ${captured.blocks.length} content blocks detected`)
    } catch (error) {
      console.error('Snapshot load failed:', error)
      const errorText = String(error)
      setSnapshotFetchStatus({ ok: false, error: errorText })
      setStatusMessage(`Snapshot failed: ${errorText}`)
    } finally {
      setIsLoadingSnapshot(false)
    }
  }

  const classifyNetworkIssue = (rawError: string): { code: EmbeddedDiagnosticCode; detail: string } => {
    const lower = rawError.toLowerCase()
    if (lower.includes('enotfound') || lower.includes('could not resolve') || lower.includes('dns')) {
      return { code: 'dns', detail: 'DNS lookup failed for preview host.' }
    }
    if (lower.includes('econnrefused') || lower.includes('failed to connect') || lower.includes('connection refused')) {
      return { code: 'refused', detail: 'Preview server refused the connection (check port/server).' }
    }
    if (lower.includes('timed out') || lower.includes('etimedout') || lower.includes('timeout')) {
      return { code: 'timeout', detail: 'Preview request timed out.' }
    }
    return { code: 'network', detail: 'Preview request failed due to a network/runtime issue.' }
  }

  useEffect(() => {
    setEmbeddedLoaded(false)
    setEmbeddedDiagnostic({ code: 'loading', detail: 'Waiting for embedded iframe load event...' })
    if (!previewUrl) return

    loadSnapshot()

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (!embeddedLoaded && previewMode === 'embedded') {
        if (snapshotFetchStatus?.ok) {
          const detail = 'Route is reachable, but iframe did not load. Likely blocked by frame policy (CSP frame-ancestors or X-Frame-Options), mixed-origin cookie policy, or browser sandbox restrictions.'
          setEmbeddedDiagnostic({ code: 'frame_policy', detail })
          setStatusMessage(`Embedded diagnostics: ${detail}`)
          return
        }

        if (snapshotFetchStatus && !snapshotFetchStatus.ok) {
          const diagnosed = classifyNetworkIssue(snapshotFetchStatus.error || '')
          setEmbeddedDiagnostic(diagnosed)
          setStatusMessage(`Embedded diagnostics: ${diagnosed.detail}`)
          return
        }

        const detail = 'Embedded preview did not emit a load event within 15s.'
        setEmbeddedDiagnostic({ code: 'timeout', detail })
        setStatusMessage(`Embedded diagnostics: ${detail}`)
      }
    }, 15000)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [previewUrl, refreshToken, previewMode, embeddedLoaded, snapshotFetchStatus])

  const handleCaptureToCanvas = async () => {
    if (!onCaptureBlocks) return

    setIsCapturing(true)
    try {
      if (!snapshotBlocks.length) {
        await loadSnapshot()
      }

      onCaptureBlocks({
        title: snapshotTitle,
        blocks: snapshotBlocks
      })
      window.showToast(`Captured ${snapshotBlocks.length} blocks from rendered page`, 'success')
    } catch (error) {
      console.error('Capture failed:', error)
      window.showToast(`Capture failed: ${error}`, 'error')
    } finally {
      setIsCapturing(false)
    }
  }

  const applySnapshotTextEdit = () => {
    if (!snapshotSelection?.id || !snapshotIframeRef.current?.contentWindow) return
    const canApplyText = !STRUCTURAL_TAGS.has(snapshotSelection.tag) && snapshotSelection.tag !== 'img'
    snapshotIframeRef.current.contentWindow.postMessage({
      type: 'aiuiedit-apply-text',
      payload: {
        id: snapshotSelection.id,
        text: snapshotEditText,
        applyText: canApplyText,
        attributes: {
          href: snapshotHref,
          src: snapshotSrc,
          alt: snapshotAlt,
          className: snapshotClassName,
          style: snapshotStyle
        }
      }
    }, '*')
    setStatusMessage(canApplyText
      ? 'Updated snapshot element (visual edit only). Use Capture to Canvas to bring changes into design mode.'
      : 'Updated snapshot element attributes/classes (visual edit only).'
    )
  }

  const postSnapshotAttributeUpdate = (nextAttributes: { className?: string; style?: string }) => {
    if (!snapshotSelection?.id || !snapshotIframeRef.current?.contentWindow) return
    const canApplyText = !STRUCTURAL_TAGS.has(snapshotSelection.tag) && snapshotSelection.tag !== 'img'
    snapshotIframeRef.current.contentWindow.postMessage({
      type: 'aiuiedit-apply-text',
      payload: {
        id: snapshotSelection.id,
        text: snapshotEditText,
        applyText: canApplyText,
        attributes: {
          href: snapshotHref,
          src: snapshotSrc,
          alt: snapshotAlt,
          className: nextAttributes.className ?? snapshotClassName,
          style: nextAttributes.style ?? snapshotStyle
        }
      }
    }, '*')
  }

  const applyClassOption = (group: TailwindClassGroup, optionValue: string, variant: TailwindVariantPrefix = '', isActive = false) => {
    setSnapshotClassName((prev) => {
      const nextClassName = replaceClassGroup(prev, group, isActive ? '' : optionValue, variant)
      postSnapshotAttributeUpdate({ className: nextClassName })
      return nextClassName
    })
  }

  const removeClassToken = (tokenToRemove: string) => {
    setSnapshotClassName((prev) => {
      const nextClassName = splitClassTokens(prev).filter((token) => token !== tokenToRemove).join(' ')
      postSnapshotAttributeUpdate({ className: nextClassName })
      return nextClassName
    })
  }

  const applyInlineStyleValue = (property: string, value: string) => {
    setSnapshotStyle((prev) => {
      const nextStyle = upsertInlineStyleProperty(prev, property, value)
      postSnapshotAttributeUpdate({ style: nextStyle })
      return nextStyle
    })
  }

  const applySnapshotElementEditToSource = async () => {
    if (!currentPage || !projectPath || !snapshotSelection?.id) {
      window.showToast('No source-linked page selected', 'error')
      return
    }

    const originalText = snapshotSelection.text
    const newText = snapshotEditText

    const hasTextChange = !!originalText && !!newText && originalText !== newText
    const hasAttrChange =
      (snapshotSelection.attributes.href || '') !== snapshotHref ||
      (snapshotSelection.attributes.src || '') !== snapshotSrc ||
      (snapshotSelection.attributes.alt || '') !== snapshotAlt ||
      (snapshotSelection.attributes.className || '') !== snapshotClassName ||
      (snapshotSelection.attributes.style || '') !== snapshotStyle

    if (!hasTextChange && !hasAttrChange) {
      window.showToast('No rendered changes to apply', 'info')
      return
    }

    try {
      const result = await window.electron.applyRenderedElementEdit({
        projectPath,
        pageId: currentPage.id,
        tag: snapshotSelection.tag,
        originalText,
        newText,
        originalAttributes: snapshotSelection.attributes,
        newAttributes: {
          href: snapshotHref,
          src: snapshotSrc,
          alt: snapshotAlt,
          className: snapshotClassName,
          style: snapshotStyle
        }
      })

      applySnapshotTextEdit()
      setSnapshotSelection((prev) => (prev
        ? {
            ...prev,
            text: newText,
            attributes: {
              href: snapshotHref || undefined,
              src: snapshotSrc || undefined,
              alt: snapshotAlt || undefined,
              className: snapshotClassName || undefined,
              style: snapshotStyle || undefined
            }
          }
        : prev))
      setStatusMessage(`Applied edit to source (${result.changes.join(', ')}) -> ${result.sourceFile}`)
      window.showToast('Rendered edit patched to source', 'success')
      await loadSnapshot()
    } catch (error) {
      console.error('Source apply failed:', error)
      window.showToast(`Source patch failed: ${error}`, 'error')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Live Preview</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshToken((v) => v + 1)}>
              <RefreshCcw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => previewUrl && window.electron.openExternal(previewUrl)}
              disabled={!previewUrl}
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCaptureToCanvas}
              disabled={!previewUrl || isCapturing || isLoadingSnapshot || !onCaptureBlocks}
            >
              <Download className="mr-1 h-4 w-4" />
              {isCapturing ? 'Capturing...' : 'Capture to Canvas'}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={draftBaseUrl}
            onChange={(e) => setDraftBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <Button size="sm" onClick={saveBaseUrl}>Use URL</Button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Route: {route}</p>
          <div className="rounded-md border bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={previewMode === 'embedded' ? 'default' : 'ghost'}
              className="h-7"
              onClick={() => {
                setPreviewMode('embedded')
                setEmbeddedDiagnostic({ code: 'loading', detail: 'Trying embedded mode...' })
                setStatusMessage('Embedded diagnostics: trying embedded mode...')
              }}
            >
              Embedded
            </Button>
            <Button size="sm" variant={previewMode === 'snapshot' ? 'default' : 'ghost'} className="h-7" onClick={() => setPreviewMode('snapshot')}>
              Snapshot
            </Button>
          </div>
        </div>
        {embeddedDiagnostic && previewMode === 'embedded' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Embedded diagnostics ({embeddedDiagnostic.code}): {embeddedDiagnostic.detail}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-white">
        {!isRoutePreviewable ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">This page does not map to a browser route.</p>
          </div>
        ) : previewMode === 'embedded' ? (
          <iframe
            key={`embedded-${previewUrl}-${refreshToken}`}
            src={previewUrl}
            title="Embedded Live Preview"
            className="h-full w-full border-0"
            onLoad={() => {
              setEmbeddedLoaded(true)
              setEmbeddedDiagnostic({ code: 'loaded', detail: 'Embedded iframe loaded successfully.' })
              setStatusMessage('Embedded preview loaded')
            }}
            onError={() => {
              const diagnosed = snapshotFetchStatus?.ok
                ? {
                    code: 'frame_policy' as EmbeddedDiagnosticCode,
                    detail: 'Route is reachable but iframe failed to load. Likely blocked by frame policy or browser restrictions.'
                  }
                : classifyNetworkIssue(snapshotFetchStatus?.error || '')

              setEmbeddedDiagnostic(diagnosed)
              setStatusMessage(`Embedded diagnostics: ${diagnosed.detail}; switched to Snapshot mode.`)
              setPreviewMode('snapshot')
            }}
          />
        ) : snapshotDocument ? (
          <PanelGroup direction="horizontal" className="h-full min-h-0">
            <Panel defaultSize={58} minSize={35}>
              <iframe
                ref={snapshotIframeRef}
                key={`snapshot-${previewUrl}-${refreshToken}`}
                srcDoc={snapshotDocument}
                title="Snapshot Preview"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms"
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50" />

            <Panel defaultSize={42} minSize={24}>
              <PanelGroup direction="horizontal" className="h-full min-h-0">
                <Panel defaultSize={44} minSize={28}>
                  <div className="flex h-full min-h-0 flex-col bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</p>
                    {snapshotSelection ? (
                      <div className="mt-3 flex min-h-0 flex-1 flex-col">
                        <p className="text-xs text-muted-foreground">Tag: <span className="font-mono text-foreground">{snapshotSelection.tag}</span></p>
                        {snapshotSelection.isStructural && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Container/card mode: text editing disabled; use style/layout controls.</p>
                        )}

                        <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                          <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                            <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Text</label>
                            <textarea
                              value={snapshotEditText}
                              onChange={(e) => setSnapshotEditText(e.target.value)}
                              disabled={snapshotSelection.isStructural || snapshotSelection.tag === 'img'}
                              className="h-28 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                            />
                            {(snapshotSelection.tag === 'a' || snapshotSelection.attributes.href !== undefined) && (
                              <>
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Href</label>
                                <input type="text" value={snapshotHref} onChange={(e) => setSnapshotHref(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary" />
                              </>
                            )}
                            {(snapshotSelection.tag === 'img' || snapshotSelection.attributes.src !== undefined) && (
                              <>
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Image Src</label>
                                <input type="text" value={snapshotSrc} onChange={(e) => setSnapshotSrc(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary" />
                              </>
                            )}
                            {(snapshotSelection.tag === 'img' || snapshotSelection.attributes.alt !== undefined) && (
                              <>
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Image Alt</label>
                                <input type="text" value={snapshotAlt} onChange={(e) => setSnapshotAlt(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary" />
                              </>
                            )}
                          </div>

                          <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Classes</p>
                            <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Class</label>
                            <input
                              type="text"
                              value={snapshotClassName}
                              onChange={(e) => {
                                const nextClassName = e.target.value
                                setSnapshotClassName(nextClassName)
                                postSnapshotAttributeUpdate({ className: nextClassName })
                              }}
                              className="w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                            />
                            <div className="flex flex-wrap gap-1 rounded-md border bg-muted/20 p-2">
                              {snapshotClassTokens.length > 0 ? snapshotClassTokens.map((token) => (
                                <div key={token} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  <span>{token}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeClassToken(token)}
                                    className="rounded px-1 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
                                    title={`Remove ${token}`}
                                    aria-label={`Remove ${token}`}
                                  >
                                    x
                                  </button>
                                </div>
                              )) : (
                                <span className="text-[11px] text-muted-foreground">No class tokens on selected element</span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-2">
                            <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Typography / Inline CSS</p>
                            <div>
                              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Font Family</label>
                              <input
                                type="text"
                                value={snapshotStyleMap['font-family'] || ''}
                                onChange={(e) => applyInlineStyleValue('font-family', e.target.value)}
                                placeholder="Inter, serif, etc"
                                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Font Size</label>
                              <input
                                type="text"
                                value={snapshotStyleMap['font-size'] || ''}
                                onChange={(e) => applyInlineStyleValue('font-size', e.target.value)}
                                placeholder="16px"
                                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Font Weight</label>
                              <input
                                type="text"
                                value={snapshotStyleMap['font-weight'] || ''}
                                onChange={(e) => applyInlineStyleValue('font-weight', e.target.value)}
                                placeholder="400 / bold"
                                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Line Height</label>
                              <input
                                type="text"
                                value={snapshotStyleMap['line-height'] || ''}
                                onChange={(e) => applyInlineStyleValue('line-height', e.target.value)}
                                placeholder="1.5"
                                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Inline Style</label>
                              <textarea
                                value={snapshotStyle}
                                onChange={(e) => {
                                  const nextStyle = e.target.value
                                  setSnapshotStyle(nextStyle)
                                  postSnapshotAttributeUpdate({ style: nextStyle })
                                }}
                                placeholder="font-family: Inter; font-size: 18px;"
                                className="h-20 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 space-y-2 border-t pt-2">
                          <Button size="sm" variant="outline" className="w-full" onClick={applySnapshotTextEdit}>Apply in Snapshot</Button>
                          <Button size="sm" className="w-full" onClick={applySnapshotElementEditToSource} disabled={!currentProject?.source?.roundTrip}>
                            Apply to Source
                          </Button>
                          <p className="text-[11px] text-muted-foreground">Apply to Source writes atomic text/attribute patches to the mapped page file, then refreshes snapshot.</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Click any text element, image, or container/card in the snapshot to inspect/edit it.</p>
                    )}
                  </div>
                </Panel>

                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50" />

                <Panel defaultSize={56} minSize={30}>
                  <div className="flex h-full min-h-0 flex-col border-l bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style & Layout</p>
                    {snapshotSelection ? (
                      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tailwind Quick Edit</p>
                          <input
                            type="text"
                            value={quickFilter}
                            onChange={(e) => setQuickFilter(e.target.value)}
                            placeholder="Filter groups..."
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                          />
                          <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
                            {TAILWIND_VARIANTS.map((variant) => (
                              <button
                                key={variant.prefix || 'base'}
                                type="button"
                                onClick={() => setQuickVariant(variant.prefix)}
                                className={quickVariant === variant.prefix
                                  ? 'rounded border border-primary bg-primary px-2 py-1 text-[10px] text-primary-foreground'
                                  : 'rounded border bg-background px-2 py-1 text-[10px] text-foreground hover:border-primary/60'}
                              >
                                {variant.label}
                              </button>
                            ))}
                          </div>

                          {filteredTailwindGroups.map((group) => {
                            const useVariant = RESPONSIVE_GROUP_KEYS.has(group.key) ? quickVariant : ''
                            const activeCount = snapshotClassTokens.filter((token) => {
                              const parsed = splitVariantToken(token)
                              if (RESPONSIVE_GROUP_KEYS.has(group.key)) {
                                return parsed.prefix === useVariant && group.matcher.test(parsed.base)
                              }

                              return parsed.prefix === '' && group.matcher.test(parsed.base)
                            }).length
                            return (
                              <details key={group.key} className="rounded-md border bg-background" open={activeTailwindGroups.has(group.key)}>
                                <summary className="flex cursor-pointer items-center justify-between px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                                  <span>
                                    {group.label}{RESPONSIVE_GROUP_KEYS.has(group.key) ? ` (${useVariant || 'base'})` : ''}
                                  </span>
                                  {activeCount > 0 && (
                                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                      {activeCount}
                                    </span>
                                  )}
                                </summary>
                                <div className="grid grid-cols-2 gap-1 border-t p-2">
                                  {group.options.map((option) => {
                                    const classToken = `${useVariant}${option.value}`
                                    const isActive = snapshotClassTokens.includes(classToken)
                                    return (
                                      <button
                                        key={`${group.key}-${classToken}`}
                                        type="button"
                                        onClick={() => applyClassOption(group, option.value, useVariant as TailwindVariantPrefix, isActive)}
                                        className={isActive
                                          ? 'rounded border border-primary bg-primary px-2 py-1 text-[10px] text-primary-foreground'
                                          : 'rounded border bg-background px-2 py-1 text-[10px] text-foreground hover:border-primary/60'}
                                      >
                                        {option.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </details>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Select an element in snapshot to show style/layout controls.</p>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading snapshot preview...</p>
          </div>
        )}
      </div>

      <div className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        {statusMessage && <div className="mb-1">{statusMessage}</div>}
        {hints.map((hint) => (
          <div key={hint}>{hint}</div>
        ))}
      </div>
    </div>
  )
}
