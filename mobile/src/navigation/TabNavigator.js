import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CoursesScreen from '../screens/courses/CoursesScreen';
import GradesScreen from '../screens/grades/GradesScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import MoreMenuScreen from '../screens/more/MoreMenuScreen';
import { LayoutDashboard, BookOpen, Award, Calendar, MoreHorizontal, PieChart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();

function CustomBottomTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Ensure safe padding from bottom edge
  const bottomInset = insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 10;

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.tabBarBorder,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const activeColor = theme.primary;
        const inactiveColor = theme.inactiveTab;
        const color = isFocused ? activeColor : inactiveColor;

        const getIcon = () => {
          const props = { size: 22, color, strokeWidth: isFocused ? 2.5 : 2 };
          switch (route.name) {
            case 'DashboardTab':
              return <LayoutDashboard {...props} />;
            case 'CoursesTab':
              return <BookOpen {...props} />;
            case 'GradesTab':
              return <Award {...props} />;
            case 'CalendarTab':
              return <Calendar {...props} />;
            case 'AnalyticsTab':
              return <PieChart {...props} />;
            case 'MoreTab':
              return <MoreHorizontal {...props} />;
            default:
              return null;
          }
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, isFocused && { backgroundColor: theme.badgeBg }]}>
              {getIcon()}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color,
                  fontWeight: isFocused ? '800' : '600',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabNavigator() {
  const { isTeacher } = useAuth();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={props => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ tabBarLabel: t('tab_dashboard') }}
      />
      <Tab.Screen
        name="CoursesTab"
        component={CoursesScreen}
        options={{ tabBarLabel: t('tab_courses') }}
      />
      <Tab.Screen
        name="GradesTab"
        component={GradesScreen}
        options={{ tabBarLabel: t('tab_grades') }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{ tabBarLabel: t('tab_calendar') }}
      />
      {isTeacher && (
        <Tab.Screen
          name="AnalyticsTab"
          component={AnalyticsScreen}
          options={{ tabBarLabel: t('tab_analytics') }}
        />
      )}
      <Tab.Screen
        name="MoreTab"
        component={MoreMenuScreen}
        options={{ tabBarLabel: t('tab_more') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6,
    minHeight: 70,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  iconWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 2,
    includeFontPadding: false,
  },
});
