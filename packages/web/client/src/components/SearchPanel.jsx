import React, { useState, useEffect } from 'react';
import { api } from '../api';

const MARK_TYPES = ['', 'TRADEMARK', 'SERVICE MARK', 'COLLECTIVE MARK', 'CERTIFICATION MARK'];
const HISTORY_KEY = 'uspto-search-history';
const MAX_HISTORY = 20;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export default function SearchPanel({ onResults, hasResults }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [filters, setFilters] = useState({
    alive: '',
    markType: '',
    internationalClass: '',
    ownerName: '',
    filedAfter: '',
    filedBefore: '',
  });

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  async function runSearch(searchQuery, searchFilters) {
    if (!searchQuery.trim()) return;

    setQuery(searchQuery);
    setFilters(searchFilters);
    setLoading(true);
    setError(null);

    try {
      const options = {};
      if (searchFilters.alive === 'true') options.alive = true;
      if (searchFilters.alive === 'false') options.alive = false;
      if (searchFilters.markType) options.markType = searchFilters.markType;
      if (searchFilters.internationalClass) options.internationalClass = searchFilters.internationalClass;
      if (searchFilters.ownerName) options.ownerName = searchFilters.ownerName;
      if (searchFilters.filedAfter) options.filedAfter = searchFilters.filedAfter;
      if (searchFilters.filedBefore) options.filedBefore = searchFilters.filedBefore;

      const results = await api.searchUSPTO(searchQuery.trim(), options);
      onResults(results);

      // Save to history
      const entry = {
        query: searchQuery.trim(),
        filters: searchFilters,
        resultCount: results.numFound || results.items?.length || 0,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory().filter(h => h.query !== entry.query || JSON.stringify(h.filters) !== JSON.stringify(entry.filters))];
      saveHistory(updated);
      setHistory(updated.slice(0, MAX_HISTORY));
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    runSearch(query, filters);
  }

  function handleHistoryClick(entry) {
    const restoredFilters = entry.filters || { alive: '', markType: '', internationalClass: '', ownerName: '', filedAfter: '', filedBefore: '' };
    const hasFilters = Object.values(restoredFilters).some(v => v !== '');
    if (hasFilters) setShowFilters(true);
    runSearch(entry.query, restoredFilters);
  }

  function clearHistory() {
    saveHistory([]);
    setHistory([]);
  }

  function clearFilters() {
    setFilters({ alive: '', markType: '', internationalClass: '', ownerName: '', filedAfter: '', filedBefore: '' });
  }

  function formatFilterSummary(f) {
    const parts = [];
    if (f.alive === 'true') parts.push('Live');
    if (f.alive === 'false') parts.push('Dead');
    if (f.markType) parts.push(f.markType);
    if (f.internationalClass) parts.push(f.internationalClass);
    if (f.ownerName) parts.push(`Owner: ${f.ownerName}`);
    if (f.filedAfter) parts.push(`After ${f.filedAfter}`);
    if (f.filedBefore) parts.push(`Before ${f.filedBefore}`);
    return parts.join(', ');
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="search-panel">
      <h2>Search Trademarks</h2>
      <form onSubmit={handleSearch}>
        <div className="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter trademark name, serial number, or registration number..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="filter-toggle">
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`} {showFilters ? '\u25B2' : '\u25BC'}
          </button>
          {activeFilterCount > 0 && (
            <button type="button" className="btn-link" onClick={clearFilters} style={{ marginLeft: 12 }}>
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="filter-panel">
            <div className="filter-row">
              <label>
                Status
                <select value={filters.alive} onChange={e => updateFilter('alive', e.target.value)}>
                  <option value="">All</option>
                  <option value="true">Live</option>
                  <option value="false">Dead</option>
                </select>
              </label>

              <label>
                Mark Type
                <select value={filters.markType} onChange={e => updateFilter('markType', e.target.value)}>
                  {MARK_TYPES.map(t => (
                    <option key={t} value={t}>{t || 'All'}</option>
                  ))}
                </select>
              </label>

              <label>
                International Class
                <input
                  type="text"
                  value={filters.internationalClass}
                  onChange={e => updateFilter('internationalClass', e.target.value)}
                  placeholder="e.g. IC 025"
                />
              </label>
            </div>

            <div className="filter-row">
              <label>
                Owner
                <input
                  type="text"
                  value={filters.ownerName}
                  onChange={e => updateFilter('ownerName', e.target.value)}
                  placeholder="e.g. Nike"
                />
              </label>

              <label>
                Filed After
                <input
                  type="date"
                  value={filters.filedAfter}
                  onChange={e => updateFilter('filedAfter', e.target.value)}
                />
              </label>

              <label>
                Filed Before
                <input
                  type="date"
                  value={filters.filedBefore}
                  onChange={e => updateFilter('filedBefore', e.target.value)}
                />
              </label>
            </div>
          </div>
        )}
      </form>
      {error && <div className="error-message">{error}</div>}

      {!hasResults && history.length > 0 && (
        <div className="search-history">
          <div className="search-history-header">
            <h3>Recent Searches</h3>
            <button type="button" className="btn-link" onClick={clearHistory}>Clear</button>
          </div>
          {history.map((entry, i) => {
            const filterSummary = formatFilterSummary(entry.filters || {});
            return (
              <div key={i} className="history-entry" onClick={() => handleHistoryClick(entry)}>
                <div className="history-query">{entry.query}</div>
                <div className="history-meta">
                  <span>{entry.resultCount} results</span>
                  <span>{formatTime(entry.timestamp)}</span>
                  {filterSummary && <span className="history-filters">{filterSummary}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
