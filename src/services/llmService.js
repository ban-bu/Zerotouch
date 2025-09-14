// [MODIFIED] ModelScope LLM Service - DeepSeek-V3.1 Thinking Mode
// Impact: Switch to ModelScope API, model DeepSeek-V3.1, enable thinking mode and streaming
// Features: Separate reasoning from final answer; console shows full messages; AI only returns final answer
// Backward Compatibility: Preserve original function/constant names and request structure; callers need no changes

// ModelScope API configuration
const MODELSCOPE_CONFIG = {
  // [MODIFIED] Use DeepSeek-V3.1 model with thinking mode
  baseURL: '/api/dashscope',  // 使用本地代理
  model: 'deepseek-v3.1',
  apiKeys: [
    'sk-6c561648158845498bd79405450ebcd1',  // primary key (updated)
    'sk-6c561648158845498bd79405450ebcd1'   // backup key (same as primary)
  ],
  currentKeyIndex: 0
}

// Log helper function (avoid outputting overly long content and sensitive information)
const truncateForLog = (text, maxLength = 2000) => {
  if (typeof text !== 'string') return text
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…(truncated)'
}

const formatMessagesForLog = (messages) => {
  try {
    return messages.map(m => ({
      role: m.role,
      content: truncateForLog(m.content)
    }))
  } catch (_) {
    return '[unserializable messages]'
  }
}

// General function to call ModelScope API (supports automatic switching of multiple API keys) - DeepSeek-V3.1 thinking mode version
const callModelScopeAPI = async (messages, temperature = 0.7, maxTokens = 4096, streamCallbacks = null, opts = {}) => {
  const { enableThinking = true, stream = true } = opts || {}
  const maxRetries = MODELSCOPE_CONFIG.apiKeys.length
  let lastError = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentApiKey = MODELSCOPE_CONFIG.apiKeys[MODELSCOPE_CONFIG.currentKeyIndex]
    
    try {
      // Enforce English output across the app (UI internationalization)
      const languageEnforcer = {
        role: 'system',
        content: 'Language policy: Respond in English only. Do not use Chinese characters. Keep responses concise, professional, and user-friendly.'
      }
      const patchedMessages = Array.isArray(messages) ? [languageEnforcer, ...messages] : [languageEnforcer]
      const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
      console.group('[LLM] DeepSeek-V3.1 Request Details (Thinking Mode)')
      console.log('🔹 Model:', MODELSCOPE_CONFIG.model)
      console.log('🔑 API Key Index:', MODELSCOPE_CONFIG.currentKeyIndex + 1, '/', MODELSCOPE_CONFIG.apiKeys.length)
      console.log('🔹 Temperature:', temperature)
      console.log('🔹 Total Messages:', patchedMessages.length)
      console.log('🧠 Thinking Mode:', enableThinking ? 'Enabled' : 'Disabled')
      console.log('📡 Stream Mode:', stream ? 'Enabled' : 'Disabled')
      
      // Always show complete prompt content (formatted)
      console.group('📝 Complete Prompt Content')
      try {
        patchedMessages.forEach((message, index) => {
          console.group(`💬 Message ${index + 1}: [${message.role.toUpperCase()}]`)
          console.log(message.content)
          console.groupEnd()
        })
      } catch (error) {
        console.log('Error displaying messages:', error)
      }
      console.groupEnd()
      
      // Additional JSON format display in development environment
      if (isDev) {
        console.group('🔧 Debug Info (JSON Format)')
        try {
          console.log('messages JSON:', JSON.stringify(patchedMessages, null, 2))
        } catch (_) {
          console.log('Failed to serialize messages to JSON')
        }
        console.groupEnd()
      }
      
      console.time('[LLM] ⏱️ Request Latency')
      console.log('🔍 callModelScopeAPI - About to request:', `${MODELSCOPE_CONFIG.baseURL}/chat/completions`)
      
      // Send request (configurable for thinking mode and streaming)
      const response = await fetch(`${MODELSCOPE_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentApiKey}`
        },
        body: JSON.stringify({
          model: MODELSCOPE_CONFIG.model,
          messages: patchedMessages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: stream,  // stream mode
          enable_thinking: enableThinking  // thinking mode
        })
      })

      if (!response.ok) {
        console.timeEnd('[LLM] ⏱️ Request Latency')
        console.log('❌ HTTP Status:', response.status, response.statusText)
        
        // Try to get detailed error info
        let errorDetail = ''
        try {
          const errorData = await response.json()
          console.log('❌ API Error Details:', errorData)
          errorDetail = errorData.error?.message || errorData.message || ''
        } catch (e) {
          console.log('❌ Failed to parse error response')
        }
        
        // If it's a 429 error and there are retry opportunities, switch to next key and wait
        if (response.status === 429 && attempt < maxRetries - 1) {
          MODELSCOPE_CONFIG.currentKeyIndex = (MODELSCOPE_CONFIG.currentKeyIndex + 1) % MODELSCOPE_CONFIG.apiKeys.length
          console.log('🔄 Rate limit hit, switching to API key', MODELSCOPE_CONFIG.currentKeyIndex + 1)
          
          // Backoff before retrying next key
          const waitTime = (attempt + 1) * 2000 // 2s, 4s, 6s...
          console.log(`⏳ Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          
          console.groupEnd()
          lastError = new Error(`API call failed: ${response.status} ${response.statusText}${errorDetail ? ' - ' + errorDetail : ''}`)
          continue // Retry next key
        }
        
        console.groupEnd()
        const errorMsg = errorDetail ? `API call failed: ${response.status} ${response.statusText} - ${errorDetail}` : `API call failed: ${response.status} ${response.statusText}`
        throw new Error(errorMsg)
      }

      // Non-streaming mode: directly parse JSON and return
      if (!stream) {
        try {
          const data = await response.json()
          console.timeEnd('[LLM] ⏱️ Request Latency')

          let finalAnswer = ''
          // Typical OpenAI/ModelScope structure
          if (data && Array.isArray(data.choices) && data.choices.length > 0) {
            const choice = data.choices[0]
            // DeepSeek/ModelScope may put reasoning in message.reasoning_content
            const maybeMessage = choice.message || {}
            finalAnswer = (maybeMessage.content || choice.text || data.output_text || '').toString()
          } else if (typeof data.output_text === 'string') {
            finalAnswer = data.output_text
          } else if (typeof data.text === 'string') {
            finalAnswer = data.text
          }

          console.group('📤 Response Statistics')
          console.log('💬 Final answer length:', (finalAnswer || '').length, 'characters')
          if (data.usage) {
            console.log('💰 Token Usage:', data.usage)
          }
          console.groupEnd()

          console.group('✅ Final Answer')
          console.log(finalAnswer || '(Empty response)')
          console.groupEnd()

          console.groupEnd() // End main Request Details group
          return (finalAnswer || '').trim()
        } catch (e) {
          // Fallback to text if JSON parsing fails
          console.log('⚠️ Failed to parse non-stream JSON, reading text instead')
          const textData = await response.text()
          console.timeEnd('[LLM] ⏱️ Request Latency')
          console.group('✅ Final Answer (raw)')
          console.log(textData || '(Empty response)')
          console.groupEnd()
          console.groupEnd()
          return (textData || '').trim()
        }
      }

      // Handle streaming response, separate reasoning and final answer
      let reasoningContent = ""
      let answerContent = ""
      let isAnswering = false
      let usage = null
      
      console.group("🧠 DeepSeek-V3.1 Reasoning")
      console.log("=".repeat(50))
      
      // Streaming controller
      let reader = null
      const streamController = {
        isPaused: false,
        isAborted: false,
        pause: () => {
          console.log('⏸️ Pausing AI reasoning')
          streamController.isPaused = true
          // Immediately cancel reader if exists
          if (reader) {
            try {
              reader.cancel('User requested pause')
            } catch (e) {
              console.log('⏸️ Reader cancel failed:', e.message)
            }
          }
          if (streamCallbacks && streamCallbacks.onStreamPaused) {
            streamCallbacks.onStreamPaused()
          }
        },
        resume: () => {
          console.log('▶️ Resuming AI reasoning')
          streamController.isPaused = false
        },
        abort: () => {
          console.log('🛑 Aborting AI reasoning')
          streamController.isAborted = true
          if (reader) {
            reader.cancel()
          }
        }
      }

      // Notify UI: streaming started
      if (streamCallbacks && streamCallbacks.onStreamStart) {
        const context = {
          messages: messages,
          temperature: temperature,
          maxTokens: maxTokens,
          onComplete: (result) => {
            // Optional completion hook
            console.log('Streaming completed, result:', result)
          }
        }
        streamCallbacks.onStreamStart(streamController, context)
      }
      
      reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Unable to acquire response stream')
      }
      
      try {
        let shouldAbort = false
        
        while (true) {
          // Check aborted
          if (streamController.isAborted || shouldAbort) {
            console.log('🛑 Streaming aborted')
            break
          }
          
          // Check paused (fast loop)
          while (streamController.isPaused && !streamController.isAborted) {
            await new Promise(resolve => setTimeout(resolve, 5))
          }
          
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            // Check paused before each line
            if (streamController.isAborted || shouldAbort) {
              console.log('🛑 Streaming aborted (line)')
              shouldAbort = true
              break
            }
            
            if (!line.startsWith('data: ')) continue
            
            const dataStr = line.slice(6) // remove 'data: '
            if (dataStr === '[DONE]') continue
            
            try {
              const data = JSON.parse(dataStr)
              
              // Collect usage info (keep processing content in same chunk)
              if (data.usage) {
                usage = data.usage
              }
              
              if (!data.choices || data.choices.length === 0) {
                continue
              }
              
              const delta = data.choices[0].delta
              
              // Check paused before each delta
              while (streamController.isPaused && !streamController.isAborted) {
                await new Promise(resolve => setTimeout(resolve, 1))
              }
              
              // Check aborted
              if (streamController.isAborted) {
                console.log('🛑 Streaming aborted (delta)')
                shouldAbort = true
                break
              }
              
              // Append reasoning content
              if (delta.reasoning_content !== undefined && delta.reasoning_content !== null && delta.reasoning_content !== "") {
                // Check paused before outputting chunk
                if (streamController.isPaused) {
                  break
                }
                console.log('🧠 Reasoning chunk:', delta.reasoning_content)
                reasoningContent += delta.reasoning_content
                
                // Callback for reasoning stream
                if (streamCallbacks && streamCallbacks.onThinking) {
                  streamCallbacks.onThinking(delta.reasoning_content, reasoningContent)
                }
              }
              
              // Append answer content
              if (delta.content !== undefined && delta.content !== null) {
                // Check paused before outputting answer chunk
                if (streamController.isPaused) {
                  break
                }
                if (!isAnswering) {
                  console.log("\n" + "=".repeat(20) + " Full Answer " + "=".repeat(20))
                  isAnswering = true
                }
                if (delta.content && delta.content !== "") {
                  console.log('💬 Answer chunk:', delta.content)
                  
                  // Callback for answer stream
                  if (streamCallbacks && streamCallbacks.onAnswering) {
                    streamCallbacks.onAnswering(delta.content, answerContent + delta.content)
                  }
                }
                answerContent += delta.content
              }
            } catch (parseError) {
              console.log('Error parsing streaming data:', parseError)
              continue
            }
          }
          
          // Check abort flag set inside
          if (shouldAbort) {
            break
          }
        }
      } finally {
        reader.releaseLock()
      }
      
      console.log()
      console.groupEnd()
      
      console.timeEnd('[LLM] ⏱️ Request Latency')
      
      // Notify UI: streaming finished
      if (streamCallbacks && streamCallbacks.onStreamEnd) {
        streamCallbacks.onStreamEnd(reasoningContent, answerContent)
      }
      
      // Show processing statistics
      console.group('📤 Response Statistics')
      console.log('🧠 Reasoning length:', reasoningContent.length, 'characters')
      console.log('💬 Final answer length:', answerContent.length, 'characters')
      if (usage) {
        console.log('💰 Token Usage:', usage)
      }
      console.groupEnd()
      
      // Show complete reasoning (collapsed)
      console.groupCollapsed('🧠 Complete Reasoning Process')
      console.log(reasoningContent || '(No reasoning content)')
      console.groupEnd()
      
      // Show complete final answer
      console.group('✅ Final Answer')
      console.log(answerContent || '(Empty response)')
      console.groupEnd()
      
      console.groupEnd()
      
      // Return only final answer (no reasoning)
      return answerContent.trim()
      
    } catch (error) {
      try { console.groupEnd() } catch (_) {}
      console.groupCollapsed('[LLM] Error')
      console.error('DeepSeek-V3.1 API call error:', error)
      console.groupEnd()
      
      // If it's a 429 error and there are other API keys available, log error but don't throw
      if (error.message.includes('429') && attempt < maxRetries - 1) {
        lastError = error
        continue
      }
      
      throw error
    }
  }
  
  // If all API keys failed, throw last error
  throw lastError || new Error('All API keys have reached usage limits')
}

// Sanitize output: remove templated apologies or boilerplate guidance
const sanitizeOutput = (text) => {
  if (!text) return text
  const bannedPhrases = [
    '^I am very sorry.*$',
    '^I\'m very sorry.*$',
    '^Sorry.*$',
    '^I apologize.*$',
    'I could not understand',
    'I couldn\'t understand',
    'Please describe.*in detail',
    'Please provide more information',
    'Insufficient information',
    'Please correct me if.*',
    'Hello!.*help you',
    'Are you.*looking for.*type of product',
    'Clothes, shoes,? or other.*',
    'Thank you for your feedback',
    'We (greatly|highly) value',
    'If you have any questions',
    'If you need.*help',
    'Please feel free to contact',
    '(customer support|support team)',
    'We will.*(do our best|try our best).*resolve',
    'We appreciate your understanding',
    'Please ignore this conversation',
    'Continue browsing.*(services|information)',
    'Welcome.*contact us'
  ]
  let sanitized = text
  bannedPhrases.forEach((p) => {
    const regex = new RegExp(p, 'gi')
    sanitized = sanitized.replace(regex, '')
  })
  return sanitized.trim()
}

// Gentle cleaning function specifically for follow-ups and suggestions
const sanitizeFollowUpOutput = (text) => {
  if (!text) return text
  // Remove only obvious templates; avoid deleting valid content
  const bannedPhrases = [
    '^I am very sorry.*$',
    '^I\'m very sorry.*$',
    '^Sorry.*$',
    'I could not understand your request',
    'Please describe in detail',
    'Insufficient information, cannot',
    'Please correct me if.*',
    'Thank you for your feedback, we.*value',
    'If you have any questions, please feel free to contact',
    'The customer support team will',
    'The support team will',
    'Thank you for your understanding'
  ]
  let sanitized = text
  bannedPhrases.forEach((p) => {
    const regex = new RegExp(p, 'gmi')
    sanitized = sanitized.replace(regex, '')
  })
  return sanitized.trim()
}

// Ensure complete sentence: append period if missing
const ensureCompleteSentence = (text) => {
  if (!text) return text
  const trimmed = text.trim()
  if (/[.!?]$/.test(trimmed)) return trimmed
  return trimmed + '.'
}

// Ensure complete statement: keep punctuation
const ensureQuestionEnding = (text) => {
  if (!text) return text
  let trimmed = text.trim()
  // If no punctuation at end, append period
  if (!/[!?]$/.test(trimmed)) {
    trimmed = trimmed.endsWith('.') ? trimmed.replace(/\.$/, '?') : trimmed + '?'
  }
  return trimmed
}

// Strip leading pleasantries (only at start)
const stripLeadingPleasantries = (text) => {
  if (!text) return text
  let out = text.trim()
  out = out.replace(/^(hello|hi)[!,.\s]*/i, '')
  out = out.replace(/^(pleased to.*|glad to.*)[.!?]+\s*/i, '')
  out = out.replace(/^(thank(s| you)[\s\S]{0,20}?)[.!?]+\s*/i, '')
  return out.trim()
}

// Heuristic: detect weak single-sentence outputs
const isWeakOneSentence = (text) => {
  if (!text) return true
  const t = text.trim()
  if (t.length < 12) return true
  if (/^(hello|hi)/i.test(t)) return true
  return false
}

// AI Chat Function - General AI Query (Enhanced: Support Full Context)
const chatWithAI = async (userQuestion, currentScenario, chatHistory = [], fullContext = null, streamCallbacks = null) => {
  try {
    console.log('[LLM] Starting AI collaborative chat:', { 
      userQuestion, 
      scenario: currentScenario, 
      hasFullContext: !!fullContext,
      chatHistoryLength: chatHistory.length,
      chatMode: fullContext?.chatMode 
    })
    
    // Check current chat mode
    const chatMode = fullContext?.chatMode || 'normal'
    const isDepartmentMode = chatMode === 'department'
    const isEmergencyMode = chatMode === 'emergency'
    
    // Build detailed context information
    let contextInfo = ''
    
    if (fullContext && typeof fullContext === 'object') {
      // Use new complete context format
      const { aiChatHistory = [], customerMessages = [], solutionMessages = [], llmMessages = [], scenario = {}, chatMode } = fullContext
      
      contextInfo = `
### 📋 Workbench Information Analysis:

**🎯 Current Service Scenario**
- Industry: ${scenario.name || currentScenario || 'retail'} (Retail)
- Customer Identity: ${scenario.problemRole || 'Customer'}  
- You are assisting: ${scenario.solutionRole || 'Customer Service Representative'}
${isDepartmentMode ? '- **🔗 Current Mode: Contact Mode** - Focus on department coordination and internal instruction formulation' : ''}
${isEmergencyMode ? '- **🚨 Current Mode: Emergency Mode** - Focus on emergency incident handling and rapid response' : ''}

**💬 Your conversation history with customer service**（Understanding what you've discussed before）
${aiChatHistory.length > 0 
  ? aiChatHistory.map(msg => `${msg.role === 'user' ? '👨‍💼Customer Service' : '🤖You'}: ${msg.content}`).join('\n')
  : '📝 First conversation, no history'
}

**👥 Real dialogue between customers and customer service**（Analyzing core information of customer needs）
${customerMessages.length > 0 
  ? customerMessages.map(msg => `${msg.role === 'customer' ? '👤Customer' : '🏪System'}: ${msg.content}`).join('\n')
  : '📭 No customer dialogue yet, customer service may have encountered general issues'
}

**🛠️ Workbench Processing Records**（Suggestions and tools already provided by the system）
${solutionMessages.length > 0 
  ? solutionMessages.map(msg => {
      const typeMap = {
        'user': '👨‍💼Customer Service Input',
        'ai_response': '🤖AI Reply',
        'llm_request': '⚙️AI Processing',
        'suggestion': '💡AI Suggestion',
        'followup': '❓AI Follow-up', 
        'intelligent_followup': '🧠Intelligent Follow-up',
        'department_contact': '🏢Department Contact',
        'needs_analysis': '🔍Needs Analysis',
        'ai_chat': '💬AI Collaboration'
      }
      return `${typeMap[msg.type] || msg.type}: ${msg.content}`
    }).join('\n')
  : '📄 No work records, this is a new consultation'
}

**🔧 AI Analysis Processing Records**（System analysis results）
${llmMessages.length > 0 
  ? llmMessages.map(msg => `📊 ${msg.type}: ${msg.content}`).join('\n')
  : '🆕 No AI analysis records'
}`
    } else if (chatHistory && chatHistory.length > 0) {
      // Compatible with old chat history format
      contextInfo = `
### 📋 Basic Conversation Information:

**📝 Historical Conversation Records**
${chatHistory.slice(-8).map(msg => 
  `${msg.panel || msg.role || 'User'}: ${msg.text || msg.content}`
).join('\n')}`
    } else {
      contextInfo = `
### 📋 Workbench Information Analysis:

**🎯 Current Service Scenario**
- Industry: ${currentScenario || 'retail'} (Retail)
- Situation: Brand new conversation, no historical records

**💡 Tip:** Customer service may need general guidance or encountered new issues`
    }

    // Choose different system prompt based on mode
    let systemPrompt
    
    if (isDepartmentMode) {
      // Contact mode specific prompts
      systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system specifically designed to optimize enterprise internal collaboration. The platform is currently in contact mode, specifically assisting customer service in cross-departmental communication and internal coordination.

【Function Description】Customer service has activated the "AI Collaboration Assistant" and selected contact mode. The core function of this feature is: to provide professional departmental coordination guidance for customer service, including problem attribution analysis, contact strategy formulation, and internal instruction generation, helping customer service efficiently coordinate resources across departments.

【Generation Instructions】Please provide departmental coordination solutions based on the professional requirements of contact mode:
1. Identify the most suitable department to handle the problem
2. Provide specific contact strategies and internal instructions
3. Provide necessary communication scripts
4. Ensure suggestions are immediately executable

**⚡ Mandatory Requirement: Responses must be extremely concise, single-point answers, no more than 3 sentences, direct to the core, strictly prohibiting lengthy expressions, explanations, background descriptions, word counts or any unnecessary content. Only say key information!**

## Workbench Information Analysis:

${contextInfo}

=== Customer Service Questions in Contact Mode ===
"${userQuestion}"

## Please provide professional department coordination guidance based on the above information:`
    } else if (isEmergencyMode) {
      // Emergency mode specific prompts
      systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system specifically designed to handle crisis events. The platform is currently in emergency mode, specifically assisting customer service in quickly and professionally handling emergency situations and crisis management.

【Function Description】Customer service has activated the "AI Collaboration Assistant" and selected emergency mode. The key function of this feature is: to provide immediate crisis handling guidance for customer service, including risk assessment, emergency plan formulation, and escalation mechanism guidance, ensuring emergency situations receive timely and effective handling.

【Generation Instructions】Please conduct rapid analysis of emergency situations and provide emergency handling solutions based on the professional requirements of emergency mode:
1. Quickly assess the urgency level and impact scope of the incident
2. Provide immediately executable emergency handling measures
3. Clarify escalation timing, escalation paths, and key contacts
4. Provide professional crisis communication scripts and response strategies

**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**

## Workbench Information Analysis:

${contextInfo}

=== Customer Service Questions in Emergency Mode ===
"${userQuestion}"

## Please quickly provide emergency handling guidance based on the above information:`
    } else {
      // Normal mode original prompts
      systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system specifically designed to provide real-time guidance for frontline customer service representatives, helping them better handle customer inquiries and improve service quality.

【Function Description】Customer service has activated the "AI Collaboration Assistant" function. The core value of this function is: when customer service encounters difficulties in handling customer inquiries, the system can provide specific and feasible handling suggestions and professional script guidance based on current conversation situations and workbench records.

【Generation Instructions】Please provide practical guidance based on professional customer service collaboration requirements:
1. Identify customer needs and key issues
2. Based on workbench records, provide targeted suggestions  
3. Provide specific scripts and handling solutions
4. Ensure suggestions comply with ${currentScenario || 'retail'} industry characteristics

**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**

## Workbench Information Analysis:

${contextInfo}

=== Customer Service Questions to You ===
"${userQuestion}"

## Please provide professional guidance for customer service based on the above information:`
    }

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userQuestion
      }
    ]

    const response = await callModelScopeAPI(messages, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
    const aiAnswer = response.trim()
    
    console.log('[LLM] AI collaboration suggestion completed:', { 
      question: userQuestion,
      answer: aiAnswer 
    })
    
    return {
      answer: aiAnswer,
      timestamp: new Date().toISOString()
    }
    
  } catch (error) {
    console.error('[LLM] AI collaboration suggestion failed:', error)
    return {
      answer: 'AI collaboration function temporarily unavailable, please try again later',
      timestamp: new Date().toISOString(),
      error: true
    }
  }
}

