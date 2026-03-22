import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import { Button } from '@/components/common/Button'
import { Send, Image as ImageIcon, Sparkles, ChevronUp, ChevronDown, Wand2 } from 'lucide-react'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'
import type { CanvasNode } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: AIAction[]
}

interface AIAction {
  label: string
  action: () => void
}

export function ChatPanel() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your local AI assistant. I\'m running entirely on your machine - no OpenRouter connection needed. I can understand commands like "add a button", "make this green", or "move this up 10px". Select elements and tell me what to do!',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { selectedIds, nodes, addNode, updateNode, pushHistory } = useCanvasStore()
  const { currentProject, updateDesignSystem } = useProjectStore()

  const selectedCount = selectedIds.size
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean) as CanvasNode[]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !currentProject) return

    const userMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Process the command locally (simulating AI)
    setTimeout(() => {
      const response = processCommand(input, selectedNodes, currentProject?.designSystem)
      
      const aiMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        actions: response.actions
      }
      
      setMessages((prev) => [...prev, aiMessage])
      setIsLoading(false)
    }, 500)
  }

  const processCommand = (command: string, selected: CanvasNode[], designSystem: any) => {
    const cmd = command.toLowerCase()
    
    // Add component commands
    if (cmd.includes('add') || cmd.includes('create')) {
      const componentType = BUILT_IN_COMPONENTS.find(c => 
        cmd.includes(c.type) || cmd.includes(c.name.toLowerCase())
      )
      
      if (componentType) {
        return {
          message: `I'll add a ${componentType.name} to the canvas.`,
          actions: [{
            label: `Add ${componentType.name}`,
            action: () => {
              const newNode: CanvasNode = {
                id: `node-${Date.now()}`,
                type: componentType.type,
                parentId: null,
                position: { x: 200, y: 200 },
                size: { 
                  width: componentType.type === 'container' ? 300 : componentType.type === 'button' ? 120 : 200, 
                  height: componentType.type === 'container' ? 200 : componentType.type === 'input' ? 40 : 'auto' as any
                },
                style: componentType.defaultStyle,
                props: componentType.defaultProps,
                children: [],
                name: componentType.name,
                locked: false,
                visible: true
              }
              addNode(newNode)
              pushHistory()
              window.showToast?.(`${componentType.name} added!`, 'success')
            }
          }]
        }
      }
    }

    // Color commands
    if (selected.length > 0 && (cmd.includes('color') || cmd.includes('green') || cmd.includes('blue') || cmd.includes('red'))) {
      let color = '#3B82F6'
      if (cmd.includes('green')) color = '#10B981'
      if (cmd.includes('red')) color = '#EF4444'
      if (cmd.includes('blue')) color = '#3B82F6'
      if (cmd.includes('yellow')) color = '#F59E0B'
      if (cmd.includes('purple')) color = '#8B5CF6'
      
      return {
        message: `I'll change the background color to ${color} for ${selected.length} element(s).`,
        actions: [{
          label: 'Apply Color',
          action: () => {
            selected.forEach(node => {
              updateNode(node.id, {
                style: { ...node.style, backgroundColor: color }
              })
            })
            pushHistory()
            window.showToast?.('Color updated!', 'success')
          }
        }]
      }
    }

    // Position commands
    if (selected.length > 0 && (cmd.includes('move') || cmd.includes('up') || cmd.includes('down') || cmd.includes('left') || cmd.includes('right'))) {
      let deltaX = 0
      let deltaY = 0
      let amount = 10
      
      const match = cmd.match(/(\d+)/)
      if (match) amount = parseInt(match[1])
      
      if (cmd.includes('up')) deltaY = -amount
      if (cmd.includes('down')) deltaY = amount
      if (cmd.includes('left')) deltaX = -amount
      if (cmd.includes('right')) deltaX = amount
      
      return {
        message: `I'll move the selected element(s) ${amount}px ${cmd.includes('up') ? 'up' : cmd.includes('down') ? 'down' : cmd.includes('left') ? 'left' : 'right'}.`,
        actions: [{
          label: 'Move Elements',
          action: () => {
            selected.forEach(node => {
              updateNode(node.id, {
                position: { 
                  x: node.position.x + deltaX, 
                  y: node.position.y + deltaY 
                }
              })
            })
            pushHistory()
            window.showToast?.('Elements moved!', 'success')
          }
        }]
      }
    }

    // Design system commands
    if (cmd.includes('primary color') || cmd.includes('theme')) {
      const colorMatch = cmd.match(/#([0-9A-Fa-f]{6})/)
      if (colorMatch) {
        const color = '#' + colorMatch[1]
        return {
          message: `I'll update the primary color in your design system to ${color}.`,
          actions: [{
            label: 'Update Design System',
            action: () => {
              updateDesignSystem({
                ...designSystem,
                colors: {
                  ...designSystem.colors,
                  primary: { name: 'Primary', value: color }
                }
              })
              window.showToast?.('Design system updated!', 'success')
            }
          }]
        }
      }
    }

    // Default response
    return {
      message: `I understand you want to: "${command}". In the full version, I'll connect to OpenRouter to provide intelligent responses. For now, try commands like:\n\n• "Add a button"\n• "Make this green/blue/red"\n• "Move this up 10px"\n• "Update primary color to #FF5733"`,
      actions: []
    }
  }

  return (
    <div className={`border-t bg-card transition-all duration-300 ${isExpanded ? 'h-80' : 'h-12'}`}>
      {/* Header */}
      <div 
        className="flex h-12 cursor-pointer items-center justify-between border-b px-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">AI Assistant</span>
          </div>
          
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {selectedCount} selected
            </span>
          )}
        </div>

        <button className="rounded p-1 hover:bg-muted">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Messages */}
      {isExpanded && (
        <>
          <div className="flex h-56 flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg px-4 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-line">{message.content}</div>
                    
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              action.action()
                              setMessages(prev => prev.filter(m => m.id !== message.id))
                            }}
                            className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                          >
                            <Wand2 className="h-3 w-3" />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-4 py-2">
                    <div className="flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce delay-100">.</span>
                      <span className="animate-bounce delay-200">.</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <button className="rounded p-2 hover:bg-muted">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  selectedCount > 0
                    ? "Tell me what to do with the selected elements..."
                    : "Ask me to create something..."
                }
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              
              <Button 
                size="icon" 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="mt-2 text-xs text-muted-foreground">
              Try: "Create a login form" | "Make this green" | "Move this up 10px" | "Add a button"
            </p>
          </div>
        </>
      )}
    </div>
  )
}
