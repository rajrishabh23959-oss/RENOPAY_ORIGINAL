from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# SQLite async engine requires check_same_thread=False because FastAPI
# serves requests on multiple threads. PostgreSQL/asyncpg rejects this parameter.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    """FastAPI dependency — yields a session, guarantees close."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
