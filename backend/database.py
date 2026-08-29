import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# =====================================================
# DATABASE URL
# =====================================================

DATABASE_URL = os.getenv("DATABASE_URL")


# =====================================================
# LOCAL DATABASE
# =====================================================

if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root:jbvd110846@localhost:3306/resqsync"


# =====================================================
# AIVEN DATABASE
# =====================================================

if DATABASE_URL.startswith("mysql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "mysql://",
        "mysql+pymysql://",
        1
    )


# Remove Aiven's ssl-mode parameter
DATABASE_URL = DATABASE_URL.replace(
    "?ssl-mode=REQUIRED",
    ""
)


# =====================================================
# DATABASE ENGINE
# =====================================================

if "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL:

    # Local MySQL
    engine = create_engine(
        DATABASE_URL
    )

else:

    # Aiven / Render
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "ssl": {}
        }
    )


# =====================================================
# SESSION
# =====================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


Base = declarative_base()
