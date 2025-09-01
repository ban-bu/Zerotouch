// [MODIFIED] ModelScope LLM处理服务（旧版文件保持兼容接口）

// ModelScope API配置
const MODELSCOPE_CONFIG = {
  baseURL: 'https://api-inference.modelscope.cn/v1/',
  model: 'deepseek-ai/DeepSeek-V3',
  apiKey: 'ms-61ecf06f-49de-409b-b685-00a383961042'
}

// 调用魔搭API的通用函数
const callModelScopeAPI = async (messages, temperature = 0.7) => {
  try {
    const response = await fetch(`${MODELSCOPE_CONFIG.baseURL}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MODELSCOPE_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: MODELSCOPE_CONFIG.model,
        messages: messages,
        temperature: temperature,
        max_tokens: 4096,
        stream: false
      })
    })

    if (!response.ok) {
      console.log('❌ HTTP Status:', response.status, response.statusText)
      
      // 尝试获取详细的错误信息
      let errorDetail = ''
      try {
        const errorData = await response.json()
        console.log('❌ API Error Details:', errorData)
        errorDetail = errorData.error?.message || errorData.message || ''
      } catch (e) {
        console.log('❌ Failed to parse error response')
      }
      
      const errorMsg = errorDetail ? `API调用失败: ${response.status} ${response.statusText} - ${errorDetail}` : `API调用失败: ${response.status} ${response.statusText}`
      throw new Error(errorMsg)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('魔搭API调用错误:', error)
    throw error
  }
}

// 统一清理输出文本，移除影响体验的模板化致歉或引导语
const sanitizeOutput = (text) => {
  if (!text) return text
  const bannedPhrases = [
    '非常抱歉',
    '抱歉',
    '我未能理解',
    '请您详细描述',
    '请提供更多信息',
    '信息不足',
    '若有不符请指正',
    '你好！很高兴能帮助你。',
    '请问你现在是在寻找什么类型的商品',
    '衣服、鞋子还是其他什么小物件'
  ]
  let sanitized = text
  bannedPhrases.forEach((p) => {
    const regex = new RegExp(p, 'g')
    sanitized = sanitized.replace(regex, '')
  })
  return sanitized.trim()
}

// 处理问题端输入 - 增强版本，支持聊天历史和深度理解
const processProblemInput = async (content, image, scenario, chatHistory = []) => {
  try {
    // 根据场景定制提示词 - 增强版本
    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a professional AI communication assistant for retail. Your role: 1) understand the customer\'s explicit and implicit needs, 2) translate them into a clear, actionable description for the store, 3) propose 2–3 feasible solution options based on business capability.',
        context: 'Context: customer ↔ store communication. Be aware of language gaps: customers may be vague or emotional; businesses often reply with jargon.\n\nCore tasks:\n1) Deep understanding: analyze explicit and implicit needs and potential miscommunication\n2) Precise translation: convert needs into a professional description (product type, usage scenario, budget, specifications, etc.)\n3) Solution suggestions: propose 2–3 concrete options (product/service, price range, notes)',
        example: 'Example: Customer says "I need something for a business event" → Translation: "Business formalwear required for an important meeting; budget TBD; professional image needed" → Suggestions: 1) Classic suit set; 2) Business casual set; 3) Personal styling service.'
      },
      enterprise: {
        systemRole: 'You are an AI assistant for cross‑department communication. Your role: 1) understand business needs and engineering constraints, 2) remove communication gaps, 3) propose feasible technical options.',
        context: 'Context: internal collaboration across departments. Business focuses on outcome/time; engineering on feasibility/resources.\n\nCore tasks:\n1) Requirement analysis: convert business needs into technical requirements (KPIs, timeline, constraints)\n2) Solution design: provide 2–3 options with different complexity\n3) Risk assessment: highlight risks and resource needs',
        example: 'Example: "We need to improve user experience" → Translation: "Implement UX improvements targeting retention in 3 months" → Suggestions: quick UI tweaks; medium redesign of core flows; full UX overhaul with timeline and cost.'
      },
      education: {
        systemRole: 'You are an AI teaching assistant bridging students and teachers. Your role: 1) understand learning difficulties, 2) translate them into actionable teaching points, 3) propose diverse teaching options.',
        context: 'Context: teacher–student communication. Students may not articulate difficulties; teachers may use heavy jargon.\n\nCore tasks:\n1) Diagnosis: identify concrete difficulties and background\n2) Teaching translation: convert needs into professional teaching points (knowledge, difficulties, goals)\n3) Suggestions: provide 2–3 implementable teaching plans',
        example: 'Example: Student says "I don\'t get this concept" → Translation: "Difficulty with wave–particle duality; start from basics, use experiments" → Suggestions: experiment demos, analogies, and progressive teaching.'
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`Invalid scenario: ${scenario}. Supported: ${Object.keys(scenarioPrompts).join(', ')}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Build chat history context (English)
    let chatContext = ''
    if (chatHistory && chatHistory.length > 0) {
      chatContext = '\n\nChat History:\n' + 
        chatHistory.slice(-6).map((msg, index) => {
          const role = msg.type === 'user' ? 'Customer' : msg.type === 'ai_response' ? 'Enterprise Reply' : 'AI Processing'
          return `${index + 1}. ${role}: ${msg.text}`
        }).join('\n')
    }
    
    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}\n\n${prompt.context}\n\n${prompt.example}\n\nGuidelines:\n1) Use chat history to understand true needs.\n2) Translate clearly and concisely, optimize structure.\n3) Be action‑oriented and practical.\n4) Keep tone friendly and professional.\n5) Emphasize value and risks truthfully.\nOutput MUST be in English.`
      },
      {
        role: 'user',
        content: `Current user input: "${content}"${image ? '\n(The user also uploaded an image)' : ''}${chatContext}\n\nPlease output strictly in the following sections (English):\n\n## Needs Translation\nTranslate the user need into a professional, specific description with key details.\n\n## Solution Suggestions\nProvide 2-3 feasible options. Use the format:\nOption 1: [one‑line concrete option]\nOption 2: [one‑line concrete option]\nOption 3: [one‑line concrete option]\n\n## Information to Confirm\nList key information to confirm (use "None" if nothing).`
      }
    ]
    const resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.1)
    const result = sanitizeOutput(resultRaw)

    // 解析结构化输出
    const sections = {
      translation: '',
      solutions: [],
      confirmations: ''
    }
    
    // 提取需求转译部分
    const translationMatch = result.match(/##\s*Needs Translation\s*([\s\S]*?)(?=##\s*Solution Suggestions|##\s*Information to Confirm|$)/)
    if (translationMatch) {
      sections.translation = translationMatch[1].trim()
    }
    
    // 提取解决方案建议部分
    const solutionsMatch = result.match(/##\s*Solution Suggestions\s*([\s\S]*?)(?=##\s*Information to Confirm|$)/)
    if (solutionsMatch) {
      const solutionsText = solutionsMatch[1].trim()
      const solutionMatches = solutionsText.match(/Option\s*[1-3]:\s*([^\n]+)/g)
      if (solutionMatches) {
        sections.solutions = solutionMatches.map(match => match.replace(/Option\s*[1-3]:\s*/i, '').trim())
      }
    }
    
    // 提取待确认信息部分
    const confirmationsMatch = result.match(/##\s*Information to Confirm\s*([\s\S]*?)$/)
    if (confirmationsMatch) {
      sections.confirmations = confirmationsMatch[1].trim()
    }

    // 构建详细的步骤显示
    const steps = [
      {
        name: 'Needs Analysis & Translation',
        content: sections.translation || result
      }
    ]
    
    if (sections.solutions.length > 0) {
      steps.push({
        name: 'Solution Suggestions',
        content: sections.solutions.map((solution, index) => `方案${index + 1}：${solution}`).join('\n\n')
      })
    }
    
    if (sections.confirmations && sections.confirmations.toLowerCase() !== 'none') {
      steps.push({
        name: 'Information to Confirm',
        content: sections.confirmations
      })
    }

    // Build message for solution side: only include requirement translation, avoid re-translating AI generated suggestions
    const translatedMessage = sections.translation || result

    return {
      steps,
      translatedMessage,
      structuredOutput: sections
    }
  } catch (error) {
    console.error('处理问题输入时出错:', error)
    throw error
  }
}

// 处理方案端响应 - 增强版本，支持聊天历史和解决方案优化
const processSolutionResponse = async (content, scenario, chatHistory = []) => {
  try {
    const scenarioPrompts = {
      retail: {
        systemRole: 'You are a retail customer service AI assistant. Convert professional replies into customer‑friendly language.',
        context: 'Retail replies often include product info, pricing and terms. Your job: translate into simple, empathetic language and provide actionable suggestions.',
        example: 'Enterprise reply: "Wholesale unit price is $80 with MOQ 100." → Optimized: "If you need 100+ units, the price is $80 per unit. Tell us your desired quantity and we\'ll prepare a total and delivery plan."'
      },
      enterprise: {
        systemRole: 'You are an enterprise service AI assistant. Translate technical/business proposals for decision makers.',
        context: 'Technical teams provide complex specs and plans. Translate to business language, highlight value, cost, risks and roadmap.',
        example: 'Reply: "Adopt microservices with Docker; 6 months; 3 senior engineers." → Optimized: "A scalable architecture completed in ~6 months by 3 senior engineers. Let\'s align requirements and milestones next."'
      },
      education: {
        systemRole: 'You are an education service AI assistant. Translate teaching plans into student/parent‑friendly language.',
        context: 'Explain course plans, learning goals and arrangements in plain language, highlighting value and steps.',
        example: 'Reply: "24 lessons, 2 per week, STEAM approach" → Optimized: "Two lessons weekly for 12 weeks with hands‑on projects. We\'ll share a simple materials list in advance."'
      }
    }

    if (!scenario || !scenarioPrompts[scenario]) {
      throw new Error(`Invalid scenario: ${scenario}. Supported: ${Object.keys(scenarioPrompts).join(', ')}`)
    }
    const prompt = scenarioPrompts[scenario]
    
    // Build chat history (English)
    let chatContext = ''
    if (chatHistory && chatHistory.length > 0) {
      chatContext = '\n\nChat History:\n' + 
        chatHistory.slice(-6).map((msg, index) => {
          const role = msg.type === 'user' ? 'Customer' : msg.type === 'ai_response' ? 'Enterprise Reply' : msg.type === 'llm_request' ? 'Needs Translation' : 'AI Processing'
          return `${index + 1}. ${role}: ${msg.text}`
        }).join('\n')
    }
    
    const comprehensivePrompt = [
      {
        role: 'system',
        content: `${prompt.systemRole}\n\n${prompt.context}\n\n${prompt.example}\n\nGuidelines: be concise, friendly, and practical. Output in English.`
      },
      {
        role: 'user',
        content: `Enterprise reply: "${content}"${chatContext}\n\nPlease output using these sections (English):\n\n## Optimized Reply\nCustomer‑friendly wording with key info and value.\n\n## Action Suggestions\nProvide 2–3 concrete next steps.\n\n## Additional Notes\nAny extra notes or caveats (use "None" if nothing).`
      }
    ]
    const resultRaw = await callModelScopeAPI(comprehensivePrompt, 0.1)
    const result = sanitizeOutput(resultRaw)

    // 解析结构化输出
    const optimizedReplyMatch = result.match(/##\s*Optimized Reply\s*([\s\S]*?)(?=##\s*Action Suggestions|##\s*Additional Notes|$)/)
    const actionSuggestionsMatch = result.match(/##\s*Action Suggestions\s*([\s\S]*?)(?=##\s*Additional Notes|$)/)
    const additionalInfoMatch = result.match(/##\s*Additional Notes\s*([\s\S]*?)$/)
    
    const optimizedReply = optimizedReplyMatch ? optimizedReplyMatch[1].trim() : result
    const actionSuggestions = actionSuggestionsMatch ? actionSuggestionsMatch[1].trim() : ''
    const additionalInfo = additionalInfoMatch ? additionalInfoMatch[1].trim() : ''

    // 构建详细的步骤显示
    const steps = [
      {
        name: 'Language Optimization',
        content: optimizedReply
      }
    ]
    
    if (actionSuggestions && actionSuggestions.toLowerCase() !== 'none') {
      steps.push({
        name: 'Action Suggestions',
        content: actionSuggestions
      })
    }
    
    if (additionalInfo && additionalInfo.toLowerCase() !== 'none') {
      steps.push({
        name: 'Additional Notes',
        content: additionalInfo
      })
    }

    // 构建最终的优化消息
    let optimizedMessage = optimizedReply
    if (actionSuggestions && actionSuggestions.toLowerCase() !== 'none') {
      optimizedMessage += '\n\n' + actionSuggestions
    }
    if (additionalInfo && additionalInfo.toLowerCase() !== 'none') {
      optimizedMessage += '\n\n' + additionalInfo
    }

    return {
       steps,
       optimizedMessage,
       structuredOutput: {
         optimizedReply,
         actionSuggestions,
         additionalInfo
       }
     }
  } catch (error) {
    console.error('处理方案响应时出错:', error)
    throw error
  }
}



// 辅助函数 - 保留用于向后兼容
const analyzeContext = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '你是一个语境分析专家，请分析用户输入的业务场景和上下文。'
    },
    {
      role: 'user',
      content: `用户输入："${content}"\n\n请分析这个输入可能涉及的业务场景、行业背景或使用环境。`
    }
  ]
  return await callModelScopeAPI(prompt)
}

const conceptualize = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '你是一个概念设计师，请将用户需求转化为具体的概念和功能点。'
    },
    {
      role: 'user',
      content: `基于用户输入："${content}"\n\n请将其概念化为具体的功能需求或解决方案要点。`
    }
  ]
  return await callModelScopeAPI(prompt)
}

