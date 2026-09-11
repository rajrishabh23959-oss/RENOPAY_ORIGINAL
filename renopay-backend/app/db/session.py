from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# Neon Serverless PostgreSQL connection configuration
connect_args = {}
if "neon.tech" in settings.ASYNC_DATABASE_URL and "ssl=" not in settings.ASYNC_DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
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
