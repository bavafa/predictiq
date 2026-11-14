"""The two models and the calibration step. Saved as plain JSON (baseline) and XGBoost's own file (main);
no pickles, so a saved model can be read without running anything."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import xgboost as xgb
from sklearn.linear_model import LogisticRegression

FloatArr = npt.NDArray[np.float64]
EPS = 1e-6


def _sigmoid(z: FloatArr) -> FloatArr:
    return np.asarray(0.5 * (1.0 + np.tanh(z / 2.0)), dtype=np.float64)


def _logit(p: FloatArr) -> FloatArr:
    q = np.clip(p, EPS, 1 - EPS)
    return np.asarray(np.log(q / (1 - q)), dtype=np.float64)


@dataclass(frozen=True)
class Calibrator:
    """kind 'none' leaves scores alone; 'sigmoid' maps logit(score) -> sigmoid(a * logit + b)."""

    kind: str = "none"
    a: float = 1.0
    b: float = 0.0

    def apply(self, raw: FloatArr) -> FloatArr:
        if self.kind == "none":
            return raw
        return _sigmoid(self.a * _logit(raw) + self.b)

    def to_json(self) -> dict[str, Any]:
        return {"kind": self.kind, "a": self.a, "b": self.b}

    @classmethod
    def from_json(cls, d: dict[str, Any]) -> Calibrator:
        return cls(str(d["kind"]), float(d["a"]), float(d["b"]))


def fit_sigmoid(raw: FloatArr, y: npt.NDArray[Any]) -> Calibrator:
    """Platt scaling on the validation scores: logistic regression on logit(score) (two numbers)."""
    lr = LogisticRegression(C=1e6, max_iter=1000)
    lr.fit(_logit(raw).reshape(-1, 1), y.astype(int))
    return Calibrator("sigmoid", float(lr.coef_[0, 0]), float(lr.intercept_[0]))


class LogisticBaseline:
    """Median fill for gaps, standard scaling, then logistic regression. All numbers kept in JSON."""

    def __init__(
        self, median: FloatArr, mean: FloatArr, scale: FloatArr, coef: FloatArr, intercept: float
    ) -> None:
        self.median, self.mean, self.scale, self.coef, self.intercept = median, mean, scale, coef, intercept

    @classmethod
    def fit(
        cls, x: FloatArr, y: npt.NDArray[Any], seed: int, c: float, class_weight: str | None
    ) -> LogisticBaseline:
        median = np.nan_to_num(np.nanmedian(x, axis=0), nan=0.0)
        filled = np.where(np.isnan(x), median, x)
        mean = filled.mean(axis=0)
        scale = filled.std(axis=0)
        scale[scale == 0] = 1.0
        lr = LogisticRegression(C=c, class_weight=class_weight, max_iter=2000, random_state=seed)
        lr.fit((filled - mean) / scale, y.astype(int))
        return cls(median, mean, scale, lr.coef_[0].astype(np.float64), float(lr.intercept_[0]))

    def predict_raw(self, x: FloatArr) -> FloatArr:
        filled = np.where(np.isnan(x), self.median, x)
        return _sigmoid(((filled - self.mean) / self.scale) @ self.coef + self.intercept)

    def save(self, path: Path) -> None:
        d = {
            "kind": "logistic_regression",
            "median": self.median.tolist(),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "coef": self.coef.tolist(),
            "intercept": self.intercept,
        }
        path.write_text(json.dumps(d, sort_keys=True))

    @classmethod
    def load(cls, path: Path) -> LogisticBaseline:
        d = json.loads(path.read_text())

        def arr(k: str) -> FloatArr:
            return np.asarray(d[k], dtype=np.float64)

        return cls(arr("median"), arr("mean"), arr("scale"), arr("coef"), float(d["intercept"]))


class XGBMain:
    def __init__(self, booster: xgb.XGBClassifier) -> None:
        self.booster = booster

    @classmethod
    def fit(cls, x: FloatArr, y: npt.NDArray[Any], seed: int, params: dict[str, Any]) -> XGBMain:
        model = xgb.XGBClassifier(
            objective="binary:logistic",
            tree_method="hist",
            n_jobs=1,
            random_state=seed,
            **params,
        )
        model.fit(x, y.astype(int))
        return cls(model)

    def predict_raw(self, x: FloatArr) -> FloatArr:
        return np.asarray(self.booster.predict_proba(x)[:, 1], dtype=np.float64)

    def save(self, path: Path) -> None:
        self.booster.save_model(path)

    @classmethod
    def load(cls, path: Path) -> XGBMain:
        model = xgb.XGBClassifier()
        model.load_model(path)
        return cls(model)


class ScoringModel:
    """A saved model plus its chosen calibration: features in, chance of failure in 24 hours out."""

    def __init__(self, raw: LogisticBaseline | XGBMain, calibrator: Calibrator) -> None:
        self.raw, self.calibrator = raw, calibrator

    def predict(self, x: FloatArr) -> FloatArr:
        return self.calibrator.apply(self.raw.predict_raw(x))


MODEL_NAMES = ("baseline", "main")
MODEL_FILES = {"baseline": "baseline.json", "main": "main_xgboost.ubj"}
CALIBRATION_FILES = {"baseline": "baseline_calibration.json", "main": "main_calibration.json"}


def load_scoring_model(version_dir: Path, name: str) -> ScoringModel:
    raw: LogisticBaseline | XGBMain
    if name == "baseline":
        raw = LogisticBaseline.load(version_dir / MODEL_FILES[name])
    else:
        raw = XGBMain.load(version_dir / MODEL_FILES[name])
    cal = Calibrator.from_json(json.loads((version_dir / CALIBRATION_FILES[name]).read_text()))
    return ScoringModel(raw, cal)
