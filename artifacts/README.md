Trained model versions, one folder per version (`piq-<date>-<hash>`).

Committed: the small model files (baseline JSON, XGBoost file under 1 MB), calibration files, feature
fingerprint, `metadata.json`, `evaluation.json` and `manifest.json` (SHA-256 of every file).
Not committed: `test_scores.npz`, a throw-away score cache that `make verify` and `make replay` can rebuild.
All numbers are from simulated sample data. `evaluation.json` is written once per version and never overwritten.
