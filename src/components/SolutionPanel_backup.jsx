import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Users, User, Bot, FileText, Lightbulb, MessageSquare, CheckCircle, XCircle, AlertCircle, ArrowRight, Check, MessageCircle } from 'lucide-react'
import AnimatedTransition from './AnimatedTransition'
import { TypingLoader } from './LoadingStates'

const SolutionPanel = ({ 
  scenario, 
  messages, 
  onSendMessage, 
  isProcessing,
  iterationProcessing, // 新增：迭代处理状态
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
  onSendToProblem,
  onPrepareDirectSendCandidate,
  onConfirmSend,
  onCancelIteration,
  onSetInput, // 新增：设置输入框内容的回调
  // 新增：勾选框相关props
  missingInfoOptions,
  showMissingInfoPanel,
  onToggleMissingInfoOption,
  onGenerateFollowUpBySelectedInfo,
  onSkipInfoCollection,
  // 新增：建议反馈相关props
  onAcceptSuggestion,
  onRejectSuggestion,
  onNegotiateSuggestion,
  onCancelNegotiation,
  onSendNegotiationRequest,
  // 新增：追问反馈相关props
  onAcceptFollowUp,
  onRejectFollowUp,
  onNegotiateFollowUp,
  onCancelFollowUpNegotiation,
  onSendFollowUpNegotiationRequest,
  // 新增：智能追问反馈相关props
  onAcceptIntelligentFollowUp,
  onRejectIntelligentFollowUp,
  onNegotiateIntelligentFollowUp,
  onCancelIntelligentFollowUpNegotiation,
  onSendIntelligentFollowUpNegotiationRequest,
  // 新增：AI控制功能props
  onGenerateIntelligentFollowUp,
  onGenerateDepartmentContactOnly,
  onChatWithAI,
  onClearAiChatHistory,
  aiChatHistory,
  currentScenario
}) => {
  const [input, setInput] = useState('')
  const [aiChatProcessing, setAiChatProcessing] = useState(false)
  const aiInputRef = useRef(null)
  const [finalResponse, setFinalResponse] = useState('')
  const messagesEndRef = useRef(null)

  // 调试输入框状态变化
  useEffect(() => {
    console.log('📝 输入框内容更新:', input)
    console.log('🔍 当前状态:', { 
      iterationMode, 
      isProcessing, 
      iterationProcessing,
      inputReadOnly: isProcessing || iterationProcessing 
    })
  }, [input, iterationMode, isProcessing, iterationProcessing])

  // 暴露setInput函数给父组件
  useEffect(() => {
    console.log('🔗 SolutionPanel: 设置setInput引用', { onSetInput: !!onSetInput })
    if (onSetInput) {
      onSetInput(setInput)
      console.log('✅ setInput函数已传递给父组件')
    }
  }, [onSetInput])

  // 调试部门联络指令消息
  useEffect(() => {
    const departmentContactMessages = messages.filter(msg => msg.type === 'department_contact')
    if (departmentContactMessages.length > 0) {
      console.log('🏢 当前部门联络指令消息:', departmentContactMessages.map(msg => ({
        id: msg.id,
        customerReply: msg.customerReply,
        contactInstruction: msg.contactInstruction,
        instructionSent: msg.instructionSent
      })))
    }
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    onSendMessage({
      text: input.trim(),
      timestamp: new Date().toISOString()
    })

    setInput('')
  }

  // 新增：直接发送到问题端（不经AI转译）
  const handleDirectSend = () => {
    if (!input.trim()) return
    if (onSendToProblem) {
      onSendToProblem({ text: input.trim(), timestamp: new Date().toISOString() })
      setInput('')
    }
  }

  // 新增：确认直发处理
  const handleConfirmDirectSend = () => {
    if (!input.trim()) return
    if (onConfirmDirectSend) {
      onConfirmDirectSend(input.trim())
      setInput('')
    }
  }

  const handleConfirmSend = () => {
    if (!finalResponse.trim()) return
    onConfirmSend(finalResponse.trim())
    setFinalResponse('')
  }

  // AI控制相关功能
  useEffect(() => {
    if (showAIControls && aiInputRef.current) {
      setTimeout(() => {
        aiInputRef.current.focus()
      }, 150)
    }
  }, [showAIControls])

  const handleGenerateAction = (actionType) => {
    switch(actionType) {
      case 'suggestion':
        onGenerateSuggestion && onGenerateSuggestion()
        break
      case 'intelligent_followup':
        onGenerateIntelligentFollowUp && onGenerateIntelligentFollowUp()
        break
      case 'department':
        // 部门联络需要基于最近的建议或对话内容
        const recentContent = messages.find(msg => msg.type === 'suggestion')?.text || 
                             messages.slice(-1)[0]?.text || 
                             '基于当前对话生成联络指令'
        onGenerateDepartmentContactOnly && onGenerateDepartmentContactOnly(recentContent)
        break
      default:
        break
    }
  }

  const handleChatWithAI = async () => {
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
  }

  return (
    <>
      <div className="p-4 border-b border-white/20 dark:border-white/10 glass-effect rounded-t-2xl" style={{background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.12) 100%)', backdropFilter: 'blur(20px) saturate(1.3)'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100/70 dark:bg-emerald-900/50 rounded-2xl backdrop-blur-sm">
              <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">AI协作工作台</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">客服 ↔ AI 协作解决方案</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>AI在线</span>
            </div>
          </div>
        </div>
      </div>

      {/* 迭代模式提示 */}
      {iterationMode && (
        <AnimatedTransition type="slide-down" show={true}>
          <div className="p-3" style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,197,253,0.06) 100%)',
            backdropFilter: 'blur(14px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
            border: '1px solid rgba(147,197,253,0.25)',
            borderRadius: '12px'
          }}>
            <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">迭代模式 - 请确认最终回复内容</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              You can continue editing the content. After confirming it's correct, click "Confirm Send" to send the reply to the customer
            </p>
          </div>
        </AnimatedTransition>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-4">
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 space-y-4">
            <AnimatedTransition type="fade" show={true}>
              <div className="p-4 bg-gradient-to-r from-green-100/80 to-emerald-100/80 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full shadow-inner backdrop-blur-sm">
                <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </AnimatedTransition>
            <p className="text-lg">AI协作工作台</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {/* 与AI协作，为客户制定最佳解决方案 */}
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                💡 提示：点击下方AI功能按钮开始协作
              </p>
            </div>
          </div>
        )}
        
        {messages && messages.map((message, index) => (
          <AnimatedTransition 
            key={index} 
            type={message.type === 'user' ? 'slide-right' : 'slide-left'} 
            show={true}
          >
            <div className="space-y-2">
              {/* 客服消息 - 右侧绿色气泡 */}
              {message.type === 'user' && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-br-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                    <div className="flex-1">
                        <div className="whitespace-pre-wrap text-white select-text">{message.text}</div>
                        <div className="text-xs text-green-100 mt-1 opacity-90 text-right">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      </div>
                      <User className="w-4 h-4 text-green-100 mt-0.5 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI消息 - 左侧蓝色气泡 */}
              {(message.type === 'ai_response' || message.type === 'llm_request' || message.type === 'ai') && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(99, 102, 241, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                      <Bot className="w-4 h-4 text-blue-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        {message.type === 'llm_request' && (
                          <div className="text-xs font-medium text-blue-100 mb-1 opacity-90">
                            📋 需求分析
                      </div>
                        )}
                        {message.type === 'ai_response' && (
                          <div className="text-xs font-medium text-blue-100 mb-1 opacity-90">
                            🤖 AI回复
                          </div>
                        )}
                        <div className="whitespace-pre-wrap text-white select-text">{message.text}</div>
                        <div className="text-xs text-blue-100 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI建议消息 - 显示为聊天气泡 */}
              {message.type === 'suggestion' && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(147, 51, 234, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                  }}>
                  <div className="flex items-start space-x-2">
                      <Lightbulb className="w-4 h-4 text-purple-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="text-xs font-medium text-purple-100 mb-1 opacity-90">
                          💡 AI建议
                      </div>
                        <div className="whitespace-pre-wrap text-white select-text">{message.text}</div>
                        <div className="text-xs text-purple-100 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI追问消息 - 显示为聊天气泡 */}
              {(message.type === 'followup' || message.type === 'intelligent_followup') && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(245, 101, 101, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                      <MessageSquare className="w-4 h-4 text-orange-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="text-xs font-medium text-orange-100 mb-1 opacity-90">
                          🤔 {message.type === 'intelligent_followup' ? '智能追问' : 'AI追问'}
                      </div>
                        <div className="whitespace-pre-wrap text-white select-text">{message.text}</div>
                        <div className="text-xs text-orange-100 mt-1 opacity-90">
                          {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      </div>
                    </div>
                    </div>
                   </div>
                 )}

              {/* AI对话消息 - ChatGPT风格的对话显示 */}
              {message.type === 'ai_chat' && (
                <div className="space-y-3">
                  {/* 用户问题 - 右侧气泡 */}
                  {message.question && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] p-3 rounded-2xl rounded-br-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.85) 100%)',
                        backdropFilter: 'blur(10px) saturate(1.2)',
                        WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                        color: 'white'
                      }}>
                        <div className="flex items-start space-x-2">
                          <div className="flex-1">
                            <div className="text-xs font-medium text-purple-100 mb-1 opacity-90">
                              👨‍💼 我问AI
                      </div>
                            <div className="whitespace-pre-wrap text-white select-text">{message.question}</div>
                          </div>
                          <User className="w-4 h-4 text-purple-100 mt-0.5 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              )}

                  {/* AI回答 - 左侧气泡 */}
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                      background: message.error 
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.85) 100%)'
                        : 'linear-gradient(135deg, rgba(14, 165, 233, 0.9) 0%, rgba(59, 130, 246, 0.85) 100%)',
                      backdropFilter: 'blur(10px) saturate(1.2)',
                      WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                      color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                        <Bot className="w-4 h-4 text-blue-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                          <div className="text-xs font-medium text-blue-100 mb-1 opacity-90 flex items-center space-x-1">
                            <span>🤖 AI助手</span>
                            {message.error && <span className="text-red-200">(Error)</span>}
                      </div>
                          <div className="whitespace-pre-wrap text-white select-text leading-relaxed">
                            {message.answer}
                      </div>
                          <div className="text-xs text-blue-100 mt-2 opacity-90 flex items-center justify-between">
                            <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                            {message.conversationId && (
                              <span className="text-xs bg-blue-600/30 px-2 py-1 rounded">
                                #{message.conversationId.toString().slice(-4)}
                              </span>
                            )}
                  </div>
                               </div>
                           </div>
                       </div>
                     </div>
                   </div>
                 )}

              {/* 智能需求分析消息 - 显示为聊天气泡 */}
              {message.type === 'needs_analysis' && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-indigo-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="text-xs font-medium text-indigo-100 mb-1 opacity-90">
                          🧠 智能需求分析
                      </div>
                        <div className="whitespace-pre-wrap text-white select-text">{message.text}</div>
                        {message.missingInfoOptions && message.missingInfoOptions.length > 0 && (
                          <div className="mt-2 p-2 rounded bg-indigo-600/30 border border-indigo-400/30">
                            <div className="text-xs text-indigo-200 mb-1">发现可补充信息点:</div>
                            <div className="text-sm text-white">
                              {message.missingInfoOptions.map(opt => opt.name).join('、')}
                        </div>
                   </div>
                 )}
                        <div className="text-xs text-indigo-100 mt-1 opacity-90">
                        {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 部门联络消息 - 显示为聊天气泡 */}
              {message.type === 'department_contact' && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm hover:shadow-md transition-all duration-200" style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.85) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                    color: 'white'
                }}>
                  <div className="flex items-start space-x-2">
                      <Users className="w-4 h-4 text-green-100 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="text-xs font-medium text-green-100 mb-1 opacity-90">
                          🏢 部门联络指令
                      </div>
                        <div className="whitespace-pre-wrap text-white select-text">{message.contactInstruction || message.text}</div>
                        <div className="text-xs text-green-100 mt-1 opacity-90">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        </div>
                              </div>
                              </div>
                            </div>
                          )}
                        </div>
          </AnimatedTransition>
        ))}
        
        {/* 显示处理状态 */}
        {(isProcessing || iterationProcessing) && (
          <AnimatedTransition type="slide-left" show={true}>
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md shadow-sm" style={{
                background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.9) 0%, rgba(107, 114, 128, 0.85) 100%)',
                backdropFilter: 'blur(10px) saturate(1.2)',
                WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                color: 'white'
              }}>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  <span className="text-sm">AI is thinking...</span>
                        </div>
                        </div>
                      </div>
          </AnimatedTransition>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 缺失信息选择面板 - 现在在协作工作台中显示 */}
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
                  onClick={onGenerateFollowUpBySelectedInfo}
                  disabled={iterationProcessing || !missingInfoOptions.some(opt => opt.selected)}
                  className="flex-1 btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
                  title="Generate Follow-up Directly"
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
                  title="Skip and Reply Directly"
                >
                  <span>Skip</span>
                </button>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                After selecting information points, AI will generate natural and fluent follow-ups for your use
              </div>
            </div>
          </div>
        </AnimatedTransition>
      )}

      {/* 迭代模式下的操作按钮 */}
      {iterationMode && (
        <AnimatedTransition type="slide-up" show={true}>
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50" style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(254, 240, 138, 0.06) 100%)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: '12px'
          }}>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                <Lightbulb className="w-4 h-4" />
                <span className="text-sm font-medium">Edit Final Reply Content</span>
              </div>
              
              <textarea
                value={finalResponse}
                onChange={(e) => setFinalResponse(e.target.value)}
                placeholder="Edit final reply content..."
                className="input-field resize-none transition-all duration-200 focus:shadow-md"
                rows={4}
                readOnly={isProcessing}
              />
              
              <div className="flex space-x-2">
                <button
                  onClick={handleConfirmSend}
                  disabled={!finalResponse.trim() || isProcessing}
                  className="flex-1 btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
                  title="确认发送给客户"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>确认发送</span>
                </button>
                
                <button
                  onClick={onCancelIteration}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  title="Cancel Iteration"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </AnimatedTransition>
      )}

      {/* 常规输入区域 */}
      {!iterationMode && (
        <div className="p-4 border-t border-white/20 dark:border-white/10 glass-effect rounded-b-2xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex space-x-3">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`作为${scenario.solutionRole}，请提供您的专业建议...`}
                  className="input-field resize-none transition-all duration-200 focus:shadow-md"
                  rows={3}
                  readOnly={isProcessing || iterationProcessing}
                />
              </div>
              
              <div className="flex flex-col justify-end space-y-2">
                <button
                  type="button"
                  onClick={handleDirectSend}
                  disabled={!input.trim() || isProcessing || iterationProcessing}
                  className="w-full px-4 py-3 text-white rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm font-medium hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="直接发送至问题端（不经AI转译）"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
                    backdropFilter: 'blur(10px) saturate(1.3)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.3)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Send Directly</span>
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isProcessing || iterationProcessing}
                  className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 hover:scale-105"
                  title="AI转译后发送"
                >
                  <span className="text-sm">AI转译发送</span>
                </button>
              </div>
            </div>

            {/* Solution side: AI translation in progress prompt */}
            {isProcessing && (
              <div className="message-bubble message-ai">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-gray-600" />
                  <TypingLoader message="AI正在转译" />
                </div>
              </div>
            )}

            {/* AI控制面板 - 移至输入框下方 */}
            <div className="mt-4 p-4 rounded-xl" style={{
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
              backdropFilter: 'blur(14px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
              border: '1px solid rgba(147, 51, 234, 0.2)'
            }}>
              <div className="space-y-4">
                {/* AI功能选择区域 - 2x2 排列 */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleGenerateAction('suggestion')}
                    disabled={isProcessing || iterationProcessing}
                    className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">生成建议</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateAction('intelligent_followup')}
                    disabled={isProcessing || iterationProcessing}
                    className="p-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">智能追问</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateAction('department')}
                    disabled={isProcessing || iterationProcessing}
                    className="p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">部门联络</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowAIControls(!showAIControls)}
                    className="p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex items-center space-x-2">
                      <Bot className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">询问AI</span>
                    </div>
                  </button>
                </div>

                {/* 展开的AI协作控制台 - ChatGPT风格 */}
                {showAIControls && (
                  <AnimatedTransition type="slide-down" show={true}>
                    <div className="mt-4 p-4 rounded-lg" style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 197, 253, 0.06) 100%)',
                      backdropFilter: 'blur(10px) saturate(1.2)',
                      WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                            <Bot className="w-4 h-4" />
                            <span className="text-sm font-medium">AI协作助手</span>
                            <span className="text-xs bg-blue-500/20 px-2 py-1 rounded-full">
                              ChatGPT风格
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              对话轮次: {Math.floor((aiChatHistory?.length || 0) / 2)}
                            </div>
                            {aiChatHistory && aiChatHistory.length > 0 && (
                              <button
                                onClick={onClearAiChatHistory}
                                className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-600 rounded transition-colors"
                                title="清空AI对话历史"
                              >
                                清空历史
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200/50">
                          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                              <span>
                                AI助手已就绪
                                {aiChatHistory && aiChatHistory.length > 0 
                                  ? `，已记住 ${Math.floor(aiChatHistory.length / 2)} 轮对话` 
                                  : '，等待您的第一个问题'
                                }
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                              <span>支持连续对话，具有完整上下文记忆</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                              <span>AI会基于当前客户情况和历史对话提供建议</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 聊天输入框 - ChatGPT风格设计 */}
                        <div className="relative">
                          <textarea
                            ref={aiInputRef}
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleChatWithAI()
                              }
                            }}
                            placeholder="💬 向AI助手询问任何问题...例如：'如何更好地回复这个客户？' 或 '这种情况下最佳的解决方案是什么？'"
                            className="w-full p-3 pr-16 border border-blue-200 dark:border-blue-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/30 dark:text-blue-100 text-sm transition-all duration-200"
                            rows={3}
                            disabled={aiChatProcessing}
                            style={{
                              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                            }}
                          />
                          
                          {/* 发送按钮 - 位于输入框右侧 */}
                          <button
                            onClick={handleChatWithAI}
                            disabled={!aiInput.trim() || aiChatProcessing}
                            className="absolute right-2 bottom-2 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg"
                            title={aiChatProcessing ? "AI Thinking..." : "Send message to AI assistant (or press Enter)"}
                          >
                            {aiChatProcessing ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg 
                                className="w-5 h-5 transform rotate-45" 
                                fill="currentColor" 
                                viewBox="0 0 20 20"
                              >
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        
                        {/* 控制按钮组 */}
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setAiInput('')}
                              disabled={aiChatProcessing || !aiInput}
                              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="清空输入框"
                            >
                              🗑️ 清空
                            </button>
                            
                            <button
                              onClick={() => setAiInput(aiInput + '\n')}
                              disabled={aiChatProcessing}
                              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="添加换行"
                            >
                              ↵ 换行
                            </button>
                          </div>
                          
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                            {/* <span>💡 Shift+Enter 换行，Enter 发送</span> */}
                            {aiInput.length > 0 && (
                              <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-600 dark:text-blue-300">
                                {aiInput.length} 字符
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          {/* 💡 AI助手会记住整个对话过程，您可以进行连续对话 */}
                        </div>
                      </div>
                    </div>
                  </AnimatedTransition>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export default SolutionPanel
