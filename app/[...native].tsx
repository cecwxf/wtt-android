import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

export default function NativeDeepLinkRedirect() {
  useEffect(() => {
    router.replace('/webview');
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#F7F8FB' }} />;
}
