import { Alert } from 'react-native';

export function showMessage(title, message) {
  Alert.alert(title, message);
}

export function showConfirm(title, message, onConfirm) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', onPress: onConfirm },
  ]);
}
