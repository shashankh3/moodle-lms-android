import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { X, ChevronDown, Check } from 'lucide-react-native';

export default function AccessibilitySettingsModal() {
  const { t } = useTranslation();
  const {
    accessibilityModalVisible,
    closeAccessibilityModal,
    fontType,
    showAccessibilityToolbar,
    saveAccessibilitySettings,
  } = useTheme();

  const [selectedFont, setSelectedFont] = useState(fontType || 'default');
  const [toolbarEnabled, setToolbarEnabled] = useState(showAccessibilityToolbar || false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Sync state when modal becomes visible
  useEffect(() => {
    if (accessibilityModalVisible) {
      setSelectedFont(fontType || 'default');
      setToolbarEnabled(showAccessibilityToolbar || false);
      setDropdownOpen(false);
    }
  }, [accessibilityModalVisible, fontType, showAccessibilityToolbar]);

  const handleSave = () => {
    saveAccessibilitySettings(selectedFont, toolbarEnabled);
  };

  const handleCancel = () => {
    closeAccessibilityModal();
  };

  return (
    <Modal
      visible={accessibilityModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeAccessibilityModal}
    >
      <TouchableWithoutFeedback onPress={closeAccessibilityModal}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => dropdownOpen && setDropdownOpen(false)}>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  {t('accessibility_settings') || 'ACCESSIBILITY SETTINGS'}
                </Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={closeAccessibilityModal}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Body */}
              <View style={styles.body}>
                {/* Font Type Selector */}
                <Text style={styles.fieldLabel}>{t('font_type') || 'Font type'}</Text>

                <View style={styles.dropdownWrapper}>
                  <TouchableOpacity
                    style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
                    onPress={() => setDropdownOpen(prev => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.dropdownValue}>
                      {selectedFont === 'dyslexic'
                        ? t('dyslexic_font') || 'Dyslexic font'
                        : t('default_font') || 'Default font'}
                    </Text>
                    <ChevronDown size={18} color="#0F172A" />
                  </TouchableOpacity>

                  {/* Dropdown Options Popup */}
                  {dropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      <TouchableOpacity
                        style={[
                          styles.dropdownOption,
                          selectedFont === 'default' && styles.dropdownOptionActive,
                        ]}
                        onPress={() => {
                          setSelectedFont('default');
                          setDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            selectedFont === 'default' && styles.dropdownOptionTextActive,
                          ]}
                        >
                          {t('default_font') || 'Default font'}
                        </Text>
                        {selectedFont === 'default' && <Check size={16} color="#00AEEF" />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dropdownOption,
                          selectedFont === 'dyslexic' && styles.dropdownOptionActive,
                        ]}
                        onPress={() => {
                          setSelectedFont('dyslexic');
                          setDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            selectedFont === 'dyslexic' && styles.dropdownOptionTextActive,
                          ]}
                        >
                          {t('dyslexic_font') || 'Dyslexic font'}
                        </Text>
                        {selectedFont === 'dyslexic' && <Check size={16} color="#00AEEF" />}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Checkbox: Enable accessibility toolbar */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setToolbarEnabled(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, toolbarEnabled && styles.checkboxChecked]}>
                    {toolbarEnabled && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {t('enable_accessibility_toolbar') || 'Enable accessibility toolbar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons matching Screenshot 1 */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveBtnText}>{t('save') || 'Save'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancel}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
              </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    marginBottom: 8,
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 20,
    marginBottom: 20,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#00AEEF',
    backgroundColor: '#FFFFFF',
  },
  dropdownButtonActive: {
    borderColor: '#004F7A',
  },
  dropdownValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 30,
    paddingVertical: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionActive: {
    backgroundColor: 'rgba(0, 174, 239, 0.08)',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#00AEEF',
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#64748B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#00AEEF',
    borderColor: '#00AEEF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#004F7A',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelBtn: {
    backgroundColor: '#00AEEF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
