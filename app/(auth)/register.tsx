import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-12">
          <Text className="text-4xl font-inter-bold text-primary">WTT</Text>
          <Text className="text-base text-gray-500 dark:text-gray-400 mt-2 font-inter">
            Create your account
          </Text>
        </View>

        <Text className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1">
          Username
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-4 font-inter"
          placeholder="Choose a username"
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1">
          Email
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-4 font-inter"
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1">
          Password
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-6 font-inter"
          placeholder="Password (min 6 chars)"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center mb-6"
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-inter-semibold">
              Create Account
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-500 dark:text-gray-400 font-inter text-sm">
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-primary font-inter-semibold text-sm">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
