import type { ComponentDefinition } from '@/types'

export const ButtonComponent: ComponentDefinition = {
  type: 'button',
  name: 'Button',
  icon: 'MousePointerClick',
  category: 'primitive',
  defaultProps: {
    text: 'Click me',
    variant: 'default'
  },
  defaultStyle: {
    padding: '10px 20px',
    borderRadius: '6px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  properties: [
    { name: 'text', type: 'string', label: 'Text', default: 'Click me' },
    { name: 'variant', type: 'select', label: 'Variant', options: ['default', 'secondary', 'outline', 'ghost'], default: 'default' }
  ]
}

export const TextComponent: ComponentDefinition = {
  type: 'text',
  name: 'Text',
  icon: 'Type',
  category: 'primitive',
  defaultProps: {
    content: 'Text content'
  },
  defaultStyle: {
    fontSize: '16px',
    color: '#1F2937',
    lineHeight: '1.5'
  },
  properties: [
    { name: 'content', type: 'string', label: 'Content', default: 'Text content' }
  ]
}

export const HeadingComponent: ComponentDefinition = {
  type: 'heading',
  name: 'Heading',
  icon: 'Heading',
  category: 'primitive',
  defaultProps: {
    text: 'Heading',
    level: 2
  },
  defaultStyle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0'
  },
  properties: [
    { name: 'text', type: 'string', label: 'Text', default: 'Heading' },
    { name: 'level', type: 'select', label: 'Level', options: ['1', '2', '3', '4', '5', '6'], default: '2' }
  ]
}

export const ContainerComponent: ComponentDefinition = {
  type: 'container',
  name: 'Container',
  icon: 'Square',
  category: 'layout',
  defaultProps: {
    padding: 16
  },
  defaultStyle: {
    padding: '16px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
    minWidth: '100px',
    minHeight: '100px'
  },
  properties: [
    { name: 'padding', type: 'number', label: 'Padding', default: 16 }
  ]
}

export const ImageComponent: ComponentDefinition = {
  type: 'image',
  name: 'Image',
  icon: 'Image',
  category: 'primitive',
  defaultProps: {
    src: '',
    alt: 'Image'
  },
  defaultStyle: {
    width: '200px',
    height: 'auto',
    objectFit: 'cover',
    borderRadius: '4px'
  },
  properties: [
    { name: 'src', type: 'string', label: 'Source URL', default: '' },
    { name: 'alt', type: 'string', label: 'Alt Text', default: 'Image' }
  ]
}

export const InputComponent: ComponentDefinition = {
  type: 'input',
  name: 'Input',
  icon: 'TextCursor',
  category: 'form',
  defaultProps: {
    placeholder: 'Enter text...',
    type: 'text'
  },
  defaultStyle: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    width: '200px'
  },
  properties: [
    { name: 'placeholder', type: 'string', label: 'Placeholder', default: 'Enter text...' },
    { name: 'type', type: 'select', label: 'Type', options: ['text', 'email', 'password', 'number'], default: 'text' }
  ]
}

export const CardComponent: ComponentDefinition = {
  type: 'card',
  name: 'Card',
  icon: 'Square',
  category: 'layout',
  defaultProps: {
    title: 'Card Title'
  },
  defaultStyle: {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    width: '300px'
  },
  properties: [
    { name: 'title', type: 'string', label: 'Title', default: 'Card Title' }
  ]
}

export const TextareaComponent: ComponentDefinition = {
  type: 'textarea',
  name: 'Textarea',
  icon: 'AlignLeft',
  category: 'form',
  defaultProps: {
    placeholder: 'Enter long text...',
    rows: 4
  },
  defaultStyle: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    width: '300px',
    minHeight: '100px'
  },
  properties: [
    { name: 'placeholder', type: 'string', label: 'Placeholder', default: 'Enter long text...' },
    { name: 'rows', type: 'number', label: 'Rows', default: 4 }
  ]
}

export const CheckboxComponent: ComponentDefinition = {
  type: 'checkbox',
  name: 'Checkbox',
  icon: 'CheckSquare',
  category: 'form',
  defaultProps: {
    label: 'Check me',
    checked: false
  },
  defaultStyle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px'
  },
  properties: [
    { name: 'label', type: 'string', label: 'Label', default: 'Check me' },
    { name: 'checked', type: 'boolean', label: 'Checked', default: false }
  ]
}

export const SelectComponent: ComponentDefinition = {
  type: 'select',
  name: 'Select',
  icon: 'List',
  category: 'form',
  defaultProps: {
    placeholder: 'Select an option...'
  },
  defaultStyle: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    width: '200px',
    backgroundColor: '#FFFFFF'
  },
  properties: [
    { name: 'placeholder', type: 'string', label: 'Placeholder', default: 'Select an option...' }
  ]
}