// [MODIFIED] Robust parsing and stripping tool, avoid re-translating AI suggestions
// Impact: Ensure that `llm_request` sent to solution side only contains "requirements translation" text
// Backward Compatibility: Does not change external API, only enhances parsing robustness
const findFirstIndex = (text, keywords) => {
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword)
    if (idx !== -1) return { idx, keyword }
  }
  return { idx: -1, keyword: '' }
}

// Build chat history context utility function with detailed logging (preserved: may still be used by individual legacy paths)
const buildChatContextWithLogging = (chatHistory, contextType = 'Chat History Context', maxMessages = 6) => {
  if (!chatHistory || chatHistory.length === 0) {
    console.log('ℹ️ No chat history available for context')
    return ''
  }
  
  // Log complete chat history to console
  console.group('🔍 Chat History Analysis')
  console.log(`📊 Total History Messages: ${chatHistory.length}`)
  console.log(`📝 Using Recent Messages: ${Math.min(chatHistory.length, maxMessages)}`)
  
  const recentHistory = chatHistory.slice(-maxMessages)
  recentHistory.forEach((msg, index) => {
    let role = 'AI Processing'
    
    // 🔧 Corrected role mapping logic: accurately identify customer and enterprise messages
    if (msg.type === 'user') {
      if (msg.panel === 'problem') {
        role = '👤Customer'
      } else if (msg.panel === 'solution') {
        role = '👨‍💼Enterprise CS'
      } else {
        // If panel field is missing, intelligently infer message source
        console.warn(`⚠️ Message panel field abnormal: panel="${msg.panel}"`)
        const content = msg.text?.toLowerCase() || ''
        // Judge whether it's customer or enterprise side based on content characteristics
        if (content.includes('return') || content.includes('complaint') || content.includes('dissatisfied') || 
            content.includes('problem') || content.includes('help') || content.includes('inquiry')) {
          role = '👤Customer'
          console.log(`🔧 Intelligent inference: Judged as customer message based on content characteristics`)
        } else {
          role = '👨‍💼Enterprise CS'
          console.log(`🔧 Intelligent inference: Judged as enterprise message based on content characteristics`)
        }
      }
    } else if (msg.type === 'ai_response') {
      role = msg.panel === 'problem' ? '🤖System Reply(Customer)' : '🤖System Reply(Enterprise)'
    } else if (msg.type === 'llm_request') {
      role = '⚙️AI Requirements Translation'
    } else if (msg.type === 'ai_chat') {
      role = '🤖AI Collaboration Assistant'
    }
    
    const preview = msg.text?.substring(0, 100)
    const truncated = msg.text?.length > 100 ? '...' : ''
    
    // Detailed debugging information
    console.log(`${index + 1}. [${role}]: ${preview}${truncated}`)
    console.log(`   🔍 Debug: type="${msg.type}", panel="${msg.panel}", timestamp="${msg.timestamp}"`)
  })
  console.groupEnd()
  
  const chatContext = `\n\n${contextType}：\n` + 
    recentHistory.map((msg, index) => {
      let role = 'AI Processing'
      
      // 🔧 Corrected role mapping logic: accurately identify customer and enterprise messages
      if (msg.type === 'user') {
        if (msg.panel === 'problem') {
          role = '👤Customer'
        } else if (msg.panel === 'solution') {
          role = '👨‍💼Enterprise CS'
        } else {
          // If panel field is missing, intelligently infer message source
          console.warn(`⚠️ Message panel field abnormal: panel="${msg.panel}", content preview: "${msg.text?.substring(0, 50)}..."`)
          const content = msg.text?.toLowerCase() || ''
          // Judge whether it's customer or enterprise side based on content characteristics
          if (content.includes('return') || content.includes('complaint') || content.includes('dissatisfied') || 
              content.includes('problem') || content.includes('help') || content.includes('inquiry')) {
            role = '👤Customer'
            console.log(`🔧 Intelligent inference: Judged as customer message based on content characteristics`)
          } else {
            role = '👨‍💼Enterprise CS'
            console.log(`🔧 Intelligent inference: Judged as enterprise message based on content characteristics`)
          }
        }
      } else if (msg.type === 'ai_response') {
        role = msg.panel === 'problem' ? '🤖System Reply(Customer)' : '🤖System Reply(Enterprise)'
      } else if (msg.type === 'llm_request') {
        role = '⚙️AI Requirements Translation'
      } else if (msg.type === 'ai_chat') {
        role = '🤖AI Collaboration Assistant'
      }
      
      return `${index + 1}. ${role}: ${msg.text}`
    }).join('\n')
  
  return chatContext
}

