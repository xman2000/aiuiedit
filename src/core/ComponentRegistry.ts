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

// All components
export const BUILT_IN_COMPONENTS: ComponentDefinition[] = [
  ButtonComponent,
  TextComponent,
  HeadingComponent,
  ContainerComponent,
  ImageComponent,
  InputComponent
]
