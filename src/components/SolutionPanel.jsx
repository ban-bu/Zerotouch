import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, Send, Bot, User, Lightbulb, HelpCircle, Users, ArrowRight, Check, AlertCircle, MessageSquare, CheckCircle, XCircle, Phone, AlertTriangle } from 'lucide-react'
import AnimatedTransition from './AnimatedTransition'

const SolutionPanel = ({
  scenario,
  messages = [],
  onSendMessage,
  onSendToProblem,
  isProcessing,
  iterationMode,
  pendingResponse,
  directSendCandidate,
  onConfirmDirectSend,
  onCancelDirectSend,
  onGenerateSuggestion,
  onGenerateFollowUp,
  onGenerateDepartmentContact,
  onMarkContactInstructionSent,
  onMarkCustomerReplyApplied,
  onPrepareDirectSendCandidate,
  onConfirmSend,
  onCancelIteration,
  onSetInput,
  inputRef,
  settings,
  iterationProcessing,
  // AI功能相关props
  onAcceptSuggestion,
  onNegotiateSuggestion,
  onCancelNegotiation,
  onSendNegotiationRequest,
  onRejectSuggestion,
  onAcceptFollowUp,
  onNegotiateFollowUp,
  onCancelFollowUpNegotiation,
  onSendFollowUpNegotiationRequest,
  onRejectFollowUp,
  onAcceptIntelligentFollowUp,
  onNegotiateIntelligentFollowUp,
  onCancelIntelligentFollowUpNegotiation,
  onSendIntelligentFollowUpNegotiationRequest,
  onRejectIntelligentFollowUp,
  // AI控制功能props
  onGenerateIntelligentFollowUp,
  onGenerateDepartmentContactOnly,
  onChatWithAI,
  onClearAiChatHistory,
  // 新增：外部生成客户回复（基于消息）
  onGenerateCustomerReplyForMessage,
  onNegotiateCustomerReplyCandidate,
  aiChatHistory,
  currentScenario,
  // 缺失信息选择相关props
  missingInfoOptions,
  showMissingInfoPanel,
  onToggleMissingInfoOption,
  onGenerateFollowUpBySelectedInfo,
  onSkipInfoCollection,
  // 新增：聊天模式相关props
  chatMode,
  departmentModalVisible,
  emergencyModalVisible,
  onSwitchChatMode,
  onCloseModeModal,
  onCloseEmergencyModalOnly,
  onHandleEmergencyMode
}) => {
  const [input, setInput] = useState('')
  const [aiProcessing, setAiProcessing] = useState(false)
  const messagesEndRef = useRef(null)
  // Local editing state for customer reply drafts
  const [candidateStates, setCandidateStates] = useState({})
  // 智能追问协商的本地状态
  const [followupStates, setFollowupStates] = useState({})
  
  // 紧急模式弹窗状态
  const [emergencyDescription, setEmergencyDescription] = useState('')
  const [emergencyLevel, setEmergencyLevel] = useState('urgent')

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 工具函数：判断某条综合分析是否有对应的 Smart Follow-up Draft（通过关联ID精确匹配）
  const hasSmartFollowupDraftFor = (compMessage) => {
    if (!Array.isArray(messages)) return false
    const compId = compMessage?.id || compMessage?.streamId
    if (!compId) return false
    return messages.some(m => m && m.type === 'intelligent_followup_candidate' && m.relatedComprehensiveId === compId)
  }

  // 是否存在任意 Smart Follow-up Draft（作为兜底：如果存在草稿，则先不展示“生成客户回复”按钮）
  const hasAnySmartFollowupDraft = Array.isArray(messages) && messages.some(m => m && m.type === 'intelligent_followup_candidate')

  // 传递设置输入函数给父组件
  useEffect(() => {
    if (onSetInput) {
      onSetInput(setInput)
    }
  }, [onSetInput])

  // 根据聊天模式获取AI消息颜色主题
  const getAIMessageColors = (mode = 'normal') => {
    switch (mode) {
      case 'department':
        return {
          primary: 'rgba(34, 197, 94, 0.9)', // 绿色
          secondary: 'rgba(16, 185, 129, 0.85)',
          accent: 'rgba(5, 150, 105, 0.8)',
          textLight: 'text-green-100',
          iconColor: 'text-green-100',
          bgAccent: 'bg-green-600/30',
          borderAccent: 'border-green-400/30'
        }
      case 'emergency':
        return {
          primary: 'rgba(239, 68, 68, 0.9)', // 红色
          secondary: 'rgba(220, 38, 38, 0.85)',
          accent: 'rgba(185, 28, 28, 0.8)',
          textLight: 'text-red-100',
          iconColor: 'text-red-100',
          bgAccent: 'bg-red-600/30',
          borderAccent: 'border-red-400/30'
        }
      case 'normal':
      default:
        return {
          primary: 'rgba(59, 130, 246, 0.9)', // 蓝色
          secondary: 'rgba(99, 102, 241, 0.85)',
          accent: 'rgba(14, 165, 233, 0.8)',
          textLight: 'text-blue-100',
          iconColor: 'text-blue-100',
          bgAccent: 'bg-blue-600/30',
          borderAccent: 'border-blue-400/30'
        }
    }
  }

  // AI功能处理 - 统一的交互方式
  const handleAIAction = async (actionType) => {
    if (aiProcessing) return
    
    setAiProcessing(true)
    
    try {
      switch(actionType) {
        case 'suggestion':
          onGenerateSuggestion && onGenerateSuggestion()
          break
        case 'followup':
          // 防止与信息选择面板的追问生成冲突
          if (!showMissingInfoPanel) {
            onGenerateIntelligentFollowUp && onGenerateIntelligentFollowUp()
          } else {
            console.log('⚠️ Information selection panel is displayed, skipping shortcut follow-up generation')
          }
          break
        case 'department':
          onGenerateDepartmentContactOnly && onGenerateDepartmentContactOnly()
          break
        case 'chat':
          if (input.trim() && onChatWithAI) {
            await onChatWithAI(input.trim())
            setInput('')
          }
          break
        default:
          break
      }
    } catch (error) {
      console.error('AI功能执行失败:', error)
    } finally {
      setAiProcessing(false)
    }
  }

  // 快捷功能按钮
  const aiActions = [
    {
      id: 'suggestion',
      label: 'Generate suggestion',
      icon: Lightbulb,
      color: 'from-purple-500/20 to-indigo-500/20',
      hoverColor: 'hover:from-purple-500/30 hover:to-indigo-500/30',
      borderColor: 'border-purple-500/30'
    },
    {
      id: 'followup',
      label: 'Smart follow-up',
      icon: HelpCircle,
      color: 'from-orange-500/20 to-red-500/20',
      hoverColor: 'hover:from-orange-500/30 hover:to-red-500/30',
      borderColor: 'border-orange-500/30'
    },
    {
      id: 'department',
      label: 'Department contact',
      icon: Users,
      color: 'from-green-500/20 to-emerald-500/20',
      hoverColor: 'hover:from-green-500/30 hover:to-emerald-500/30',
      borderColor: 'border-green-500/30'
    }
  ]

  // 键盘事件处理
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter 或 Cmd+Enter：回复客户
        e.preventDefault()
        if (!input.trim() || !onSendToProblem) return
        const messageToSend = {
          text: input.trim(),
          timestamp: new Date().toISOString(),
          type: 'direct_reply',
          source: 'ai_collaboration'
        }
        onSendToProblem(messageToSend)
        setInput('')
      } else if (!e.shiftKey) {
        // Enter：询问AI（默认行为）
        e.preventDefault()
        handleAIAction('chat')
      }
      // Shift+Enter：换行（默认行为）
    }
  }

  return (
    <div className="h-full flex flex-col glass-effect rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
      backdropFilter: 'blur(20px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      height: 'calc(100vh - 200px)' // 统一高度设置
    }}>
      {/* 头部 */}
      <div className="p-4 border-b border-white/20 dark:border-white/10 glass-effect rounded-t-2xl" style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.12) 100%)',
        backdropFilter: 'blur(20px) saturate(1.3)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100/70 dark:bg-emerald-900/50 rounded-2xl backdrop-blur-sm">
              <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">AI Collaboration</h3>
              {/* 隐藏副标题 */}
              {false && (
                <p className="text-sm text-gray-600 dark:text-gray-300">ChatGPT-style • Agent ↔ AI Collaboration</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>AI Online</span>
            </div>
            {aiChatHistory && aiChatHistory.length > 0 && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Turns: {Math.floor(aiChatHistory.length / 2)}
              </div>
            )}
          </div>
        </div>
      </div>

             {/* 聊天消息区域 */}
       <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{
         background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(248, 250, 252, 0.01) 100%)',
         backdropFilter: 'blur(10px) saturate(1.1)'
       }}>
        {/* 空状态 */}
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 space-y-4">
            <AnimatedTransition type="fade" show={true}>
              <div className="p-4 bg-gradient-to-r from-green-100/80 to-emerald-100/80 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full shadow-inner backdrop-blur-sm">
                <Bot className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </AnimatedTransition>
            
            {/* 添加说明文字 */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Collaborate with AI to reply to customers
            </p>
            
            {/* 隐藏中部说明文字 */}
            {false && (
              <p className="text-lg">ChatGPT风格AI协作工作台</p>
            )}
            {false && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                与AI协作，为客户制定最佳解决方案
              </p>
            )}
            <div className="mt-4 p-3 rounded-lg border border-blue-200/50 dark:border-blue-800/50" style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 197, 253, 0.05) 100%)',
              backdropFilter: 'blur(10px) saturate(1.2)'
            }}>
              {/* <p className="text-xs text-blue-600 dark:text-blue-400">
                💡 提示：在下方输入框与AI对话，或使用快捷功能按钮
              </p> */}
            </div>
          </div>
        )}

        {/* 消息列表 */}
        {messages && messages.map((message, index) => (
          <div key={index} className="space-y-2">
            {/* 用户消息 - 右侧，根据生成时模式显示不同颜色 */}
            {message.type === 'user' && (
              <div className="flex justify-end">
                {(() => {
                  const colors = getAIMessageColors(message.generatedInMode || chatMode)
                  // 为用户消息使用稍微不同的配色方案，保持与AI消息的区分
                  const userColors = {
                    normal: {
                      primary: 'rgba(99, 102, 241, 0.9)', // 紫色
                      secondary: 'rgba(139, 92, 246, 0.85)',
                      textLight: 'text-purple-100',
                      iconColor: 'text-purple-100'
                    },
                    department: {
                      primary: 'rgba(34, 197, 94, 0.9)', // 绿色
                      secondary: 'rgba(16, 185, 129, 0.85)',
                      textLight: 'text-green-100',
                      iconColor: 'text-green-100'
                    },
                    emergency: {
                      primary: 'rgba(245, 101, 101, 0.9)', // 红色
                      secondary: 'rgba(239, 68, 68, 0.85)',
                      textLight: 'text-red-100',
                      iconColor: 'text-red-100'
                    }
                  }
                  const currentColors = userColors[message.generatedInMode || chatMode] || userColors.normal
                  
                  return (
                    <div className="max-w-[80%] p-3 rounded-2xl rounded-br-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                      background: `linear-gradient(135deg, ${currentColors.primary} 0%, ${currentColors.secondary} 100%)`,
                      color: 'white'
                    }}>
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          <div className={`text-xs font-medium ${currentColors.textLight} mb-1 opacity-90`}>
                            👨‍💼 Agent{message.generatedInMode === 'department' ? ' (contact mode)' : message.generatedInMode === 'emergency' ? ' (emergency mode)' : ''}
                          </div>
                          <div className="whitespace-pre-wrap text-white select-text text-sm">{message.text}</div>
                          <div className={`text-xs ${currentColors.textLight} mt-1 opacity-90`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <User className={`w-4 h-4 ${currentColors.iconColor} mt-0.5 flex-shrink-0`} />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* AI聊天消息 - ChatGPT风格显示，支持流式打字机效果 */}
            {message.type === 'ai_chat' && (
              <div className="space-y-3">
                {/* AI Answer - left bubble, supports streaming display, shows different colors based on generation mode */}
                <div className="flex items-start justify-start">
                  {(() => {
                    const colors = getAIMessageColors(message.generatedInMode || chatMode)
                    return (
                      <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                        background: message.error 
                          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.85) 100%)'
                          : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        color: 'white'
                      }}>
                        <div className="flex items-start space-x-2">
                          <div className="relative">
                            <Bot className={`w-4 h-4 ${colors.iconColor} mt-0.5 flex-shrink-0`} />
                            {/* 流式显示动态指示器 */}
                            {message.isStreaming && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-medium ${colors.textLight} mb-1 opacity-90 flex items-center space-x-1`}>
                              <span>🤖 AI assistant{message.generatedInMode === 'department' ? ' (contact mode)' : message.generatedInMode === 'emergency' ? ' (emergency mode)' : ''}</span>
                              {message.isStreaming && (
                                <span className="text-green-200 animate-pulse">Answering...</span>
                              )}
                              {message.error && <span className="text-red-200">(Error)</span>}
                            </div>
                            <div className="whitespace-pre-wrap text-white select-text leading-relaxed text-sm">
                              {message.isStreaming ? message.text : (message.answer || message.text)}
                              {/* 流式显示光标效果 */}
                              {message.isStreaming && (
                                <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                              )}
                            </div>
                            <div className={`text-xs ${colors.textLight} mt-2 opacity-90 flex items-center justify-between`}>
                              <span>
                                {message.isStreaming ? 'Generating...' : new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                              {message.conversationId && (
                                <span className={`text-xs ${colors.bgAccent} px-2 py-1 rounded`}>
                                  #{message.conversationId.toString().slice(-4)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
                {/* 右侧操作区：生成客户回复 */}
                <div className="ml-2 mt-1">
                  <button
                    onClick={async () => {
                      console.log('🔍 生成客户回复按钮被点击')
                      console.log('🔍 onGenerateCustomerReplyForMessage 是否存在:', !!onGenerateCustomerReplyForMessage)
                      if (!onGenerateCustomerReplyForMessage) {
                        console.log('❌ onGenerateCustomerReplyForMessage 函数未传递')
                        return
                      }
                      console.log('🔍 开始调用 onGenerateCustomerReplyForMessage')
                      try {
                        const optimized = await onGenerateCustomerReplyForMessage({
                          text: message.answer || message.text,
                          answer: message.answer,
                          translation: message.translation,
                          suggestion: message.suggestion,
                          aiAdvice: message.aiAdvice,
                          timestamp: message.timestamp
                        })
                        console.log('🔍 客户回复生成结果:', { optimized, type: typeof optimized })
                        // Customer reply is already displayed via draft bubble, no need to fill input box
                      } catch (error) {
                        console.error('❌ 生成客户回复时发生错误:', error)
                      }
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                    disabled={message.isStreaming}
                    title="Generate a customer reply based on this AI message as a separate bubble"
                  >
                    Generate customer reply
                  </button>
                </div>
              </div>
            )}

            {/* 其他消息类型保持原有样式 */}
            {/* 建议消息 - 支持流式显示，根据生成时模式显示不同颜色 */}
            {message.type === 'suggestion' && (
              <div className="flex justify-start">
                <div className="flex items-start justify-start">
                  {(() => {
                    const colors = getAIMessageColors(message.generatedInMode || chatMode)
                    return (
                      <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        color: 'white'
                      }}>
                        <div className="flex items-start space-x-2">
                          <div className="relative">
                            <Lightbulb className={`w-4 h-4 ${colors.iconColor} mt-0.5 flex-shrink-0`} />
                      {/* 流式显示动态指示器 */}
                      {message.isStreaming && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                          <div className="flex-1">
                            <div className={`text-xs font-medium ${colors.textLight} mb-1 opacity-90 flex items-center space-x-1`}>
                              <span>💡 AI suggestion{message.generatedInMode === 'department' ? ' (contact mode)' : message.generatedInMode === 'emergency' ? ' (emergency mode)' : ''}</span>
                              {message.isStreaming && (
                                <span className="text-green-200 animate-pulse">Generating...</span>
                              )}
                            </div>
                            <div className="whitespace-pre-wrap text-white select-text text-sm">
                              {message.text}
                              {/* 流式显示光标效果 */}
                              {message.isStreaming && (
                                <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                              )}
                            </div>
                            <div className={`text-xs ${colors.textLight} mt-1 opacity-90`}>
                              {message.isStreaming ? 'Generating...' : new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="ml-2 mt-1 space-x-2">
                    <button
                      onClick={async () => {
                        if (!onGenerateCustomerReplyForMessage) return
                        await onGenerateCustomerReplyForMessage({
                          text: message.text,
                          translation: message.translation,
                          suggestion: message.text,
                          aiAdvice: message.aiAdvice,
                          timestamp: message.timestamp
                        })
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                      disabled={message.isStreaming}
                      title="Generate a customer reply based on this AI message as a separate bubble"
                    >
                      生成客户回复
                    </button>
                    <button
                      onClick={() => {
                        setFollowupStates(prev => ({
                          ...prev,
                          [message.id]: { ...(prev[message.id] || {}), showNegotiation: !(prev[message.id]?.showNegotiation) }
                        }))
                      }}
                      className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors disabled:opacity-50"
                      disabled={message.isStreaming}
                      title="Negotiate this follow-up"
                    >
                      Negotiate
                    </button>
                  </div>
                  {followupStates[message.id]?.showNegotiation && (
                    <div className="ml-2 mt-2 bg-white/10 border border-white/20 rounded-md p-2 max-w-[80%]">
                      <textarea
                        value={followupStates[message.id]?.nego || ''}
                        onChange={(e) => setFollowupStates(prev => ({
                          ...prev,
                          [message.id]: { ...(prev[message.id] || {}), nego: e.target.value }
                        }))}
                        placeholder="说明你希望如何调整这条智能追问..."
                        className="w-full p-2 bg-transparent text-white placeholder-white/70 border border-white/30 rounded mb-2 text-xs resize-none"
                        rows={3}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={async () => {
                            const negotiationText = (followupStates[message.id]?.nego || '').trim()
                            if (!negotiationText) return
                            if (typeof onSendFollowUpNegotiationRequest === 'function') {
                              await onSendFollowUpNegotiationRequest(message.id, negotiationText, (newText) => {
                                setFollowupStates(prev => ({
                                  ...prev,
                                  [message.id]: { ...(prev[message.id] || {}), showNegotiation: false, nego: '' }
                                }))
                              })
                            }
                          }}
                          className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md"
                        >
                          Send Negotiation
                        </button>
                        <button
                          onClick={() => setFollowupStates(prev => ({
                            ...prev,
                            [message.id]: { ...(prev[message.id] || {}), showNegotiation: false }
                          }))}
                          className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 追问消息 - 支持流式显示，根据生成时模式显示不同颜色 */}
            {(message.type === 'followup' || message.type === 'intelligent_followup') && (
              <div className="flex justify-start">
                <div className="flex items-start justify-start">
                  {(() => {
                    const colors = getAIMessageColors(message.generatedInMode || chatMode)
                    return (
                      <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                        color: 'white'
                      }}>
                        <div className="flex items-start space-x-2">
                          <div className="relative">
                            <HelpCircle className={`w-4 h-4 ${colors.iconColor} mt-0.5 flex-shrink-0`} />
                            {/* 流式显示动态指示器 */}
                            {message.isStreaming && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-medium ${colors.textLight} mb-1 opacity-90 flex items-center space-x-1`}>
                              <span>🔍 Smart follow-up{message.generatedInMode === 'department' ? ' (contact mode)' : message.generatedInMode === 'emergency' ? ' (emergency mode)' : ''}</span>
                              {message.isStreaming && (
                                <span className="text-green-200 animate-pulse">Generating...</span>
                              )}
                            </div>
                            <div className="whitespace-pre-wrap text-white select-text text-sm">
                              {message.text}
                              {/* 流式显示光标效果 */}
                              {message.isStreaming && (
                                <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                              )}
                            </div>
                            <div className={`text-xs ${colors.textLight} mt-1 opacity-90`}>
                              {message.isStreaming ? 'Generating...' : new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="ml-2 mt-1">
                    <button
                      onClick={async () => {
                        if (!onGenerateCustomerReplyForMessage) return
                        const optimized = await onGenerateCustomerReplyForMessage({
                          text: message.text,
                          translation: message.translation,
                          suggestion: message.text,
                          aiAdvice: message.aiAdvice,
                          timestamp: message.timestamp
                        })
                        // Customer reply is already displayed via draft bubble, no need to fill input box
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                      disabled={message.isStreaming}
                      title="Generate a customer reply based on this AI message as a separate bubble"
                    >
                      生成客户回复
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 部门联络消息 - 支持流式显示 */}
            {message.type === 'department_contact' && (
              <div className="flex justify-start">
                <div className="flex items-start justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.85) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <div className="relative">
                      <Users className="w-4 h-4 text-green-100 mt-0.5 flex-shrink-0" />
                      {/* 流式显示动态指示器 */}
                      {message.isStreaming && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-green-100 mb-1 opacity-90 flex items-center space-x-1">
                        <span>🏢 Department contact</span>
                        {message.isStreaming && (
                          <span className="text-green-200 animate-pulse">Generating...</span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-white select-text text-sm">
                        {message.text}
                        {/* 流式显示光标效果 */}
                        {message.isStreaming && (
                          <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                        )}
                      </div>
                      <div className="text-xs text-green-100 mt-1 opacity-90">
                        {message.isStreaming ? 'Generating...' : new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  </div>
                  <div className="ml-2 mt-1">
                    <button
                      onClick={async () => {
                        if (!onGenerateCustomerReplyForMessage) return
                        const optimized = await onGenerateCustomerReplyForMessage({
                          text: message.text,
                          translation: message.translation,
                          suggestion: message.text,
                          aiAdvice: message.aiAdvice,
                          timestamp: message.timestamp
                        })
                        // Customer reply is already displayed via draft bubble, no need to fill input box
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                      disabled={message.isStreaming}
                      title="Generate a customer reply based on this AI message as a separate bubble"
                    >
                      生成客户回复
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 综合智能分析消息 - 支持流式显示，根据生成时模式显示不同颜色 */}
            {message.type === 'comprehensive_analysis' && !message.question && (
              <div className="flex items-start justify-start">
                {(() => {
                  const colors = getAIMessageColors(message.generatedInMode || chatMode)
                  return (
                    <div className="max-w-[85%] p-4 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                      color: 'white'
                    }}>
                      <div className="flex items-start space-x-2">
                        <div className="relative">
                          <Bot className={`w-5 h-5 ${colors.iconColor} mt-0.5 flex-shrink-0`} />
                      {/* 流式显示动态指示器 */}
                      {message.isStreaming && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-purple-100 mb-2 opacity-90 flex items-center space-x-1">
                        <span>🧠 Comprehensive analysis</span>
                        {message.isStreaming && (
                          <span className="text-green-200 animate-pulse text-xs">正在分析...</span>
                        )}
                      </div>
                      
                      {/* 需求理解与转译（合并） */}
                      <div className="mb-3">
                        <div className="text-xs text-purple-100 mb-1 opacity-90">📋 Needs analysis:</div>
                        <div className="whitespace-pre-wrap text-white select-text mb-2 text-sm">
                          {message.text}
                          {message.isStreaming && (
                            <span className="ml-1 inline-block w-2 h-4 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-white select-text italic opacity-90 pl-3 border-l-2 border-purple-300/50 text-sm">
                          {message.isStreaming
                            ? 'Translating...'
                            : (message.translation && message.translation.trim()
                                ? message.translation
                                : `Customer inquiry: ${message.text}. Suggest asking for specific needs to provide an accurate solution.`)
                          }
                        </div>
                      </div>

                      {/* AI建议与指导（合并） */}
                      {(message.suggestion || message.aiAdvice) && (
                        <div className="pt-2 border-t border-purple-300/30">
                          <div className="text-xs text-purple-100 mb-1 opacity-90">💡 AI suggestion:</div>
                          <div className="bg-purple-600/30 rounded-lg p-3 space-y-2">
                            {message.suggestion && (
                              <div className="whitespace-pre-wrap text-white select-text text-sm">
                                {message.suggestion}
                              </div>
                            )}
                            {message.aiAdvice && (
                              <div className="whitespace-pre-wrap text-white select-text opacity-90 italic border-l-2 border-purple-200/50 pl-3 text-sm">
                                {message.aiAdvice}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-purple-100 mt-2 opacity-90">
                        {message.isStreaming ? 'Analyzing...' : new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
                )
                })()}
                {/* 右侧操作区：生成客户回复按钮（综合分析完成后，若已跳过信息收集且没有任何Smart Follow-up Draft时显示） */}
                {!message.isStreaming && !showMissingInfoPanel && !hasAnySmartFollowupDraft && (
                  <div className="ml-2 mt-1">
                    <button
                      onClick={async () => {
                        if (!onGenerateCustomerReplyForMessage) return
                        const optimized = await onGenerateCustomerReplyForMessage({
                          text: message.translation || message.suggestion || message.aiAdvice || message.text,
                          translation: message.translation,
                          suggestion: message.suggestion,
                          aiAdvice: message.aiAdvice,
                          timestamp: message.timestamp
                        })
                        // 不直接写入输入框，已在hook内以气泡形式生成
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                      disabled={message.isStreaming}
                      title="Generate a customer reply as a separate bubble"
                    >
                      Generate customer reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 智能需求分析消息 - 根据生成时模式显示不同颜色 */}
            {message.type === 'needs_analysis' && (
              <div className="flex justify-start">
                {(() => {
                  const colors = getAIMessageColors(message.generatedInMode || chatMode)
                  return (
                    <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                      color: 'white'
                    }}>
                      <div className="flex items-start space-x-2">
                        <Bot className={`w-4 h-4 ${colors.iconColor} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1">
                          <div className={`text-xs font-medium ${colors.textLight} mb-1 opacity-90`}>
                            🧠 Intelligent needs analysis{message.generatedInMode === 'department' ? ' (contact mode)' : message.generatedInMode === 'emergency' ? ' (emergency mode)' : ''}
                          </div>
                          
                          {/* 需求理解 */}
                          <div className="mb-2">
                            <div className={`text-xs ${colors.textLight} mb-1 opacity-90`}>📋 需求理解：</div>
                            <div className="whitespace-pre-wrap text-white select-text text-sm">{message.text}</div>
                          </div>

                          {/* 需求转译 - 强制显示调试版本 */}
                          <div className={`mb-2 pt-2 border-t ${colors.textLight.replace('text', 'border')}/30`}>
                            <div className={`text-xs ${colors.textLight} mb-1 opacity-90`}>🔄 需求转译：</div>
                            <div className="whitespace-pre-wrap text-white select-text italic text-sm">
                              {message.translation && message.translation.trim() 
                                ? message.translation 
                                : `客户咨询：${message.text}，建议了解客户的具体需求以提供精准的服务解决方案。`
                              }
                            </div>
                          </div>

                          {/* 可了解信息选项 */}
                          {message.missingInfoOptions && message.missingInfoOptions.length > 0 && (
                            <div className={`mt-2 pt-2 border-t ${colors.textLight.replace('text', 'border')}/30`}>
                              <div className={`text-xs ${colors.textLight} mb-1`}>💡 发现可了解信息：</div>
                              <ul className={`text-xs ${colors.textLight} space-y-1`}>
                                {message.missingInfoOptions.map((option, idx) => (
                                  <li key={idx}>• {option.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className={`text-xs ${colors.textLight} mt-1 opacity-90`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* 部门建议消息（旧版本） */}
            {message.type === 'department_suggestion' && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.85) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <Phone className="w-4 h-4 text-green-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-green-100 mb-1 opacity-90">
                        📞 Department contact suggestion
                      </div>
                      <div className="whitespace-pre-wrap text-white select-text leading-relaxed text-sm">
                        {message.text}
                      </div>
                      <div className="text-xs text-green-100 mt-2 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 部门联络建议和内部指令消息（新版本） - 根据生成时模式显示不同颜色 */}
            {message.type === 'department_contact_with_instructions' && (
              <div className="flex justify-start">
                {(() => {
                  const colors = getAIMessageColors(message.generatedInMode || chatMode)
                  return (
                    <div className="max-w-[90%] p-4 rounded-2xl rounded-bl-md shadow-lg hover:shadow-xl transition-all duration-200" style={{
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.accent} 100%)`,
                      color: 'white',
                      border: `1px solid ${colors.primary.replace('0.9', '0.2')}`,
                      boxShadow: `0 8px 25px -5px ${colors.primary.replace('0.9', '0.25')}`
                    }}>
                      <div className="flex items-start space-x-3">
                        <div className="relative">
                          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                            <Phone className={`w-5 h-5 ${colors.iconColor}`} />
                          </div>
                          {/* 流式显示指示器 */}
                          {message.isStreaming && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`text-sm font-semibold ${colors.textLight}`}>
                              🔗 Smart department contact plan{chatMode === 'emergency' ? ' (emergency)' : chatMode === 'department' ? ' (contact mode)' : ''}
                            </div>
                            <div className={`text-xs bg-white/20 px-2 py-0.5 rounded-full ${colors.textLight}`}>
                              AI Generated{message.isStreaming && '...'}
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap text-white select-text leading-relaxed text-sm">
                            {message.text}
                            {/* 流式显示光标效果 */}
                            {message.isStreaming && (
                              <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                            )}
                          </div>
                          <div className={`flex items-center justify-between mt-3 pt-2 border-t ${colors.textLight.replace('text', 'border')}/20`}>
                            <div className={`text-xs ${colors.textLight} opacity-90`}>
                              {message.isStreaming ? 'Generating...' : new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                            {message.isDefault && (
                              <div className={`text-xs ${colors.textLight}/70 italic`}>
                                基于场景默认方案
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* 紧急响应消息 */}
            {message.type === 'emergency_response' && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.85) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-red-100 mb-1 opacity-90 flex items-center space-x-2">
                        <span>⚠️ Emergency handling plan</span>
                        {message.escalated && (
                          <span className="bg-red-600/50 px-2 py-0.5 rounded text-xs">已升级</span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-white select-text leading-relaxed text-sm">
                        {message.text}
                      </div>
                      <div className="text-xs text-red-100 mt-2 opacity-90 flex items-center justify-between">
                        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                        <span className="bg-red-600/30 px-2 py-0.5 rounded">
                          {message.urgencyLevel === 'critical' ? '关键级' : 
                           message.urgencyLevel === 'urgent' ? 'Urgent' : 'High'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 升级通知消息 */}
            {message.type === 'escalation_notice' && (
              <div className="flex justify-center">
                <div className="max-w-[60%] p-2 rounded-lg shadow-sm" style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.85) 100%)',
                  color: 'white'
                }}>
                  <div className="text-center">
                    <div className="text-xs font-medium text-amber-100 mb-1">
                      📢 系统通知
                    </div>
                    <div className="text-xs text-white select-text">
                      {message.text}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 错误消息 */}
            {(message.type === 'emergency_error' || message.isError) && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm" style={{
                  background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.9) 0%, rgba(107, 114, 128, 0.85) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-gray-200 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-200 mb-1 opacity-90">
                        ❌ 系统错误
                      </div>
                      <div className="text-sm text-white select-text">
                        {message.text}
                      </div>
                      <div className="text-xs text-gray-200 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 新增：智能追问候选气泡 */}
            {message.type === 'intelligent_followup_candidate' && (
              <div className="flex items-start justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.92) 0%, rgba(124, 58, 237, 0.88) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <HelpCircle className="w-4 h-4 text-purple-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-purple-100 mb-1 opacity-90 flex items-center space-x-1">
                        <span>🤔 Smart Follow-up Draft</span>
                        {message.isStreaming && (
                          <span className="text-green-200 animate-pulse">Generating...</span>
                        )}
                        {message.error && <span className="text-red-200">(Error)</span>}
                      </div>
                      {/* 内联编辑区域 */}
                      {candidateStates[message.id]?.isEditing ? (
                        <textarea
                          value={candidateStates[message.id]?.text ?? message.text}
                          onChange={(e) => setCandidateStates(prev => ({
                            ...prev,
                            [message.id]: { isEditing: true, text: e.target.value }
                          }))}
                          className="w-full mt-1 p-2 bg-white/10 border border-white/30 rounded-md text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/40"
                          rows={3}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-white select-text text-sm">
                          {candidateStates[message.id]?.text ?? message.text}
                          {message.isStreaming && (
                            <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                          )}
                        </div>
                      )}
                      {!message.isStreaming && !message.error && (
                        <div className="mt-2 flex space-x-2">
                          {candidateStates[message.id]?.isEditing ? (
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { ...(prev[message.id] || {}), isEditing: false }
                              }))}
                              className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded-md border border-white/30"
                            >
                              Finish Editing
                            </button>
                          ) : (
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { isEditing: true, text: prev[message.id]?.text ?? message.text }
                              }))}
                              className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded-md border border-white/30"
                            >
                              Edit & Modify
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (!onSendToProblem) return
                              const candidateText = candidateStates[message.id]?.text ?? message.text
                              const finalText = (candidateText || '').trim()
                              if (!finalText) return
                              onSendToProblem({ text: finalText, timestamp: new Date().toISOString() })
                            }}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md"
                          >
                            Send Directly
                          </button>
                          <button
                            onClick={() => {
                              setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { ...(prev[message.id] || {}), showNegotiation: true }
                              }))
                            }}
                            className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                          >
                            Negotiate
                          </button>
                        </div>
                      )}
                      {candidateStates[message.id]?.showNegotiation && (
                        <div className="mt-2 bg-white/10 border border-white/30 rounded-md p-2">
                          <textarea
                            value={candidateStates[message.id]?.nego || ''}
                            onChange={(e) => setCandidateStates(prev => ({
                              ...prev,
                              [message.id]: { ...(prev[message.id] || {}), nego: e.target.value }
                            }))}
                            placeholder="说明希望如何调整这条智能追问..."
                            className="w-full p-2 bg-transparent text-white placeholder-white/70 border border-white/30 rounded mb-2 text-xs resize-none"
                            rows={3}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={async () => {
                                const negotiationText = (candidateStates[message.id]?.nego || '').trim()
                                if (!negotiationText || candidateStates[message.id]?.negoSubmitting) return
                                setCandidateStates(prev => ({
                                  ...prev,
                                  [message.id]: { ...(prev[message.id] || {}), negoSubmitting: true }
                                }))
                                try {
                                  if (typeof onSendIntelligentFollowUpNegotiationRequest === 'function') {
                                    await onSendIntelligentFollowUpNegotiationRequest(message.id, negotiationText, (newText) => {
                                      setCandidateStates(prev => ({
                                        ...prev,
                                        [message.id]: { ...(prev[message.id] || {}), showNegotiation: false, nego: '', text: newText }
                                      }))
                                    })
                                  }
                                } catch (e) {
                                  console.error('Send Negotiation失败:', e)
                                } finally {
                                  setCandidateStates(prev => ({
                                    ...prev,
                                    [message.id]: { ...(prev[message.id] || {}), negoSubmitting: false }
                                  }))
                                }
                              }}
                              disabled={!((candidateStates[message.id]?.nego || '').trim()) || candidateStates[message.id]?.negoSubmitting}
                              className={`px-2 py-1 text-xs rounded-md text-white ${candidateStates[message.id]?.negoSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                            >
                              {candidateStates[message.id]?.negoSubmitting ? (
                                <span className="inline-flex items-center space-x-1">
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  <span>Generating...</span>
                                </span>
                              ) : (
                                'Send Negotiation'
                              )}
                            </button>
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { ...(prev[message.id] || {}), showNegotiation: false }
                              }))}
                              disabled={candidateStates[message.id]?.negoSubmitting}
                              className={`px-2 py-1 text-xs text-white rounded-md ${candidateStates[message.id]?.negoSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600'}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-purple-100 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 新增：候选客户回复气泡 */}
            {message.type === 'customer_reply_candidate' && (
              <div className="flex items-start justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.92) 0%, rgba(37, 99, 235, 0.88) 100%)',
                  color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <Bot className="w-4 h-4 text-blue-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-blue-100 mb-1 opacity-90 flex items-center space-x-1">
                        <span>📝 Customer Reply Draft</span>
                        {message.isStreaming && (
                          <span className="text-green-200 animate-pulse">Generating...</span>
                        )}
                        {message.error && <span className="text-red-200">(Error)</span>}
                      </div>
                      {/* 内联编辑区域 */}
                      {candidateStates[message.id]?.isEditing ? (
                        <textarea
                          value={candidateStates[message.id]?.text ?? message.text}
                          onChange={(e) => setCandidateStates(prev => ({
                            ...prev,
                            [message.id]: { isEditing: true, text: e.target.value }
                          }))}
                          className="w-full mt-1 p-2 bg-white/10 border border-white/30 rounded-md text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/40"
                          rows={4}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-white select-text text-sm">
                          {candidateStates[message.id]?.text ?? message.text}
                          {message.isStreaming && (
                            <span className="ml-1 inline-block w-2 h-5 bg-white opacity-75 animate-pulse align-text-bottom"></span>
                          )}
                        </div>
                      )}
                      {!message.isStreaming && !message.error && (
                        <div className="mt-2 flex space-x-2">
                          {candidateStates[message.id]?.isEditing ? (
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { ...(prev[message.id] || {}), isEditing: false }
                              }))}
                              className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded-md border border-white/30"
                            >
                              Finish Editing
                            </button>
                          ) : (
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { isEditing: true, text: prev[message.id]?.text ?? message.text }
                              }))}
                              className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded-md border border-white/30"
                            >
                              Edit & Modify
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (!onSendToProblem) return
                              const candidateText = candidateStates[message.id]?.text ?? message.text
                              const finalText = (candidateText || '').trim()
                              if (!finalText) return
                              onSendToProblem({ text: finalText, timestamp: new Date().toISOString() })
                            }}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md"
                          >
                            Send Directly
                          </button>
                          <button
                            onClick={() => setCandidateStates(prev => ({
                              ...prev,
                              [message.id]: { ...(prev[message.id] || {}), showReplyNegotiation: true }
                            }))}
                            className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                          >
                            Negotiate
                          </button>
                        </div>
                      )}
                      {candidateStates[message.id]?.showReplyNegotiation && (
                        <div className="mt-2 bg-white/10 border border-white/30 rounded-md p-2">
                          <textarea
                            value={candidateStates[message.id]?.replyNego || ''}
                            onChange={(e) => setCandidateStates(prev => ({
                              ...prev,
                              [message.id]: { ...(prev[message.id] || {}), replyNego: e.target.value }
                            }))}
                            placeholder="Describe how you'd like to adjust this customer reply..."
                            className="w-full p-2 bg-transparent text-white placeholder-white/70 border border-white/30 rounded mb-2 text-xs resize-none"
                            rows={3}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={async () => {
                                const negotiationText = (candidateStates[message.id]?.replyNego || '').trim()
                                if (!negotiationText || candidateStates[message.id]?.replySubmitting) return
                                setCandidateStates(prev => ({
                                  ...prev,
                                  [message.id]: { ...(prev[message.id] || {}), replySubmitting: true }
                                }))
                                try {
                                  if (typeof onNegotiateCustomerReplyCandidate === 'function') {
                                    await onNegotiateCustomerReplyCandidate(message.id, negotiationText, (newText) => {
                                      setCandidateStates(prev => ({
                                        ...prev,
                                        [message.id]: { ...(prev[message.id] || {}), showReplyNegotiation: false, replyNego: '', text: newText }
                                      }))
                                    })
                                  }
                                } catch (e) {
                                  console.error('客户回复协商失败:', e)
                                } finally {
                                  setCandidateStates(prev => ({
                                    ...prev,
                                    [message.id]: { ...(prev[message.id] || {}), replySubmitting: false }
                                  }))
                                }
                              }}
                              disabled={!((candidateStates[message.id]?.replyNego || '').trim()) || candidateStates[message.id]?.replySubmitting}
                              className={`px-2 py-1 text-xs rounded-md text-white ${candidateStates[message.id]?.replySubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                            >
                              {candidateStates[message.id]?.replySubmitting ? (
                                <span className="inline-flex items-center space-x-1">
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  <span>Generating...</span>
                                </span>
                              ) : (
                                'Send Negotiation'
                              )}
                            </button>
                            <button
                              onClick={() => setCandidateStates(prev => ({
                                ...prev,
                                [message.id]: { ...(prev[message.id] || {}), showReplyNegotiation: false }
                              }))}
                              disabled={candidateStates[message.id]?.replySubmitting}
                              className={`px-2 py-1 text-xs text-white rounded-md ${candidateStates[message.id]?.replySubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600'}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-blue-100 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 处理状态指示 */}
        {(isProcessing || iterationProcessing || aiProcessing) && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm" style={{
              background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.9) 0%, rgba(107, 114, 128, 0.85) 100%)',
              color: 'white'
            }}>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 缺失信息选择面板 */}
      {showMissingInfoPanel && (
        <AnimatedTransition type="slide-up" show={true}>
          <div className="p-4 border-t border-white/20 dark:border-white/10" style={{
            background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.08) 0%, rgba(251, 191, 36, 0.06) 100%)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            border: '1px solid rgba(251, 146, 60, 0.2)',
            borderRadius: '12px'
          }}>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">Select Information to Inquire</span>
              </div>
              
              <p className="text-xs text-orange-700 dark:text-orange-300">
                AI analysis has identified the following information that can be collected to provide more precise service. Please select the information points you wish to inquire about:
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {missingInfoOptions.map((option, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      option.selected 
                        ? 'border-orange-300 bg-orange-100 dark:bg-orange-900/30' 
                        : 'border-gray-200 bg-white dark:bg-gray-800 hover:border-orange-200'
                    }`}
                    onClick={() => onToggleMissingInfoOption && onToggleMissingInfoOption(index)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        option.selected 
                          ? 'border-orange-500 bg-orange-500' 
                          : 'border-gray-300'
                      }`}>
                        {option.selected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {option.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    console.log('🔄 生成追问按钮被点击')
                    if (iterationProcessing) {
                      console.log('⚠️ Processing, ignoring click')
                      return
                    }
                    onGenerateFollowUpBySelectedInfo()
                  }}
                  disabled={iterationProcessing || !missingInfoOptions.some(opt => opt.selected)}
                  className="flex-1 btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
                >
                  {iterationProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Generate Follow-up ({missingInfoOptions.filter(opt => opt.selected).length})</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={onSkipInfoCollection}
                  disabled={iterationProcessing}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Skip</span>
                </button>
              </div>
            </div>
          </div>
        </AnimatedTransition>
      )}

             {/* 底部输入区域 - ChatGPT风格 */}
       <div className="p-4 border-t border-white/20 dark:border-white/10 glass-effect rounded-b-2xl flex-shrink-0" style={{
         background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.08) 0%, rgba(241, 245, 249, 0.05) 100%)',
         backdropFilter: 'blur(20px) saturate(1.3)',
         WebkitBackdropFilter: 'blur(20px) saturate(1.3)'
       }}>
        {/* AI快捷功能按钮 - 已隐藏 */}
        {false && (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2">
              {aiActions.map((action) => {
                const IconComponent = action.icon
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAIAction(action.id)}
                    disabled={aiProcessing || isProcessing || iterationProcessing}
                    className={`p-2 rounded-xl bg-gradient-to-r ${action.color} ${action.hoverColor} border ${action.borderColor} transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <IconComponent className="w-4 h-4" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 交流模式控制 - 移到输入框上方 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-2">
            {/* 三种交流模式按钮 */}
            <div className="flex space-x-1">
              {/* Mode 1: Normal */}
              <button
                onClick={() => onSwitchChatMode && onSwitchChatMode('normal')}
                disabled={aiProcessing || isProcessing}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  chatMode === 'normal' 
                    ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border-2 border-blue-500/50 shadow-lg' 
                    : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:from-blue-500/20 hover:to-cyan-500/20'
                }`}
                title="Normal chat"
              >
                <div className="flex flex-col items-center space-y-1">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Normal
                  </div>
                </div>
              </button>

              {/* Mode 2: Department */}
              <button
                onClick={() => onSwitchChatMode && onSwitchChatMode('department')}
                disabled={aiProcessing || isProcessing}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  chatMode === 'department' 
                    ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-2 border-green-500/50 shadow-lg' 
                    : 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 hover:from-green-500/20 hover:to-emerald-500/20'
                }`}
                title="Department contact"
              >
                <div className="flex flex-col items-center space-y-1">
                  <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <div className="text-xs font-medium text-green-700 dark:text-green-300">
                    Contact
                  </div>
                </div>
              </button>

              {/* Mode 3: Emergency */}
              <button
                onClick={() => onSwitchChatMode && onSwitchChatMode('emergency')}
                disabled={aiProcessing || isProcessing}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  chatMode === 'emergency' 
                    ? 'bg-gradient-to-r from-red-500/30 to-orange-500/30 border-2 border-red-500/50 shadow-lg' 
                    : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 hover:from-red-500/20 hover:to-orange-500/20'
                }`}
                title="Emergency escalation"
              >
                <div className="flex flex-col items-center space-y-1">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <div className="text-xs font-medium text-red-700 dark:text-red-300">
                    Emergency
                  </div>
                </div>
              </button>
            </div>

            {/* 当前模式提示 */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs ml-4" style={{
              background: chatMode === 'normal' ? 'rgba(59, 130, 246, 0.1)' : 
                         chatMode === 'department' ? 'rgba(34, 197, 94, 0.1)' : 
                         'rgba(239, 68, 68, 0.1)',
              color: chatMode === 'normal' ? 'rgb(37, 99, 235)' : 
                     chatMode === 'department' ? 'rgb(21, 128, 61)' : 
                     'rgb(185, 28, 28)'
            }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{
                background: chatMode === 'normal' ? 'rgb(59, 130, 246)' : 
                           chatMode === 'department' ? 'rgb(34, 197, 94)' : 
                           'rgb(239, 68, 68)'
              }}></div>
              <span>
                Current: {chatMode === 'normal' ? 'Normal' : chatMode === 'department' ? 'Contact' : 'Emergency'}
              </span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2">
            {input.length > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-600 dark:text-blue-300">
                {input.length} characters
              </span>
            )}
          </div>
        </div>

        {/* 聊天输入框和按钮 */}
        <div className="flex space-x-3">
          {/* 输入框 */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="💬 Type a message... ask AI assistant or reply to customer"
            className="flex-1 p-3 border border-blue-200 dark:border-blue-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/30 dark:text-blue-100 text-sm transition-all duration-200"
            rows={3}
            disabled={aiProcessing || isProcessing}
            style={{
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            }}
          />
          
          {/* 右侧按钮组 */}
          <div className="flex flex-col space-y-2">
            {/* 询问AI按钮 */}
            <button
              onClick={() => handleAIAction('chat')}
              disabled={!input.trim() || aiProcessing || isProcessing}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg min-w-[100px]"
              title={aiProcessing ? "AI is thinking..." : "Send message to ask AI"}
            >
              {aiProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium">Thinking</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span className="text-xs font-medium">Ask AI</span>
                </>
              )}
            </button>

            {/* 回复客户按钮 */}
            <button
              onClick={() => {
                if (!input.trim() || !onSendToProblem) return
                const messageToSend = {
                  text: input.trim(),
                  timestamp: new Date().toISOString(),
                  type: 'direct_reply',
                  source: 'ai_collaboration'
                }
                onSendToProblem(messageToSend)
                setInput('') // 发送后清空输入框
              }}
              disabled={!input.trim() || isProcessing}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg min-w-[100px]"
              title="Send directly to customer without AI translation"
            >
              <User className="w-4 h-4" />
              <span className="text-xs font-medium">Reply to customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* 紧急模式弹窗 */}
      {emergencyModalVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => onCloseModeModal && onCloseModeModal('emergency')}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-[90%] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Emergency Handling</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Urgency Level
                </label>
                <select
                  value={emergencyLevel}
                  onChange={(e) => setEmergencyLevel(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="urgent">Urgent - Requires priority handling</option>
                  <option value="high">High - Important but not urgent</option>
                  <option value="critical">Critical - Report to management immediately</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={emergencyDescription}
                  onChange={(e) => setEmergencyDescription(e.target.value)}
                  placeholder="Please describe the emergency in detail..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    if (emergencyDescription.trim() && onHandleEmergencyMode) {
                      // 立即关闭模态框，清空输入，但保持紧急模式状态
                      const description = emergencyDescription.trim()
                      const level = emergencyLevel
                      setEmergencyDescription('')
                      setEmergencyLevel('urgent')
                      // 使用新的函数只关闭模态框，保持紧急状态
                      onCloseEmergencyModalOnly && onCloseEmergencyModalOnly()
                      
                      // 然后执行紧急处理，但不等待结果
                      onHandleEmergencyMode(level, description).catch(error => {
                        console.error('Error handling emergency:', error)
                      })
                    }
                  }}
                  disabled={!emergencyDescription.trim()}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Submit Emergency Request</span>
                </button>
                
                <button
                  onClick={() => {
                    setEmergencyDescription('')
                    setEmergencyLevel('urgent')
                    onCloseModeModal && onCloseModeModal('emergency')
                  }}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SolutionPanel
