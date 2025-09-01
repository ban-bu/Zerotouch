import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Settings, Users, GraduationCap, ShoppingBag } from 'lucide-react'
import AnimatedTransition from './components/AnimatedTransition'
import { ConnectionLoader } from './components/LoadingStates'
import ProblemPanel from './components/ProblemPanel'
import LLMPanel from './components/LLMPanel'
import SolutionPanel from './components/SolutionPanel'
import ScenarioSelector from './components/ScenarioSelector'
import NotificationSystem from './components/NotificationSystem'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import SettingsPanel from './components/SettingsPanel'
import { useMessageFlow } from './hooks/useMessageFlow'
import realtimeService, { REALTIME_EVENTS } from './services/realtimeService'
import { showSuccess, showError, showInfo } from './components/NotificationSystem'

const scenarios = {
  retail: {
    id: 'retail',
    name: 'Retail',
    icon: ShoppingBag,
    description: 'Communication between customer and store',
    problemRole: 'Customer',
    solutionRole: 'Store/Sales Representative',
    example: 'I will attend a keynote speech at the AOM conference next week and need a formal yet modern business suit. Budget: 800–1500 RMB, height: 175 cm. I want to look professional and energetic.'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Users,
    description: 'Cross-department communication within a company',
    problemRole: 'Marketing Manager',
    solutionRole: 'R&D Engineer',
    example: 'Our mobile app retention is only 30%. We need to build a personalized recommendation feature within 3 months to raise it to 45%. Target users: 18–35 years old. Budget: 500,000 RMB.'
  },
  education: {
    id: 'education',
    name: 'Education',
    icon: GraduationCap,
    description: 'Interaction between student and teacher',
    problemRole: 'Student',
    solutionRole: 'Teacher',
    example: 'I have difficulty understanding wave–particle duality in quantum physics, especially why light is both a wave and a particle. I hope to understand it through concrete experimental examples.'
  }
}