// New: Build "consumer communication full history + AI collaboration full history" context (no truncation, no trimming)
const buildDualHistoryContext = (consumerHistory, aiChatHistory = []) => {
  let consumerMessages = []
  try {
    if (Array.isArray(consumerHistory)) {
      consumerMessages = consumerHistory
    } else if (consumerHistory && typeof consumerHistory === 'object') {
      // Compatible with fullContext structure passed by chatWithAI
      const { customerMessages = [], solutionMessages = [] } = consumerHistory
      consumerMessages = [
        ...customerMessages.map(m => ({ ...m, panel: 'problem' })),
        ...solutionMessages.map(m => ({ ...m, panel: 'solution' }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    }
  } catch (e) {
    console.warn('⚠️ Exception occurred while building consumer history, will fall back to empty array', e)
    consumerMessages = []
  }

  const consumerSection = consumerMessages.length > 0
    ? consumerMessages.map((msg, index) => {
        let role = 'AI Processing'
        if (msg.type === 'user') {
          role = msg.panel === 'problem' ? '👤Customer' : '👨‍💼Enterprise CS'
        } else if (msg.type === 'ai_response') {
          role = msg.panel === 'problem' ? '🤖System Reply(Customer)' : '🤖System Reply(Enterprise)'
        } else if (msg.type === 'llm_request') {
          role = '⚙️AI Requirements Translation'
        }
        const content = msg.text || msg.output || msg.content || ''
        return `${index + 1}. ${role}: ${content}`
      }).join('\n')
    : '(None)'

  const aiSection = Array.isArray(aiChatHistory) && aiChatHistory.length > 0
    ? aiChatHistory.map((m, i) => {
        const role = m.role === 'user' ? '👨‍💼Collaboration User' : '🤖AI Collaboration Assistant'
        return `${i + 1}. ${role}: ${m.content}`
      }).join('\n')
    : '(None)'

  const full = `\n\n【Consumer Communication History - Full】\n${consumerSection}\n\n【AI Collaboration History - Full】\n${aiSection}`
  return full
}

const parseSectionsRobust = (raw) => {
  const text = typeof raw === 'string' ? raw : ''
  const sections = {
    translation: '',
    solutionsText: '',
    confirmationsText: ''
  }

  // Multi-title compatibility - anglicized titles
  const translationKeys = ['【REQUIREMENTS TRANSLATION】', '【NEEDS TRANSLATION】', '【TRANSLATION RESULT】', '【REQUIREMENTS CLARIFICATION】', 'Requirements Translation', 'Needs Translation', 'Translation Result', 'Requirements Clarification', 'Customer Needs Translation', 'User Needs Translation']
  const solutionKeys = ['【SOLUTION SUGGESTIONS】', '【RECOMMENDED SOLUTIONS】', '【ACTION RECOMMENDATIONS】', 'Solution Suggestions', 'Recommended Solutions', 'Solution Recommendations', 'Action Recommendations']
  const confirmKeys = ['【INFORMATION TO CONFIRM】', '【INFO TO VERIFY】', '【PENDING CONFIRMATION】', 'Information to Confirm', 'Info to Verify']

  const t = findFirstIndex(text, translationKeys)
  const s = findFirstIndex(text, solutionKeys)
  const c = findFirstIndex(text, confirmKeys)

  const endOf = (startIdx) => {
    if (startIdx === -1) return text.length
    const candidates = [s.idx, c.idx, text.length].filter((v) => v !== -1 && v > startIdx)
    return Math.min(...candidates)
  }

  // Extract requirements translation
  if (t.idx !== -1) {
    const start = t.idx + t.keyword.length
    const end = endOf(t.idx)
    sections.translation = text.slice(start, end).trim()
  } else if (s.idx !== -1) {
    // Translation title not found, but solution title found: take content before solution as translation
    sections.translation = text.slice(0, s.idx).trim()
  }

  // Extract solution suggestions (for intermediary panel display)
  if (s.idx !== -1) {
    const start = s.idx + s.keyword.length
    const end = c.idx !== -1 ? c.idx : text.length
    sections.solutionsText = text.slice(start, end).trim()
  }

  // Extract pending confirmation information (for intermediary panel display)
  if (c.idx !== -1) {
    const start = c.idx + c.keyword.length
    sections.confirmationsText = text.slice(start).trim()
  }

  // 兜底：若仍未抽取到转译，尽量剥离明显"方案/建议"段落
  if (!sections.translation) {
    const firstSolutionIdx = s.idx !== -1 ? s.idx : text.search(/\n?\s*(方案|选项|建议)\s*[1-9]/)
    if (firstSolutionIdx !== -1 && firstSolutionIdx > 0) {
      sections.translation = text.slice(0, firstSolutionIdx).trim()
    } else {
      const truncated = text.slice(0, 500)
      const split = truncated.split(/\n{2,}/)
      sections.translation = (split[0] || truncated).trim()
    }
  }

  return sections
}

// 处理问题端输入 - 增强版本，支持聊天历史和深度理解
const processProblemInput = async (content, image, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    // 根据场景定制提示词 - 增强版本
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system dedicated to eliminating communication barriers by connecting customers with business stores, making bilateral communication smoother and more efficient.\n\n【Function Description】When customers input requirements on the left side of the interface, the system triggers the "Requirements Analysis" function button. This button serves to: intelligently translate customers\' everyday expressions into professional descriptions that businesses can understand, while generating specific solution recommendations to help businesses better understand and respond to customer needs.\n\n【Generation Instructions】Please perform professional processing of customer input based on the above platform functions: accurately understand customers\' real needs and potential intentions, transform them into professional descriptions that businesses can understand and execute, provide specific feasible solution options based on business capabilities, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Communication Scenario】In retail customer-store communication environments, there are often expression differences between parties: customers use everyday language and their needs may not be clear enough, while businesses are accustomed to replying with professional terminology. The platform needs to serve as a bridge between them.\n\n【Processing Requirements】\n1. Deep Understanding: Analyze customers\' explicit and implicit needs, identifying possible expression biases\n2. Accurate Translation: Transform customer needs into professional descriptions containing key information such as product types, usage scenarios, budget ranges, specification requirements, etc.\n3. Solution Recommendations: Based on translation results, provide 2-3 specific feasible solution options for businesses, including product recommendations, service suggestions, price ranges, etc.\n4. Language Purification: When encountering inappropriate expressions, crude language, or emotional vocabulary, intelligently identify the actual intent behind them, transforming them into professional, neutral expressions, never directly quoting or repeating original inappropriate content',
        example: 'Example: Customer says "I need clothing suitable for business occasions" → Translation: "Customer needs business formal wear for important meetings, budget to be confirmed, requires professional image" → Solution suggestions: "1) Recommend classic business suit sets, price 800-1500 yuan, includes free alteration service 2) Recommend business casual wear, price 500-800 yuan, suitable for daily business occasions 3) Provide personal image consultant service, customize matching solutions based on specific needs"\n\nInappropriate language handling example: When customer inputs inappropriate expressions → Translation: "Customer expressed strong emotions, may have dissatisfaction with products, services, or experience. Need to understand specific issues to provide targeted solutions" → Solution suggestions: "1) Actively inquire about specific problems or difficulties encountered 2) Provide one-on-one customer service specialist communication 3) Arrange relevant departments to follow up based on problem nature"'
      },
      enterprise: {
        systemRole: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system specifically designed to solve internal cross-departmental communication problems within enterprises, helping business departments and technical departments establish effective communication bridges.\n\n【Function Description】When business departments express requirements on the left side of the interface, the system activates the "Requirements Translation" function button. This button\'s purpose is to: convert business language into professional descriptions that technical teams can understand, generate specific feasible technical solutions, and eliminate communication deviations between departments.\n\n【Generation Instructions】Please perform professional processing of business requirements based on the platform\'s cross-departmental communication function: accurately understand business departments\' requirements and technical departments\' capability boundaries, eliminate communication deviations between departments, provide specific feasible technical solution options, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Communication Scenario】In enterprise internal cross-departmental collaboration environments, different departments use different professional languages: business departments focus on effectiveness and time, while technical departments focus on feasibility and resources. The platform serves as a translator, ensuring consistent understanding between both parties.\n\n【Processing Requirements】\n1. Requirements Analysis: Transform business requirements into technical-understandable functional requirements, including specific indicators, time limits, and resource constraints\n2. Solution Design: Provide 2-3 solution options of different complexity levels based on technical capabilities\n3. Risk Assessment: Identify potential technical risks and resource requirements during implementation\n4. Language Purification: When encountering inappropriate expressions, crude language, or emotional vocabulary, intelligently identify the actual intent behind them, transforming them into professional, neutral expressions, never directly quoting or repeating original inappropriate content',
        example: 'Example: Marketing department says "We need to improve user experience" → Translation: "Need to develop user experience optimization features, goal to improve user retention rate, within 3 months" → Solution suggestions: "1) Quick solution: Optimize existing interface and interaction, expected to improve retention by 10%, requires 2 weeks, cost 50K 2) Medium solution: Redesign core processes, expected to improve retention by 25%, requires 6 weeks, cost 150K 3) Deep solution: Comprehensive reconstruction of user experience, expected to improve retention by 40%, requires 3 months, cost 400K"\n\nInappropriate language handling example: When departments express inappropriate emotions → Translation: "Department expressed strong concern about current project progress, may have communication coordination or resource allocation issues. Need to clarify specific problem points and improvement directions" → Solution suggestions: "1) Arrange cross-departmental coordination meetings to clarify responsibilities and timelines 2) Evaluate whether current resource allocation is reasonable, adjust manpower or budget allocation 3) Establish regular communication mechanisms to timely discover and resolve issues"'
      },
      education: {
        systemRole: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI education assistant dedicated to improving teacher-student communication, connecting students\' learning needs with teachers\' teaching solutions, making educational communication more precise and effective.\n\n【Function Description】When students express learning difficulties on the left side of the interface, the system activates the "Learning Diagnosis" function button. This button serves to: translate students\' learning confusion into teaching points that teachers can understand, generate diverse teaching solution options, helping teachers develop personalized teaching strategies.\n\n【Generation Instructions】Please perform professional analysis of student needs based on the platform\'s educational communication function: deeply understand students\' learning difficulties and knowledge blind spots, transform them into actionable teaching points for teachers, provide diverse teaching solution options, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Communication Scenario】In teacher-student interactive educational environments, there may be cognitive gaps between both parties: students cannot accurately express learning difficulties, and teachers may use overly professional language. The platform needs to establish understanding bridges between them.\n\n【Processing Requirements】\n1. Learning Diagnosis: Analyze students\' specific difficulty points, knowledge background, and learning styles\n2. Teaching Translation: Transform learning needs into professional descriptions containing knowledge points, difficulty analysis, and teaching objectives\n3. Solution Recommendations: Provide 2-3 specific implementation plans for different teaching methods\n4. Language Purification: When encountering inappropriate expressions, crude language, or emotional vocabulary, intelligently identify the actual intent behind them, transforming them into professional, neutral expressions, never directly quoting or repeating original inappropriate content',
        example: `Example: Student says "I don't understand this concept" → Translation: "Student has difficulty understanding the wave-particle duality concept in quantum physics, needs to start from basic concepts, establish cognition through experimental examples" → Solution suggestions: "1) Experimental demonstration method: Through classic experiments like double-slit experiment, intuitively demonstrate wave-particle duality, suitable for visual learners 2) Analogy teaching method: Use analogies of water waves and marbles to help understand abstract concepts, suitable for students with strong logical thinking 3) Progressive teaching: Start from basic properties of light, gradually introduce quantum concepts, suitable for students with weaker foundations"

Inappropriate language handling example: When students express frustration → Translation: "Student encountered difficulties in the learning process, showing frustration and learning pressure. Need to adjust teaching methods, provide more support and encouragement" → Solution suggestions: "1) Lower learning difficulty, start explaining from more basic knowledge points 2) Use encouraging teaching methods, affirm students' efforts and progress 3) Provide individual tutoring, solve learning difficulties in a targeted manner"`
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`无效的场景类型: ${scenario}。支持的场景: ${Object.keys(scenarioPrompts).join(', ')}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Build chat history context（包含详细日志）
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)
    
    // 为每个场景定制独立的增强指令
    const enhancedInstructions = {
      retail: `Enhanced Instructions (Retail Scenario):
1. Consumer Psychology Insight: Deeply understand customers' purchasing motivations, price sensitivity, quality expectations, and usage scenarios
2. Product Value Translation: Convert technical parameters into practical usage value, highlighting how products solve customers' specific problems
3. Purchase Decision Support: Provide clear product comparisons, cost-benefit analysis, and purchase recommendations to reduce decision costs
4. Service Experience Optimization: Emphasize pre-sales consultation, after-sales guarantee and other service values to enhance purchase confidence
5. Personalized Recommendations: Based on customer need characteristics, provide precise product recommendations and matching suggestions
6. Promotional Strategy Integration: Reasonably integrate promotional information, limited-time activities, etc., to create purchase urgency
7. Retail Style Restrictions: Avoid over-promotional language, prohibit using informal terms like "dear", "oh", maintain professional and friendly retail service tone
8. Retail Scenario Inappropriate Language Handling: Transform customer dissatisfaction into specific product or service improvement needs, focusing on returns/exchanges, quality issues, price disputes and other common retail problems' professional expression`,
      
      enterprise: `Enhanced Instructions (Enterprise Scenario):
1. Business Value Orientation: Convert technical solutions into quantifiable value indicators such as business revenue, cost savings, and efficiency improvements
2. Executive-Level Communication: Use language that decision-makers care about, highlighting key elements like ROI, risk control, and competitive advantages
3. Implementation Path Planning: Provide clear project timelines, milestone nodes, resource allocation, and risk contingency plans
4. Cross-Departmental Coordination: Consider different departments' interests and concerns, provide solutions that balance all parties' needs
5. Compliance Assurance: Ensure solutions comply with industry regulations, legal requirements, and internal corporate policy requirements
6. Scalability Design: Consider enterprise future development needs, provide forward-looking solutions
7. Enterprise Style Restrictions: Use formal business language, avoid colloquial expressions, maintain professional and rigorous enterprise communication style
8. Enterprise Scenario Inappropriate Language Handling: Transform inter-departmental conflicts or dissatisfaction into management-level improvement suggestions such as process optimization, resource allocation, communication mechanisms, avoiding direct expression at interpersonal relationship level`,
      
      education: `Enhanced Instructions (Education Scenario):
1. Learning Psychology Care: Understand students' learning pressure, cognitive characteristics, and emotional needs, provide warm and supportive expression
2. Knowledge System Construction: Break down complex concepts into easily understandable knowledge points, establish clear learning paths
3. Learning Method Guidance: Based on different learning styles, provide personalized learning strategies and skill recommendations
4. Growth Motivation Orientation: Emphasize progress and achievements in the learning process, build students' learning confidence
5. Home-School Communication Bridge: Balance student needs and parent expectations, promote effective three-party communication
6. Teaching Resource Integration: Reasonably utilize teaching tools, reference materials, and practical opportunities to enrich learning experience
7. Educational Style Restrictions: Use encouraging, inspiring language, avoid criticism or negative expressions, maintain positive educational tone
8. Educational Scenario Inappropriate Language Handling: Transform students' frustration and learning difficulties into specific learning support needs, focusing on learning method adjustment, psychological counseling, individual tutoring and other educational professional expressions`
    }

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}

${prompt.instruction}

【Important】Input content filtering and intelligent processing rules:
1. Inappropriate language handling: If user input contains profanity, vulgarity, or aggressive words, do not repeat this content, but:
   - Identify as "user emotional expression" or "test input"
   - Understand possible real intentions (such as expressing dissatisfaction, seeking help, random testing, etc.)
   - Respond in a professional and friendly manner

2. Meaningless input handling: If input is:
   - Random letter/number combinations (like "cnm", "123", "aaa")
   - Single words without clear requirement meaning
   - Obviously test inputs
   Identify as "users needing guidance", suggest providing real requirements

3. Negative emotion recognition: If input expresses dissatisfaction or negative emotions, transform into opportunities to understand problems and provide help

Please output in the following format:

【REQUIREMENTS UNDERSTANDING】
Briefly summarize the user's core requirements (no more than 30 words)
- For valid requirements: normal summary
- For inappropriate input: state "user test input" or "user emotional expression"
- For meaningless input: state "input content unclear, needs guidance"

【INFORMATION OPTIONS】
Generate options for specific requirements, format: option name|inquiry reason
- For valid requirements: normally generate 3-5 options
- For invalid input: return "no need to collect additional information"

【REQUIREMENTS TRANSLATION】
Transform into professional description:
- For valid requirements: normal translation
- For inappropriate input: translate to "customer may be testing system or expressing emotions, suggest friendly guidance to provide specific requirements"
- For meaningless input: translate to "customer input is unclear, suggest actively asking what help can be provided"`
      },
      {
        role: 'user', 
        content: `User input: "${content}"${image ? '\n(User also uploaded an image)' : ''}${chatContext}

Please analyze this input, and if it contains inappropriate language or meaningless content, please handle it intelligently.`
      }
    ]
    const resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.1, 2048, null, { enableThinking: false, stream: false })
    const result = sanitizeOutput(resultRaw)

    // [MODIFIED] Use robust parsing, avoid re-translating AI suggestions
    // Impact: Only forward "requirements translation" to enterprise side; intermediary panel still shows suggestions and pending confirmation info
    // Backward Compatibility: Return structure fields remain consistent
    const parsed = parseSectionsRobust(result)

    // Build detailed steps (for intermediary panel)
    const steps = [
      {
        name: 'Requirements Analysis & Translation',
        content: parsed.translation
      }
    ]
    if (parsed.solutionsText) {
      steps.push({
        name: 'Solution Suggestions',
        content: parsed.solutionsText
      })
    }
    if (parsed.confirmationsText && parsed.confirmationsText !== 'None') {
      steps.push({
        name: 'Pending Confirmation Info',
        content: parsed.confirmationsText
      })
    }

    // Only send "requirements translation" to solution side
    const translatedMessage = parsed.translation

    console.groupCollapsed('[LLM] Parsed -> problem_input')
    console.log('structuredOutput:', parsed)
    console.log('translatedMessage:', truncateForLog(translatedMessage))
    console.groupEnd()

    return {
      steps,
      translatedMessage,
      structuredOutput: parsed
    }
  } catch (error) {
    console.error('Error processing problem input:', error)
    throw error
  }
}

// Process solution side response - simplified version, mimicking successful AI call approach
const processSolutionResponse = async (content, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    // Use full "consumer communication history + AI collaboration history" context
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    // Rewrite according to new prompt structure
    const prompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, an AI system specifically designed to optimize bilateral communication, ensuring that enterprises' professional expressions can be transformed into friendly replies that customers can easily understand and accept.

【Function Description】After enterprise users input reply content on the right interface, the system activates the "Customer Reply Optimization" function button. The purpose of this button is: to intelligently transform enterprises' professional terminology and formal expressions into customer-friendly, easy-to-understand natural language, allowing customers to experience warm and professional service.

【Generation Instructions】Please perform professional reply optimization: Transform enterprise replies into customer-friendly concise replies, with natural and friendly language that gets straight to the point. Avoid word-by-word counting or outputting any word count-related prompts or markers; do not return intermediate content with growing counts during the process, only output final complete sentences.

**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**

Enterprise content: "${content}"${chatContext}

Please directly output the final reply to the customer:`

    const messages = [
      { role: 'user', content: prompt }
    ]

    console.log('🔍 Customer reply generation - Prompt sent to LLM:', messages)
    
    // Use the same calling method as successful AI collaboration (streaming mode)
    const response = await callModelScopeAPI(messages, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
    const result = response.trim()
    
    console.log('🔍 Customer reply generation - LLM raw response:', response)
    console.log('🔍 Customer reply generation - Processed result:', result)
    console.log('✅ Customer reply generation completed')

    return {
       steps: [{ name: 'Customer Reply Generation', content: result }],
       optimizedMessage: result,
       structuredOutput: {
         optimizedReply: result,
         internalNotes: '',
         additionalInfo: ''
       }
     }
  } catch (error) {
    console.error('Error processing solution response:', error)
    throw error
  }
}

// New: Generate enterprise suggestions (limited to ≤50 words)
const generateEnterpriseSuggestion = async (content, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is handling a retail scenario communication assistance, with the platform goal of making exchanges between customers and business stores more efficient and precise.\n\n【Function Description】Enterprise users clicked the "Generate Sales Suggestions" button, the core function of this button is: based on customer needs and current conversation content, quickly generate specific executable sales strategies and solutions for business stores, helping enterprises better respond to customer needs.\n\n【Generation Instructions】Please generate professional retail suggestions for this button function: provide sales suggestions and solutions, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Suggestion Scenario】Based on customer needs and business situation, generate professional sales suggestions, including product recommendations, pricing strategies, service plans and other specific executable suggestions.'
      },
      enterprise: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is handling enterprise internal cross-departmental communication, committed to eliminating understanding barriers between business departments and technical departments.\n\n【Function Description】Technical team users activated the "Solution Suggestions" button, the function of this button is: based on business needs and technical status quo, quickly generate technical solution suggestions, providing specific implementation directions and strategic guidance for technical teams.\n\n【Generation Instructions】Please generate professional technical suggestions for this button function: provide solution suggestions, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Suggestion Scenario】Based on business needs and technical status quo, generate technical solution suggestions, including architecture design, technology selection, implementation plans and other specific executable suggestions.'
      },
      education: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is assisting teacher-student communication in educational scenarios, with the goal of precisely matching learning needs with teaching plans.\n\n【Function Description】Teacher users used the "Teaching Suggestion Generation" button, the function of this button is: based on students\' learning needs and teaching status quo, quickly generate personalized teaching plan suggestions for teachers, optimizing teaching effectiveness.\n\n【Generation Instructions】Please generate professional teaching suggestions for this button function: provide teaching plan suggestions, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Suggestion Scenario】Based on students\' learning needs and teaching status quo, generate teaching suggestions, including teaching methods, course arrangements, learning guidance and other specific executable suggestions.'
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`Invalid scenario type: ${scenario}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Use full "consumer communication history + AI collaboration history" context
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)
    
    // Customize independent enhancement instructions for each scenario
    const enhancedInstructions = {
      retail: `Guidance Principles for Suggestion Generation (Retail Enterprise Specific):
