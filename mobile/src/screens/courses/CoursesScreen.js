import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { Search, ChevronRight, Layers } from 'lucide-react-native';
import OfficialTopHeader from '../../components/OfficialTopHeader';

export default function CoursesScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = useCallback(async () => {
    const list = await MobileAPI.getCourses(currentUser);
    setCourses(list);
  }, [currentUser]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useFocusEffect(
    useCallback(() => {
      fetchCourses();
    }, [fetchCourses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  // Derive dynamic categories only from real Moodle courses
  const distinctCategories = Array.from(
    new Set(courses.map((c) => c.category || c.department).filter(Boolean))
  );
  const categories = distinctCategories.length > 1 ? ['All', ...distinctCategories] : [];

  const filteredCourses = courses.filter((course) => {
    const title = course.fullname || course.name || '';
    const code = course.shortname || course.code || '';
    const summary = course.summary || '';
    const cat = course.category || course.department || '';

    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      summary.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || cat === selectedCategory || cat.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <OfficialTopHeader title="My Courses" />
      {/* Search & Filter Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder }]}>
          <Search size={18} color={theme.textDim} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search enrolled courses, modules..."
            placeholderTextColor={theme.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Dynamic Category Pills (Only shown if multiple real categories exist) */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: isSelected ? '#FFFFFF' : theme.textMuted },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Courses List */}
      <FlashList
        data={filteredCourses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Layers size={44} color={theme.textDim} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Courses Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {searchQuery
                ? 'No matching courses found for your search.'
                : 'Your real courses from Moodle will appear here once enrolled.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const title = item.fullname || item.name || `Course ${item.id}`;
          const code = item.shortname || item.code || `CRS-${item.id}`;
          const summary = item.summary || '';
          const category = item.category || item.department || 'Curriculum Module';
          const instructor = item.instructor || '';
          const progress = item.progress || 0;
          const imageUrl = item.image || null;

          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, padding: 0, overflow: 'hidden' }]}
              onPress={() => navigation.navigate('CourseDetail', { courseId: item.id, title })}
              activeOpacity={0.85}
            >
              {imageUrl && (
                <Image 
                  source={{ uri: imageUrl }} 
                  style={{ width: '100%', height: 130 }}
                  contentFit="cover"
                />
              )}
              <View style={{ padding: 16 }}>
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(0, 174, 239, 0.12)' }]}>
                    <Text style={[styles.badgeText, { color: '#00AEEF' }]}>{category}</Text>
                  </View>
                  <Text style={[styles.code, { color: theme.textDim }]}>{code}</Text>
                </View>

                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {title}
                </Text>

              {summary ? (
                <Text style={[styles.summary, { color: theme.textMuted }]} numberOfLines={2}>
                  {summary}
                </Text>
              ) : null}

              {instructor ? (
                <View style={styles.instructorRow}>
                  <View style={[styles.instructorAvatarPlaceholder, { backgroundColor: theme.navy }]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                      {instructor.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.instructorName, { color: theme.textMuted }]}>{instructor}</Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.progressSection}>
                  <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSubtle }]}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={[styles.progressText, { color: theme.textDim }]}>{progress}% Complete</Text>
                </View>
                <ChevronRight size={18} color={theme.textDim} />
              </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  categoriesScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  code: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 6,
  },
  summary: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  instructorAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructorName: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 79, 122, 0.08)',
  },
  progressSection: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
