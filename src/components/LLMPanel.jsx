import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Bot, Sparkles, Lightbulb, Zap, Layers, Filter, ArrowRight, MessageSquare, CheckCircle, XCircle, AlertCircle, MessageCircle, Send, Users, Check, Pause, Play, Edit3 } from 'lucide-react'
import { LLMProcessingLoader, TypingLoader } from './LoadingStates'
import AnimatedTransition from './AnimatedTransition'

const LLMPanel = ({ 
  processing, 
  messages, 
  onGenerateSuggestion,
  onGenerateFollowUp,
  onGenerateIntelligentFollowUp,
  onGenerateNeedsAnalysis,
  onGenerateDepartmentContact,
  onGenerateDepartmentContactOnly,
  onChatWithAI,
  onAcceptSuggestion,
  onNegotiateSuggestion,
  onRejectSuggestion,
  onAcceptFollowUp,
  onNegotiateFollowUp,
  onRejectFollowUp,
  onSendToSolution,
  onSendToProblem,
  onSetSolutionInput,
  onCancelIteration,
  currentScenario,
  // 新增协商相关功能
  onCancelNegotiation,
  onSendNegotiationRequest,
  onCancelFollowUpNegotiation,
  onSendFollowUpNegotiationRequest,
  // 新增：直发候选准备（用于应用客户回复走确认机制）
  onPrepareDirectSendCandidate,
  // 缺失信息选择面板已迁移到协作工作台
  // 新增：流式显示相关状态
  thinkingContent,
  answerContent,
  isStreaming,
  // 新增：AI推理干预相关状态和回调
  isPaused,
  onPauseAI,
  onResumeAI,
  onAdjustAI,
  // 冲突检测参数
  showMissingInfoPanel,
}) => {
  const messagesEndRef = useRef(null)
  const [currentMode, setCurrentMode] = useState('analysis') // 'analysis', 'suggestion', 'followup', 'response'
  const [messageStates, setMessageStates] = useState({}) // 跟踪每个消息的状态
  
  // AI推理干预相关状态
  const [showAdjustmentInput, setShowAdjustmentInput] = useState(false)
  const [adjustmentText, setAdjustmentText] = useState('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 关闭自动滚动：生成内容后保持视图位置不变
  useEffect(() => {
    // no-op to prevent auto scroll on messages update
  }, [messages])



  // 协商面板组件
  const NegotiationPanel = ({ messageId, messageType, onSendNegotiation, onCancel }) => {
    const [negotiationText, setNegotiationText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSendNegotiation = async () => {
      if (!negotiationText.trim() || isSubmitting) return
      
      console.log('🔄 Send negotiation request:', { messageId, negotiationText, messageType })
      setIsSubmitting(true)
      try {
        await onSendNegotiation(messageId, negotiationText)
        setNegotiationText('')
        console.log('✅ 协商请求发送成功')
      } catch (error) {
        console.error('❌ Send negotiation request failed:', error)
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
        <div className="flex items-center space-x-2 mb-2">
          <MessageCircle className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Negotiation Mode</span>
        </div>
        <div className="space-y-2">
          <textarea
            value={negotiationText}
            onChange={(e) => setNegotiationText(e.target.value)}
            placeholder={`Describe how you'd like to adjust this ${messageType === 'suggestion' ? 'suggestion' : 'follow-up'}...`}
            className="w-full p-2 text-sm border border-blue-200 dark:border-blue-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/30 dark:text-blue-100"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex space-x-2">
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSendNegotiation}
              disabled={!negotiationText.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send negotiation'}
            </button>
            <button
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
              onClick={() => onCancel(messageId)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 流式思考窗口组件
  const ThinkingStreamWindow = () => {
    const thinkingRef = useRef(null)
    
    useEffect(() => {
      if (thinkingRef.current) {
        thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight
      }
    }, [thinkingContent])

    const handlePause = () => {
      onPauseAI && onPauseAI()
      setShowAdjustmentInput(true)
    }

    const handleAdjustment = () => {
      if (adjustmentText.trim()) {
        onAdjustAI && onAdjustAI(adjustmentText.trim())
        setAdjustmentText('')
        setShowAdjustmentInput(false)
      }
    }

    const handleCancelAdjustment = () => {
      setShowAdjustmentInput(false)
      setAdjustmentText('')
      onResumeAI && onResumeAI()
    }

    return (
      <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/90 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-700/50 rounded-xl p-4 glass-effect flex flex-col" 
           style={{ maxHeight: 'calc(100vh - 300px)', height: 'auto' }}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-purple-500 animate-pulse'}`}></div>
            <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200">🧠 AI Thinking</h4>
            {isStreaming && !isPaused && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            )}
            {isPaused && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Paused</span>
            )}
          </div>
          
          {/* 控制按钮 */}
          <div className="flex space-x-2">
            {false && isStreaming && !isPaused && (
              <button
                onClick={handlePause}
                className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded-lg transition-all duration-200 group"
                title="Pause AI reasoning"
              >
                <Pause className="w-4 h-4 text-yellow-600 group-hover:text-yellow-700" />
              </button>
            )}
            {isPaused && !showAdjustmentInput && (
              <button
                onClick={() => setShowAdjustmentInput(true)}
                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg transition-all duration-200 group"
                title="Give adjustment"
              >
                <Edit3 className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
              </button>
            )}
            {isPaused && !showAdjustmentInput && (
              <button
                onClick={() => onResumeAI && onResumeAI()}
                className="p-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg transition-all duration-200 group"
                title="Resume AI reasoning"
              >
                <Play className="w-4 h-4 text-green-600 group-hover:text-green-700" />
              </button>
            )}
          </div>
        </div>

        {/* 调整建议输入框 */}
        {showAdjustmentInput && (
          <div className="mb-3 p-3 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-lg flex-shrink-0">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Adjustment for AI
            </div>
            <textarea
              value={adjustmentText}
              onChange={(e) => setAdjustmentText(e.target.value)}
              placeholder="Describe the issue in reasoning and how to improve..."
              className="w-full p-2 text-sm border border-blue-200 dark:border-blue-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/30 dark:text-blue-100"
              rows={3}
              autoFocus
            />
            <div className="flex space-x-2 mt-2">
              <button
                onClick={handleAdjustment}
                disabled={!adjustmentText.trim()}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
              <button
                onClick={handleCancelAdjustment}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div 
          ref={thinkingRef}
          className="flex-1 overflow-y-auto bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 backdrop-blur-sm border border-purple-200/30 dark:border-purple-700/30"
          style={{ 
            minHeight: '200px',
            maxHeight: 'calc(100vh - 450px)', // 限制最大高度，确保在面板底部被触碰时能滚动
            height: 'auto'
          }}
        >
          {thinkingContent ? (
            <div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap font-mono leading-relaxed">
              {thinkingContent}
              {isStreaming && !isPaused && <span className="animate-pulse text-purple-500">|</span>}
              {isPaused && <span className="text-yellow-500">⏸️</span>}
            </div>
          ) : (
            <div className="text-sm text-purple-500 dark:text-purple-400 italic">
              Waiting for AI to start thinking...
            </div>
          )}
        </div>
      </div>
    )
  }

  // 流式回答窗口组件
  const AnswerStreamWindow = () => {
    const answerRef = useRef(null)
    
    useEffect(() => {
      if (answerRef.current) {
        answerRef.current.scrollTop = answerRef.current.scrollHeight
      }
    }, [answerContent])

    return (
      <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/90 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/50 rounded-xl p-4 glass-effect">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">💬 AI Answer</h4>
          {isStreaming && (
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          )}
        </div>
        <div 
          ref={answerRef}
          className="h-48 overflow-y-auto bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 backdrop-blur-sm border border-emerald-200/30 dark:border-emerald-700/30"
          style={{ minHeight: '192px' }}
        >
          {answerContent ? (
            <div className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
              {answerContent}
              {isStreaming && <span className="animate-pulse text-emerald-500">|</span>}
            </div>
          ) : (
            <div className="text-sm text-emerald-500 dark:text-emerald-400 italic">
              Waiting for AI to answer...
            </div>
          )}
        </div>
      </div>
    )
  }

  // AI控制面板组件
  const AIControlPanel = () => {
    const [showControls, setShowControls] = useState(false)
    const [aiInput, setAiInput] = useState('')
    const [aiChatProcessing, setAiChatProcessing] = useState(false)
    const aiInputRef = useRef(null)

    // 当AI控制台展开时，聚焦到输入框
    useEffect(() => {
      if (showControls && aiInputRef.current) {
        setTimeout(() => {
          aiInputRef.current.focus()
        }, 150)
      }
    }, [showControls])

    const handleGenerateAction = (actionType) => {
      setCurrentMode(actionType)
      switch(actionType) {
        case 'suggestion':
          onGenerateSuggestion && onGenerateSuggestion()
          break
        case 'followup':
          // 禁用：右侧控制台不再触发追问生成
          console.log('⚠️ Follow-up generation is disabled in AI Console')
          break
        case 'intelligent_followup':
          // 禁用：右侧控制台不再触发智能追问生成
          console.log('⚠️ Intelligent follow-up generation is disabled in AI Console')
          break
        case 'needs_analysis':
          onGenerateNeedsAnalysis && onGenerateNeedsAnalysis()
          break
        case 'department':
          // 部门联络需要基于最近的建议或对话内容
          const recentContent = messages.find(msg => msg.title.includes('建议'))?.output || 
                               messages.slice(-1)[0]?.output || 
                               '基于当前对话生成联络指令'
          onGenerateDepartmentContactOnly && onGenerateDepartmentContactOnly(recentContent)
          break
        default:
          break
      }
    }

    const handleChatWithAI = useCallback(async () => {
      if (aiInput.trim() && onChatWithAI) {
        setAiChatProcessing(true)
        try {
          await onChatWithAI(aiInput.trim())
          setAiInput('')
        } catch (error) {
          console.error('AI对话出错:', error)
        } finally {
          setAiChatProcessing(false)
        }
      }
    }, [aiInput, onChatWithAI])

    return (
      <div className="space-y-4">
        {/* AI功能选择区域 - 2x2 排列 - 已隐藏 */}
        {false && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleGenerateAction('suggestion')}
              disabled={processing}
              className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">生成建议</span>
              </div>
            </button>

            <button
              onClick={() => handleGenerateAction('intelligent_followup')}
              disabled={processing}
              className="p-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">智能追问</span>
              </div>
            </button>

            <button
              onClick={() => handleGenerateAction('department')}
              disabled={processing}
              className="p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">部门联络</span>
              </div>
            </button>

            {false && (
              <button
                onClick={() => handleGenerateAction('needs_analysis')}
                disabled={processing}
                className="p-3 rounded-xl bg-gradient-to-r from-teal-500/20 to-cyan-500/20 hover:from-teal-500/30 hover:to-cyan-500/30 border border-teal-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-medium text-teal-700 dark:text-teal-300">需求分析</span>
                </div>
              </button>
            )}

            <button
              onClick={() => setShowControls(!showControls)}
              className="p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 transition-all duration-200 hover:scale-105"
            >
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">询问AI</span>
              </div>
            </button>
          </div>
        )}

        {/* 展开的AI控制台 */}
        {showControls && (
          <div key="ai-controls-panel" className="p-4 rounded-xl bg-gradient-to-r from-gray-50/80 to-slate-100/80 dark:from-gray-800/80 dark:to-slate-800/80 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-in-out">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <span>Ask AI</span>
              </div>
              
              <div key="ai-input-container" className="relative">
                <textarea
                  ref={aiInputRef}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Type your question for AI..."
                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  style={{ minHeight: '80px' }}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleChatWithAI}
                  disabled={!aiInput.trim() || aiChatProcessing}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {aiChatProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Asking...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>Ask AI</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setAiInput('')}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const getProcessingIcon = (title) => {
    if (title.includes('问题端')) {
      return <Layers className="w-4 h-4 text-blue-600" />
    } else if (title.includes('方案端')) {
      return <Zap className="w-4 h-4 text-green-600" />
    } else if (title.includes('建议')) {
      return <Lightbulb className="w-4 h-4 text-purple-600" />
    } else if (title.includes('追问')) {
      return <Filter className="w-4 h-4 text-orange-600" />
    } else if (title.includes('需求分析')) {
      return <Zap className="w-4 h-4 text-teal-600" />
    } else if (title.includes('部门联络') || title.includes('联络指令') || title.includes('客户回复和部门联络') || title.includes('生成部门联络')) {
      return <Users className="w-4 h-4 text-green-600" />
    } else if (title.includes('AI对话')) {
      return <MessageCircle className="w-4 h-4 text-blue-600" />
    } else if (title.includes('最终')) {
      return <ArrowRight className="w-4 h-4 text-indigo-600" />
    }
    return <Bot className="w-4 h-4 text-gray-600" />
  }

  const getProcessingStatus = (title) => {
    const t = title || ''
    if (t.includes('问题端') || t.toLowerCase().includes('problem')) {
      return 'Analyzing customer needs...'
    } else if (t.includes('方案端') || t.toLowerCase().includes('solution')) {
      return 'Optimizing reply...'
    } else if (t.includes('建议') || t.toLowerCase().includes('suggestion')) {
      return 'Generating suggestion...'
    } else if (t.includes('追问') || t.toLowerCase().includes('follow-up')) {
      return 'Generating follow-up question...'
    } else if (t.includes('需求分析') || t.toLowerCase().includes('needs analysis') || t.toLowerCase().includes('intelligent needs analysis')) {
      return 'Analyzing user needs...'
    } else if (
      t.includes('部门联络') ||
      t.includes('联络指令') ||
      t.includes('客户回复和部门联络') ||
      t.includes('生成部门联络') ||
      t.toLowerCase().includes('department contact') ||
      t.toLowerCase().includes('contact instruction')
    ) {
      return 'Generating contact instructions...'
    } else if (t.includes('AI对话') || t.toLowerCase().includes('ai chat')) {
      return 'Chatting with AI...'
    } else if (t.includes('最终') || t.toLowerCase().includes('final')) {
      return 'Processing final reply...'
    }
    return 'Processing...'
  }

  return (
    <div className="h-full flex flex-col glass-effect rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
      backdropFilter: 'blur(20px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      height: 'calc(100vh - 200px)' // 统一高度设置
    }}>
      {/* Header */}
      <div className="p-4 border-b border-white/20 dark:border-white/10 glass-effect rounded-t-2xl flex-shrink-0" style={{background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(99, 102, 241, 0.12) 100%)', backdropFilter: 'blur(20px) saturate(1.3)'}}>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/90 to-indigo-600/90 rounded-2xl backdrop-blur-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">AI Console</h3>
            {/* 隐藏副标题 */}
            {false && (
              <p className="text-sm text-gray-600 dark:text-gray-300">智能分析和方案生成</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area - 启用滚动 */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 min-h-0" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(248, 250, 252, 0.01) 100%)',
        backdropFilter: 'blur(10px) saturate(1.1)'
      }}>
        {/* 空状态显示 - 只在没有任何内容和处理状态时显示 */}
        {messages.length === 0 && !processing && !isStreaming && !thinkingContent && !answerContent && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 space-y-6">
            <AnimatedTransition type="fade" show={true}>
              <div className="p-6 rounded-full shadow-inner div-with-background">
                <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
            </AnimatedTransition>
            <div className="space-y-2">
              <p className="text-xl font-semibold">AI Console</p>
              {/* 隐藏中部说明文字 */}
              {false && (
                <p className="text-sm text-gray-400">所有AI智能功能的统一控制台</p>
              )}
            </div>
            
            {/* AI功能控制面板 */}
            <div className="w-full max-w-md">
              <AIControlPanel />
            </div>
          </div>
        )}
        
        {/* 内容显示区域 - 一旦有内容就隐藏logo，显示内容 */}
        {(messages.length > 0 || processing || isStreaming || thinkingContent || answerContent) && (
          <div className="h-full flex flex-col space-y-4">
            
            {/* 流式显示窗口 - 始终在顶部位置 */}
            {/* 显示思考过程窗口，隐藏回答窗口 */}
            {(isStreaming || thinkingContent || answerContent) && (
              <div className="space-y-4">
                {/* 显示AI思考过程窗口 */}
                {thinkingContent && (
                  <AnimatedTransition type="slide-up" show={true}>
                    <ThinkingStreamWindow />
                  </AnimatedTransition>
                )}
                {/* Hide AI answer generation window */}
                {false && answerContent && (
                  <AnimatedTransition type="slide-up" show={true} delay={100}>
                    <AnswerStreamWindow />
                  </AnimatedTransition>
                )}
              </div>
            )}

            {/* AI控制面板 - 始终显示 */}
            <AnimatedTransition type="fade" show={true}>
              <div className="p-4 glass-effect div-with-background rounded-xl">
                <AIControlPanel />
              </div>
            </AnimatedTransition>

            {/* 处理状态显示 */}
          <AnimatedTransition type="fade" show={true}>
              <div className="p-4 glass-effect div-with-background rounded-xl">
              <div className="flex items-center space-x-3">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {processing ? (
                      <>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-sm text-purple-700 dark:text-purple-300">AI processing...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-purple-700 dark:text-purple-300">AI idle</span>
                      </>
                    )}
                  </div>
                  {messages.length > 0 && (
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Processed {messages.length} requests
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AnimatedTransition>

            {/* 缺失信息勾选面板已迁移到协作工作台 */}

            {/* 消息历史显示 */}
            <div className="space-y-3">
              {(() => {
                const filteredMessages = messages.filter(m => {
                  const t = m?.title || ''
                  const lower = t.toLowerCase()
                  // 屏蔽所有“追问/智能追问/Follow-up”相关的控制台项
                  const isFollowUpRelated = t.includes('追问') || lower.includes('follow-up') || lower.includes('intelligent follow-up')
                  const isExplicitExcluded = lower.includes('generate intelligent follow-up') || lower.includes('negotiate intelligent follow-up')
                  return !(isFollowUpRelated || isExplicitExcluded)
                })
                return [...filteredMessages].reverse().map((message, reverseIndex) => {
                  const index = filteredMessages.length - 1 - reverseIndex // 基于过滤后的索引
                  return (
                    <AnimatedTransition key={`${index}-${message.timestamp}`} type="slide-up" show={true}>
                      <div className="p-4 glass-effect div-with-background rounded-xl">
                        <div className="flex items-start space-x-3">
                          {getProcessingIcon(message.title)}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                              {message.title}
                            </div>
                            {/* No longer display steps and generic AI generated content, only keep specific type bubble displays */}
                            
                            {/* 如果是建议类型，显示建议内容和操作按钮 */}
                            {message.title.includes('建议') && message.output && (
                              <div className="mt-3">
                                {/* 建议内容显示 */}
                                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 mb-3">
                                  <div className="text-sm text-purple-800 dark:text-purple-200">
                                    {messageStates[`${index}_suggestion`]?.negotiating ? (
                                      <div className="flex items-center space-x-2">
                                        <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                                        <span>Negotiating...</span>
                                      </div>
                                    ) : (
                                      messageStates[`${index}_suggestion`]?.negotiatedContent || message.output
                                    )}
                                  </div>
                                </div>
                                
                                {messageStates[`${index}_suggestion`]?.accepted ? (
                                  <div className="space-y-2">
                                    <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1 rounded">
                                      ✓ 已接受建议
                                    </div>
                                    {/* 接受建议后的部门联络指令按钮 */}
                                    <button
                                      onClick={() => {
                                        const finalContent = messageStates[`${index}_suggestion`]?.negotiatedContent || message.output
                                        onGenerateDepartmentContact && onGenerateDepartmentContact(finalContent)
                                      }}
                                      className="w-full px-4 py-3 text-white rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm font-medium hover:scale-105"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
                                        backdropFilter: 'blur(10px) saturate(1.3)',
                                        WebkitBackdropFilter: 'blur(10px) saturate(1.3)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                      }}
                                      title="生成客户回复和部门联络指令"
                                      disabled={processing}
                                    >
                                      <Users className="w-4 h-4" />
                                      <span>生成客户回复和部门联络指令</span>
                                      {processing && <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin ml-1"></div>}
                                    </button>
                                  </div>
                                ) : messageStates[`${index}_suggestion`]?.showNegotiation ? (
                                  <NegotiationPanel 
                                    messageId={`${index}_suggestion`}
                                    messageType="suggestion"
                                    onSendNegotiation={async (messageId, text) => {
                                      // 立即设置协商中状态
                                      setMessageStates(prev => ({
                                        ...prev,
                                        [messageId]: { 
                                          ...prev[messageId], 
                                          negotiating: true 
                                        }
                                      }))
                                      
                                      // Send negotiation request
                                      try {
                                        onSendNegotiationRequest && await onSendNegotiationRequest(messageId, text, (newContent) => {
                                          // 更新协商后的内容，覆盖原来的显示
                                          setMessageStates(prev => ({
                                            ...prev,
                                            [messageId]: { 
                                              ...prev[messageId], 
                                              negotiating: false, 
                                              showNegotiation: false,
                                              negotiated: true,
                                              negotiatedContent: newContent 
                                            }
                                          }))
                                        })
                                      } catch (error) {
                                        console.error('协商请求失败:', error)
                                        // 发生错误时重置协商状态
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [messageId]: { 
                                            ...prev[messageId], 
                                            negotiating: false,
                                            showNegotiation: false
                                          }
                                        }))
                                      }
                                    }}
                                    onCancel={(messageId) => {
                                      onCancelNegotiation && onCancelNegotiation(messageId)
                                      setMessageStates(prev => ({
                                        ...prev,
                                        [messageId]: { ...prev[messageId], showNegotiation: false }
                                      }))
                                    }}
                                  />
                                ) : messageStates[`${index}_suggestion`]?.negotiated ? (
                                  <div className="space-y-2">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                                      <div className="text-sm text-blue-800 dark:text-blue-200">
                                        ✓ Negotiated
                                      </div>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => {
                                          const finalContent = messageStates[`${index}_suggestion`]?.negotiatedContent || message.output
                                          onAcceptSuggestion && onAcceptSuggestion(finalContent)
                                          setMessageStates(prev => ({
                                            ...prev,
                                            [`${index}_suggestion`]: { accepted: true, negotiatedContent: finalContent }
                                          }))
                                        }}
                                        className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                      >
                                        <CheckCircle className="w-3 h-3" />
                                        <span>接受建议</span>
                                      </button>
                                      <button
                                        onClick={() => onRejectSuggestion && onRejectSuggestion(message.output)}
                                        className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                      >
                                        <XCircle className="w-3 h-3" />
                                        <span>重新生成</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        const finalContent = messageStates[`${index}_suggestion`]?.negotiatedContent || message.output
                                        onAcceptSuggestion && onAcceptSuggestion(finalContent)
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [`${index}_suggestion`]: { accepted: true, negotiatedContent: finalContent }
                                        }))
                                      }}
                                      className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      <span>采纳建议</span>
                                    </button>
                                    <button
                                      onClick={() => onRejectSuggestion && onRejectSuggestion(message.output)}
                                      className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>重新生成</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* 如果是追问类型，显示追问内容和操作按钮 */}
                            {message.title.includes('追问') && message.output && (
                              <div className="mt-3">
                                {/* 追问内容显示 */}
                                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 mb-3">
                                  <div className="text-sm text-orange-800 dark:text-orange-200">
                                    {messageStates[`${index}_followup`]?.negotiating ? (
                                      <div className="flex items-center space-x-2">
                                        <div className="animate-spin w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full"></div>
                                        <span>Negotiating...</span>
                                      </div>
                                    ) : (
                                      messageStates[`${index}_followup`]?.negotiatedContent || message.output
                                    )}
                                  </div>
                                </div>
                                
                                {messageStates[`${index}_followup`]?.accepted ? (
                                  <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1 rounded">
                                    ✓ 已接受追问（已填入输入框）
                                  </div>
                                ) : false ? (
                                  <div />
                                ) : messageStates[`${index}_followup`]?.negotiated ? (
                                  <div className="space-y-2">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                                      <div className="text-sm text-blue-800 dark:text-blue-200">
                                        ✓ Negotiated
                                      </div>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => {
                                          const finalText = messageStates[`${index}_followup`]?.negotiatedContent || message.output
                                          console.log('🔘 接受追问按钮被点击', { finalText, onSetSolutionInput: !!onSetSolutionInput })
                                          if (onSetSolutionInput) {
                                            console.log('📝 调用onSetSolutionInput:', finalText)
                                            onSetSolutionInput(finalText)
                                            onCancelIteration && onCancelIteration()
                                            console.log('🔄 已退出迭代模式')
                                          } else {
                                            console.error('❌ onSetSolutionInput未定义')
                                          }
                                          setMessageStates(prev => ({
                                            ...prev,
                                            [`${index}_followup`]: { accepted: true, negotiatedContent: finalText }
                                          }))
                                        }}
                                        className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                      >
                                        <CheckCircle className="w-3 h-3" />
                                        <span>接受追问</span>
                                      </button>
                                      <button
                                        onClick={() => onRejectFollowUp && onRejectFollowUp(message.output)}
                                        className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                      >
                                        <XCircle className="w-3 h-3" />
                                        <span>重新生成</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        const finalText = messageStates[`${index}_followup`]?.negotiatedContent || message.output
                                        console.log('🔘 采纳追问按钮被点击', { finalText, onSetSolutionInput: !!onSetSolutionInput })
                                        if (onSetSolutionInput) {
                                          console.log('📝 调用onSetSolutionInput:', finalText)
                                          onSetSolutionInput(finalText)
                                          onCancelIteration && onCancelIteration()
                                          console.log('🔄 已退出迭代模式')
                                        } else {
                                          console.error('❌ onSetSolutionInput未定义')
                                        }
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [`${index}_followup`]: { accepted: true, negotiatedContent: finalText }
                                        }))
                                      }}
                                      className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      <span>采纳追问</span>
                                    </button>
                                    <button
                                      onClick={() => onRejectFollowUp && onRejectFollowUp(message.output)}
                                      className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>重新生成</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* 如果是仅部门联络，显示联络指令和操作按钮 */}
                            {message.title.includes('生成部门联络') && message.structuredOutput && (
                              <div className="mt-3 space-y-3">
                                {/* 联络指令 */}
                                {message.structuredOutput.contactInstruction && (
                                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                      内部联络指令
                                    </div>
                                    <div className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                                      {message.structuredOutput.contactInstruction}
                                    </div>
                                    <button
                                      onClick={() => {
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [`${index}_department_only`]: { sent: true }
                                        }))
                                      }}
                                      className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                    >
                                      <span>{messageStates[`${index}_department_only`]?.sent ? '已发送' : '发送给相关部门'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 如果是部门联络指令，显示详细信息和操作按钮 */}
                            {(message.title.includes('客户回复和部门联络') && !message.title.includes('生成部门联络')) && message.structuredOutput && (
                              <div className="mt-3 space-y-3">
                                {/* 客户回复 */}
                                {message.structuredOutput.customerReply && (
                                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                    <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                                      给客户的回复
                                    </div>
                                    <div className="text-sm text-green-800 dark:text-green-200 mb-2">
                                      {message.structuredOutput.customerReply}
                                    </div>
                                    <button
                                      onClick={() => {
                                        const reply = message.structuredOutput.customerReply
                                        // Only fill right-side input box, don't show direct send confirmation bar (requirement cancelled)
                                        if (onSetSolutionInput) {
                                          onSetSolutionInput(reply)
                                          onCancelIteration && onCancelIteration()
                                        }
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [`${index}_customerReply`]: { applied: true }
                                        }))
                                      }}
                                      className={`px-3 py-1 ${messageStates[`${index}_customerReply`]?.applied ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg text-xs transition-colors flex items-center space-x-1`}
                                      disabled={messageStates[`${index}_customerReply`]?.applied}
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>{messageStates[`${index}_customerReply`]?.applied ? '已应用' : '应用客户回复'}</span>
                                    </button>
                                  </div>
                                )}
                                
                                {/* 内部联络指令 */}
                                {message.structuredOutput.contactInstruction && (
                                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                                    <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">
                                      内部联络指令
                                    </div>
                                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                      {message.structuredOutput.contactInstruction}
                                    </div>
                                    <button
                                      onClick={() => {
                                        // 这里可以添加实际的发送逻辑
                                        setMessageStates(prev => ({
                                          ...prev,
                                          [`${index}_department`]: { sent: true }
                                        }))
                                      }}
                                      className={`mt-2 px-3 py-1 ${messageStates[`${index}_department`]?.sent ? 'bg-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'} text-white rounded-lg text-xs transition-colors flex items-center space-x-1`}
                                      disabled={messageStates[`${index}_department`]?.sent}
                                    >
                                      <Users className="w-3 h-3" />
                                      <span>{messageStates[`${index}_department`]?.sent ? '已发送' : '发送给相关部门'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 如果是AI对话，显示问答内容 */}
                            {message.type === 'ai_chat' && (
                              <div className="mt-3 space-y-3">
                                {/* 用户问题 */}
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                    您的问题
                                  </div>
                                  <div className="text-sm text-blue-800 dark:text-blue-200">
                                    {message.question}
                                  </div>
                                </div>
                                
                                {/* AI回答 */}
                                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 flex items-center space-x-1">
                                    <Bot className="w-3 h-3" />
                                    <span>AI回答</span>
                                    {message.error && <span className="text-red-500">(Error)</span>}
                                  </div>
                                  <div className="text-sm text-purple-800 dark:text-purple-200">
                                    {message.answer}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </AnimatedTransition>
                  );
                })
              })()}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default LLMPanel