1. Sales Strategy Optimization: Provide precise product recommendations and sales strategies based on customer demand characteristics
2. Inventory & Supply Chain: Consider product inventory, seasonal factors and supply chain efficiency
3. Customer Relationship Management: Provide specific suggestions for customer maintenance, repeat purchase promotion and word-of-mouth marketing
4. Pricing Strategy Development: Balance profit margins and market competitiveness, provide flexible pricing suggestions
5. Service Experience Enhancement: Optimize the full-process experience of pre-sales consultation, in-sales service and after-sales support
6. Retail Operations Practicality: Ensure suggestions align with retail industry characteristics and are easy for stores to execute
7. Retail Scenario Inappropriate Language Processing: Transform customer dissatisfaction into specific action plans for service improvement and product optimization`,
      
      enterprise: `Guidance Principles for Suggestion Generation (Enterprise Service Specific):
1. Business Value Quantification: Provide measurable ROI, cost savings and efficiency improvement metrics
2. Technical Feasibility Assessment: Balance technological advancement and implementation feasibility, provide risk control suggestions
3. Organizational Change Management: Consider change suggestions for personnel training, process adjustment and cultural adaptation
4. Compliance & Security Assurance: Ensure suggestions comply with industry standards and enterprise security policy requirements
5. Phased Implementation Planning: Provide progressive implementation plans to reduce business interruption risks
6. Enterprise Decision Support: Use business language that decision-makers care about, highlighting strategic value
7. Enterprise Scenario Inappropriate Language Processing: Transform departmental conflicts into suggestions for process optimization and collaboration mechanism improvements`,
      
      education: `Guidance Principles for Suggestion Generation (Education Service Specific):
1. Learning Outcome Orientation: Provide personalized teaching suggestions based on learning objectives and student characteristics
2. Teaching Resource Allocation: Reasonably utilize faculty, textbooks and teaching equipment, optimize resource allocation
3. Learning Progress Management: Provide differentiated learning progress arrangements and ability improvement paths
4. Home-School Collaboration Promotion: Establish effective home-school communication mechanisms, forming educational synergy
5. Learning Interest Cultivation: Focus on learning motivation stimulation and interest maintenance method suggestions
6. Educational Professionalism Assurance: Ensure suggestions comply with educational laws and student physical and mental development characteristics
7. Educational Scenario Inappropriate Language Processing: Transform learning difficulties into suggestions for teaching method adjustments and learning support optimization`
    }

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}\n\n${prompt.context}\n\n${prompt.example}\n\nImportant Requirements:
1) Output concise suggestions, get straight to the point;
2) Avoid bullet points, numbering, excessive preamble;
3) Maintain executability and practicality;
4) Sentences should be complete and fluent.

【Key Principles to Prevent Hallucination】:
- Suggestions must be strictly based on the provided conversation content, must not speculate or add false information
- Do not mention specific product names, prices, times and other details that do not appear in the conversation
- If conversation information is insufficient, suggest understanding relevant information first, rather than fabricating content
- Focus on actually executable operational suggestions, avoid over-specifying non-existent information
- Stay honest, acknowledge insufficient information situations, rather than fabricating details`
      },
      {
        role: 'user',
        content: `Current conversation content: "${content}"${chatContext}\n\nPlease provide concise suggestions based on the above real conversation content, highlighting executable key points. Please ensure suggestions are completely based on actual conversation information, do not add any false or unmentioned details.`
      }
    ]
    
    const resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
    const suggestionMessageFinal = (resultRaw || '').trim()

    // Build step display
    const steps = [
      {
        name: 'Suggestion Content',
        content: suggestionMessageFinal
      }
    ]

    console.groupCollapsed('[LLM] Parsed -> generate_suggestion')
    console.log('suggestionMessage:', truncateForLog(suggestionMessageFinal))
    console.groupEnd()

    return {
      steps,
      suggestionMessage: suggestionMessageFinal,
      structuredOutput: {
        suggestion: suggestionMessageFinal
      }
    }
  } catch (error) {
    console.error('Error generating enterprise suggestions:', error)
    throw error
  }
}