export const LinkComponent: ComponentDefinition = {
  type: 'link',
  name: 'Link',
  icon: 'Link',
  category: 'navigation',
  defaultProps: {
    text: 'Click here',
    href: '#'
  },
  defaultStyle: {
    color: '#3B82F6',
    textDecoration: 'underline',
    fontSize: '14px',
    cursor: 'pointer'
  },
  properties: [
    { name: 'text', type: 'string', label: 'Text', default: 'Click here' },
    { name: 'href', type: 'string', label: 'URL', default: '#' }
  ]
}

export const BadgeComponent: ComponentDefinition = {
  type: 'badge',
  name: 'Badge',
  icon: 'Tag',
  category: 'primitive',
  defaultProps: {
    text: 'New'
  },
  defaultStyle: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600'
  },
  properties: [
    { name: 'text', type: 'string', label: 'Text', default: 'New' }
  ]
}

export const DividerComponent: ComponentDefinition = {
  type: 'divider',
  name: 'Divider',
  icon: 'Minus',
  category: 'layout',
  defaultProps: {},
  defaultStyle: {
    width: '100%',
    height: '1px',
    backgroundColor: '#E5E7EB',
    margin: '16px 0'
  },
  properties: []
}

export const AvatarComponent: ComponentDefinition = {
  type: 'avatar',
  name: 'Avatar',
  icon: 'User',
  category: 'primitive',
  defaultProps: {
    src: '',
    initials: 'JD'
  },
  defaultStyle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600'
  },
  properties: [
    { name: 'src', type: 'string', label: 'Image URL', default: '' },
    { name: 'initials', type: 'string', label: 'Initials', default: 'JD' }
  ]
}

export const LabelComponent: ComponentDefinition = {
  type: 'label',
  name: 'Label',
  icon: 'Type',
  category: 'form',
  defaultProps: {
    text: 'Label'
  },
  defaultStyle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '4px'
  },
  properties: [
    { name: 'text', type: 'string', label: 'Text', default: 'Label' }
  ]
}

export const NavbarComponent: ComponentDefinition = {
  type: 'navbar',
  name: 'Navbar',
  icon: 'PanelTop',
  category: 'navigation',
  defaultProps: {
    brand: 'Brand',
    links: 'Home,Features,Pricing,Contact'
  },
  defaultStyle: {
    backgroundColor: '#111827',
    color: '#FFFFFF',
    padding: '0 16px',
    borderRadius: '8px'
  },
  properties: [
    { name: 'brand', type: 'string', label: 'Brand', default: 'Brand' },
    { name: 'links', type: 'string', label: 'Links (comma)', default: 'Home,Features,Pricing,Contact' }
  ]
}

export const TabsComponent: ComponentDefinition = {
  type: 'tabs',
  name: 'Tabs',
  icon: 'FolderKanban',
  category: 'navigation',
  defaultProps: {
    tabs: 'Overview,Analytics,Settings',
    activeTab: 0
  },
  defaultStyle: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '8px'
  },
  properties: [
    { name: 'tabs', type: 'string', label: 'Tabs (comma)', default: 'Overview,Analytics,Settings' },
    { name: 'activeTab', type: 'number', label: 'Active Tab', default: 0 }
  ]
}

export const BreadcrumbComponent: ComponentDefinition = {
  type: 'breadcrumb',
  name: 'Breadcrumb',
  icon: 'ChevronsRight',
  category: 'navigation',
  defaultProps: {
    items: 'Home,Products,Item'
  },
  defaultStyle: {
    color: '#4B5563',
    fontSize: '14px'
  },
  properties: [
    { name: 'items', type: 'string', label: 'Items (comma)', default: 'Home,Products,Item' }
  ]
}

export const PaginationComponent: ComponentDefinition = {
  type: 'pagination',
  name: 'Pagination',
  icon: 'Rows3',
  category: 'navigation',
  defaultProps: {
    currentPage: 2,
    totalPages: 8
  },
  defaultStyle: {
    backgroundColor: 'transparent'
  },
  properties: [
    { name: 'currentPage', type: 'number', label: 'Current Page', default: 2 },
    { name: 'totalPages', type: 'number', label: 'Total Pages', default: 8 }
  ]
}

