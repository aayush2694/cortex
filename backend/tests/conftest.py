import os

# Tests use their own database. Set this before any app module reads settings.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://localhost:5432/cortex_test"
)
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_MODE"] = "dev"
