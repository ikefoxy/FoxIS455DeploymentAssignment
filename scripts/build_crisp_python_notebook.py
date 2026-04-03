#!/usr/bin/env python3
"""Generate Notebooks/IS455_Fraud_CRISP_DM.ipynb (Python / sklearn CRISP-DM deliverable)."""

import json
import os
import textwrap
import uuid


def _cell_id():
    return str(uuid.uuid4())


def md(s):
    return {
        "cell_type": "markdown",
        "id": _cell_id(),
        "metadata": {},
        "source": [line + "\n" for line in textwrap.dedent(s).strip("\n").split("\n")],
    }


def py(s):
    src = textwrap.dedent(s).strip("\n") + "\n"
    return {
        "cell_type": "code",
        "id": _cell_id(),
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [src],
    }


cells = []

cells.append(
    md(
        """
# IS455 — Part 2: CRISP-DM pipeline for `is_fraud` (Python)

**Course:** Machine Learning in Python (IS 455) — **Chapter 17 deployment integration**

This notebook builds an end-to-end **classification** pipeline on **`shop.db`** (`orders` + `customers`), predicting **`orders.is_fraud`**.

**Environment:** Python 3.10+ with `pandas`, `scikit-learn`, `matplotlib`, `seaborn`, and the standard library `sqlite3` module (no SQLAlchemy required for loading `shop.db`).

```bash
# From the repository root:
pip install -r Notebooks/requirements.txt
```
(Or: `pip install pandas scikit-learn matplotlib seaborn joblib`.)

Open this file in **Jupyter**, **VS Code**, or **Google Colab** (upload `shop.db` or mount Drive).
"""
    )
)

cells.append(py("""%matplotlib inline"""))

cells.append(py("""import sqlite3
import warnings
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
import seaborn as sns
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectFromModel
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    RocCurveDisplay,
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore", category=FutureWarning)
sns.set_theme(style="whitegrid", context="notebook")
RNG = 42
np.random.seed(RNG)
"""))

cells.append(py("""# Resolve path to shop.db (notebook lives in Notebooks/)
ROOT = Path.cwd()
if (ROOT / "shop.db").exists():
    DB_PATH = ROOT / "shop.db"
else:
    for candidate in [
        ROOT.parent / "ShopWeb" / "Data" / "shop.db",
        ROOT.parent / "web" / "data" / "shop.db",
        ROOT.parent / "Data" / "shop.db",
    ]:
        if candidate.exists():
            DB_PATH = candidate
            break
    else:
        raise FileNotFoundError(
            "Place shop.db next to this notebook, or use ShopWeb/Data/shop.db / web/data/shop.db in the repo."
        )

print(f"Database: {DB_PATH.resolve()}")
"""))

cells.append(
    md(
        """
## 1) Business understanding (CRISP-DM)

**Business problem:** E-commerce orders sometimes involve **payment fraud**. Reviewing every order manually does not scale.

**Analytics problem:** Build a **binary classifier** that estimates whether `is_fraud = 1` using **order- and customer-level features** available at checkout time.

**Success criteria (measurable):**
- **Discrimination:** ROC-AUC on held-out data (ranking suspicious orders).
- **Operational:** Reasonable **precision/recall** tradeoff for a verification queue (tune threshold in production).
- **Deployment:** Serialized **pipeline** (preprocessing + model) loadable by batch or online scoring jobs (**Ch. 17**).

**Constraints:** Do not use **`risk_score`** as an input feature if it is produced by the same system you are training (label leakage). Here we **exclude** `risk_score` from predictors.
"""
    )
)

cells.append(
    md(
        """
## 2) Data understanding & exploration (Ch. 6, 8)

**Ch. 6 — Feature-level exploration:** distributions, missingness, categorical frequencies.

**Ch. 8 — Relationships:** association of inputs with the target; multivariate structure (correlations among numerics).
"""
    )
)

cells.append(py("""SQL = \"\"\"
SELECT
  o.order_id,
  o.customer_id,
  o.order_datetime,
  o.billing_zip,
  o.shipping_zip,
  o.shipping_state,
  o.payment_method,
  o.device_type,
  o.ip_country,
  o.promo_used,
  o.order_subtotal,
  o.shipping_fee,
  o.tax_amount,
  o.order_total,
  o.is_fraud,
  c.gender,
  c.customer_segment,
  c.loyalty_tier
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
\"\"\"

df = pd.read_sql_query(SQL, sqlite3.connect(DB_PATH))
df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
df["order_hour"] = df["order_datetime"].dt.hour.fillna(-1).astype(int)
df["order_dow"] = df["order_datetime"].dt.dayofweek.fillna(-1).astype(int)

print("Shape:", df.shape)
print(df.head())
df.info()
"""))

cells.append(py("""# Target prevalence (class imbalance)
vc = df["is_fraud"].value_counts()
print("Class counts:\\n", vc)
print("Fraud rate:", f"{100 * vc.get(1, 0) / len(df):.2f}%")
"""))

