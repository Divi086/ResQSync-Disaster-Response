from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DECIMAL,
    Enum,
    ForeignKey,
    DateTime,
    func
)

from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=False)

    role = Column(
        Enum("AFFECTED_PERSON", "VOLUNTEER", "NGO", "ADMIN"),
        nullable=False
    )


class Location(Base):
    __tablename__ = "locations"

    location_id = Column(Integer, primary_key=True, index=True)

    latitude = Column(DECIMAL(10, 7), nullable=False)
    longitude = Column(DECIMAL(10, 7), nullable=False)

    address = Column(String(255))
    city = Column(String(100))


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    request_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=False
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.location_id"),
        nullable=False
    )

    request_type = Column(
        Enum(
            "FOOD",
            "WATER",
            "MEDICINE",
            "RESCUE",
            "SHELTER",
            "MEDICAL",
            "OTHER"
        ),
        nullable=False
    )

    description = Column(Text)

    severity = Column(Integer, default=1)

    priority_score = Column(
        DECIMAL(10, 2),
        default=0
    )

    status = Column(
    Enum(
        "PENDING",
        "ASSIGNED",
        "COMPLETED"
    ),
    default="PENDING"
)

    people_affected = Column(Integer, default=1)


class Volunteer(Base):
    __tablename__ = "volunteers"

    volunteer_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=False
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.location_id"),
        nullable=False
    )

    skills = Column(String(255))

    availability_status = Column(
        Enum("AVAILABLE", "BUSY", "UNAVAILABLE"),
        default="AVAILABLE"
    )


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    request_id = Column(
        Integer,
        ForeignKey("emergency_requests.request_id"),
        nullable=False
    )

    volunteer_id = Column(
        Integer,
        ForeignKey("volunteers.volunteer_id"),
        nullable=False
    )

    assigned_at = Column(
        DateTime,
        server_default=func.now()
    )

    completed_at = Column(
        DateTime,
        nullable=True
    )