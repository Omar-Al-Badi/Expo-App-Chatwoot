import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Text,
  Keyboard,
} from "react-native";
import type { KeyboardEvent } from "react-native";
import { TextInput, Button } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

async function getOrCreateSessionId(): Promise<string> {
  try {
    let sessionId = await AsyncStorage.getItem("chatSessionId");
    if (!sessionId) {
      sessionId =
        "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      await AsyncStorage.setItem("chatSessionId", sessionId);
    }
    return sessionId;
  } catch (error) {
    return (
      "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now()
    );
  }
}

export function ChatWidget() {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Track keyboard height so we can lift the chat window above it on mobile.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (event: KeyboardEvent) => {
      const height = event?.endCoordinates?.height ?? 0;
      setKeyboardOffset(Math.max(0, height - insets.bottom));
    };

    const handleHide = () => {
      setKeyboardOffset(0);
    };

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const startChat = async () => {
    setIsChatStarted(true);
    setMessages([
      {
        id: "1",
        text: `Hi${customerName ? " " + customerName : ""}! 👋\n\nHow can we help you today? Your message will be sent directly to our WhatsApp.`,
        isUser: false,
        timestamp: new Date(),
      },
    ]);

    const sessionId = await getOrCreateSessionId();
    connectToSSE(sessionId);
  };

  const connectToSSE = async (sessionId: string) => {
    const backendUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const pollUrl = `${backendUrl}/api/poll-replies?sessionId=${sessionId}`;

    console.log("🔄 Starting reply polling for session:", sessionId);

    const pollForReplies = async () => {
      try {
        // Debug: log the exact poll URL so we can confirm what the app is requesting
        console.log("🔍 Poll URL:", pollUrl);
        const response = await fetch(pollUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.replies && data.replies.length > 0) {
            console.log(`📬 Received ${data.replies.length} reply(ies)`);
            data.replies.forEach((reply: any) => {
              const replyMessage: Message = {
                id: Date.now().toString() + Math.random(),
                text: "📱 " + reply.message,
                isUser: false,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, replyMessage]);
            });
          }
        }
      } catch (error) {
        // More verbose error logging for easier debugging during development
        try {
          console.error("❌ Polling error:", error, "pollUrl:", pollUrl);
        } catch (e) {
          console.error("❌ Polling error (unable to stringify):", error);
        }
      }
    };

    pollForReplies();
    const interval = setInterval(pollForReplies, 3000);

    return () => clearInterval(interval);
  };

  const sendMessage = async () => {
    if (inputText.trim() === "") return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputText;
    setInputText("");

    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const sessionId = await getOrCreateSessionId();

      console.log("🔌 Sending message to backend:", backendUrl);

      const response = await fetch(`${backendUrl}/api/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: customerName || "Mobile App User",
          customerEmail: customerPhone || undefined,
          message: messageToSend,
          sessionId: sessionId,
        }),
      });

      console.log("📡 Backend response status:", response.status);

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } else {
            const text = await response.text();
            console.error("Non-JSON response:", text.substring(0, 100));
            errorMsg = "Server returned an error. Please try again.";
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (data.success) {
        const confirmMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "✓ Sent via WhatsApp",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Reserve space for the bottom navigation bar so the chat never sits behind it.
  const NAVBAR_BUFFER = 64;
  const baseBottomSpacing = insets.bottom + NAVBAR_BUFFER;
  const floatingButtonBottom = baseBottomSpacing;
  const chatBottomPadding = baseBottomSpacing + keyboardOffset;

  if (!isOpen) {
    return (
      <TouchableOpacity
        style={[styles.floatingButton, { bottom: floatingButtonBottom }]}
        onPress={toggleChat}
      >
        <Text style={styles.floatingButtonText}>💬</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[
          styles.chatWindowContainer,
          { paddingBottom: chatBottomPadding },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.chatWindow}>
          <View style={styles.header}>
            <Text style={styles.headerText}>WhatsApp Chat</Text>
            <TouchableOpacity onPress={toggleChat} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!isChatStarted ? (
            <View style={styles.setupContainer}>
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
                value={customerPhone}
                onChangeText={setCustomerPhone}
                label="Your phone number (optional)"
                keyboardType="phone-pad"
                style={styles.textInput}
              />
              <Button
                mode="contained"
                onPress={startChat}
                style={styles.connectButton}
              >
                Start Chat
              </Button>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageWrapper,
                      message.isUser
                        ? styles.userMessageWrapper
                        : styles.botMessageWrapper,
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
                          message.isUser
                            ? styles.userMessageText
                            : styles.botMessageText,
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.inputContainer}>
                <TextInput
                  mode="outlined"
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  style={styles.input}
                  multiline={false}
                  maxLength={500}
                />
                <Button
                  mode="contained"
                  onPress={sendMessage}
                  style={styles.sendButton}
                >
                  Send
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: "box-none",
  },
  chatWindowContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 10,
  },
  chatWindow: {
    alignSelf: "stretch",
    width: "100%",
    minHeight: 360,
    maxHeight: "80%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    zIndex: 1001,
    ...Platform.select({
      default: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#128C7E",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: "#ECE5DD",
  },
  messagesContent: {
    padding: 16,
  },
  messageWrapper: {
    width: "100%",
    marginBottom: 8,
    flexDirection: "row",
  },
  userMessageWrapper: {
    justifyContent: "flex-end",
  },
  botMessageWrapper: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "#DCF8C6",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: "#000000",
  },
  botMessageText: {
    color: "#000000",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    alignItems: "flex-end",
    backgroundColor: "#F0F0F0",
    borderTopWidth: 1,
    borderTopColor: "#D1D1D1",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  sendButton: {
    backgroundColor: "#128C7E",
  },
  floatingButton: {
    position: "absolute",
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#25D366",
    zIndex: 1002,
    ...Platform.select({
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  floatingButtonText: {
    fontSize: 32,
    color: "#fff",
  },
  setupContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#ECE5DD",
  },
  setupText: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
    fontWeight: "500",
  },
  textInput: {
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  connectButton: {
    marginTop: 16,
    backgroundColor: "#25D366",
  },
});