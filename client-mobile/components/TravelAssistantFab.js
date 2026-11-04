import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/tokens';

export const TAB_BAR_HEIGHT = 60;
export const FAB_MARGIN = 16;
export const FAB_HEIGHT = 48;
export const FAB_BOTTOM_OFFSET = TAB_BAR_HEIGHT + FAB_MARGIN; // 76 dp
export const FAB_SCROLL_PADDING = FAB_HEIGHT + FAB_MARGIN; // 64 dp

/**
 * Reusable Floating Action Button for the Travel Assistant.
 * Positioned bottom-right above the 60dp bottom tab bar with 16dp margin.
 * Automatically hidden when keyboard is open.
 * Touch target >= 48dp, colored with teal (colors.accentSecondary).
 */
export default function TravelAssistantFab({
  bottom = FAB_BOTTOM_OFFSET,
  onPress,
  style,
}) {
  const navigation = useNavigation();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('TravelAssistant');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom }, style]}
      activeOpacity={0.85}
      onPress={handlePress}
      accessibilityLabel="Open Travel Assistant"
      accessibilityRole="button"
    >
      <Ionicons
        name="chatbubble-ellipses"
        size={18}
        color={colors.textPrimary}
        style={styles.icon}
      />
      <Text style={styles.label}>Travel Assistant</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    height: FAB_HEIGHT,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: colors.accentSecondary, // Teal (#2F6E68)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
});

