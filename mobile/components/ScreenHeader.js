import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme/tokens';

/**
 * Universal ScreenHeader component
 * Handles safe area status bar/cutout clearance and prevents header overlap bugs.
 *
 * @param {string} title - Header title text (sized with fonts.display)
 * @param {string} [subtitle] - Optional supporting text
 * @param {React.ReactNode} [rightElement] - Optional right action element/icon
 * @param {() => void} [onRightPress] - Callback for right container press
 * @param {string} [rightAccessibilityLabel] - Accessibility label for right action
 * @param {object} [style] - Optional override style for the header container
 */
export default function ScreenHeader({
  title,
  subtitle,
  rightElement,
  onRightPress,
  rightAccessibilityLabel,
  style,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.headerContainer,
        { paddingTop: Math.max(insets.top, 12) },
        style,
      ]}
    >
      {/* Title Block on the left: flexShrink: 1, single line with truncation */}
      <View style={styles.titleBlock}>
        <Text
          style={styles.titleText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={styles.subtitleText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right-side icon in a fixed-size container with spacing.16 marginLeft */}
      {rightElement ? (
        <View style={styles.rightContainer}>
          {onRightPress ? (
            <TouchableOpacity
              onPress={onRightPress}
              activeOpacity={0.7}
              accessibilityLabel={rightAccessibilityLabel || 'Header Action'}
              style={styles.rightTouchTarget}
            >
              {rightElement}
            </TouchableOpacity>
          ) : (
            rightElement
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16] || 16,
    paddingBottom: spacing[16] || 16,
    backgroundColor: colors.background,
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  subtitleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  rightContainer: {
    width: 44,
    height: 44,
    marginLeft: spacing[16] || 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightTouchTarget: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

