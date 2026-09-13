from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, accounts, payments, requests as requests_router
from app.routers import mandates, rewards, goals, vaults, lite, analytics, ws
from app.routers import gold, voice, ledger, accounting, ai
from app.services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.db.session import engine, AsyncSessionLocal
        from app.db.base import Base
        import app.models  # noqa: F401
        from app.models.user import User, KYCStatus
        from app.models.account import Account
        from app.core.security import hash_pin
        from app.core.money import generate_virtual_acc_no
        from sqlalchemy import select, text

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                await conn.execute(text("ALTER TABLE scratch_cards ADD COLUMN IF NOT EXISTS is_withdrawn BOOLEAN DEFAULT FALSE;"))
            except Exception as e:
                print(f"Could not alter scratch_cards table: {e}")
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'en';"))
            except Exception as e:
                print(f"Could not alter users table for language_code: {e}")
            try:
                await conn.execute(text("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;"))
            except Exception as e:
                print(f"Could not alter users table for avatar_url TYPE TEXT: {e}")

        async with AsyncSessionLocal() as session:
            res = await session.execute(select(User).where(User.phone_number == "9876543210"))
            if not res.scalar_one_or_none():
                user = User(
                    full_name="Rishab Raj",
                    phone_number="9876543210",
                    email="rishab@example.com",
                    pin_hash=hash_pin("123456"),
                    kyc_status=KYCStatus.VERIFIED,
                )
                session.add(user)
                await session.flush()
                account = Account(
                    user_id=user.id,
                    virtual_acc_no=generate_virtual_acc_no(),
                    vpa="rishab@renopay",
                    current_balance_paise=5000000,
                    upi_lite_balance_paise=100000,
                    digital_gold_paise=250000,
                )
                session.add(account)

                user2 = User(
                    full_name="Alex Morgan",
                    phone_number="9876543211",
                    email="alex@example.com",
                    pin_hash=hash_pin("123456"),
                    kyc_status=KYCStatus.VERIFIED,
                )
                session.add(user2)
                await session.flush()
                account2 = Account(
                    user_id=user2.id,
                    virtual_acc_no=generate_virtual_acc_no(),
                    vpa="alex@renopay",
                    current_balance_paise=2500000,
                    upi_lite_balance_paise=50000,
                    digital_gold_paise=50000,
                )
                session.add(account2)
                await session.commit()
    except Exception as e:
        print(f"Warning during database initialization: {e}")

    import os
    scheduler = None
    if not os.environ.get("VERCEL"):
        try:
            scheduler = start_scheduler()
        except Exception as e:
            print(f"Warning starting scheduler: {e}")
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.2.0",
    description="RenoPay backend — Phase 2: auth, payments, and all feature routers.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def handle_api_prefix(request, call_next):
    if request.scope["path"].startswith("/api/"):
        request.scope["path"] = request.scope["path"][4:]
    elif request.scope["path"] == "/api":
        request.scope["path"] = "/"
    return await call_next(request)


from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    tb = traceback.format_exc()
    print("UNHANDLED EXCEPTION ON", request.url.path, ":", tb)
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__,
            "traceback": tb.splitlines()[-8:],
        },
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(requests_router.router, prefix="/requests", tags=["requests"])
app.include_router(mandates.router, prefix="/mandates", tags=["mandates"])
app.include_router(rewards.router, prefix="/rewards", tags=["rewards"])
app.include_router(goals.router, prefix="/goals", tags=["goals"])
app.include_router(vaults.router, prefix="/vaults", tags=["vaults"])
app.include_router(lite.router, prefix="/lite", tags=["upi-lite"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(ws.router, tags=["websocket"])  # exposes /ws
app.include_router(gold.router, prefix="/gold", tags=["digital-gold"])
app.include_router(voice.router, prefix="/payments", tags=["voice-upi"])
app.include_router(ledger.router, prefix="/analytics", tags=["reports"])
app.include_router(accounting.router, prefix="/accounting", tags=["accounting"])
app.include_router(ai.router, prefix="/ai", tags=["ai-assistant"])


@app.patch("/user/preferences", tags=["user-preferences"])
async def user_preferences_alias(
    payload: accounts.UserPreferencesUpdate,
    user=accounts.Depends(accounts.get_current_user),
    account=accounts.Depends(accounts.get_current_account),
    db=accounts.Depends(accounts.get_db),
):
    return await accounts.update_preferences(payload, user, account, db)


@app.post("/user/profile-photo", tags=["user-profile"])
async def user_upload_photo_alias(
    file: accounts.UploadFile = accounts.File(...),
    user=accounts.Depends(accounts.get_current_user),
    account=accounts.Depends(accounts.get_current_account),
    db=accounts.Depends(accounts.get_db),
):
    return await accounts.upload_profile_photo(file, user, account, db)


@app.delete("/user/profile-photo", tags=["user-profile"])
async def user_delete_photo_alias(
    user=accounts.Depends(accounts.get_current_user),
    account=accounts.Depends(accounts.get_current_account),
    db=accounts.Depends(accounts.get_db),
):
    return await accounts.delete_profile_photo(user, account, db)



@app.get("/health")
async def health():
    db_status = "unconfigured"
    db_err = None
    if "localhost" not in settings.DATABASE_URL:
        try:
            from app.db.session import engine
            from sqlalchemy import text
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as e:
            db_status = "error"
            db_err = str(e)
    else:
        db_status = "missing_DATABASE_URL_in_vercel"

    return {
        "status": "ok",
        "version": "1.0.0",
        "database": db_status,
        "database_error": db_err,
    }