cells.append(py("""# Numeric summaries (Ch. 6)
num_cols = [
    "promo_used",
    "order_subtotal",
    "shipping_fee",
    "tax_amount",
    "order_total",
    "order_hour",
    "order_dow",
]
print(df[num_cols + ["is_fraud"]].groupby("is_fraud").mean())
print(df[num_cols].describe().T)
"""))

cells.append(py("""# Ch. 8 — correlation among numeric features (excluding target)
cm = df[num_cols].corr(numeric_only=True)
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt=".2f", cmap="vlag", center=0)
plt.title("Correlation matrix — numeric order features")
plt.tight_layout()
plt.show()
"""))

cells.append(py("""# Categorical frequencies vs fraud rate (exploratory)
for col in ["payment_method", "device_type", "ip_country"]:
    ct = pd.crosstab(df[col], df["is_fraud"], normalize="index")
    ct.columns = ["legit_share", "fraud_share"]
    print(col)
    print(ct.sort_values("fraud_share", ascending=False).head(10))
"""))

cells.append(
    md(
        """
## 3) Data preparation & wrangling (Ch. 2–4, 7)

**Ch. 2–4:** Clean types, handle missing categoricals, avoid leakage.

**Ch. 7 — Automated preparation:** sklearn `Pipeline` + `ColumnTransformer` so training and deployment share **one** reproducible workflow.

**Feature set:** categoricals (one-hot) + numeric (scaled). **`risk_score`** excluded. **`promo_code`** omitted (high cardinality / sparse); could be engineered separately.
"""
    )
)

cells.append(py("""TARGET = "is_fraud"
DROP = {"order_id", "customer_id", "order_datetime", "is_fraud"}
# Note: risk_score is NOT loaded from SQL (avoid label leakage).

feature_cols = [c for c in df.columns if c not in DROP and c != TARGET]

# Treat non-numeric dtypes (object, string, category, boolean) as categorical for OHE;
# pandas StringDtype is not `== object`, so use is_numeric_dtype.
cat_cols = [c for c in feature_cols if not is_numeric_dtype(df[c])]
num_cols = [c for c in feature_cols if is_numeric_dtype(df[c])]

# Fill missing strings for OHE
for c in cat_cols:
    df[c] = df[c].fillna("missing").astype(str)

X = df[feature_cols]
y = df[TARGET].astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RNG
)
print("Train:", X_train.shape, "Test:", X_test.shape)
"""))

cells.append(py("""def make_preprocess():
    return ColumnTransformer(
        [
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                cat_cols,
            ),
            ("num", StandardScaler(), num_cols),
        ]
    )

preprocess = make_preprocess()
"""))

cells.append(
    md(
        """
## 4) Classification modeling (Ch. 13) & ensembles (Ch. 14)

**Ch. 13 — Classification:** logistic regression **baseline**; **nonlinear** decision boundaries via tree ensembles.

**Ch. 14 — Ensembles:** **Random Forest** (bagging + randomized trees) and **Gradient Boosting** (sequential error correction).

All models share the **same preprocessing** pipeline for fair comparison.
"""
    )
)

cells.append(py("""def eval_model(name, pipe):
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    print(f"=== {name} ===")
    print("Accuracy:", accuracy_score(y_test, pred))
    print("ROC-AUC:", roc_auc_score(y_test, proba))
    print("F1:", f1_score(y_test, pred))
    print(classification_report(y_test, pred, digits=3))
    return pipe

baseline = Pipeline(
    [("prep", make_preprocess()), ("clf", LogisticRegression(max_iter=2000, random_state=RNG))]
)
eval_model("LogisticRegression (baseline)", baseline)

rf_pipe = Pipeline(
    [
        ("prep", make_preprocess()),
        (
            "clf",
            RandomForestClassifier(
                n_estimators=200,
                max_depth=None,
                min_samples_leaf=5,
                random_state=RNG,
                n_jobs=-1,
                class_weight="balanced_subsample",
            ),
        ),
    ]
)
rf_model = eval_model("RandomForest (ensemble)", rf_pipe)

gb_pipe = Pipeline(
    [
        ("prep", make_preprocess()),
        (
            "clf",
            GradientBoostingClassifier(
                random_state=RNG,
                n_estimators=150,
                learning_rate=0.08,
                max_depth=3,
            ),
        ),
    ]
)
gb_model = eval_model("GradientBoosting (ensemble)", gb_pipe)
"""))

cells.append(
    md(
        """
## 5) Evaluation, model selection & tuning (Ch. 15)

Compare models on **held-out** data; address **class imbalance** via `class_weight` / ROC-AUC / F1.

**Hyperparameter tuning:** `GridSearchCV` with **stratified k-fold** on **Random Forest** (strong baseline, tunable).
"""
    )
)

