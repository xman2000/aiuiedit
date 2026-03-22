import type { ComponentDefinition } from '@/types'

// Button Component
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

// Text Component
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

// Heading Component
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

// Container Component
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

// Image Component
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

// Input Component
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

// Card Component
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

// Textarea Component
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

// Checkbox Component
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

// Select Component
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

// Link Component
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

// Badge Component
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

// Divider Component
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

// Avatar Component
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

// Label Component
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

// All components
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
  LabelComponent
]