export const AlertComponent: ComponentDefinition = {
  type: 'alert',
  name: 'Alert',
  icon: 'AlertTriangle',
  category: 'feedback',
  defaultProps: {
    title: 'Heads up!',
    message: 'This action cannot be undone.',
    variant: 'warning'
  },
  defaultStyle: {
    borderRadius: '8px',
    border: '1px solid #FDE68A',
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    padding: '12px 14px'
  },
  properties: [
    { name: 'title', type: 'string', label: 'Title', default: 'Heads up!' },
    { name: 'message', type: 'string', label: 'Message', default: 'This action cannot be undone.' },
    { name: 'variant', type: 'select', label: 'Variant', options: ['info', 'success', 'warning', 'error'], default: 'warning' }
  ]
}

export const ProgressComponent: ComponentDefinition = {
  type: 'progress',
  name: 'Progress',
  icon: 'Loader',
  category: 'feedback',
  defaultProps: {
    value: 65,
    label: 'Uploading'
  },
  defaultStyle: {
    backgroundColor: 'transparent'
  },
  properties: [
    { name: 'value', type: 'number', label: 'Value %', default: 65, min: 0, max: 100 },
    { name: 'label', type: 'string', label: 'Label', default: 'Uploading' }
  ]
}

export const ToastComponent: ComponentDefinition = {
  type: 'toast',
  name: 'Toast',
  icon: 'Bell',
  category: 'feedback',
  defaultProps: {
    message: 'Changes saved successfully',
    variant: 'success'
  },
  defaultStyle: {
    borderRadius: '10px',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    padding: '10px 14px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
  },
  properties: [
    { name: 'message', type: 'string', label: 'Message', default: 'Changes saved successfully' },
    { name: 'variant', type: 'select', label: 'Variant', options: ['success', 'info', 'warning', 'error'], default: 'success' }
  ]
}

export const ModalComponent: ComponentDefinition = {
  type: 'modal',
  name: 'Modal',
  icon: 'PanelTopOpen',
  category: 'feedback',
  defaultProps: {
    title: 'Confirm action',
    body: 'Are you sure you want to continue?',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  },
  defaultStyle: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
    padding: '16px'
  },
  properties: [
    { name: 'title', type: 'string', label: 'Title', default: 'Confirm action' },
    { name: 'body', type: 'string', label: 'Body', default: 'Are you sure you want to continue?' },
    { name: 'confirmText', type: 'string', label: 'Confirm Text', default: 'Confirm' },
    { name: 'cancelText', type: 'string', label: 'Cancel Text', default: 'Cancel' }
  ]
}

export const RadioComponent: ComponentDefinition = {
  type: 'radio',
  name: 'Radio Group',
  icon: 'CircleDot',
  category: 'form',
  defaultProps: {
    label: 'Choose one',
    options: 'Option A,Option B,Option C',
    selected: 'Option A'
  },
  defaultStyle: {
    fontSize: '14px',
    color: '#111827'
  },
  properties: [
    { name: 'label', type: 'string', label: 'Label', default: 'Choose one' },
    { name: 'options', type: 'string', label: 'Options (comma)', default: 'Option A,Option B,Option C' },
    { name: 'selected', type: 'string', label: 'Selected', default: 'Option A' }
  ]
}

export const SwitchComponent: ComponentDefinition = {
  type: 'switch',
  name: 'Switch',
  icon: 'ToggleRight',
  category: 'form',
  defaultProps: {
    label: 'Enable notifications',
    checked: true
  },
  defaultStyle: {
    fontSize: '14px',
    color: '#111827'
  },
  properties: [
    { name: 'label', type: 'string', label: 'Label', default: 'Enable notifications' },
    { name: 'checked', type: 'boolean', label: 'Checked', default: true }
  ]
}

export const SliderComponent: ComponentDefinition = {
  type: 'slider',
  name: 'Slider',
  icon: 'SlidersHorizontal',
  category: 'form',
  defaultProps: {
    label: 'Volume',
    value: 40,
    min: 0,
    max: 100
  },
  defaultStyle: {
    fontSize: '14px',
    color: '#111827'
  },
  properties: [
    { name: 'label', type: 'string', label: 'Label', default: 'Volume' },
    { name: 'value', type: 'number', label: 'Value', default: 40 },
    { name: 'min', type: 'number', label: 'Min', default: 0 },
    { name: 'max', type: 'number', label: 'Max', default: 100 }
  ]
}

export const TableComponent: ComponentDefinition = {
  type: 'table',
  name: 'Table',
  icon: 'Table2',
  category: 'data-display',
  defaultProps: {
    headers: 'Name,Role,Status',
    rows: 'Jane Doe|Designer|Active;John Lee|Developer|Pending;Sara Kim|Manager|Active'
  },
  defaultStyle: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  properties: [
    { name: 'headers', type: 'string', label: 'Headers (comma)', default: 'Name,Role,Status' },
    { name: 'rows', type: 'string', label: 'Rows (; and |)', default: 'Jane Doe|Designer|Active;John Lee|Developer|Pending;Sara Kim|Manager|Active' }
  ]
}

