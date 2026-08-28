import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

# Convert Aiven mysql:// URL to PyMySQL format
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

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "ssl": {}
    }
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
