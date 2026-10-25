-- Jendela rate limit dibuang berkala (lihat pruneRateLimits), jadi kolom ini
-- butuh indeks sendiri: tanpa itu DELETE menyapu seluruh tabel.
CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
