import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

export default function TemplatesScreen({ route, navigation }) {
  const {
    itineraryId,
    destination,
    packingList = [],
    customItems = [],
  } = route.params || {};

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Apply template preview modal state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunError, setDryRunError] = useState('');
  const [applying, setApplying] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /**
   * Fetch all packing templates for current user
   */
  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const res = await apiClient.get('/packing-templates');
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed to fetch templates (${res.status})`);
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setErrorMessage('Could not load packing templates. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Refresh when screen is focused (e.g. returning from SaveTemplateScreen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTemplates();
    });
    return unsubscribe;
  }, [navigation, fetchTemplates]);

  /**
   * Delete a template with confirmation
   */
  const handleDeleteTemplate = (template) => {
    const doDelete = async () => {
      setDeletingId(template.id);
      try {
        const res = await apiClient.delete(`/packing-templates/${template.id}`);
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || 'Failed to delete template');
        }
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      } catch (err) {
        console.error('Delete template error:', err);
        Alert.alert('Error', err.message || 'Could not delete template.');
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${template.name}"? This cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Template',
        `Are you sure you want to delete "${template.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  /**
   * Handle tapping a template: calls apply-template with dryRun: true
   */
  const handleTapTemplate = async (template) => {
    setSelectedTemplate(template);
    setDryRunLoading(true);
    setDryRunResult(null);
    setDryRunError('');

    try {
      const res = await apiClient.post(
        `/itinerary/${itineraryId}/packing/apply-template`,
        {
          templateId: template.id,
          dryRun: true,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed to preview template (${res.status})`);
      }

      const data = await res.json();
      setDryRunResult(data);
    } catch (err) {
      console.error('Dry run apply error:', err);
      setDryRunError(err.message || 'Could not preview template items.');
    } finally {
      setDryRunLoading(false);
    }
  };

  /**
   * Confirm Apply: calls apply-template with dryRun: false
   */
  const handleConfirmApply = async () => {
    if (!selectedTemplate) return;

    setApplying(true);
    try {
      const res = await apiClient.post(
        `/itinerary/${itineraryId}/packing/apply-template`,
        {
          templateId: selectedTemplate.id,
          dryRun: false,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to apply template');
      }

      const data = await res.json();
      setSelectedTemplate(null);
      setDryRunResult(null);

      // Return to packing list with success feedback
      Alert.alert(
        'Template Applied!',
        `Added ${data.added} item${data.added === 1 ? '' : 's'} to this trip's checklist.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.error('Apply template error:', err);
      Alert.alert('Error', err.message || 'Could not apply template to this trip.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title="Packing Templates 📋"
        subtitle={destination ? `Trip: ${destination}` : 'Reusable checklists'}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTemplates(true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Save Current List as Template Button */}
        <TouchableOpacity
          style={styles.saveCurrentBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('SaveTemplateScreen', {
              itineraryId,
              destination,
              packingList,
              customItems,
            })
          }
          accessibilityLabel="Save this list as a template"
        >
          <Ionicons name="bookmark-outline" size={18} color="#131B2E" />
          <Text style={styles.saveCurrentBtnText}>Save this list as a template</Text>
        </TouchableOpacity>

        {/* Error State */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchTemplates()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading templates…</Text>
          </View>
        ) : templates.length === 0 && !errorMessage ? (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIconText}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptySubtitle}>
              Save this trip's list to reuse it on future journeys.
            </Text>
          </View>
        ) : (
          /* Templates List */
          <View style={styles.templatesList}>
            <Text style={styles.sectionTitle}>Saved Templates</Text>
            {templates.map((item) => {
              const isDeleting = deletingId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.templateCard}
                  activeOpacity={0.8}
                  onPress={() => handleTapTemplate(item)}
                  accessibilityLabel={`Apply template ${item.name}`}
                >
                  <View style={styles.templateCardLeft}>
                    <View style={styles.templateIconCircle}>
                      <Ionicons name="albums-outline" size={20} color={colors.accentPrimary} />
                    </View>
                    <View style={styles.templateTextCol}>
                      <Text style={styles.templateName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.templateMeta}>
                        {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.templateCardRight}>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(item);
                      }}
                      disabled={isDeleting}
                      accessibilityLabel={`Delete ${item.name}`}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color="rgba(247,243,234,0.5)" />
                      )}
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="rgba(247,243,234,0.3)" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* DRY-RUN CONFIRMATION MODAL */}
      <Modal
        visible={Boolean(selectedTemplate)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (!applying) setSelectedTemplate(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="cloud-download-outline" size={26} color={colors.accentPrimary} />
              <Text style={styles.modalTitle}>
                Apply "{selectedTemplate?.name}"
              </Text>
            </View>

            {dryRunLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="small" color={colors.accentPrimary} />
                <Text style={styles.modalLoadingText}>Checking items against your list…</Text>
              </View>
            ) : dryRunError ? (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#fca5a5" />
                <Text style={styles.modalErrorText}>{dryRunError}</Text>
              </View>
            ) : dryRunResult ? (
              <View style={styles.modalResultBox}>
                <Text style={styles.modalMainMessage}>
                  Adds {dryRunResult.added} item{dryRunResult.added === 1 ? '' : 's'}.{' '}
                  {dryRunResult.skippedDuplicates} already on your list will be skipped.
                </Text>

                {dryRunResult.skippedOverCap > 0 ? (
                  <View style={styles.capWarningBox}>
                    <Ionicons name="warning-outline" size={15} color="#fbbf24" />
                    <Text style={styles.capWarningText}>
                      {dryRunResult.skippedOverCap} item
                      {dryRunResult.skippedOverCap === 1 ? '' : 's'} could not be added
                      because the 50-custom-item limit would be exceeded.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.8}
                onPress={() => setSelectedTemplate(null)}
                disabled={applying}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  dryRunLoading || dryRunError || dryRunResult?.added === 0 || applying
                    ? styles.modalConfirmBtnDisabled
                    : null,
                ]}
                activeOpacity={0.85}
                onPress={handleConfirmApply}
                disabled={dryRunLoading || Boolean(dryRunError) || dryRunResult?.added === 0 || applying}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#131B2E" />
                ) : (
                  <Text style={styles.modalConfirmText}>Add to this trip</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingBottom: 40,
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
  saveCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveCurrentBtnText: {
    color: '#131B2E',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  templatesList: {
    gap: 10,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
  },
  templateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  templateIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateTextCol: {
    flex: 1,
  },
  templateName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  templateMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  templateCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(247, 243, 234, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIconText: {
    fontSize: 26,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
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
  retryBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#18181A',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  modalLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    justifyContent: 'center',
    gap: 10,
  },
  modalLoadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalErrorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  modalResultBox: {
    backgroundColor: '#202022',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  modalMainMessage: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  capWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  capWarningText: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: '#131B2E',
    fontSize: 14,
    fontWeight: '700',
  },
});

