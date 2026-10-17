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
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../config/apiClient';
import { colors, fonts } from '../theme/tokens';

/**
 * ErrorBoundary to catch and safely recover from any markdown AST or rendering errors.
 */
class MarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('Markdown display rendering error, falling back to plain text:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.content !== this.props.content && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Safe markdown renderer with fallback to plain Text when formatting or parsing fails.
 */
function SafeMarkdown({ content, style, fallbackStyle }) {
  const rawText = typeof content === 'string' ? content : String(content || '');

  const fallbackElement = (
    <Text style={fallbackStyle || [styles.bubbleText, styles.bubbleTextAssistant]}>
      {rawText}
    </Text>
  );

  if (!rawText.trim() || typeof Markdown !== 'function') {
    return fallbackElement;
  }

  return (
    <MarkdownErrorBoundary content={rawText} fallback={fallbackElement}>
      <Markdown style={style}>{rawText}</Markdown>
    </MarkdownErrorBoundary>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { itineraryId, onItineraryUpdated, initialMessage } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState(initialMessage || '');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [latestUndoableEditId, setLatestUndoableEditId] = useState(null);
  const [undoingEditId, setUndoingEditId] = useState(null);
  const [undoConflictMessage, setUndoConflictMessage] = useState({});

  const [itineraryInfo, setItineraryInfo] = useState({
    startDate: route.params?.startDate || null,
    endDate: route.params?.endDate || null,
    days: route.params?.days || [],
  });

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title: 'Ask about your trip',
    });
  }, [navigation]);

  // Load itinerary info if not provided in route.params
  useEffect(() => {
    if (itineraryId && (!itineraryInfo.startDate || !itineraryInfo.days?.length)) {
      apiClient(`/itinerary/${itineraryId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setItineraryInfo({
              startDate: data.startDate,
              endDate: data.endDate,
              days: data.days || data.itinerary || [],
            });
          }
        })
        .catch((err) => console.warn('Failed to load itinerary for ChatScreen chips:', err));
    }
  }, [itineraryId]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isTripInProgress = Boolean(
    itineraryInfo.startDate &&
      itineraryInfo.endDate &&
      todayStr >= itineraryInfo.startDate &&
      todayStr <= itineraryInfo.endDate
  );
  const totalDays = Array.isArray(itineraryInfo.days) ? itineraryInfo.days.length : 0;

  useEffect(() => {
    if (initialMessage) {
      setInputText(initialMessage);
    }
  }, [initialMessage]);

  const flatListRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const handleSend = () => {
    handleSendMessage(inputText);
  };

  const handleSendMessage = async (textToSend) => {
    const trimmed = (textToSend || '').trim();
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

      const isEditUndoable = !!(data?.undoable && data?.editId);

      // Append assistant reply with answerType
      const assistantMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: data?.reply || 'I received your request.',
        answerType: data?.answerType || null,
        timestamp: new Date().toISOString(),
        editId: isEditUndoable ? data.editId : null,
        modifiedDays:
          isEditUndoable && Array.isArray(data.modifiedDays) ? data.modifiedDays : [],
        undone: false,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (isEditUndoable) {
        setLatestUndoableEditId(data.editId);
      }

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

  const handleUndo = async (targetEditId, modifiedDays = []) => {
    if (!itineraryId || !targetEditId || undoingEditId) return;

    setUndoingEditId(targetEditId);
    setUndoConflictMessage((prev) => ({ ...prev, [targetEditId]: '' }));

    try {
      const response = await apiClient(`/itinerary/${itineraryId}/undo`, {
        method: 'POST',
        body: JSON.stringify({ expectedEditId: targetEditId }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 409) {
        // "On 409: show 'This changed since. Please refresh.' and refetch."
        setUndoConflictMessage((prev) => ({
          ...prev,
          [targetEditId]: 'This changed since. Please refresh.',
        }));
        setLatestUndoableEditId(null);

        // Refetch itinerary
        try {
          const refetchRes = await apiClient(`/itinerary/${itineraryId}`);
          if (refetchRes.ok) {
            const refetchedData = await refetchRes.json();
            if (typeof onItineraryUpdated === 'function') {
              onItineraryUpdated(refetchedData);
            }
          }
        } catch (refetchErr) {
          console.warn('Refetch failed after 409:', refetchErr);
        }
        setUndoingEditId(null);
        return;
      }

      if (!response.ok) {
        const errorText =
          data?.error?.message ||
          data?.error ||
          'Could not undo edit. Please try again.';
        setErrorMessage(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
        setUndoingEditId(null);
        return;
      }

      // Success:
      // Replace button with "Change undone"
      setMessages((prev) =>
        prev.map((msg) =>
          msg.editId === targetEditId ? { ...msg, undone: true } : msg
        )
      );
      setLatestUndoableEditId(null);

      // Call onItineraryUpdated
      if (typeof onItineraryUpdated === 'function') {
        onItineraryUpdated(data);
      }

      // Append short assistant message to chat: "Undid last change to Day N."
      const restored =
        Array.isArray(data?.restoredDays) && data.restoredDays.length > 0
          ? data.restoredDays
          : modifiedDays;
      const daysText =
        restored.length === 1
          ? `Day ${restored[0]}`
          : restored.length > 1
          ? `Days ${restored.join(', ')}`
          : 'the requested day';

      const undoNotificationMessage = {
        id: 'assistant-undo-' + Date.now(),
        role: 'assistant',
        content: `Undid last change to ${daysText}.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, undoNotificationMessage]);
    } catch (err) {
      console.error('Undo request error:', err);
      setErrorMessage('Network error while undoing change.');
    } finally {
      setUndoingEditId(null);
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    const isAssistant = !isUser;
    const isLatestEdit = item.editId && item.editId === latestUndoableEditId;
    const isUndoingThis = undoingEditId === item.editId;
    const conflictText = item.editId ? undoConflictMessage[item.editId] : null;

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
            <SafeMarkdown
              content={item.text || item.content || ''}
              style={markdownStyles}
              fallbackStyle={[styles.bubbleText, styles.bubbleTextAssistant]}
            />
          )}

          {/* Undo Action Area for AI edit replies */}
          {isAssistant && item.editId ? (
            <View style={styles.undoContainer}>
              {item.undone ? (
                <View style={styles.undoneBadge}>
                  <Text style={styles.undoneBadgeText}>✓ Change undone</Text>
                </View>
              ) : isLatestEdit ? (
                <View style={styles.undoActionRow}>
                  <TouchableOpacity
                    style={[styles.undoButton, isUndoingThis && styles.undoButtonDisabled]}
                    onPress={() => handleUndo(item.editId, item.modifiedDays)}
                    disabled={isUndoingThis}
                    activeOpacity={0.7}
                  >
                    {isUndoingThis ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Text style={styles.undoButtonText}>↩ Undo</Text>
                    )}
                  </TouchableOpacity>
                  {conflictText ? (
                    <Text style={styles.undoConflictText}>{conflictText}</Text>
                  ) : null}
                </View>
              ) : conflictText ? (
                <Text style={styles.undoConflictText}>{conflictText}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* General Knowledge Tag under message */}
        {isAssistant && item.answerType === 'general' ? (
          <Text style={styles.generalKnowledgeTag}>
            General travel knowledge, not from your itinerary
          </Text>
        ) : null}

        {/* Redirect to Travel Assistant button */}
        {isAssistant && item.answerType === 'redirect' ? (
          <TouchableOpacity
            style={styles.askTravelAssistantBtn}
            onPress={() => {
              const itemIndex = messages.findIndex((m) => m.id === item.id);
              let lastUserQuestion = '';
              const searchIndex = itemIndex >= 0 ? itemIndex : messages.length;
              for (let i = searchIndex - 1; i >= 0; i--) {
                if (messages[i].role === 'user' || messages[i].sender === 'user') {
                  lastUserQuestion = messages[i].content || messages[i].text || '';
                  break;
                }
              }
              navigation.navigate('TravelAssistant', {
                initialMessage: lastUserQuestion,
              });
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ask the Travel Assistant"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={15}
              color={colors.accentSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.askTravelAssistantBtnText}>
              Ask the Travel Assistant
            </Text>
          </TouchableOpacity>
        ) : null}
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
                <Text style={styles.emptySubtitle}>
                  I can answer questions about your saved itinerary and help change it. I don't have opening hours or travel times.
                </Text>

                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={styles.promptChip}
                    onPress={() => handleSendMessage('Summarize my trip')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.promptChipText}>Summarize my trip</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.promptChip}
                    onPress={() => handleSendMessage('Explain my estimated budget')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.promptChipText}>Explain my estimated budget</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.promptChip}
                    onPress={() =>
                      handleSendMessage(
                        isTripInProgress ? "What's next today?" : 'What does Day 1 look like?'
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.promptChipText}>
                      {isTripInProgress ? "What's next today?" : 'What does Day 1 look like?'}
                    </Text>
                  </TouchableOpacity>

                  {totalDays >= 2 ? (
                    <TouchableOpacity
                      style={styles.promptChip}
                      onPress={() => setInputText('Make Day 2 more relaxed')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.promptChipText}>Make Day 2 more relaxed</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: 'rgba(247, 243, 234, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  chipContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  promptChip: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    borderColor: 'rgba(247, 243, 234, 0.16)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  promptChipText: {
    color: colors.textPrimary || '#F7F3EA',
    fontSize: 13,
    fontFamily: fonts.body,
    fontWeight: '500',
  },
  generalKnowledgeTag: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textMuted || '#A1A1AA',
    marginTop: 5,
    marginLeft: 6,
  },
  undoContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.1)',
  },
  undoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  undoButton: {
    backgroundColor: colors.accentPrimary || '#E07A5F',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  undoButtonDisabled: {
    opacity: 0.6,
  },
  undoButtonText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: '#000000',
  },
  undoneBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  undoneBadgeText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted || '#94A3B8',
    fontStyle: 'italic',
  },
  undoConflictText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.accentUrgent || '#EF4444',
    marginTop: 4,
  },
  askTravelAssistantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(47, 110, 104, 0.18)',
    borderWidth: 1,
    borderColor: colors.accentSecondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 6,
    marginLeft: 4,
  },
  askTravelAssistantBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.accentSecondary,
    fontWeight: '700',
  },
});

