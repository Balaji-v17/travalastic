import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';
import { stepCount } from '../constants/countLimits';

export default function CountStepper({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
  helperText,
  disabled = false,
  unitLabel,
}) {
  const safeMax = Math.max(min, max);
  const decDisabled = disabled || value <= min;
  const incDisabled = disabled || value >= safeMax;
  const lowerLabel = String(label || 'count').toLowerCase();

  const handleDecrement = () => {
    if (decDisabled) return;
    onChange(stepCount(value, -1, min, safeMax));
  };

  const handleIncrement = () => {
    if (incDisabled) return;
    onChange(stepCount(value, 1, min, safeMax));
  };

  return (
    <View style={styles.container}>
      <View style={styles.row} accessible={false}>
        <View style={styles.labelCol}>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.btn, decDisabled && styles.btnDisabled]}
            onPress={handleDecrement}
            disabled={decDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${lowerLabel}`}
            accessibilityState={{ disabled: decDisabled }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.btnText, decDisabled && styles.btnTextDisabled]}>−</Text>
          </TouchableOpacity>

          <Text
            style={styles.value}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${value}${unitLabel ? ` ${unitLabel}` : ''} ${lowerLabel}`}
          >
            {value}
            {unitLabel ? ` ${unitLabel}` : ''}
          </Text>

          <TouchableOpacity
            style={[styles.btn, incDisabled && styles.btnDisabled]}
            onPress={handleIncrement}
            disabled={incDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${lowerLabel}`}
            accessibilityState={{ disabled: incDisabled }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.btnText, incDisabled && styles.btnTextDisabled]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelCol: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.sansSemiBold || fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
  },
  sublabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: radii.md || 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated || colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: fonts.sansSemiBold || fonts.sans,
    color: colors.textPrimary,
  },
  btnTextDisabled: {
    color: colors.textMuted,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: fonts.sansSemiBold || fonts.sans,
    fontSize: 16,
    color: colors.textPrimary,
  },
  helperText: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
