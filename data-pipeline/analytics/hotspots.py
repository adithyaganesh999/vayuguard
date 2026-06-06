"""
VayuGuard Data Pipeline - Hotspot Detection
==============================================
Detects pollution hotspots using spatial clustering (DBSCAN/KMeans)
on station-level AQI data with geographic coordinates.
"""

import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Default hotspot detection parameters
DEFAULT_DBSCAN_EPS_KM = 15.0  # ~15km neighborhood
DEFAULT_DBSCAN_MIN_SAMPLES = 3
DEFAULT_KMEANS_N_CLUSTERS = 8

# AQI thresholds for hotspot classification
HOTSPOT_AQI_THRESHOLD = 200  # "Poor" or worse
SEVERE_HOTSPOT_AQI_THRESHOLD = 300  # "Very Poor" or worse


class HotspotDetector:
    """
    Detects air pollution hotspots using spatial clustering algorithms.
    
    Methods:
    - DBSCAN: Density-based clustering for irregular hotspot shapes
    - K-Means: Partition-based clustering for predefined number of zones
    - Grid-based: Simple grid aggregation for heat map visualization
    
    Each hotspot is characterized by:
    - Geographic center and radius
    - Average and peak AQI
    - Number of affected monitoring stations
    - Severity classification
    """

    def __init__(
        self,
        method: str = "dbscan",
        dbscan_eps_km: float = DEFAULT_DBSCAN_EPS_KM,
        dbscan_min_samples: int = DEFAULT_DBSCAN_MIN_SAMPLES,
        kmeans_n_clusters: int = DEFAULT_KMEANS_N_CLUSTERS,
        aqi_threshold: float = HOTSPOT_AQI_THRESHOLD,
    ):
        """
        Args:
            method: Clustering method ('dbscan', 'kmeans', or 'grid')
            dbscan_eps_km: DBSCAN epsilon in kilometers
            dbscan_min_samples: DBSCAN minimum samples
            kmeans_n_clusters: Number of K-Means clusters
            aqi_threshold: AQI value to consider as hotspot
        """
        self.method = method
        self.dbscan_eps_km = dbscan_eps_km
        self.dbscan_min_samples = dbscan_min_samples
        self.kmeans_n_clusters = kmeans_n_clusters
        self.aqi_threshold = aqi_threshold

    def detect(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Detect pollution hotspots from AQI data.

        Args:
            df: DataFrame with columns: city, latitude, longitude, value (AQI or pm25)
                Can also include parameter column for filtering

        Returns:
            DataFrame with hotspot information:
            - hotspot_id, center_lat, center_lon, radius_km
            - avg_aqi, max_aqi, station_count
            - severity, affected_cities
        """
        if df.empty:
            logger.warning("Empty DataFrame for hotspot detection")
            return pd.DataFrame()

        # Filter for AQI or PM2.5 data
        df_filtered = self._filter_relevant_data(df)
        if df_filtered.empty:
            logger.warning("No relevant AQI data found for hotspot detection")
            return pd.DataFrame()

        # Aggregate to station level
        station_data = self._aggregate_to_stations(df_filtered)
        if station_data.empty:
            return pd.DataFrame()

        # Filter for high-pollution stations
        high_pollution = station_data[station_data["avg_value"] >= self.aqi_threshold]
        if high_pollution.empty:
            logger.info(f"No stations above AQI threshold {self.aqi_threshold}")
            return pd.DataFrame()

        logger.info(f"Found {len(high_pollution)} high-pollution stations")

        # Run clustering
        if self.method == "dbscan":
            hotspots = self._dbscan_cluster(high_pollution)
        elif self.method == "kmeans":
            hotspots = self._kmeans_cluster(high_pollution)
        elif self.method == "grid":
            hotspots = self._grid_cluster(high_pollution)
        else:
            logger.error(f"Unknown method: {self.method}")
            return pd.DataFrame()

        if hotspots.empty:
            return pd.DataFrame()

        # Enrich hotspot data
        hotspots = self._enrich_hotspots(hotspots, station_data)

        logger.info(f"Detected {len(hotspots)} pollution hotspots")
        return hotspots

    def _filter_relevant_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter for AQI or PM2.5 data."""
        if "parameter" in df.columns:
            return df[df["parameter"].isin(["aqi", "pm25"])].copy()
        return df.copy()

    def _aggregate_to_stations(self, df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate readings to station level with avg/max AQI."""
        group_cols = []
        for col in ["city", "location", "latitude", "longitude"]:
            if col in df.columns:
                group_cols.append(col)

        if not group_cols:
            return pd.DataFrame()

        agg_dict = {"value": ["mean", "max", "count"]}
        
        # Add weather aggregation if available
        for w_col in ["temperature_2m", "wind_speed_10m", "relative_humidity_2m"]:
            if w_col in df.columns:
                agg_dict[w_col] = ["mean"]

        station_data = df.groupby(group_cols).agg(agg_dict).reset_index()
        station_data.columns = [
            "_".join(filter(None, col)).rstrip("_") if isinstance(col, tuple) else col
            for col in station_data.columns
        ]
        station_data = station_data.rename(columns={
            "value_mean": "avg_value",
            "value_max": "max_value",
            "value_count": "reading_count",
        })

        return station_data

    def _dbscan_cluster(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply DBSCAN clustering for hotspot detection.
        
        Uses haversine-approximate distance for lat/lon coordinates.
        """
        try:
            from sklearn.cluster import DBSCAN
        except ImportError:
            logger.error("scikit-learn not installed. Cannot run DBSCAN.")
            return pd.DataFrame()

        if "latitude" not in df.columns or "longitude" not in df.columns:
            logger.warning("Missing lat/lon for DBSCAN clustering")
            return pd.DataFrame()

        # Convert lat/lon to radians for haversine distance
        coords = np.radians(df[["latitude", "longitude"]].values)
        
        # EPS in km converted to radians (Earth radius ~6371 km)
        eps_rad = self.dbscan_eps_km / 6371.0

        db = DBSCAN(eps=eps_rad, min_samples=self.dbscan_min_samples, metric="haversine")
        labels = db.fit_predict(coords)

        df = df.copy()
        df["cluster"] = labels

        # Filter out noise (-1 label)
        clustered = df[df["cluster"] != -1]
        if clustered.empty:
            logger.info("DBSCAN found no dense clusters")
            return pd.DataFrame()

        # Compute hotspot statistics per cluster
        hotspots = []
        for cluster_id in sorted(clustered["cluster"].unique()):
            cluster_data = clustered[clustered["cluster"] == cluster_id]
            hotspot = self._compute_hotspot_stats(cluster_data, cluster_id)
            hotspots.append(hotspot)

        return pd.DataFrame(hotspots)

    def _kmeans_cluster(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply K-Means clustering for zone-based hotspot detection.
        """
        try:
            from sklearn.cluster import KMeans
        except ImportError:
            logger.error("scikit-learn not installed. Cannot run K-Means.")
            return pd.DataFrame()

        if "latitude" not in df.columns or "longitude" not in df.columns:
            logger.warning("Missing lat/lon for K-Means clustering")
            return pd.DataFrame()

        coords = df[["latitude", "longitude"]].values
        n_clusters = min(self.kmeans_n_clusters, len(df))

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(coords)

        df = df.copy()
        df["cluster"] = labels

        hotspots = []
        for cluster_id in range(n_clusters):
            cluster_data = df[df["cluster"] == cluster_id]
            hotspot = self._compute_hotspot_stats(cluster_data, cluster_id)
            hotspots.append(hotspot)

        return pd.DataFrame(hotspots)

    def _grid_cluster(self, df: pd.DataFrame, grid_size: float = 0.5) -> pd.DataFrame:
        """
        Apply grid-based clustering for heat map visualization.
        
        Groups stations into grid cells and identifies hot cells.
        
        Args:
            df: Station data
            grid_size: Grid cell size in degrees (~0.5 = ~55km)
        """
        if "latitude" not in df.columns or "longitude" not in df.columns:
            return pd.DataFrame()

        df = df.copy()
        df["grid_lat"] = (df["latitude"] / grid_size).round() * grid_size
        df["grid_lon"] = (df["longitude"] / grid_size).round() * grid_size

        hotspots = []
        grid_id = 0
        for (lat, lon), group in df.groupby(["grid_lat", "grid_lon"]):
            hotspot = self._compute_hotspot_stats(group, grid_id)
            hotspots.append(hotspot)
            grid_id += 1

        return pd.DataFrame(hotspots)

    def _compute_hotspot_stats(self, cluster_data: pd.DataFrame, cluster_id: int) -> dict:
        """Compute statistics for a single hotspot cluster."""
        center_lat = cluster_data["latitude"].mean()
        center_lon = cluster_data["longitude"].mean()

        # Compute approximate radius (max distance from center)
        distances = self._haversine_distances(
            center_lat, center_lon,
            cluster_data["latitude"].values, cluster_data["longitude"].values,
        )
        radius_km = distances.max() if len(distances) > 0 else 0

        avg_value = cluster_data["avg_value"].mean()
        max_value = cluster_data["max_value"].max() if "max_value" in cluster_data.columns else cluster_data["avg_value"].max()
        station_count = len(cluster_data)

        # Severity classification
        if avg_value >= SEVERE_HOTSPOT_AQI_THRESHOLD:
            severity = "severe"
        elif avg_value >= self.aqi_threshold:
            severity = "high"
        elif avg_value >= 100:
            severity = "moderate"
        else:
            severity = "low"

        # Affected cities
        affected_cities = list(cluster_data["city"].unique()) if "city" in cluster_data.columns else []

        return {
            "hotspot_id": f"HS-{cluster_id:03d}",
            "center_lat": round(center_lat, 4),
            "center_lon": round(center_lon, 4),
            "radius_km": round(radius_km, 2),
            "avg_aqi": round(avg_value, 2),
            "max_aqi": round(max_value, 2),
            "station_count": station_count,
            "severity": severity,
            "affected_cities": ", ".join(affected_cities),
        }

    @staticmethod
    def _haversine_distances(center_lat: float, center_lon: float, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        """Compute haversine distances from center to array of points in km."""
        R = 6371.0  # Earth radius in km
        
        dlat = np.radians(lats - center_lat)
        dlon = np.radians(lons - center_lon)
        
        a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(center_lat)) * np.cos(np.radians(lats)) * np.sin(dlon / 2) ** 2
        c = 2 * np.arcsin(np.sqrt(a))
        
        return R * c

    def _enrich_hotspots(self, hotspots: pd.DataFrame, station_data: pd.DataFrame) -> pd.DataFrame:
        """Add additional metadata to hotspots."""
        if hotspots.empty:
            return hotspots

        # Add population exposure estimate (rough)
        # Urban areas: ~10,000 people per km²
        hotspots["estimated_exposed_pop"] = hotspots.apply(
            lambda row: int(np.pi * row["radius_km"] ** 2 * 10000), axis=1
        )

        # Add risk score (0-100)
        hotspots["risk_score"] = hotspots.apply(self._compute_risk_score, axis=1)

        # Sort by risk score
        hotspots = hotspots.sort_values("risk_score", ascending=False).reset_index(drop=True)

        return hotspots

    @staticmethod
    def _compute_risk_score(row) -> float:
        """Compute a composite risk score for a hotspot."""
        # Weighted combination of AQI and exposure
        aqi_score = min(row["avg_aqi"] / 500 * 50, 50)  # Max 50 points from AQI
        exposure_score = min(row["estimated_exposed_pop"] / 5_000_000 * 30, 30)  # Max 30 points
        station_score = min(row["station_count"] / 10 * 20, 20)  # Max 20 points
        return round(aqi_score + exposure_score + station_score, 2)

    def generate_hotspot_report(self, hotspots: pd.DataFrame) -> str:
        """Generate a human-readable hotspot detection report."""
        if hotspots.empty:
            return "No pollution hotspots detected."

        lines = [
            "VayuGuard Pollution Hotspot Report",
            "=" * 50,
            f"Total hotspots detected: {len(hotspots)}",
            f"Severe hotspots: {len(hotspots[hotspots['severity'] == 'severe'])}",
            f"High hotspots: {len(hotspots[hotspots['severity'] == 'high'])}",
            f"Moderate hotspots: {len(hotspots[hotspots['severity'] == 'moderate'])}",
            "",
            "Top 5 Hotspots by Risk Score:",
            "-" * 50,
        ]

        for _, row in hotspots.head(5).iterrows():
            lines.append(
                f"  {row['hotspot_id']}: {row['affected_cities']} | "
                f"Avg AQI: {row['avg_aqi']:.0f} | "
                f"Severity: {row['severity']} | "
                f"Risk: {row['risk_score']:.1f}/100 | "
                f"Stations: {row['station_count']}"
            )

        return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Detect pollution hotspots")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--method", choices=["dbscan", "kmeans", "grid"], default="dbscan")
    parser.add_argument("--output", type=str, default="hotspots.csv", help="Output CSV path")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    detector = HotspotDetector(method=args.method)
    hotspots = detector.detect(df)

    if not hotspots.empty:
        hotspots.to_csv(args.output, index=False)
        print(detector.generate_hotspot_report(hotspots))
    else:
        print("No hotspots detected.")


if __name__ == "__main__":
    main()
