import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

// Rich curated metadata for trending domestic and international spots
const CURATED_METADATA = {
  // 18 Indian trending destinations
  goa: {
    country: 'India',
    category: 'Beach',
    tagline: 'Golden beaches & coastal nightlife',
    photographerName: 'Sumit Kapai',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  jaipur: {
    country: 'India',
    category: 'Heritage',
    tagline: 'The Pink City of grand forts & palaces',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  kerala: {
    country: 'India',
    category: 'Nature',
    tagline: 'Tranquil palm-fringed backwaters & lagoons',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  'kerala backwaters': {
    country: 'India',
    category: 'Nature',
    tagline: 'Tranquil palm-fringed backwaters & lagoons',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  ladakh: {
    country: 'India',
    category: 'Adventure',
    tagline: 'High-altitude desert & Pangong mountain lake',
    photographerName: 'Aman',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  rishikesh: {
    country: 'India',
    category: 'Spiritual',
    tagline: 'Yoga capital of the world on the sacred Ganges',
    photographerName: 'Aman',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  udaipur: {
    country: 'India',
    category: 'Heritage',
    tagline: 'City of Lakes and majestic royal palaces',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  munnar: {
    country: 'India',
    category: 'Hill Station',
    tagline: 'Rolling tea gardens & misty green valleys',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  varanasi: {
    country: 'India',
    category: 'Spiritual',
    tagline: 'Ancient ghats along the sacred Ganges river',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  manali: {
    country: 'India',
    category: 'Adventure',
    tagline: 'Snow-capped peaks & Himalayan pine valleys',
    photographerName: 'Aman',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  'andaman islands': {
    country: 'India',
    category: 'Islands',
    tagline: 'Turquoise waters, coral reefs & white sands',
    photographerName: 'Sumit Kapai',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  hampi: {
    country: 'India',
    category: 'Heritage',
    tagline: 'UNESCO ruins of the Vijayanagara Empire',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  mysore: {
    country: 'India',
    category: 'Culture',
    tagline: 'Royal heritage, grand palaces & silk markets',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  darjeeling: {
    country: 'India',
    category: 'Hill Station',
    tagline: 'Views of Kanchenjunga & emerald tea estates',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  puducherry: {
    country: 'India',
    category: 'Coastal',
    tagline: 'French colonial charm, cafes & serene promenade',
    photographerName: 'Sumit Kapai',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  'rann of kutch': {
    country: 'India',
    category: 'Desert',
    tagline: 'Endless white salt desert & starry nights',
    photographerName: 'Aman',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  meghalaya: {
    country: 'India',
    category: 'Nature',
    tagline: 'Living root bridges & cascading waterfalls',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  coorg: {
    country: 'India',
    category: 'Hill Station',
    tagline: 'Coffee plantations & misty Western Ghats',
    photographerName: 'Ajay Thomas',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  amritsar: {
    country: 'India',
    category: 'Spiritual',
    tagline: 'The revered Golden Temple & vibrant heritage',
    photographerName: 'Chitransh',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  // International popular destinations
  bali: {
    country: 'Indonesia',
    category: 'Tropical',
    tagline: 'Tropical temples, lush terraces & surf',
    photographerName: 'Alex Azabache',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  paris: {
    country: 'France',
    category: 'City & Art',
    tagline: 'Iconic architecture, romance & cafe culture',
    photographerName: 'Cyril Saulnier',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1850619/pexels-photo-1850619.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  tokyo: {
    country: 'Japan',
    category: 'Modern',
    tagline: 'Neon-lit cityscapes & ancient tradition',
    photographerName: 'Satoshi Hirayama',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  'swiss alps': {
    country: 'Switzerland',
    category: 'Mountains',
    tagline: 'Majestic snowy peaks & mountain chalets',
    photographerName: 'Eberhard Grossgasteiger',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1486974/pexels-photo-1486974.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  rome: {
    country: 'Italy',
    category: 'History',
    tagline: 'Ancient wonders & historic plazas',
    photographerName: 'Mauricio Artieda',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  dubai: {
    country: 'UAE',
    category: 'Luxury',
    tagline: 'Futuristic skylines & desert luxury',
    photographerName: 'Aleksandar Pasaric',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
};

// Fallback curated places for offline / cold initialization
const TRENDING_PLACES = [
  {
    id: 'goa',
    name: 'Goa',
    country: 'India',
    tagline: 'Golden beaches & coastal nightlife',
    category: 'Beach',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Sumit Kapai',
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    country: 'India',
    tagline: 'The Pink City of grand forts & palaces',
    category: 'Heritage',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Chitransh',
  },
  {
    id: 'kerala',
    name: 'Kerala',
    country: 'India',
    tagline: 'Tranquil palm-fringed backwaters & lagoons',
    category: 'Nature',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Ajay Thomas',
  },
  {
    id: 'ladakh',
    name: 'Ladakh',
    country: 'India',
    tagline: 'High-altitude desert & Pangong mountain lake',
    category: 'Adventure',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Aman',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    tagline: 'Tropical temples, lush terraces & surf',
    category: 'Tropical',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Alex Azabache',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    tagline: 'Iconic architecture, romance & cafe culture',
    category: 'City & Art',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1850619/pexels-photo-1850619.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Cyril Saulnier',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    tagline: 'Neon-lit cityscapes & ancient tradition',
    category: 'Modern',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Satoshi Hirayama',
  },
  {
    id: 'swiss-alps',
    name: 'Swiss Alps',
    country: 'Switzerland',
    tagline: 'Majestic snowy peaks & mountain chalets',
    category: 'Mountains',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1486974/pexels-photo-1486974.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Eberhard Grossgasteiger',
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    tagline: 'Ancient wonders & historic plazas',
    category: 'History',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Mauricio Artieda',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    tagline: 'Futuristic skylines & desert luxury',
    category: 'Luxury',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Aleksandar Pasaric',
  },
];

// Normalize destination object and merge with curated metadata when available
const formatDestination = (item) => {
  const rawName = item.name || '';
  const lower = rawName.toLowerCase().trim();
  const meta = CURATED_METADATA[lower] || {};

  return {
    id: item.id || lower.replace(/\s+/g, '-') || String(Math.random()),
    name: rawName,
    country: item.country || meta.country || 'Destination',
    tagline: item.tagline || meta.tagline || `Discover top sights and activities in ${rawName}`,
    category: item.category || meta.category || 'Explore',
    photoUrl: item.photoUrl || meta.fallbackPhotoUrl || item.fallbackPhotoUrl || '',
    fallbackPhotoUrl:
      item.fallbackPhotoUrl ||
      meta.fallbackPhotoUrl ||
      'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: item.photographerName || meta.photographerName || '',
    photographerUrl: item.photographerUrl || '',
  };
};

export default function TrendingDestinationsScreen({ navigation }) {
  const [curatedDestinations, setCuratedDestinations] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const debounceTimerRef = useRef(null);
  const latestQueryRef = useRef('');

  // Fetch curated trending destinations from GET /destinations/trending
  const fetchCuratedDestinations = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const res = await apiClient('/destinations/trending');
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted = data.map(formatDestination);
        setCuratedDestinations(formatted);
        setDestinations(formatted);
      } else {
        const fallback = TRENDING_PLACES.map(formatDestination);
        setCuratedDestinations(fallback);
        setDestinations(fallback);
      }
    } catch (err) {
      console.warn('Failed to fetch trending from backend, using fallback:', err.message);
      const fallback = TRENDING_PLACES.map(formatDestination);
      setCuratedDestinations(fallback);
      setDestinations(fallback);
      if (isPullToRefresh) {
        setErrorMessage('Unable to reach trending service. Showing saved destinations.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCuratedDestinations();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchCuratedDestinations]);

  // Execute debounced search lookup against GET /destinations/trending?query=<text>
  const executeSearch = async (query) => {
    try {
      const res = await apiClient(`/destinations/trending?query=${encodeURIComponent(query)}`);
      if (latestQueryRef.current !== query) {
        return; // Ignore stale async responses
      }
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (latestQueryRef.current !== query) {
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        const formatted = data.map(formatDestination);
        setDestinations(formatted);
      } else {
        setDestinations([]);
      }
    } catch (err) {
      if (latestQueryRef.current === query) {
        console.error('Error searching trending destinations:', err.message);
        setErrorMessage('Unable to search destination photography. Please check your connection.');
      }
    } finally {
      if (latestQueryRef.current === query) {
        setIsSearching(false);
      }
    }
  };

  const handleSearchChange = (text) => {
    setSearchFilter(text);
    setErrorMessage('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = text.trim();
    latestQueryRef.current = trimmed;

    // Empty query: immediately show the curated grid as it currently works
    if (!trimmed) {
      setIsSearching(false);
      setDestinations(curatedDestinations);
      return;
    }

    // Debounce ~380ms after typing stops before calling the endpoint with the query
    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, 380);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchFilter('');
    latestQueryRef.current = '';
    setIsSearching(false);
    setErrorMessage('');
    setDestinations(curatedDestinations);
  };

  const handleRefresh = () => {
    const trimmed = searchFilter.trim();
    if (trimmed) {
      setIsSearching(true);
      executeSearch(trimmed);
    } else {
      fetchCuratedDestinations(true);
    }
  };

  const handleDestinationPress = (destinationName) => {
    // Navigate to Explore screen with selected destination pre-filled
    navigation.navigate('Explore', { destination: destinationName });
  };

  const renderDestinationCard = ({ item }) => {
    const imageUri = item.photoUrl || item.fallbackPhotoUrl;

    return (
      <TouchableOpacity
        style={styles.cardWrapper}
        activeOpacity={0.88}
        onPress={() => handleDestinationPress(item.name)}
      >
        <ImageBackground
          source={{ uri: imageUri }}
          style={styles.cardImageBg}
          imageStyle={styles.cardImage}
        >
          {/* Top Badge: Country / Category */}
          <View style={styles.cardTopRow}>
            <View style={styles.countryPill}>
              <Text style={styles.countryPillText}>{item.country}</Text>
            </View>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{item.category}</Text>
            </View>
          </View>

          {/* Bottom Gradient Overlay with Destination Info */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.98)']}
            style={styles.gradientOverlay}
          >
            <Text style={styles.destinationTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.destinationTagline} numberOfLines={2}>
              {item.tagline}
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.exploreActionText}>Explore activities ➔</Text>
              {item.photographerName ? (
                <Text style={styles.photographerCredit} numberOfLines={1}>
                  📷 {item.photographerName}
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Universal ScreenHeader matching dark theme */}
      <ScreenHeader
        title="Trending Destinations 🔥"
        subtitle="Curated spots & live Pexels photography"
        rightElement={
          <View style={styles.headerRightRow}>
            {navigation?.canGoBack() ? (
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <View style={styles.container}>
        {/* Search / Filter Bar */}
        <View style={styles.searchBarContainer}>
          {isSearching ? (
            <ActivityIndicator
              size="small"
              color={colors.accentPrimary}
              style={styles.searchIcon}
            />
          ) : (
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textMuted}
              style={styles.searchIcon}
            />
          )}
          <TextInput
            style={styles.searchInput}
            placeholder="Search any destination (e.g. Paris, Tokyo, Goa)..."
            placeholderTextColor={colors.textMuted}
            value={searchFilter}
            onChangeText={handleSearchChange}
            autoCapitalize="words"
            clearButtonMode="while-editing"
          />
          {searchFilter ? (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={handleRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading Indicator for initial browse view */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Fetching trending photography...</Text>
            <Text style={styles.loadingSubtext}>Connecting to Pexels API</Text>
          </View>
        ) : (
          /* 2-Column Grid of Curated or Live-searched Destinations */
          <FlatList
            data={destinations}
            keyExtractor={(item, index) => item.id || `${item.name}-${index}`}
            renderItem={renderDestinationCard}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accentPrimary}
                colors={[colors.accentPrimary]}
              />
            }
            ListEmptyComponent={
              !isSearching ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>No matching destinations</Text>
                  <Text style={styles.emptySubtitle}>
                    Try searching for another city, country, or landmark.
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  errorBanner: {
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.accentUrgent,
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  retryText: {
    color: colors.accentUrgent,
    fontWeight: '700',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginTop: 14,
  },
  loadingSubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 28,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
    maxWidth: '48.5%',
    height: 230,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  cardImageBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  cardImage: {
    borderRadius: 15,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    gap: 6,
  },
  countryPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.2)',
  },
  countryPillText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryPill: {
    backgroundColor: 'rgba(232, 163, 61, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryPillText: {
    color: colors.textOnSurface,
    fontSize: 10,
    fontWeight: '700',
  },
  gradientOverlay: {
    padding: 10,
    paddingTop: 24,
    justifyContent: 'flex-end',
  },
  destinationTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  destinationTagline: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    marginBottom: 8,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.1)',
    paddingTop: 6,
    flexDirection: 'column',
    gap: 2,
  },
  exploreActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  photographerCredit: {
    fontSize: 9,
    color: 'rgba(247, 243, 234, 0.45)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
