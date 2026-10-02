import React, { useState, useEffect } from 'react';
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

// Curated list of top domestic and international trending destinations
const TRENDING_PLACES = [
  {
    id: 'goa',
    name: 'Goa',
    country: 'India',
    tagline: 'Golden beaches & coastal nightlife',
    category: 'Beach',
    query: 'Goa beach ocean sunset',
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
    query: 'Jaipur Hawa Mahal palace',
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
    query: 'Kerala backwaters houseboat',
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
    query: 'Ladakh mountain lake landscape',
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
    query: 'Bali tropical temple sunset',
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
    query: 'Paris Eiffel Tower sunset cityscape',
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
    query: 'Tokyo skyline city night',
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
    query: 'Swiss Alps snowy mountain peak',
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
    query: 'Rome Colosseum architecture',
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
    query: 'Dubai Burj Khalifa skyline',
    fallbackPhotoUrl:
      'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=800',
    photographerName: 'Aleksandar Pasaric',
  },
];

export default function TrendingDestinationsScreen({ navigation }) {
  const [destinations, setDestinations] = useState(TRENDING_PLACES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch photos from Pexels API using standard Authorization header
  const fetchPexelsPhotos = async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    const apiKey =
      process.env.EXPO_PUBLIC_PEXELS_API_KEY ||
      process.env.PEXELS_API_KEY ||
      '';

    // If API key is not configured, gracefully use high-res fallback photography
    if (!apiKey) {
      setDestinations(
        TRENDING_PLACES.map((place) => ({
          ...place,
          photoUrl: place.fallbackPhotoUrl,
        }))
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const updatedList = await Promise.all(
        TRENDING_PLACES.map(async (dest) => {
          try {
            const queryParam = encodeURIComponent(dest.query || dest.name);
            const response = await fetch(
              `https://api.pexels.com/v1/search?query=${queryParam}&per_page=1&orientation=landscape`,
              {
                method: 'GET',
                headers: {
                  Authorization: apiKey,
                  Accept: 'application/json',
                },
              }
            );

            if (!response.ok) {
              return {
                ...dest,
                photoUrl: dest.fallbackPhotoUrl,
              };
            }

            const data = await response.json();
            const photo = data?.photos?.[0];

            if (photo) {
              return {
                ...dest,
                photoUrl:
                  photo.src?.large ||
                  photo.src?.medium ||
                  dest.fallbackPhotoUrl,
                photographerName: photo.photographer || dest.photographerName,
                photographerUrl: photo.photographer_url || '',
              };
            }

            return {
              ...dest,
              photoUrl: dest.fallbackPhotoUrl,
            };
          } catch (itemErr) {
            console.warn(`Pexels fetch failed for ${dest.name}:`, itemErr.message);
            return {
              ...dest,
              photoUrl: dest.fallbackPhotoUrl,
            };
          }
        })
      );

      setDestinations(updatedList);
    } catch (err) {
      console.error('Error fetching trending photos from Pexels:', err);
      setErrorMessage(
        'Unable to reach Pexels photo service. Showing saved photography.'
      );
      setDestinations(
        TRENDING_PLACES.map((p) => ({ ...p, photoUrl: p.fallbackPhotoUrl }))
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPexelsPhotos();
  }, []);

  const handleDestinationPress = (destinationName) => {
    // Navigate to Explore screen with selected destination pre-filled
    navigation.navigate('Explore', { destination: destinationName });
  };

  // Filtered by local search query
  const filteredDestinations = destinations.filter((dest) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      dest.name.toLowerCase().includes(q) ||
      dest.country.toLowerCase().includes(q) ||
      dest.category.toLowerCase().includes(q)
    );
  });

  const renderDestinationCard = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.cardWrapper}
        activeOpacity={0.88}
        onPress={() => handleDestinationPress(item.name)}
      >
        <ImageBackground
          source={{ uri: item.photoUrl || item.fallbackPhotoUrl }}
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
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter trending destinations..."
            placeholderTextColor={colors.textMuted}
            value={searchFilter}
            onChangeText={setSearchFilter}
            autoCapitalize="words"
            clearButtonMode="while-editing"
          />
          {searchFilter ? (
            <TouchableOpacity onPress={() => setSearchFilter('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchPexelsPhotos()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading Indicator */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Fetching trending photography...</Text>
            <Text style={styles.loadingSubtext}>Connecting to Pexels API</Text>
          </View>
        ) : (
          /* 2-Column Grid of Trending Destinations */
          <FlatList
            data={filteredDestinations}
            keyExtractor={(item) => item.id}
            renderItem={renderDestinationCard}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchPexelsPhotos(true)}
                tintColor={colors.accentPrimary}
                colors={[colors.accentPrimary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No matching destinations</Text>
                <Text style={styles.emptySubtitle}>
                  Try clearing your filter to view all trending places.
                </Text>
              </View>
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
