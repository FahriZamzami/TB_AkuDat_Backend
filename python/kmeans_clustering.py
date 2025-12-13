import sys
import json
import pandas as pd
import numpy as np
import os
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import MinMaxScaler

# ======================================================
# UTILITAS PATH DATASET
# ======================================================

def resolve_dataset_path(file_path):
    """
    Jika dataset hasil cleaning (<name>_cleaned.csv) ada,
    maka SELALU gunakan dataset cleaned tersebut.
    """
    base_dir = os.path.dirname(file_path)
    base_name = os.path.basename(file_path)
    cleaned_name = base_name.replace('.csv', '_cleaned.csv')
    cleaned_path = os.path.join(base_dir, cleaned_name)

    if os.path.exists(cleaned_path):
        return cleaned_path, True
    return file_path, False

# ======================================================
# 1. INFO DATASET
# ======================================================

def get_data_info(file_path, encoding='utf-8', delimiter=','):
    try:
        df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter)
        total_rows = len(df)

        # Numeric columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()

        # Null info per kolom
        null_info = {}
        for col in df.columns:
            null_count = df[col].isnull().sum()
            if null_count > 0:
                null_info[col] = {
                    "count": int(null_count),
                    "percentage": float(null_count / total_rows * 100),
                    "dtype": str(df[col].dtype)
                }

        has_nulls = len(null_info) > 0

        # Duplicate info
        num_duplicates = int(df.duplicated().sum())
        has_duplicates = num_duplicates > 0

        # Convert NaN ke None agar JSON valid
        df = df.where(pd.notnull(df), None)

        print(json.dumps({
            "success": True,
            "columns": df.columns.tolist(),
            "numeric_columns": numeric_columns,
            "num_rows": total_rows,
            "has_nulls": has_nulls,
            "null_info": null_info,
            "has_duplicates": has_duplicates,
            "num_duplicates": num_duplicates,
            # "rows": df.to_dict(orient="records")  # optional, jika mau kirim semua data
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

# ======================================================
# 2. CLEANING DATA
# ======================================================

def clean_data(file_path, cleaning_options, encoding='utf-8', delimiter=','):
    try:
        df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter)
        original_rows = len(df)

        if cleaning_options.get("remove_duplicates", False):
            df = df.drop_duplicates()

        null_handling = cleaning_options.get("null_handling", {})
        columns_dropped = []

        for col, method in null_handling.items():
            if col not in df.columns:
                continue

            if method == "drop_column":
                df = df.drop(columns=[col])
                columns_dropped.append(col)
            elif method == "drop_row":
                df = df.dropna(subset=[col])
            elif method == "mean" and df[col].dtype in ["int64", "float64"]:
                df[col] = df[col].fillna(df[col].mean())
            elif method == "median" and df[col].dtype in ["int64", "float64"]:
                df[col] = df[col].fillna(df[col].median())
            elif method == "mode":
                mode_val = df[col].mode()
                if len(mode_val) > 0:
                    df[col] = df[col].fillna(mode_val[0])

        base_dir = os.path.dirname(file_path)
        base_name = os.path.basename(file_path)
        cleaned_filename = base_name.replace(".csv", "_cleaned.csv")
        cleaned_path = os.path.join(base_dir, cleaned_filename)

        df.to_csv(cleaned_path, index=False, encoding=encoding)

        remaining_nulls = {
            col: int(df[col].isnull().sum())
            for col in df.columns if df[col].isnull().sum() > 0
        }

        print(json.dumps({
            "success": True,
            "cleaned_filename": cleaned_filename,
            "original_rows": original_rows,
            "cleaned_rows": len(df),
            "rows_removed": original_rows - len(df),
            "columns_dropped": columns_dropped,
            "remaining_nulls": remaining_nulls,
            "columns": df.columns.tolist(),
            "numeric_columns": df.select_dtypes(include=[np.number]).columns.tolist(),
            "rows": df.to_dict(orient="records")  # ⬅️ kirim seluruh dataset clean
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

# ======================================================
# 3. ELBOW METHOD
# ======================================================

def calculate_elbow(file_path, column_x, column_y, encoding='utf-8', delimiter=','):
    try:
        dataset_path, _ = resolve_dataset_path(file_path)
        df = pd.read_csv(dataset_path, encoding=encoding, delimiter=delimiter)

        X = df[[column_x, column_y]].dropna().values
        if len(X) == 0:
            raise ValueError("Data kosong")

        X_scaled = MinMaxScaler().fit_transform(X)

        k_values = list(range(2, 11))
        inertias = []

        for k in k_values:
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            km.fit(X_scaled)
            inertias.append(float(km.inertia_))

        print(json.dumps({
            "success": True,
            "dataset_used": os.path.basename(dataset_path),
            "k_values": k_values,
            "inertias": inertias
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

# ======================================================
# 4. K-MEANS + DETAIL CLUSTER
# ======================================================

def perform_clustering(
    file_path,
    key_column,
    column_x,
    column_y,
    num_clusters,
    encoding='utf-8',
    delimiter=','
):
    try:
        dataset_path, _ = resolve_dataset_path(file_path)
        df = pd.read_csv(dataset_path, encoding=encoding, delimiter=delimiter)

        required_cols = [key_column, column_x, column_y]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Kolom '{col}' tidak ditemukan")

        # Data ASLI (tanpa scaling)
        X_df = df[required_cols].dropna().copy()
        if X_df.empty:
            raise ValueError("Data kosong setelah cleaning")

        # Scaling hanya untuk KMeans
        X = X_df[[column_x, column_y]].values
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)

        num_clusters = int(num_clusters)

        kmeans = KMeans(
            n_clusters=num_clusters,
            random_state=42,
            n_init=10
        )

        labels = kmeans.fit_predict(X_scaled)
        X_df["cluster"] = labels

        silhouette = silhouette_score(X_scaled, labels)

        # =============================
        # SCATTER DATA (ASLI)
        # =============================
        scatter_data = [
            {
                "x": float(row[column_x]),
                "y": float(row[column_y]),
                "cluster": int(row["cluster"])
            }
            for _, row in X_df.iterrows()
        ]

        # =============================
        # CENTROIDS (KEMBALI KE ASLI)
        # =============================
        centroids_scaled = kmeans.cluster_centers_
        centroids = scaler.inverse_transform(centroids_scaled)

        centroid_data = [
            {
                "x": float(centroids[i, 0]),
                "y": float(centroids[i, 1]),
                "cluster": int(i)
            }
            for i in range(num_clusters)
        ]

        # =============================
        # BOXPLOT DATA (ASLI)
        # =============================
        boxplot_data = []

        for c in range(num_clusters):
            cluster_df = X_df[X_df["cluster"] == c]

            boxplot_data.append({
                "cluster": int(c),
                "x_values": cluster_df[column_x].astype(float).tolist(),
                "y_values": cluster_df[column_y].astype(float).tolist()
            })

        # =============================
        # DETAIL CLUSTER (🔥 BARIS PER BARIS)
        # =============================
        cluster_detail = [
            {
                "kunci": row[key_column],  # ✅ FIX UTAMA
                "x": float(row[column_x]),
                "y": float(row[column_y]),
                "cluster": int(row["cluster"])
            }
            for _, row in X_df.iterrows()
        ]

        print(json.dumps({
            "success": True,
            "dataset_used": os.path.basename(dataset_path),
            "num_clusters": num_clusters,
            "silhouette_score": float(silhouette),
            "columns_used": [key_column, column_x, column_y],

            "data_points": scatter_data,
            "centroids": centroid_data,
            "boxplot_data": boxplot_data,

            # 🔥 DETAIL UNTUK FRONTEND
            "cluster_detail": cluster_detail
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

# ======================================================
# CLI HANDLER
# ======================================================

if __name__ == "__main__":
    command = sys.argv[1]

    if command == "get_data_info":
        get_data_info(sys.argv[2], sys.argv[3], sys.argv[4])

    elif command == "clean_data":
        clean_data(sys.argv[2], json.loads(sys.argv[3]), sys.argv[4], sys.argv[5])

    elif command == "elbow":
        calculate_elbow(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])

    elif command == "cluster":
        perform_clustering(
            sys.argv[2],  # file_path
            sys.argv[3],  # key_column
            sys.argv[4],  # column_x
            sys.argv[5],  # column_y
            sys.argv[6],  # num_clusters
            sys.argv[7],  # encoding
            sys.argv[8]   # delimiter
        )

    else:
        print(json.dumps({"success": False, "error": "Unknown command"}))