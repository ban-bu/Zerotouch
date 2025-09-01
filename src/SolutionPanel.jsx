import React, { useState, useRef, useEffect } from 'react'
import { Send, Users, Bot, FileText } from 'lucide-react'
import AnimatedTransition from './AnimatedTransition'

const SolutionPanel = ({ scenario, messages, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 智能滚动：只在用户接近底部时才自动滚动
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement
    if (!container) return

    // 检查用户是否接近底部（距离底部小于100px）
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    
    // 只有在用户接近底部时才自动滚动
    if (isNearBottom) {
      setTimeout(() => scrollToBottom(), 100) // 短暂延迟确保内容已渲染
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

  const insertSampleResponse = () => {
    const sampleResponses = {
      retail: '为您推荐三款商务西装：1）海军蓝修身款A123，售价1280元，意大利进口面料，免费修改，适合演讲场合；2）深灰经典款B456，售价1150元，舒适透气，商务首选；3）炭黑现代款C789，售价1350元，时尚剪裁。175cm身高建议选L码，提供3天内修改服务，可预约试穿。',
      enterprise: '推荐开发AI驱动的个性化推荐系统：第一阶段（1个月）用户行为数据收集分析，第二阶段（1.5个月）算法开发测试，第三阶段（0.5个月）部署优化。预计投入3名算法工程师、2名前端开发，总预算45万元，预期提升留存率至48%。',
      education: '波粒二象性可以通过双缝实验理解：当光通过两个缝时表现为波（产生干涉条纹），当我们观测光子通过哪个缝时表现为粒子（条纹消失）。建议做法：1）观看双缝实验视频，2）学习光电效应原理，3）练习相关计算题，4）参加实验课亲自操作。'
    }
    setInput(sampleResponses[scenario.id] || '')
  }

  return (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="icon-container bg-gradient-to-br from-green-500 to-emerald-600">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">解决方案</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{scenario.solutionRole}</p>
            </div>
          </div>
          {/* <button
            onClick={insertSampleResponse}
            className="text-xs text-green-600 hover:text-green-700 underline"
          >
            插入示例
          </button> */}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-4">
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 space-y-4">
            <AnimatedTransition type="fade" show={true}>
              <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full shadow-inner">
                <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </AnimatedTransition>
            <p className="text-lg">等待接收LLM翻译的需求</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              在此基础上提供定制化解决方案
            </p>
          </div>
        )}
        
        {messages && messages.map((message, index) => (
          <AnimatedTransition 
            key={index} 
            type={message.type === 'user' ? 'slide-right' : 'slide-left'} 
            show={true}
          >
            <div className="space-y-2">
              {message.type === 'llm_request' && (
                <div className="message-bubble bg-blue-50 text-blue-900 border border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start space-x-2">
                    <Bot className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-blue-700 mb-1">
                        来自LLM的翻译需求
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{message.text}</p>
                      <div className="text-xs text-blue-600 mt-1 opacity-75">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {message.type === 'user' && (
                <div className="message-bubble bg-green-100 text-green-900 ml-auto shadow-sm hover:shadow-md transition-all duration-200">
                  <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{message.text}</p>
                  <div className="text-xs text-green-700 mt-1 opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
              
              {message.type === 'ai_response' && (
                <div className="message-bubble message-ai shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start space-x-2">
                    <Bot className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        LLM优化后的响应
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{message.text}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AnimatedTransition>
        ))}
        
        {isProcessing && (
          <AnimatedTransition type="fade" show={true}>
            <div className="message-bubble message-ai border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-green-700 dark:text-green-400" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </AnimatedTransition>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex space-x-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`作为${scenario.solutionRole}，请提供您的专业建议...`}
                className="input-field resize-none transition-all duration-200 focus:shadow-md"
                rows={3}
                disabled={isProcessing}
              />
            </div>
            
            <div className="flex flex-col justify-end">
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 hover:scale-105"
                title="发送解决方案"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              💡 基于LLM中介的分析结果提供解决方案
            </div>
            

          </div>
        </form>
      </div>
    </>
  )
}

export default SolutionPanel