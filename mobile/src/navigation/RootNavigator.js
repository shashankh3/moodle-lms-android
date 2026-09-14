import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import TabNavigator from './TabNavigator';
import CourseDetailScreen from '../screens/courses/CourseDetailScreen';
import CourseContentViewerScreen from '../screens/courses/CourseContentViewerScreen';
import QuizPlayerScreen from '../screens/quizzes/QuizPlayerScreen';
import AssignmentViewScreen from '../screens/assignments/AssignmentViewScreen';
import ForumScreen from '../screens/forums/ForumScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import BadgesScreen from '../screens/badges/BadgesScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import CertificatesScreen from '../screens/certificates/CertificatesScreen';
import PrivateFilesScreen from '../screens/files/PrivateFilesScreen';
import CourseCatalogScreen from '../screens/courses/CourseCatalogScreen';
import ScormPlayerScreen from '../screens/courses/ScormPlayerScreen';
import MaharashtraDashboardScreen from '../screens/dashboard/MaharashtraDashboardScreen';
import LessonPlayerScreen from '../screens/courses/LessonPlayerScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MaharashtraDashboard" component={MaharashtraDashboardScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="MaharashtraDashboard" component={MaharashtraDashboardScreen} />
          <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
          <Stack.Screen name="CourseDetailScreen" component={CourseDetailScreen} />
          <Stack.Screen name="CourseContentViewer" component={CourseContentViewerScreen} />
          <Stack.Screen name="CourseContentViewerScreen" component={CourseContentViewerScreen} />
          <Stack.Screen name="QuizPlayer" component={QuizPlayerScreen} />
          <Stack.Screen name="AssignmentView" component={AssignmentViewScreen} />
          <Stack.Screen name="ForumScreen" component={ForumScreen} />
          <Stack.Screen name="MessagesScreen" component={MessagesScreen} />
          <Stack.Screen name="BadgesScreen" component={BadgesScreen} />
          <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
          <Stack.Screen name="CertificatesScreen" component={CertificatesScreen} />
          <Stack.Screen name="PrivateFilesScreen" component={PrivateFilesScreen} />
          <Stack.Screen name="CourseCatalogScreen" component={CourseCatalogScreen} />
          <Stack.Screen name="ScormPlayer" component={ScormPlayerScreen} />
          <Stack.Screen name="LessonPlayer" component={LessonPlayerScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