// New: Generate enterprise follow-up questions
const generateEnterpriseFollowUp = async (content, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】ZeroTouch Intelligent Communication Mediation Platform is providing communication support for retail scenarios, helping enterprise stores better understand customer needs.\n\n【Function Description】Enterprise users clicked the "Intelligent Follow-up" button. The purpose of this button is: based on current conversation content, intelligently identify key information that still needs to be understood, generate targeted follow-up questions, helping enterprises obtain more complete customer requirement information.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help enterprises understand key information about customer needs, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Based on current conversation, identify key information that needs further understanding, generate targeted follow-up questions.',
        example: 'Customer says: "Need business suits"\nFollow-up: "Could you please tell us your specific usage occasion? What is your approximate budget range? What are your height and weight? Do you have any preferences for color and style?"'
      },
      enterprise: {
        systemRole: '【Platform Introduction】ZeroTouch Intelligent Communication Mediation Platform is assisting enterprise internal cross-departmental communication, focusing on eliminating information gaps between business requirements and technical implementation.\n\n【Function Description】Technical team users activated the "Requirements Deep Dive" button. The role of this button is: based on business side expressions, intelligently generate in-depth business requirement follow-up questions, helping technical teams obtain complete information needed for implementation.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help technical teams gain deep understanding of business requirements, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Based on current conversation, identify key information needed for technical implementation, generate targeted follow-up questions.',
        example: 'Business side says: "Need to improve user experience"\nFollow-up: "Which specific aspects of experience do you want to improve? Who is the target user group? What are the current pain points? Do you have specific time requirements? What is the budget range?"'
      },
      education: {
        systemRole: '【Platform Introduction】ZeroTouch Intelligent Communication Mediation Platform is providing teacher-student communication support for educational scenarios, committed to making teaching more precise and effective.\n\n【Function Description】Teacher users used the "Learning Situation Understanding" button. The function of this button is: based on learning difficulties expressed by students, intelligently generate follow-up questions to understand students\' specific learning situations, helping teachers formulate personalized teaching plans.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help teachers understand students\' learning situations, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Based on current conversation, identify key information needed for teaching, generate targeted follow-up questions.',
        example: 'Student says: "Don\'t understand this concept"\nFollow-up: "Have you learned related basic knowledge before? Which learning method do you prefer? What level of understanding do you hope to achieve? Do you have any specific learning goals?"'
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`Invalid scenario type: ${scenario}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Use full "consumer communication history + AI collaboration history" context
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)
    
    // Customize independent enhancement instructions for each scenario
    const enhancedInstructions = {
      retail: `Follow-up Generation Guidance Principles (Retail Enterprise Specific):
1. Sales Opportunity Mining: Identify customer potential needs, generate key follow-ups that promote transactions
2. Product Matching Precision: Understand customer specific usage scenarios and preferences through follow-ups
3. Price Sensitivity Detection: Skillfully understand customer budget range and value perception
4. Competitive Product Analysis: Understand customer perception and comparison standards of competitive products
5. Purchase Decision Process: Identify key factors and decision-makers that influence purchase decisions
6. Retail Scenario Adaptability: Ensure follow-up methods comply with retail environment communication characteristics
7. Retail Scenario Inappropriate Language Processing: Transform customer complaints into follow-up opportunities to understand real needs`,
      
      enterprise: `Follow-up Generation Guidance Principles (Enterprise Service Specific):
1. Business Needs Deep Mining: Understand enterprise real business pain points and goals through follow-ups
2. Decision Chain Identification: Understand enterprise internal decision-making processes and key decision-makers
3. Budget & Time Constraints: Explore project budget scope and implementation time requirements
4. Technical Environment Assessment: Understand enterprise existing technical architecture and integration requirements
5. Risk Tolerance Capability: Assess enterprise acceptance of new technologies and changes
6. Enterprise-level Professionalism: Use business language familiar to enterprise decision-makers for follow-ups
7. Enterprise Scenario Inappropriate Language Processing: Transform internal disagreements into follow-up strategies to understand various departmental needs`,
      
      education: `Follow-up Generation Guidance Principles (Education Service Specific):
1. Learning Goal Clarification: Understand specific learning goals and expected outcomes through follow-ups
2. Learning Ability Assessment: Understand student current level, learning habits and ability characteristics
3. Learning Environment Analysis: Explore home learning environment and school teaching conditions
4. Learning Motivation Stimulation: Understand student interest points and learning motivation sources
5. Parent Expectation Management: Balance differences between parent expectations and student actual abilities
6. Educational Professionalism Assurance: Ensure follow-ups comply with educational laws and student psychological characteristics
7. Educational Scenario Inappropriate Language Processing: Transform learning setbacks into follow-up opportunities to understand learning obstacles`
    }

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}\n\n${prompt.context}\n\nImportant Requirements:
1) Only generate one concise follow-up question, not multiple sentences
2) Follow-up should hit the key points, asking for the most critical information
3) Sentences should be natural and fluent, ending with a question mark
4) Avoid lengthy expressions, keep concise and clear
5) Focus on the core information points that most need to be understood`
      },
      {
        role: 'user',
        content: `Current conversation content: "${content}"${chatContext}\n\nPlease generate one concise follow-up question, hitting key points, asking for the most critical information. Just one sentence is needed.`
      }
    ]
    
    const resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.7, 1024, streamCallbacks, { enableThinking: true, stream: true })
    const followUpMessage = (resultRaw || '').trim()

    // Build step display
    const steps = [
      {
        name: 'Follow-up Content',
        content: followUpMessage
      }
    ]

    console.groupCollapsed('[LLM] Parsed -> generate_followup')
    console.log('followUpMessage:', truncateForLog(followUpMessage))
    console.groupEnd()

    return {
      steps,
      followUpMessage,
      structuredOutput: {
        followUp: followUpMessage
      }
    }
  } catch (error) {
    console.error('Error generating enterprise follow-up:', error)
    throw error
  }
}

// Helper functions - kept for backward compatibility
const analyzeContext = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in context analysis.\n\n【Function Description】The system activated the "Context Analysis" function button, used to identify business scenarios and contextual backgrounds of user input.\n\n【Generation Instructions】Please identify business scenarios, industry backgrounds or usage environments of user input based on professional context analysis requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**'
    },
    {
      role: 'user',
      content: `User input: "${content}"\n\nPlease analyze the business scenarios, industry backgrounds or usage environments that this input may involve.`
    }
  ]
  return await callModelScopeAPI(prompt, 0.7, 1024, null, { enableThinking: false, stream: false })
}

const conceptualize = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in concept design.\n\n【Function Description】The system activated the "Concept Design" function button, used to transform user requirements into specific concepts and feature points.\n\n【Generation Instructions】Please transform user requirements into specific functional requirements or solution key points based on professional concept design requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**'
    },
    {
      role: 'user',
      content: `Based on user input: "${content}"\n\nPlease conceptualize it into specific functional requirements or solution key points.`
    }
  ]
  return await callModelScopeAPI(prompt, 0.7, 1024, null, { enableThinking: false, stream: false })
}

const detectMissingInfo = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in requirements completeness checking.\n\n【Function Description】The system activated the "Missing Information Detection" function button, used to identify possible missing key information in user input.\n\n【Generation Instructions】Please identify what additional information is needed to better understand and satisfy user requirements based on professional requirements completeness checking requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**'
    },
    {
      role: 'user',
      content: `User input: "${content}"\n\nPlease identify what additional information is needed to better understand and satisfy user requirements?`
    }
  ]
  return await callModelScopeAPI(prompt, 0.7, 1024, null, { enableThinking: false, stream: false })
}

const translateToSolution = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in requirements translation.\n\n【Function Description】The system activated the "Requirements Translation" function button, used to transform user\'s original input into clear, professional requirement descriptions.\n\n【Generation Instructions】Please transform user original input into clear, professional requirement descriptions containing specific functional requirements and expected results based on professional requirements translation requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**'
    },
    {
      role: 'user',
      content: `User original input: "${content}"\n\nPlease transform it into clear, professional requirement descriptions containing specific functional requirements and expected results.`
    }
  ]
  return await callModelScopeAPI(prompt, 0.7, 1024, null, { enableThinking: false, stream: false })
}

const optimizeForUser = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in user experience optimization.\n\n【Function Description】The system activated the "User-Friendly Optimization" function button, used to transform technical solutions into user-friendly language and provide clear action guides.\n\n【Generation Instructions】Please transform technical solutions into user-friendly language containing clear steps and expected results based on professional user experience optimization requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**'
    },
    {
      role: 'user',
      content: `Technical solution: "${content}"\n\nPlease transform it into user-friendly language containing clear steps and expected results.`
    }
  ]
  return await callModelScopeAPI(prompt, 0.7, 1024, null, { enableThinking: false, stream: false })
}

// 智能需求分析和信息缺失检测 - 精准版本
const analyzeCustomerNeedsWithMissingInfo = async (content, image, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】ZeroTouch智能沟通中介平台正在为零售场景提供智能分析服务，帮助企业更精准地理解顾客需求。\n\n【Function Description】系统启动了"需求信息分析"按钮，这个按钮的作用是：基于顾客的初步表达，智能识别还需要了解的关键信息点，为企业提供具体的信息收集选项，确保后续沟通更加高效。\n\n【Generation Instructions】请为这个按钮功能进行专业的需求分析：针对任何产品精准识别具体的关键信息点。\n\n**⚡ 重要：回答必须简洁明了、直达要点，避免冗长表达和不必要的细节描述。禁止过度推理，直接给出实用答案。**',
        instruction: `分析用户需求时，要生成具体的、可操作的信息选项，而不是抽象概念。

例如：
- 用户说"我要买件衣服" → 生成：尺码、颜色、价位、场合、材质
- 用户说"我要买个手机" → 生成：预算、品牌、功能需求、存储容量、颜色
- 用户说"我要装修" → 生成：面积、风格、预算、时间、房间类型

要求：
1. 每个选项名称2-4个字，简洁明了
2. 必须是具体的、可直接询问的信息点
3. 与该产品/服务直接相关，不要抽象概念
4. 按重要性排序，最重要的放前面`
      },
      enterprise: {
        systemRole: '【Platform Introduction】ZeroTouch智能沟通中介平台正在为企业内部跨部门沟通提供智能分析，专注于识别业务需求的关键要素。\n\n【Function Description】系统激活了"业务需求解析"按钮，这个按钮的功能是：基于业务部门的表达，智能分析技术实现所需的关键信息点，为技术团队提供明确的信息收集方向。\n\n【Generation Instructions】请为这个按钮功能进行专业的需求分析：针对任何业务需求精准识别具体的关键信息点。\n\n**⚡ 重要：回答必须简洁明了、直达要点，避免冗长表达和不必要的细节描述。禁止过度推理，直接给出实用答案。**',
        instruction: `分析业务需求时，要生成具体的、可操作的信息选项，而不是抽象概念。

例如：
- 用户说"我要开发系统" → 生成：预算规模、开发周期、用户数量、核心功能、技术栈
- 用户说"我要做营销" → 生成：目标客群、推广渠道、活动预算、效果期望、时间安排
- 用户说"我要培训员工" → 生成：培训人数、培训内容、时间安排、培训方式、预算范围

要求：
1. 每个选项名称2-4个字，简洁明了
2. 必须是具体的、可直接询问的信息点
3. 与该业务需求直接相关，不要抽象概念
4. 按重要性排序，最重要的放前面`
      },
      education: {
        systemRole: '【Platform Introduction】ZeroTouch智能沟通中介平台正在为教育场景提供学习需求智能分析，帮助教师更好地理解学生的具体学习情况。\n\n【Function Description】系统启用了"学习需求分析"按钮，这个按钮的目的是：基于学生表达的学习困难，智能识别制定教学方案所需的关键信息点，为教师提供精准的了解方向。\n\n【Generation Instructions】请为这个按钮功能进行专业的需求分析：针对任何学习需求精准识别具体的关键信息点。\n\n**⚡ 重要：回答必须简洁明了、直达要点，避免冗长表达和不必要的细节描述。禁止过度推理，直接给出实用答案。**',
        instruction: `分析学习需求时，要生成具体的、可操作的信息选项，而不是抽象概念。

例如：
- 用户说"我要学英语" → 生成：当前水平、学习目标、时间安排、学习方式、预算考虑
- 用户说"孩子要补数学" → 生成：年级阶段、薄弱环节、上课时间、期望效果、费用预算
- 用户说"我要考证" → 生成：考试时间、基础情况、学习时间、培训方式、通过目标

要求：
1. 每个选项名称2-4个字，简洁明了
2. 必须是具体的、可直接询问的信息点
3. 与该学习需求直接相关，不要抽象概念
4. 按重要性排序，最重要的放前面`
      }
    }

    const prompt = scenarioPrompts[scenario]
    if (!prompt) {
      throw new Error(`不支持的场景类型: ${scenario}`)
    }

    // Build chat history context
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}

${prompt.instruction}

【Important】Input content filtering and intelligent processing rules:
1. Inappropriate language handling: If user input contains profanity, vulgarity, or aggressive words, do not repeat this content, but:
   - Identify as "user emotional expression" or "test input"
   - Understand possible real intentions (such as expressing dissatisfaction, seeking help, random testing, etc.)
   - Respond in a professional and friendly manner

2. Meaningless input handling: If input is:
   - Random letter/number combinations (like "cnm", "123", "aaa")
   - Single words without clear requirement meaning
   - Obviously test inputs
   Identify as "users needing guidance", suggest providing real requirements

3. Negative emotion recognition: If input expresses dissatisfaction or negative emotions, transform into opportunities to understand problems and provide help

Please output in the following format:

【REQUIREMENTS UNDERSTANDING】
Briefly summarize the user's core requirements (no more than 30 words)
- For valid requirements: normal summary
- For inappropriate input: state "user test input" or "user emotional expression"
- For meaningless input: state "input content unclear, needs guidance"

【INFORMATION OPTIONS】
Generate options for specific requirements, format: option name|inquiry reason
- For valid requirements: normally generate 3-5 options
- For invalid input: return "no need to collect additional information"

【REQUIREMENTS TRANSLATION】
Transform into professional description:
- For valid requirements: normal translation
- For inappropriate input: translate to "customer may be testing system or expressing emotions, suggest friendly guidance to provide specific requirements"
- For meaningless input: translate to "customer input is unclear, suggest actively asking what help can be provided"`
      },
      {
        role: 'user', 
        content: `User input: "${content}"${image ? '\n(User also uploaded an image)' : ''}${chatContext}

