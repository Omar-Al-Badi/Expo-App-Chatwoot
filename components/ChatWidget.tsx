import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

async function getOrCreateSessionId(): Promise<string> {
  try {
    let sessionId = await AsyncStorage.getItem('chatSessionId');
    if (!sessionId) {
      sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      await AsyncStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
  } catch (error) {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}

const hardcodedResponses: { [key: string]: string } = {
  hello: "Hey there! How can I help you today?",
  hi: "Hello! What's on your mind?",
  help: "I'm here to assist you! Try asking me about the weather, time, or just say hello!",
  weather: "It's a beautiful day today! ☀️ Perfect weather for coding!",
  time: `The current time is ${new Date().toLocaleTimeString()}`,
  "how are you": "I'm doing great, thanks for asking! How about you?",
  thanks: "You're welcome! Happy to help!",
  thank: "You're welcome! Happy to help!",
  bye: "Goodbye! Have a great day! 👋",
  default: "That's interesting! Tell me more, or try asking about the weather or time!",
};

function getResponse(message: string): string {
  const lowerMessage = message.toLowerCase().trim();
  
  for (const [key, response] of Object.entries(hardcodedResponses)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }
  
  return hardcodedResponses.default;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#444' }, 'icon');

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const startChat = () => {
    setIsChatStarted(true);
    setMessages([
      {
        id: '1',
        text: `Hi${customerName ? ' ' + customerName : ''}! 👋\n\nHow can we help you today? Your message will be sent directly to our WhatsApp.`,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputText;
    setInputText('');

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const sessionId = await getOrCreateSessionId();
      
      console.log('🔌 Sending message to backend:', backendUrl);
        
      const response = await fetch(`${backendUrl}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: customerName || 'Mobile App User',
          customerEmail: customerEmail || undefined,
          message: messageToSend,
          sessionId: sessionId,
        }),
      });

      console.log('📡 Backend response status:', response.status);

      const data = await response.json();
      
      if (data.success) {
        const confirmMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: '✓ Sent via WhatsApp',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
      } else {
        throw new Error(data.error || 'Failed to send');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {isOpen && (
        <View style={styles.popupContainer}>
          <ThemedView style={styles.chatWindow}>
            <View style={[styles.header, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.headerText}>WhatsApp Chat</ThemedText>
              <TouchableOpacity onPress={toggleChat} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {!isChatStarted ? (
              <View style={styles.phoneSetup}>
                <ThemedText style={styles.setupText}>
                  Start a conversation with us! 💬
                </ThemedText>
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      backgroundColor,
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Your name (optional)"
                  placeholderTextColor={borderColor}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      backgroundColor,
                      color: textColor,
                      borderColor,
                      marginTop: 10,
                    },
                  ]}
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  placeholder="Your email (optional)"
                  placeholderTextColor={borderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.connectButton, { backgroundColor: '#25D366' }]}
                  onPress={startChat}
                >
                  <ThemedText style={styles.connectButtonText}>Start Chat</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
              >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.isUser ? styles.userBubble : styles.botBubble,
                    {
                      backgroundColor: message.isUser ? '#007AFF' : borderColor,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.messageText,
                      message.isUser && { color: '#FFFFFF' },
                    ]}
                  >
                    {message.text}
                  </ThemedText>
                </View>
              ))}
              </ScrollView>
            )}

            {isChatStarted && (
              <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={100}
            >
              <View style={[styles.inputContainer, { borderTopColor: borderColor }]}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor,
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  placeholderTextColor={borderColor}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: '#007AFF' }]}
                  onPress={sendMessage}
                >
                  <ThemedText style={styles.sendButtonText}>Send</ThemedText>
                </TouchableOpacity>
              </View>
              </KeyboardAvoidingView>
            )}
          </ThemedView>
        </View>
      )}

      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: tintColor }]}
        onPress={toggleChat}
      >
        <ThemedText style={styles.floatingButtonText}>
          {isOpen ? '✕' : '💬'}
        </ThemedText>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  popupContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
      },
    }),
  },
  chatWindow: {
    width: 350,
    height: 500,
    borderRadius: 15,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  floatingButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  phoneSetup: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  setupText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  connectButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
