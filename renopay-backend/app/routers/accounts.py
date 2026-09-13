import io
import base64
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account, is_device_trusted
from app.core.money import rupees_to_paise
from app.db.session import get_db
from app.models.user import User, Device
from app.models.account import Account
from app.schemas.account import (
    ProfileOut, AccountOut, ToggleRoundUpRequest, UpdateBudgetRequest, UserPreferencesUpdate
)

router = APIRouter()


@router.get("/me", response_model=ProfileOut)
async def get_profile(
    device_fingerprint: str | None = None,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    trusted = await is_device_trusted(db, user.id, device_fingerprint)
    return ProfileOut(
        id=user.id, full_name=user.full_name, phone_number=user.phone_number,
        kyc_status=user.kyc_status.value if hasattr(user.kyc_status, "value") else user.kyc_status,
        avatar_url=user.avatar_url, account=AccountOut.from_model(account),
        has_upi_pin=(user.pin_hash is not None),
        is_trusted_device=trusted,
        language_code=getattr(user, "language_code", "en"),
    )


@router.patch("/preferences", response_model=ProfileOut)
async def update_preferences(
    payload: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    user.language_code = payload.language_code
    await db.commit()
    await db.refresh(user)
    return ProfileOut(
        id=user.id, full_name=user.full_name, phone_number=user.phone_number,
        kyc_status=user.kyc_status.value if hasattr(user.kyc_status, "value") else user.kyc_status,
        avatar_url=user.avatar_url, account=AccountOut.from_model(account),
        has_upi_pin=(user.pin_hash is not None),
        is_trusted_device=False,
        language_code=user.language_code,
    )


@router.post("/trust-device")
async def trust_device(
    device_fingerprint: str, device_label: str | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.user_id == user.id, Device.device_fingerprint == device_fingerprint)
    )
    device = result.scalar_one_or_none()
    if device is None:
        db.add(Device(user_id=user.id, device_fingerprint=device_fingerprint, device_label=device_label))
    await db.commit()
    return {"success": True}


@router.patch("/round-up", response_model=AccountOut)
async def toggle_round_up(
    payload: ToggleRoundUpRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    account.round_up_enabled = payload.enabled
    await db.commit()
    await db.refresh(account)
    return AccountOut.from_model(account)


@router.patch("/budget", response_model=AccountOut)
async def update_budget(
    payload: UpdateBudgetRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    account.monthly_budget_paise = rupees_to_paise(payload.monthly_budget)
    await db.commit()
    await db.refresh(account)
    return AccountOut.from_model(account)


@router.post("/profile-photo", response_model=ProfileOut)
async def upload_profile_photo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only JPG, PNG, and WebP are allowed."
        )

    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size exceeds 2MB limit."
        )

    try:
        img = Image.open(io.BytesIO(contents))
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
            bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
            img = img.convert("RGB")

        w, h = img.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        img = img.crop((left, top, left + min_dim, top + min_dim))
        img = img.resize((500, 500), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format="WEBP", quality=85, optimize=True)
        webp_bytes = buffer.getvalue()
        b64_str = base64.b64encode(webp_bytes).decode("utf-8")
        data_url = f"data:image/webp;base64,{b64_str}"

        user.avatar_url = data_url
        await db.commit()
        await db.refresh(user)

        return ProfileOut(
            id=user.id, full_name=user.full_name, phone_number=user.phone_number,
            kyc_status=user.kyc_status.value if hasattr(user.kyc_status, "value") else user.kyc_status,
            avatar_url=user.avatar_url, account=AccountOut.from_model(account),
            has_upi_pin=(user.pin_hash is not None),
            is_trusted_device=False,
            language_code=getattr(user, "language_code", "en"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not process image: {str(e)}"
        )


@router.delete("/profile-photo", response_model=ProfileOut)
async def delete_profile_photo(
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    user.avatar_url = None
    await db.commit()
    await db.refresh(user)
    return ProfileOut(
        id=user.id, full_name=user.full_name, phone_number=user.phone_number,
        kyc_status=user.kyc_status.value if hasattr(user.kyc_status, "value") else user.kyc_status,
        avatar_url=None, account=AccountOut.from_model(account),
        has_upi_pin=(user.pin_hash is not None),
        is_trusted_device=False,
        language_code=getattr(user, "language_code", "en"),
    )
