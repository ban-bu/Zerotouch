import React, { useState, useRef, useEffect } from 'react'
import { Send, User, Bot, Image as ImageIcon } from 'lucide-react'
import { MessageSendingLoader, TypingLoader } from './LoadingStates'
import AnimatedTransition from './AnimatedTransition'

const ProblemPanel = ({ scenario, messages, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 关闭自动滚动：生成内容后保持视图位置不变
  useEffect(() => {
    // no-op to prevent auto scroll on messages update
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() && !imageFile) return

    onSendMessage({
      text: input.trim(),
      image: imageFile,
      timestamp: new Date().toISOString()
    })

    setInput('')
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const insertExample = () => {
    setInput(scenario.example)
  }

  return (
    <div className="h-full flex flex-col glass-effect rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
      backdropFilter: 'blur(20px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      height: 'calc(100vh - 200px)' // 统一高度设置
    }}>
      <div className="panel-header glass-effect flex-shrink-0" style={{background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.12) 100%)', backdropFilter: 'blur(20px) saturate(1.3)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'}}>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100/70 dark:bg-blue-900/50 rounded-2xl backdrop-blur-sm">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Customer Conversation</h3>
            {/* 隐藏副标题 */}
            {false && (
              <p className="text-xs text-gray-600 dark:text-gray-400">{scenario.problemRole}</p>
            )}
          </div>
        </div>
        {/* 隐藏自动转译提示 */}
        {false && (
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
            <span>✨ 自动转译到方案端</span>
          </div>
        )}
      </div>

      {/* Messages Area - 启用滚动 */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(248, 250, 252, 0.01) 100%)',
        backdropFilter: 'blur(10px) saturate(1.1)'
      }}>
        {(!messages || messages.length === 0) && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-100/80 to-sky-100/80 dark:from-blue-900/30 dark:to-sky-900/30 rounded-full shadow-inner backdrop-blur-sm">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-2">
              <p className="text-sm">Enter your request or question here</p>
              <p className="text-xs text-gray-400">
                Text and image input supported
              </p>
            </div>
          </div>
        )}
        
        {messages && messages.map((message, index) => (
          <div key={index} className="space-y-2">
            {message.type === 'user' && (
              <AnimatedTransition type="slide-right" show={true}>
                <div className="message-bubble message-user slide-in-right">
                  {message.image && (
                    <div className="mb-2">
                      <img 
                        src={URL.createObjectURL(message.image)} 
                        alt="User upload" 
                        className="max-w-full h-auto rounded-lg shadow-md"
                      />
                    </div>
                  )}
                  <div className="flex items-start space-x-2">
                    <User className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      {/* [MODIFIED] 为单条长消息提供滚动容器 */}
                      <div className="message-content">
                        <p className="whitespace-pre-wrap select-text">{message.text}</p>
                      </div>
                      <div className="text-xs text-gray-300 mt-1 opacity-90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedTransition>
            )}
            
            {message.type === 'ai_response' && (
              <AnimatedTransition type="slide-left" show={true}>
                <div className="message-bubble message-ai slide-in-left">
                  <div className="flex items-start space-x-2">
                    <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      {/* [MODIFIED] 为单条长消息提供滚动容器 */}
                      <div className="message-content">
                <p className="whitespace-pre-wrap select-text">{message.text}</p>
              </div>
                      <div className="text-xs text-gray-300 mt-1 opacity-90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedTransition>
            )}
          </div>
        ))}
        
        {isProcessing && (
          <div className="message-bubble message-ai">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-gray-600" />
              <TypingLoader message="AI is translating" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/20 dark:border-white/10 glass-effect rounded-b-2xl flex-shrink-0">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex space-x-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`As ${scenario.problemRole}, please describe your needs...`}
                className="input-field resize-none transition-all duration-200 focus:shadow-md"
                rows={3}
                readOnly={isProcessing}
              />
              
              {/* Image preview */}
              {imageFile && (
                <AnimatedTransition type="scale" show={true}>
                  <div className="mt-3 relative inline-block">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Preview" 
                      className="max-w-xs h-auto rounded-lg border border-gray-300 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 shadow-lg transition-all duration-200 hover:scale-110"
                    >
                      ×
                    </button>
                  </div>
                </AnimatedTransition>
              )}
              
              {/* Sending indicator */}
              {isProcessing && (
                <div className="mt-2">
                  <MessageSendingLoader message="Sending..." />
                </div>
              )}
            </div>
            
            <div className="flex items-end space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              {/* 隐藏图片上传功能 */}
              {/* <label
                htmlFor="image-upload"
                className="btn-ghost p-3 transition-all duration-200 hover:scale-105 cursor-pointer"
                title="上传图片"
              >
                <ImageIcon className="w-5 h-5" />
              </label> */}
              
              <button
                type="submit"
                disabled={(!input.trim() && !imageFile) || isProcessing}
                className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProblemPanel