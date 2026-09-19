import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { API_BASE_URL } from '../config/api';
import { colors, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

const CATEGORIES = [
  { id: null, label: 'All Places', icon: '📍' },
  { id: 'Temples', label: 'Temples', icon: '🛕' },
  { id: 'Beaches', label: 'Beaches', icon: '🏖️' },
  { id: 'Museums', label: 'Museums', icon: '🏛️' },
  { id: 'Nightlife', label: 'Nightlife', icon: '🍸' },
  { id: 'Nature', label: 'Nature', icon: '🌿' },
];

/**
 * Rewrites destination and category into the Nominatim query string.
 * e.g. "Temples" + "Goa" -> "temples in Goa"
 * If no category is selected, queries destination directly.
 */
const buildRewrittenQuery = (destination, category) => {
  const cleanDest = (destination || '').trim();
  if (!cleanDest) return '';
  if (category) {
    return `${category.toLowerCase()} in ${cleanDest}`;
  }
  return cleanDest;
};

export default function ExploreScreen({ route }) {
  const [destination, setDestination] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = initial, [] = empty, array = places
  const [errorMessage, setErrorMessage] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');

  const toggleCategory = (categoryId) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
    if (errorMessage) setErrorMessage('');
  };

  const executeSearch = async (destToSearch, catToSearch = selectedCategory) => {
    const cleanDest = (destToSearch !== undefined ? destToSearch : destination).trim();
    if (!cleanDest) {
      setErrorMessage('Please enter a destination to explore (e.g. Goa, Paris, Tokyo).');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');

    // Query rewriting: "Temples" + "Goa" becomes "temples in Goa"
    const rewrittenQuery = buildRewrittenQuery(cleanDest, catToSearch);
    setSearchedQuery(rewrittenQuery);
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/search?q=${encodeURIComponent(rewrittenQuery)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          data?.error || 'Failed to fetch attractions. Please wait a moment and try again.'
        );
        setResults([]);
        return;
      }

      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Explore activities search error:', error);
      setErrorMessage(
        'Unable to connect to destinations service. Please check your network connection.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => executeSearch();

  // Pre-fill and auto-search when arriving from Trending Destinations on Home
  useEffect(() => {
    const incomingDest = route?.params?.destination;
    if (incomingDest && typeof incomingDest === 'string' && incomingDest.trim()) {
      const clean = incomingDest.trim();
      setDestination(clean);
      executeSearch(clean, null);
    }
  }, [route?.params?.destination]);

  const currentRewrittenPreview = destination.trim()
    ? buildRewrittenQuery(destination.trim(), selectedCategory)
    : null;

  const renderItem = ({ item }) => (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.pinIcon}>📍</Text>
        <Text style={styles.resultName}>{item.name}</Text>
      </View>
      {item.address ? (
        <Text style={styles.resultAddress}>{item.address}</Text>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Universal ScreenHeader with safe-area clearance */}
      <ScreenHeader
        title="Explore Activities 🧭"
        subtitle="Discover top attractions anywhere"
      />
      <View style={styles.container}>
        {/* Search & Filter Header */}
        <View style={styles.headerCard}>
          {/* Destination Text Input */}
          <Text style={styles.inputLabel}>Destination</Text>
          <View style={styles.searchBarRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Goa, Paris, Tokyo, Jaipur"
              placeholderTextColor={colors.textMuted}
              value={destination}
              onChangeText={(text) => {
                setDestination(text);
                if (errorMessage) setErrorMessage('');
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={!loading}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                (loading || !destination.trim()) && styles.searchButtonDisabled,
              ]}
              onPress={handleSearch}
              disabled={loading || !destination.trim()}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnSurface} size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Category Chips Row */}
          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleCategory(cat.id)}
                  disabled={loading}
                >
                  <Text style={styles.chipIcon}>{cat.icon}</Text>
                  <Text
                    style={[styles.chipText, isSelected && styles.chipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Query Rewrite Indicator */}
          {currentRewrittenPreview ? (
            <View style={styles.rewriteBadge}>
              <Text style={styles.rewriteLabel}>Searching:</Text>
              <Text style={styles.rewriteQueryText}>"{currentRewrittenPreview}"</Text>
            </View>
          ) : null}
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage('')}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* State: Loading */}
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.stateTitle}>Searching activities...</Text>
            <Text style={styles.stateSubtitle}>
              Querying destinations for "{searchedQuery}"
            </Text>
          </View>
        ) : null}

        {/* State: Empty Results */}
        {!loading && !errorMessage && results !== null && results.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>🔍</Text>
            <Text style={styles.stateTitle}>No Activities Found</Text>
            <Text style={styles.stateSubtitle}>
              No places found matching "{searchedQuery}". Try another category chip or check your destination spelling.
            </Text>
          </View>
        ) : null}

        {/* State: Initial Idle Prompt */}
        {!loading && !errorMessage && results === null ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>🗺️</Text>
            <Text style={styles.stateTitle}>Find Things to Do</Text>
            <Text style={styles.stateSubtitle}>
              Enter a city or region above and choose a category to discover points of interest.
            </Text>
          </View>
        ) : null}

        {/* Results FlatList */}
        {!loading && !errorMessage && results && results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : null}
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
    flex: 1,
    padding: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
  },
  headerCard: {
    marginBottom: spacing[16] || 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.textPrimary,
  },
  searchButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: 'rgba(232, 163, 61, 0.35)',
    opacity: 0.6,
  },
  searchButtonText: {
    color: colors.textOnSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.textOnSurface,
    fontWeight: '700',
  },
  rewriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
    gap: 6,
  },
  rewriteLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  rewriteQueryText: {
    fontSize: 11,
    color: colors.accentPrimary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  errorBanner: {
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.accentUrgent,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  dismissText: {
    color: colors.accentUrgent,
    fontWeight: '600',
    fontSize: 12,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stateIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  listContent: {
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  pinIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  resultAddress: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    paddingLeft: 24,
  },
});

