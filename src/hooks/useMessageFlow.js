import { useState, useCallback, useRef } from 'react'
import { processWithLLM } from '../services/llmService'

export const useMessageFlow = (currentScenario) => {
  const [messages, setMessages] = useState({
    problem: [],
    llm: [],
    solution: []
  })
  const [llmProcessing, setLlmProcessing] = useState(false)
  const [llmProcessingContext, setLlmProcessingContext] = useState(null) // 'problem' | 'solution' | null
  const [iterationProcessing, setIterationProcessing] = useState(false) // 新增：迭代处理状态
  const [iterationMode, setIterationMode] = useState(false) // 新增：迭代模式状态
  const [pendingResponse, setPendingResponse] = useState(null) // 新增：待发送的响应
  
  // 新增：需求分析相关状态
  const [missingInfoOptions, setMissingInfoOptions] = useState([])
  const [showMissingInfoPanel, setShowMissingInfoPanel] = useState(false)
  const [currentNeedsAnalysis, setCurrentNeedsAnalysis] = useState(null)

  // 新增：接受追问后直发候选（用于对比确认）
  const [directSendCandidate, setDirectSendCandidate] = useState(null)
  
  // 新增：AI协作对话历史 - 独立维护与AI的纯对话记录
  const [aiChatHistory, setAiChatHistory] = useState([])

  // 新增：聊天模式状态管理
  const [chatMode, setChatMode] = useState('normal') // 'normal', 'department', 'emergency'
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false)
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false)

  // 新增：流式显示状态管理
  const [thinkingContent, setThinkingContent] = useState('')
  const [answerContent, setAnswerContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  // 新增：AI推理干预状态管理
  const [isPaused, setIsPaused] = useState(false)
  const [currentStreamController, setCurrentStreamController] = useState(null)
  const [currentStreamContext, setCurrentStreamContext] = useState(null)

  // 新增：协作工作台流式消息状态管理
  const [streamingMessage, setStreamingMessage] = useState(null) // 当前正在流式显示的消息
  const [streamingMessageContent, setStreamingMessageContent] = useState('') // 流式内容
  const streamingMessageRef = useRef(null)
  const currentStreamIdRef = useRef(null)

  // 流式回调函数
  const streamCallbacks = {
    onStreamStart: (controller, context) => {
      console.log('🚀 Hook: 流式开始回调触发')
      setIsStreaming(true)
      setIsPaused(false)
      setThinkingContent('')
      setAnswerContent('')
      setCurrentStreamController(controller)
      setCurrentStreamContext(context)
      
      // 为协作工作台创建流式消息占位符（除非被禁止）
      if (!context?.suppressMessageCreation) {
        const messageType = context?.messageType || 'ai_chat'
        const streamingMsg = {
          type: messageType,
          text: '',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          streamId: `stream_${Date.now()}`,
          // Save chat mode when generated to prevent color changes when switching modes later
          generatedInMode: context?.chatMode || chatMode,
          // 复制紧急处理相关属性
          ...(messageType === 'emergency_response' && {
            urgencyLevel: context?.urgencyLevel,
            description: context?.description,
            escalated: context?.escalated
          }),
          // 复制智能追问相关属性
          ...(messageType === 'intelligent_followup_candidate' && {
            selectedInfo: context?.selectedInfo,
            feedbackGiven: false,
            accepted: false,
            negotiating: false,
            negotiated: false,
            id: Date.now() + Math.random(),
            // 关联到对应的综合分析消息
            relatedComprehensiveId: context?.relatedComprehensiveId
          })
        }
        
        // Add streaming message placeholder to solution panel (first clean old smart follow-up drafts to avoid duplicate drafts)
        setMessages(prev => {
          const cleanedSolution =
            messageType === 'intelligent_followup_candidate'
              ? prev.solution.filter(m => m.type !== 'intelligent_followup_candidate')
              : prev.solution
          return {
            ...prev,
            solution: [...cleanedSolution, streamingMsg]
          }
        })
        
        setStreamingMessage(streamingMsg)
        streamingMessageRef.current = streamingMsg
        setStreamingMessageContent('')
        currentStreamIdRef.current = streamingMsg.streamId
      }
    },
    onThinking: (fragment, fullContent) => {
      console.log('🧠 Hook: 思考内容更新', {
        fragment: fragment ? fragment.substring(0, 20) + '...' : '空',
        fullLength: fullContent ? fullContent.length : 0,
        isPaused
      })
      if (!isPaused) {
        setThinkingContent(fullContent)
      }
    },
    onAnswering: (fragment, fullContent) => {
      if (!isPaused) {
        setAnswerContent(fullContent)
        // 实时更新协作工作台中的流式消息内容（仅当存在streamId时）
        const sid = currentStreamIdRef.current
        if (sid) {
          setStreamingMessageContent(fullContent)
          setMessages(prev => ({
            ...prev,
            solution: prev.solution.map(msg => 
              msg.streamId === sid 
                ? { ...msg, text: fullContent, answer: fullContent, isStreaming: true }
                : msg
            )
          }))
        }
      }
    },
    onStreamEnd: (finalThinking, finalAnswer) => {
      console.log('🏁 Hook: 流式结束回调触发', {
        thinkingLength: finalThinking ? finalThinking.length : 0,
        answerLength: finalAnswer ? finalAnswer.length : 0
      })
      setIsStreaming(false)
      setIsPaused(false)
      setThinkingContent(finalThinking)
      setAnswerContent(finalAnswer)
      setCurrentStreamController(null)
      setCurrentStreamContext(null)
      
      // 完成流式显示，移除流式状态（仅当存在streamId时）
      const sid = currentStreamIdRef.current
      if (sid) {
        setMessages(prev => ({
          ...prev,
          solution: prev.solution.map(msg => 
            msg.streamId === sid 
              ? { 
                  ...msg, 
                  text: finalAnswer || msg.text, 
                  isStreaming: false,
                  answer: finalAnswer || msg.answer || msg.text // 为ai_chat类型添加answer字段
                }
              : msg
          )
        }))
        // 只有当有streamId时才清理流式状态
        setStreamingMessage(null)
        streamingMessageRef.current = null
        currentStreamIdRef.current = null
        setStreamingMessageContent('')
      }
    },
    onStreamPaused: () => {
      setIsPaused(true)
    }
  }

  const addMessage = useCallback((panel, message) => {
    setMessages(prev => ({
      ...prev,
      [panel]: [...prev[panel], message]
    }))
  }, [])

  const clearMessages = useCallback(() => {
    setMessages({
      problem: [],
      llm: [],
      solution: []
    })
    setIterationMode(false)
    setPendingResponse(null)
    setLlmProcessing(false)
    setLlmProcessingContext(null)
    // 清空AI协作对话历史
    setAiChatHistory([])
    // 重置聊天模式
    setChatMode('normal')
    setDepartmentModalVisible(false)
    setEmergencyModalVisible(false)
    // 清空流式显示状态
    setThinkingContent('')
    setAnswerContent('')
    setIsStreaming(false)
    setIsPaused(false)
    setCurrentStreamController(null)
    setCurrentStreamContext(null)
    // 清空协作工作台流式状态
    setStreamingMessage(null)
    setStreamingMessageContent('')
  }, [])

  // 新增：AI推理干预功能
  const pauseAI = useCallback(() => {
    if (currentStreamController && currentStreamController.pause) {
      currentStreamController.pause()
      setIsPaused(true)
    }
  }, [currentStreamController])

  const resumeAI = useCallback(() => {
    if (currentStreamController && currentStreamController.resume) {
      currentStreamController.resume()
      setIsPaused(false)
    }
  }, [currentStreamController])

  const adjustAI = useCallback(async (adjustmentText) => {
    if (!currentStreamContext) return
    
    try {
      // 停止当前流式处理
      if (currentStreamController && currentStreamController.abort) {
        currentStreamController.abort()
      }
      
      console.log('🔄 应用用户调整建议:', adjustmentText)
      
      // 构建调整后的消息
      const adjustmentMessage = {
        role: 'user',
        content: `[用户干预调整] ${adjustmentText}\n\n请根据上述建议重新思考并调整您的推理过程。`
      }
      
      // 重新开始AI处理，加入调整建议
      const adjustedContext = {
        ...currentStreamContext,
        messages: [...(currentStreamContext.messages || []), adjustmentMessage]
      }
      
      // 重新调用processWithLLM
      const { processWithLLM } = await import('../services/llmService')
      const result = await processWithLLM({
        ...adjustedContext,
        streamCallbacks: streamCallbacks
      })
      
      // 更新相应的消息
      if (currentStreamContext.onComplete) {
        currentStreamContext.onComplete(result)
      }
      
    } catch (error) {
      console.error('调整AI推理时出错:', error)
      setIsStreaming(false)
      setIsPaused(false)
    }
  }, [currentStreamContext, currentStreamController, streamCallbacks])

  // 发送客户回复到问题端（不触发转译）
  const sendCustomerReplyToProblem = useCallback((messageData) => {
    const customerReplyMessage = {
      type: 'ai_response', // 标记为AI回复，不是用户输入
      text: messageData.text,
      timestamp: messageData.timestamp,
      source: 'customer_reply' // 标记来源
    }
    addMessage('problem', customerReplyMessage)
  }, [addMessage])

  const sendProblemMessage = useCallback(async (messageData) => {
    // 添加用户消息到问题端
    const userMessage = {
      type: 'user',
      text: messageData.text,
      image: messageData.image,
      timestamp: messageData.timestamp
    }
    addMessage('problem', userMessage)

    // 开始LLM处理（问题端 → 方案端）
    setLlmProcessingContext('problem')
    setLlmProcessing(true)

    try {
      // 构建完整的聊天历史 - 包含所有真实的对话内容
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' })),
        userMessage // 包含当前消息（用户）
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 使用综合智能分析（需求分析 + AI建议）
      // 为本次调用注入 messageType，确保流式占位符为 comprehensive_analysis，避免误用 ai_chat
      let usedStreaming = false
      const wrappedStreamCallbacks = {
        ...streamCallbacks,
        onStreamStart: (controller, context) => {
          usedStreaming = true
          if (streamCallbacks && typeof streamCallbacks.onStreamStart === 'function') {
            streamCallbacks.onStreamStart(controller, {
              ...context,
              messageType: 'comprehensive_analysis'
            })
          }
        }
      }

      const llmResult = await processWithLLM({
        type: 'comprehensive_analysis_with_suggestion',
        content: messageData.text,
        image: messageData.image,
        context: 'problem_to_solution',
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: wrappedStreamCallbacks
      })

      // Save current needs analysis results（基础信息，稍后补充关联的综合分析消息ID）
      setCurrentNeedsAnalysis({
        originalContent: messageData.text,
        image: messageData.image,
        chatHistory: chatHistory
      })

      // 设置缺失信息选项
      setMissingInfoOptions(llmResult.missingInfoOptions || [])
      
      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: 'Comprehensive analysis',
        steps: [
          {
            name: 'Needs understanding',
            content: llmResult.needsUnderstanding
          },
          {
            name: 'Needs translation',
            content: llmResult.translation
          },
          {
            name: 'AI suggestion',
            content: llmResult.suggestion || 'Generating professional suggestions...'
          },
          {
            name: 'Missing info analysis',
            content: llmResult.missingInfoOptions && llmResult.missingInfoOptions.length > 0 
              ? `Detected ${llmResult.missingInfoOptions.length} info points to collect`
              : 'Information is sufficient; no extra info needed'
          }
        ],
        output: llmResult.suggestion || llmResult.translation,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 添加综合智能分析结果到协作工作台聊天界面
      // 若本轮为流式处理，则复用同一条流式紫色气泡，填充最终结构化字段，避免出现第二条重复气泡
      if (!usedStreaming) {
        const comprehensiveMessage = {
          type: 'comprehensive_analysis',
          text: llmResult.needsUnderstanding,
          timestamp: new Date().toISOString(),
          missingInfoOptions: llmResult.missingInfoOptions || [],
          translation: llmResult.translation,
          suggestion: llmResult.suggestion,
          aiAdvice: llmResult.aiAdvice,
          id: `comp_${Date.now()}`
        }
        addMessage('solution', comprehensiveMessage)

        // 记录本次综合分析消息ID，供后续生成的智能追问候选进行关联
        setCurrentNeedsAnalysis(prev => ({
          ...(prev || {}),
          comprehensiveId: comprehensiveMessage.id
        }))
      } else {
        setMessages(prev => {
          const newSolution = [...prev.solution]
          for (let i = newSolution.length - 1; i >= 0; i--) {
            const msg = newSolution[i]
            if (msg && msg.type === 'comprehensive_analysis' && msg.streamId) {
              newSolution[i] = {
                ...msg,
                text: llmResult.needsUnderstanding,
                translation: llmResult.translation,
                suggestion: llmResult.suggestion,
                aiAdvice: llmResult.aiAdvice,
                missingInfoOptions: llmResult.missingInfoOptions || [],
                isStreaming: false
              }
              break
            }
          }
          return { ...prev, solution: newSolution }
        })

        // 流式情况下，使用当前流的streamId作为综合分析消息ID
        setCurrentNeedsAnalysis(prev => ({
          ...(prev || {}),
          comprehensiveId: currentStreamIdRef.current
        }))
      }

      // 添加翻译后的消息到方案端
      const translatedMessage = {
        type: 'llm_request',
        text: llmResult.translation,
        timestamp: new Date().toISOString(),
        needsAnalysis: llmResult.needsUnderstanding,
        missingInfoOptions: llmResult.missingInfoOptions || []
      }
      addMessage('solution', translatedMessage)

      // 如果有缺失信息选项，显示勾选面板
      if (llmResult.missingInfoOptions && llmResult.missingInfoOptions.length > 0) {
        setShowMissingInfoPanel(true)
      }

    } catch (error) {
      console.error('LLM处理错误:', error)
      // 添加错误消息
      const errorMessage = {
        type: 'processing',
        title: 'Processing error',
        steps: [{
          name: 'Error',
          content: 'Sorry, something went wrong. Please try again later.'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setLlmProcessing(false)
      setLlmProcessingContext(null)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution])

  const sendSolutionMessage = useCallback(async (messageData) => {
    // 不再把原始输入追加到方案端消息，仅用于上下文
    const userMessage = {
      type: 'user',
      text: messageData.text,
      timestamp: messageData.timestamp
    }

    // 隐藏信息选择面板（如果正在显示）
    if (showMissingInfoPanel) {
      setShowMissingInfoPanel(false)
      setMissingInfoOptions([])
      setCurrentNeedsAnalysis(null)
    }

    // 检查是否是协商后的追问、已接受的追问或客户回复，如果是则直接发送，不需要AI转译
    const inputText = messageData.text.trim()
    
    // 检查协商后的追问
    const negotiatedFollowUp = messages.solution.find(msg => 
      (msg.type === 'followup' || msg.type === 'intelligent_followup') && 
      msg.negotiated && 
      msg.text.trim() === inputText
    )

    // 新增：检查“已接受的追问”（即使未进入协商），也走直发
    const acceptedFollowUp = messages.solution.find(msg =>
      (msg.type === 'followup' || msg.type === 'intelligent_followup') &&
      msg.feedbackGiven && msg.accepted &&
      (msg.text || '').trim() === inputText
    )

    // 检查部门联络指令中的客户回复
    const customerReplyMatch = messages.solution.find(msg => 
      msg.type === 'department_contact' && 
      msg.customerReply && 
      msg.customerReply.trim() === inputText
    )

    if (negotiatedFollowUp || acceptedFollowUp) {
      console.log('🎯 检测到协商后的追问，直接发送给用户端，跳过AI转译处理')
      
      // 直接发送到问题端，不经过AI转译
      const directMessage = {
        type: 'ai_response',
        text: inputText,
        timestamp: new Date().toISOString(),
        isNegotiated: !!negotiatedFollowUp // 标记是否为协商后的消息
      }
      addMessage('problem', directMessage)

      // 添加处理过程到中介面板（显示跳过转译）
      const skipMessage = {
        type: 'processing',
        title: '追问直达用户端',
        steps: [{
          name: '处理说明',
          content: '已接受/协商完成的追问直接发送给用户端，无需AI二次转译'
        }],
        output: inputText,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', skipMessage)
      
      return // 直接返回，不进行后续的AI处理
    }

    if (customerReplyMatch) {
      console.log('🎯 检测到客户回复内容，直接发送给用户端，跳过AI转译处理')
      
      // 直接发送到问题端，不经过AI转译
      const directMessage = {
        type: 'ai_response',
        text: inputText,
        timestamp: new Date().toISOString(),
        isCustomerReply: true // 标记为客户回复消息
      }
      addMessage('problem', directMessage)

      // 添加处理过程到中介面板（显示跳过转译）
      const skipMessage = {
        type: 'processing',
        title: '客户回复直达用户端',
        steps: [{
          name: '处理说明',
          content: '生成的客户回复直接发送给用户端，无需AI二次转译'
        }],
        output: inputText,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', skipMessage)
      
      return // 直接返回，不进行后续的AI处理
    }

    // 开始LLM处理（方案端 → 问题端）
    setLlmProcessingContext('solution')
    setLlmProcessing(true)

    try {
      // 构建完整的聊天历史 - 包含所有真实的对话内容
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' })),
        userMessage // 包含当前消息（企业方输入）
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 处理方案端响应
      const llmResult = await processWithLLM({
        type: 'solution_response',
        content: messageData.text,
        context: 'solution_to_problem',
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: 'Optimize reply for customer',
        steps: llmResult.steps,
        output: llmResult.optimizedMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 添加优化后的响应到问题端
      const optimizedMessage = {
        type: 'ai_response',
        text: llmResult.optimizedMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('problem', optimizedMessage)

    } catch (error) {
      console.error('LLM处理错误:', error)
      // 添加错误消息
      const errorMessage = {
        type: 'processing',
        title: 'Processing error',
        steps: [{
          name: 'Error',
          content: 'Sorry, something went wrong. Please try again later.'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setLlmProcessing(false)
      setLlmProcessingContext(null)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, showMissingInfoPanel])

  // 新增：生成企业端建议
  const generateSuggestion = useCallback(async () => {
    if (iterationProcessing) return

    setIterationProcessing(true)

    try {
      // 获取最新的对话内容
      const recentMessages = [
        ...messages.problem.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2),
        ...messages.solution.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2)
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      const currentContent = recentMessages.map(msg => msg.text).join('\n')

      // 构建完整的聊天历史 - 包含所有真实的对话内容
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成建议
      const llmResult = await processWithLLM({
        type: 'generate_suggestion',
        content: currentContent,
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: 'Generate suggestion',
        steps: llmResult.steps,
        output: llmResult.suggestionMessage,
        structuredOutput: llmResult.structuredOutput,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 将建议添加到方案端（作为迭代内容）
      const suggestionMessage = {
        type: 'suggestion',
        text: llmResult.suggestionMessage,
        timestamp: new Date().toISOString(),
        id: `suggestion_${Date.now()}`,
        feedbackGiven: false
      }
      addMessage('solution', suggestionMessage)

      // 进入迭代模式
      setIterationMode(true)
      setPendingResponse(llmResult.suggestionMessage)

    } catch (error) {
      console.error('生成建议错误:', error)
      const errorMessage = {
        type: 'processing',
        title: 'Suggestion error',
        steps: [{
          name: 'Error',
          content: 'Sorry, failed to generate suggestion. Please try again later.'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setIterationProcessing(false)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, iterationProcessing])

  // 新增：生成企业端追问
  const generateFollowUp = useCallback(async () => {
    if (iterationProcessing) return

    setIterationProcessing(true)

    try {
      // 获取最新的对话内容
      const recentMessages = [
        ...messages.problem.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2),
        ...messages.solution.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2)
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      const currentContent = recentMessages.map(msg => msg.text).join('\n')

      // 构建完整的聊天历史 - 包含所有真实的对话内容
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成追问
      const llmResult = await processWithLLM({
        type: 'generate_followup',
        content: currentContent,
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: 'Generate follow-up',
        steps: llmResult.steps,
        output: llmResult.followUpMessage,
        structuredOutput: llmResult.structuredOutput,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 将追问添加到方案端（作为迭代内容）
      const followUpMessage = {
        type: 'followup',
        text: llmResult.followUpMessage,
        timestamp: new Date().toISOString(),
        id: `followup_${Date.now()}`,
        feedbackGiven: false
      }
      addMessage('solution', followUpMessage)

      // 进入迭代模式
      setIterationMode(true)
      setPendingResponse(llmResult.followUpMessage)

    } catch (error) {
      console.error('生成追问错误:', error)
      const errorMessage = {
        type: 'processing',
        title: 'Follow-up error',
        steps: [{
          name: 'Error',
          content: 'Sorry, failed to generate follow-up. Please try again later.'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setIterationProcessing(false)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, iterationProcessing])

  // 新增：确认发送最终响应
  const confirmSendResponse = useCallback(async (finalResponse) => {
    if (llmProcessing) return

    // 首先添加用户的最终响应消息到方案端
    const userFinalMessage = {
      type: 'user',
      text: finalResponse,
      timestamp: new Date().toISOString()
    }
    addMessage('solution', userFinalMessage)

    setLlmProcessingContext('solution')
    setLlmProcessing(true)

    try {
      // 构建完整的聊天历史 - 包含所有真实的对话内容
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' })),
        userFinalMessage // 包含用户的最终响应
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 处理最终响应
      const llmResult = await processWithLLM({
        type: 'solution_response',
        content: finalResponse,
        context: 'solution_to_problem',
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: 'Process final response',
        steps: llmResult.steps,
        output: llmResult.optimizedMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 添加优化后的响应到问题端
      const optimizedMessage = {
        type: 'ai_response',
        text: llmResult.optimizedMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('problem', optimizedMessage)

      // 退出迭代模式
      setIterationMode(false)
      setPendingResponse(null)

    } catch (error) {
      console.error('确认发送错误:', error)
      const errorMessage = {
        type: 'processing',
        title: 'Final response error',
        steps: [{
          name: 'Error',
          content: 'Sorry, failed to process final response. Please try again later.'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setLlmProcessing(false)
      setLlmProcessingContext(null)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, llmProcessing])

  // New: Cancel iteration mode
  const cancelIteration = useCallback(() => {
    setIterationMode(false)
    setPendingResponse(null)
  }, [])

  // 新增：处理信息选项勾选
  const toggleMissingInfoOption = useCallback((index) => {
    setMissingInfoOptions(prev => 
      prev.map((option, i) => 
        i === index ? { ...option, selected: !option.selected } : option
      )
    )
  }, [])

  // 新增：生成基于选中信息的追问
  const generateFollowUpBySelectedInfo = useCallback(async () => {
    // 严格检查：防止重复调用
    if (!currentNeedsAnalysis || iterationProcessing) {
      console.log('⚠️ generateFollowUpBySelectedInfo: 条件不满足，跳过执行', {
        hasCurrentNeedsAnalysis: !!currentNeedsAnalysis,
        iterationProcessing
      })
      return
    }
    
    const selectedOptions = missingInfoOptions.filter(option => option.selected)
    if (selectedOptions.length === 0) {
      console.log('⚠️ generateFollowUpBySelectedInfo: 没有选中的选项，跳过执行')
      return
    }

    console.log('🔄 开始生成智能追问，选中选项数量:', selectedOptions.length)
    setIterationProcessing(true)
    
    // 立即隐藏面板，防止重复点击
    setShowMissingInfoPanel(false)

    // Before generating new draft, clean old smart follow-up drafts to ensure no duplicate drafts appear
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.filter(m => m.type !== 'intelligent_followup_candidate')
    }))

    try {
      // 设置流式上下文，指定消息类型为智能追问
      const intelligentFollowUpStreamCallbacks = {
        ...streamCallbacks,
        onStreamStart: (controller, context) => {
          if (streamCallbacks && streamCallbacks.onStreamStart) {
            streamCallbacks.onStreamStart(controller, {
              ...context,
              messageType: 'intelligent_followup_candidate',
              selectedInfo: selectedOptions,
              relatedComprehensiveId: currentNeedsAnalysis?.comprehensiveId
            })
          }
        }
      }

      // 生成追问（流式回调会自动创建消息，无需手动addMessage）
      const llmResult = await processWithLLM({
        type: 'generate_questions_by_selected_info',
        content: {
          originalContent: currentNeedsAnalysis.originalContent,
          selectedInfoItems: selectedOptions
        },
        scenario: currentScenario,
        chatHistory: currentNeedsAnalysis.chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: intelligentFollowUpStreamCallbacks
      })

      // 若进行了非流式严格重试，则此处返回的是最终结果字符串
      // 为避免出现“初次流式结果 + 重试结果”两条气泡，这里统一将最新结果回写到最近的候选气泡中
      if (typeof llmResult === 'string' && llmResult.trim()) {
        setMessages(prev => {
          const newSolution = [...prev.solution]
          for (let i = newSolution.length - 1; i >= 0; i--) {
            const msg = newSolution[i]
            if (msg && msg.type === 'intelligent_followup_candidate') {
              newSolution[i] = { ...msg, text: llmResult.trim(), isStreaming: false }
              break
            }
          }
          return { ...prev, solution: newSolution }
        })
      }

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: '生成智能追问',
        steps: [
          {
            name: '选中信息',
            content: selectedOptions.map(opt => `${opt.name}：${opt.description}`).join('\n')
          },
          {
            name: '生成追问',
            content: llmResult
          }
        ],
        output: llmResult,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)
      console.log('✅ 智能追问生成完成')

    } catch (error) {
      console.error('生成追问错误:', error)
      const errorMessage = {
        type: 'processing',
        title: '生成追问出错',
        steps: [{
          name: '错误信息',
          content: '抱歉，生成追问时出现了错误，请稍后重试。'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
      
      // 发生错误时重新显示面板，让用户可以重试
      setShowMissingInfoPanel(true)
    } finally {
      setIterationProcessing(false)
    }
  }, [currentNeedsAnalysis, missingInfoOptions, currentScenario, iterationProcessing, addMessage, showMissingInfoPanel])

  // 新增：跳过信息收集，直接回复
  const skipInfoCollection = useCallback(() => {
    setShowMissingInfoPanel(false)
    setMissingInfoOptions([])
    setCurrentNeedsAnalysis(null)
  }, [])

  // 新增：简单的智能追问生成（基于当前对话）
  const generateSimpleIntelligentFollowUp = useCallback(async () => {
    // 严格检查：防止与其他追问生成冲突
    if (llmProcessing || iterationProcessing) {
      console.log('⚠️ generateSimpleIntelligentFollowUp: System is processing, skipping execution')
      return
    }
    
    // 如果信息选择面板正在显示，优先使用选择式追问
    if (showMissingInfoPanel) {
      console.log('⚠️ generateSimpleIntelligentFollowUp: 信息选择面板已显示，跳过简单追问生成')
      return
    }
    
    console.log('🔄 开始生成简单智能追问')
    setIterationProcessing(true)
    
    try {
      // 获取最近的对话内容
      const recentProblemMessages = messages.problem.slice(-3)
      const recentSolutionMessages = messages.solution.slice(-3)
      
      const content = [...recentProblemMessages, ...recentSolutionMessages]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(msg => msg.text || msg.output)
        .join('\n')
      
      if (!content.trim()) {
        console.log('没有足够的对话内容生成智能追问')
        setIterationProcessing(false)
        return
      }

      // 调用LLM生成智能追问 - 简单追问不使用流式回调，只创建LLM记录
      const llmResult = await processWithLLM({
        type: 'generate_simple_followup',
        content: content,
        scenario: currentScenario,
        chatHistory: [...recentProblemMessages, ...recentSolutionMessages],
        aiChatHistory: aiChatHistory,
        streamCallbacks: null // 简单追问不创建solution面板消息，只记录到LLM面板
      })

      // 添加到LLM面板显示
      const llmMessage = {
        type: 'processing',
        title: '生成智能追问',
        steps: llmResult.steps,
        output: llmResult.followUpMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      console.log('✅ 智能追问生成完成:', llmResult.followUpMessage)
      
    } catch (error) {
      console.error('生成智能追问错误:', error)
    } finally {
      setIterationProcessing(false)
    }
  }, [llmProcessing, iterationProcessing, messages.problem, messages.solution, currentScenario, addMessage, showMissingInfoPanel])

  // 新增：独立的智能需求分析（基于当前对话）
  const generateIntelligentNeedsAnalysis = useCallback(async () => {
    if (llmProcessing || iterationProcessing) return
    
    setIterationProcessing(true)
    
    try {
      // 获取最近的问题端消息（用户输入）
      const recentProblemMessages = messages.problem.filter(msg => msg.type === 'user').slice(-2)
      
      if (recentProblemMessages.length === 0) {
        console.log('没有用户输入内容进行需求分析')
        setIterationProcessing(false)
        return
      }

      // 使用最新的用户输入进行分析
      const latestUserMessage = recentProblemMessages[recentProblemMessages.length - 1]
      
      // 构建聊天历史
      const chatHistory = [
        ...messages.problem.slice(-3),
        ...messages.solution.slice(-3)
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 调用智能需求分析
      const llmResult = await processWithLLM({
        type: 'analyze_needs_with_missing_info',
        content: latestUserMessage.text,
        image: latestUserMessage.image,
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加到LLM面板显示处理过程
      const llmMessage = {
        type: 'processing',
        title: '智能需求分析',
        steps: [
          {
            name: '需求理解',
            content: llmResult.needsUnderstanding
          },
          {
            name: '信息选项',
            content: llmResult.missingInfoOptions.map(opt => `${opt.name}：${opt.description}`).join('\n')
          },
          {
            name: '需求转译',
            content: llmResult.translation
          }
        ],
        output: llmResult.needsUnderstanding,
        timestamp: new Date().toISOString(),
        structuredOutput: llmResult.structuredOutput
      }
      addMessage('llm', llmMessage)

      // 添加智能需求分析结果到协作工作台聊天界面
      const analysisMessage = {
        type: 'needs_analysis',
        text: llmResult.needsUnderstanding,
        timestamp: new Date().toISOString(),
        missingInfoOptions: llmResult.missingInfoOptions || [],
        translation: llmResult.translation
      }
      addMessage('solution', analysisMessage)

      // 设置缺失信息选项状态
      setMissingInfoOptions(llmResult.missingInfoOptions || [])
      if (llmResult.missingInfoOptions && llmResult.missingInfoOptions.length > 0) {
        setShowMissingInfoPanel(true)
      }

      console.log('✅ 智能需求分析完成:', llmResult)
      
    } catch (error) {
      console.error('智能需求分析错误:', error)
    } finally {
      setIterationProcessing(false)
    }
  }, [llmProcessing, iterationProcessing, messages.problem, messages.solution, currentScenario, addMessage])

  // 新增：接受建议
  const acceptSuggestion = useCallback((suggestionId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === suggestionId 
          ? { ...msg, feedbackGiven: true, accepted: true }
          : msg
      )
    }))
  }, [])

  // 新增：与AI协商建议
  const negotiateSuggestion = useCallback((suggestionId) => {
    // 标记建议进入协商模式
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === suggestionId 
          ? { ...msg, negotiating: true }
          : msg
      )
    }))
  }, [])

  // New: Cancel negotiation mode
  const cancelNegotiation = useCallback((suggestionId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === suggestionId 
          ? { ...msg, negotiating: false }
          : msg
      )
    }))
  }, [])

  // New: Send negotiation request
  const sendNegotiationRequest = useCallback(async (suggestionId, negotiationText, onUpdateContent) => {
    if (!negotiationText.trim()) return

    console.log('🔄 开始处理建议协商请求:', { suggestionId, negotiationText })

    try {
      // 根据messageId格式判断是从哪个消息数组查找
      let originalSuggestion
      if (suggestionId.includes('_suggestion')) {
        // 这是来自LLM面板的消息，从messages.llm中查找
        const messageIndex = parseInt(suggestionId.split('_')[0])
        originalSuggestion = messages.llm[messageIndex]
      } else {
        // 这是来自solution面板的消息
        originalSuggestion = messages.solution.find(msg => msg.id === suggestionId)
      }
      
      if (!originalSuggestion) {
        console.error('❌ 未找到原始建议', { 
          suggestionId, 
          messagesLlmLength: messages.llm.length,
          messagesSolutionLength: messages.solution.length 
        })
        return
      }
      
      console.log('✅ 找到原始建议:', { 
        suggestionId, 
        originalSuggestionText: originalSuggestion.text || originalSuggestion.output 
      })

      // 构建协商上下文
      const chatHistory = [
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成协商后的建议
      const llmResult = await processWithLLM({
        type: 'negotiate_suggestion',
        content: {
          originalSuggestion: originalSuggestion.text || originalSuggestion.output,
          negotiationRequest: negotiationText,
          negotiationHistory: originalSuggestion.negotiationHistory || []
        },
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 不再添加处理说明到LLM面板，直接更新原内容

      // 调用回调函数更新显示内容
      if (onUpdateContent && typeof onUpdateContent === 'function') {
        console.log('🔄 调用回调函数更新建议内容:', llmResult.suggestionMessage)
        onUpdateContent(llmResult.suggestionMessage)
      } else {
        console.warn('⚠️ 未提供回调函数或回调函数无效')
      }
      
      console.log('✅ 建议协商处理完成')

      // 更新原建议为协商后的版本，保留协商历史
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg => 
          msg.id === suggestionId 
            ? { 
                ...msg, 
                text: llmResult.suggestionMessage,
                negotiating: false,
                negotiated: true,
                negotiationHistory: [
                  ...(msg.negotiationHistory || []),
                  {
                    previousText: msg.negotiationHistory?.length > 0 ? msg.text : (msg.originalText || msg.text),
                    negotiationRequest: negotiationText,
                    timestamp: new Date().toISOString()
                  }
                ],
                originalText: msg.originalText || originalSuggestion.text
              }
            : msg
        )
      }))

    } catch (error) {
      console.error('协商建议错误:', error)
      // 协商失败，退出协商模式
      cancelNegotiation(suggestionId)
    }
  }, [messages.problem, messages.solution, currentScenario, addMessage, cancelNegotiation])

  // 新增：拒绝建议并重新生成
  const rejectSuggestion = useCallback(async (suggestionId) => {
    // 标记建议为已拒绝
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === suggestionId 
          ? { ...msg, feedbackGiven: true, accepted: false }
          : msg
      )
    }))

    // 重新生成建议
    await generateSuggestion()
  }, [generateSuggestion])

  // 新增：接受追问
  const acceptFollowUp = useCallback((followUpId, onSetInput) => {
    const followUpMessage = messages.solution.find(msg => msg.id === followUpId)
    if (!followUpMessage) return

    // 标记为已接受
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, feedbackGiven: true, accepted: true }
          : msg
      )
    }))

    // 将追问内容填入输入框
    if (onSetInput && typeof onSetInput === 'function') {
      onSetInput(followUpMessage.text)
    }

    // 设为直发候选，等待对比确认
    setDirectSendCandidate({
      type: 'followup',
      sourceMessageId: followUpId,
      sourceText: followUpMessage.text,
      createdAt: new Date().toISOString()
    })
  }, [messages.solution])

  // 新增：与AI协商追问
  const negotiateFollowUp = useCallback((followUpId) => {
    // 标记追问进入协商模式
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, negotiating: true }
          : msg
      )
    }))
  }, [])

  // New: Cancel follow-up negotiation mode
  const cancelFollowUpNegotiation = useCallback((followUpId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, negotiating: false }
          : msg
      )
    }))
  }, [])

  // 新增：发送追问协商请求
  const sendFollowUpNegotiationRequest = useCallback(async (followUpId, negotiationText, onUpdateContent) => {
    if (!negotiationText.trim()) return

    console.log('🔄 开始处理追问协商请求:', { followUpId, negotiationText })

    try {
      // 根据messageId格式判断是从哪个消息数组查找
      let originalFollowUp
      if (followUpId.includes('_followup')) {
        // 这是来自LLM面板的消息，从messages.llm中查找
        const messageIndex = parseInt(followUpId.split('_')[0])
        originalFollowUp = messages.llm[messageIndex]
      } else {
        // 这是来自solution面板的消息
        originalFollowUp = messages.solution.find(msg => msg.id === followUpId)
      }
      
      if (!originalFollowUp) {
        console.error('未找到原始追问，followUpId:', followUpId)
        return
      }

      // 构建协商上下文
      const chatHistory = [
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成协商后的追问
      const llmResult = await processWithLLM({
        type: 'negotiate_followup',
        content: {
          originalFollowUp: originalFollowUp.text || originalFollowUp.output,
          negotiationRequest: negotiationText,
          negotiationHistory: originalFollowUp.negotiationHistory || []
        },
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 不再添加处理说明到LLM面板，直接更新原内容

      // 调用回调函数更新显示内容
      if (onUpdateContent && typeof onUpdateContent === 'function') {
        onUpdateContent(llmResult.followUpMessage)
      }

      // 更新原追问为协商后的版本，保留协商历史
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg => 
          msg.id === followUpId 
            ? { 
                ...msg, 
                text: llmResult.followUpMessage,
                negotiating: false,
                negotiated: true,
                negotiationHistory: [
                  ...(msg.negotiationHistory || []),
                  {
                    previousText: msg.negotiationHistory?.length > 0 ? msg.text : (msg.originalText || msg.text),
                    negotiationRequest: negotiationText,
                    timestamp: new Date().toISOString()
                  }
                ],
                originalText: msg.originalText || originalFollowUp.text
              }
            : msg
        )
      }))

      // 协商完成后，将协商后的追问自动填入输入框
      if (onSetInput && typeof onSetInput === 'function') {
        onSetInput(llmResult.followUpMessage)
      }

    } catch (error) {
      console.error('协商追问错误:', error)
      // 协商失败，退出协商模式
      cancelFollowUpNegotiation(followUpId)
    }
  }, [messages.problem, messages.solution, currentScenario, addMessage, cancelFollowUpNegotiation])

  // 新增：拒绝追问并重新生成
  const rejectFollowUp = useCallback(async (followUpId) => {
    // 标记追问为已拒绝
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, feedbackGiven: true, accepted: false }
          : msg
      )
    }))

    // 重新生成追问
    await generateFollowUp()
  }, [generateFollowUp])

  // 新增：接受智能追问
  const acceptIntelligentFollowUp = useCallback((followUpId, onSetInput) => {
    const followUpMessage = messages.solution.find(msg => msg.id === followUpId)
    if (!followUpMessage) return

    // 标记为已接受
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, feedbackGiven: true, accepted: true }
          : msg
      )
    }))

    // 将追问内容填入输入框
    if (onSetInput && typeof onSetInput === 'function') {
      onSetInput(followUpMessage.text)
    }

    // 设为直发候选，等待对比确认
    setDirectSendCandidate({
      type: 'intelligent_followup',
      sourceMessageId: followUpId,
      sourceText: followUpMessage.text,
      createdAt: new Date().toISOString()
    })
  }, [messages.solution])

  // 新增：确认直发到问题端（不转译）
  const confirmDirectSendToProblem = useCallback((finalText) => {
    if (!finalText || !finalText.trim()) return

    // 直接发送到问题端
    const directMessage = {
      type: 'ai_response',
      text: finalText.trim(),
      timestamp: new Date().toISOString(),
      isDirectFollowUp: true,
      candidateType: directSendCandidate?.type
    }
    addMessage('problem', directMessage)

    // 在中介面板记录一次处理说明
    const infoMessage = {
      type: 'processing',
      title: '追问直达用户端',
      steps: [{
        name: '处理说明',
        content: '已确认直发，跳过AI转译'
      }],
      output: finalText.trim(),
      timestamp: new Date().toISOString()
    }
    addMessage('llm', infoMessage)

    // 清空候选
    setDirectSendCandidate(null)
  }, [addMessage, directSendCandidate])

  // New: Cancel direct send process, keep input box content
  const cancelDirectSend = useCallback(() => {
    setDirectSendCandidate(null)
  }, [])

  // 新增：外部准备直发候选（用于“应用客户回复”按钮）
  const prepareDirectSendCandidate = useCallback((candidate) => {
    if (!candidate || !candidate.sourceText) return
    setDirectSendCandidate({
      type: candidate.type || 'customer_reply',
      sourceMessageId: candidate.sourceMessageId,
      sourceText: candidate.sourceText,
      createdAt: new Date().toISOString()
    })
  }, [])

  // 新增：拒绝智能追问
  const rejectIntelligentFollowUp = useCallback(async (followUpId) => {
    // 标记追问为已拒绝
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, feedbackGiven: true, accepted: false }
          : msg
      )
    }))

    // 可以选择重新生成或者回到信息选择界面
    setShowMissingInfoPanel(true)
  }, [])

  // 新增：协商智能追问
  const negotiateIntelligentFollowUp = useCallback((followUpId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, negotiating: true }
          : msg
      )
    }))
  }, [])

  // New: Cancel intelligent follow-up negotiation
  const cancelIntelligentFollowUpNegotiation = useCallback((followUpId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === followUpId 
          ? { ...msg, negotiating: false }
          : msg
      )
    }))
  }, [])

  // 新增：发送智能追问协商请求
  const sendIntelligentFollowUpNegotiationRequest = useCallback(async (followUpId, negotiationText, onSetInput) => {
    if (!negotiationText.trim()) return

    try {
      // 获取原始追问
      const originalFollowUp = messages.solution.find(msg => msg.id === followUpId)
      if (!originalFollowUp) return

      // 构建协商上下文
      const chatHistory = [
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成协商后的追问
      const llmResult = await processWithLLM({
        type: 'negotiate_followup',
        content: {
          originalFollowUp: originalFollowUp.text || originalFollowUp.output,
          negotiationRequest: negotiationText,
          negotiationHistory: originalFollowUp.negotiationHistory || []
        },
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: '协商修改智能追问',
        steps: llmResult.steps,
        output: llmResult.followUpMessage,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 更新原追问为协商后的版本，保留协商历史
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg => 
          msg.id === followUpId 
            ? { 
                ...msg, 
                text: llmResult.followUpMessage,
                negotiating: false,
                negotiated: true,
                negotiationHistory: [
                  ...(msg.negotiationHistory || []),
                  {
                    previousText: msg.negotiationHistory?.length > 0 ? msg.text : (msg.originalText || msg.text),
                    negotiationRequest: negotiationText,
                    timestamp: new Date().toISOString()
                  }
                ],
                originalText: msg.originalText || originalFollowUp.text
              }
            : msg
        )
      }))

      // 协商完成后，将协商后的追问自动填入输入框
      if (onSetInput && typeof onSetInput === 'function') {
        onSetInput(llmResult.followUpMessage)
      }

    } catch (error) {
      console.error('协商智能追问错误:', error)
      // 协商失败，退出协商模式
      cancelIntelligentFollowUpNegotiation(followUpId)
    }
  }, [messages.problem, messages.solution, currentScenario, addMessage, cancelIntelligentFollowUpNegotiation])

  // 生成部门联络指令
  // AI协作对话功能 - 具有完整上下文记忆
  const chatWithAI = useCallback(async (question) => {
    console.log('🤖 开始AI协作对话:', { question, previousChatHistory: aiChatHistory.length })

    try {
      // First add user question to AI conversation history
      const userMessage = {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString()
      }
      
      // 将用户消息添加到UI显示的消息列表中
      const userDisplayMessage = {
        type: 'user',
        text: question,
        timestamp: new Date().toISOString(),
        generatedInMode: chatMode // Save mode when generated
      }
      addMessage('solution', userDisplayMessage)
      
      // 构建完整的AI协作对话上下文（包括之前的所有对话）
      const fullAiChatHistory = [...aiChatHistory, userMessage]
      
      // 构建完整的聊天上下文 - 包含所有相关信息
      const fullChatContext = {
        // 1. AI协作对话历史 (ChatGPT风格的对话记录)
        aiChatHistory: fullAiChatHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        
        // 2. 客户问题端的完整对话历史 - 包含所有消息
        customerMessages: messages.problem.map(msg => ({
          type: msg.type,
          content: msg.text || msg.content || '',
          timestamp: msg.timestamp,
          role: msg.type === 'user' ? 'customer' : 'system',
          panel: 'problem'
        })),
        
        // 3. 解决方案端的所有消息 - 不过滤，包含全部
        solutionMessages: messages.solution.map(msg => ({
          type: msg.type,
          content: msg.text || msg.content || '',
          timestamp: msg.timestamp,
          panel: 'solution'
        })),
        
        // 4. LLM处理端的所有消息
        llmMessages: messages.llm ? messages.llm.map(msg => ({
          type: msg.type,
          content: msg.output || msg.text || msg.content || '',
          timestamp: msg.timestamp,
          panel: 'llm'
        })) : [],
        
        // 5. 当前场景信息
        scenario: {
          name: currentScenario?.name || 'retail',
          problemRole: currentScenario?.problemRole || '客户',
          solutionRole: currentScenario?.solutionRole || '客服代表'
        },
        
        // 6. 当前聊天模式
        chatMode
      }
      
      console.log('📋 完整对话上下文:', {
        aiChatHistoryLength: fullChatContext.aiChatHistory.length,
        customerMessagesLength: fullChatContext.customerMessages.length,
        solutionMessagesLength: fullChatContext.solutionMessages.length,
        llmMessagesLength: fullChatContext.llmMessages.length,
        scenario: fullChatContext.scenario
      })
      
      // 设置流式上下文，指定消息类型
      const streamContext = {
        ...fullChatContext,
        messageType: 'ai_chat',
        question: question
      }

      // 调用LLM进行AI对话，传递完整的对话历史和上下文
      const llmResult = await processWithLLM({
        type: 'ai_chat',
        content: question,
        scenario: currentScenario,
        // 传递完整的聊天上下文
        chatHistory: fullChatContext,
        // 保持向后兼容
        aiChatHistory: fullAiChatHistory,
        currentContext: fullChatContext,
        streamCallbacks: {
          ...streamCallbacks,
          onStreamStart: (controller, context) => {
            // 调用原始回调
            streamCallbacks.onStreamStart(controller, {
              ...context,
              messageType: 'ai_chat',
              question: question,
              chatMode: chatMode // 传递当前聊天模式
            })
          }
        }
      })

      // 创建AI回复消息
      const assistantMessage = {
        role: 'assistant',
        content: llmResult.answer,
        timestamp: new Date().toISOString()
      }

      // 更新AI对话历史（添加用户问题和AI回复）
      setAiChatHistory(prev => [...prev, userMessage, assistantMessage])

      // 流式消息已经通过streamCallbacks添加到solution面板了，这里需要更新为完整的ai_chat格式
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg => 
          msg.isStreaming && msg.streamId === streamingMessage?.streamId 
            ? { 
                ...msg, 
                type: 'ai_chat',
                question: question,
                answer: llmResult.answer,
                text: llmResult.answer,
                error: llmResult.error,
                conversationId: Date.now(),
                isStreaming: false
              }
            : msg
        )
      }))

      console.log('✅ AI协作对话完成:', { 
        answer: llmResult.answer, 
        chatHistoryLength: fullAiChatHistory.length + 1 
      })

    } catch (error) {
      console.error('❌ AI协作对话失败:', error)
      
      // 更新正在流式显示的消息为错误状态
      if (streamingMessage) {
        setMessages(prev => ({
          ...prev,
          solution: prev.solution.map(msg => 
            msg.streamId === streamingMessage.streamId 
              ? { 
                  ...msg,
                  type: 'ai_chat',
                  question: question,
                  answer: 'AI协作功能暂时不可用，建议稍后再次尝试。我已记住本次对话，您可以稍后继续',
                  text: 'AI协作功能暂时不可用，建议稍后再次尝试。我已记住本次对话，您可以稍后继续',
                  error: true,
                  isStreaming: false
                }
              : msg
          )
        }))
      }
      
      // 即使出错，也要记录用户的问题到历史中
      const userMessage = {
        role: 'user', 
        content: question,
        timestamp: new Date().toISOString()
      }
      setAiChatHistory(prev => [...prev, userMessage])
    }
  }, [addMessage, currentScenario, aiChatHistory, messages.problem, chatMode, streamCallbacks])

  // 清空AI协作对话历史
  const clearAiChatHistory = useCallback(() => {
    setAiChatHistory([])
    console.log('🗑️ AI协作对话历史已清空')
  }, [])

  // 智能生成给客户的回复（基于任意一条AI消息内容）
  const generateCustomerReplyForMessage = useCallback(async (message) => {
    console.log('🔍 useMessageFlow - generateCustomerReplyForMessage 被调用')
    console.log('🔍 接收到的消息参数:', message)
    try {
      // 选择最合适的基础内容
      const baseContent = (
        message?.translation ||
        message?.suggestion ||
        message?.aiAdvice ||
        message?.answer ||
        message?.text ||
        ''
      ).toString()

      console.log('🔍 客户回复生成调试:', { 
        message, 
        baseContent: baseContent.substring(0, 100) + '...',
        isEmpty: !baseContent.trim()
      })

      if (!baseContent.trim()) {
        console.log('❌ 基础内容为空，无法生成客户回复')
        return ''
      }

      // 在协作工作台添加占位气泡
      const candidateId = `candidate_${Date.now()}`
      const placeholder = {
        id: candidateId,
        type: 'customer_reply_candidate',
        text: 'Generating reply...',
        timestamp: new Date().toISOString(),
        isStreaming: true
      }
      setMessages(prev => ({
        ...prev,
        solution: [...prev.solution, placeholder]
      }))

      // 构建完整的聊天历史 - 与确认发送流程保持一致
      const chatHistory = [
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 创建只显示思考过程但不创建消息的特殊流式回调（修正：对齐原有回调签名）
      const customerReplyStreamCallbacks = {
        ...streamCallbacks,
        onStreamStart: (controller, context) => {
          console.log('🚀 客户回复生成: 流式开始，只显示思考过程')
          const customContext = {
            ...context,
            isCustomerReply: true,
            suppressMessageCreation: true
          }
          if (streamCallbacks && streamCallbacks.onStreamStart) {
            streamCallbacks.onStreamStart(controller, customContext)
          }
        },
        onThinking: (fragment, fullContent) => {
          if (streamCallbacks && streamCallbacks.onThinking) {
            streamCallbacks.onThinking(fragment, fullContent)
          }
        },
        onAnswering: (fragment, fullContent) => {
          if (streamCallbacks && streamCallbacks.onAnswering) {
            streamCallbacks.onAnswering(fragment, fullContent)
          }
        },
        onStreamEnd: (finalThinking, finalAnswer) => {
          console.log('✅ 客户回复生成: 流式结束')
          if (streamCallbacks && streamCallbacks.onStreamEnd) {
            streamCallbacks.onStreamEnd(finalThinking, finalAnswer)
          }
        },
        onStreamError: (error) => {
          console.error('❌ 客户回复生成: 流式错误', error)
          if (streamCallbacks && streamCallbacks.onStreamError) {
            streamCallbacks.onStreamError(error)
          }
        }
      }

      const llmResult = await processWithLLM({
        type: 'solution_response',
        content: baseContent,
        context: 'solution_to_problem',
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: customerReplyStreamCallbacks // 使用特殊的流式回调，只显示思考过程
      })

      console.log('🔍 LLM结果:', { llmResult, optimizedMessage: llmResult?.optimizedMessage })

      // 不做任何处理、筛选、截断，直接使用生成的内容
      const optimized = llmResult?.optimizedMessage || ''
      
      console.log('🔍 最终优化结果（无处理）:', { optimized, isEmpty: !optimized })

      // 更新占位气泡为生成结果
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg =>
          msg.id === candidateId
            ? { ...msg, text: optimized || '（空）', isStreaming: false }
            : msg
        )
      }))

      return optimized
    } catch (error) {
      console.error('生成客户回复失败:', error)
      console.log('🔍 错误详情:', { error: error.message, stack: error.stack })
      // 失败时标记占位为错误
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg =>
          msg.type === 'customer_reply_candidate' && msg.isStreaming
            ? { ...msg, text: '生成失败，请重试', isStreaming: false, error: true }
            : msg
        )
      }))
      return ''
    }
  }, [messages.problem, messages.solution, currentScenario])

  // New: Negotiate modifications to customer reply draft
  const negotiateCustomerReplyCandidate = useCallback(async (candidateId, negotiationText, onUpdateContent) => {
    if (!negotiationText || !negotiationText.trim()) return

    try {
      // Find original draft
      const originalCandidate = messages.solution.find(msg => msg.type === 'customer_reply_candidate' && msg.id === candidateId)
      if (!originalCandidate) {
        console.error('Customer reply draft not found, candidateId:', candidateId)
        return
      }

      // 构建完整的聊天历史（与生成一致）
      const chatHistory = [
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // Combine negotiation request text: provide modification requirements based on original draft
      const negotiationBase = `【Original Customer Reply Draft】\n${originalCandidate.text}\n\n【Modification Requirements】\n${negotiationText}\n\nPlease output the optimized customer reply directly based on the modification requirements, keeping it concise and friendly.`

      const llmResult = await processWithLLM({
        type: 'solution_response',
        content: negotiationBase,
        context: 'solution_to_problem',
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: null
      })

      const optimized = llmResult?.optimizedMessage || ''

      // Update original draft text
      setMessages(prev => ({
        ...prev,
        solution: prev.solution.map(msg =>
          msg.id === candidateId && msg.type === 'customer_reply_candidate'
            ? { ...msg, text: optimized || msg.text, negotiated: true }
            : msg
        )
      }))

      if (onUpdateContent && typeof onUpdateContent === 'function') {
        onUpdateContent(optimized)
      }
    } catch (error) {
      console.error('协商修改客户回复失败:', error)
    }
  }, [messages.problem, messages.solution, currentScenario])

  // 生成部门联络指令（仅联络指令）
  const generateDepartmentContactOnly = useCallback(async () => {
    if (iterationProcessing) return

    setIterationProcessing(true)

    try {
      // 获取最新的对话内容作为联络指令的基础
      const recentMessages = [
        ...messages.problem.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2),
        ...messages.solution.filter(m => m.type === 'user' || m.type === 'ai_response').slice(-2)
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      const currentContent = recentMessages.map(msg => msg.text).join('\n') || '基于当前对话生成联络指令'

      // 构建完整的聊天历史
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成部门联络指令
      const llmResult = await processWithLLM({
        type: 'generate_department_contact_only',
        content: currentContent,
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: '生成部门联络',
        steps: llmResult.steps,
        structuredOutput: llmResult.structuredOutput,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      console.log('✅ 部门联络指令生成完成')

    } catch (error) {
      console.error('生成部门联络指令时出错:', error)
      // 添加错误消息
      const errorMessage = {
        type: 'processing',
        title: '生成部门联络出错',
        steps: [{
          name: '错误信息',
          content: '抱歉，生成部门联络指令时出现了错误，请稍后重试。'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setIterationProcessing(false)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, iterationProcessing])

  const generateDepartmentContact = useCallback(async (suggestion) => {
    if (iterationProcessing) return

    setIterationProcessing(true)

    try {
      // 构建完整的聊天历史
      const chatHistory = [
        // 问题端的所有消息：用户输入 + AI优化后的回复
        ...messages.problem
          .filter(msg => msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'problem' })),
        // 方案端的所有消息：AI转译的请求 + 企业用户输入 + AI回复
        ...messages.solution
          .filter(msg => msg.type === 'llm_request' || msg.type === 'user' || msg.type === 'ai_response')
          .map(msg => ({ ...msg, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      // 生成部门联络指令
      const llmResult = await processWithLLM({
        type: 'generate_department_contact',
        content: suggestion,
        scenario: currentScenario,
        chatHistory: chatHistory,
        aiChatHistory: aiChatHistory,
        streamCallbacks: streamCallbacks
      })

      // 添加LLM处理过程到中介面板
      const llmMessage = {
        type: 'processing',
        title: '生成客户回复和部门联络',
        steps: llmResult.steps,
        output: `客户回复：${llmResult.customerReply}\n\n联络指令：${llmResult.contactInstruction}`,
        structuredOutput: llmResult.structuredOutput,
        timestamp: new Date().toISOString()
      }
      addMessage('llm', llmMessage)

      // 将联络指令添加到方案端（作为特殊消息类型）
      const contactMessage = {
        type: 'department_contact',
        customerReply: llmResult.customerReply,
        contactInstruction: llmResult.contactInstruction,
        timestamp: new Date().toISOString(),
        id: `contact_${Date.now()}`,
        instructionSent: false, // 初始化为未发送状态
        sentTimestamp: null,
        customerReplyApplied: false, // 初始化为未应用状态
        appliedTimestamp: null
      }
      addMessage('solution', contactMessage)

    } catch (error) {
      console.error('生成部门联络指令时出错:', error)
      // 添加错误消息
      const errorMessage = {
        type: 'processing',
        title: '生成客户回复和部门联络出错',
        steps: [{
          name: '错误信息',
          content: '抱歉，生成部门联络指令时出现了错误，请稍后重试。'
        }],
        timestamp: new Date().toISOString()
      }
      addMessage('llm', errorMessage)
    } finally {
      setIterationProcessing(false)
    }
  }, [addMessage, currentScenario, messages.problem, messages.solution, iterationProcessing])

  // 标记联络指令为已发送
  const markContactInstructionSent = useCallback((contactId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === contactId && msg.type === 'department_contact' ? {
          ...msg,
          instructionSent: true,
          sentTimestamp: new Date().toISOString()
        } : msg
      )
    }))
  }, [])

  // 标记客户回复为已应用
  const markCustomerReplyApplied = useCallback((contactId) => {
    setMessages(prev => ({
      ...prev,
      solution: prev.solution.map(msg => 
        msg.id === contactId && msg.type === 'department_contact' ? {
          ...msg,
          customerReplyApplied: true,
          appliedTimestamp: new Date().toISOString()
        } : msg
      )
    }))
    console.log('✅ 客户回复已标记为应用状态', contactId)
  }, [])

  // 新增：清空所有状态
  const clearAllStates = useCallback(() => {
    setMessages({
      problem: [],
      llm: [],
      solution: []
    })
    setIterationMode(false)
    setPendingResponse(null)
    setMissingInfoOptions([])
    setShowMissingInfoPanel(false)
    setCurrentNeedsAnalysis(null)
    setChatMode('normal')
    setDepartmentModalVisible(false)
    setEmergencyModalVisible(false)
  }, [])

  // 新增：生成部门联络建议（改进版：确保AI参与）
  const generateDepartmentContactSuggestion = useCallback(async () => {
    console.log('📞 generateDepartmentContactSuggestion被调用')
    console.log('📊 当前状态:', { 
      llmProcessing, 
      iterationProcessing, 
      problemMessages: messages.problem.length,
      solutionMessages: messages.solution.length,
      currentScenario 
    })
    
    if (llmProcessing || iterationProcessing) {
      console.log('⏸️ Skipping execution: processing in progress')
      return
    }

    setIterationProcessing(true)

    try {
      // 获取最近的对话内容
      const recentMessages = [
        ...messages.problem.slice(-3),
        ...messages.solution.slice(-3)
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

      const content = recentMessages
        .map(msg => msg.text || msg.output || '')
        .filter(text => text.trim())
        .join('\n')

      console.log('📝 对话内容:', { content: content.substring(0, 100), isEmpty: !content.trim() })

      // Improvement: Call AI to generate contact suggestions and internal instructions regardless of conversation content
      const contextInfo = content.trim() ? content : '暂无具体对话内容，需要生成通用的部门联络方案'
      
      console.log('🤖 调用LLM生成智能部门联络建议和内部指令（流式显示）')
      
      // 设置流式上下文，指定消息类型为部门联络
      const streamContext = {
        messageType: 'department_contact_with_instructions',
        chatMode: 'department'
      }
      
      // 调用LLM生成部门联络建议（新的类型：包含内部指令，支持流式）
      await processWithLLM({
        type: 'generate_department_contact_with_instructions',
        content: contextInfo,
        scenario: currentScenario,
        chatHistory: recentMessages,
        streamCallbacks: {
          ...streamCallbacks,
          onStreamStart: (controller, context) => {
            // 调用原始回调
            streamCallbacks.onStreamStart(controller, {
              ...context,
              messageType: 'department_contact_with_instructions',
              chatMode: 'department'
            })
          }
        }
      })

      console.log('✅ 部门联络建议流式生成完成')

    } catch (error) {
      console.error('生成部门联络建议失败:', error)
      // 提供错误后的默认建议
      const errorSuggestion = `⚠️ **系统提示：** 生成建议时出现错误，请手动联络相关部门或切换至普通对话模式。
      
**备用联络方案：**
📞 **客服主管** - 立即联系处理当前情况
📧 **内部指令：** 请将此对话记录发送给相关负责人`
      const suggestionMessage = {
        type: 'department_contact_with_instructions',
        text: errorSuggestion,
        timestamp: new Date().toISOString(),
        isError: true,
        generatedInMode: chatMode // Save mode when generated
      }
      addMessage('solution', suggestionMessage)
    } finally {
      setIterationProcessing(false)
      console.log('🏁 generateDepartmentContactSuggestion执行完成')
    }
  }, [llmProcessing, iterationProcessing, messages.problem, messages.solution, currentScenario, addMessage])

  // 新增：聊天模式管理方法
  const switchChatMode = useCallback((mode) => {
    console.log('🔄 switchChatMode被调用:', mode)
    setChatMode(mode)
    
    if (mode === 'department') {
      // 部门联络模式不需要模态框，直接生成建议
      console.log('📞 开始生成部门联络建议')
      // 立即执行部门联络建议生成
      setTimeout(() => {
        generateDepartmentContactSuggestion()
      }, 100) // 小延迟确保状态更新完成
    } else if (mode === 'emergency') {
      setEmergencyModalVisible(true)
    } else {
      // 普通模式，清除所有模态框状态
      setDepartmentModalVisible(false)
      setEmergencyModalVisible(false)
    }
  }, [generateDepartmentContactSuggestion])

  // 新增：处理紧急情况
  const handleEmergencyMode = useCallback(async (urgencyLevel, description) => {
    if (llmProcessing || iterationProcessing) return

    setIterationProcessing(true)

    try {
      // 构建紧急处理请求
      const emergencyData = {
        urgencyLevel, // 'high', 'critical', 'urgent'
        description,
        context: {
          scenario: currentScenario,
          recentMessages: [
            ...messages.problem.slice(-2),
            ...messages.solution.slice(-2)
          ]
        },
        timestamp: new Date().toISOString()
      }

      // 设置流式上下文，指定消息类型为紧急响应
      const emergencyStreamCallbacks = {
        ...streamCallbacks,
        onStreamStart: (controller, context) => {
          if (streamCallbacks && streamCallbacks.onStreamStart) {
            streamCallbacks.onStreamStart(controller, {
              ...context,
              messageType: 'emergency_response',
              chatMode: 'emergency',
              urgencyLevel: urgencyLevel,
              description: description,
              escalated: urgencyLevel === 'critical'
            })
          }
        }
      }

      // 调用LLM生成紧急处理方案（流式回调会自动创建消息，无需手动addMessage）
      const llmResult = await processWithLLM({
        type: 'emergency_handling',
        content: emergencyData,
        scenario: currentScenario,
        streamCallbacks: emergencyStreamCallbacks
      })

      // 如果是关键级别，自动发送升级通知
      if (urgencyLevel === 'critical') {
        const escalationMessage = {
          type: 'escalation_notice',
          text: `关键级别紧急情况已自动上报管理层\n时间：${new Date().toLocaleString()}\n描述：${description}`,
          timestamp: new Date().toISOString()
        }
        addMessage('solution', escalationMessage)
      }

    } catch (error) {
      console.error('处理紧急情况失败:', error)
      const errorMessage = {
        type: 'emergency_error',
        text: '紧急处理系统暂时不可用，请立即联系直属上级或拨打紧急联系电话。',
        timestamp: new Date().toISOString(),
        isError: true
      }
      addMessage('solution', errorMessage)
    } finally {
      setIterationProcessing(false)
    }
  }, [llmProcessing, iterationProcessing, currentScenario, messages.problem, messages.solution, addMessage])

  // 新增：关闭模式弹窗
  const closeModeModal = useCallback((mode) => {
    if (mode === 'department') {
      setDepartmentModalVisible(false)
    } else if (mode === 'emergency') {
      setEmergencyModalVisible(false)
    }
    setChatMode('normal')
  }, [])

  // 新增：只关闭紧急模态框，保持紧急状态
  const closeEmergencyModalOnly = useCallback(() => {
    setEmergencyModalVisible(false)
    // 不改变聊天模式，保持emergency状态
  }, [])

  return {
    messages,
    llmProcessing,
    llmProcessingContext,
    iterationProcessing,
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
    generateCustomerReplyForMessage,
    negotiateCustomerReplyCandidate,
    // 智能追问反馈相关方法
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
    clearMessages: clearAllStates
  }
}