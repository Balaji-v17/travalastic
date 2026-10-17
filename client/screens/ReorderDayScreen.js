import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import apiClient from '../config/apiClient';
import { colors, fonts, spacing, radii } from '../theme/tokens';

export default function ReorderDayScreen({ route, navigation }) {
  const {
    itineraryId,
    day,
    onOrderUpdated,
    onRefresh,
  } = route.params || {};

  const dayNumber = day?.dayNumber || 1;
  const originalActivities = useMemo(() => day?.activities || [], [day]);

  // Labels belong to POSITIONS: capture initial suggestedTime for each position index 0..n-1
  const positionLabels = useMemo(() => {
    return originalActivities.map((act) =>
      typeof act === 'object' ? act?.suggestedTime || null : null
    );
  }, [originalActivities]);

  // Initialize items array with stable keys and tracking
  const [items, setItems] = useState(() => {
    return originalActivities.map((act, index) => {
      const isString = typeof act === 'string';
      const title = isString ? act : act?.title || act?.name || '';
      const isDone = !isString && act?.done === true;
      return {
        key: `item-${index}-${title}`,
        originalIndex: index,
        title,
        done: isDone,
        rawActivity: act,
      };
    });
  });

  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Determine if user has made reordering changes
  const hasChanges = useMemo(() => {
    return items.some((item, index) => item.originalIndex !== index);
  }, [items]);

  // Handle hardware / gesture back navigation with unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges || isSaved || saving) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes to this day’s order. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges, isSaved, saving]);

  const handleCancel = useCallback(() => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Discard Changes?',
      'You have unsaved changes to this day’s order. Are you sure you want to discard them?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }, [hasChanges, navigation]);

  // Handle drag reorder while ensuring done items stay fixed at their indices
  const handleDragEnd = useCallback(
    ({ data }) => {
      const nonDoneItems = data.filter((it) => !it.done);
      const restored = new Array(data.length);

      // Done activities stay at their own index
      originalActivities.forEach((act, idx) => {
        if (typeof act === 'object' && act?.done) {
          const doneItem = data.find((d) => d.originalIndex === idx);
          restored[idx] = doneItem;
        }
      });

      // Fill remaining slots with not-done items in the dragged order
      let ptr = 0;
      for (let i = 0; i < restored.length; i++) {
        if (!restored[i]) {
          restored[i] = nonDoneItems[ptr++];
        }
      }

      setItems(restored);
    },
    [originalActivities]
  );

  // Check if an item at index can move up (must have a not-done item above it)
  const canMoveUp = useCallback(
    (index) => {
      if (index <= 0 || items[index]?.done) return false;
      for (let i = index - 1; i >= 0; i--) {
        if (!items[i]?.done) return true;
      }
      return false;
    },
    [items]
  );

  // Check if an item at index can move down (must have a not-done item below it)
  const canMoveDown = useCallback(
    (index) => {
      if (index >= items.length - 1 || items[index]?.done) return false;
      for (let i = index + 1; i < items.length; i++) {
        if (!items[i]?.done) return true;
      }
      return false;
    },
    [items]
  );

  // Move item up by swapping with the closest not-done item above
  const moveItemUp = useCallback(
    (index) => {
      if (!canMoveUp(index)) return;
      let targetIndex = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (!items[i]?.done) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) return;

      const newItems = [...items];
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      setItems(newItems);
    },
    [canMoveUp, items]
  );

  // Move item down by swapping with the closest not-done item below
  const moveItemDown = useCallback(
    (index) => {
      if (!canMoveDown(index)) return;
      let targetIndex = -1;
      for (let i = index + 1; i < items.length; i++) {
        if (!items[i]?.done) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) return;

      const newItems = [...items];
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      setItems(newItems);
    },
    [canMoveDown, items]
  );

  // Save new order to backend
  const handleSave = async () => {
    if (!hasChanges || saving) return;

    setSaving(true);
    try {
      const order = items.map((it) => it.originalIndex);
      const expectedTitles = originalActivities.map((act) =>
        typeof act === 'string' ? act : act?.title || act?.name || ''
      );

      const res = await apiClient(
        `/itinerary/${itineraryId}/days/${dayNumber}/order`,
        {
          method: 'PUT',
          body: JSON.stringify({ order, expectedTitles }),
        }
      );

      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          errorData.error || 'This day changed. Please reopen it.';

        Alert.alert('Day Changed', message, [
          {
            text: 'OK',
            onPress: () => {
              if (onRefresh) {
                onRefresh();
              }
              setIsSaved(true);
              navigation.goBack();
            },
          },
        ]);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          errorData.error || 'Failed to update activity order. Please try again.';
        Alert.alert('Error', message);
        return;
      }

      const updatedDay = await res.json();
      setIsSaved(true);
      if (onOrderUpdated) {
        onOrderUpdated(updatedDay);
      }
      navigation.goBack();
    } catch (err) {
      console.error('Error saving reordered day:', err);
      Alert.alert(
        'Network Error',
        'Could not reach server. Please check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }) => {
      const currentIndex = getIndex();
      const timeLabel = positionLabels[currentIndex];
      const isDone = item.done;

      return (
        <ScaleDecorator>
          <View
            style={[
              styles.rowCard,
              isActive && styles.rowCardActive,
              isDone && styles.rowCardLocked,
            ]}
          >
            {/* Left: Drag Handle or Lock Icon */}
            {isDone ? (
              <View style={styles.lockContainer} accessibilityLabel="Locked completed activity">
                <Ionicons
                  name="lock-closed"
                  size={18}
                  color={colors.textTertiary || '#737373'}
                />
              </View>
            ) : (
              <TouchableOpacity
                onLongPress={drag}
                disabled={isActive || saving}
                style={styles.dragHandle}
                accessibilityLabel={`Drag handle for ${item.title}`}
                accessibilityRole="button"
              >
                <Ionicons
                  name="reorder-three"
                  size={24}
                  color={colors.textSecondary || '#a3a3a3'}
                />
              </TouchableOpacity>
            )}

            {/* Middle: Time label from current POSITION + Title */}
            <View style={styles.titleInfoContainer}>
              {timeLabel ? (
                <View style={[styles.timeBadge, isDone && styles.timeBadgeDone]}>
                  <Text
                    style={[
                      styles.timeBadgeText,
                      isDone && styles.timeBadgeTextDone,
                    ]}
                  >
                    {timeLabel}
                  </Text>
                </View>
              ) : null}
              <Text
                style={[
                  styles.activityTitleText,
                  isDone && styles.activityTitleTextDone,
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>

            {/* Right: Accessibility Up/Down buttons or Locked badge */}
            {isDone ? (
              <View style={styles.doneBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.accentSecondary || '#2F6E68'}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.doneBadgeText}>Done</Text>
              </View>
            ) : (
              <View style={styles.arrowsContainer}>
                <TouchableOpacity
                  style={[
                    styles.arrowBtn,
                    !canMoveUp(currentIndex) && styles.arrowBtnDisabled,
                  ]}
                  onPress={() => moveItemUp(currentIndex)}
                  disabled={!canMoveUp(currentIndex) || saving}
                  accessibilityLabel={`Move ${item.title} up`}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={
                      canMoveUp(currentIndex)
                        ? colors.textPrimary || '#ffffff'
                        : colors.textTertiary || '#525252'
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.arrowBtn,
                    !canMoveDown(currentIndex) && styles.arrowBtnDisabled,
                  ]}
                  onPress={() => moveItemDown(currentIndex)}
                  disabled={!canMoveDown(currentIndex) || saving}
                  accessibilityLabel={`Move ${item.title} down`}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={
                      canMoveDown(currentIndex)
                        ? colors.textPrimary || '#ffffff'
                        : colors.textTertiary || '#525252'
                    }
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScaleDecorator>
      );
    },
    [positionLabels, saving, canMoveUp, canMoveDown, moveItemUp, moveItemDown]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <GestureHandlerRootView style={styles.rootView}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
            disabled={saving}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.navTitle}>Reorder Day {dayNumber}</Text>

          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                style={[
                  styles.saveBtnText,
                  (!hasChanges || saving) && styles.saveBtnTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Informational Guidance Banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.textSecondary || '#a3a3a3'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.infoBannerText}>
            Drag items or use the arrows to reorder. Time labels remain with their positions. Completed activities are locked.
          </Text>
        </View>

        {/* Draggable List */}
        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.key}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  rootView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md || 16,
    paddingVertical: spacing.sm || 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#262626',
    backgroundColor: '#000000',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: colors.textSecondary || '#a3a3a3',
    fontFamily: fonts?.body || 'System',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary || '#ffffff',
    fontFamily: fonts?.heading || 'System',
  },
  saveBtn: {
    backgroundColor: colors.accentPrimary || '#E07A5F',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii?.md || 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#262626',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: fonts?.body || 'System',
  },
  saveBtnTextDisabled: {
    color: colors.textTertiary || '#737373',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: spacing.md || 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary || '#a3a3a3',
    fontFamily: fonts?.body || 'System',
  },
  listContent: {
    padding: spacing.md || 16,
    paddingBottom: 40,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: radii?.md || 10,
    borderWidth: 1,
    borderColor: colors.border || '#262626',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  rowCardActive: {
    backgroundColor: '#222222',
    borderColor: colors.accentPrimary || '#E07A5F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  rowCardLocked: {
    backgroundColor: '#0d0d0d',
    borderColor: '#1e1e1e',
    opacity: 0.65,
  },
  dragHandle: {
    paddingRight: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContainer: {
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  timeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#222222',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  timeBadgeDone: {
    backgroundColor: '#1a1a1a',
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentPrimary || '#E07A5F',
    fontFamily: fonts?.mono || 'System',
  },
  timeBadgeTextDone: {
    color: colors.textTertiary || '#737373',
  },
  activityTitleText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary || '#ffffff',
    fontFamily: fonts?.body || 'System',
    lineHeight: 20,
  },
  activityTitleTextDone: {
    color: colors.textTertiary || '#737373',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131e1c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1d3b37',
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentSecondary || '#2F6E68',
    fontFamily: fonts?.body || 'System',
  },
  arrowsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  arrowBtn: {
    backgroundColor: '#242424',
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: {
    backgroundColor: '#171717',
    opacity: 0.4,
  },
});