cells.append(py("""# Confusion matrix + ROC for best hand-picked ensemble (RF)
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ConfusionMatrixDisplay.from_estimator(rf_model, X_test, y_test, ax=ax[0])
ax[0].set_title("RandomForest — confusion matrix")
RocCurveDisplay.from_estimator(rf_model, X_test, y_test, ax=ax[1])
ax[1].set_title("RandomForest — ROC")
plt.tight_layout()
plt.show()
"""))

cells.append(py("""param_grid = {
    "clf__n_estimators": [100, 300],
    "clf__max_depth": [None, 12, 20],
    "clf__min_samples_leaf": [1, 5],
}

cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=RNG)
grid = GridSearchCV(
    rf_pipe,
    param_grid=param_grid,
    scoring="roc_auc",
    cv=cv,
    n_jobs=-1,
    refit=True,
    verbose=1,
)
grid.fit(X_train, y_train)
print("Best params:", grid.best_params_)
print("Best CV ROC-AUC:", grid.best_score_)

best_rf = grid.best_estimator_
proba = best_rf.predict_proba(X_test)[:, 1]
pred = (proba >= 0.5).astype(int)
print("Test ROC-AUC:", roc_auc_score(y_test, proba))
print(classification_report(y_test, pred, digits=3))
"""))

cells.append(
    md(
        """
## 6) Feature selection (Ch. 16)

**Goal:** reduce variance / complexity by keeping inputs with strong signal.

Approach: **`SelectFromModel`** using **RandomForest** `feature_importances_` fitted on **preprocessed** data. We embed selection **after** preprocessing inside a single `Pipeline` for deployment consistency.

*Alternative (also valid):* mutual information on numeric columns only, or L1 logistic regression for sparse linear selection.
"""
    )
)

cells.append(py("""# Pipeline: preprocess -> RF (for importance) -> select threshold -> final RF
prep = make_preprocess()
Xtr = prep.fit_transform(X_train, y_train)
Xte = prep.transform(X_test)

rf_sel = RandomForestClassifier(
    n_estimators=200,
    random_state=RNG,
    n_jobs=-1,
    class_weight="balanced_subsample",
)
rf_sel.fit(Xtr, y_train)

selector = SelectFromModel(rf_sel, prefit=True, threshold="median")
Xtr_s = selector.transform(Xtr)
Xte_s = selector.transform(Xte)

final_rf = RandomForestClassifier(
    n_estimators=300,
    random_state=RNG,
    n_jobs=-1,
    class_weight="balanced_subsample",
)
final_rf.fit(Xtr_s, y_train)
proba_s = final_rf.predict_proba(Xte_s)[:, 1]
print("After feature selection — Test ROC-AUC:", roc_auc_score(y_test, proba_s))

# For deployment, a single sklearn Pipeline is cleaner; we refit the winning GridSearch model
# and document feature selection as an analysis step above.
selected_support = selector.get_support()
print("Features kept after selection:", int(selected_support.sum()), "/", len(selected_support))
"""))

cells.append(
    md(
        """
## 7) Deployment — model serialization (Ch. 17)

Ship **one `Pipeline` object** (preprocessing + estimator) with **`joblib`**. Your web app or batch job loads the artifact and calls **`predict` / `predict_proba`** on new rows with the **same columns**.

Optional: convert to **ONNX** for cross-language inference (e.g., .NET); optional register in a model registry for CI/CD.
"""
    )
)

cells.append(py("""DEPLOY_DIR = Path("../ShopWeb/MLModels")
DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
artifact = DEPLOY_DIR / "fraud_sklearn_pipeline.joblib"

# Ship the tuned Random Forest pipeline (best from GridSearchCV)
joblib.dump(grid.best_estimator_, artifact)
print("Saved:", artifact.resolve())

# Smoke test load
proba_test = grid.best_estimator_.predict_proba(X_test)[:, 1]
loaded = joblib.load(artifact)
assert np.allclose(loaded.predict_proba(X_test)[:, 1], proba_test, atol=1e-6)
print("Load/predict smoke test OK.")
"""))

cells.append(
    md(
        """
## Summary

| Phase | What we did |
|-------|-------------|
| Business | Defined fraud detection objective & success metrics |
| Data understanding | SQLite load, summaries, correlations, fraud rates by category |
| Preparation | `ColumnTransformer` + OHE + scaling; stratified split |
| Modeling | Logistic regression, Random Forest, Gradient Boosting |
| Evaluation / tuning | Metrics, ROC, confusion matrix, `GridSearchCV` |
| Feature selection | `SelectFromModel` (median threshold) |
| Deployment | `joblib` pipeline artifact under `ShopWeb/MLModels/` |

**Next steps in production:** monitor drift, calibrate thresholds for cost-sensitive decisions, and wire this artifact (or ONNX) into the deployment pipeline from Chapter 17.
"""
    )
)

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {
            "name": "python",
            "version": "3.11.0",
        },
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

out = os.path.join(os.path.dirname(__file__), "..", "Notebooks", "IS455_Fraud_CRISP_DM.ipynb")
out = os.path.normpath(out)
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("Wrote", out)