export const ListComponent: ComponentDefinition = {
  type: 'list',
  name: 'List',
  icon: 'ListOrdered',
  category: 'data-display',
  defaultProps: {
    items: 'Research users,Create wireframes,Ship MVP',
    ordered: false
  },
  defaultStyle: {
    color: '#1F2937',
    fontSize: '14px'
  },
  properties: [
    { name: 'items', type: 'string', label: 'Items (comma)', default: 'Research users,Create wireframes,Ship MVP' },
    { name: 'ordered', type: 'boolean', label: 'Ordered', default: false }
  ]
}

export const StatisticComponent: ComponentDefinition = {
  type: 'statistic',
  name: 'Statistic',
  icon: 'BarChart3',
  category: 'data-display',
  defaultProps: {
    label: 'Monthly Revenue',
    value: '$24,900',
    trend: '+12.4%'
  },
  defaultStyle: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    padding: '14px'
  },
  properties: [
    { name: 'label', type: 'string', label: 'Label', default: 'Monthly Revenue' },
    { name: 'value', type: 'string', label: 'Value', default: '$24,900' },
    { name: 'trend', type: 'string', label: 'Trend', default: '+12.4%' }
  ]
}

export const TimelineComponent: ComponentDefinition = {
  type: 'timeline',
  name: 'Timeline',
  icon: 'ListTree',
  category: 'data-display',
  defaultProps: {
    events: 'Kickoff|Jan 10;Design complete|Jan 22;Launch|Feb 5'
  },
  defaultStyle: {
    color: '#1F2937',
    fontSize: '14px'
  },
  properties: [
    { name: 'events', type: 'string', label: 'Events (; and |)', default: 'Kickoff|Jan 10;Design complete|Jan 22;Launch|Feb 5' }
  ]
}

export const BUILT_IN_COMPONENTS: ComponentDefinition[] = [
  ButtonComponent,
  TextComponent,
  HeadingComponent,
  ContainerComponent,
  ImageComponent,
  InputComponent,
  CardComponent,
  TextareaComponent,
  CheckboxComponent,
  SelectComponent,
  LinkComponent,
  BadgeComponent,
  DividerComponent,
  AvatarComponent,
  LabelComponent,
  NavbarComponent,
  TabsComponent,
  BreadcrumbComponent,
  PaginationComponent,
  AlertComponent,
  ProgressComponent,
  ToastComponent,
  ModalComponent,
  RadioComponent,
  SwitchComponent,
  SliderComponent,
  TableComponent,
  ListComponent,
  StatisticComponent,
  TimelineComponent
]

function readSize(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'auto') return null
  const parsed = Number.parseFloat(trimmed.replace('px', ''))
  return Number.isFinite(parsed) ? parsed : null
}

const SIZE_FALLBACKS: Record<string, { width: number; height: number }> = {
  container: { width: 300, height: 200 },
  button: { width: 140, height: 42 },
  input: { width: 220, height: 42 },
  textarea: { width: 320, height: 120 },
  image: { width: 240, height: 160 },
  card: { width: 320, height: 180 },
  heading: { width: 280, height: 52 },
  text: { width: 260, height: 44 },
  checkbox: { width: 180, height: 28 },
  select: { width: 220, height: 42 },
  link: { width: 120, height: 24 },
  badge: { width: 90, height: 28 },
  divider: { width: 260, height: 2 },
  avatar: { width: 40, height: 40 },
  label: { width: 140, height: 24 },
  navbar: { width: 700, height: 56 },
  tabs: { width: 340, height: 130 },
  breadcrumb: { width: 260, height: 28 },
  pagination: { width: 320, height: 44 },
  alert: { width: 320, height: 90 },
  progress: { width: 320, height: 44 },
  toast: { width: 280, height: 58 },
  modal: { width: 420, height: 220 },
  radio: { width: 240, height: 100 },
  switch: { width: 240, height: 40 },
  slider: { width: 280, height: 52 },
  table: { width: 480, height: 220 },
  list: { width: 280, height: 120 },
  statistic: { width: 220, height: 120 },
  timeline: { width: 320, height: 160 }
}

export function getDefaultNodeSize(type: string): { width: number; height: number } {
  const component = BUILT_IN_COMPONENTS.find((item) => item.type === type)
  const fallback = SIZE_FALLBACKS[type] || { width: 220, height: 60 }

  if (!component) {
    return fallback
  }

  const styleWidth = readSize(component.defaultStyle.width)
  const styleHeight = readSize(component.defaultStyle.height)

  return {
    width: styleWidth || fallback.width,
    height: styleHeight || fallback.height
  }
}
