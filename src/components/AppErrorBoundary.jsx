import { Component } from 'react';
import * as labels from '../i18n/locales/reliability.js';
import '../styles/reliability.css';

function fallbackLabels() {
  const language = typeof document === 'undefined' ? 'ru' : document.documentElement.lang.slice(0, 2).toLowerCase();
  return labels[language] ?? labels.ru;
}

// This screen deliberately does not depend on providers: it also catches failures
// while the app restores a session, loads translations or sets up its theme.
export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    const text = fallbackLabels();
    return <main className="app-failure" role="alert">
      <div className="app-failure__card">
        <span className="app-failure__symbol" aria-hidden="true">!</span>
        <h1>{text['reliability.errorTitle']}</h1>
        <p>{text['reliability.errorText']}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>{text['reliability.reload']}</button>
      </div>
    </main>;
  }
}
