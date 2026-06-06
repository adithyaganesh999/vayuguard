"""
LSTM/GRU Model for AQI Forecasting.

Implements sequence-to-sequence deep learning models using PyTorch
for multi-step AQI prediction. Supports both LSTM and GRU cells,
bidirectional encoding, and multi-layer architectures.
"""

import numpy as np
import pandas as pd
import logging
import os
from typing import Optional, Tuple, List, Dict

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not installed. LSTM model will not be available.")


if TORCH_AVAILABLE:

    class LSTMForecaster(nn.Module):
        """
        LSTM-based sequence model for AQI forecasting.

        Architecture:
        - Input projection layer
        - Multi-layer LSTM/GRU encoder
        - Attention mechanism (optional)
        - Fully connected output head for multi-step prediction
        """

        def __init__(
            self,
            input_size: int = 1,
            hidden_size: int = 128,
            num_layers: int = 2,
            output_size: int = 72,
            dropout: float = 0.2,
            cell_type: str = "lstm",
            bidirectional: bool = False,
            use_attention: bool = True,
        ):
            """
            Args:
                input_size: Number of input features per time step.
                hidden_size: Hidden state dimension.
                num_layers: Number of recurrent layers.
                output_size: Number of future steps to predict.
                dropout: Dropout probability between layers.
                cell_type: 'lstm' or 'gru'.
                bidirectional: Whether to use bidirectional RNN.
                use_attention: Whether to use temporal attention.
            """
            super().__init__()
            self.input_size = input_size
            self.hidden_size = hidden_size
            self.num_layers = num_layers
            self.output_size = output_size
            self.cell_type = cell_type.lower()
            self.bidirectional = bidirectional
            self.use_attention = use_attention

            # Input projection
            self.input_proj = nn.Linear(input_size, hidden_size)
            self.input_norm = nn.LayerNorm(hidden_size)

            # Recurrent cell
            rnn_cls = nn.LSTM if self.cell_type == "lstm" else nn.GRU
            self.rnn = rnn_cls(
                input_size=hidden_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                dropout=dropout if num_layers > 1 else 0.0,
                bidirectional=bidirectional,
            )

            # Attention layer
            rnn_output_size = hidden_size * (2 if bidirectional else 1)
            if use_attention:
                self.attention = TemporalAttention(rnn_output_size)

            # Output head
            self.output_head = nn.Sequential(
                nn.Linear(rnn_output_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_size, output_size),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            """
            Forward pass.

            Args:
                x: Input tensor of shape (batch, seq_len, input_size).

            Returns:
                Predictions of shape (batch, output_size).
            """
            # Input projection
            x = self.input_proj(x)
            x = self.input_norm(x)

            # Recurrent encoding
            rnn_out, _ = self.rnn(x)

            # Attention or last hidden state
            if self.use_attention:
                context = self.attention(rnn_out)  # (batch, hidden)
            else:
                context = rnn_out[:, -1, :]

            # Output projection
            output = self.output_head(context)
            return output

    class TemporalAttention(nn.Module):
        """Temporal attention mechanism for sequence models."""

        def __init__(self, hidden_size: int):
            super().__init__()
            self.attention = nn.Sequential(
                nn.Linear(hidden_size, hidden_size // 2),
                nn.Tanh(),
                nn.Linear(hidden_size // 2, 1),
            )

        def forward(self, rnn_output: torch.Tensor) -> torch.Tensor:
            """
            Compute weighted sum of hidden states.

            Args:
                rnn_output: (batch, seq_len, hidden_size)

            Returns:
                Context vector: (batch, hidden_size)
            """
            weights = self.attention(rnn_output)  # (batch, seq_len, 1)
            weights = torch.softmax(weights, dim=1)
            context = torch.sum(weights * rnn_output, dim=1)
            return context


class LSTMAQIModel:
    """
    Wrapper class for LSTM/GRU AQI forecasting model.

    Handles data preparation, training orchestration, and inference.
    Uses the LSTMForecaster PyTorch module internally.
    """

    def __init__(
        self,
        input_size: int = 1,
        hidden_size: int = 128,
        num_layers: int = 2,
        forecast_horizon: int = 72,
        lookback_window: int = 168,
        dropout: float = 0.2,
        cell_type: str = "lstm",
        bidirectional: bool = False,
        use_attention: bool = True,
        name: str = "lstm",
    ):
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is required for LSTM model.")
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.forecast_horizon = forecast_horizon
        self.lookback_window = lookback_window
        self.dropout = dropout
        self.cell_type = cell_type
        self.bidirectional = bidirectional
        self.use_attention = use_attention
        self.name = name
        self.model: Optional[LSTMForecaster] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.fitted = False
        self.training_metrics: dict = {}

    def _build_model(self) -> LSTMForecaster:
        """Construct the LSTM model."""
        model = LSTMForecaster(
            input_size=self.input_size,
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            output_size=self.forecast_horizon,
            dropout=self.dropout,
            cell_type=self.cell_type,
            bidirectional=self.bidirectional,
            use_attention=self.use_attention,
        )
        return model.to(self.device)

    def prepare_sequences(self, data: np.ndarray) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Create sliding window sequences from time series data.

        Args:
            data: Array of shape (n_samples, n_features).

        Returns:
            Tuple of (X, y) tensors.
        """
        X, y = [], []
        for i in range(len(data) - self.lookback_window - self.forecast_horizon + 1):
            X.append(data[i:i + self.lookback_window])
            y.append(data[i + self.lookback_window:i + self.lookback_window + self.forecast_horizon, 0])
        X = torch.FloatTensor(np.array(X)).to(self.device)
        y = torch.FloatTensor(np.array(y)).to(self.device)
        return X, y

    def fit(self, y: pd.Series, X: Optional[pd.DataFrame] = None) -> "LSTMAQIModel":
        """
        Train the LSTM model (delegates to Trainer).

        Args:
            y: Target AQI series.
            X: Optional weather features.

        Returns:
            self
        """
        from models.deep.trainer import LSTMTrainer

        # Build input array
        if X is not None:
            input_data = np.column_stack([y.values, X.values])
            self.input_size = input_data.shape[1]
        else:
            input_data = y.values.reshape(-1, 1)
            self.input_size = 1

        self.model = self._build_model()
        X_seq, y_seq = self.prepare_sequences(input_data)

        trainer = LSTMTrainer(
            model=self.model,
            device=self.device,
            learning_rate=0.001,
            weight_decay=1e-5,
            patience=15,
        )
        trainer.train(X_seq, y_seq, epochs=100, batch_size=64, val_split=0.15)
        self.training_metrics = trainer.get_metrics()
        self.fitted = True
        logger.info(f"LSTM model trained. Best val loss={self.training_metrics.get('best_val_loss', 'N/A')}")
        return self

    def predict(self, y_history: pd.Series, X_future: Optional[pd.DataFrame] = None) -> np.ndarray:
        """
        Generate multi-step AQI forecast.

        Args:
            y_history: Recent AQI values (at least lookback_window length).
            X_future: Future weather features (unused for simple model).

        Returns:
            Array of predicted AQI values.
        """
        if not self.fitted:
            raise RuntimeError("Model must be fit before prediction.")
        self.model.eval()
        with torch.no_grad():
            if X_future is not None:
                input_data = np.column_stack([y_history.values, np.zeros((len(y_history), X_future.shape[1]))])
            else:
                input_data = y_history.values.reshape(-1, 1)
            input_tensor = torch.FloatTensor(input_data[-self.lookback_window:])
            input_tensor = input_tensor.unsqueeze(0).to(self.device)
            output = self.model(input_tensor)
            predictions = output.cpu().numpy().flatten()
        return np.maximum(predictions, 0)

    def save(self, path: str) -> None:
        """Save model and config."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        config = {
            "input_size": self.input_size, "hidden_size": self.hidden_size,
            "num_layers": self.num_layers, "forecast_horizon": self.forecast_horizon,
            "lookback_window": self.lookback_window, "dropout": self.dropout,
            "cell_type": self.cell_type, "bidirectional": self.bidirectional,
            "use_attention": self.use_attention, "name": self.name,
            "fitted": self.fitted, "training_metrics": self.training_metrics,
        }
        joblib.dump(config, path + "_config")
        if self.model is not None:
            torch.save(self.model.state_dict(), path + "_weights.pt")

    @classmethod
    def load(cls, path: str) -> "LSTMAQIModel":
        """Load model from disk."""
        import joblib
        import torch
        config = joblib.load(path + "_config")
        model = cls(**{k: v for k, v in config.items() if k not in ["fitted", "training_metrics"]})
        model.fitted = config["fitted"]
        model.training_metrics = config.get("training_metrics", {})
        if model.fitted:
            model.model = model._build_model()
            model.model.load_state_dict(torch.load(path + "_weights.pt", map_location=model.device))
        return model

    def get_info(self) -> dict:
        return {
            "model_type": self.cell_type, "name": self.name,
            "hidden_size": self.hidden_size, "num_layers": self.num_layers,
            "fitted": self.fitted, "training_metrics": self.training_metrics,
        }


# Allow import without PyTorch for config loading
import joblib
