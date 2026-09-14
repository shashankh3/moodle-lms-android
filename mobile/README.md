# UNIlearn Maharashtra — Mobile LMS

> **A modern, fully native mobile Learning Management System for Maharashtra State's UNIlearn platform.**  
> Built with **React Native + Expo**, powered by **Moodle REST API**, and designed for government learners across Maharashtra.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Screens & Features](#5-screens--features)
6. [Navigation](#6-navigation)
7. [Services & API Layer](#7-services--api-layer)
8. [Internationalization (i18n)](#8-internationalization-i18n)
9. [Theming & Dark Mode](#9-theming--dark-mode)
10. [Authentication](#10-authentication)
11. [SCORM Support](#11-scorm-support)
12. [Accessibility](#12-accessibility)
13. [Offline Support](#13-offline-support)
14. [Build & Deployment](#14-build--deployment)
15. [Environment & Configuration](#15-environment--configuration)
16. [Key Components](#16-key-components)
17. [Known Notes & Decisions](#17-known-notes--decisions)
18. [Getting Started](#18-getting-started)

---

## 1. Project Overview

**UNIlearn Maharashtra** is the official mobile application for the **Maharashtra State government's UNIlearn e-learning platform** (`https://mh.unilearn.org.in`). It provides teachers and students with a rich, native mobile interface to access Moodle-powered learning content — without needing a browser.

### Target Users
- **Students / Enrolled Learners** — Government learners, ECCE teachers, ASHA workers, and trainees enrolled in state-level programs.
- **Teachers / Instructors** — Course owners who can view analytics dashboards and manage content.

### Key Goals
- Full native mobile experience — no browser popups or web redirects
- Works in low-bandwidth environments (Moodle REST API over JSON)
- Trilingual UI — English, Hindi, Marathi
- Accessible to all learners (font scaling, high contrast, screen reader support)
- Offline-capable with sync-on-reconnect for SCORM progress

---

## 2. Tech Stack

| Layer | Technology | Version |
|:---|:---|:---|
| Framework | React Native | 0.86.3 |
| Build Toolchain | Expo (SDK 57) | ^57.0.22 |
| Runtime | React | 19.2.3 |
| Navigation | React Navigation (Stack + Bottom Tabs) | v7 |
| Styling | React Native StyleSheet (Vanilla) | — |
| State Management | React Context API | — |
| Server Communication | Moodle REST API (JSON) via fetch | — |
| Offline Storage | AsyncStorage | ^2.1.0 |
| Internationalization | i18next + react-i18next | ^26.4.0 / ^17 |
| Icons | lucide-react-native | ^0.475.0 |
| Gradients | expo-linear-gradient | ~57.0.2 |
| Images | expo-image | ~57.0.5 |
| Charts | react-native-chart-kit + react-native-svg | ^7.0.2 |
| WebView | react-native-webview | ^13.16.1 |
| Haptics | expo-haptics | ~57.0.3 |
| Print / Share | expo-print + expo-sharing | ~57.0.x |
| Performance Lists | @shopify/flash-list | ^2.0.2 |
| Build & CI | EAS Build (Expo Application Services) | CLI >= 14 |

---

## 3. Architecture

```
App.js (Entry Point)
  NavigationContainer + AuthContext + ThemeContext
       |
  RootNavigator.js
  Auth Stack <-> App Stack
       |
  TabNavigator.js
  6 Bottom Tab Screens
       |
  Screen Components
  (Dashboard, Courses, Grades, Calendar, Analytics, More)
       |
  Services Layer
  apiAdapter.js + moodleClient.js + ScormService + OfflineQueue
       |
  Moodle REST API Server
  https://mh.unilearn.org.in
```

### Design Principles
- **No External Browser Redirects** — All navigation stays within the app using `<WebView />` for rich content and native screens for data-driven views.
- **API-First** — All data (courses, grades, badges, certificates) is fetched live from the Moodle server using JSON REST APIs.
- **Context over Redux** — `AuthContext` and `ThemeContext` provide lightweight global state without a heavy state library.
- **Decoupled Navigation** — A shared `navigationRef` allows navigation from components rendered outside the `NavigationContainer` (e.g., the `OfficialDrawer`).

---

## 4. Project Structure

```
mobile/
├── App.js                         # Root entry: Contexts, NavigationContainer, Drawer
├── index.js                       # Expo entry point
├── app.json                       # Expo app config (name, icons, package, permissions)
├── eas.json                       # EAS Build profiles (dev/preview/production)
├── package.json                   # Dependencies
├── babel.config.js                # Babel config
├── assets/                        # App icons, splash screen, favicon
└── src/
    ├── components/
    │   ├── OfficialDrawer.js          # Side navigation drawer (hamburger menu)
    │   ├── OfficialTopHeader.js       # Top app bar (search, notifications, theme toggle)
    │   ├── UniLearnLogo.js            # Logo + Maharashtra Dashboard pill button
    │   ├── AccessibilitySettingsModal.js
    │   ├── AccessibilityToolbar.js
    │   └── UnicefUnBanner.js          # UNICEF & UN co-branding banner
    │
    ├── context/
    │   ├── AuthContext.js             # Auth state (user, token, login/logout)
    │   └── ThemeContext.js            # Theme state (light/dark, colors, font scale)
    │
    ├── navigation/
    │   ├── RootNavigator.js           # Auth vs App stack switching
    │   ├── TabNavigator.js            # Bottom tab bar (6 tabs)
    │   └── navigationRef.js           # Shared nav ref for out-of-tree navigation
    │
    ├── screens/
    │   ├── auth/LoginScreen.js        # Login + in-app password reset modal
    │   ├── dashboard/
    │   │   ├── DashboardScreen.js
    │   │   └── MaharashtraDashboardScreen.js
    │   ├── courses/
    │   │   ├── CoursesScreen.js
    │   │   ├── CourseCatalogScreen.js
    │   │   ├── CourseDetailScreen.js
    │   │   ├── CourseContentViewerScreen.js
    │   │   └── ScormPlayerScreen.js
    │   ├── grades/GradesScreen.js
    │   ├── calendar/CalendarScreen.js
    │   ├── analytics/AnalyticsScreen.js
    │   ├── badges/BadgesScreen.js
    │   ├── certificates/CertificatesScreen.js
    │   ├── assignments/AssignmentViewScreen.js
    │   ├── forums/ForumScreen.js
    │   ├── messages/MessagesScreen.js
    │   ├── files/PrivateFilesScreen.js
    │   ├── settings/SettingsScreen.js
    │   └── more/MoreMenuScreen.js
    │
    ├── services/
    │   ├── apiAdapter.js              # High-level Moodle API adapter
    │   ├── moodleClient.js            # Low-level HTTP client
    │   ├── moodleQuizParser.js        # Quiz HTML parser
    │   ├── NetworkMonitor.js          # Connectivity watcher
    │   └── scorm/
    │       ├── ScormService.js
    │       ├── ScormDataModel12.js
    │       └── ScormOfflineQueue.js
    │
    └── i18n/
        ├── index.js                   # i18next initialization
        └── locales/
            ├── en.json                # English
            ├── hi.json                # Hindi
            └── mr.json                # Marathi
```

---

## 5. Screens & Features

### Auth — LoginScreen.js
- Username/password login via Moodle token authentication
- In-app password reset modal — triggers Moodle password reset email without any browser redirect
- Language switcher (EN / HI / MR) on the login screen
- Accessible form with large touch targets and screen reader labels

### Dashboard — DashboardScreen.js
The primary home screen for enrolled students.

| Section | Description |
|:---|:---|
| Greeting Card | Personalized greeting with avatar initial, role badge, wave emoji |
| Motivational Clue Banner | Shows course count if enrolled; prompts catalog exploration if not |
| Recently Accessed Courses | Horizontal scroll card strip of recently accessed courses |
| Course Overview | Full vertical grid of all enrolled courses with progress bars |
| Course Filter Dropdown | Modal filter: All / In Progress / Completed / Not Started with live count badges |
| Badges | Mini gallery of latest earned badges |
| Pull-to-refresh | Full data refresh of courses, badges, and recent activity |

### Maharashtra State Dashboard — MaharashtraDashboardScreen.js
- Opens the official Maharashtra State Analytics Portal in a native in-app WebView
- Accessible via the "DASHBOARD" pill in the UniLearnLogo header
- Features live reload button and native back navigation — user never leaves the app

### Courses — CoursesScreen.js + CourseCatalogScreen.js
- CoursesScreen: Enrolled courses list with search and section grouping
- CourseCatalogScreen: Browse all server-published categories and courses; accordion expand/collapse

### Course Detail — CourseDetailScreen.js
- Full course info: banner image, description, teacher, progress %
- Module and activity list grouped by section
- Navigation to activity types (SCORM, Quiz, Page, Resource, Lesson, Assignment, Forum)

### Course Content Viewer — CourseContentViewerScreen.js
- Renders Moodle lesson pages, HTML pages, and rich text content
- Certificate PDF download and share support

### SCORM Player — ScormPlayerScreen.js
- Plays SCORM 1.2 packages in a WebView with full SCORM API bridge
- Tracks: cmi.core.lesson_status, cmi.core.score.raw, cmi.suspend_data, etc.
- Offline queue — progress saved locally and synced to server on reconnect

### Quiz Player — QuizPlayerScreen.js
- Fetches quiz attempts via Moodle quiz API
- Renders parsed HTML questions (multiple choice, true/false, short answer)
- Submit attempt and display results in-app

### Grades — GradesScreen.js
- Grade summary per enrolled course
- Displays letter grade, percentage, total/maximum marks

### Calendar — CalendarScreen.js
- Monthly and list view of upcoming events (assignments, deadlines, site events)
- Color-coded by event type

### Badges — BadgesScreen.js
- Full gallery of all earned Moodle badges with image, name, description, awarded date

### Certificates — CertificatesScreen.js
- Lists custom certificates (mod_customcert) issued upon course completion
- Download as PDF and Share via native share sheet

### Assignments — AssignmentViewScreen.js
- View assignment brief, due date, grading details
- Submission status and file attachments

### Forums — ForumScreen.js
- Browse forum discussions by course; read posts and thread replies

### Messages — MessagesScreen.js
- Moodle messaging inbox; read conversation threads

### Private Files — PrivateFilesScreen.js
- View and download files from the user's Moodle private files area

### Analytics — AnalyticsScreen.js (Teacher only)
- Course enrollment statistics and completion rates
- Charts powered by react-native-chart-kit
- Visible only when logged-in user has a teacher role

### Settings — SettingsScreen.js
- Language selection (EN / HI / MR)
- Dark / Light mode toggle
- Font size accessibility controls
- App version info and logout

### More Menu — MoreMenuScreen.js
- Secondary navigation hub: Badges, Certificates, Assignments, Forums, Private Files, Settings

---

## 6. Navigation

### Stack Structure

```
RootNavigator
├── [Unauthenticated Stack]
│   └── LoginScreen
│
└── [Authenticated Stack]
    ├── TabNavigator (Bottom Tabs)
    │   ├── DashboardTab  → DashboardScreen
    │   ├── CoursesTab    → CoursesScreen
    │   ├── GradesTab     → GradesScreen
    │   ├── CalendarTab   → CalendarScreen
    │   ├── AnalyticsTab  → AnalyticsScreen  [Teacher only]
    │   └── MoreTab       → MoreMenuScreen
    │
    ├── CourseDetailScreen
    ├── CourseContentViewerScreen
    ├── CourseCatalogScreen
    ├── ScormPlayerScreen
    ├── QuizPlayerScreen
    ├── BadgesScreen
    ├── CertificatesScreen
    ├── AssignmentViewScreen
    ├── ForumScreen
    ├── MessagesScreen
    ├── PrivateFilesScreen
    ├── SettingsScreen
    └── MaharashtraDashboard   [WebView screen]
```

### Navigation Reference Pattern
`OfficialDrawer.js` renders **outside** the `NavigationContainer`. Standard `useNavigation()` throws an error in this context. A shared `createNavigationContainerRef()` is used instead:

```js
// src/navigation/navigationRef.js
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

// App.js — attach ref to container
<NavigationContainer ref={navigationRef}>

// Any component anywhere — navigate safely
navigationRef.navigate('MaharashtraDashboard');
```

---

## 7. Services & API Layer

### moodleClient.js
Low-level HTTP client for all Moodle REST API calls:
- Base URL: `https://mh.unilearn.org.in/webservice/rest/server.php`
- Format: json; Auth: Moodle token in `wstoken` query param
- Handles: network errors, Moodle exception responses, token expiry

### apiAdapter.js
High-level adapter wrapping all Moodle web service functions:

| Category | Functions Used |
|:---|:---|
| Auth | core_user_get_users_by_field, password reset |
| Courses | core_enrol_get_users_courses, core_course_get_contents |
| Catalog | core_course_get_categories, core_course_search_courses |
| Grades | gradereport_user_get_grades_table |
| Quizzes | mod_quiz_get_quizzes_by_courses, mod_quiz_start_attempt |
| Assignments | mod_assign_get_assignments, mod_assign_get_submission_status |
| Forums | mod_forum_get_forums_by_courses, mod_forum_get_forum_discussions |
| Badges | core_badges_get_user_badges |
| Certificates | mod_customcert_get_issued_certificates |
| Files | core_files_get_files |
| Messages | core_message_get_messages |
| Calendar | core_calendar_get_action_events_by_course |
| SCORM | mod_scorm_get_scorms_by_courses, mod_scorm_get_scorm_access_information |

### SCORM Services

| File | Purpose |
|:---|:---|
| ScormService.js | Manages SCORM 1.2 session: initialize, getValue, setValue, commit, finish |
| ScormDataModel12.js | Full SCORM 1.2 CMI data model (cmi.core.*, cmi.objectives.*, etc.) |
| ScormOfflineQueue.js | Persists unsynced entries in AsyncStorage; retries on reconnect; discards unsupported entries |

---

## 8. Internationalization (i18n)

Supports 3 languages using i18next:

| Language | Code | File |
|:---|:---|:---|
| English | en | src/i18n/locales/en.json |
| Hindi | hi | src/i18n/locales/hi.json |
| Marathi | mr | src/i18n/locales/mr.json |

Language switching is available on the LoginScreen (before login) and SettingsScreen (after login), persisted to AsyncStorage.

### Devanagari Typography Notes
- Use `lineHeight` instead of `letterSpacing` to prevent conjunct character clipping
- Use `minHeight` and `paddingVertical` to accommodate Matra characters

---

## 9. Theming & Dark Mode

Managed by `ThemeContext.js`. Supports Light, Dark, and System Auto modes.

Sample theme tokens:
```js
light: { background: '#F0F4F8', card: '#FFFFFF', primary: '#00AEEF', text: '#0F172A' }
dark:  { background: '#0A1628', card: '#1E293B', primary: '#38BDF8', text: '#F1F5F9' }
```

`ThemeContext` also exposes `fontScale` (0.85–1.45x / 85%–145%) for global font scaling controlled via `AccessibilitySettingsModal` and `AccessibilityToolbar`.

---

## 10. Authentication

1. User enters Moodle username and password
2. App calls `core_user_get_users_by_field` to validate and fetch the auth token
3. Token and user profile stored in `AuthContext` (memory) and `AsyncStorage` (auto-login)
4. On next launch, stored token is checked; if valid, user is auto-logged in
5. Logout clears both `AuthContext` and `AsyncStorage`

Forgot Password opens a native in-app modal — no browser redirect.
SSO authentication is available via `WebBrowser.openAuthSessionAsync` for servers configured with identity providers.

Role detection: `AuthContext` exposes `isStudent` and `isTeacher` flags for conditional rendering.

---

## 11. SCORM Support

Full SCORM 1.2 and 2004 compliance via `ScormPlayerScreen.js` and `CourseContentViewerScreen.js`:
1. SCORM package URL loaded into a WebView
2. JavaScript bridge injects custom `API` (SCORM 1.2) and `API_1484_11` (SCORM 2004) objects into the WebView window
3. SCORM content calls LMSInitialize, LMSSetValue, LMSGetValue, LMSFinish (or 2004 equivalents)
4. Native app receives via `onMessage`, processes through SCORM data models, syncs to Moodle REST API

Offline: Progress queued in AsyncStorage and retried on reconnect via `NetworkMonitor`. Unsupported server functions are gracefully discarded.

---

## 12. Accessibility

| Feature | Implementation |
|:---|:---|
| Font Scaling | Global fontScale multiplier (0.85–1.45x) via ThemeContext & AccessibilityToolbar |
| High Contrast Mode | Alt color palette with stronger contrast ratios |
| Screen Reader Labels | accessibilityLabel and accessibilityRole on all interactive elements |
| Haptic Feedback | expo-haptics on key actions |
| Safe Area | react-native-safe-area-context for notch/gesture bar awareness |
| Font Size Sync | adjustsFontSizeToFit + minimumFontScale on tab bar labels |

---

## 13. Offline Support

| Feature | Storage | Sync Strategy |
|:---|:---|:---|
| Auth token | AsyncStorage | Persisted; cleared on logout |
| App language | AsyncStorage | Persisted across restarts |
| Theme preference | AsyncStorage | Persisted across restarts |
| SCORM progress | AsyncStorage (queue) | Retried on next online event |
| Course data | In-memory | Pull-to-refresh |

`NetworkMonitor.js` watches connectivity changes and triggers offline queue flushes when the device comes back online.

---

## 14. Build & Deployment

```bash
npm install
npx expo start          # Start dev server
npx expo run:android    # Run on Android
npx expo run:ios        # Run on iOS (Mac only)
```

### EAS Build Profiles

| Profile | Distribution | Android Build |
|:---|:---|:---|
| development | Internal (dev client) | Debug APK |
| preview | Internal | Release APK |
| production | Store / Public | Release APK |

```bash
eas build --platform android --profile preview
eas build --platform android --profile production
```

- **Bundle ID**: `in.org.unilearn.mh`
- **EAS Project ID**: `3add74d6-d78f-4af6-8556-d6580af644d3`
- **Minimum Permissions**: INTERNET, ACCESS_NETWORK_STATE

---

## 15. Environment & Configuration

### app.json Key Settings

| Key | Value |
|:---|:---|
| App Name | UNIlearn Maharashtra |
| Slug | unilearn-maharashtra |
| Version | 1.0.0 |
| Orientation | Portrait |
| Splash Background | #004F7A (brand navy blue) |
| Android usesCleartextTraffic | true (for HTTP SCORM assets) |
| Interface Style | automatic (follows system) |

API Base URL: `https://mh.unilearn.org.in`

---

## 16. Key Components

### UniLearnLogo.js
Renders the branded UNIlearn logo with a "DASHBOARD" pill button that opens the Maharashtra State Analytics screen via `navigationRef` with haptic feedback.

### OfficialTopHeader.js
Top app bar on all authenticated screens: title, hamburger menu, search, notifications, dark/light toggle, accessibility button.

### OfficialDrawer.js
Side navigation drawer: user profile, full navigation links, logout, language switcher, theme toggle. Uses `navigationRef` since it renders outside `NavigationContainer`.

---

## 17. Known Notes & Decisions

### No External Browser Redirects
All navigation stays within the app:
- Password reset → in-app modal (not forgot_password.php)
- Maharashtra dashboard → WebView (not Linking.openURL)
- SCORM content → WebView with native SCORM bridge

### WebView vs. API Call vs. Browser Redirect

| Method | Used When |
|:---|:---|
| API Call (fetch) | Data retrieval — rendered as native UI |
| WebView | Rich interactive HTML content (SCORM, D3 maps) — stays in-app |
| Browser Redirect (Linking) | NOT USED — avoided per project requirements |

### SCORM Offline Queue
The server does not support `mod_scorm_insert_tracks` (returns external_functions error). The offline queue detects this and gracefully discards the entry to prevent retry flooding.

### Devanagari Rendering
Avoid `letterSpacing` on Devanagari text — it breaks conjunct consonant clusters. Use `lineHeight` (1.4–1.6x of font size) and sufficient vertical padding.

---

## 18. Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- Expo CLI (`npm install -g expo-cli`) or use `npx expo`
- Android Studio (for emulator) or physical device with Expo Go
- Xcode (Mac only, for iOS)

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd "moodle lms frontend/mobile"

# Install dependencies
npm install

# Start the development server
npx expo start

# Open on device:
# - Scan QR with Expo Go app
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator (Mac only)
```

Use your Moodle username and password from `https://mh.unilearn.org.in` to log in.

---

## License

Developed for the **Maharashtra State government's UNIlearn initiative** in partnership with **UNICEF** and **United Nations** programmes.

---

*Built for Maharashtra's learners.*
