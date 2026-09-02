import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface AdminInputBarProps {
  onSendMessage: (content: string) => Promise<void>
  disabled?: boolean
}

export function AdminInputBar({ onSendMessage, disabled }: AdminInputBarProps) {
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!newMessage.trim() || disabled) return

    setIsSending(true)
    try {
      await onSendMessage(newMessage)
      setNewMessage("")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t bg-background">
      <div className="flex gap-2 items-end">
        <Textarea 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Conversación cerrada" : "Escribe un mensaje..."}
          className="min-h-[44px] max-h-32 resize-none rounded-xl"
          rows={1}
          disabled={disabled || isSending}
        />
        <Button 
          size="icon" 
          className="h-11 w-11 rounded-xl shrink-0" 
          onClick={handleSend}
          disabled={!newMessage.trim() || disabled || isSending}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
