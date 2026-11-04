import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

const calculateDistanceKm = (loc1, loc2) => {
  if (!loc1 || !loc2) return null;
  const lat1 = Number(loc1.lat != null ? loc1.lat : loc1.latitude);
  const lon1 = Number(loc1.lon != null ? loc1.lon : lon1.longitude);
  const lat2 = Number(loc2.lat != null ? loc2.lat : loc2.latitude);
  const lon2 = Number(loc2.lon != null ? loc2.lon : loc2.longitude);

  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  if (isNaN(d) || d < 0) return null;
  return d;
};

const openDirections = (location) => {
  if (!location) return;
  const lat = location.lat != null ? location.lat : location.latitude;
  const lon = location.lon != null ? location.lon : location.longitude;
  if (lat == null || lon == null) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
  Linking.openURL(url).catch((err) => console.warn('Could not open map URL:', err));
};

export default function TodayScreen({ route, navigation }) {
  const { itineraryId, trip: initialTrip } = route.params || {};

  const [trip, setTrip] = useState(initialTrip || null);
  const [bookings, setBookings] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [loading, setLoading] = useState(!initialTrip);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingStatusId, setCheckingStatusId] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [rainAlert, setRainAlert] = useState(null);
  const [dismissedRainAlert, setDismissedRainAlert] = useState(false);
  const [activityErrorMessage, setActivityErrorMessage] = useState('');
  const [togglingActivityIndex, setTogglingActivityIndex] = useState(null);
  const [isRescheduleSheetVisible, setIsRescheduleSheetVisible] = useState(false);
  const [selectedDelayMinutes, setSelectedDelayMinutes] = useState(30);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleApplying, setRescheduleApplying] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleProposal, setRescheduleProposal] = useState(null);
  const [confirmAllSkip, setConfirmAllSkip] = useState(false);
  const [dayUpdatedBar, setDayUpdatedBar] = useState(null);
  const [undoLoading, setUndoLoading] = useState(false);

  /**
   * Loads trip details and linked flight bookings.
   * Manual on-demand pull only — no polling or background jobs.
   */
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!itineraryId) {
        setErrorMessage('No itinerary ID was provided.');
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else if (!trip) {
        setLoading(true);
      }
      setErrorMessage('');

      try {
        // 1. Fetch itinerary details
        const itinRes = await apiClient(`/itinerary/${itineraryId}`);
        if (!itinRes.ok) {
          throw new Error(`Failed to load itinerary (status ${itinRes.status})`);
        }
        const itinData = await itinRes.json();
        setTrip(itinData);

        // 2. Fetch linked flight bookings
        try {
          const bookingsRes = await apiClient(`/itinerary/${itineraryId}/bookings`);
          if (bookingsRes.ok) {
            const bookingsData = await bookingsRes.json();
            setBookings(Array.isArray(bookingsData) ? bookingsData : []);
          }
        } catch (bErr) {
          console.warn('Failed to load linked bookings:', bErr.message);
        }

        // 3. Geocode destination and fetch today's weather
        if (itinData?.destination) {
          fetchTodayWeather(itinData.destination);
        }

        // 4. Fetch today's rain heads-up alerts (pull-based only)
        try {
          const todayDateStr = new Date().toISOString().slice(0, 10);
          const alertRes = await apiClient(`/itinerary/${itineraryId}/today-alerts?date=${todayDateStr}`);
          if (alertRes.ok) {
            const alertData = await alertRes.json();
            if (alertData && Array.isArray(alertData.flagged) && alertData.flagged.length > 0) {
              setRainAlert(alertData);
            } else {
              setRainAlert(null);
            }
          }
        } catch (aErr) {
          console.warn('Failed to load today rain alerts:', aErr.message);
        }
      } catch (err) {
        console.error('Failed to load Today view data:', err);
        setErrorMessage('Could not load today’s trip details. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [itineraryId]
  );

  /**
   * Geocodes the destination via /destinations/search and retrieves weather via weatherService.
   */
  const fetchTodayWeather = async (destinationName) => {
    setWeatherLoading(true);
    try {
      // Step A: Geocode destination through /destinations/search if coordinates aren't already available
      const searchRes = await apiClient(`/destinations/search?query=${encodeURIComponent(destinationName)}`);
      let lat = null;
      let lon = null;

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const topResult = searchData?.results?.[0] || searchData?.destinations?.[0];
        if (topResult?.latitude != null && topResult?.longitude != null) {
          lat = topResult.latitude;
          lon = topResult.longitude;
        }
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      let weatherEndpoint = `/destinations/weather?date=${todayStr}`;
      if (lat != null && lon != null) {
        weatherEndpoint += `&lat=${lat}&lon=${lon}`;
      } else {
        weatherEndpoint += `&destination=${encodeURIComponent(destinationName)}`;
      }

      const weatherRes = await apiClient(weatherEndpoint);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        setWeather(weatherData);
      }
    } catch (wErr) {
      console.warn('Weather fetch error in TodayScreen:', wErr.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * On-demand check of flight booking status.
   * Calls GET /flights/bookings/:bookingId/status only when explicitly tapped.
   */
  const handleCheckFlightStatus = async (bookingId) => {
    if (!bookingId || checkingStatusId) return;
    setCheckingStatusId(bookingId);

    try {
      const res = await apiClient(`/flights/bookings/${bookingId}/status`);
      if (!res.ok) {
        throw new Error(`Status check returned ${res.status}`);
      }
      const data = await res.json();
      setStatusOverrides((prev) => ({
        ...prev,
        [bookingId]: {
          status: data.status,
          departureTime: data.departureTime,
          checkedAt: new Date(),
        },
      }));
    } catch (err) {
      console.error('Failed to check flight status:', err);
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Helper date parsing (Local device date is used as an MVP simplification for trip day calculation)
  const parseDateOnly = (dateStr) => {
    if (!dateStr) return null;
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const formatDateDisplay = (dateObj) => {
    if (!dateObj) return '';
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFlightTime = (rawTime) => {
    if (!rawTime) return 'Scheduled';
    try {
      const d = new Date(rawTime);
      if (isNaN(d.getTime())) return String(rawTime);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return String(rawTime);
    }
  };

  // Day calculations
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMidnight = parseDateOnly(trip?.startDate);
  const endMidnight = parseDateOnly(trip?.endDate || trip?.startDate);

  let tripState = 'active'; // 'not_started' | 'active' | 'ended'
  let currentDayNumber = 1;
  let totalTripDays = 1;
  let daysUntilStart = 0;
  let daysSinceEnd = 0;

  if (startMidnight && endMidnight) {
    totalTripDays = Math.max(
      1,
      Math.round((endMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    if (todayMidnight.getTime() < startMidnight.getTime()) {
      tripState = 'not_started';
      daysUntilStart = Math.ceil(
        (startMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else if (todayMidnight.getTime() > endMidnight.getTime()) {
      tripState = 'ended';
      daysSinceEnd = Math.floor(
        (todayMidnight.getTime() - endMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      tripState = 'active';
      const diff = Math.floor(
        (todayMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
      currentDayNumber = diff + 1;
    }
  }

  // Filter today's planned activities from existing day data
  const tripDaysList = Array.isArray(trip?.days)
    ? trip.days
    : Array.isArray(trip?.itinerary)
    ? trip.itinerary
    : [];

  const todayDayPlan = tripDaysList.find((d) => d.dayNumber === currentDayNumber);

  const todayActivities = Array.isArray(todayDayPlan?.activities) ? todayDayPlan.activities : [];
  const totalActivitiesCount = todayActivities.length;
  const doneActivitiesCount = todayActivities.filter(
    (a) => a && (typeof a === 'object' ? a.done === true : false)
  ).length;
  const notDoneActivitiesCount = totalActivitiesCount - doneActivitiesCount;
  const firstNotDoneActivityIndex = todayActivities.findIndex((a) => {
    if (typeof a === 'string') return true;
    return !a?.done;
  });

  const handleToggleActivityDone = async (idx, activity) => {
    const isString = typeof activity === 'string';
    const title = isString ? activity : (activity?.title || activity?.name || '');
    const currentDone = !isString && activity?.done === true;
    const nextDone = !currentDone;

    setActivityErrorMessage('');
    setTogglingActivityIndex(idx);

    const previousTrip = trip;

    // Optimistic toggle
    setTrip((prevTrip) => {
      if (!prevTrip) return prevTrip;
      const days = Array.isArray(prevTrip.days)
        ? prevTrip.days
        : Array.isArray(prevTrip.itinerary)
        ? prevTrip.itinerary
        : [];
      const updatedDays = days.map((d) => {
        if (d.dayNumber !== currentDayNumber) return d;
        const newActs = Array.isArray(d.activities) ? [...d.activities] : [];
        if (newActs[idx]) {
          const actObj =
            typeof newActs[idx] === 'string'
              ? { title: newActs[idx], name: newActs[idx] }
              : { ...newActs[idx] };
          actObj.done = nextDone;
          newActs[idx] = actObj;
        }
        return { ...d, activities: newActs };
      });
      return {
        ...prevTrip,
        days: updatedDays,
        itinerary: updatedDays,
      };
    });

    try {
      const res = await apiClient(`/itinerary/${itineraryId}/activities/done`, {
        method: 'PATCH',
        body: JSON.stringify({
          dayNumber: currentDayNumber,
          index: idx,
          expectedTitle: title,
          done: nextDone,
        }),
      });

      if (res.status === 409) {
        setTrip(previousTrip);
        setActivityErrorMessage('This activity changed. Please refresh.');
        loadData(true);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || 'Could not update activity. Please try again.';
        setTrip(previousTrip);
        setActivityErrorMessage(errMsg);
        return;
      }

      const updatedDay = await res.json().catch(() => null);
      if (updatedDay && Array.isArray(updatedDay.activities)) {
        setTrip((prevTrip) => {
          if (!prevTrip) return prevTrip;
          const days = Array.isArray(prevTrip.days)
            ? prevTrip.days
            : Array.isArray(prevTrip.itinerary)
            ? prevTrip.itinerary
            : [];
          const updatedDays = days.map((d) =>
            d.dayNumber === currentDayNumber ? updatedDay : d
          );
          return {
            ...prevTrip,
            days: updatedDays,
            itinerary: updatedDays,
          };
        });
      }
    } catch (err) {
      console.error('Toggle activity error:', err);
      setTrip(previousTrip);
      setActivityErrorMessage('Network error while updating activity.');
    } finally {
      setTogglingActivityIndex(null);
    }
  };

  const handleOpenRescheduleSheet = () => {
    setRescheduleError('');
    setRescheduleProposal(null);
    setConfirmAllSkip(false);
    setSelectedDelayMinutes(30);
    setIsRescheduleSheetVisible(true);
  };

  const handleFetchRescheduleProposal = async () => {
    setRescheduleLoading(true);
    setRescheduleError('');
    setConfirmAllSkip(false);
    try {
      const res = await apiClient(`/itinerary/${itineraryId}/reschedule/preview`, {
        method: 'POST',
        body: JSON.stringify({
          dayNumber: currentDayNumber,
          delayMinutes: selectedDelayMinutes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setRescheduleError(
          errData?.error || 'Could not generate rescheduling proposal. Please try again.'
        );
        return;
      }

      const proposalData = await res.json();
      setRescheduleProposal(proposalData);
    } catch (err) {
      console.error('Fetch reschedule proposal error:', err);
      setRescheduleError('Network error while requesting suggestions.');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleApplyReschedule = async () => {
    if (!rescheduleProposal || !Array.isArray(rescheduleProposal.items)) return;

    // Check if every remaining activity is proposed to be dropped/skipped
    const allDropped =
      rescheduleProposal.items.length > 0 &&
      rescheduleProposal.items.every((it) => it.action === 'drop');

    if (allDropped && !confirmAllSkip) {
      setConfirmAllSkip(true);
      return;
    }

    setRescheduleApplying(true);
    setRescheduleError('');

    try {
      const res = await apiClient(`/itinerary/${itineraryId}/reschedule/apply`, {
        method: 'POST',
        body: JSON.stringify({
          dayNumber: currentDayNumber,
          items: rescheduleProposal.items,
        }),
      });

      if (res.status === 409) {
        setIsRescheduleSheetVisible(false);
        setRescheduleProposal(null);
        setActivityErrorMessage('Your day changed. Please try again.');
        loadData(true);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setRescheduleError(errData?.error || 'Could not apply schedule changes.');
        return;
      }

      const resData = await res.json();
      setIsRescheduleSheetVisible(false);
      setRescheduleProposal(null);
      setConfirmAllSkip(false);
      if (resData?.editId) {
        setDayUpdatedBar({ visible: true, editId: resData.editId });
      }
      loadData(true);
    } catch (err) {
      console.error('Apply reschedule error:', err);
      setRescheduleError('Network error while applying changes.');
    } finally {
      setRescheduleApplying(false);
    }
  };

  const handleUndoReschedule = async () => {
    if (!dayUpdatedBar?.editId) return;
    setUndoLoading(true);
    try {
      const res = await apiClient(`/itinerary/${itineraryId}/undo`, {
        method: 'POST',
        body: JSON.stringify({ expectedEditId: dayUpdatedBar.editId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setActivityErrorMessage(errData?.error || 'Could not undo changes.');
      } else {
        setDayUpdatedBar(null);
        loadData(true);
      }
    } catch (err) {
      console.error('Undo reschedule error:', err);
      setActivityErrorMessage('Network error while undoing changes.');
    } finally {
      setUndoLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Universal ScreenHeader matching dark theme */}
      <ScreenHeader
        title="Today's Plan 📍"
        subtitle={trip?.destination ? `${trip.destination} • Live trip dashboard` : 'Today’s schedule & status'}
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
            onRefresh={() => loadData(true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => loadData(false)} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Day Updated Bar with Undo Button */}
        {dayUpdatedBar?.visible ? (
          <View style={styles.dayUpdatedBar}>
            <View style={styles.dayUpdatedLeft}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.dayUpdatedText}>Day updated</Text>
            </View>
            <View style={styles.dayUpdatedRight}>
              <TouchableOpacity
                style={styles.dayUpdatedUndoBtn}
                onPress={handleUndoReschedule}
                disabled={undoLoading}
                activeOpacity={0.7}
                accessibilityLabel="Undo schedule update"
              >
                {undoLoading ? (
                  <ActivityIndicator size="small" color={colors.accentPrimary} />
                ) : (
                  <Text style={styles.dayUpdatedUndoText}>Undo</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dayUpdatedDismissBtn}
                onPress={() => setDayUpdatedBar(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Dismiss notice"
              >
                <Text style={styles.dayUpdatedDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Loading Indicator */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Syncing today's itinerary…</Text>
          </View>
        ) : (
          <>
            {/* RAIN HEADS-UP ALERT CARD */}
            {rainAlert && Array.isArray(rainAlert.flagged) && rainAlert.flagged.length > 0 && !dismissedRainAlert ? (
              <View style={styles.rainAlertCard}>
                <View style={styles.rainAlertHeaderRow}>
                  <View style={styles.rainAlertTitleGroup}>
                    <Ionicons name="rainy" size={18} color={colors.accentPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.rainAlertHeaderTitle}>Rain Heads-Up</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.rainAlertDismissBtn}
                    onPress={() => setDismissedRainAlert(true)}
                    activeOpacity={0.7}
                    accessibilityLabel="Dismiss rain heads-up"
                  >
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.rainAlertMessageText}>
                  {(() => {
                    const rainBucketsText = (rainAlert.rain || [])
                      .map((r) => {
                        const b = (r.bucket || '').toLowerCase();
                        const bLabel = b === 'night' ? 'tonight' : `this ${b}`;
                        return `${bLabel} (about ${r.probabilityPercent}%)`;
                      })
                      .join(' and ');
                    const affectedTitles = rainAlert.flagged.map((f) => f.title).join(', ');
                    return `Rain likely ${rainBucketsText || 'today'}. Your plans that may be affected: ${affectedTitles}.`;
                  })()}
                </Text>

                <TouchableOpacity
                  style={styles.askAiAdjustBtn}
                  onPress={() => {
                    const firstBucket = rainAlert.rain?.[0]?.bucket?.toLowerCase() || 'today';
                    const bucketPhrase = firstBucket === 'night' ? 'tonight' : `this ${firstBucket}`;
                    const destinationName = trip?.destination || 'your destination';
                    const initialMsg = `Rain is likely ${bucketPhrase} in ${destinationName}. Please adjust today's outdoor plans, and only change activities that haven't happened yet.`;
                    navigation.navigate('ChatScreen', {
                      itineraryId,
                      initialMessage: initialMsg,
                    });
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel="Ask AI to adjust today's outdoor plans"
                >
                  <Ionicons name="sparkles" size={14} color="#131B2E" style={{ marginRight: 6 }} />
                  <Text style={styles.askAiAdjustBtnText}>Ask AI to adjust</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* TRIP TIMELINE STATUS BANNER */}
            {tripState === 'not_started' ? (
              <View style={styles.statusNoticeCard}>
                <View style={styles.statusNoticeIconCircle}>
                  <Text style={styles.statusNoticeIcon}>⏳</Text>
                </View>
                <View style={styles.statusNoticeTextCol}>
                  <Text style={styles.statusNoticeTitle}>This trip hasn’t started yet</Text>
                  <Text style={styles.statusNoticeSubtitle}>
                    Starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'} on {formatDateDisplay(startMidnight)}. Your daily schedule will activate on Day 1!
                  </Text>
                </View>
              </View>
            ) : tripState === 'ended' ? (
              <View style={styles.statusNoticeCard}>
                <View style={styles.statusNoticeIconCircle}>
                  <Text style={styles.statusNoticeIcon}>🏁</Text>
                </View>
                <View style={styles.statusNoticeTextCol}>
                  <Text style={styles.statusNoticeTitle}>This trip has ended</Text>
                  <Text style={styles.statusNoticeSubtitle}>
                    Completed on {formatDateDisplay(endMidnight)}. We hope you had a fantastic journey exploring {trip?.destination || 'your destination'}!
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.todayBannerCard}>
                <View style={styles.todayBannerTopRow}>
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>TODAY • DAY {currentDayNumber}</Text>
                  </View>
                  <Text style={styles.todayDayCountText}>
                    Day {currentDayNumber} of {totalTripDays}
                  </Text>
                </View>
                <Text style={styles.todayDestinationTitle}>
                  {trip?.destination || 'Your Trip'} 🌴
                </Text>
                <Text style={styles.todayDateText}>
                  📅 {formatDateDisplay(todayMidnight)}
                </Text>
              </View>
            )}

            {/* WEATHER CARD */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeaderTitle}>Today's Weather ☀️</Text>
              <View style={styles.weatherCard}>
                {weatherLoading ? (
                  <View style={styles.weatherLoadingRow}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                    <Text style={styles.weatherLoadingText}>Checking live weather forecast…</Text>
                  </View>
                ) : weather ? (
                  <View style={styles.weatherContentRow}>
                    <View style={styles.weatherLeftCol}>
                      <Text style={styles.weatherTempText}>
                        {weather.temperature && weather.temperature !== 'N/A'
                          ? `${weather.temperature}°C`
                          : weather.temp_max != null
                          ? `${Math.round(weather.temp_max)}°C`
                          : 'Pleasant'}
                      </Text>
                      <Text style={styles.weatherConditionText}>
                        {weather.description || weather.condition || 'Typical seasonal weather'}
                      </Text>
                    </View>
                    <View style={styles.weatherRightCol}>
                      <Text style={styles.weatherCityText}>{trip?.destination || 'Destination'}</Text>
                      {weather.temp_min != null && weather.temp_max != null ? (
                        <Text style={styles.weatherMinMaxText}>
                          L: {Math.round(weather.temp_min)}° • H: {Math.round(weather.temp_max)}°
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.weatherFallbackText}>
                    Seasonal weather for {trip?.destination || 'destination'}. Pack according to local conditions.
                  </Text>
                )}
              </View>
            </View>

            {/* TODAY'S ACTIVITIES (ACTIVE TRIP ONLY) */}
            {tripState === 'active' ? (
              <View style={styles.sectionBlock}>
                <View style={styles.activitiesSectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Planned Activities</Text>
                  {notDoneActivitiesCount > 0 ? (
                    <TouchableOpacity
                      style={styles.runningLateBtn}
                      onPress={handleOpenRescheduleSheet}
                      activeOpacity={0.7}
                      accessibilityLabel="Running late? Open rescheduling suggestions"
                    >
                      <Ionicons name="time-outline" size={14} color={colors.accentPrimary} />
                      <Text style={styles.runningLateBtnText}>Running late?</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {todayDayPlan && Array.isArray(todayDayPlan.activities) && todayDayPlan.activities.length > 0 ? (
                  <View style={styles.dayActivitiesCard}>
                    <View style={styles.activitiesHeaderRow}>
                      <Text style={styles.activitiesHeaderDay}>Day {currentDayNumber} Schedule</Text>
                      <View style={styles.activitiesHeaderRight}>
                        <Text style={styles.activitiesDoneBadge}>
                          {doneActivitiesCount} of {totalActivitiesCount} done
                        </Text>
                        {todayDayPlan.estimatedCostINR ? (
                          <Text style={styles.activitiesCostBadge}>
                            Est: ₹{todayDayPlan.estimatedCostINR}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {activityErrorMessage ? (
                      <View style={styles.activityInlineError}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={15}
                          color={colors.accentUrgent || '#EF4444'}
                        />
                        <Text style={styles.activityInlineErrorText}>{activityErrorMessage}</Text>
                        <TouchableOpacity
                          onPress={() => setActivityErrorMessage('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.activityInlineErrorDismiss}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <View style={styles.activitiesList}>
                      {todayDayPlan.activities.map((activity, idx) => {
                        const isString = typeof activity === 'string';
                        const name = isString ? activity : (activity?.name || activity?.title || '');
                        const title = isString ? activity : (activity?.title || activity?.name || '');
                        const description = isString ? '' : (activity?.description || '');
                        const suggestedTime = isString ? null : activity?.suggestedTime;
                        const location = isString ? null : activity?.location;
                        const isDone = !isString && activity?.done === true;
                        const isUpNext = idx === firstNotDoneActivityIndex;
                        const isToggling = togglingActivityIndex === idx;
                        const hasLocation = !!(
                          location &&
                          (location.lat != null || location.latitude != null) &&
                          (location.lon != null || location.longitude != null)
                        );

                        // Check next activity for consecutive distance
                        const nextActivity =
                          idx < todayDayPlan.activities.length - 1
                            ? todayDayPlan.activities[idx + 1]
                            : null;
                        const nextLocation =
                          nextActivity && typeof nextActivity !== 'string'
                            ? nextActivity.location
                            : null;
                        const nextHasLocation = !!(
                          nextLocation &&
                          (nextLocation.lat != null || nextLocation.latitude != null) &&
                          (nextLocation.lon != null || nextLocation.longitude != null)
                        );

                        const distanceKm =
                          hasLocation && nextHasLocation
                            ? calculateDistanceKm(location, nextLocation)
                            : null;
                        const distanceLabel =
                          distanceKm != null
                            ? `~${distanceKm < 0.1 ? '< 0.1' : distanceKm.toFixed(1)} km (straight-line)`
                            : null;

                        return (
                          <React.Fragment key={`act-${idx}`}>
                            <View
                              style={[
                                styles.activityItemRow,
                                isDone && styles.activityItemRowDone,
                              ]}
                            >
                              {/* Round check control (touch target >= 44x44) */}
                              <TouchableOpacity
                                style={styles.activityCheckControl}
                                onPress={() => handleToggleActivityDone(idx, activity)}
                                activeOpacity={0.7}
                                accessibilityLabel={isDone ? `Mark ${name} as not done` : `Mark ${name} as done`}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isDone }}
                                disabled={isToggling}
                              >
                                <Ionicons
                                  name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={24}
                                  color={isDone ? (colors.accentSecondary || '#2F6E68') : (colors.textMuted || '#94A3B8')}
                                />
                              </TouchableOpacity>

                              <View style={{ flex: 1 }}>
                                <View style={styles.activityTitleRow}>
                                  {isUpNext ? (
                                    <View style={styles.upNextBadge}>
                                      <Text style={styles.upNextBadgeText}>Up next</Text>
                                    </View>
                                  ) : null}
                                  {suggestedTime ? (
                                    <View style={[styles.timeBadge, isDone && styles.timeBadgeDone]}>
                                      <Text
                                        style={[
                                          styles.timeBadgeText,
                                          isDone && styles.timeBadgeTextDone,
                                        ]}
                                      >
                                        {suggestedTime}
                                      </Text>
                                    </View>
                                  ) : null}
                                  <Text
                                    style={[
                                      styles.activityNameText,
                                      isDone && styles.activityNameTextDone,
                                    ]}
                                  >
                                    {name}
                                  </Text>
                                </View>
                                {description && description !== name ? (
                                  <Text
                                    style={[
                                      styles.activityDescriptionText,
                                      isDone && styles.activityDescriptionTextDone,
                                    ]}
                                  >
                                    {description}
                                  </Text>
                                ) : null}
                                {hasLocation ? (
                                  <TouchableOpacity
                                    style={styles.directionsBtn}
                                    onPress={() => openDirections(location)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.directionsIcon}>📍</Text>
                                    <Text style={styles.directionsBtnText}>Get directions</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>

                            {distanceLabel ? (
                              <View style={styles.distanceConnectorRow}>
                                <View style={styles.distanceLine} />
                                <View style={styles.distanceBadge}>
                                  <Text style={styles.distanceBadgeText}>{distanceLabel}</Text>
                                </View>
                                <View style={styles.distanceLine} />
                              </View>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </View>

                    {todayDayPlan.accommodationSuggestion ? (
                      <View style={styles.staySuggestionBox}>
                        <Ionicons name="bed-outline" size={16} color={colors.accentPrimary} />
                        <Text style={styles.staySuggestionText}>
                          Recommended Stay: {todayDayPlan.accommodationSuggestion}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.emptyDayCard}>
                    <Text style={styles.emptyDayText}>
                      No specific sights scheduled for today. Enjoy free exploration or ask AI for spontaneous spots!
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* LINKED FLIGHT BOOKING & STATUS SECTION */}
            {bookings.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeaderTitle}>Linked Flights ✈️</Text>
                {bookings.map((booking, bIdx) => {
                  const bId = booking._id || booking.bookingId;
                  const override = statusOverrides[bId];
                  const currentStatus = override?.status || booking.status || 'confirmed';
                  const departureDisplay = override?.departureTime || booking.departureTime;
                  const isChecking = checkingStatusId === bId;

                  return (
                    <View key={`b-${bIdx}`} style={styles.flightCard}>
                      <View style={styles.flightCardTopRow}>
                        <View style={styles.flightRouteCol}>
                          <Text style={styles.flightRouteText}>
                            {booking.origin && booking.destination
                              ? `${booking.origin} ✈️ ${booking.destination}`
                              : booking.route || 'Flight Journey'}
                          </Text>
                          <Text style={styles.flightAirlineText}>
                            {booking.airline || 'Commercial Airline'} • Ref: {booking.bookingReference || 'N/A'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.flightStatusBadge,
                            currentStatus.toLowerCase() === 'confirmed'
                              ? styles.flightStatusConfirmed
                              : currentStatus.toLowerCase() === 'cancelled'
                              ? styles.flightStatusCancelled
                              : styles.flightStatusOther,
                          ]}
                        >
                          <Text style={styles.flightStatusBadgeText}>
                            {currentStatus.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.flightDetailsRow}>
                        <View style={styles.flightTimeBox}>
                          <Text style={styles.flightTimeLabel}>Departure Time</Text>
                          <Text style={styles.flightTimeValue}>
                            {formatFlightTime(departureDisplay)}
                          </Text>
                        </View>

                        {/* Check Status Button (Pull on tap only - no polling) */}
                        <TouchableOpacity
                          style={[
                            styles.checkStatusBtn,
                            isChecking ? styles.checkStatusBtnDisabled : null,
                          ]}
                          onPress={() => handleCheckFlightStatus(bId)}
                          disabled={isChecking}
                          activeOpacity={0.8}
                        >
                          {isChecking ? (
                            <ActivityIndicator size="small" color="#000000" style={{ marginRight: 6 }} />
                          ) : (
                            <Ionicons name="refresh" size={14} color="#000000" style={{ marginRight: 4 }} />
                          )}
                          <Text style={styles.checkStatusBtnText}>
                            {isChecking ? 'Checking…' : 'Check status'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {override?.checkedAt ? (
                        <Text style={styles.statusCheckedNotice}>
                          ✓ Verified with Duffel at {override.checkedAt.toLocaleTimeString()}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* RUNNING LATE RESCHEDULE SHEET MODAL */}
      <Modal
        visible={isRescheduleSheetVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!rescheduleApplying) setIsRescheduleSheetVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rescheduleModalCard}>
            {/* Sheet Header */}
            <View style={styles.rescheduleHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rescheduleModalTitle}>Running Late? ⏱️</Text>
                <Text style={styles.rescheduleModalSubtitle}>
                  {rescheduleProposal
                    ? 'Review suggested changes below'
                    : 'Select how much time you need. AI will suggest adjustments.'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.rescheduleCloseBtn}
                onPress={() => setIsRescheduleSheetVisible(false)}
                activeOpacity={0.7}
                disabled={rescheduleApplying}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Inline Error in Sheet */}
            {rescheduleError ? (
              <View style={styles.rescheduleInlineError}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.accentUrgent || '#EF4444'} />
                <Text style={styles.rescheduleInlineErrorText}>{rescheduleError}</Text>
              </View>
            ) : null}

            {!rescheduleProposal ? (
              // Step 1: Delay Picker
              <View style={styles.delayPickerContainer}>
                <Text style={styles.delayPickerLabel}>How late are you running?</Text>
                <View style={styles.delayButtonsRow}>
                  {[
                    { minutes: 30, label: '30 min' },
                    { minutes: 60, label: '1 hour' },
                    { minutes: 120, label: '2 hours' },
                    { minutes: 180, label: '3 hours' },
                  ].map((opt) => {
                    const isSelected = selectedDelayMinutes === opt.minutes;
                    return (
                      <TouchableOpacity
                        key={`delay-${opt.minutes}`}
                        style={[
                          styles.delayOptionBtn,
                          isSelected && styles.delayOptionBtnSelected,
                        ]}
                        onPress={() => setSelectedDelayMinutes(opt.minutes)}
                        activeOpacity={0.7}
                        disabled={rescheduleLoading}
                      >
                        <Text
                          style={[
                            styles.delayOptionText,
                            isSelected && styles.delayOptionTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {rescheduleLoading ? (
                  <View style={styles.rescheduleLoadingBox}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                    <Text style={styles.rescheduleLoadingText}>Thinking through your day...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.seeSuggestionsBtn}
                    onPress={handleFetchRescheduleProposal}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sparkles" size={15} color="#131B2E" style={{ marginRight: 6 }} />
                    <Text style={styles.seeSuggestionsBtnText}>See suggestions</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Step 2: Proposal Preview
              <ScrollView
                style={styles.proposalScrollView}
                showsVerticalScrollIndicator={false}
              >
                {/* AI Summary */}
                <View style={styles.proposalSummaryBox}>
                  <Text style={styles.proposalSummaryText}>{rescheduleProposal.summary}</Text>
                </View>

                {/* Remaining Activities Items */}
                <View style={styles.proposalItemsList}>
                  {rescheduleProposal.items.map((item, idx) => {
                    const isKeep = item.action === 'keep';
                    const isMove = item.action === 'move';
                    const isDrop = item.action === 'drop';

                    return (
                      <View key={`prop-item-${idx}`} style={styles.proposalItemCard}>
                        <View style={styles.proposalItemHeaderRow}>
                          <Text
                            style={[
                              styles.proposalItemTitle,
                              isDrop && styles.proposalItemTitleDropped,
                            ]}
                            numberOfLines={2}
                          >
                            {item.title}
                          </Text>

                          {/* Status Chip (Icon + Text, never color alone) */}
                          {isKeep ? (
                            <View style={styles.chipKeep}>
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={13}
                                color={colors.accentSecondary || '#2F6E68'}
                              />
                              <Text style={styles.chipKeepText}>Keep</Text>
                            </View>
                          ) : isMove ? (
                            <View style={styles.chipMove}>
                              <Ionicons
                                name="arrow-forward-outline"
                                size={13}
                                color={colors.accentPrimary || '#E8A33D'}
                              />
                              <Text style={styles.chipMoveText}>
                                {item.currentBucket} → {item.newBucket}
                              </Text>
                            </View>
                          ) : isDrop ? (
                            <View style={styles.chipDrop}>
                              <Ionicons
                                name="close-circle-outline"
                                size={13}
                                color={colors.accentUrgent || '#EF4444'}
                              />
                              <Text style={styles.chipDropText}>Skip</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Plain Words Reason */}
                        {item.reason ? (
                          <Text style={styles.proposalItemReason}>{item.reason}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Disclaimer Line */}
                <Text style={styles.rescheduleDisclaimer}>
                  Based on time of day only. We don't know how long each activity takes.
                </Text>

                {/* Extra confirmation warning if proposal skips all remaining */}
                {confirmAllSkip ? (
                  <View style={styles.confirmSkipWarningBox}>
                    <Ionicons name="warning-outline" size={16} color={colors.accentUrgent || '#EF4444'} />
                    <Text style={styles.confirmSkipWarningText}>
                      This proposal skips every remaining activity for today. Are you sure you want to proceed?
                    </Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                {rescheduleProposal.items.length > 0 &&
                rescheduleProposal.items.every((it) => it.action === 'keep') ? (
                  <View style={styles.allKeepContainer}>
                    <Text style={styles.allKeepNotice}>Your plan still looks fine</Text>
                    <TouchableOpacity
                      style={styles.sheetCloseOnlyBtn}
                      onPress={() => setIsRescheduleSheetVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sheetCloseOnlyBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.proposalActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.proposalCancelBtn}
                      onPress={() => setIsRescheduleSheetVisible(false)}
                      activeOpacity={0.7}
                      disabled={rescheduleApplying}
                    >
                      <Text style={styles.proposalCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.proposalApplyBtn,
                        rescheduleApplying && { opacity: 0.7 },
                      ]}
                      onPress={handleApplyReschedule}
                      activeOpacity={0.8}
                      disabled={rescheduleApplying}
                    >
                      {rescheduleApplying ? (
                        <ActivityIndicator size="small" color="#131B2E" />
                      ) : (
                        <Text style={styles.proposalApplyBtnText}>
                          {confirmAllSkip ? 'Confirm & Apply' : 'Apply changes'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Change delay button */}
                <TouchableOpacity
                  style={styles.changeDelayBtn}
                  onPress={() => {
                    setRescheduleProposal(null);
                    setConfirmAllSkip(false);
                  }}
                  activeOpacity={0.7}
                  disabled={rescheduleApplying}
                >
                  <Text style={styles.changeDelayBtnText}>← Change delay duration</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Status Notice Cards (Not Started / Ended)
  statusNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusNoticeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusNoticeIcon: {
    fontSize: 22,
  },
  statusNoticeTextCol: {
    flex: 1,
  },
  statusNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statusNoticeSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 18,
  },
  // Today Active Banner Card
  todayBannerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 163, 61, 0.4)',
  },
  todayBannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayBadge: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.mono,
    color: '#000000',
    letterSpacing: 0.5,
  },
  todayDayCountText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.mono,
    color: colors.textMuted,
  },
  todayDestinationTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  todayDateText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  // Section Headers
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  // Weather Card
  weatherCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weatherLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weatherLoadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
  weatherContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherLeftCol: {
    flex: 1,
  },
  weatherTempText: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.display,
    color: colors.accentPrimary,
    marginBottom: 2,
  },
  weatherConditionText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  weatherRightCol: {
    alignItems: 'flex-end',
  },
  weatherCityText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  weatherMinMaxText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textMuted,
  },
  weatherFallbackText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
  // Day Activities Card
  dayActivitiesCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activitiesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 243, 234, 0.08)',
    marginBottom: 12,
  },
  activitiesHeaderDay: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  activitiesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activitiesDoneBadge: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.mono,
    color: colors.textMuted,
    backgroundColor: 'rgba(247, 243, 234, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activitiesCostBadge: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.mono,
    color: colors.accentSecondary || '#2F6E68',
  },
  activityInlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6,
  },
  activityInlineErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.accentUrgent || '#EF4444',
  },
  activityInlineErrorDismiss: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentUrgent || '#EF4444',
    paddingHorizontal: 4,
  },
  activitiesList: {
    gap: 10,
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(247, 243, 234, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
  },
  activityItemRowDone: {
    opacity: 0.65,
    backgroundColor: 'rgba(247, 243, 234, 0.015)',
  },
  activityCheckControl: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    marginRight: 4,
    marginTop: -8,
  },
  upNextBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.4)',
  },
  upNextBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
    marginTop: 6,
    marginRight: 10,
  },
  activityItemText: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
  },
  timeBadgeDone: {
    opacity: 0.6,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.mono,
    color: colors.accentPrimary,
  },
  timeBadgeTextDone: {
    color: colors.textMuted,
  },
  activityNameText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
    lineHeight: 20,
  },
  activityNameTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  activityDescriptionText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  activityDescriptionTextDone: {
    color: colors.textMuted,
    opacity: 0.8,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(232, 163, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.2)',
    gap: 4,
  },
  directionsIcon: {
    fontSize: 11,
  },
  directionsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  distanceConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginLeft: 16,
    marginRight: 10,
    gap: 8,
  },
  distanceLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.12)',
  },
  distanceBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  distanceBadgeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textMuted,
    fontWeight: '500',
  },
  staySuggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 243, 234, 0.04)',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
  },
  staySuggestionText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    flex: 1,
  },
  emptyDayCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyDayText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
    lineHeight: 18,
  },
  // Flight Cards
  flightCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flightCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  flightRouteCol: {
    flex: 1,
    marginRight: 10,
  },
  flightRouteText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  flightAirlineText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  flightStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flightStatusConfirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  flightStatusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  flightStatusOther: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
  },
  flightStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.mono,
    color: colors.textPrimary,
  },
  flightDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
  },
  flightTimeBox: {
    flex: 1,
  },
  flightTimeLabel: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginBottom: 2,
  },
  flightTimeValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.mono,
    color: colors.textPrimary,
  },
  checkStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  checkStatusBtnDisabled: {
    opacity: 0.6,
  },
  checkStatusBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  statusCheckedNotice: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: '#10b981',
    marginTop: 8,
  },
  /* RAIN HEADS-UP ALERT CARD */
  rainAlertCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.4)',
    marginBottom: 16,
  },
  rainAlertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rainAlertTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rainAlertHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rainAlertDismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rainAlertMessageText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  askAiAdjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  askAiAdjustBtnText: {
    color: '#131B2E',
    fontSize: 13,
    fontWeight: '700',
  },

  /* DAY UPDATED BAR */
  dayUpdatedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  dayUpdatedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayUpdatedText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#10b981',
  },
  dayUpdatedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayUpdatedUndoBtn: {
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.4)',
  },
  dayUpdatedUndoText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  dayUpdatedDismissBtn: {
    padding: 4,
  },
  dayUpdatedDismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },

  /* ACTIVITIES SECTION HEADER ROW & RUNNING LATE BTN */
  activitiesSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  runningLateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  runningLateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },

  /* RESCHEDULE MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
    justifyContent: 'flex-end',
  },
  rescheduleModalCard: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  rescheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  rescheduleModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  rescheduleModalSubtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  rescheduleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescheduleInlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
    gap: 8,
  },
  rescheduleInlineErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.accentUrgent || '#EF4444',
  },

  /* DELAY PICKER */
  delayPickerContainer: {
    paddingVertical: 10,
  },
  delayPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  delayButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  delayOptionBtn: {
    flex: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayOptionBtnSelected: {
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    borderColor: colors.accentPrimary,
  },
  delayOptionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  delayOptionTextSelected: {
    color: colors.accentPrimary,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  rescheduleLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  rescheduleLoadingText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  seeSuggestionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  seeSuggestionsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#131B2E',
  },

  /* PROPOSAL PREVIEW */
  proposalScrollView: {
    marginTop: 6,
  },
  proposalSummaryBox: {
    backgroundColor: 'rgba(247, 243, 234, 0.04)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
    marginBottom: 14,
  },
  proposalSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  proposalItemsList: {
    gap: 10,
    marginBottom: 14,
  },
  proposalItemCard: {
    backgroundColor: 'rgba(247, 243, 234, 0.03)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
  },
  proposalItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  proposalItemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  proposalItemTitleDropped: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  chipKeep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(47, 110, 104, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(47, 110, 104, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipKeepText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentSecondary || '#2F6E68',
  },
  chipMove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipMoveText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary || '#E8A33D',
  },
  chipDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipDropText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentUrgent || '#EF4444',
  },
  proposalItemReason: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  rescheduleDisclaimer: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 14,
    fontStyle: 'italic',
  },
  confirmSkipWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  confirmSkipWarningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.accentUrgent || '#EF4444',
  },
  allKeepContainer: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  allKeepNotice: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#10b981',
  },
  sheetCloseOnlyBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  sheetCloseOnlyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#131B2E',
  },
  proposalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  proposalCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  proposalApplyBtn: {
    flex: 1.5,
    backgroundColor: colors.accentPrimary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalApplyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#131B2E',
  },
  changeDelayBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  changeDelayBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
});
