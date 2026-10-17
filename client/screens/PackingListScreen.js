import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

export default function PackingListScreen({ route, navigation }) {
  const { itineraryId, destination } = route.params || {};

  const [packingList, setPackingList] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState(new Set());
  const [newCustomText, setNewCustomText] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inlineError, setInlineError] = useState('');

  /**
   * Fetches the packing list from POST /itinerary/:id/packing-list.
   * Receives { packingList, customItems, checked }.
   * If isRegenerate is true, triggers LLM re-creation while preserving custom items.
   */
  const fetchPackingList = useCallback(
    async (isRegenerate = false, isPullRefresh = false) => {
      if (!itineraryId) {
        setErrorMessage('No itinerary ID was provided.');
        setLoading(false);
        return;
      }

      if (isRegenerate) {
        setRegenerating(true);
      } else if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage('');
      setInlineError('');

      try {
        const res = await apiClient.post(`/itinerary/${itineraryId}/packing-list`, {
          regenerate: isRegenerate,
        });

        if (!res.ok) {
          throw new Error(`Failed to load packing list (status ${res.status})`);
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.packingList || [];
        const custom = Array.isArray(data?.customItems) ? data.customItems : [];
        const checked = Array.isArray(data?.checked) ? data.checked : [];

        setPackingList(list);
        setCustomItems(custom);
        setCheckedKeys(new Set(checked));
      } catch (err) {
        console.error('Failed to load packing list:', err);
        setErrorMessage('Could not load packing list. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setRegenerating(false);
      }
    },
    [itineraryId]
  );

  useEffect(() => {
    fetchPackingList(false, false);
  }, [fetchPackingList]);

  // Re-fetch when screen is focused (e.g. returning from TemplatesScreen)
  useEffect(() => {
    const unsubscribe = navigation?.addListener
      ? navigation.addListener('focus', () => {
          fetchPackingList(false, false);
        })
      : () => {};
    return unsubscribe;
  }, [navigation, fetchPackingList]);

  /**
   * Toggles an item checkmark optimistically and persists via PATCH /itinerary/:id/packing/checked.
   * If network call fails, reverts the toggle and displays an inline error.
   */
  const toggleItem = async (key) => {
    if (!key || !itineraryId) return;

    const isCurrentlyChecked = checkedKeys.has(key);
    const newChecked = !isCurrentlyChecked;

    // Optimistic toggle
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (newChecked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setInlineError('');

    try {
      const res = await apiClient(`/itinerary/${itineraryId}/packing/checked`, {
        method: 'PATCH',
        body: JSON.stringify({ key, checked: newChecked }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update item');
      }
    } catch (err) {
      console.error('Toggle item error:', err);
      // Revert optimistic toggle
      setCheckedKeys((prev) => {
        const next = new Set(prev);
        if (isCurrentlyChecked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setInlineError('Failed to update checklist. Please try again.');
    }
  };

  /**
   * Adds a custom item via POST /itinerary/:id/packing/custom.
   */
  const handleAddCustomItem = async () => {
    const trimmed = newCustomText.trim();
    if (!trimmed || !itineraryId || addingCustom) return;

    if (trimmed.length > 80) {
      setInlineError('Custom item cannot exceed 80 characters.');
      return;
    }
    if (customItems.length >= 50) {
      setInlineError('Maximum limit of 50 custom packing items reached.');
      return;
    }

    setAddingCustom(true);
    setInlineError('');

    try {
      const res = await apiClient(`/itinerary/${itineraryId}/packing/custom`, {
        method: 'POST',
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to add custom item');
      }

      const updatedList = await res.json();
      setCustomItems(Array.isArray(updatedList) ? updatedList : []);
      setNewCustomText('');
    } catch (err) {
      console.error('Add custom item error:', err);
      setInlineError(err.message || 'Failed to add item. Please try again.');
    } finally {
      setAddingCustom(false);
    }
  };

  /**
   * Deletes a custom item via DELETE /itinerary/:id/packing/custom/:itemId.
   */
  const handleDeleteCustomItem = async (itemId) => {
    if (!itemId || !itineraryId) return;

    const key = `custom::${itemId}`;
    const prevCustom = customItems;
    const wasChecked = checkedKeys.has(key);

    // Optimistic delete
    setCustomItems((prev) => prev.filter((item) => item._id !== itemId));
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setInlineError('');

    try {
      const res = await apiClient(`/itinerary/${itineraryId}/packing/custom/${itemId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete custom item');
      }
    } catch (err) {
      console.error('Delete custom item error:', err);
      // Revert on failure
      setCustomItems(prevCustom);
      if (wasChecked) {
        setCheckedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
      setInlineError('Failed to remove item. Please try again.');
    }
  };

  // Helper icon for category
  const getCategoryIcon = (category = '') => {
    const cat = category.toLowerCase();
    if (cat.includes('cloth') || cat.includes('apparel') || cat.includes('wear')) return 'shirt-outline';
    if (cat.includes('doc') || cat.includes('ticket') || cat.includes('pass')) return 'document-text-outline';
    if (cat.includes('elect') || cat.includes('tech') || cat.includes('gadget')) return 'hardware-chip-outline';
    if (cat.includes('toil') || cat.includes('health') || cat.includes('hygiene') || cat.includes('med')) return 'medkit-outline';
    if (cat.includes('activity') || cat.includes('gear') || cat.includes('special')) return 'compass-outline';
    return 'bag-handle-outline';
  };

  // Calculate totals for progress tracker across AI items and custom items
  let totalItemsCount = 0;
  let checkedItemsCount = 0;

  // Custom items count
  if (Array.isArray(customItems)) {
    totalItemsCount += customItems.length;
    customItems.forEach((c) => {
      if (checkedKeys.has(`custom::${c._id}`)) {
        checkedItemsCount += 1;
      }
    });
  }

  // AI items count
  if (Array.isArray(packingList)) {
    packingList.forEach((cat) => {
      if (Array.isArray(cat.items)) {
        totalItemsCount += cat.items.length;
        cat.items.forEach((item) => {
          if (checkedKeys.has(`ai::${cat.category}::${item}`)) {
            checkedItemsCount += 1;
          }
        });
      }
    });
  }

  const progressPercent = totalItemsCount > 0
    ? Math.round((checkedItemsCount / totalItemsCount) * 100)
    : 0;

  const customCheckedCount = (customItems || []).filter((c) => checkedKeys.has(`custom::${c._id}`)).length;

  return (
    <View style={styles.wrapper}>
      {/* Universal Screen Header */}
      <ScreenHeader
        title="Packing List 🎒"
        subtitle={destination ? `Tailored checklist for ${destination}` : 'Your trip packing checklist'}
        rightElement={
          navigation?.canGoBack() ? (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPackingList(false, true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Top Control Bar: Regenerate Button & Header */}
        <View style={styles.topControlCard}>
          <View style={styles.topControlRow}>
            <View style={styles.topControlTextCol}>
              <Text style={styles.topControlTitle}>Smart Checklist</Text>
              <Text style={styles.topControlSubtitle}>
                Activity-tailored essentials for your journey
              </Text>
            </View>

            <View style={styles.topControlActions}>
              {/* Templates Button */}
              <TouchableOpacity
                style={styles.templatesButton}
                onPress={() =>
                  navigation.navigate('TemplatesScreen', {
                    itineraryId,
                    destination,
                    packingList,
                    customItems,
                  })
                }
                activeOpacity={0.8}
                accessibilityLabel="Packing Templates"
              >
                <Ionicons
                  name="albums-outline"
                  size={14}
                  color={colors.textPrimary}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.templatesButtonText}>Templates</Text>
              </TouchableOpacity>

              {/* Regenerate Button */}
              <TouchableOpacity
                style={[
                  styles.regenerateButton,
                  regenerating ? styles.regenerateButtonDisabled : null,
                ]}
                onPress={() => fetchPackingList(true, false)}
                disabled={regenerating || loading}
                activeOpacity={0.8}
              >
                {regenerating ? (
                  <ActivityIndicator size="small" color="#000000" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={15}
                    color="#000000"
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={styles.regenerateButtonText}>
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar & Counter */}
          {totalItemsCount > 0 ? (
            <View style={styles.progressSection}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>
                  Packed: {checkedItemsCount} of {totalItemsCount} items
                </Text>
                <Text style={styles.progressPercentText}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        {/* Inline Error Toast */}
        {inlineError ? (
          <View style={styles.inlineToast}>
            <Ionicons name="alert-circle" size={16} color={colors.accentUrgent} />
            <Text style={styles.inlineToastText}>{inlineError}</Text>
            <TouchableOpacity
              onPress={() => setInlineError('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Global Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={() => fetchPackingList(false, false)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Initial Loading Indicator */}
        {loading && !refreshing && !regenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingTitle}>Curating your packing list…</Text>
            <Text style={styles.loadingSubtitle}>
              Synthesizing destination climate, activity requirements, and travel essentials.
            </Text>
          </View>
        ) : null}

        {/* SECTION 1: "My items" Custom Packing Section (Rendered above AI categories) */}
        {!loading ? (
          <View style={styles.categoryCard}>
            {/* My Items Header */}
            <View style={styles.categoryHeader}>
              <View style={styles.categoryHeaderLeft}>
                <View style={styles.customIconCircle}>
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color={colors.accentPrimary}
                  />
                </View>
                <Text style={styles.categoryTitle}>My items</Text>
              </View>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {customCheckedCount}/{customItems.length}
                </Text>
              </View>
            </View>

            {/* Custom Items List */}
            <View style={styles.itemsList}>
              {customItems.length === 0 ? (
                <Text style={styles.emptyCustomText}>
                  No custom items added yet. Add personal essentials below.
                </Text>
              ) : (
                customItems.map((customItem) => {
                  const key = `custom::${customItem._id}`;
                  const isChecked = checkedKeys.has(key);

                  return (
                    <View
                      key={customItem._id}
                      style={[
                        styles.itemRow,
                        isChecked ? styles.itemRowChecked : null,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.itemRowTappable}
                        onPress={() => toggleItem(key)}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isChecked }}
                        accessibilityLabel={`${customItem.text}, ${isChecked ? 'packed' : 'not packed'}`}
                      >
                        <View style={styles.checkboxContainer}>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isChecked ? colors.accentPrimary : 'rgba(247, 243, 234, 0.4)'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.itemText,
                            isChecked ? styles.itemTextChecked : null,
                          ]}
                        >
                          {customItem.text}
                        </Text>
                        {customItem.category && customItem.category !== 'My items' ? (
                          <View style={styles.customCategoryTag}>
                            <Text style={styles.customCategoryTagText}>
                              {customItem.category}
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>

                      {/* Delete (x) Button */}
                      <TouchableOpacity
                        style={styles.deleteCustomBtn}
                        onPress={() => handleDeleteCustomItem(customItem._id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Delete ${customItem.text}`}
                      >
                        <Ionicons name="close" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* Add Custom Item Row */}
            <View style={styles.addCustomRow}>
              <TextInput
                style={styles.addCustomInput}
                placeholder="Add custom item (e.g. Passport, Camera)..."
                placeholderTextColor="rgba(247, 243, 234, 0.35)"
                value={newCustomText}
                onChangeText={(text) => {
                  setNewCustomText(text);
                  if (inlineError) setInlineError('');
                }}
                maxLength={80}
                editable={!addingCustom}
                onSubmitEditing={handleAddCustomItem}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[
                  styles.addCustomBtn,
                  (!newCustomText.trim() || addingCustom || customItems.length >= 50)
                    ? styles.addCustomBtnDisabled
                    : null,
                ]}
                onPress={handleAddCustomItem}
                disabled={!newCustomText.trim() || addingCustom || customItems.length >= 50}
                activeOpacity={0.8}
              >
                {addingCustom ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.addCustomBtnText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            {customItems.length >= 50 ? (
              <Text style={styles.limitNote}>Maximum 50 custom items reached</Text>
            ) : null}
          </View>
        ) : null}

        {/* SECTION 2: AI Generated Categories */}
        {!loading && Array.isArray(packingList) && packingList.length > 0 ? (
          packingList.map((catGroup, catIdx) => {
            const categoryName = catGroup?.category || `Category ${catIdx + 1}`;
            const items = Array.isArray(catGroup?.items) ? catGroup.items : [];
            const iconName = getCategoryIcon(categoryName);

            // Category-level packed count
            const categoryCheckedCount = items.filter((item) =>
              checkedKeys.has(`ai::${categoryName}::${item}`)
            ).length;

            return (
              <View key={`cat-${catIdx}`} style={styles.categoryCard}>
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryHeaderLeft}>
                    <View style={styles.categoryIconCircle}>
                      <Ionicons
                        name={iconName}
                        size={18}
                        color={colors.accentPrimary}
                      />
                    </View>
                    <Text style={styles.categoryTitle}>{categoryName}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {categoryCheckedCount}/{items.length}
                    </Text>
                  </View>
                </View>

                {/* Items Checklist */}
                <View style={styles.itemsList}>
                  {items.map((item, itemIdx) => {
                    const key = `ai::${categoryName}::${item}`;
                    const isChecked = checkedKeys.has(key);

                    return (
                      <TouchableOpacity
                        key={`item-${itemIdx}`}
                        style={[
                          styles.itemRow,
                          isChecked ? styles.itemRowChecked : null,
                        ]}
                        onPress={() => toggleItem(key)}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isChecked }}
                        accessibilityLabel={`${item}, ${isChecked ? 'packed' : 'not packed'}`}
                      >
                        {/* Checkbox Icon */}
                        <View style={styles.checkboxContainer}>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isChecked ? colors.accentPrimary : 'rgba(247, 243, 234, 0.4)'}
                          />
                        </View>

                        {/* Item Text */}
                        <Text
                          style={[
                            styles.itemText,
                            isChecked ? styles.itemTextChecked : null,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        ) : null}

        {/* Empty State */}
        {!loading && (!Array.isArray(packingList) || packingList.length === 0) && customItems.length === 0 && !errorMessage ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎒</Text>
            <Text style={styles.emptyTitle}>No packing items yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to generate your activity-tailored packing checklist.
            </Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => fetchPackingList(true, false)}
            >
              <Text style={styles.generateButtonText}>Generate Packing List ✨</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
  },
  // Top Control Card
  topControlCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topControlTextCol: {
    flex: 1,
    marginRight: 12,
  },
  topControlTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  topControlSubtitle: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPrimary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  regenerateButtonDisabled: {
    opacity: 0.6,
  },
  regenerateButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  // Progress Bar
  progressSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.mono,
    color: colors.accentPrimary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 3,
  },
  // Inline Toast Error
  inlineToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentUrgent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  inlineToastText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.accentUrgent,
    marginLeft: 8,
  },
  // Category Card
  categoryCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 243, 234, 0.08)',
    marginBottom: 8,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  customIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 163, 61, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  categoryBadge: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textMuted,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  itemRowTappable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRowChecked: {
    opacity: 0.7,
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  itemTextChecked: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  deleteCustomBtn: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 12,
  },
  emptyCustomText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  // Add Custom Item Row
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
  },
  addCustomInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.body,
    marginRight: 8,
  },
  addCustomBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomBtnDisabled: {
    opacity: 0.45,
  },
  addCustomBtnText: {
    color: '#000000',
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  limitNote: {
    fontSize: 11,
    color: colors.accentUrgent,
    fontFamily: fonts.body,
    marginTop: 4,
    marginLeft: 2,
  },
  // Loading & Error States
  loadingContainer: {
    padding: 32,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 16,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#fca5a5',
    marginLeft: 8,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: '#ffffff',
  },
  emptyContainer: {
    padding: 32,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  generateButton: {
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  topControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
  },
  templatesButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  customCategoryTag: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    alignSelf: 'center',
  },
  customCategoryTagText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
});
