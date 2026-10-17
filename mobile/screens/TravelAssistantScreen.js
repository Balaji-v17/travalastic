import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../config/apiClient';
import { colors, fonts, spacing } from '../theme/tokens';

// Module-level in-memory conversation store for Travel Assistant.
// Strictly in-memory; survives navigating away and back within the app session.
// NEVER written to AsyncStorage, SecureStore, or localStorage.
let inMemoryAssistantConversation = [];

export function getTravelAssistantStore() {
  return inMemoryAssistantConversation;
}

export function setTravelAssistantStore(messages) {
  inMemoryAssistantConversation = Array.isArray(messages) ? [...messages] : [];
}

export function clearTravelAssistantStore() {
  inMemoryAssistantConversation = [];
}

// Backward-compatible aliases
export const getAssistantStore = getTravelAssistantStore;
export const setAssistantStore = setTravelAssistantStore;
export const clearAssistantStore = clearTravelAssistantStore;

/**
 * ErrorBoundary to catch and safely recover from markdown AST or rendering errors.
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
    console.warn('Markdown display error in TravelAssistantScreen:', error, errorInfo);
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
 * Safe markdown renderer with fallback to plain Text.
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

export default function TravelAssistantScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialInput = route?.params?.initialMessage || '';

  // Initialize conversation from module-level in-memory store
  const [messages, setMessages] = useState(() => getTravelAssistantStore());
  const [inputText, setInputText] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedMessage, setFailedMessage] = useState(null);

  // Trip context toggle chip state
  const [mostRecentTrip, setMostRecentTrip] = useState(null);
  const [useTripContext, setUseTripContext] = useState(false);

  const flatListRef = useRef(null);

  // Sync state changes with the module-level in-memory store
  const updateMessages = useCallback((newMessages) => {
    setMessages(newMessages);
    setTravelAssistantStore(newMessages);
  }, []);

  // Update input text if navigated to with new initialMessage param
  useEffect(() => {
    if (route?.params?.initialMessage) {
      setInputText(route.params.initialMessage);
    }
  }, [route?.params?.initialMessage]);

  // Load user's most recent itinerary on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTrips() {
      try {
        const response = await apiClient('/itinerary');
        if (response && response.status === 200) {
          const data = await response.json().catch(() => null);
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.itineraries)
            ? data.itineraries
            : [];
          if (isMounted && list.length > 0) {
            setMostRecentTrip(list[0]);
          }
        }
      } catch (err) {
        // Soft fail; if trips cannot be loaded, chip is simply hidden
      }
    }
    loadTrips();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, loading]);

  const handleClearChat = () => {
    clearTravelAssistantStore();
    setMessages([]);
    setErrorMessage('');
    setFailedMessage(null);
  };

  /**
   * Sends or retries a message to POST /assistant/message.
   *
   * @param {string} textToSend - Question string
   * @param {boolean} [isRetry=false] - True if retrying a previously failed message
   */
  const sendMessageApi = async (textToSend, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setErrorMessage('');

    let currentMessages = messages;
    if (!isRetry) {
      const userMsg = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      currentMessages = [...messages, userMsg];
      updateMessages(currentMessages);
      setInputText('');
    }

    setLoading(true);

    // Build history from the newest 10 messages (role and content only)
    const historyPayload = currentMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content || '',
      }));

    // If this is a new message, exclude the just-added user message from history payload
    if (!isRetry && historyPayload.length > 0) {
      historyPayload.pop();
    }

    const payload = {
      message: trimmed,
      history: historyPayload,
      ...(useTripContext && mostRecentTrip?._id ? { tripId: mostRecentTrip._id } : {}),
    };

    try {
      const response = await apiClient('/assistant/message', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.status === 200) {
        const data = await response.json();
        const assistantMsg = {
          id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: 'assistant',
          content: data?.reply || '',
          sources: Array.isArray(data?.sources) ? data.sources : [],
          timestamp: new Date(),
        };

        updateMessages([...currentMessages, assistantMsg]);
        setFailedMessage(null);
        setErrorMessage('');
      } else if (response.status === 429) {
        setErrorMessage("You've reached the hourly limit. Try again later.");
        setFailedMessage({ text: trimmed });
      } else if (response.status === 503) {
        setErrorMessage('The assistant is busy. Try again in a moment.');
        setFailedMessage({ text: trimmed });
      } else if (response.status === 401) {
        setErrorMessage('Your session expired. Please log in again.');
        setFailedMessage({ text: trimmed });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrorMessage(errorData.error || "Couldn't reach the server.");
        setFailedMessage({ text: trimmed });
      }
    } catch (err) {
      console.warn('Travel assistant network error:', err.message);
      setErrorMessage("Couldn't reach the server.");
      setFailedMessage({ text: trimmed });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (text = inputText) => {
    sendMessageApi(text, false);
  };

  const handleRetry = () => {
    if (!failedMessage?.text) return;
    sendMessageApi(failedMessage.text, true);
  };

  // Derive trip label if an itinerary is loaded
  const tripLabel = mostRecentTrip
    ? `${mostRecentTrip.destination || 'Trip'}${
        mostRecentTrip.startDate && mostRecentTrip.endDate
          ? `, ${mostRecentTrip.startDate} to ${mostRecentTrip.endDate}`
          : mostRecentTrip.startDate
          ? `, from ${mostRecentTrip.startDate}`
          : ''
      }`
    : '';

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    const isAssistant = item.role === 'assistant';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.content}</Text>
          ) : (
            <SafeMarkdown
              content={item.content}
              style={markdownStyles}
              fallbackStyle={[styles.bubbleText, styles.bubbleTextAssistant]}
            />
          )}

          {/* Live forecast source tag */}
          {isAssistant && Array.isArray(item.sources) && item.sources.length > 0 ? (
            <View style={styles.sourcesContainer}>
              {item.sources
                .filter((s) => s.type === 'forecast')
                .map((s, idx) => (
                  <View key={idx} style={styles.forecastTagRow}>
                    <Ionicons
                      name="cloud-outline"
                      size={12}
                      color={colors.textMuted}
                      style={styles.forecastIcon}
                    />
                    <Text style={styles.forecastTagText}>
                      Live forecast from OpenWeather, {s.date}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Custom Header with Title, Muted Guideline, and Clear Chat Action */}
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Travel Assistant</Text>

            <TouchableOpacity
              onPress={handleClearChat}
              style={styles.clearButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear chat"
            >
              <Text style={styles.clearButtonText}>Clear chat</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.headerSubtitle}>
            General travel help. It doesn't change your trips. Check official sources for rules,
            prices, and safety.
          </Text>

          {/* Optional Trip Context Toggle Chip */}
          {mostRecentTrip ? (
            <View style={styles.tripChipRow}>
              <TouchableOpacity
                style={[styles.tripChip, useTripContext && styles.tripChipActive]}
                onPress={() => setUseTripContext((prev) => !prev)}
                activeOpacity={0.75}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: useTripContext }}
                accessibilityLabel={`Use my trip: ${tripLabel}`}
              >
                <Ionicons
                  name={useTripContext ? 'checkbox' : 'square-outline'}
                  size={15}
                  color={useTripContext ? colors.accentPrimary : colors.textMuted}
                  style={styles.chipCheckIcon}
                />
                <Text
                  style={[styles.tripChipText, useTripContext && styles.tripChipTextActive]}
                  numberOfLines={1}
                >
                  Use my trip: {tripLabel}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Inline Error Banner with Retry */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <View style={styles.errorTextRow}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.accentUrgent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>

            {failedMessage ? (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={handleRetry}
                activeOpacity={0.8}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Retry sending"
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Message List or Empty State */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <View style={styles.avatarIconWrapper}>
                <Ionicons name="sparkles" size={26} color={colors.accentSecondary} />
              </View>
              <Text style={styles.emptyTitle}>How can I help you travel?</Text>
              <Text style={styles.emptySubtitle}>
                Ask anything about destinations, packing, food, weather, transit, visas, or travel
                budgeting.
              </Text>

              <Text style={styles.suggestedSectionHeading}>SUGGESTED PROMPTS</Text>
              <View style={styles.suggestedGrid}>
                {[
                  'Best places to visit in Goa',
                  'What should I pack for 5 days?',
                  'How do train cancellations work in India?',
                  "What's the weather like in Mysore this week?",
                ].map((promptText, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestedCard}
                    onPress={() => handleSendMessage(promptText)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={promptText}
                  >
                    <Text style={styles.suggestedCardText}>{promptText}</Text>
                    <Ionicons
                      name="arrow-forward-circle-outline"
                      size={18}
                      color={colors.accentSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />

        {/* Thinking / Loading Indicator */}
        {loading ? (
          <View style={styles.thinkingBar}>
            <ActivityIndicator size="small" color={colors.accentSecondary} />
            <Text style={styles.thinkingText}>Thinking...</Text>
          </View>
        ) : null}

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask anything about travel..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            editable={!loading}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (Platform.OS !== 'web') Keyboard.dismiss();
              handleSendMessage();
            }}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="send"
              size={18}
              color={!inputText.trim() || loading ? colors.textMuted : colors.textPrimary}
            />
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
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  heading3: {
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
  },
  strong: {
    fontFamily: fonts.bodyBold,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
    color: colors.textPrimary,
  },
  paragraph: {
    fontFamily: fonts.body,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 0,
    marginBottom: 6,
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
  table: {
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.2)',
    borderRadius: 6,
    marginVertical: 6,
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
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 12,
  },
  code_block: {
    fontFamily: fonts.mono || 'monospace',
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  link: {
    color: '#38bdf8',
    textDecorationLine: 'underline',
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

  /* Header */
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  clearButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.accentUrgent,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },

  /* Trip Context Toggle Chip */
  tripChipRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  tripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  tripChipActive: {
    backgroundColor: 'rgba(47, 110, 104, 0.25)',
    borderColor: colors.accentSecondary,
  },
  chipCheckIcon: {
    marginRight: 6,
  },
  tripChipText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  tripChipTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
  },

  /* Inline Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(214, 90, 74, 0.16)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#fca5a5',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: colors.accentUrgent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },

  /* Message List */
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 3,
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
    backgroundColor: colors.accentSecondary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
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
    color: colors.textPrimary,
  },

  /* Forecast Sources */
  sourcesContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
    paddingTop: 4,
  },
  forecastTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  forecastIcon: {
    marginRight: 4,
  },
  forecastTagText: {
    fontSize: 11,
    fontFamily: fonts.body,
    fontStyle: 'italic',
    color: colors.textMuted,
  },

  /* Empty State */
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  avatarIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(47, 110, 104, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 110, 104, 0.4)',
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 290,
  },
  suggestedSectionHeading: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  suggestedGrid: {
    width: '100%',
    gap: 8,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestedCardText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    marginRight: 8,
  },

  /* Thinking bar */
  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  thinkingText: {
    fontSize: 13,
    fontFamily: fonts.body,
    fontStyle: 'italic',
    color: colors.textMuted,
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#000000',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(47, 110, 104, 0.3)',
  },
});