const detectMissingInfo = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '你是一个需求完整性检查专家，请识别用户输入中可能缺失的关键信息。'
    },
    {
      role: 'user',
      content: `用户输入："${content}"\n\n请识别为了更好地理解和满足用户需求，还需要哪些额外信息？`
    }
  ]
  return await callModelScopeAPI(prompt)
}

const translateToSolution = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '你是一个需求翻译专家，请将用户的原始输入转化为清晰、专业的需求描述。'
    },
    {
      role: 'user',
      content: `用户原始输入："${content}"\n\n请将其转化为清晰、专业的需求描述，包含具体的功能要求和期望结果。`
    }
  ]
  return await callModelScopeAPI(prompt)
}

const optimizeForUser = async (content) => {
  const prompt = [
    {
      role: 'system',
      content: '你是一个用户体验专家，请将技术方案转化为用户易懂的语言，并提供清晰的行动指南。'
    },
    {
      role: 'user',
      content: `技术方案："${content}"\n\n请将其转化为用户友好的语言，包含清晰的步骤和预期结果。`
    }
  ]
  return await callModelScopeAPI(prompt)
}

// 主要的LLM处理函数
export const processWithLLM = async ({ type, content, image, context, scenario, chatHistory = [] }) => {
  try {
    if (type === 'problem_input') {
      return await processProblemInput(content, image, scenario, chatHistory)
    } else if (type === 'solution_response') {
      return await processSolutionResponse(content, scenario, chatHistory)
    }
    
    throw new Error('未知的处理类型')
  } catch (error) {
    console.error('LLM处理错误:', error)
    throw error
  }
}

// 导出其他可能需要的函数
export {
  callModelScopeAPI,
  analyzeContext,
  conceptualize,
  detectMissingInfo,
  translateToSolution,
  optimizeForUser
}