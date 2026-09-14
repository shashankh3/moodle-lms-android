import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import UniLearnLogo from './UniLearnLogo';
import {
  Menu,
  X,
  Gauge,
  PlusSquare,
  Award,
  Calendar,
  FileText,
  GraduationCap,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Accessibility,
  Globe,
  Check,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 320);

export default function OfficialDrawer({ navigation }) {
  const { t, i18n } = useTranslation();
  const { theme, drawerOpen, closeDrawer, openAccessibilityModal } = useTheme();
  const { enrolledCourses } = useAuth();

  const [activeItem, setActiveItem] = useState('Dashboard');
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const currentLangLabel =
    i18n.language === 'mr'
      ? 'मराठी'
      : i18n.language === 'hi'
      ? 'हिन्दी'
      : 'English';

  const handleNavigate = (screenName, itemName) => {
    setActiveItem(itemName);
    closeDrawer();
    if (navigation && screenName) {
      navigation.navigate(screenName);
    }
  };

  const handleOpenAccessibility = () => {
    closeDrawer();
    openAccessibilityModal();
  };

  return (
    <Modal
      visible={drawerOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={closeDrawer}
    >
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.drawerContent, { backgroundColor: '#FFFFFF' }]}>
              {/* Top Header matching Screenshot 2 */}
              <View style={styles.topHeader}>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={closeDrawer}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Menu size={24} color="#334155" />
                </TouchableOpacity>

                <View style={styles.logoContainer}>
                  <UniLearnLogo size={22} showMaharashtra={false} pill={true} />
                </View>

                {/* Language Selector */}
                <View style={styles.langSelectorWrapper}>
                  <TouchableOpacity
                    style={styles.langSelectorBtn}
                    onPress={() => setLangMenuOpen(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.langSelectorText}>{currentLangLabel}</Text>
                    <ChevronDown size={14} color="#64748B" />
                  </TouchableOpacity>

                  {langMenuOpen && (
                    <View style={styles.langDropdown}>
                      <TouchableOpacity
                        style={styles.langOption}
                        onPress={() => {
                          i18n.changeLanguage('en');
                          setLangMenuOpen(false);
                        }}
                      >
                        <Text style={[styles.langOptionText, i18n.language === 'en' && styles.langOptionActiveText]}>
                          English
                        </Text>
                        {i18n.language === 'en' && <Check size={14} color="#00AEEF" />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.langOption}
                        onPress={() => {
                          i18n.changeLanguage('mr');
                          setLangMenuOpen(false);
                        }}
                      >
                        <Text style={[styles.langOptionText, i18n.language === 'mr' && styles.langOptionActiveText]}>
                          मराठी
                        </Text>
                        {i18n.language === 'mr' && <Check size={14} color="#00AEEF" />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.langOption}
                        onPress={() => {
                          i18n.changeLanguage('hi');
                          setLangMenuOpen(false);
                        }}
                      >
                        <Text style={[styles.langOptionText, i18n.language === 'hi' && styles.langOptionActiveText]}>
                          हिन्दी
                        </Text>
                        {i18n.language === 'hi' && <Check size={14} color="#00AEEF" />}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Navigation Menu Items */}
              <ScrollView
                style={styles.menuScroll}
                contentContainerStyle={styles.menuScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Dashboard */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeItem === 'Dashboard' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('DashboardTab', 'Dashboard')}
                  activeOpacity={0.8}
                >
                  <Gauge
                    size={20}
                    color={activeItem === 'Dashboard' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'Dashboard' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_dashboard')}
                  </Text>
                </TouchableOpacity>

                {/* 2. Course Catalog */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeItem === 'Course Catalog' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('CourseCatalogScreen', 'Course Catalog')}
                  activeOpacity={0.8}
                >
                  <PlusSquare
                    size={20}
                    color={activeItem === 'Course Catalog' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'Course Catalog' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_course_catalog')}
                  </Text>
                </TouchableOpacity>

                {/* 3. Certificates */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeItem === 'Certificates' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('CertificatesScreen', 'Certificates')}
                  activeOpacity={0.8}
                >
                  <Award
                    size={20}
                    color={activeItem === 'Certificates' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'Certificates' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_certificates')}
                  </Text>
                </TouchableOpacity>

                {/* 4. Calendar */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeItem === 'Calendar' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('CalendarTab', 'Calendar')}
                  activeOpacity={0.8}
                >
                  <Calendar
                    size={20}
                    color={activeItem === 'Calendar' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'Calendar' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_calendar')}
                  </Text>
                </TouchableOpacity>

                {/* 5. Private files */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeItem === 'Private files' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('PrivateFilesScreen', 'Private files')}
                  activeOpacity={0.8}
                >
                  <FileText
                    size={20}
                    color={activeItem === 'Private files' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'Private files' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_private_files')}
                  </Text>
                </TouchableOpacity>

                {/* 6. My courses */}
                <View>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      activeItem === 'My courses' && styles.menuItemActive,
                    ]}
                    onPress={() => {
                      setActiveItem('My courses');
                      setCoursesExpanded(prev => !prev);
                    }}
                    activeOpacity={0.8}
                  >
                    <GraduationCap
                    size={20}
                    color={activeItem === 'My courses' ? '#FFFFFF' : '#004F7A'}
                    style={styles.itemIcon}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      activeItem === 'My courses' && styles.itemLabelActive,
                    ]}
                  >
                    {t('menu_my_courses')}
                  </Text>
                  <View style={styles.chevronWrapper}>
                    {coursesExpanded ? (
                      <ChevronDown
                        size={18}
                        color={activeItem === 'My courses' ? '#FFFFFF' : '#004F7A'}
                      />
                    ) : (
                      <ChevronLeft
                        size={18}
                        color={activeItem === 'My courses' ? '#FFFFFF' : '#004F7A'}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                  {/* Expanded Sub-courses */}
                  {coursesExpanded && (
                    <View style={styles.subCoursesList}>
                      <TouchableOpacity
                        style={styles.subCourseItem}
                        onPress={() => handleNavigate('CoursesTab', 'My courses')}
                      >
                        <Text style={styles.subCourseText}>• {t('all_enrolled_courses')}</Text>
                      </TouchableOpacity>
                      {(enrolledCourses || []).slice(0, 5).map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.subCourseItem}
                          onPress={() => {
                            closeDrawer();
                            navigation?.navigate('CourseDetailScreen', {
                              courseId: c.id,
                              course: c,
                            });
                          }}
                        >
                          <Text style={styles.subCourseText} numberOfLines={1}>
                            • {c.fullname || c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Fixed Bottom Accessibility Settings Bar matching Screenshot 2 */}
              <TouchableOpacity
                style={styles.accessibilityBar}
                onPress={handleOpenAccessibility}
                activeOpacity={0.85}
              >
                <View style={styles.a11yCircleIcon}>
                  <Accessibility size={18} color="#00AEEF" strokeWidth={2.5} />
                </View>
                <Text style={styles.accessibilityBarText}>{t('menu_accessibility_settings')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row',
  },
  drawerContent: {
    width: DRAWER_WIDTH,
    height: '100%',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  topHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    position: 'relative',
    zIndex: 100,
  },
  menuIconBtn: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  langSelectorWrapper: {
    position: 'relative',
  },
  langSelectorBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  langSelectorText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  langDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 200,
    paddingVertical: 4,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  langOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  langOptionActiveText: {
    color: '#00AEEF',
    fontWeight: '700',
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingVertical: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  menuItemActive: {
    backgroundColor: '#004F7A',
    borderBottomColor: '#004F7A',
  },
  itemIcon: {
    marginRight: 14,
  },
  itemLabel: {
    fontSize: 15,
    color: '#004F7A',
    fontWeight: '700',
    flex: 1,
  },
  itemLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chevronWrapper: {
    marginLeft: 8,
  },
  subCoursesList: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingLeft: 46,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subCourseItem: {
    paddingVertical: 8,
  },
  subCourseText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  accessibilityBar: {
    backgroundColor: '#00AEEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  a11yCircleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessibilityBarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
