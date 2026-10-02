import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { API_BASE_URL } from '../config/api';
import { colors, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

const CATEGORY_ICONS = {
  'All Places': '📍',
  'Temples': '🛕',
  'Beaches': '🏖️',
  'Museums': '🏛️',
  'Nightlife': '🍸',
  'Hill Stations': '⛰️',
  'Waterfalls': '🌊',
  'Wildlife Sanctuary': '🦁',
  'Forts': '🏰',
};

export default function ExploreScreen({ route }) {
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Places');
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchedDestination, setSearchedDestination] = useState('');

  const executeSearch = async (destToSearch) => {
    const cleanDest = (destToSearch !== undefined ? destToSearch : destination).trim();
    if (!cleanDest) {
      setErrorMessage('Please enter a destination to explore (e.g. Goa, Paris, Tokyo, Jaipur).');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');
    setSearchedDestination(cleanDest);
    setLoading(true);
    setActivities([]);
    setAvailableCategories([]);
    setSelectedCategory('All Places');

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/search?q=${encodeURIComponent(cleanDest)}`,
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
        setActivities([]);
        setAvailableCategories([]);
        setHasSearched(true);
        return;
      }

      // 1. State Updates: Safely extract data.results and data.availableCategories
      const results = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data?.destinations) ? data.destinations : (Array.isArray(data) ? data : []));
      const categories = Array.isArray(data?.availableCategories) ? data.availableCategories : [];

      setActivities(results);
      setAvailableCategories(categories);
      setSelectedCategory('All Places');
      setHasSearched(true);
    } catch (error) {
      console.error('Explore activities search error:', error);
      setErrorMessage(
        'Unable to connect to destinations service. Please check your network connection.'
      );
      setActivities([]);
      setAvailableCategories([]);
      setHasSearched(true);
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
      executeSearch(clean);
    }
  }, [route?.params?.destination]);

  // 4. List Rendering: Derive filtered activities locally before rendering without network requests
  const displayedActivities =
    selectedCategory === 'All Places'
      ? activities
      : activities.filter((a) => a.category === selectedCategory);

  const isFallbackList =
    activities &&
    activities.length > 0 &&
    (activities[0]?.isCurated === false ||
      activities[0]?.source === 'nominatim' ||
      activities[0]?.source === 'overpass');

  const renderItem = ({ item }) => {
    const isUncurated =
      item.isCurated === false ||
      item.source === 'nominatim' ||
      item.source === 'overpass';

    return (
      <View style={[styles.resultCard, isUncurated && styles.resultCardUncurated]}>
        <View style={styles.resultHeader}>
          <Text style={styles.pinIcon}>{isUncurated ? '📍' : '✨'}</Text>
          <View style={styles.resultTitleCol}>
            <View style={styles.resultTitleRow}>
              <Text style={[styles.resultName, isUncurated && styles.resultNameUncurated]}>
                {item.name}
              </Text>
              {isUncurated ? (
                <View style={styles.uncuratedPill}>
                  <Text style={styles.uncuratedPillText}>
                    {item.type || 'Nearby'}
                  </Text>
                </View>
              ) : item.type ? (
                <View style={styles.curatedPill}>
                  <Text style={styles.curatedPillText}>{item.type}</Text>
                </View>
              ) : null}
            </View>
            {!isUncurated && item.rating != null && Number(item.rating) > 0 ? (
              <Text style={styles.ratingText}>★ {item.rating} • Curated</Text>
            ) : null}
          </View>
        </View>
        {item.address ? (
          <Text style={styles.resultAddress}>{item.address}</Text>
        ) : null}
      </View>
    );
  };

  const renderFallbackHeader = () => {
    if (isFallbackList) {
      return (
        <View style={styles.fallbackNoticeBanner}>
          <Text style={styles.fallbackNoticeIcon}>ℹ️</Text>
          <View style={styles.fallbackNoticeContent}>
            <Text style={styles.fallbackNoticeTitle}>
              No curated activities found for this destination — here's what we found nearby
            </Text>
          </View>
        </View>
      );
    }
    return null;
  };

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
        {/* Search Header - Destination Input + Search Button Only */}
        <View style={styles.headerCard}>
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
        </View>

        {/* 2 & 3. Dynamic Category Chips: Render dynamically using availableCategories. Prepend 'All Places'. Hide entirely if availableCategories is empty */}
        {availableCategories && availableCategories.length > 0 ? (
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              {['All Places', ...availableCategories].map((catName) => {
                const isSelected = selectedCategory === catName;
                const icon = CATEGORY_ICONS[catName] || '✨';
                return (
                  <TouchableOpacity
                    key={catName}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setSelectedCategory(catName)}
                  >
                    <Text style={styles.chipIcon}>{icon}</Text>
                    <Text
                      style={[styles.chipText, isSelected && styles.chipTextActive]}
                    >
                      {catName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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
              Querying destinations for "{searchedDestination}"
            </Text>
          </View>
        ) : null}

        {/* State: Empty Results */}
        {!loading && !errorMessage && hasSearched && activities.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>🔍</Text>
            <Text style={styles.stateTitle}>No Activities Found</Text>
            <Text style={styles.stateSubtitle}>
              No places found matching "{searchedDestination}". Please check your destination spelling or try another city.
            </Text>
          </View>
        ) : null}

        {/* State: Initial Idle Prompt */}
        {!loading && !errorMessage && !hasSearched ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>🗺️</Text>
            <Text style={styles.stateTitle}>Find Things to Do</Text>
            <Text style={styles.stateSubtitle}>
              Enter a city or region above to discover curated sights and nearby attractions.
            </Text>
          </View>
        ) : null}

        {/* 4. Results FlatList using displayedActivities */}
        {!loading && !errorMessage && hasSearched && activities.length > 0 ? (
          <FlatList
            data={displayedActivities}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={renderItem}
            ListHeaderComponent={renderFallbackHeader}
            ListEmptyComponent={
              <View style={styles.emptyFilteredContainer}>
                <Text style={styles.emptyFilteredTitle}>No places matching "{selectedCategory}"</Text>
                <Text style={styles.emptyFilteredSubtitle}>
                  Try selecting "All Places" or another category chip above.
                </Text>
              </View>
            }
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
    marginBottom: 8,
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
  filterSection: {
    marginBottom: 12,
  },
  filterChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
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
  emptyFilteredContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyFilteredTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyFilteredSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
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
  resultNameUncurated: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultTitleCol: {
    flex: 1,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resultCardUncurated: {
    backgroundColor: 'rgba(28, 39, 64, 0.6)',
    borderColor: 'rgba(247, 243, 234, 0.1)',
    borderStyle: 'dashed',
  },
  uncuratedPill: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  uncuratedPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  curatedPill: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  curatedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentPrimary,
  },
  ratingText: {
    fontSize: 12,
    color: colors.accentPrimary,
    marginTop: 2,
  },
  fallbackNoticeBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(232, 163, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    alignItems: 'center',
  },
  fallbackNoticeIcon: {
    fontSize: 20,
  },
  fallbackNoticeContent: {
    flex: 1,
  },
  fallbackNoticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  resultAddress: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    paddingLeft: 24,
  },
});
