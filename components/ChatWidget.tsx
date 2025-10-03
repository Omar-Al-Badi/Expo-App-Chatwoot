import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { TextInput, Button, Card, Text } from 'react-native-paper';
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

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const startChat = async () => {
    setIsChatStarted(true);
    setMessages([
      {
        id: '1',
        text: `Hi${customerName ? ' ' + customerName : ''}! 👋\n\nHow can we help you today? Your message will be sent directly to our WhatsApp.`,
        isUser: false,
        timestamp: new Date(),
      },
    ]);

    const sessionId = await getOrCreateSessionId();
    connectToSSE(sessionId);
  };

  const connectToSSE = async (sessionId: string) => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const pollUrl = `${backendUrl}/api/poll-replies?sessionId=${sessionId}`;
    
    console.log('🔄 Starting reply polling for session:', sessionId);

    const pollForReplies = async () => {
      try {
        const response = await fetch(pollUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.replies && data.replies.length > 0) {
            console.log(`📬 Received ${data.replies.length} reply(ies)`);
            data.replies.forEach((reply: any) => {
              const replyMessage: Message = {
                id: Date.now().toString() + Math.random(),
                text: '📱 ' + reply.message,
                isUser: false,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, replyMessage]);
            });
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    };

    pollForReplies();
    const interval = setInterval(pollForReplies, 3000);

    return () => clearInterval(interval);
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

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const chatWidth = Math.min(screenWidth - 40, 380);
  const chatHeight = Math.min(screenHeight - 140, 550);

  return (
    <>
      {isOpen && (
        <View style={styles.popupContainer}>
          <Card style={[styles.chatWindow, { width: chatWidth, height: chatHeight }]}>
            <View style={[styles.header, { backgroundColor: tintColor }]}>
              <Text style={styles.headerText}>WhatsApp Chat</Text>
              <TouchableOpacity onPress={toggleChat} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!isChatStarted ? (
              <View style={styles.phoneSetup}>
                <Text style={styles.setupText}>
                  Start a conversation with us! 💬
                </Text>
                <TextInput
                  mode="outlined"
                  value={customerName}
                  onChangeText={setCustomerName}
                  label="Your name (optional)"
                  autoCapitalize="words"
                  style={styles.textInput}
                />
                <TextInput
                  mode="outlined"
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  label="Your email (optional)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <Button
                  mode="contained"
                  onPress={startChat}
                  style={styles.connectButton}
                  buttonColor="#25D366"
                >
                  Start Chat
                </Button>
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
                      styles.messageWrapper,
                      message.isUser ? styles.userMessageWrapper : styles.botMessageWrapper,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        message.isUser ? styles.userBubble : styles.botBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          message.isUser ? styles.userMessageText : styles.botMessageText,
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {isChatStarted && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={100}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    mode="outlined"
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                    onSubmitEditing={sendMessage}
                    returnKeyType="send"
                    style={styles.input}
                    multiline
                    maxLength={500}
                  />
                  <Button
                    mode="contained"
                    onPress={sendMessage}
                    style={styles.sendButton}
                    buttonColor="#007AFF"
                  >
                    Send
                  </Button>
                </View>
              </KeyboardAvoidingView>
            )}
          </Card>
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
    left: 20,
    alignItems: 'center',
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        left: 'auto' as any,
      },
    }),
  },
  chatWindow: {
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
    padding: 12,
    paddingBottom: 20,
  },
  messageWrapper: {
    width: '100%',
    marginBottom: 10,
    flexDirection: 'row',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  botMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 15,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  botBubble: {
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#000000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    maxHeight: 100,
  },
  sendButton: {
    alignSelf: 'flex-end',
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
    gap: 12,
  },
  setupText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  textInput: {
    marginBottom: 10,
  },
  connectButton: {
    marginTop: 10,
  },
});
