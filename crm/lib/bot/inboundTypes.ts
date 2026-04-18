/** Normalized inbound WhatsApp message for the conversation engine. */
export interface InboundMessageInput {
  from: string;
  messageId: string;
  type: string;
  text?: string;
  buttonId?: string;
  buttonTitle?: string;
  listReplyId?: string;
  timestamp: string;
}