function App() {
  const [currentScenario, setCurrentScenario] = useState('retail')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [settings, setSettings] = useState({
    darkMode: true,
    fontSize: 'medium',
    soundEnabled: true,
    autoScroll: true,
    showTimestamps: true,
    language: 'en-US',
    apiEndpoint: 'https://api.example.com/v1',
    maxMessagesPerPanel: 50
  })
  
  // 输入框引用
  const problemInputRef = useRef(null)
  const solutionInputRef = useRef(null)
  
  const {
    messages,
    llmProcessing,
    iterationProcessing,
    llmProcessingContext,
    iterationMode,
    pendingResponse,
    directSendCandidate,
    // 新增的状态和方法
    missingInfoOptions,
    showMissingInfoPanel,
    currentNeedsAnalysis,
    toggleMissingInfoOption,
    generateFollowUpBySelectedInfo,
    generateSimpleIntelligentFollowUp,
    generateIntelligentNeedsAnalysis,
    skipInfoCollection,
    // 建议反馈相关方法
    acceptSuggestion,
    negotiateSuggestion,
    cancelNegotiation,
    sendNegotiationRequest,
    rejectSuggestion,
    // 追问反馈相关方法
    acceptFollowUp,
    negotiateFollowUp,
    cancelFollowUpNegotiation,
    sendFollowUpNegotiationRequest,
    rejectFollowUp,
    confirmDirectSendToProblem,
    cancelDirectSend,
    prepareDirectSendCandidate,
    // 智能追问反馈相关
    acceptIntelligentFollowUp,
    negotiateIntelligentFollowUp,
    cancelIntelligentFollowUpNegotiation,
    sendIntelligentFollowUpNegotiationRequest,
    rejectIntelligentFollowUp,
    // 新增：聊天模式相关状态和方法
    chatMode,
    departmentModalVisible,
    emergencyModalVisible,
    switchChatMode,
    generateDepartmentContactSuggestion,
    handleEmergencyMode,
    closeModeModal,
    closeEmergencyModalOnly,
    // 新增：流式显示相关状态
    thinkingContent,
    answerContent,
    isStreaming,
    // 新增：协作工作台流式状态
    streamingMessage,
    streamingMessageContent,
    // 新增：AI推理干预相关状态和方法
    isPaused,
    pauseAI,
    resumeAI,
    adjustAI,
    // New: Generate customer reply based on any AI message
    generateCustomerReplyForMessage,
    negotiateCustomerReplyCandidate,
    // 原有方法
    sendProblemMessage,
    sendCustomerReplyToProblem,
    sendSolutionMessage,
    generateSuggestion,
    generateFollowUp,
    generateDepartmentContact,
    generateDepartmentContactOnly,
    chatWithAI,
    clearAiChatHistory,
    aiChatHistory,
    markContactInstructionSent,
    markCustomerReplyApplied,
    confirmSendResponse,
    cancelIteration,
    clearMessages
  } = useMessageFlow(currentScenario)
  
  // 初始化实时服务连接
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await realtimeService.connect()
        setIsConnected(true)
        // showSuccess('已连接到服务器', { duration: 3000 })
      } catch (error) {
        console.error('Failed to connect to realtime service:', error)
        // 隐藏连接失败通知
        // showError('连接服务器失败', { duration: 5000 })
      }
    }
    
    initializeConnection()
    
    // 订阅连接状态变化
    const unsubscribeConnection = realtimeService.subscribe(
      REALTIME_EVENTS.CONNECTION_STATE_CHANGED,
      (data) => {
        setIsConnected(data.connected)
        // 隐藏连接状态通知
        // if (data.connected) {
        //   showSuccess('已重新连接到服务器', { duration: 3000 })
        // } else {
        //   showError('与服务器连接断开', { duration: 5000 })
        // }
      }
    )
    
    // 订阅错误事件
    const unsubscribeError = realtimeService.subscribe(
      REALTIME_EVENTS.ERROR,
      (error) => {
        console.error('Realtime service error:', error)
        // 隐藏连接错误通知
        // showError(`连接错误: ${error.message}`, { duration: 5000 })
      }
    )
    
    // 清理函数
    return () => {
      unsubscribeConnection()
      unsubscribeError()
      realtimeService.disconnect()
    }
  }, [])
  
  // 应用设置变化
  useEffect(() => {
    // 应用深色模式
    if (settings.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // 应用字体大小
    const fontSizeClasses = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg'
    }
    
    // 移除之前的字体大小类
    Object.values(fontSizeClasses).forEach(cls => {
      document.documentElement.classList.remove(cls)
    })
    
    // 添加新的字体大小类
    document.documentElement.classList.add(fontSizeClasses[settings.fontSize])
  }, [settings])
  
  // 处理设置更新
  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings)
    // In actual applications, this should be saved to localStorage or server
    localStorage.setItem('app-settings', JSON.stringify(newSettings))
  }
  
  // 从localStorage加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
      }
    }
  }, [])
  
  // 键盘快捷键处理函数
  const handleClearMessages = () => {
    clearMessages()
  }
  
  const handleToggleSettings = () => {
    setIsSettingsOpen(prev => !prev)
  }
  
  const handleFocusInput = (panel) => {
    if (panel === 'problem' && problemInputRef.current) {
      problemInputRef.current.focus()
    } else if (panel === 'solution' && solutionInputRef.current) {
      solutionInputRef.current.focus()
    }
  }

  // 设置方案端输入框内容的函数
  const [solutionSetInputRef, setSolutionSetInputRef] = useState(null)
  
  const setSolutionInput = useCallback((text) => {
    console.log('🔄 setSolutionInput被调用:', { text, solutionSetInputRef: !!solutionSetInputRef })
    if (solutionSetInputRef) {
      console.log('📝 调用solutionSetInputRef:', text)
      solutionSetInputRef(text)
    } else {
      console.error('❌ solutionSetInputRef未设置')
    }
  }, [solutionSetInputRef])

  const handleSetSolutionInputRef = useCallback((setInputFn) => {
    setSolutionSetInputRef(() => setInputFn)
  }, [])

  const handleScenarioChange = useCallback((scenarioId) => {
    setCurrentScenario(scenarioId)
    clearMessages()
  }, [clearMessages])

  const scenario = scenarios[currentScenario]

  return (
    <>
      <div className="min-h-screen relative overflow-hidden transition-colors duration-300">
        {/* 幻彩动态背景装饰元素 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-gradient-to-r from-orange-500/15 to-pink-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-cyan-400/12 to-violet-500/12 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          {/* 新增幻彩光晕效果 */}
          <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-gradient-to-r from-blue-400/10 to-indigo-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '3s' }}></div>
          <div className="absolute bottom-1/4 left-1/4 w-56 h-56 bg-gradient-to-r from-purple-400/8 to-pink-500/8 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
        {/* Header */}
        <header className="app-toolbar">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-white drop-shadow" style={{
                  textShadow: settings.darkMode ? '0 1px 2px rgba(0, 0, 0, 0.5)' : '0 1px 2px rgba(0, 0, 0, 0.25)'
                }}>
                  GenAI ZeroTouch Services
                </h1>
                {/* 隐藏副标题 */}
                {false && (
                  <span className="text-sm text-gray-200" style={{
                    textShadow: settings.darkMode ? '0 1px 2px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.15)'
                  }}>
                    Zero Friction Communication System
                  </span>
                )}
              </div>
              
              {/* 隐藏场景选择器和设置按钮 */}
              {false && (
                <div className="flex items-center space-x-4">
                  <ScenarioSelector
                    scenarios={scenarios}
                    currentScenario={currentScenario}
                    onScenarioChange={handleScenarioChange}
                  />
                  
                  <div className="flex items-center space-x-2">
                    {/* 连接状态指示器 - 已隐藏 */}
                    {/* {isConnected && <ConnectionLoader status="connected" />} */}
                    
                    <button 
                      onClick={handleToggleSettings}
                      className="p-2 rounded-lg transition-colors border border-white/20 hover:bg-white/20 text-white"
                      title="Settings (Ctrl+,)"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
          {/* 隐藏场景信息 */}
          {false && (
            <AnimatedTransition type="slide-down" show={true}>
              <div className="mb-6 p-6 glass-panel shadow-lg flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <div className="relative p-3 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-90"></div>
                    <div className="absolute inset-0 bg-white/20 backdrop-filter blur-sm"></div>
                    <scenario.icon className="w-6 h-6 text-white relative z-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {scenario.name}
                    </h2>
                    <p className="text-sm mt-1">
                      {scenario.description}
                    </p>
                  </div>
                </div>
              </div>
            </AnimatedTransition>
          )}

          {/* Three Panel Layout */}
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-[20%_50%_30%] gap-6 flex-1 items-stretch" style={{ height: 'calc(100vh - 150px)', minHeight: 'calc(100vh - 150px)' }}>
            {/* Problem Panel */}
            <AnimatedTransition type="slide-left" show={true}>
              <div className="panel">
                <ProblemPanel
                  scenario={scenario}
                  messages={messages.problem}
                  onSendMessage={sendProblemMessage}
                  isProcessing={llmProcessing && llmProcessingContext === 'problem'}
                  inputRef={problemInputRef}
                  settings={settings}
                />
              </div>
            </AnimatedTransition>

            {/* Solution Panel */}
            <AnimatedTransition type="slide-right" show={true}>
              <div className="panel">
                <SolutionPanel
                  scenario={scenario}
                  messages={messages.solution}
                  onSendMessage={sendSolutionMessage}
                  onSendToProblem={sendCustomerReplyToProblem}
                  isProcessing={llmProcessing && llmProcessingContext === 'solution'}
                  iterationMode={iterationMode}
                  pendingResponse={pendingResponse}
                  directSendCandidate={directSendCandidate}
                  onConfirmDirectSend={confirmDirectSendToProblem}
                  onCancelDirectSend={cancelDirectSend}
                  onGenerateSuggestion={generateSuggestion}
                  onGenerateFollowUp={generateFollowUp}
                  onGenerateDepartmentContact={generateDepartmentContact}
                  onMarkContactInstructionSent={markContactInstructionSent}
                  onMarkCustomerReplyApplied={markCustomerReplyApplied}
                  onPrepareDirectSendCandidate={prepareDirectSendCandidate}
                  onConfirmSend={confirmSendResponse}
                  onCancelIteration={cancelIteration}
                  onSetInput={handleSetSolutionInputRef}
                  inputRef={solutionInputRef}
                  settings={settings}
                  iterationProcessing={iterationProcessing}
                  // 缺失信息选择与生成追问已迁移到中间面板
                  // 新增：建议反馈相关props
                  onAcceptSuggestion={acceptSuggestion}
                  onNegotiateSuggestion={negotiateSuggestion}
                  onCancelNegotiation={cancelNegotiation}
                  onSendNegotiationRequest={sendNegotiationRequest}
                  onRejectSuggestion={rejectSuggestion}
                  // 新增：追问反馈相关props
                  onAcceptFollowUp={acceptFollowUp}
                  onNegotiateFollowUp={negotiateFollowUp}
                  onCancelFollowUpNegotiation={cancelFollowUpNegotiation}
                  onSendFollowUpNegotiationRequest={sendFollowUpNegotiationRequest}
                  onRejectFollowUp={rejectFollowUp}
                  // 新增：智能追问反馈相关props
                  onAcceptIntelligentFollowUp={acceptIntelligentFollowUp}
                  onNegotiateIntelligentFollowUp={negotiateIntelligentFollowUp}
                  onCancelIntelligentFollowUpNegotiation={cancelIntelligentFollowUpNegotiation}
                  onSendIntelligentFollowUpNegotiationRequest={sendIntelligentFollowUpNegotiationRequest}
                  onRejectIntelligentFollowUp={rejectIntelligentFollowUp}
                  // 新增：AI控制功能props
                  onGenerateIntelligentFollowUp={generateSimpleIntelligentFollowUp}
                  onGenerateDepartmentContactOnly={generateDepartmentContactOnly}
                  onChatWithAI={chatWithAI}
                  onClearAiChatHistory={clearAiChatHistory}
                  onGenerateCustomerReplyForMessage={generateCustomerReplyForMessage}
                  onNegotiateCustomerReplyCandidate={negotiateCustomerReplyCandidate}
                  // Expose customer reply draft negotiation function to UI layer
                  aiChatHistory={aiChatHistory}
                  currentScenario={currentScenario}
                  // 新增：缺失信息选择相关props - 现在在协作工作台
                  missingInfoOptions={missingInfoOptions}
                  showMissingInfoPanel={showMissingInfoPanel}
                  onToggleMissingInfoOption={toggleMissingInfoOption}
                  onGenerateFollowUpBySelectedInfo={generateFollowUpBySelectedInfo}
                  onSkipInfoCollection={skipInfoCollection}
                  // 新增：聊天模式相关props
                  chatMode={chatMode}
                  departmentModalVisible={departmentModalVisible}
                  emergencyModalVisible={emergencyModalVisible}
                  onSwitchChatMode={switchChatMode}
                  onCloseModeModal={closeModeModal}
                  onCloseEmergencyModalOnly={closeEmergencyModalOnly}
                  onHandleEmergencyMode={handleEmergencyMode}
                  // 新增：协作工作台流式显示props
                  streamingMessage={streamingMessage}
                  streamingMessageContent={streamingMessageContent}
                />
              </div>
            </AnimatedTransition>

            {/* AI intermediary processing panel - redesigned to highlight AI functionality */}
            <AnimatedTransition type="scale" show={true}>
              <div className="panel" style={{
                boxShadow: '0 25px 50px -12px rgba(147, 51, 234, 0.25)',
                border: '2px solid rgba(147, 51, 234, 0.2)',
                background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.03) 0%, rgba(99, 102, 241, 0.02) 100%)'
              }}>
                <LLMPanel
                  processing={llmProcessing || iterationProcessing}
                  messages={messages.llm}
                  settings={settings}
                  currentScenario={currentScenario}
                  onGenerateSuggestion={generateSuggestion}
                  onGenerateFollowUp={generateFollowUp}
                  onGenerateIntelligentFollowUp={generateSimpleIntelligentFollowUp}
                  onGenerateNeedsAnalysis={generateIntelligentNeedsAnalysis}
                  onGenerateDepartmentContact={generateDepartmentContact}
                  onGenerateDepartmentContactOnly={generateDepartmentContactOnly}
                  onChatWithAI={chatWithAI}
                  onAcceptSuggestion={acceptSuggestion}
                  onNegotiateSuggestion={negotiateSuggestion}
                  onRejectSuggestion={rejectSuggestion}
                  onAcceptFollowUp={acceptFollowUp}
                  onNegotiateFollowUp={negotiateFollowUp}
                  onRejectFollowUp={rejectFollowUp}
                  onSendToSolution={sendSolutionMessage}
                  onSendToProblem={sendCustomerReplyToProblem}
                  onSetSolutionInput={setSolutionInput}
                  showMissingInfoPanel={showMissingInfoPanel}
                  onCancelIteration={cancelIteration}
                  onCancelNegotiation={cancelNegotiation}
                  onSendNegotiationRequest={sendNegotiationRequest}
                  onCancelFollowUpNegotiation={cancelFollowUpNegotiation}
                  onSendFollowUpNegotiationRequest={sendFollowUpNegotiationRequest}
                  onPrepareDirectSendCandidate={prepareDirectSendCandidate}
                  // 缺失信息选择面板已迁移到协作工作台
                  // 新增：流式显示相关状态
                  thinkingContent={thinkingContent}
                  answerContent={answerContent}
                  isStreaming={isStreaming}
                  // 新增：AI推理干预相关状态和方法
                  isPaused={isPaused}
                  onPauseAI={pauseAI}
                  onResumeAI={resumeAI}
                  onAdjustAI={adjustAI}
                />
              </div>
            </AnimatedTransition>
          </div>

          {/* 隐藏清空对话按钮 */}
          {false && (
            <div className="text-center">
              <button
                onClick={clearMessages}
                className="btn-glass px-6 py-3"
              >
                清空对话
              </button>
            </div>
          )}
        </main>
      </div>
      
      {/* 通知系统 */}
      <NotificationSystem />
      
      {/* 键盘快捷键 */}
      <KeyboardShortcuts
        onClearMessages={handleClearMessages}
        onToggleSettings={handleToggleSettings}
        onFocusInput={handleFocusInput}
      />
      
      {/* 设置面板 */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </>
  )
}

export default App