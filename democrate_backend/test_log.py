import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "args") and isinstance(record.args, tuple) and len(record.args) >= 5:
            # Uvicorn access log passes status_code as 5th argument
            if record.args[4] == 200 or record.args[4] == "200":
                return False
        # Fallback string check
        return record.getMessage().find(" 200 ") == -1

logger = logging.getLogger("uvicorn.access")
logger.addFilter(EndpointFilter())

# simulate uvicorn access log
logger.warning('%s - "%s %s HTTP/%s" %d', '127.0.0.1:45308', 'GET', '/api/v1/complaints', '1.1', 200)
logger.warning('%s - "%s %s HTTP/%s" %d', '127.0.0.1:45308', 'GET', '/api/v1/complaints', '1.1', 500)
