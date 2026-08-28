import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.local_stub import User
from app.models.notification_read import NotificationRead
from app.deps import get_current_user
from app.notifications import build_notifications, resolve_read_keys

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class ReadRequest(BaseModel):
    keys: list[str]


class NotificationOut(BaseModel):
    key: str
    category: str
    title: str
    message: str
    created_at: str
    is_read: bool


class NotificationFeed(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
    total: int


@router.get("", response_model=NotificationFeed)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Notifications derived for the caller's role; unread state per user."""
    read_keys = resolve_read_keys(db, current_user.id)
    raw = build_notifications(db, current_user)
    items: list[NotificationOut] = []
    for n in raw:
        is_read = n["key"] in read_keys
        items.append(
            NotificationOut(
                key=n["key"],
                category=n["category"],
                title=n["title"],
                message=n["message"],
                created_at=n["created_at"],
                is_read=is_read,
            )
        )
    unread = sum(1 for i in items if not i.is_read)
    return NotificationFeed(notifications=items, unread_count=unread, total=len(items))


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    body: ReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark the given notification keys as read for the current user."""
    # Only mark keys that actually exist for this user (defensive; never trust input).
    valid = {n["key"] for n in build_notifications(db, current_user)}
    existing = resolve_read_keys(db, current_user.id)
    to_add = []
    for key in body.keys:
        if key in valid and key not in existing:
            to_add.append(
                NotificationRead(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    notification_key=key,
                    read_at=datetime.utcnow(),
                )
            )
    if to_add:
        db.add_all(to_add)
        db.commit()
    return None


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark every currently-derived notification as read for the current user."""
    raw = build_notifications(db, current_user)
    keys = [n["key"] for n in raw]
    existing = resolve_read_keys(db, current_user.id)
    to_add = []
    for key in keys:
        if key not in existing:
            to_add.append(
                NotificationRead(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    notification_key=key,
                    read_at=datetime.utcnow(),
                )
            )
    if to_add:
        db.add_all(to_add)
        db.commit()
    return None
