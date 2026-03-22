import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/common/Button'
import { Download, ExternalLink, RefreshCcw } from 'lucide-react'
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

const LAYOUT_GROUP_KEYS = new Set(['display', 'layout', 'direction', 'justify', 'items', 'gap', 'width', 'maxWidth'])

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
    matcher: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/,
    options: [
      { label: 'XS', value: 'text-xs' },
      { label: 'SM', value: 'text-sm' },
      { label: 'Base', value: 'text-base' },
      { label: 'LG', value: 'text-lg' },
      { label: 'XL', value: 'text-xl' },
      { label: '2XL', value: 'text-2xl' }
    ]
  },
  {
    key: 'weight',
    label: 'Font Weight',
    matcher: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
    options: [
      { label: 'Light', value: 'font-light' },
      { label: 'Normal', value: 'font-normal' },
      { label: 'Medium', value: 'font-medium' },
      { label: 'Semi', value: 'font-semibold' },
      { label: 'Bold', value: 'font-bold' }
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
    matcher: /^rounded(-(none|sm|md|lg|xl|2xl|full))?$/,
    options: [
      { label: 'None', value: 'rounded-none' },
      { label: 'SM', value: 'rounded-sm' },
      { label: 'MD', value: 'rounded-md' },
      { label: 'LG', value: 'rounded-lg' },
      { label: 'XL', value: 'rounded-xl' },
      { label: 'Full', value: 'rounded-full' }
    ]
  },
  {
    key: 'shadow',
    label: 'Shadow',
    matcher: /^shadow(-(none|sm|md|lg|xl|2xl))?$/,
    options: [
      { label: 'None', value: 'shadow-none' },
      { label: 'SM', value: 'shadow-sm' },
      { label: 'MD', value: 'shadow-md' },
      { label: 'LG', value: 'shadow-lg' },
      { label: 'XL', value: 'shadow-xl' }
    ]
  },
  {
    key: 'padding',
    label: 'Padding',
    matcher: /^p-(0|1|2|3|4|6|8|10|12)$/,
    options: [
      { label: '0', value: 'p-0' },
      { label: '2', value: 'p-2' },
      { label: '4', value: 'p-4' },
      { label: '6', value: 'p-6' },
      { label: '8', value: 'p-8' }
    ]
  },
  {
    key: 'layout',
    label: 'Layout Mode',
    matcher: /^(block|flex|grid)$/,
    options: [
      { label: 'Block', value: 'block' },
      { label: 'Flex', value: 'flex' },
      { label: 'Grid', value: 'grid' }
    ]
  },
  {
    key: 'direction',
    label: 'Direction',
    matcher: /^flex-(row|col)$/,
    options: [
      { label: 'Row', value: 'flex-row' },
      { label: 'Column', value: 'flex-col' }
    ]
  },
  {
    key: 'justify',
    label: 'Justify',
    matcher: /^justify-(start|center|end|between|around|evenly)$/,
    options: [
      { label: 'Start', value: 'justify-start' },
      { label: 'Center', value: 'justify-center' },
      { label: 'End', value: 'justify-end' },
      { label: 'Between', value: 'justify-between' }
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
    matcher: /^gap-(0|1|2|3|4|6|8|10|12)$/,
    options: [
      { label: '0', value: 'gap-0' },
      { label: '2', value: 'gap-2' },
      { label: '4', value: 'gap-4' },
      { label: '6', value: 'gap-6' },
      { label: '8', value: 'gap-8' }
    ]
  },
  {
    key: 'width',
    label: 'Width',
    matcher: /^w-(auto|full|screen|fit|min|max)$/,
    options: [
      { label: 'Auto', value: 'w-auto' },
      { label: 'Fit', value: 'w-fit' },
      { label: 'Full', value: 'w-full' },
      { label: 'Screen', value: 'w-screen' }
    ]
  },
  {
    key: 'maxWidth',
    label: 'Max Width',
    matcher: /^max-w-(none|full|screen-sm|screen-md|screen-lg|screen-xl|screen-2xl|prose)$/,
    options: [
      { label: 'None', value: 'max-w-none' },
      { label: 'Prose', value: 'max-w-prose' },
      { label: 'SM', value: 'max-w-screen-sm' },
      { label: 'MD', value: 'max-w-screen-md' },
      { label: 'LG', value: 'max-w-screen-lg' },
      { label: 'XL', value: 'max-w-screen-xl' }
    ]
  }
]

function splitClassTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
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
    var sizeMap = { 'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px', 'text-xl': '20px', 'text-2xl': '24px' };
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
    var gapMap = { 'gap-0': '0px', 'gap-2': '8px', 'gap-4': '16px', 'gap-6': '24px', 'gap-8': '32px' };
    var paddingMap = { 'p-0': '0px', 'p-2': '8px', 'p-4': '16px', 'p-6': '24px', 'p-8': '32px' };
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
        if(token === 'w-auto' || token === 'w-fit' || token === 'w-full' || token === 'w-screen') {
          if(token === 'w-auto') el.style.width = 'auto';
          if(token === 'w-fit') el.style.width = 'fit-content';
          if(token === 'w-full') el.style.width = '100%';
          if(token === 'w-screen') el.style.width = '100vw';
        }
        if(token === 'max-w-none') el.style.maxWidth = 'none';
        if(token === 'max-w-prose') el.style.maxWidth = '65ch';
        if(token === 'max-w-screen-sm') el.style.maxWidth = '640px';
        if(token === 'max-w-screen-md') el.style.maxWidth = '768px';
        if(token === 'max-w-screen-lg') el.style.maxWidth = '1024px';
        if(token === 'max-w-screen-xl') el.style.maxWidth = '1280px';
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
            className: el.getAttribute('class') || undefined
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
      window.parent.postMessage({
        type: 'aiuiedit-updated',
        payload: {
          id: id,
          text: applyText ? text : (el.textContent || '').trim(),
          attributes: {
            href: el.getAttribute('href') || undefined,
            src: el.getAttribute('src') || undefined,
            alt: el.getAttribute('alt') || undefined,
            className: el.getAttribute('class') || undefined
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
  const [snapshotSelection, setSnapshotSelection] = useState<SnapshotSelection | null>(null)
  const [snapshotEditText, setSnapshotEditText] = useState('')
  const [snapshotHref, setSnapshotHref] = useState('')
  const [snapshotSrc, setSnapshotSrc] = useState('')
  const [snapshotAlt, setSnapshotAlt] = useState('')
  const [snapshotClassName, setSnapshotClassName] = useState('')
  const [inspectorTab, setInspectorTab] = useState<'content' | 'style' | 'layout'>('content')
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
            className: data.payload.attributes?.className
          }
        }
        setSnapshotSelection(selected)
        setSnapshotEditText(selected.text)
        setSnapshotHref(selected.attributes.href || '')
        setSnapshotSrc(selected.attributes.src || '')
        setSnapshotAlt(selected.attributes.alt || '')
        setSnapshotClassName(selected.attributes.className || '')
      }

      if (data.type === 'aiuiedit-updated' && data.payload && snapshotSelection?.id === data.payload.id) {
        setSnapshotSelection((prev) => prev ? {
          ...prev,
          text: data.payload.text || prev.text,
          attributes: {
            href: data.payload.attributes?.href ?? prev.attributes.href,
            src: data.payload.attributes?.src ?? prev.attributes.src,
            alt: data.payload.attributes?.alt ?? prev.attributes.alt,
            className: data.payload.attributes?.className ?? prev.attributes.className
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
      setStatusMessage(`Snapshot loaded: ${captured.blocks.length} content blocks detected`)
    } catch (error) {
      console.error('Snapshot load failed:', error)
      setStatusMessage(`Snapshot failed: ${error}`)
    } finally {
      setIsLoadingSnapshot(false)
    }
  }

  useEffect(() => {
    setEmbeddedLoaded(false)
    if (!previewUrl) return

    loadSnapshot()

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (!embeddedLoaded && previewMode === 'embedded') {
        setStatusMessage('Embedded preview appears blocked or unavailable; switched to Snapshot mode.')
        setPreviewMode('snapshot')
      }
    }, 6000)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [previewUrl, refreshToken])

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
          className: snapshotClassName
        }
      }
    }, '*')
    setStatusMessage(canApplyText
      ? 'Updated snapshot element (visual edit only). Use Capture to Canvas to bring changes into design mode.'
      : 'Updated snapshot element attributes/classes (visual edit only).'
    )
  }

  const applyClassOption = (group: TailwindClassGroup, optionValue: string, variant: TailwindVariantPrefix = '') => {
    setSnapshotClassName((prev) => {
      const nextClassName = replaceClassGroup(prev, group, optionValue, variant)

      if (snapshotSelection?.id && snapshotIframeRef.current?.contentWindow) {
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
              className: nextClassName
            }
          }
        }, '*')
      }

      return nextClassName
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
      (snapshotSelection.attributes.className || '') !== snapshotClassName

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
          className: snapshotClassName
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
              className: snapshotClassName || undefined
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
            <Button size="sm" variant={previewMode === 'embedded' ? 'default' : 'ghost'} className="h-7" onClick={() => setPreviewMode('embedded')}>
              Embedded
            </Button>
            <Button size="sm" variant={previewMode === 'snapshot' ? 'default' : 'ghost'} className="h-7" onClick={() => setPreviewMode('snapshot')}>
              Snapshot
            </Button>
          </div>
        </div>
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
              setStatusMessage('Embedded preview loaded')
            }}
          />
        ) : snapshotDocument ? (
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px]">
            <iframe
              ref={snapshotIframeRef}
              key={`snapshot-${previewUrl}-${refreshToken}`}
              srcDoc={snapshotDocument}
              title="Snapshot Preview"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms"
            />
            <div className="flex h-full min-h-0 flex-col border-l bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snapshot Inspector</p>
              {snapshotSelection ? (
                <div className="mt-3 flex min-h-0 flex-1 flex-col">
                  <p className="text-xs text-muted-foreground">Tag: <span className="font-mono text-foreground">{snapshotSelection.tag}</span></p>
                  {snapshotSelection.isStructural && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Container/card mode: edit classes and attributes here; text editing is disabled to avoid flattening child content.</p>
                  )}

                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1">
                    <button type="button" onClick={() => setInspectorTab('content')} className={inspectorTab === 'content' ? 'rounded bg-background px-2 py-1 text-[11px] font-medium' : 'rounded px-2 py-1 text-[11px] text-muted-foreground'}>Content</button>
                    <button type="button" onClick={() => setInspectorTab('style')} className={inspectorTab === 'style' ? 'rounded bg-background px-2 py-1 text-[11px] font-medium' : 'rounded px-2 py-1 text-[11px] text-muted-foreground'}>Style</button>
                    <button type="button" onClick={() => setInspectorTab('layout')} className={inspectorTab === 'layout' ? 'rounded bg-background px-2 py-1 text-[11px] font-medium' : 'rounded px-2 py-1 text-[11px] text-muted-foreground'}>Layout</button>
                  </div>

                  <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {inspectorTab === 'content' && (
                      <>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Text</label>
                        <textarea
                          value={snapshotEditText}
                          onChange={(e) => setSnapshotEditText(e.target.value)}
                          disabled={snapshotSelection.isStructural || snapshotSelection.tag === 'img'}
                          className="h-36 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                      </>
                    )}

                    {(inspectorTab === 'style' || inspectorTab === 'layout') && (
                      <>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Class</label>
                        <input type="text" value={snapshotClassName} onChange={(e) => setSnapshotClassName(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary" />
                        <div className="flex flex-wrap gap-1 rounded-md border bg-muted/20 p-2">
                          {snapshotClassTokens.length > 0 ? snapshotClassTokens.map((token) => (
                            <span key={token} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{token}</span>
                          )) : (
                            <span className="text-[11px] text-muted-foreground">No class tokens on selected element</span>
                          )}
                        </div>
                      </>
                    )}

                    {inspectorTab === 'style' && (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tailwind Style Quick Edit</p>
                        {TAILWIND_CLASS_GROUPS.filter((group) => !LAYOUT_GROUP_KEYS.has(group.key)).map((group) => (
                          <div key={group.key}>
                            <p className="mb-1 text-[11px] text-muted-foreground">{group.label}</p>
                            <div className="flex flex-wrap gap-1">
                              {group.options.map((option) => {
                                const isActive = snapshotClassTokens.includes(option.value)
                                return (
                                  <button key={`${group.key}-${option.value}`} type="button" onClick={() => applyClassOption(group, option.value)} className={isActive ? 'rounded border border-primary bg-primary px-2 py-1 text-[11px] text-primary-foreground' : 'rounded border bg-background px-2 py-1 text-[11px] text-foreground hover:border-primary/60'}>
                                    {option.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {inspectorTab === 'layout' && (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tailwind Layout Quick Edit</p>
                        {TAILWIND_CLASS_GROUPS.filter((group) => LAYOUT_GROUP_KEYS.has(group.key)).map((group) => (
                          <div key={group.key}>
                            <p className="mb-1 text-[11px] text-muted-foreground">{group.label}</p>
                            {(RESPONSIVE_GROUP_KEYS.has(group.key) ? TAILWIND_VARIANTS : [TAILWIND_VARIANTS[0]]).map((variant) => (
                              <div key={`${group.key}-${variant.prefix || 'base'}`} className="mb-1">
                                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">{variant.label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {group.options.map((option) => {
                                    const classToken = `${variant.prefix}${option.value}`
                                    const isActive = snapshotClassTokens.includes(classToken)
                                    return (
                                      <button key={`${group.key}-${variant.prefix}-${option.value}`} type="button" onClick={() => applyClassOption(group, option.value, variant.prefix)} className={isActive ? 'rounded border border-primary bg-primary px-2 py-1 text-[11px] text-primary-foreground' : 'rounded border bg-background px-2 py-1 text-[11px] text-foreground hover:border-primary/60'}>
                                        {option.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
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
          </div>
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