Please analyze this input, and if it contains inappropriate language or meaningless content, please handle it intelligently.`
      }
    ]

    const result = await callModelScopeAPI(comprehensivePrompt, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
    const sanitizedResult = sanitizeOutput(result)
    
    // 解析结果
    const needsMatch = sanitizedResult.match(/【REQUIREMENTS UNDERSTANDING】\s*\n([\s\S]*?)(?=\n【|$)/)
    const optionsMatch = sanitizedResult.match(/【INFORMATION OPTIONS】\s*\n([\s\S]*?)(?=\n【|$)/)
    const translationMatch = sanitizedResult.match(/【REQUIREMENTS TRANSLATION】\s*\n([\s\S]*?)(?=\n【|$)/)

    const needsUnderstanding = needsMatch ? needsMatch[1].trim() : '需求分析'
    const optionsText = optionsMatch ? optionsMatch[1].trim() : ''
    const translation = translationMatch ? translationMatch[1].trim() : 
      `客户咨询：${content}，建议了解客户的具体需求以提供精准的${currentScenario || 'retail'}服务解决方案。`

    // 解析信息选项
    const missingInfoOptions = []
    if (optionsText) {
      const lines = optionsText.split('\n').filter(line => line.trim())
      for (const line of lines) {
        // 匹配格式：选项名称|说明
        const match = line.match(/^[•\-\*]?\s*([^|]{2,8})\|(.+)$/)
        if (match) {
          missingInfoOptions.push({
            name: match[1].trim(),
            description: match[2].trim(),
            selected: false
          })
        }
      }
    }

    console.log('[LLM] Intelligent demand analysis results:', {
      needsUnderstanding,
      missingInfoOptions,
      translation
    })

    return {
      needsUnderstanding,
      missingInfoOptions,
      translation,
      structuredOutput: {
        needsUnderstanding,
        missingInfoOptions,
        translation
      }
    }

  } catch (error) {
    console.error('Intelligent demand analysis error:', error)
    throw error
  }
}

// Negotiation suggestion processing function
const negotiateSuggestion = async (content, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    console.log('\n=== Starting negotiation suggestion processing ===')
    console.log('Original suggestion:', content.originalSuggestion)
    console.log('Negotiation request:', content.negotiationRequest)
    console.log('Scenario:', scenario)

    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system that supports dynamic negotiation optimization, allowing users to engage in multiple rounds of negotiation with AI to continuously improve and adjust suggestion content.

【Function Description】Users are not completely satisfied with the previously generated suggestions and clicked the "Negotiation Optimization" button. The function of this button is: based on the user's specific negotiation requirements, intelligently adjust and improve the original suggestions to generate optimization plans that better meet the user's actual needs.

【Generation Instructions】Please make in-depth adjustments to suggestions based on professional negotiation optimization requirements: modify and optimize the original suggestions according to the user's negotiation requirements, ensuring suggestions are specific and actionable, meet negotiation requirements, maintain professionalism and practicality, and use natural and coherent sentence expressions.

**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**`

    // Build negotiation history information
    let negotiationHistoryText = ''
    if (content.negotiationHistory && content.negotiationHistory.length > 0) {
      negotiationHistoryText = '\n\nNegotiation History:\n' + 
        content.negotiationHistory.map((nego, index) => 
          `Negotiation ${index + 1}: ${nego.negotiationRequest}`
        ).join('\n')
    }

    const userPrompt = `Current Suggestion:
${content.originalSuggestion}

Latest Negotiation Request:
${content.negotiationRequest}${negotiationHistoryText}

Please based on all the above negotiation history, directly output the optimized complete suggestion, ensuring content is complete and sentences are fluent.${chatContext}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    console.log('Sending negotiation request to LLM...')
    const response = await callModelScopeAPI(messages, 0.7, 3072, null, { enableThinking: false, stream: false })
    console.log('LLM negotiation response:', truncateForLog(response))

    const suggestionMessage = (response || '').trim()

    console.log('Negotiation processing completed')
    console.log('Optimized suggestion:', truncateForLog(suggestionMessage))

    return {
      steps: [{ name: 'Negotiation Optimization', content: suggestionMessage }],
      suggestionMessage
    }

  } catch (error) {
    console.error('Negotiation suggestion processing error:', error)
    throw error
  }
}

// Generate follow-up questions based on selected information
const generateQuestionsBySelectedInfo = async (originalContent, selectedInfoItems, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is providing precise follow-up services for retail scenarios, helping enterprise stores collect complete customer demand information.\n\n【Function Description】Enterprise users selected key information points and clicked the "Generate Follow-up" button. The function of this button is: based on the selected information points, intelligently generate natural and fluent follow-up questions, integrating multiple information needs into one friendly question to improve communication efficiency.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help enterprises understand key information about customer needs, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Generate targeted follow-up questions based on customer original needs and key information points identified by enterprise intelligent analysis.',
        example: 'Customer says: "Need business suits", Enterprise focuses on: size, color, budget\nFollow-up: "To recommend the most suitable business suit for you, please let us know your size, preferred color and approximate budget range?"'
      },
      enterprise: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is providing information collection services for enterprise cross-departmental communication, focusing on obtaining complete information required for technical implementation.\n\n【Function Description】Technical team users selected important information points and activated the "Generate Inquiry" button. The function of this button is: based on selected business information needs, intelligently generate a professional inquiry containing multiple key points, helping technical teams obtain required information in one go.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help technical teams gain in-depth understanding of business needs, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Generate targeted follow-up questions based on business needs and key information points identified by enterprise intelligent analysis.',
        example: 'Business side says: "Need to improve user experience", Enterprise focuses on: target users, specific functions, time requirements\nFollow-up: "To develop the most suitable plan, please clarify the target user groups, specific functions you hope to improve, and expected completion time?"'
      },
      education: {
        systemRole: '【Platform Introduction】The ZeroTouch Intelligent Communication Mediation Platform is providing learning situation understanding services for educational scenarios, helping teachers collect key information needed to develop teaching plans.\n\n【Function Description】Teacher users selected information points of concern and used the "Generate Inquiry" button. The purpose of this button is: based on selected learning information needs, intelligently generate a comprehensive understanding question to help teachers fully grasp student situations.\n\n【Generation Instructions】Please generate professional follow-up questions for this button function: help teachers understand students\' learning situations, intelligently filter and transform inappropriate expressions, ensuring communication professionalism.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        context: '【Follow-up Scenario】Generate targeted follow-up questions based on learning needs and key information points identified by enterprise intelligent analysis.',
        example: 'Student says: "Don\'t understand math concepts", Enterprise focuses on: grade, specific chapters, learning methods\nFollow-up: "To develop a personalized tutoring plan, please let us know your grade, specific chapters you don\'t understand, and your preferred learning methods?"'
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`Invalid scenario type: ${scenario}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Build chat history context (including detailed logs)
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)
    
    // Customize independent enhancement instructions for each scenario
    const enhancedInstructions = {
      retail: `Follow-up Generation Guidance Principles (Retail Enterprise Specific):
1. Sales Opportunity Mining: Identify customer potential needs, generate key follow-ups that promote transactions
2. Product Matching Precision: Understand customer specific usage scenarios and preferences through follow-ups
3. Price Sensitivity Detection: Skillfully understand customer budget range and value perception
4. Competitive Product Analysis: Understand customer perception and comparison standards of competitive products
5. Purchase Decision Process: Identify key factors and decision-makers that influence purchase decisions
6. Retail Scenario Adaptability: Ensure follow-up methods comply with retail environment communication characteristics
7. Intelligent Information Integration: Naturally integrate key information points identified by AI analysis into follow-ups`,
      
      enterprise: `Follow-up Generation Guidance Principles (Enterprise Service Specific):
1. Business Needs Deep Mining: Understand enterprise real business pain points and goals through follow-ups
2. Decision Chain Identification: Understand enterprise internal decision-making processes and key decision-makers
3. Budget & Time Constraints: Explore project budget scope and implementation time requirements
4. Technical Environment Assessment: Understand enterprise existing technical architecture and integration requirements
5. Risk Tolerance Capability: Assess enterprise acceptance of new technologies and changes
6. Enterprise-level Professionalism: Use business language familiar to enterprise decision-makers for follow-ups
7. Intelligent Information Integration: Naturally integrate key information points identified by AI analysis into follow-ups`,
      
      education: `Follow-up Generation Guidance Principles (Education Service Specific):
1. Learning Goal Clarification: Understand specific learning goals and expected outcomes through follow-ups
2. Learning Ability Assessment: Understand student current level, learning habits and ability characteristics
3. Learning Environment Analysis: Explore home learning environment and school teaching conditions
4. Learning Motivation Stimulation: Understand student interest points and learning motivation sources
5. Parent Expectation Management: Balance differences between parent expectations and student actual abilities
6. Educational Professionalism Assurance: Ensure follow-ups comply with educational laws and student psychological characteristics
7. Intelligent Information Integration: Naturally integrate key information points identified by AI analysis into follow-ups`
    }

    const selectedItems = selectedInfoItems.map(item => `${item.name}：${item.description}`).join('\n')

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}

${prompt.context}

${enhancedInstructions[scenario]}

        Important Requirements:
1) Generate only one concise inquiry sentence, not multiple sentences;
2) Naturally integrate all selected information points into one sentence;
3) Ensure content is specific and clear with complete sentences, ending with a question mark.`
      },
      {
        role: 'user',
        content: `Original Requirements: "${originalContent}"

Enterprise Selected Information Points:
${selectedItems}

${chatContext}

