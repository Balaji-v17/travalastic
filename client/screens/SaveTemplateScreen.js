import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

export default function SaveTemplateScreen({ route, navigation }) {
  const {
    itineraryId,
    destination,
    packingList: initialPackingList = [],
    customItems: initialCustomItems = [],
  } = route.params || {};

  const [name, setName] = useState('');
  const [packingList, setPackingList] = useState(initialPackingList);
  const [customItems, setCustomItems] = useState(initialCustomItems);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  // Fetch if items weren't passed in route params
  useEffect(() => {
    if (itineraryId && packingList.length === 0 && customItems.length === 0) {
      setLoading(true);
      apiClient
        .post(`/itinerary/${itineraryId}/packing-list`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setPackingList(data?.packingList || []);
            setCustomItems(data?.customItems || []);
          }
        })
        .catch((err) => console.error('Fetch packing list error:', err))
        .finally(() => setLoading(false));
    }
  }, [itineraryId, packingList.length, customItems.length]);

  // Consolidate all items (AI + Custom)
  const allItems = useMemo(() => {
    const list = [];
    let idx = 0;

    // AI generated items
    if (Array.isArray(packingList)) {
      packingList.forEach((group) => {
        const catName = group?.category || 'General';
        const items = Array.isArray(group?.items) ? group.items : [];
        items.forEach((itemText) => {
          if (typeof itemText === 'string' && itemText.trim()) {
            list.push({
              id: `ai_${idx++}`,
              text: itemText.trim(),
              category: catName.trim(),
            });
          }
        });
      });
    }

    // Custom items
    if (Array.isArray(customItems)) {
      customItems.forEach((c) => {
        if (c?.text && typeof c.text === 'string' && c.text.trim()) {
          list.push({
            id: `custom_${c._id || idx++}`,
            text: c.text.trim(),
            category: (c.category && typeof c.category === 'string' && c.category.trim())
              ? c.category.trim()
              : 'My items',
          });
        }
      });
    }

    return list;
  }, [packingList, customItems]);

  // Group items by category
  const groupedByCategory = useMemo(() => {
    const groups = {};
    allItems.forEach((item) => {
      const cat = item.category || 'My items';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    });
    return groups;
  }, [allItems]);

  // ALL items selected by default
  const [selectedIds, setSelectedIds] = useState(() => new Set(allItems.map((i) => i.id)));

  // If allItems finishes loading asynchronously, sync default selection
  useEffect(() => {
    setSelectedIds(new Set(allItems.map((i) => i.id)));
  }, [allItems]);

  const toggleItem = (id) => {
    setServerError('');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCategoryGroup = (catItems) => {
    setServerError('');
    const allCatSelected = catItems.every((i) => selectedIds.has(i.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allCatSelected) {
        catItems.forEach((i) => next.delete(i.id));
      } else {
        catItems.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const isSaveDisabled = !name.trim() || selectedCount === 0 || saving;

  const handleSaveTemplate = async () => {
    if (isSaveDisabled) return;

    setSaving(true);
    setServerError('');

    const itemsToSave = allItems
      .filter((i) => selectedIds.has(i.id))
      .map((i) => ({
        text: i.text,
        category: i.category,
      }));

    try {
      const res = await apiClient.post('/packing-templates', {
        name: name.trim(),
        items: itemsToSave,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to save template (${res.status})`);
      }

      navigation.goBack();
    } catch (err) {
      console.error('Save template error:', err);
      setServerError(err.message || 'Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Save Template 💾"
        subtitle={destination ? `From: ${destination}` : 'Save items as template'}
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
      >
        {/* Template Name Input Card */}
        <View style={styles.nameCard}>
          <Text style={styles.inputLabel}>Template Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Summer Beach Vacation, Winter Ski Trip"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (serverError) setServerError('');
            }}
            maxLength={40}
            returnKeyType="done"
          />
          <Text style={styles.charCount}>{name.length}/40 characters</Text>
        </View>

        {/* Inline Server Error Banner */}
        {serverError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        ) : null}

        {/* Counter and Header Bar */}
        <View style={styles.selectionBar}>
          <Text style={styles.selectionTitle}>Included Items</Text>
          <View style={styles.selectedPill}>
            <Text style={styles.selectedPillText}>{selectedCount} selected</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading checklist items…</Text>
          </View>
        ) : allItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found in this trip's checklist.</Text>
          </View>
        ) : (
          /* Items grouped by category */
          <View style={styles.groupsContainer}>
            {Object.entries(groupedByCategory).map(([category, items]) => {
              const allCategorySelected = items.every((i) => selectedIds.has(i.id));
              const selectedInCategory = items.filter((i) => selectedIds.has(i.id)).length;

              return (
                <View key={category} style={styles.categoryCard}>
                  {/* Category Header Row */}
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    activeOpacity={0.8}
                    onPress={() => toggleCategoryGroup(items)}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <Ionicons
                        name={allCategorySelected ? 'checkbox' : selectedInCategory > 0 ? 'remove-circle-outline' : 'square-outline'}
                        size={20}
                        color={colors.accentPrimary}
                      />
                      <Text style={styles.categoryTitle}>{category}</Text>
                    </View>
                    <Text style={styles.categoryCount}>
                      {selectedInCategory}/{items.length}
                    </Text>
                  </TouchableOpacity>

                  {/* Items in this category */}
                  <View style={styles.itemsList}>
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.itemRow,
                            isSelected ? styles.itemRowSelected : null,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => toggleItem(item.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? colors.accentPrimary : 'rgba(247, 243, 234, 0.4)'}
                          />
                          <Text
                            style={[
                              styles.itemText,
                              !isSelected ? styles.itemTextUnselected : null,
                            ]}
                          >
                            {item.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Save Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaveDisabled ? styles.saveButtonDisabled : null,
          ]}
          activeOpacity={0.85}
          onPress={handleSaveTemplate}
          disabled={isSaveDisabled}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#131B2E" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#131B2E" />
              <Text style={styles.saveButtonText}>
                Save Template ({selectedCount})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameCard: {
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
  },
  charCount: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  selectedPill: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.3)',
  },
  selectedPillText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  groupsContainer: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 243, 234, 0.06)',
    marginBottom: 6,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  categoryCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  itemsList: {
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 10,
  },
  itemRowSelected: {
    backgroundColor: 'rgba(247, 243, 234, 0.03)',
  },
  itemText: {
    color: colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  itemTextUnselected: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#131B2E',
    fontSize: 15,
    fontWeight: '700',
  },
});

