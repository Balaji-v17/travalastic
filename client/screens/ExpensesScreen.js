import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

const CATEGORIES = [
  { id: 'Food', label: 'Food', icon: '🍲' },
  { id: 'Transport', label: 'Transport', icon: '🚕' },
  { id: 'Accommodation', label: 'Accommodation', icon: '🏨' },
  { id: 'Activities', label: 'Activities', icon: '🏄‍♂️' },
  { id: 'Shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'Other', label: 'Other', icon: '📦' },
];

const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'THB',
  'SGD', 'MYR', 'IDR', 'KRW', 'CNY',
  'AUD', 'CAD', 'CHF', 'AED', 'SAR',
  'VND', 'LKR', 'NPR',
];

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  THB: '฿',
  SGD: 'S$',
  MYR: 'RM',
  IDR: 'Rp',
  KRW: '₩',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  AED: 'AED ',
  SAR: 'SAR ',
  VND: '₫',
  LKR: 'Rs ',
  NPR: 'Rs ',
};

let sessionLastForeignCurrency = null;

export default function ExpensesScreen({ route, navigation }) {
  const {
    itineraryId,
    budgetEstimate: initialBudgetEstimate,
    destination: initialDestination,
  } = route.params || {};

  const [expenses, setExpenses] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [travelers, setTravelers] = useState([]);
  const [totals, setTotals] = useState({ groupTotalPaise: 0, yourSharePaise: 0 });
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);

  const [budgetEstimate, setBudgetEstimate] = useState(
    Number(initialBudgetEstimate) || 0
  );
  const [destination, setDestination] = useState(initialDestination || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Add Expense Modal state
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [paidBy, setPaidBy] = useState('me');
  const [isSplitOn, setIsSplitOn] = useState(false);
  const [splitAmong, setSplitAmong] = useState(['me']);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Foreign currency & FX state
  const [selectedCurrency, setSelectedCurrency] = useState(
    sessionLastForeignCurrency || 'INR'
  );
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [customCurrencyInput, setCustomCurrencyInput] = useState('');
  const [customCurrencyError, setCustomCurrencyError] = useState('');

  const [fxRateInput, setFxRateInput] = useState('');
  const [originalEcbRate, setOriginalEcbRate] = useState(null);
  const [fxRateDate, setFxRateDate] = useState(null);
  const [fxRateSource, setFxRateSource] = useState(null);
  const [fxRateMessage, setFxRateMessage] = useState('');
  const [fxRateLoading, setFxRateLoading] = useState(false);

  // Manage Travelers Modal state
  const [isTravelersModalVisible, setIsTravelersModalVisible] = useState(false);
  const [newTravelerName, setNewTravelerName] = useState('');
  const [travelerModalError, setTravelerModalError] = useState('');
  const [travelerActionLoading, setTravelerActionLoading] = useState(false);
  const [editingTravelerId, setEditingTravelerId] = useState(null);
  const [editingTravelerName, setEditingTravelerName] = useState('');

  /**
   * Helper to derive budget estimate if not directly set
   */
  const computeFallbackBudget = (tripData) => {
    if (!tripData) return 0;
    if (typeof tripData.budgetEstimate === 'number' && tripData.budgetEstimate > 0) {
      return tripData.budgetEstimate;
    }
    const days = tripData.days || tripData.itinerary || [];
    if (Array.isArray(days) && days.length > 0) {
      const sum = days.reduce((acc, d) => acc + (Number(d.estimatedCostINR) || 0), 0);
      if (sum > 0) return sum;
      const tier = (tripData.budgetTier || 'mid').toLowerCase();
      const dailyRates = { budget: 1500, mid: 4000, luxury: 10000 };
      const rate = dailyRates[tier] || 4000;
      return days.length * rate;
    }
    return 0;
  };

  /**
   * Fetch expenses and trip data
   */
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!itineraryId) {
        setErrorMessage('No itinerary ID was provided.');
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage('');

      try {
        const expensesPromise = apiClient(`/itinerary/${itineraryId}/expenses`);
        const tripPromise = apiClient(`/itinerary/${itineraryId}`);

        const [expensesRes, tripRes] = await Promise.all([
          expensesPromise,
          tripPromise,
        ]);

        if (expensesRes.ok) {
          const expensesData = await expensesRes.json();
          if (expensesData && Array.isArray(expensesData.expenses)) {
            setExpenses(expensesData.expenses);
            setTotalSpent(Number(expensesData.totalSpent) || 0);
            setTravelers(expensesData.travelers || []);
            setTotals(expensesData.totals || { groupTotalPaise: 0, yourSharePaise: 0 });
            setBalances(expensesData.balances || {});
            setSettlements(expensesData.settlements || []);
          } else if (Array.isArray(expensesData)) {
            setExpenses(expensesData);
            const sum = expensesData.reduce(
              (acc, item) => acc + (Number(item.amountINR) || 0),
              0
            );
            setTotalSpent(sum);
          }
        } else {
          throw new Error(
            `Failed to load expenses (status ${expensesRes.status})`
          );
        }

        if (tripRes.ok) {
          const tripData = await tripRes.json();
          if (tripData?.destination && !destination) {
            setDestination(tripData.destination);
          }
          const computedBudget = computeFallbackBudget(tripData);
          if (computedBudget > 0) {
            setBudgetEstimate(computedBudget);
          }
          if (tripData?.travelers && (!expensesRes.ok || !travelers.length)) {
            setTravelers(tripData.travelers);
          }
        }
      } catch (err) {
        console.error('Failed to load expenses data:', err);
        setErrorMessage(
          'Could not load expenses. Please check your connection and try again.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [itineraryId, destination, travelers.length]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Helper to get participant display name
   */
  const getParticipantName = (id) => {
    if (id === 'me') return 'You';
    const found = travelers.find((t) => t._id === id || String(t._id) === String(id));
    return found ? found.name : 'Traveler';
  };

  /**
   * Fetch FX Rate for a currency from /fx/rate
   */
  const fetchRateForCurrency = async (code) => {
    if (!code || code === 'INR') {
      setFxRateInput('');
      setOriginalEcbRate(null);
      setFxRateDate(null);
      setFxRateSource(null);
      setFxRateMessage('');
      setFxRateLoading(false);
      return;
    }

    setFxRateLoading(true);
    setFxRateMessage('');

    try {
      const res = await apiClient.get(`/fx/rate?currency=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        const rateVal = String(data.inrPerUnit);
        setFxRateInput(rateVal);
        setOriginalEcbRate(rateVal);
        setFxRateDate(data.rateDate);
        setFxRateSource('ecb');
        setFxRateMessage('');
      } else if (res.status === 404) {
        setFxRateInput('');
        setOriginalEcbRate(null);
        setFxRateDate(new Date().toISOString().split('T')[0]);
        setFxRateSource('manual');
        setFxRateMessage(`No automatic rate for ${code}. Enter the rate you're using.`);
      } else {
        setFxRateInput('');
        setOriginalEcbRate(null);
        setFxRateDate(new Date().toISOString().split('T')[0]);
        setFxRateSource('manual');
        setFxRateMessage("Couldn't fetch the rate. Enter it manually.");
      }
    } catch (err) {
      setFxRateInput('');
      setOriginalEcbRate(null);
      setFxRateDate(new Date().toISOString().split('T')[0]);
      setFxRateSource('manual');
      setFxRateMessage("Couldn't fetch the rate. Enter it manually.");
    } finally {
      setFxRateLoading(false);
    }
  };

  /**
   * Currency Selection Handler
   */
  const handleSelectCurrency = (cur) => {
    const upper = cur.trim().toUpperCase();
    setSelectedCurrency(upper);
    if (upper !== 'INR') {
      sessionLastForeignCurrency = upper;
    }
    setIsCurrencyModalVisible(false);
    setCustomCurrencyInput('');
    setCustomCurrencyError('');
    fetchRateForCurrency(upper);
  };

  /**
   * Rate change handler: user edited the rate
   */
  const handleRateChange = (text) => {
    setFxRateInput(text);
    if (text !== originalEcbRate) {
      setFxRateSource('manual');
      setFxRateDate(new Date().toISOString().split('T')[0]);
      if (fxRateMessage && Number(text) > 0) {
        setFxRateMessage('');
      }
    }
  };

  /**
   * Open Add Expense Modal
   */
  const handleOpenAddModal = () => {
    setModalError('');
    setDescription('');
    setAmount('');
    setSelectedCategory('Food');
    setPaidBy('me');
    setIsSplitOn(false);
    setSplitAmong(['me', ...travelers.map((t) => t._id.toString())]);
    const initCur = sessionLastForeignCurrency || 'INR';
    setSelectedCurrency(initCur);
    if (initCur !== 'INR') {
      fetchRateForCurrency(initCur);
    } else {
      setFxRateInput('');
      setOriginalEcbRate(null);
      setFxRateDate(null);
      setFxRateSource(null);
      setFxRateMessage('');
    }
    setIsAddModalVisible(true);
  };

  /**
   * Handle Create Expense
   */
  const handleCreateExpense = async () => {
    if (!description.trim()) {
      setModalError('Please enter an expense description.');
      return;
    }

    const parsedAmount = Number(amount.replace(/,/g, '').trim());
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError(
        selectedCurrency === 'INR'
          ? 'Please enter a valid positive amount in ₹.'
          : `Please enter a valid positive amount in ${selectedCurrency}.`
      );
      return;
    }

    const isForeign = selectedCurrency !== 'INR';
    const parsedFxRate = Number(fxRateInput);

    if (isForeign) {
      if (isNaN(parsedFxRate) || parsedFxRate <= 0) {
        setModalError('Please enter a valid exchange rate greater than 0.');
        return;
      }
      if (parsedFxRate <= 0.000001 || parsedFxRate >= 1000000) {
        setModalError('Exchange rate must be between 0.000001 and 1,000,000.');
        return;
      }
    }

    if (!selectedCategory) {
      setModalError('Please select a category.');
      return;
    }

    if (isSplitOn && splitAmong.length === 0) {
      setModalError('Please select at least one traveler to split with.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        description: description.trim(),
        category: selectedCategory,
        paidBy: paidBy || 'me',
        splitAmong: isSplitOn ? splitAmong : [],
      };

      if (!isForeign) {
        payload.amountINR = parsedAmount;
        payload.originalCurrency = 'INR';
      } else {
        payload.originalAmount = parsedAmount;
        payload.originalCurrency = selectedCurrency;
        payload.fxRate = parsedFxRate;
        payload.fxRateDate = fxRateDate || new Date().toISOString().split('T')[0];
        payload.fxRateSource = fxRateSource || 'manual';
      }

      const res = await apiClient.post(`/itinerary/${itineraryId}/expenses`, payload);

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error || `Failed to create expense (status ${res.status})`
        );
      }

      if (isForeign) {
        sessionLastForeignCurrency = selectedCurrency;
      }

      await fetchData(true);
      setIsAddModalVisible(false);
    } catch (err) {
      console.error('Error creating expense:', err);
      setModalError(err.message || 'Failed to save expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle Delete Expense
   */
  const handleDeleteExpense = async (expenseId) => {
    setDeletingId(expenseId);
    try {
      const res = await apiClient.delete(`/expenses/${expenseId}`);
      if (!res.ok) {
        const fallbackRes = await apiClient.delete(
          `/itinerary/${itineraryId}/expenses/${expenseId}`
        );
        if (!fallbackRes.ok) {
          throw new Error('Failed to delete expense');
        }
      }

      await fetchData(true);
    } catch (err) {
      console.error('Error deleting expense:', err);
      const msg = err.message || 'Could not delete expense. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Prompt confirmation before deleting
   */
  const promptDeleteExpense = (item) => {
    const title = 'Delete Expense';
    const message = `Are you sure you want to remove "${item.description}" (₹${Number(
      item.amountINR
    ).toLocaleString('en-IN')})?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        handleDeleteExpense(item._id);
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteExpense(item._id),
        },
      ]);
    }
  };

  /**
   * Handle Add Traveler
   */
  const handleAddTraveler = async () => {
    const trimmed = newTravelerName.trim();
    if (!trimmed) {
      setTravelerModalError('Please enter a traveler name.');
      return;
    }
    if (trimmed.length > 30) {
      setTravelerModalError('Traveler name must be between 1 and 30 characters.');
      return;
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'me' || lower === 'you') {
      setTravelerModalError('Traveler name cannot be "me" or "you".');
      return;
    }
    if (travelers.length >= 10) {
      setTravelerModalError('Maximum of 10 travelers allowed per trip.');
      return;
    }
    if (travelers.some((t) => t.name.toLowerCase() === lower)) {
      setTravelerModalError('A traveler with this name already exists.');
      return;
    }

    setTravelerActionLoading(true);
    setTravelerModalError('');
    try {
      const res = await apiClient.post(`/itinerary/${itineraryId}/travelers`, {
        name: trimmed,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTravelerModalError(data?.error || 'Failed to add traveler.');
        return;
      }

      setNewTravelerName('');
      if (data?.travelers) {
        setTravelers(data.travelers);
      } else if (data?.traveler) {
        setTravelers((prev) => [...prev, data.traveler]);
      } else {
        await fetchData(true);
      }
    } catch (err) {
      setTravelerModalError(err.message || 'Error adding traveler.');
    } finally {
      setTravelerActionLoading(false);
    }
  };

  /**
   * Handle Save Renamed Traveler
   */
  const handleSaveRenameTraveler = async (travelerId) => {
    const trimmed = editingTravelerName.trim();
    if (!trimmed) {
      setTravelerModalError('Traveler name cannot be empty.');
      return;
    }
    if (trimmed.length > 30) {
      setTravelerModalError('Traveler name must be between 1 and 30 characters.');
      return;
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'me' || lower === 'you') {
      setTravelerModalError('Traveler name cannot be "me" or "you".');
      return;
    }
    if (
      travelers.some(
        (t) => t._id.toString() !== travelerId.toString() && t.name.toLowerCase() === lower
      )
    ) {
      setTravelerModalError('A traveler with this name already exists.');
      return;
    }

    setTravelerActionLoading(true);
    setTravelerModalError('');
    try {
      const res = await apiClient.patch(
        `/itinerary/${itineraryId}/travelers/${travelerId}`,
        { name: trimmed }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTravelerModalError(data?.error || 'Failed to rename traveler.');
        return;
      }

      if (data?.travelers) {
        setTravelers(data.travelers);
      } else {
        setTravelers((prev) =>
          prev.map((t) => (t._id.toString() === travelerId.toString() ? { ...t, name: trimmed } : t))
        );
      }
      setEditingTravelerId(null);
      setEditingTravelerName('');
    } catch (err) {
      setTravelerModalError(err.message || 'Error renaming traveler.');
    } finally {
      setTravelerActionLoading(false);
    }
  };

  /**
   * Handle Delete Traveler
   */
  const handleDeleteTraveler = async (travelerId) => {
    setTravelerActionLoading(true);
    setTravelerModalError('');
    try {
      const res = await apiClient.delete(
        `/itinerary/${itineraryId}/travelers/${travelerId}`
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTravelerModalError(
          data?.error || `Failed to delete traveler (status ${res.status})`
        );
        return;
      }

      if (data?.travelers) {
        setTravelers(data.travelers);
      } else {
        setTravelers((prev) => prev.filter((t) => t._id.toString() !== travelerId.toString()));
      }
      await fetchData(true);
    } catch (err) {
      setTravelerModalError(err.message || 'Error deleting traveler.');
    } finally {
      setTravelerActionLoading(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getCategoryIcon = (category) => {
    const match = CATEGORIES.find((c) => c.id === category);
    return match ? match.icon : '🏷️';
  };

  // Shared expenses check
  const hasSharedExpenses = expenses.some(
    (e) => Array.isArray(e.splitAmong) && e.splitAmong.length > 0
  );

  // Budget calculations
  const yourShareINR = totals?.yourSharePaise ? totals.yourSharePaise / 100 : totalSpent;
  const groupTotalINR = totals?.groupTotalPaise ? totals.groupTotalPaise / 100 : totalSpent;

  const hasBudget = budgetEstimate > 0;
  const isOverBudget = hasBudget && yourShareINR > budgetEstimate;
  const difference = Math.abs(budgetEstimate - yourShareINR);
  const spentRatio = hasBudget
    ? Math.min(Math.round((yourShareINR / budgetEstimate) * 100), 100)
    : 0;

  // Amount and live FX preview calculations for Add Expense modal
  const parsedModalAmount = Number(amount.replace(/,/g, '').trim()) || 0;
  const parsedModalRate = Number(fxRateInput) || 0;
  const isForeign = selectedCurrency !== 'INR';
  const liveConvertedInr =
    isForeign && parsedModalAmount > 0 && parsedModalRate > 0
      ? Math.round(parsedModalAmount * parsedModalRate * 100) / 100
      : null;

  const effectiveInrForSplit = isForeign ? (liveConvertedInr || 0) : parsedModalAmount;
  const splitCount = splitAmong.length;
  const approxEach =
    splitCount > 0 && effectiveInrForSplit > 0
      ? Math.round(effectiveInrForSplit / splitCount)
      : 0;

  const isRateValid =
    !isForeign ||
    (parsedModalRate > 0 &&
      Number.isFinite(parsedModalRate) &&
      parsedModalRate > 0.000001 &&
      parsedModalRate < 1000000);

  // All participants list for Settle Up section
  const allParticipants = [
    { id: 'me', name: 'You' },
    ...travelers.map((t) => ({ id: t._id.toString(), name: t.name })),
  ];

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title="Trip Expenses 💰"
        subtitle={
          destination
            ? `Spending tracking for ${destination}`
            : 'Track expenditures vs. estimated budget'
        }
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

      {/* Header Note: Totals are in INR */}
      <View style={styles.headerTotalsNoteRow}>
        <Ionicons name="information-circle-outline" size={13} color={colors.accentPrimary} />
        <Text style={styles.headerTotalsNoteText}>Totals are in INR.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
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
            <TouchableOpacity
              onPress={() => fetchData()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading expense records…</Text>
          </View>
        ) : (
          <>
            {/* BUDGET COMPARISON HEADER CARD */}
            <View
              style={[
                styles.budgetCard,
                isOverBudget ? styles.budgetCardOver : null,
              ]}
            >
              <View style={styles.budgetCardHeader}>
                <View style={styles.budgetCardBadge}>
                  <Text style={styles.budgetCardBadgeText}>BUDGET OVERVIEW</Text>
                </View>

                {/* Over / Remaining pill flag */}
                {hasBudget ? (
                  <View
                    style={[
                      styles.statusPill,
                      isOverBudget
                        ? styles.statusPillOver
                        : styles.statusPillUnder,
                    ]}
                  >
                    <Ionicons
                      name={isOverBudget ? 'alert-circle' : 'checkmark-circle'}
                      size={14}
                      color={isOverBudget ? '#ef4444' : '#10b981'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        isOverBudget
                          ? styles.statusPillTextOver
                          : styles.statusPillTextUnder,
                      ]}
                    >
                      {isOverBudget
                        ? `Over by ₹${Math.round(difference).toLocaleString('en-IN')}`
                        : `₹${Math.round(difference).toLocaleString('en-IN')} remaining`}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Your Share Big Display */}
              <View style={styles.spentAmountRow}>
                <View>
                  <Text style={styles.spentLabel}>Your share</Text>
                  <Text
                    style={[
                      styles.spentAmount,
                      isOverBudget ? styles.spentAmountOver : null,
                    ]}
                  >
                    ₹{Math.round(yourShareINR).toLocaleString('en-IN')}
                  </Text>
                  {/* Smaller Group Total line when shared expenses exist */}
                  {hasSharedExpenses ? (
                    <Text style={styles.groupTotalSubtext}>
                      Group total: ₹{Math.round(groupTotalINR).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>

                {hasBudget ? (
                  <View style={styles.budgetTargetCol}>
                    <Text style={styles.budgetTargetLabel}>Estimated Budget</Text>
                    <Text style={styles.budgetTargetValue}>
                      ₹{budgetEstimate.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Progress Bar */}
              {hasBudget ? (
                <View style={styles.progressBarWrapper}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        isOverBudget
                          ? styles.progressBarFillOver
                          : styles.progressBarFillNormal,
                        { width: `${isOverBudget ? 100 : spentRatio}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabelsRow}>
                    <Text
                      style={[
                        styles.progressPercentText,
                        isOverBudget ? styles.progressPercentTextOver : null,
                      ]}
                    >
                      {isOverBudget
                        ? `${Math.round((yourShareINR / budgetEstimate) * 100)}% of budget used`
                        : `${spentRatio}% of budget used`}
                    </Text>
                    <Text style={styles.progressSubtext}>
                      {isOverBudget
                        ? 'Exceeded budget target'
                        : `₹${Math.round(difference).toLocaleString('en-IN')} left`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* ACTION ROW: MANAGE TRAVELERS + ADD EXPENSE */}
            <View style={styles.actionRow}>
              <View>
                <Text style={styles.listSectionTitle}>Logged Expenses</Text>
                <Text style={styles.listSectionSubtitle}>
                  {expenses.length === 1
                    ? '1 entry logged'
                    : `${expenses.length} entries logged`}
                </Text>
              </View>

              <View style={styles.actionButtonsCluster}>
                <TouchableOpacity
                  style={styles.travelersBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setTravelerModalError('');
                    setEditingTravelerId(null);
                    setNewTravelerName('');
                    setIsTravelersModalVisible(true);
                  }}
                  accessibilityLabel="Manage travelers"
                >
                  <Ionicons name="people-outline" size={15} color={colors.textPrimary} />
                  <Text style={styles.travelersBtnText}>
                    Travelers{travelers.length > 0 ? ` (${travelers.length})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addExpenseBtn}
                  activeOpacity={0.85}
                  onPress={handleOpenAddModal}
                  accessibilityLabel="Add new expense"
                >
                  <Ionicons name="add" size={18} color="#131B2E" />
                  <Text style={styles.addExpenseBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* EXPENSE ITEMS LIST */}
            {expenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIconText}>🧾</Text>
                </View>
                <Text style={styles.emptyTitle}>No expenses logged yet</Text>
                <Text style={styles.emptySubtitle}>
                  Keep your trip on budget by logging flights, stays, food, and
                  activities as you travel.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  activeOpacity={0.85}
                  onPress={handleOpenAddModal}
                >
                  <Ionicons name="add" size={16} color="#131B2E" />
                  <Text style={styles.emptyAddBtnText}>Add First Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.expensesList}>
                {expenses.map((item) => {
                  const isShared =
                    Array.isArray(item.splitAmong) && item.splitAmong.length > 0;
                  const payerName = getParticipantName(item.paidBy || 'me');

                  return (
                    <View key={item._id} style={styles.expenseItemCard}>
                      {/* Category Icon */}
                      <View style={styles.categoryIconCircle}>
                        <Text style={styles.categoryEmoji}>
                          {getCategoryIcon(item.category)}
                        </Text>
                      </View>

                      {/* Expense Details */}
                      <View style={styles.expenseDetailsCol}>
                        <Text style={styles.expenseDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                        <View style={styles.expenseMetaRow}>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>
                              {item.category || 'Other'}
                            </Text>
                          </View>
                          {item.createdAt ? (
                            <Text style={styles.expenseDateText}>
                              • {formatDate(item.createdAt)}
                            </Text>
                          ) : null}
                        </View>

                        {/* Shared expense subtitle */}
                        {isShared ? (
                          <View style={styles.splitSubtitleRow}>
                            <Ionicons
                              name="people"
                              size={12}
                              color={colors.accentPrimary}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.splitSubtitleText}>
                              Paid by {payerName} · split {item.splitAmong.length} ways
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Amount & Delete Action */}
                      <View style={styles.expenseAmountCol}>
                        <Text style={styles.expenseAmountText}>
                          {item.originalCurrency &&
                          item.originalCurrency !== 'INR' &&
                          item.originalAmount != null ? (
                            `${CURRENCY_SYMBOLS[item.originalCurrency] || `${item.originalCurrency} `}${Number(item.originalAmount).toLocaleString('en-US')} (₹${Number(item.amountINR).toLocaleString('en-IN')}${item.fxRate != null ? ` at ${item.fxRate}` : ''})`
                          ) : (
                            `₹${Number(item.amountINR).toLocaleString('en-IN')}`
                          )}
                        </Text>
                        <TouchableOpacity
                          style={styles.deleteIconButton}
                          activeOpacity={0.7}
                          onPress={() => promptDeleteExpense(item)}
                          disabled={deletingId === item._id}
                          accessibilityLabel={`Delete ${item.description}`}
                        >
                          {deletingId === item._id ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="rgba(247,243,234,0.5)"
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* SETTLE UP SECTION (Visible only when shared expenses exist) */}
            {hasSharedExpenses ? (
              <View style={styles.settleUpSection}>
                <View style={styles.settleUpHeader}>
                  <View style={styles.settleUpTitleRow}>
                    <Text style={styles.settleUpSectionTitle}>Settle Up</Text>
                    <View style={styles.settleUpBadge}>
                      <Text style={styles.settleUpBadgeText}>EQUAL SPLITS</Text>
                    </View>
                  </View>
                  <Text style={styles.settleUpSectionSubtitle}>
                    Balances and suggested minimal transfers for shared items
                  </Text>
                </View>

                {/* Net Balances Cards */}
                <View style={styles.balancesContainer}>
                  <Text style={styles.subSectionHeader}>Net Balances</Text>
                  <View style={styles.balancesGrid}>
                    {allParticipants.map((p) => {
                      const netPaise = balances[p.id] || 0;
                      const isCreditor = netPaise > 0;
                      const isDebtor = netPaise < 0;
                      const absPaise = Math.abs(netPaise);
                      const displayAmount =
                        absPaise % 100 === 0
                          ? (absPaise / 100).toLocaleString('en-IN')
                          : (absPaise / 100).toFixed(2);

                      return (
                        <View key={p.id} style={styles.balanceCard}>
                          <View style={styles.balanceCardLeft}>
                            <View
                              style={[
                                styles.participantAvatar,
                                p.id === 'me'
                                  ? styles.participantAvatarMe
                                  : null,
                              ]}
                            >
                              <Text style={styles.participantAvatarText}>
                                {p.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.balanceNameText} numberOfLines={1}>
                              {p.name}
                            </Text>
                          </View>

                          <View style={styles.balanceStatusCol}>
                            {isCreditor ? (
                              <View style={styles.balancePillPositive}>
                                <Ionicons
                                  name="arrow-down-circle"
                                  size={13}
                                  color="#10b981"
                                  style={{ marginRight: 4 }}
                                />
                                <Text style={styles.balanceTextPositive}>
                                  gets back ₹{displayAmount}
                                </Text>
                              </View>
                            ) : isDebtor ? (
                              <View style={styles.balancePillNegative}>
                                <Ionicons
                                  name="arrow-up-circle"
                                  size={13}
                                  color="#f87171"
                                  style={{ marginRight: 4 }}
                                />
                                <Text style={styles.balanceTextNegative}>
                                  owes ₹{displayAmount}
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.balancePillSettled}>
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={13}
                                  color={colors.textMuted}
                                  style={{ marginRight: 4 }}
                                />
                                <Text style={styles.balanceTextSettled}>
                                  settled
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Suggested Transfers */}
                <View style={styles.settlementsContainer}>
                  <Text style={styles.subSectionHeader}>Suggested Transfers</Text>
                  {settlements.length === 0 ? (
                    <View style={styles.settledStateCard}>
                      <Ionicons
                        name="checkmark-done-circle"
                        size={28}
                        color="#10b981"
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={styles.settledStateTitle}>All settled</Text>
                      <Text style={styles.settledStateSubtitle}>
                        No pending transfers needed among travelers.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.settlementsList}>
                      {settlements.map((s, idx) => {
                        const fromName = getParticipantName(s.from);
                        const toName = getParticipantName(s.to);
                        const displayAmount =
                          s.amountPaise % 100 === 0
                            ? (s.amountPaise / 100).toLocaleString('en-IN')
                            : (s.amountPaise / 100).toFixed(2);

                        return (
                          <View
                            key={`settle-${s.from}-${s.to}-${idx}`}
                            style={styles.settlementCard}
                          >
                            <View style={styles.settlementIconCircle}>
                              <Ionicons
                                name="swap-horizontal"
                                size={18}
                                color={colors.accentPrimary}
                              />
                            </View>
                            <View style={styles.settlementTextCol}>
                              <Text style={styles.settlementMainText}>
                                <Text style={styles.settlementHighlightName}>
                                  {fromName}
                                </Text>{' '}
                                pays{' '}
                                <Text style={styles.settlementHighlightName}>
                                  {toName}
                                </Text>
                              </Text>
                              <Text style={styles.settlementSubtext}>
                                Direct payment settlement
                              </Text>
                            </View>
                            <View style={styles.settlementAmountCol}>
                              <Text style={styles.settlementAmountText}>
                                ₹{displayAmount}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* MANAGE TRAVELERS MODAL */}
      <Modal
        visible={isTravelersModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTravelersModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Manage Travelers 👥</Text>
                <Text style={styles.modalSubtitle}>
                  Add or edit names to split trip expenses (max 10)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsTravelersModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Error Banner inside traveler modal */}
            {travelerModalError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color="#fca5a5" />
                <Text style={styles.modalErrorText}>{travelerModalError}</Text>
              </View>
            ) : null}

            {/* Add Traveler Input Row */}
            <View style={styles.addTravelerInputRow}>
              <TextInput
                style={[styles.textInput, styles.travelerTextInput]}
                placeholder="Traveler name (e.g. Ravi, Maya)"
                placeholderTextColor={colors.textMuted}
                value={newTravelerName}
                onChangeText={(text) => {
                  setNewTravelerName(text);
                  if (travelerModalError) setTravelerModalError('');
                }}
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleAddTraveler}
                editable={!travelerActionLoading}
              />
              <TouchableOpacity
                style={[
                  styles.addTravelerBtn,
                  travelers.length >= 10 || !newTravelerName.trim()
                    ? styles.addTravelerBtnDisabled
                    : null,
                ]}
                onPress={handleAddTraveler}
                disabled={
                  travelerActionLoading ||
                  travelers.length >= 10 ||
                  !newTravelerName.trim()
                }
                activeOpacity={0.8}
              >
                {travelerActionLoading ? (
                  <ActivityIndicator size="small" color="#131B2E" />
                ) : (
                  <Text style={styles.addTravelerBtnText}>+ Add</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Travelers List */}
            <ScrollView style={styles.travelersScrollList}>
              {/* You / Owner entry */}
              <View style={styles.travelerRowItem}>
                <View style={styles.travelerRowAvatar}>
                  <Text style={styles.travelerRowAvatarText}>Y</Text>
                </View>
                <View style={styles.travelerRowInfo}>
                  <Text style={styles.travelerRowName}>You</Text>
                  <Text style={styles.travelerRowRole}>Trip Organizer & Owner</Text>
                </View>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>OWNER</Text>
                </View>
              </View>

              {/* Other Travelers */}
              {travelers.map((t) => {
                const isEditing = editingTravelerId === t._id;

                return (
                  <View key={t._id} style={styles.travelerRowItem}>
                    <View style={styles.travelerRowAvatar}>
                      <Text style={styles.travelerRowAvatarText}>
                        {t.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {isEditing ? (
                      <View style={styles.travelerEditInlineRow}>
                        <TextInput
                          style={styles.travelerRenameInput}
                          value={editingTravelerName}
                          onChangeText={setEditingTravelerName}
                          autoFocus
                          maxLength={30}
                        />
                        <TouchableOpacity
                          style={styles.travelerIconActionBtn}
                          onPress={() => handleSaveRenameTraveler(t._id)}
                          disabled={travelerActionLoading}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.accentPrimary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.travelerIconActionBtn}
                          onPress={() => {
                            setEditingTravelerId(null);
                            setEditingTravelerName('');
                          }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={styles.travelerRowInfo}>
                          <Text style={styles.travelerRowName}>{t.name}</Text>
                          <Text style={styles.travelerRowRole}>Traveler</Text>
                        </View>

                        <View style={styles.travelerActionsRow}>
                          <TouchableOpacity
                            style={styles.travelerIconActionBtn}
                            onPress={() => {
                              setTravelerModalError('');
                              setEditingTravelerId(t._id);
                              setEditingTravelerName(t.name);
                            }}
                            accessibilityLabel={`Rename ${t.name}`}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={18}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.travelerIconActionBtn}
                            onPress={() => handleDeleteTraveler(t._id)}
                            disabled={travelerActionLoading}
                            accessibilityLabel={`Delete ${t.name}`}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color="#f87171"
                            />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}

              {travelers.length === 0 ? (
                <View style={styles.noTravelersNoticeBox}>
                  <Text style={styles.noTravelersNoticeText}>
                    No other travelers added yet. Add companions by name to split
                    expenses evenly across your trip.
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.travelersModalDoneBtn}
              onPress={() => setIsTravelersModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.travelersModalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADD EXPENSE MODAL */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Add Expense</Text>
                <Text style={styles.modalSubtitle}>
                  Log a payment or purchase for this trip
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Error Message inside modal */}
            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color="#fca5a5" />
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.addExpenseScrollContent}
            >
              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Seafood Dinner, Taxi to Airport"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
              </View>

              {/* Amount & Currency Input Row */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Amount {selectedCurrency === 'INR' ? '(₹ INR)' : `(${selectedCurrency})`}
                </Text>
                <View style={styles.amountCurrencyRow}>
                  {/* Currency Picker Button */}
                  <TouchableOpacity
                    style={styles.currencyPickerBtn}
                    onPress={() => setIsCurrencyModalVisible(true)}
                    activeOpacity={0.8}
                    accessibilityLabel="Select currency"
                  >
                    <Text style={styles.currencyPickerBtnText}>
                      {CURRENCY_SYMBOLS[selectedCurrency]?.trim() || selectedCurrency} {selectedCurrency}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textPrimary} />
                  </TouchableOpacity>

                  {/* Amount Input */}
                  <TextInput
                    style={[styles.textInput, styles.amountInput]}
                    placeholder={selectedCurrency === 'INR' ? 'e.g. 1500' : 'e.g. 25.50'}
                    placeholderTextColor={colors.textMuted}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Foreign Currency Rate & Live Preview */}
              {selectedCurrency !== 'INR' ? (
                <View style={styles.fxSectionCard}>
                  <View style={styles.fxSectionHeaderRow}>
                    <Text style={styles.fxSectionLabel}>
                      Rate (₹ per 1 {selectedCurrency})
                    </Text>
                    {fxRateLoading ? (
                      <ActivityIndicator size="small" color={colors.accentPrimary} />
                    ) : null}
                  </View>

                  <TextInput
                    style={styles.textInput}
                    placeholder={`e.g. ${selectedCurrency === 'JPY' ? '0.57' : '85.50'}`}
                    placeholderTextColor={colors.textMuted}
                    value={fxRateInput}
                    onChangeText={handleRateChange}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />

                  {/* Rate status / date line or warning message */}
                  {fxRateMessage ? (
                    <Text style={styles.fxRateWarningText}>{fxRateMessage}</Text>
                  ) : fxRateDate && fxRateSource === 'ecb' ? (
                    <Text style={styles.fxRateMetaText}>
                      Rate: ECB reference, {fxRateDate}
                    </Text>
                  ) : fxRateDate ? (
                    <Text style={styles.fxRateMetaText}>
                      Rate: Manual ({fxRateDate})
                    </Text>
                  ) : null}

                  {/* Live conversion preview "= ₹X" */}
                  {liveConvertedInr !== null ? (
                    <View style={styles.fxLivePreviewRow}>
                      <Text style={styles.fxLivePreviewText}>
                        = ₹{liveConvertedInr.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.fxDisclaimerText}>
                    Reference rates are not what your bank or card charges, so your actual cost can differ.
                  </Text>
                </View>
              ) : null}

              {/* Category Selector Chips */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryChipsGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categorySelectChip,
                          isSelected ? styles.categorySelectChipActive : null,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setSelectedCategory(cat.id)}
                      >
                        <Text style={styles.categorySelectChipIcon}>
                          {cat.icon}
                        </Text>
                        <Text
                          style={[
                            styles.categorySelectChipText,
                            isSelected
                              ? styles.categorySelectChipTextActive
                              : null,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Paid By Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Paid By</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paidByChipsRow}
                >
                  <TouchableOpacity
                    style={[
                      styles.paidByChip,
                      paidBy === 'me' ? styles.paidByChipSelected : null,
                    ]}
                    onPress={() => setPaidBy('me')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={paidBy === 'me' ? 'person' : 'person-outline'}
                      size={14}
                      color={paidBy === 'me' ? '#131B2E' : colors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.paidByChipText,
                        paidBy === 'me' ? styles.paidByChipTextSelected : null,
                      ]}
                    >
                      You
                    </Text>
                  </TouchableOpacity>

                  {travelers.map((t) => {
                    const isSelected = paidBy === t._id.toString();
                    return (
                      <TouchableOpacity
                        key={t._id}
                        style={[
                          styles.paidByChip,
                          isSelected ? styles.paidByChipSelected : null,
                        ]}
                        onPress={() => setPaidBy(t._id.toString())}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isSelected ? 'person' : 'person-outline'}
                          size={14}
                          color={isSelected ? '#131B2E' : colors.textMuted}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.paidByChipText,
                            isSelected ? styles.paidByChipTextSelected : null,
                          ]}
                        >
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Split With Others Toggle */}
              <View style={styles.splitToggleCard}>
                <View style={styles.splitToggleHeader}>
                  <View style={styles.splitToggleLabelCol}>
                    <Text style={styles.splitToggleTitle}>Split with others</Text>
                    <Text style={styles.splitToggleSubtitle}>
                      {travelers.length === 0
                        ? 'Requires at least one companion on the trip'
                        : 'Divide this expense equally'}
                    </Text>
                  </View>

                  {travelers.length === 0 ? (
                    <TouchableOpacity
                      style={styles.addTravelersPillBtn}
                      onPress={() => {
                        setIsAddModalVisible(false);
                        setTravelerModalError('');
                        setIsTravelersModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={13}
                        color={colors.accentPrimary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.addTravelersPillText}>+ Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.switchTrack,
                        isSplitOn ? styles.switchTrackOn : null,
                      ]}
                      onPress={() => {
                        const nextVal = !isSplitOn;
                        setIsSplitOn(nextVal);
                        if (nextVal) {
                          setSplitAmong([
                            'me',
                            ...travelers.map((t) => t._id.toString()),
                          ]);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.switchThumb,
                          isSplitOn ? styles.switchThumbOn : null,
                        ]}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* When Split is ON: Selectable participant chips + live preview */}
                {isSplitOn && travelers.length > 0 ? (
                  <View style={styles.splitParticipantsSection}>
                    <Text style={styles.splitSectionSubheader}>
                      Split equally among ({splitAmong.length}):
                    </Text>

                    <View style={styles.splitChipsGrid}>
                      {/* You chip */}
                      <TouchableOpacity
                        style={[
                          styles.splitPersonChip,
                          splitAmong.includes('me')
                            ? styles.splitPersonChipActive
                            : null,
                        ]}
                        onPress={() => {
                          if (splitAmong.includes('me')) {
                            if (splitAmong.length > 1) {
                              setSplitAmong((prev) =>
                                prev.filter((id) => id !== 'me')
                              );
                            }
                          } else {
                            setSplitAmong((prev) => [...prev, 'me']);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={
                            splitAmong.includes('me')
                              ? 'checkbox'
                              : 'square-outline'
                          }
                          size={16}
                          color={
                            splitAmong.includes('me')
                              ? colors.accentPrimary
                              : colors.textMuted
                          }
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.splitPersonChipText,
                            splitAmong.includes('me')
                              ? styles.splitPersonChipTextActive
                              : null,
                          ]}
                        >
                          You
                        </Text>
                      </TouchableOpacity>

                      {/* Traveler chips */}
                      {travelers.map((t) => {
                        const tid = t._id.toString();
                        const isChecked = splitAmong.includes(tid);

                        return (
                          <TouchableOpacity
                            key={tid}
                            style={[
                              styles.splitPersonChip,
                              isChecked ? styles.splitPersonChipActive : null,
                            ]}
                            onPress={() => {
                              if (isChecked) {
                                if (splitAmong.length > 1) {
                                  setSplitAmong((prev) =>
                                    prev.filter((id) => id !== tid)
                                  );
                                }
                              } else {
                                setSplitAmong((prev) => [...prev, tid]);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name={isChecked ? 'checkbox' : 'square-outline'}
                              size={16}
                              color={
                                isChecked
                                  ? colors.accentPrimary
                                  : colors.textMuted
                              }
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.splitPersonChipText,
                                isChecked
                                  ? styles.splitPersonChipTextActive
                                  : null,
                              ]}
                            >
                              {t.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Live Preview */}
                    {parsedModalAmount > 0 && splitCount > 0 ? (
                      <View style={styles.livePreviewBanner}>
                        <Ionicons
                          name="calculator-outline"
                          size={15}
                          color={colors.accentPrimary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.livePreviewText}>
                          about ₹{approxEach.toLocaleString('en-IN')} each (approx.)
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Modal Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  submitting || !isRateValid ? styles.modalSaveBtnDisabled : null,
                ]}
                onPress={handleCreateExpense}
                disabled={submitting || !isRateValid}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#131B2E" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#131B2E" />
                    <Text style={styles.modalSaveText}>Save Expense</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CURRENCY SELECTOR MODAL */}
      <Modal
        visible={isCurrencyModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCurrencyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.currencyModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Select Currency</Text>
                <Text style={styles.modalSubtitle}>
                  Choose currency for this expense
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsCurrencyModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Default INR option */}
              <TouchableOpacity
                style={[
                  styles.currencyOptionRow,
                  selectedCurrency === 'INR' ? styles.currencyOptionRowActive : null,
                ]}
                onPress={() => handleSelectCurrency('INR')}
                activeOpacity={0.8}
              >
                <Text style={styles.currencyOptionCode}>₹ INR</Text>
                <Text style={styles.currencyOptionName}>Indian Rupee (Default)</Text>
                {selectedCurrency === 'INR' ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.accentPrimary} />
                ) : null}
              </TouchableOpacity>

              {/* Common travel currencies */}
              <Text style={styles.currencySectionHeader}>COMMON TRAVEL CURRENCIES</Text>
              <View style={styles.currencyGrid}>
                {COMMON_CURRENCIES.map((code) => {
                  const isSelected = selectedCurrency === code;
                  const isRecent = sessionLastForeignCurrency === code;
                  const symbol = CURRENCY_SYMBOLS[code]?.trim() || '';
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.currencyGridItem,
                        isSelected ? styles.currencyGridItemActive : null,
                      ]}
                      onPress={() => handleSelectCurrency(code)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.currencyGridCode,
                          isSelected ? styles.currencyGridCodeActive : null,
                        ]}
                      >
                        {symbol ? `${symbol} ` : ''}{code}
                      </Text>
                      {isRecent && !isSelected ? (
                        <View style={styles.recentDot} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Other 3-letter code */}
              <Text style={styles.currencySectionHeader}>OTHER CURRENCY</Text>
              <View style={styles.otherCurrencyRow}>
                <TextInput
                  style={[styles.textInput, styles.otherCurrencyInput]}
                  placeholder="3-letter code (e.g. NZD)"
                  placeholderTextColor={colors.textMuted}
                  value={customCurrencyInput}
                  onChangeText={(t) => {
                    setCustomCurrencyInput(t.toUpperCase());
                    setCustomCurrencyError('');
                  }}
                  maxLength={3}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.otherCurrencyApplyBtn}
                  onPress={() => {
                    const trimmed = customCurrencyInput.trim().toUpperCase();
                    if (!/^[A-Z]{3}$/.test(trimmed)) {
                      setCustomCurrencyError('Enter a 3-letter currency code');
                      return;
                    }
                    handleSelectCurrency(trimmed);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.otherCurrencyApplyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              {customCurrencyError ? (
                <Text style={styles.currencyErrorText}>{customCurrencyError}</Text>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    paddingHorizontal: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
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
  errorBanner: {
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },

  /* BUDGET CARD */
  budgetCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  budgetCardOver: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetCardBadge: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  budgetCardBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillUnder: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusPillOver: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillTextUnder: {
    color: '#10b981',
  },
  statusPillTextOver: {
    color: '#ef4444',
  },
  spentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  spentLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  spentAmount: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: fonts?.display || undefined,
  },
  spentAmountOver: {
    color: '#ef4444',
  },
  groupTotalSubtext: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  budgetTargetCol: {
    alignItems: 'flex-end',
  },
  budgetTargetLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  budgetTargetValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  progressBarWrapper: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarFillNormal: {
    backgroundColor: colors.accentPrimary,
  },
  progressBarFillOver: {
    backgroundColor: '#ef4444',
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressPercentText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressPercentTextOver: {
    color: '#ef4444',
  },
  progressSubtext: {
    color: colors.textMuted,
    fontSize: 11,
  },

  /* ACTION ROW */
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listSectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  listSectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  actionButtonsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  travelersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  travelersBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addExpenseBtnText: {
    color: '#131B2E',
    fontSize: 13,
    fontWeight: '700',
  },

  /* EXPENSES LIST */
  expensesList: {
    gap: 10,
    marginBottom: 24,
  },
  expenseItemCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(247, 243, 234, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  expenseDetailsCol: {
    flex: 1,
  },
  expenseDescription: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: colors.accentPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  expenseDateText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  splitSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  splitSubtitleText: {
    color: colors.accentPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  expenseAmountCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmountText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteIconButton: {
    padding: 4,
  },

  /* SETTLE UP SECTION */
  settleUpSection: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    marginBottom: 24,
  },
  settleUpHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 243, 234, 0.08)',
    paddingBottom: 12,
  },
  settleUpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  settleUpSectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  settleUpBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  settleUpBadgeText: {
    color: colors.accentPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settleUpSectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  subSectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  balancesContainer: {
    marginBottom: 20,
  },
  balancesGrid: {
    gap: 8,
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
  },
  balanceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarMe: {
    backgroundColor: 'rgba(232, 163, 61, 0.25)',
  },
  participantAvatarText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  balanceNameText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceStatusCol: {
    alignItems: 'flex-end',
  },
  balancePillPositive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceTextPositive: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  balancePillNegative: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceTextNegative: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  balancePillSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 243, 234, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceTextSettled: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  settlementsContainer: {
    marginTop: 4,
  },
  settledStateCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  settledStateTitle: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '700',
  },
  settledStateSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  settlementsList: {
    gap: 8,
  },
  settlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
    gap: 12,
  },
  settlementIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settlementTextCol: {
    flex: 1,
  },
  settlementMainText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  settlementHighlightName: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  settlementSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  settlementAmountCol: {
    alignItems: 'flex-end',
  },
  settlementAmountText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },

  /* EMPTY STATE */
  emptyContainer: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(232, 163, 61, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyIconText: {
    fontSize: 26,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  emptyAddBtnText: {
    color: '#131B2E',
    fontSize: 13,
    fontWeight: '700',
  },

  /* MODALS COMMON */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalErrorBanner: {
    backgroundColor: 'rgba(214, 90, 74, 0.2)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
  },
  addExpenseScrollContent: {
    paddingBottom: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#121212',
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  categorySelectChipActive: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderColor: colors.accentPrimary,
  },
  categorySelectChipIcon: {
    fontSize: 14,
  },
  categorySelectChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  categorySelectChipTextActive: {
    color: colors.accentPrimary,
  },

  /* PAID BY SELECTOR */
  paidByChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  paidByChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paidByChipSelected: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  paidByChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  paidByChipTextSelected: {
    color: '#131B2E',
    fontWeight: '700',
  },

  /* SPLIT WITH OTHERS CARD */
  splitToggleCard: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  splitToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitToggleLabelCol: {
    flex: 1,
    paddingRight: 12,
  },
  splitToggleTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  splitToggleSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  addTravelersPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  addTravelersPillText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(247, 243, 234, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: colors.accentPrimary,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F7F3EA',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#131B2E',
  },
  splitParticipantsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
  },
  splitSectionSubheader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  splitChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  splitPersonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitPersonChipActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
  },
  splitPersonChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  splitPersonChipTextActive: {
    color: colors.textPrimary,
  },
  livePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 163, 61, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  livePreviewText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalSaveText: {
    color: '#131B2E',
    fontSize: 14,
    fontWeight: '700',
  },

  /* TRAVELERS MODAL STYLES */
  addTravelerInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  travelerTextInput: {
    flex: 1,
  },
  addTravelerBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTravelerBtnDisabled: {
    opacity: 0.4,
  },
  addTravelerBtnText: {
    color: '#131B2E',
    fontSize: 14,
    fontWeight: '700',
  },
  travelersScrollList: {
    maxHeight: 280,
    marginBottom: 14,
  },
  travelerRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  travelerRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  travelerRowAvatarText: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  travelerRowInfo: {
    flex: 1,
  },
  travelerRowName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  travelerRowRole: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  ownerBadge: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownerBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  travelerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  travelerIconActionBtn: {
    padding: 6,
  },
  travelerEditInlineRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelerRenameInput: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    color: colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  noTravelersNoticeBox: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  noTravelersNoticeText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  travelersModalDoneBtn: {
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  travelersModalDoneBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  headerTotalsNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(232, 163, 61, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 163, 61, 0.15)',
    gap: 6,
  },
  headerTotalsNoteText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  amountCurrencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    minWidth: 95,
    gap: 6,
  },
  currencyPickerBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  amountInput: {
    flex: 1,
  },
  fxSectionCard: {
    backgroundColor: '#18181A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
    marginTop: 6,
    marginBottom: 6,
    gap: 8,
  },
  fxSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fxSectionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  fxRateMetaText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  fxRateWarningText: {
    color: '#fbbf24',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  fxLivePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  fxLivePreviewText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '700',
  },
  fxDisclaimerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 15,
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  currencyModalCard: {
    backgroundColor: '#18181A',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
  },
  currencyOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#202022',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  currencyOptionRowActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
  },
  currencyOptionCode: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    width: 65,
  },
  currencyOptionName: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  currencySectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  currencyGridItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#222224',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyGridItemActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
  },
  currencyGridCode: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  currencyGridCodeActive: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  recentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  otherCurrencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  otherCurrencyInput: {
    flex: 1,
    textTransform: 'uppercase',
  },
  otherCurrencyApplyBtn: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherCurrencyApplyBtnText: {
    color: '#131B2E',
    fontWeight: '700',
    fontSize: 13,
  },
  currencyErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 4,
  },
});