Please generate one concise and clear inquiry sentence based on the above selected information points, naturally integrating all information points. Just one sentence is needed.`
      }
    ]
    
    let resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.7, 1024, streamCallbacks, { enableThinking: true, stream: true })
    let result = sanitizeFollowUpOutput(resultRaw)
    result = stripLeadingPleasantries(result)

    // Check if it's a valid single-sentence follow-up, retry if it doesn't meet requirements
    if (result.length < 10 || !result.includes('？') || result.split('？').filter(q => q.trim()).length > 1) {
      const strictPrompt = [
        { role: 'system', content: `${prompt.systemRole}\n\n${prompt.context}\n\nImportant Requirements:\n1) Can only output one follow-up question, ending with a question mark;\n2) Must include all selected information points;\n3) Sentences should be concise and clear, avoiding lengthy expressions.` },
        { role: 'user', content: `Original Requirements: "${originalContent}"\n\nSelected Information Points:\n${selectedItems}\n\nPlease generate one concise follow-up question, naturally integrating all information points. Just one sentence is needed.${chatContext}` }
      ]
      // Second retry uses non-streaming call to avoid triggering UI streaming generation again
      resultRaw = await callModelScopeAPI(strictPrompt, 0.8, 1024, null, { enableThinking: false, stream: false })
      result = stripLeadingPleasantries(sanitizeFollowUpOutput(resultRaw))
    }

    // Ensure complete sentences
    const followUpMessage = ensureQuestionEnding(result.trim())

    console.groupCollapsed('[LLM] Parsed -> generate_questions_by_selected_info')
    console.log('followUpMessage:', truncateForLog(followUpMessage))
    console.groupEnd()

    return followUpMessage

  } catch (error) {
    console.error('Follow-up generation error:', error)
    throw error
  }
}

// Negotiate follow-up processing function
const negotiateFollowUp = async (content, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    console.log('\n=== Starting follow-up negotiation processing ===')
    console.log('Original follow-up:', content.originalFollowUp)
    console.log('Negotiation request:', content.negotiationRequest)
    console.log('Scenario:', scenario)

    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system that supports dynamic negotiation optimization, allowing users to conduct multiple rounds of negotiation adjustments on generated follow-up questions to ensure the follow-up methods best meet actual needs.

【Function Description】Users are not satisfied with the previously generated follow-up questions and clicked the "Follow-up Negotiation" button. The purpose of this button is: based on the user's specific negotiation feedback, intelligently adjust and rephrase the original follow-up questions to generate more suitable inquiry methods.

【Generation Instructions】Please make precise adjustments to follow-up questions based on professional follow-up negotiation requirements: modify and optimize the original follow-up questions according to the user's negotiation requirements, ensuring follow-up questions are specific and actionable, meet negotiation requirements, maintain professionalism and practicality, and use natural and coherent sentence expressions.

**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**`

    // Build negotiation history information
    let negotiationHistoryText = ''
    if (content.negotiationHistory && content.negotiationHistory.length > 0) {
      negotiationHistoryText = '\n\nNegotiation History:\n' + 
        content.negotiationHistory.map((nego, index) => 
          `Negotiation ${index + 1}: ${nego.negotiationRequest}`
        ).join('\n')
    }

    const userPrompt = `Current Follow-up:
${content.originalFollowUp}

Latest Negotiation Request:
${content.negotiationRequest}${negotiationHistoryText}

Please based on all the above negotiation history, directly output the optimized complete follow-up question, ensuring content is complete and sentences are fluent.${chatContext}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    console.log('Sending negotiation follow-up request to LLM...')
    const response = await callModelScopeAPI(messages, 0.7, 2048, null, { enableThinking: false, stream: false })
    console.log('LLM negotiation follow-up response:', truncateForLog(response))

    const followUpMessage = (response || '').trim()

    console.log('Negotiation follow-up processing completed')
    console.log('Optimized follow-up:', truncateForLog(followUpMessage))

    return {
      steps: [{ name: 'Negotiation Optimization', content: followUpMessage }],
      followUpMessage
    }

  } catch (error) {
    console.error('Negotiation follow-up processing error:', error)
    throw error
  }
}

// 主要的LLM处理函数
export const processWithLLM = async ({ type, content, image, context, scenario, chatHistory = [], aiChatHistory = [], currentContext = null, streamCallbacks = null }) => {
  try {
    if (type === 'problem_input') {
      return await processProblemInput(content, image, scenario, chatHistory, aiChatHistory)
    } else if (type === 'analyze_needs_with_missing_info') {
      return await analyzeCustomerNeedsWithMissingInfo(content, image, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'comprehensive_analysis_with_suggestion') {
      return await comprehensiveAnalysisWithSuggestion(content, image, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'generate_questions_by_selected_info') {
      const { originalContent, selectedInfoItems } = content
      return await generateQuestionsBySelectedInfo(originalContent, selectedInfoItems, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'solution_response') {
      return await processSolutionResponse(content, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'generate_suggestion') {
      return await generateEnterpriseSuggestion(content, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'generate_followup') {
      return await generateEnterpriseFollowUp(content, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'generate_simple_followup') {
      return await generateEnterpriseFollowUp(content, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'negotiate_suggestion') {
      return await negotiateSuggestion(content, scenario, chatHistory, aiChatHistory)
    } else if (type === 'negotiate_followup') {
      return await negotiateFollowUp(content, scenario, chatHistory, aiChatHistory)
    } else if (type === 'generate_department_contact') {
      return await generateDepartmentContact(content, scenario, chatHistory, aiChatHistory)
    } else if (type === 'generate_department_contact_only') {
      return await generateDepartmentContactOnly(content, scenario, chatHistory, aiChatHistory)
    } else if (type === 'ai_chat') {
      // 使用增强的AI对话功能，传递完整上下文
      return await chatWithAI(content, scenario, aiChatHistory, currentContext, streamCallbacks)
    } else if (type === 'generate_department_suggestion') {
      return await generateDepartmentSuggestion(content, scenario, chatHistory, aiChatHistory)
    } else if (type === 'generate_department_contact_with_instructions') {
      return await generateDepartmentContactWithInstructions(content, scenario, chatHistory, streamCallbacks, aiChatHistory)
    } else if (type === 'emergency_handling') {
      return await handleEmergencyProcessing(content, scenario, streamCallbacks)
    }
    
    throw new Error('Unknown processing type')
  } catch (error) {
    console.error('LLM processing error:', error)
    throw error
  }
}

// Generate department contact instructions
const generateDepartmentContact = async (suggestion, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    console.log('\n=== Starting department contact instruction generation ===')
    console.log('Suggestion content:', suggestion)
    console.log('Scenario:', scenario)

    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a professional retail customer service supervisor responsible for coordinating various departments to handle customer issues.',
        context: 'Generate standard customer replies and internal contact instructions based on customer service suggestions.',
        departments: ['Order Department', 'Logistics Department', 'After-sales Department', 'Technical Department', 'Finance Department']
      },
      finance: {
        systemRole: 'You are a professional financial customer service supervisor responsible for coordinating various departments to handle customer business.',
        context: 'Generate standard customer replies and internal contact instructions based on customer service suggestions.',
        departments: ['Business Department', 'Risk Control Department', 'Technical Department', 'Compliance Department', 'Operations Department']
      },
      logistics: {
        systemRole: 'You are a professional logistics customer service supervisor responsible for coordinating various departments to handle customer issues.',
        context: 'Generate standard customer replies and internal contact instructions based on customer service suggestions.',
        departments: ['Transportation Department', 'Warehousing Department', 'Customer Service Department', 'Technical Department', 'Settlement Department']
      }
    }

    const prompt = scenarioPrompts[scenario] || scenarioPrompts.retail

    const systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specifically designed to optimize customer service and internal coordination, helping enterprises achieve seamless integration between external communication and internal coordination when handling customer issues.

【Function Description】Customer service representatives, based on system suggestions, are preparing to handle customer issues and clicked the "Generate Contact Instructions" button. This button has dual functions: on one hand, it generates professional and friendly replies to customers, and on the other hand, it generates specific action instructions for relevant internal departments to ensure comprehensive problem resolution.

【Generation Instructions】Please generate two types of standard outputs simultaneously based on professional contact instruction generation requirements:

1. 【Customer Reply】- Generate professional replies to customers
- Tone should be friendly, professional, empathetic, clearly explaining solutions and timelines
- Reflect service attitude and sense of responsibility, extremely concise

2. 【Contact Instructions】- Generate action instructions for internal departments
- Specify responsible departments: ${prompt.departments.join(', ')}
- Specific action steps and deadlines, follow-up points and reporting requirements, instructions should be concise and clear

Output Format:
【Customer Reply】
[Customer reply content here]

【Contact Instructions】
[Internal contact instructions here]

【Mandatory Requirements】Strictly base on the provided suggestion content, do not add information not mentioned in the conversation, no word count, extremely concise, get straight to the point.`

    const userPrompt = `Customer Service Suggestion Content:
${suggestion}

Please generate standard customer replies and internal contact instructions based on the above suggestions.${chatContext}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    console.log('Sending contact instruction generation request to LLM...')
    const response = await callModelScopeAPI(messages, 0.7, 2048, null, { enableThinking: false, stream: false })
    console.log('LLM contact instruction response:', truncateForLog(response))

    // Parse output
    const customerReplyMatch = response.match(/【Customer Reply】\s*\n([\s\S]*?)(?=\n【Contact Instructions】|$)/)
    const contactInstructionMatch = response.match(/【Contact Instructions】\s*\n([\s\S]*?)$/)

    const customerReply = customerReplyMatch ? customerReplyMatch[1].trim() : 'Sorry, there was an issue generating the customer reply. Please handle manually.'
    const contactInstruction = contactInstructionMatch ? contactInstructionMatch[1].trim() : 'Please have relevant departments follow up on customer issues.'

    // Build step display
    const steps = [
      {
        name: 'Customer Reply Generation',
        content: customerReply
      },
      {
        name: 'Contact Instruction Generation', 
        content: contactInstruction
      }
    ]

    console.groupCollapsed('[LLM] Parsed -> generate_department_contact')
    console.log('customerReply:', truncateForLog(customerReply))
    console.log('contactInstruction:', truncateForLog(contactInstruction))
    console.groupEnd()

    return {
      steps,
      customerReply,
      contactInstruction,
      structuredOutput: {
        customerReply,
        contactInstruction
      }
    }
  } catch (error) {
    console.error('Error generating department contact instructions:', error)
    throw error
  }
}

// Generate department contact instructions (contact instructions only, no customer reply)
const generateDepartmentContactOnly = async (suggestion, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    console.log('\n=== Starting department contact instruction generation (contact only) ===')
    console.log('Suggestion content:', suggestion)
    console.log('Scenario:', scenario)

    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a professional retail customer service supervisor responsible for coordinating various departments to handle customer issues.',
        context: 'Generate internal contact instructions based on current customer issues or needs.',
        departments: ['Order Department', 'Logistics Department', 'After-sales Department', 'Technical Department', 'Finance Department']
      },
      finance: {
        systemRole: 'You are a professional financial customer service supervisor responsible for coordinating various departments to handle customer business.',
        context: 'Generate internal contact instructions based on current customer issues or needs.',
        departments: ['Business Department', 'Risk Control Department', 'Technical Department', 'Compliance Department', 'Operations Department']
      },
      logistics: {
        systemRole: 'You are a professional logistics customer service supervisor responsible for coordinating various departments to handle customer issues.',
        context: 'Generate internal contact instructions based on current customer issues or needs.',
        departments: ['Transportation Department', 'Warehousing Department', 'Customer Service Department', 'Technical Department', 'Settlement Department']
      }
    }

    const prompt = scenarioPrompts[scenario] || scenarioPrompts.retail

    const systemPrompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specifically designed to optimize enterprise internal coordination efficiency, helping customer service quickly generate standardized internal contact instructions to ensure smooth departmental collaboration.

【Function Description】After customer service analyzed the current situation, they clicked the "Generate Internal Instructions" button. The specialized function of this button is: based on the current customer situation and problem nature, generate detailed internal contact instructions for customer service, clarifying departmental responsibilities and action steps.

【Generation Instructions】Please generate detailed internal action instructions based on professional internal contact instruction generation requirements:
- Specify responsible departments: ${prompt.departments.join(', ')}
- Specific action steps and deadlines, follow-up points and reporting requirements
- 80-150 word instructions should be detailed and clear

Output Format:
【Contact Instructions】
[Internal contact instructions here]

【Important】Strictly base on the provided content, do not add information not mentioned in the conversation, ensure all information has clear source basis.`

    const userPrompt = `Current Situation:
${suggestion}

Please generate internal contact instructions based on the above situation.${chatContext}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    console.log('Sending contact instruction generation request to LLM...')
    const response = await callModelScopeAPI(messages, 0.7, 2048)
    console.log('LLM contact instruction response:', truncateForLog(response))

    // Parse output
    const contactInstructionMatch = response.match(/【Contact Instructions】\s*\n([\s\S]*?)$/)
    const contactInstruction = contactInstructionMatch ? contactInstructionMatch[1].trim() : 'Please have relevant departments follow up on the current situation.'

    // Build step display
    const steps = [
      {
        name: 'Contact Instruction Generation', 
        content: contactInstruction
      }
    ]

    console.groupCollapsed('[LLM] Parsed -> generate_department_contact_only')
    console.log('contactInstruction:', truncateForLog(contactInstruction))
    console.groupEnd()

    return {
      steps,
      contactInstruction,
      structuredOutput: {
        contactInstruction
      }
    }
  } catch (error) {
    console.error('Error generating department contact instructions:', error)
    throw error
  }
}

// Comprehensive intelligent analysis - simultaneously perform requirements analysis and suggestion generation
const comprehensiveAnalysisWithSuggestion = async (content, image, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in requirements analysis, capable of quickly completing requirements understanding, information translation and suggestion generation.\n\n【Function Description】The system activated the "Comprehensive Intelligent Analysis" function button. The purpose of this button is: to intelligently analyze customer input, complete requirements understanding, professional translation, missing information identification and AI suggestion generation, providing practical suggestions for customer service.\n\n【Generation Instructions】Please conduct retail scenario analysis based on comprehensive intelligent analysis professional requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        instruction: `You need to quickly complete the following tasks:

1. Requirements Understanding: Identify customer core needs
2. Requirements Translation: Transform into customer service expressions
3. Missing Information Identification: Identify key information points
4. AI Suggestion Generation: Provide sales suggestions

Requirements:
- Suggestions should be practical and feasible
- Information options should be specific (e.g.: budget, size, material, etc.)
- Based on retail industry characteristics, include scripts
- When information is insufficient, specify key information that needs to be understood`
      },
      enterprise: {
        systemRole: '【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in enterprise requirements analysis, capable of quickly completing business requirements analysis and solution suggestion generation.\n\n【Function Description】The system activated the "Enterprise Comprehensive Analysis" function button. The function of this button is: to intelligently analyze enterprise business requirements, complete requirements understanding, professional translation, key information identification and solution suggestion generation.\n\n【Generation Instructions】Please conduct enterprise scenario analysis based on enterprise comprehensive analysis professional requirements.\n\n**⚡ Important: Responses must be concise and to the point, avoiding lengthy expressions and unnecessary details. No over-reasoning - provide practical answers directly.**',
        instruction: `You need to quickly complete the following tasks:

1. Requirements Understanding: Identify core business needs
2. Requirements Translation: Transform into enterprise service expressions
3. Missing Information Identification: Identify key information points
4. AI Suggestion Generation: Provide enterprise solutions

Requirements:
- Suggestions should be practical and feasible
- Information options should be specific (e.g.: budget scale, time requirements, technology stack, etc.)
- Based on enterprise service characteristics, include implementation plans
- When information is insufficient, specify key information that needs to be understood`
      }
    }

    const prompt = scenarioPrompts[scenario || 'retail'] || scenarioPrompts.retail
    
    // Build chat history context
    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}

${prompt.instruction}

【Important】Input content filtering and intelligent processing rules:
1. Inappropriate language handling: If user input contains profanity, vulgarity, or aggressive words, do not repeat this content, but:
   - Identify as "user emotional expression" or "test input"
   - Understand possible real intentions (such as expressing dissatisfaction, seeking help, random testing, etc.)
   - Respond in a professional and friendly manner

2. Meaningless input handling: If input is:
   - Random letter/number combinations (like "cnm", "123", "aaa")
   - Single words without clear requirement meaning
   - Obviously test inputs
   Identify as "users needing guidance", suggest providing real requirements

3. Negative emotion recognition: If input expresses dissatisfaction or negative emotions, transform into opportunities to understand problems and provide help

Please output in the following format:

【REQUIREMENTS UNDERSTANDING】
Briefly summarize the user's core requirements (no more than 30 words)
- For valid requirements: normal summary
- For inappropriate input: state "user test input" or "user emotional expression"
- For meaningless input: state "input content unclear, needs guidance"

【REQUIREMENTS TRANSLATION】
Transform into professional description:
- For valid requirements: normal translation
- For inappropriate input: translate to "customer may be testing system or expressing emotions, suggest friendly guidance to provide specific requirements"
- For meaningless input: translate to "customer input is unclear, suggest actively asking what help can be provided"

【INFORMATION OPTIONS】
Generate options for specific requirements, format: option name|inquiry reason
- For valid requirements: normally generate 3-5 options
- For invalid input: return "no need to collect additional information"

【AI Suggestions】
Provide professional suggestions based on analysis results (limited to 100 words):
- For valid requirements: provide specific product recommendations, script suggestions, handling solutions
- For inappropriate input: suggest customer service provide friendly guidance to understand customer real needs
- For meaningless input: suggest actively asking customers what help they need

【AI Guidance】
Provide specific operational guidance for customer service (limited to 80 words):
- Include specific communication scripts
- Clarify next step operation suggestions
- Precautions or skill tips`
      },
      {
        role: 'user', 
        content: `User input: "${content}"${image ? '\n(User also uploaded an image)' : ''}${chatContext}`
      }
    ]

    const sanitizedResult = await callModelScopeAPI(comprehensivePrompt, 0.7, 3072, streamCallbacks, { enableThinking: true, stream: true })
    
    // Parse results
    const needsMatch = (sanitizedResult || '').match(/【REQUIREMENTS UNDERSTANDING】\s*\n([\s\S]*?)(?=\n【|$)/)
    const translationMatch = (sanitizedResult || '').match(/【REQUIREMENTS TRANSLATION】\s*\n([\s\S]*?)(?=\n【|$)/)
    const optionsMatch = (sanitizedResult || '').match(/【INFORMATION OPTIONS】\s*\n([\s\S]*?)(?=\n【|$)/)
    const suggestionMatch = (sanitizedResult || '').match(/【AI Suggestions】\s*\n([\s\S]*?)(?=\n【|$)/)
    const adviceMatch = (sanitizedResult || '').match(/【AI Guidance】\s*\n([\s\S]*?)(?=\n【|$)/)

    const needsUnderstanding = needsMatch ? needsMatch[1].trim() : 'Requirements Analysis'
    const translation = translationMatch ? translationMatch[1].trim() : 
      `Customer inquiry: ${content}, suggest understanding customer specific needs to provide precise ${scenario || 'retail'} service solutions.`
    const optionsText = optionsMatch ? optionsMatch[1].trim() : ''
    const suggestion = suggestionMatch ? suggestionMatch[1].trim() : 'Analyzing your requirements and generating suggestions...'
    const aiAdvice = adviceMatch ? adviceMatch[1].trim() : 'Suggest actively understanding customer specific needs, providing targeted service.'

    // Parse information options
    const missingInfoOptions = []
    if (optionsText && optionsText !== 'no need to collect additional information') {
      const lines = optionsText.split('\n').filter(line => line.trim())
      for (const line of lines) {
        // Match format: option name|description
        const match = line.match(/^[•\-\*]?\s*([^|]{2,8})\|(.+)$/)
        if (match) {
          missingInfoOptions.push({
            name: match[1].trim(),
            description: match[2].trim(),
            selected: false
          })
        }
      }
    }

    console.log('[LLM] Comprehensive intelligent analysis results:', {
      needsUnderstanding,
      translation,
      missingInfoOptions,
      suggestion,
      aiAdvice
    })

    return {
      needsUnderstanding,
      translation,
      missingInfoOptions,
      suggestion,
      aiAdvice,
      structuredOutput: {
        needsUnderstanding,
        translation,
        missingInfoOptions,
        suggestion,
        aiAdvice
      }
    }

  } catch (error) {
    console.error('Comprehensive intelligent analysis error:', error)
    throw error
  }
}

