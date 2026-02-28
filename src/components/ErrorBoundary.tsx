/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback error UI with detailed information.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    console.log('[ErrorBoundary] Initialized');
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[ErrorBoundary] getDerivedStateFromError:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] componentDidCatch:', {
      error: error.toString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      console.log('[ErrorBoundary] Rendering error UI');
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#0f172a', 
          color: 'white', 
          minHeight: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '20px' }}>
            ❌ Erro na Aplicação
          </h1>
          <div style={{ 
            backgroundColor: '#1e293b', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h2 style={{ color: '#f97316', marginBottom: '10px' }}>Erro:</h2>
            <pre style={{ 
              color: '#fca5a5', 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {this.state.error?.toString()}
            </pre>
          </div>
          
          {this.state.error?.stack && (
            <div style={{ 
              backgroundColor: '#1e293b', 
              padding: '15px', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: '#f97316', marginBottom: '10px' }}>Stack Trace:</h2>
              <pre style={{ 
                color: '#94a3b8', 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px'
              }}>
                {this.state.error.stack}
              </pre>
            </div>
          )}
          
          {this.state.errorInfo?.componentStack && (
            <div style={{ 
              backgroundColor: '#1e293b', 
              padding: '15px', 
              borderRadius: '8px'
            }}>
              <h2 style={{ color: '#f97316', marginBottom: '10px' }}>Component Stack:</h2>
              <pre style={{ 
                color: '#94a3b8', 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
