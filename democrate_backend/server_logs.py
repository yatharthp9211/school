"""In-memory ring buffer that captures uvicorn / application logs for the
developer dashboard's live server-log viewer.

Usage (in main.py):
    import server_logs
    server_logs.install()          # call once at startup

The buffer keeps the most recent MAX_LINES lines.  Older entries are silently
dropped so memory usage stays bounded (~2 MB worst case at 2 000 × 1 KB).
"""

import logging
import collections
import threading
from datetime import datetime, timezone


MAX_LINES = 2000          # keep the last N log lines


class _RingHandler(logging.Handler):
    """Logging handler that appends formatted records to a thread-safe deque."""

    def __init__(self, maxlen: int = MAX_LINES) -> None:
        super().__init__()
        self._buf: collections.deque = collections.deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": self.format(record),
            }
            with self._lock:
                self._buf.append(entry)
        except Exception:
            self.handleError(record)

    def get_lines(self, last_n: int | None = None) -> list[dict]:
        """Return the most recent *last_n* entries (all if *last_n* is None)."""
        with self._lock:
            if last_n is None or last_n >= len(self._buf):
                return list(self._buf)
            return list(self._buf)[-last_n:]

    def clear(self) -> None:
        with self._lock:
            self._buf.clear()


# Module-level singleton so the route handler can import & read it.
_handler: _RingHandler | None = None


def install() -> None:
    """Attach the ring handler to the root logger and key uvicorn loggers."""
    global _handler
    if _handler is not None:
        return                       # already installed

    _handler = _RingHandler(maxlen=MAX_LINES)
    _handler.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"))

    # Capture everything at DEBUG+ into the ring buffer.
    _handler.setLevel(logging.DEBUG)

    # Attach to root logger (catches app-level logging.info / print-to-log).
    root = logging.getLogger()
    root.addHandler(_handler)

    # Uvicorn uses its own loggers — attach explicitly so access + error lines
    # also flow into our buffer.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.addHandler(_handler)


def get_lines(last_n: int | None = None) -> list[dict]:
    """Public accessor used by the developer route."""
    if _handler is None:
        return []
    return _handler.get_lines(last_n)


def clear() -> None:
    """Clear the buffer (developer action)."""
    if _handler is not None:
        _handler.clear()
