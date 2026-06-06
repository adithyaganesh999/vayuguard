"""
PyTorch Training Loop with Early Stopping.

Provides a robust training pipeline for LSTM/GRU models with:
- Learning rate scheduling (ReduceLROnPlateau)
- Early stopping with patience
- Gradient clipping
- Training/validation loss tracking
- Model checkpointing (best weights)
"""

import numpy as np
import logging
from typing import Optional, Dict
from copy import deepcopy

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class EarlyStopping:
    """Early stopping to halt training when validation loss stops improving."""

    def __init__(self, patience: int = 15, min_delta: float = 1e-6, restore_best: bool = True):
        """
        Args:
            patience: Number of epochs to wait for improvement.
            min_delta: Minimum change to qualify as improvement.
            restore_best: Whether to restore best model weights on stop.
        """
        self.patience = patience
        self.min_delta = min_delta
        self.restore_best = restore_best
        self.counter = 0
        self.best_loss = np.inf
        self.best_weights = None
        self.should_stop = False

    def __call__(self, val_loss: float, model: nn.Module) -> bool:
        """
        Check if training should stop.

        Args:
            val_loss: Current validation loss.
            model: The model to save weights from.

        Returns:
            True if training should stop.
        """
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
            if self.restore_best:
                self.best_weights = deepcopy(model.state_dict())
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True
                if self.restore_best and self.best_weights is not None:
                    model.load_state_dict(self.best_weights)
                logger.info(f"Early stopping triggered. Best val loss: {self.best_loss:.6f}")
        return self.should_stop


class LSTMTrainer:
    """
    Training pipeline for PyTorch sequence models.

    Features:
    - Adam/AdamW optimizer with weight decay
    - ReduceLROnPlateau scheduler
    - Gradient clipping to prevent exploding gradients
    - Comprehensive metric tracking
    - Automatic best model checkpointing
    """

    def __init__(
        self,
        model: nn.Module,
        device: torch.device,
        learning_rate: float = 1e-3,
        weight_decay: float = 1e-5,
        patience: int = 15,
        grad_clip: float = 1.0,
        scheduler_factor: float = 0.5,
        scheduler_patience: int = 5,
        loss_fn: Optional[nn.Module] = None,
    ):
        """
        Args:
            model: PyTorch model to train.
            device: Device to train on.
            learning_rate: Initial learning rate.
            weight_decay: L2 regularization strength.
            patience: Early stopping patience.
            grad_clip: Maximum gradient norm for clipping.
            scheduler_factor: LR reduction factor.
            scheduler_patience: LR scheduler patience.
            loss_fn: Custom loss function (default: Huber loss).
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is required for training.")
        self.model = model
        self.device = device
        self.learning_rate = learning_rate
        self.weight_decay = weight_decay
        self.grad_clip = grad_clip

        # Optimizer
        self.optimizer = torch.optim.AdamW(
            model.parameters(), lr=learning_rate, weight_decay=weight_decay
        )

        # Loss function — Huber loss is robust to AQI outliers
        self.loss_fn = loss_fn or nn.HuberLoss(delta=1.0)

        # Scheduler
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode="min", factor=scheduler_factor,
            patience=scheduler_patience, verbose=True, min_lr=1e-6,
        )

        # Early stopping
        self.early_stopping = EarlyStopping(patience=patience, restore_best=True)

        # Tracking
        self.train_losses: list = []
        self.val_losses: list = []
        self.learning_rates: list = []
        self.best_val_loss = np.inf
        self.epochs_trained = 0

    def train(
        self,
        X: torch.Tensor,
        y: torch.Tensor,
        epochs: int = 100,
        batch_size: int = 64,
        val_split: float = 0.15,
    ) -> Dict:
        """
        Execute the training loop.

        Args:
            X: Input sequences tensor (n_samples, seq_len, features).
            y: Target tensor (n_samples, horizon).
            epochs: Maximum training epochs.
            batch_size: Mini-batch size.
            val_split: Fraction of data for validation.

        Returns:
            Training history dict.
        """
        # Split into train/val
        n_val = int(len(X) * val_split)
        n_train = len(X) - n_val
        X_train, X_val = X[:n_train], X[n_train:]
        y_train, y_val = y[:n_train], y[n_train:]

        train_dataset = TensorDataset(X_train, y_train)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True,
                                   drop_last=True)

        logger.info(f"Training started: {n_train} train, {n_val} val samples, "
                     f"{epochs} epochs, batch_size={batch_size}")

        for epoch in range(epochs):
            # Training phase
            self.model.train()
            epoch_train_loss = 0.0
            n_batches = 0
            for X_batch, y_batch in train_loader:
                self.optimizer.zero_grad()
                y_pred = self.model(X_batch)
                loss = self.loss_fn(y_pred, y_batch)
                loss.backward()
                # Gradient clipping
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.grad_clip)
                self.optimizer.step()
                epoch_train_loss += loss.item()
                n_batches += 1

            avg_train_loss = epoch_train_loss / max(n_batches, 1)
            self.train_losses.append(avg_train_loss)

            # Validation phase
            self.model.eval()
            with torch.no_grad():
                val_pred = self.model(X_val)
                val_loss = self.loss_fn(val_pred, y_val).item()
            self.val_losses.append(val_loss)

            # Learning rate scheduling
            current_lr = self.optimizer.param_groups[0]["lr"]
            self.learning_rates.append(current_lr)
            self.scheduler.step(val_loss)

            # Track best
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss

            # Log progress
            if (epoch + 1) % 10 == 0 or epoch == 0:
                logger.info(
                    f"Epoch {epoch+1}/{epochs} - "
                    f"Train Loss: {avg_train_loss:.4f}, Val Loss: {val_loss:.4f}, "
                    f"LR: {current_lr:.6f}"
                )

            # Early stopping check
            if self.early_stopping(val_loss, self.model):
                logger.info(f"Early stopping at epoch {epoch+1}")
                break

            self.epochs_trained = epoch + 1

        logger.info(f"Training complete. Best val loss: {self.best_val_loss:.4f}")
        return self.get_metrics()

    def get_metrics(self) -> Dict:
        """Return training metrics summary."""
        return {
            "train_losses": self.train_losses,
            "val_losses": self.val_losses,
            "best_val_loss": float(self.best_val_loss),
            "epochs_trained": self.epochs_trained,
            "final_learning_rate": self.learning_rates[-1] if self.learning_rates else None,
            "total_parameters": sum(p.numel() for p in self.model.parameters()),
        }
