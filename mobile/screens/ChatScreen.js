import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import apiClient from '../config/apiClient';
import { colors, fonts } from '../theme/tokens';

export default function ChatScreen({ route, navigation }) {
  const { itineraryId, onItineraryUpdated } = route.params || {};

  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        "Hello! I'm your Travalastic AI trip assistant. 🌴\n\nYou can ask me questions about your destinations, inquire about today's schedule, request edits to specific days, or ask about booking transit and hotels.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const flatListRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;

    if (!itineraryId) {
      setErrorMessage('Missing itinerary ID. Please return to the itinerary screen.');
      return;
    }

    const userMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Append user message immediately to visible history
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await apiClient('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          itineraryId,
          message: trimmed,
          conversationId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorText =
          data?.error?.message ||
          data?.error ||
          'Failed to get a response from the assistant. Please try again.';
        setErrorMessage(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
        setLoading(false);
        return;
      }

      setLoading(false);

      // Store returned conversationId for subsequent messages
      if (data?.conversationId) {
        setConversationId(data.conversationId);
      }

      // Append assistant reply
      const assistantMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: data?.reply || 'I received your request.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If response includes updated itinerary, notify caller immediately
      if (data?.updatedItinerary && typeof onItineraryUpdated === 'function') {
        onItineraryUpdated(data.updatedItinerary);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setLoading(false);
      setErrorMessage('Network error. Unable to connect to the assistant.');
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
              {item.text || item.content || ''}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>
              {item.text || item.content || ''}
            </Markdown>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Inline Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage('')} disabled={loading}>
              <Text style={styles.dismissError}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>AI Assistant Ready</Text>
                <Text style={styles.emptySubtitle}>
                  Ask any question about your trip schedule, destinations, or request itinerary edits.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading ? (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
                  <Text style={styles.typingText}>AI is thinking…</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask a question or request a change..."
            placeholderTextColor="rgba(247, 243, 234, 0.4)"
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              if (errorMessage) setErrorMessage('');
            }}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    fontFamily: fonts.body,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  heading1: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  heading2: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  heading3: {
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  strong: {
    fontFamily: fonts.bodyBold,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
    color: colors.textPrimary,
    opacity: 0.85,
  },
  paragraph: {
    fontFamily: fonts.body,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 0,
    marginBottom: 8,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: colors.accentPrimary,
    marginRight: 6,
    fontSize: 12,
  },
  ordered_list_icon: {
    color: colors.accentPrimary,
    marginRight: 6,
    fontSize: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.2)',
    borderRadius: 6,
    marginVertical: 8,
    backgroundColor: '#121212',
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  th: {
    padding: 6,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    fontFamily: fonts.bodyBold,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontSize: 11,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  td: {
    padding: 6,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    fontSize: 11,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  code_inline: {
    fontFamily: fonts.mono || 'monospace',
    backgroundColor: '#121212',
    color: '#38bdf8',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 12,
  },
  code_block: {
    fontFamily: fonts.mono || 'monospace',
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  fence: {
    fontFamily: fonts.mono || 'monospace',
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  link: {
    color: '#38bdf8',
    textDecorationLine: 'underline',
  },
  hr: {
    backgroundColor: 'rgba(247, 243, 234, 0.15)',
    height: 1,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: '#121212',
    borderLeftColor: colors.accentPrimary,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 4,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  dismissError: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  bubbleTextAssistant: {
    color: '#F7F3EA',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.15)',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#F7F3EA',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});

