import type { CanvasNode, DesignSystem } from '@/types'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  message: string
  actions?: AIAction[]
  error?: string
}

export interface AIAction {
  type: 'add_component' | 'modify_style' | 'modify_prop' | 'move' | 'delete' | 'unknown'
  componentType?: string
  property?: string
  value?: any
  description?: string
}

export class AIService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'kimi-latest') {
    this.apiKey = apiKey
    this.model = model
  }

  async sendMessage(
    message: string,
    context: {
      selectedNodes: CanvasNode[]
      designSystem: DesignSystem
      canvasNodes: CanvasNode[]
    }
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      return {
        message: 'Please configure your OpenRouter API key in Settings to use the AI assistant.',
        error: 'No API key configured'
      }
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context)
      
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aiuiedit.app',
          'X-Title': 'aiuiedit'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'API request failed')
      }

      const data = await response.json()
      const aiMessage = data.choices[0]?.message?.content || ''

      // Parse the AI response for actions
      const actions = this.parseActions(aiMessage, context)

      return {
        message: aiMessage,
        actions
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      return {
        message: 'Sorry, I encountered an error processing your request. Please check your API key and try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private buildSystemPrompt(context: {
    selectedNodes: CanvasNode[]
    designSystem: DesignSystem
    canvasNodes: CanvasNode[]
  }): string {
    return `You are an AI assistant for aiuiedit, a visual UI builder. Help users design and modify their UI.

Current Context:
- Selected elements: ${context.selectedNodes.length > 0 
  ? context.selectedNodes.map(n => `${n.type} (${n.name})`).join(', ') 
  : 'None'}
- Total elements on canvas: ${context.canvasNodes.length}
- Design System Colors:
  - Primary: ${context.designSystem.colors.primary.value}
  - Secondary: ${context.designSystem.colors.secondary.value}
  - Accent: ${context.designSystem.colors.accent.value}
- Font: ${context.designSystem.typography.fontFamily}

Available components: button, text, heading, container, image, input, card, textarea, checkbox, select, link, badge, divider, avatar, label, navbar, tabs, breadcrumb, pagination, alert, progress, toast, modal, radio, switch, slider, table, list, statistic, timeline

You can help users by:
1. Adding new components to the canvas
2. Modifying properties of selected elements (color, text, size, etc.)
3. Moving or resizing elements
4. Providing design advice

Respond conversationally but concisely. If the user wants to make a change, describe what you'll do and offer to perform the action.`
  }

  private parseActions(message: string, context: { selectedNodes: CanvasNode[] }): AIAction[] {
    const actions: AIAction[] = []
    const lowerMessage = message.toLowerCase()

    // Check for add component requests
    const componentMatches = [
      { type: 'button', keywords: ['button'] },
      { type: 'text', keywords: ['text', 'paragraph'] },
      { type: 'heading', keywords: ['heading', 'header', 'title'] },
      { type: 'container', keywords: ['container', 'box', 'div'] },
      { type: 'image', keywords: ['image', 'picture', 'photo'] },
      { type: 'input', keywords: ['input', 'field', 'textbox'] },
      { type: 'card', keywords: ['card'] },
      { type: 'textarea', keywords: ['textarea', 'long text'] },
      { type: 'checkbox', keywords: ['checkbox'] },
      { type: 'select', keywords: ['select', 'dropdown'] },
      { type: 'link', keywords: ['link', 'anchor'] },
      { type: 'badge', keywords: ['badge', 'tag'] },
      { type: 'divider', keywords: ['divider', 'separator'] },
      { type: 'avatar', keywords: ['avatar', 'profile picture'] },
      { type: 'label', keywords: ['label'] },
      { type: 'navbar', keywords: ['navbar', 'navigation bar', 'top nav'] },
      { type: 'tabs', keywords: ['tabs', 'tabbed'] },
      { type: 'breadcrumb', keywords: ['breadcrumb'] },
      { type: 'pagination', keywords: ['pagination', 'pager'] },
      { type: 'alert', keywords: ['alert', 'warning message'] },
      { type: 'progress', keywords: ['progress', 'progress bar'] },
      { type: 'toast', keywords: ['toast', 'notification'] },
      { type: 'modal', keywords: ['modal', 'dialog'] },
      { type: 'radio', keywords: ['radio', 'radio group'] },
      { type: 'switch', keywords: ['switch', 'toggle'] },
      { type: 'slider', keywords: ['slider', 'range'] },
      { type: 'table', keywords: ['table', 'grid'] },
      { type: 'list', keywords: ['list', 'checklist'] },
      { type: 'statistic', keywords: ['statistic', 'stat', 'metric'] },
      { type: 'timeline', keywords: ['timeline', 'roadmap'] }
    ]

    for (const match of componentMatches) {
      if (match.keywords.some(k => lowerMessage.includes(k)) && 
          (lowerMessage.includes('add') || lowerMessage.includes('create'))) {
        actions.push({
          type: 'add_component',
          componentType: match.type,
          description: `Add ${match.type} component`
        })
      }
    }

    // Check for color changes
    const colorKeywords = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white', 'gray']
    if (context.selectedNodes.length > 0 && colorKeywords.some(c => lowerMessage.includes(c))) {
      actions.push({
        type: 'modify_style',
        description: 'Change color of selected elements'
      })
    }

    // Check for delete requests
    if ((lowerMessage.includes('delete') || lowerMessage.includes('remove')) && context.selectedNodes.length > 0) {
      actions.push({
        type: 'delete',
        description: `Delete ${context.selectedNodes.length} selected element(s)`
      })
    }

    return actions
  }
}

// Helper to create service from settings
export function createAIService(apiKey?: string, model?: string): AIService {
  return new AIService(apiKey || '', model || 'kimi-latest')
}