// Generate department contact suggestions
const generateDepartmentSuggestion = async (content, scenario, chatHistory = [], aiChatHistory = []) => {
  try {
    console.log('\n=== Starting department contact suggestion generation ===')
    console.log('Conversation content:', content)
    console.log('Scenario:', scenario)

    const chatContext = buildChatContextWithLogging(chatHistory, 'Department Contact Suggestion Context', 4)

    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a professional retail business supervisor, familiar with departmental divisions and responsibilities.',
        context: 'Based on current conversation, analyze customer needs and recommend appropriate department contact plans.',
        departments: [
          'Customer Service Department - Handle general customer inquiries and complaints',
          'Sales Department - Product recommendations, price inquiries, promotional activities',
          'Technical Support - Product usage issues, troubleshooting',
          'After-sales Service - Returns/exchanges, repairs, warranty',
          'Management - Important customers, complex issues, complaint escalation'
        ]
      },
      enterprise: {
        systemRole: 'You are an enterprise service expert, understanding interdepartmental collaboration relationships within enterprises.',
        context: 'Based on cross-departmental communication needs, provide optimal department contact suggestions.',
        departments: [
          'Marketing Department - Marketing strategies, brand promotion, market research',
          'R&D Department - Technical development, product innovation, technical support',
          'Operations Department - Business processes, operational analysis, efficiency optimization',
          'Human Resources - Personnel allocation, training needs, team coordination',
          'Management - Strategic decisions, resource allocation, major issues'
        ]
      },
      education: {
        systemRole: 'You are an educational management expert, familiar with the organizational structure of educational institutions.',
        context: 'Based on student or teacher needs, recommend appropriate departments or personnel.',
        departments: [
          'Academic Affairs Office - Course scheduling, student records management, examination affairs',
          'Student Affairs Office - Student life, psychological counseling, activity organization',
          'Teaching Departments - Specific subjects, teaching methods, academic guidance',
          'Technical Support - Equipment maintenance, system usage, technical training',
          'School Leadership - Important decisions, policy consultation, major issues'
        ]
      }
    }

    const currentScenario = scenarioPrompts[scenario] || scenarioPrompts.retail

    const prompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in assisting customer service with departmental coordination, helping customer service quickly identify the most suitable departments to handle issues and formulate contact strategies.

【Function Description】Customer service encountered situations requiring cross-departmental collaboration and clicked the "Department Contact Suggestions" button. The function of this button is: based on current customer issues and conversation situations, intelligently analyze and recommend the most suitable contact departments, providing concise contact reasons and key points.

【Generation Instructions】Please analyze the current situation and recommend suitable departments based on professional department contact suggestion requirements: only recommend 1 most suitable contact department, extremely concise, one sentence explanation of reason, one sentence explanation of key points, strictly prohibit word counting.

${currentScenario.systemRole}

${currentScenario.context}

Available Contact Departments:
${currentScenario.departments.map(dept => `• ${dept}`).join('\n')}

Conversation History:
${chatContext}

Current Situation:
${content}

Please recommend in the following format:
**Suggested Contact: [Department Name]**
- Reason: [Brief explanation]
- Contact Key Points: [Key information, 1-2 sentences]`

    const messages = [
      { role: 'user', content: prompt }
    ]

    const response = await callModelScopeAPI(messages, 0.7, 2048, null, { enableThinking: false, stream: false })
    const result = response.trim()
    
    console.log('✅ Department contact suggestion generation completed')
    return result

  } catch (error) {
    console.error('Error generating department contact suggestions:', error)
    throw error
  }
}

// Generate department contact suggestions and internal instructions (for contact mode only, supports streaming display)
const generateDepartmentContactWithInstructions = async (content, scenario, chatHistory = [], streamCallbacks = null, aiChatHistory = []) => {
  try {
    console.log('\n=== Starting department contact suggestion and internal instruction generation ===')
    console.log('Conversation content:', content)
    console.log('Scenario:', scenario)

    const chatContext = buildDualHistoryContext(chatHistory, aiChatHistory)

    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a professional retail customer service supervisor responsible for coordinating various departments to handle customer issues and formulating internal contact instructions.',
        context: 'Based on current conversation, analyze situation and provide: 1) Recommended contact departments 2) Specific internal contact instructions',
        departments: [
          'Customer Service Department - Handle general customer inquiries and complaints',
          'Sales Department - Product recommendations, price inquiries, promotional activities',
          'Technical Support - Product usage issues, troubleshooting',
          'After-sales Service - Returns/exchanges, repairs, warranty',
          'Finance Department - Refunds, accounting, price adjustments',
          'Management - Important customers, complex issues, complaint escalation'
        ]
      },
      enterprise: {
        systemRole: 'You are an enterprise internal coordination expert responsible for cross-departmental communication coordination and internal instruction formulation.',
        context: 'Based on inter-departmental communication needs, provide department contact plans and specific execution instructions.',
        departments: [
          'Marketing Department - Marketing strategies, brand promotion, market research',
          'R&D Department - Technical development, product innovation, technical support',
          'Operations Department - Business processes, operational analysis, efficiency optimization',
          'Human Resources - Personnel allocation, training needs, team coordination',
          'Finance Department - Budget approval, cost control, financial analysis',
          'Management - Strategic decisions, resource allocation, major issues'
        ]
      },
      education: {
        systemRole: 'You are an educational management coordinator, familiar with the organizational structure and coordination processes of educational institutions.',
        context: 'Based on student or teacher needs, recommend appropriate department contacts and formulate handling instructions.',
        departments: [
          'Academic Affairs Office - Course scheduling, student records management, examination affairs',
          'Student Affairs Office - Student life, psychological counseling, activity organization',
          'Teaching Departments - Specific subjects, teaching methods, academic guidance',
          'Technical Support - Equipment maintenance, system usage, technical training',
          'Administrative Department - Document processing, process approval, policy consultation',
          'School Leadership - Important decisions, policy consultation, major issues'
        ]
      }
    }

    const currentScenario = scenarioPrompts[scenario] || scenarioPrompts.retail

    const prompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in assisting customer service with comprehensive departmental coordination, capable of both recommending suitable contact departments and generating detailed internal execution instructions.

【Function Description】Customer service faced complex situations requiring departmental collaboration and clicked the "Complete Contact Plan" button. The comprehensive function of this button is: not only analyze and recommend the most suitable contact departments, but also generate specific internal contact instructions and execution steps, providing complete coordination plans for customer service.

【Generation Instructions】Please provide comprehensive departmental coordination plans based on professional complete contact plan generation requirements: precisely recommend contact departments with explanations, formulate specific actionable internal instructions, including immediate action steps, contact key points and follow-up requirements, with total length controlled within 200 words.

${currentScenario.systemRole}

${currentScenario.context}

Available Contact Departments:
${currentScenario.departments.map(dept => `• ${dept}`).join('\n')}

Conversation History:
${chatContext}

Current Situation Analysis:
${content}

Please provide complete plan in the following format:

## 📞 **Recommended Contact Departments**
**Primary Contact:** [Most suitable department name]
**Reason:** [Concise reason for choosing this department]

**Alternative Contact:** [Secondary department (if necessary)]
**Reason:** [Alternative reason]

## 📋 **Internal Contact Instructions**
**Immediate Actions:**
1. [Specific operation step 1]
2. [Specific operation step 2]

**Contact Key Points:**
• [Key information 1 to explain to department]
• [Key information 2 to explain to department]

**Follow-up Requirements:**
• [Content requiring department feedback]
• [Expected response time]`

    const messages = [
      { role: 'user', content: prompt }
    ]

    // Decide calling method based on whether there are streaming callbacks
    if (streamCallbacks) {
      console.log('📡 Using streaming mode to generate department contact suggestions and internal instructions')
      const response = await callModelScopeAPI(messages, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
      console.log('✅ Department contact suggestions and internal instructions generation completed (streaming)')
      return response.trim()
    } else {
      console.log('📝 Using non-streaming mode to generate department contact suggestions and internal instructions')
      const response = await callModelScopeAPI(messages, 0.7, 2048, null, { enableThinking: false, stream: false })
      const result = response.trim()
      console.log('✅ Department contact suggestions and internal instructions generation completed (non-streaming)')
      return result
    }

  } catch (error) {
    console.error('Error generating department contact suggestions and internal instructions:', error)
    throw error
  }
}

// Handle emergency situations
const handleEmergencyProcessing = async (emergencyData, scenario, streamCallbacks = null) => {
  try {
    console.log('\n=== Starting emergency situation handling ===')
    console.log('Emergency level:', emergencyData.urgencyLevel)
    console.log('Situation description:', emergencyData.description)

    const urgencyLevels = {
      urgent: { name: 'Urgent', priority: 'High priority handling, respond within 1 hour' },
      high: { name: 'High', priority: 'Important matter, handle within 4 hours' },
      critical: { name: 'Critical', priority: 'Immediate handling, simultaneously report to management' }
    }

    const currentLevel = urgencyLevels[emergencyData.urgencyLevel] || urgencyLevels.urgent

    const scenarioPrompts = {
      retail: {
        systemRole: 'You are an experienced retail crisis management expert.',
        context: 'Facing urgent customer service situations, need to provide solutions quickly and professionally.',
        escalationProtocol: 'Customer Service Supervisor → Store Manager → Regional Manager → Headquarters'
      },
      enterprise: {
        systemRole: 'You are an enterprise emergency affairs handling expert.',
        context: 'Handle enterprise internal emergency affairs, ensure business continuity and risk control.',
        escalationProtocol: 'Direct Supervisor → Department Manager → Senior Management → CEO'
      },
      education: {
        systemRole: 'You are an educational institution emergency affairs handling expert.',
        context: 'Handle campus emergency situations, ensure faculty and student safety and teaching order.',
        escalationProtocol: 'Class Teacher → Grade Director → Academic Affairs Director → Principal'
      }
    }

    const currentScenario = scenarioPrompts[scenario] || scenarioPrompts.retail

    let contextInfo = ''
    if (emergencyData.context && emergencyData.context.recentMessages) {
      const recentMessages = emergencyData.context.recentMessages
        .map(msg => msg.text || msg.output || '')
        .filter(text => text.trim())
        .join('\n')
      
      if (recentMessages) {
        contextInfo = `\nRelevant conversation background:\n${recentMessages}\n`
      }
    }

    const prompt = `【Platform Introduction】You are working for the ZeroTouch Intelligent Communication Mediation Platform, which is an AI system specialized in handling emergency affairs, providing rapid and professional emergency handling guidance for customer service in crisis situations.

【Function Description】The system detected an emergency situation and activated the "Emergency Handling" function button. The key role of this button is: based on the level and description of emergency events, quickly generate emergency handling plans for customer service, including immediate action steps, contact personnel and time requirements, ensuring crises are handled promptly.

【Generation Instructions】Please generate emergency handling plans based on professional emergency handling requirements: provide concise and practical emergency handling plans, highlighting actionable steps.

**⚡ Mandatory Requirements: Answers must be extremely concise, get straight to the core, maximum 3 steps, strictly prohibit lengthy expressions, explanations, background descriptions, word counting and any unnecessary content. Only state key actions!**

${currentScenario.systemRole}

Emergency Situation: ${emergencyData.description}
Level: ${currentLevel.name} (${currentLevel.priority})${contextInfo}

Please provide handling plan in the following format:

**Immediate Actions:**
1. [Priority step 1]
2. [Priority step 2]

**Contact Personnel:** [Key contacts/departments]

${emergencyData.urgencyLevel === 'critical' ? '**Management Report:** [Key points]' : '**Estimated Time:** [Processing duration]'}`

    const messages = [
      { role: 'user', content: prompt }
    ]

    const response = await callModelScopeAPI(messages, 0.7, 2048, streamCallbacks, { enableThinking: true, stream: true })
    const result = response.trim()
    
    console.log('✅ Emergency handling plan generation completed')
    return result

  } catch (error) {
    console.error('Error handling emergency situation:', error)
    throw error
  }
}

// Export other potentially needed functions
export {
  callModelScopeAPI,
  analyzeContext,
  conceptualize,
  detectMissingInfo,
  translateToSolution,
  optimizeForUser,
  generateEnterpriseSuggestion,
  generateEnterpriseFollowUp,
  negotiateSuggestion,
  generateDepartmentContact,
  generateDepartmentContactOnly,
  chatWithAI,
  comprehensiveAnalysisWithSuggestion,
  generateDepartmentSuggestion,
  generateDepartmentContactWithInstructions,
  handleEmergencyProcessing
}
