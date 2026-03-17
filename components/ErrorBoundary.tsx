import React, { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' }}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 12 }}>
            {this.props.fallbackMessage || 'Something went wrong'}
          </Text>
          {this.state.error && (
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={{
              marginTop: 16,
              backgroundColor: '#6366F1',
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 8,
            }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
