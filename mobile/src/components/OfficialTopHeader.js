import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import UniLearnLogo from './UniLearnLogo';
import { Menu, ChevronDown, Check, Accessibility } from 'lucide-react-native';

export default function OfficialTopHeader({ title, onOpenDashboard }) {
  const { t, i18n } = useTranslation();
  const { theme, openDrawer, openAccessibilityModal } = useTheme();
  const [langOpen, setLangOpen] = useState(false);

  const currentLangLabel =
    i18n.language === 'mr'
      ? 'मराठी'
      : i18n.language === 'hi'
      ? 'हिन्दी'
      : 'English';

  return (
    <View style={[styles.container, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
      {/* Left: Hamburger Menu */}
      <View style={styles.leftGroup}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={openDrawer}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.75}
        >
          <Menu size={22} color={theme.headerText} />
        </TouchableOpacity>
      </View>

      {/* Center: UNIlearn Logo */}
      <View style={styles.centerLogo} pointerEvents="box-none">
        <UniLearnLogo size={20} showMaharashtra={true} darkBg={true} onOpenDashboard={onOpenDashboard} />
      </View>

      {/* Right: Accessibility Icon & Language Selector */}
      <View style={styles.rightGroup}>
        <TouchableOpacity
          style={[styles.a11yBtn, theme.mode === 'highContrast' && { backgroundColor: theme.badgeBg }]}
          onPress={openAccessibilityModal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Accessibility size={19} color={theme.headerText} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langBtn, theme.mode === 'highContrast' && { backgroundColor: theme.badgeBg }]}
          onPress={() => setLangOpen(prev => !prev)}
          activeOpacity={0.75}
        >
          <Text style={[styles.langBtnText, { color: theme.headerText }]}>{currentLangLabel}</Text>
          <ChevronDown size={12} color={theme.headerText} />
        </TouchableOpacity>

        {langOpen && (
          <View style={styles.langDropdown}>
            <TouchableOpacity
              style={styles.langOption}
              onPress={() => {
                i18n.changeLanguage('en');
                setLangOpen(false);
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
                setLangOpen(false);
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
                setLangOpen(false);
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
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 1000,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  menuBtn: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  centerLogo: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    position: 'relative',
    zIndex: 10,
  },
  a11yBtn: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  langBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    gap: 4,
  },
  langBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  langDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 115,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 2000,
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
});

