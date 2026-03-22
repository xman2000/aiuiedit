import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/common/Button'
import { Send, Image as ImageIcon, Sparkles, ChevronUp, ChevronDown, Wand2, Settings } from 'lucide-react'
import { BUILT_IN_COMPONENTS } from '@/core/ComponentRegistry'
import { createCanvasNode } from '@/core/canvasNodeFactory'
import { createAIService } from '@/services/ai'
import type { CanvasNode } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: AIAction[]
  error?: boolean
}

interface AIAction {
  label: string
  action: () => void
}

export function ChatPanel() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { selectedIds, nodes, addNode, updateNode, deleteNode, pushHistory } = useCanvasStore()
  const { currentProject, currentPage, setDirty } = useProjectStore()
  const { settings } = useAppStore()
  
  // Create AI service with current settings
  const [aiService] = useState(() => 
    createAIService(settings.openRouterApiKey, settings.aiModel)
  )

  const selectedCount = selectedIds.size
  const selectedNodes = Array.from(selectedIds).map(id => nodes.get(id)).filter(Boolean) as CanvasNode[]

  // Set initial welcome message based on API key status
  useEffect(() => {
    if (settings.openRouterApiKey) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your AI assistant powered by OpenRouter (${settings.aiModel}). I can help you design UI, add components, modify styles, and more. What would you like to do?`,
        timestamp: new Date()
      }])
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! Add your OpenRouter API key in Settings to enable AI assistance. I can help you design UI, add components, and modify styles.',
        timestamp: new Date()
      }])
    }
  }, [settings.openRouterApiKey, settings.aiModel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !currentProject) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Get all canvas nodes for context
      const allNodes = Array.from(nodes.values())
      
      const response = await aiService.sendMessage(input, {
        selectedNodes,
        designSystem: currentProject.designSystem,
        canvasNodes: allNodes
      })

      // Convert service actions to UI actions
      const actions: AIAction[] = []
      
      if (response.actions) {
        for (const action of response.actions) {
          switch (action.type) {
            case 'add_component':
              if (action.componentType) {
                const component = BUILT_IN_COMPONENTS.find(c => c.type === action.componentType)
                if (component) {
                  actions.push({
                    label: `Add ${component.name}`,
                    action: () => {
                      if (!currentPage) return

                      const newNode = createCanvasNode(component.type, currentPage.id, { x: 200, y: 200 })
                      if (!newNode) return

                      addNode(newNode)
                      setDirty(true)
                      window.showToast?.(`${component.name} added!`, 'success')
                    }
                  })
                }
              }
              break
            
            case 'modify_style':
              if (selectedNodes.length > 0) {
                actions.push({
                  label: 'Apply Changes',
                  action: () => {
                    // Extract color from message if present
                    const colorMatch = response.message.match(/#([0-9A-Fa-f]{6})/i)
                    if (colorMatch) {
                      const color = '#' + colorMatch[1]
                      selectedNodes.forEach(node => {
                        updateNode(node.id, {
                          style: { ...node.style, backgroundColor: color }
                        })
                      })
                      pushHistory()
                      setDirty(true)
                      window.showToast?.('Style updated!', 'success')
                    }
                  }
                })
              }
              break
            
            case 'delete':
              if (selectedNodes.length > 0) {
                actions.push({
                  label: `Delete ${selectedNodes.length} element(s)`,
                  action: () => {
                    selectedNodes.forEach(node => deleteNode(node.id))
                    pushHistory()
                    setDirty(true)
                    window.showToast?.('Elements deleted!', 'success')
                  }
                })
              }
              break
          }
        }
      }

      const aiMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined,
        error: !!response.error
      }
      
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('AI Error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your API key and try again.',
        timestamp: new Date(),
        error: true
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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
          
          {!settings.openRouterApiKey && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600">
              Configure API Key
            </span>
          )}
          
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Open settings - you can add a settings modal trigger here
              window.showToast?.('Open Settings to configure API key', 'info')
            }}
            className="rounded p-1.5 hover:bg-muted transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <button className="rounded p-1 hover:bg-muted">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
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
                        : message.error
                        ? 'bg-red-500/10 border border-red-500/50 text-red-700 dark:text-red-400'
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
                  settings.openRouterApiKey
                    ? selectedCount > 0
                      ? "Tell me what to do with the selected elements..."
                      : "Ask me to create something..."
                    : "Add API key in Settings to use AI..."
                }
                disabled={!settings.openRouterApiKey}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              
              <Button 
                size="icon" 
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !settings.openRouterApiKey}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="mt-2 text-xs text-muted-foreground">
              {settings.openRouterApiKey 
                ? "Try: 'Create a login form' | 'Make this green' | 'Move this up 10px' | 'Add a button'" 
                : "Click the settings icon above to add your OpenRouter API key"}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
