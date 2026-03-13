import React, { useState } from 'react';

export default function SearchPanel({ onResults }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = await window.api.searchUSPTO(query.trim());
      onResults(results);
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
