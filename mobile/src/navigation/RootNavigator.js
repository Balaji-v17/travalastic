import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

// Navigators & Screens
import MainTabNavigator from './MainTabNavigator';
import HomeScreen from '../screens/HomeScreen';
import FlightSearchScreen from '../screens/FlightSearchScreen';
import HotelsScreen from '../screens/HotelsScreen';
import CabBookingScreen from '../screens/CabBookingScreen';
import SearchScreen from '../screens/SearchScreen';
import ExploreScreen from '../screens/ExploreScreen';
import BookScreen from '../screens/BookScreen';
import TripRequestScreen from '../screens/TripRequestScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import PassengerFormScreen from '../screens/PassengerFormScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import TrainsAndBusesScreen from '../screens/TrainsAndBusesScreen';
import ChatScreen from '../screens/ChatScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator({ initialRouteName, isAuthenticated }) {
  const [checkingAuth, setCheckingAuth] = useState(initialRouteName === undefined);
  const [resolvedInitialRoute, setResolvedInitialRoute] = useState(
    initialRouteName || (isAuthenticated ? 'Home' : 'Login')
  );

  useEffect(() => {
    if (initialRouteName !== undefined) {
      setResolvedInitialRoute(initialRouteName);
      setCheckingAuth(false);
      return;
    }

    async function checkToken() {
      try {
        let token = null;
        if (Platform.OS === 'web') {
          token =
            localStorage.getItem('travalastic_token') ||
            localStorage.getItem('userToken') ||
            localStorage.getItem('token');
        } else {
          token =
            (await SecureStore.getItemAsync('travalastic_token')) ||
            (await SecureStore.getItemAsync('userToken')) ||
            (await SecureStore.getItemAsync('token'));
        }
        setResolvedInitialRoute(token ? 'Home' : 'Login');
      } catch (e) {
        console.error('RootNavigator: token check failed:', e);
        setResolvedInitialRoute('Login');
      } finally {
        setCheckingAuth(false);
      }
    }

    checkToken();
  }, [initialRouteName]);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" testID="navigator-loading" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={resolvedInitialRoute}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: '#0f172a',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      {/* Main Tabs (Post-Login Entry) */}
      <Stack.Screen
        name="Home"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />

      {/* Destinations (Search & Explore - Unified) */}
      <Stack.Screen
        name="Search"
        component={ExploreScreen}
        options={{ title: 'Explore Destinations' }}
      />
      <Stack.Screen
        name="SearchScreen"
        component={ExploreScreen}
        options={{ title: 'Explore Destinations' }}
      />
      <Stack.Screen
        name="Destinations"
        component={ExploreScreen}
        options={{ title: 'Explore Destinations' }}
      />
      <Stack.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ title: 'Explore Activities' }}
      />
      <Stack.Screen
        name="ExploreScreen"
        component={ExploreScreen}
        options={{ title: 'Explore Activities' }}
      />

      {/* Book Hub */}
      <Stack.Screen
        name="Book"
        component={BookScreen}
        options={{ title: 'Book Travel' }}
      />
      <Stack.Screen
        name="BookScreen"
        component={BookScreen}
        options={{ title: 'Book Travel' }}
      />

      {/* Hotels */}
      <Stack.Screen
        name="Hotels"
        component={HotelsScreen}
        options={{ title: 'Find Hotels' }}
      />
      <Stack.Screen
        name="HotelsScreen"
        component={HotelsScreen}
        options={{ title: 'Find Hotels' }}
      />

      {/* Cabs / Uber */}
      <Stack.Screen
        name="CabBooking"
        component={CabBookingScreen}
        options={{ title: 'Book a Cab' }}
      />
      <Stack.Screen
        name="CabBookingScreen"
        component={CabBookingScreen}
        options={{ title: 'Book a Cab' }}
      />
      <Stack.Screen
        name="Cabs"
        component={CabBookingScreen}
        options={{ title: 'Book a Cab' }}
      />
      <Stack.Screen
        name="Uber"
        component={CabBookingScreen}
        options={{ title: 'Book a Cab' }}
      />

      {/* Flights */}
      <Stack.Screen
        name="FlightSearch"
        component={FlightSearchScreen}
        options={{ title: 'Search Flights' }}
      />
      <Stack.Screen
        name="FlightSearchScreen"
        component={FlightSearchScreen}
        options={{ title: 'Search Flights' }}
      />
      <Stack.Screen
        name="Flights"
        component={FlightSearchScreen}
        options={{ title: 'Search Flights' }}
      />
      <Stack.Screen
        name="PassengerForm"
        component={PassengerFormScreen}
        options={{ title: 'Passenger Details' }}
      />
      <Stack.Screen
        name="PassengerFormScreen"
        component={PassengerFormScreen}
        options={{ title: 'Passenger Details' }}
      />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{ title: 'Booking Confirmed', headerBackVisible: false }}
      />
      <Stack.Screen
        name="BookingConfirmationScreen"
        component={BookingConfirmationScreen}
        options={{ title: 'Booking Confirmed', headerBackVisible: false }}
      />

      {/* Trip Planner & Itinerary */}
      <Stack.Screen
        name="TripRequest"
        component={TripRequestScreen}
        options={{ title: 'Plan Trip' }}
      />
      <Stack.Screen
        name="TripRequestScreen"
        component={TripRequestScreen}
        options={{ title: 'Plan Trip' }}
      />
      <Stack.Screen
        name="Itinerary"
        component={ItineraryScreen}
        options={{ title: 'Your Itinerary' }}
      />
      <Stack.Screen
        name="ItineraryScreen"
        component={ItineraryScreen}
        options={{ title: 'Your Itinerary' }}
      />

      {/* Ground Transit */}
      <Stack.Screen
        name="TrainsAndBuses"
        component={TrainsAndBusesScreen}
        options={{ title: 'Trains & Buses' }}
      />
      <Stack.Screen
        name="TrainsAndBusesScreen"
        component={TrainsAndBusesScreen}
        options={{ title: 'Trains & Buses' }}
      />

      {/* AI Chat Assistant */}
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Trip Assistant 💬' }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{ title: 'Trip Assistant 💬' }}
      />

      {/* Auth & Profile */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Log In', headerBackVisible: false }}
      />
      <Stack.Screen
        name="LoginScreen"
        component={LoginScreen}
        options={{ title: 'Log In', headerBackVisible: false }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ title: 'Sign Up' }}
      />
      <Stack.Screen
        name="SignUpScreen"
        component={SignUpScreen}
        options={{ title: 'Sign Up' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export { RootNavigator };
