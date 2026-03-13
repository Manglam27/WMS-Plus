import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <div style={{ color: '#666', marginBottom: 12 }}>
            The app crashed while rendering this page. The error is shown below.
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#0b1220',
              color: '#e5e7eb',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
            }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

