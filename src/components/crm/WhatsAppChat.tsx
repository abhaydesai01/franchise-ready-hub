import { format } from 'date-fns';
import type { WAConversation } from '@/types';
import { Check, CheckCheck, AlertCircle, FileText, MapPin, User, Image } from 'lucide-react';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'read': return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
    case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-brand-muted" />;
    case 'sent': return <Check className="w-3.5 h-3.5 text-brand-muted" />;
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    default: return null;
  }
}

function MessageTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'document': return <FileText className="w-3.5 h-3.5" />;
    case 'image': return <Image className="w-3.5 h-3.5" />;
    case 'location': return <MapPin className="w-3.5 h-3.5" />;
    case 'contact': return <User className="w-3.5 h-3.5" />;
    default: return null;
  }
}

interface WhatsAppChatProps {
  conversation: WAConversation;
}

export function WhatsAppChat({ conversation }: WhatsAppChatProps) {
  const { messages } = conversation;

  // Group messages by date
  const grouped: Record<string, typeof messages> = {};
  messages.forEach(m => {
    const date = format(new Date(m.timestamp), 'yyyy-MM-dd');
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">WA</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-brand-ink">{conversation.phoneNumber}</p>
            <p className="text-[11px] text-brand-muted">{conversation.totalMessages} messages • {conversation.isActive ? 'Active' : 'Closed'}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${conversation.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {conversation.isActive ? 'Active' : 'Closed'}
        </span>
      </div>

      {/* Chat area */}
      <div className="bg-[#ECE5DD] rounded-lg p-3 space-y-3 max-h-[400px] overflow-y-auto">
        {Object.entries(grouped).map(([date, dayMessages]) => (
          <div key={date}>
            <div className="flex justify-center mb-2">
              <span className="text-[10px] bg-white/80 text-gray-600 px-3 py-0.5 rounded-full shadow-sm">
                {format(new Date(date), 'MMMM d, yyyy')}
              </span>
            </div>
            <div className="space-y-1.5">
              {dayMessages.map(msg => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                      isOutbound ? 'bg-[#DCF8C6]' : 'bg-white'
                    }`}>
                      {isOutbound && msg.agentName && (
                        <p className="text-[10px] font-semibold text-brand-crimson mb-0.5">{msg.agentName}</p>
                      )}
                      {msg.type !== 'text' && msg.type !== 'button_reply' && (
                        <div className="flex items-center gap-1 mb-1">
                          <MessageTypeIcon type={msg.type} />
                          <span className="text-[10px] text-brand-muted capitalize">{msg.type === 'template' ? `Template: ${msg.templateName}` : msg.type}</span>
                        </div>
                      )}
                      {msg.type === 'button_reply' && (
                        <span className="text-[10px] text-brand-muted">Button reply</span>
                      )}
                      <p className="text-[13px] text-gray-900 whitespace-pre-wrap">{msg.body}</p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <span className="text-[10px] text-gray-500">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                        {isOutbound && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
