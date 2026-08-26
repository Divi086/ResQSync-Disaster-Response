from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from math import radians, sin, cos, sqrt, atan2

from database import SessionLocal

from models import (
    User,
    EmergencyRequest,
    Volunteer,
    Assignment,
    Location
)

from schemas import EmergencyRequestCreate
from priority_engine import calculate_priority


app = FastAPI(title="ResQSync API")


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# DATABASE
# =====================================================

def get_db():

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =====================================================
# HOME
# =====================================================

@app.get("/")
def home():

    return {
        "message": "Welcome to ResQSync",
        "status": "Backend is running",
        "database": "MySQL connected"
    }


# =====================================================
# SIGNUP
# =====================================================

@app.post("/signup")
def signup(
    name: str,
    email: str,
    phone: str,
    password: str,
    role: str,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=password,
        role=role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    volunteer_id = None

    # =================================================
    # CREATE VOLUNTEER
    # =================================================

    if role == "VOLUNTEER":

        volunteer = Volunteer(
            user_id=new_user.user_id,
            location_id=1,
            skills="General",
            availability_status="AVAILABLE"
        )

        db.add(volunteer)
        db.commit()
        db.refresh(volunteer)

        volunteer_id = volunteer.volunteer_id

    return {

        "message": "Signup successful",

        "user_id": new_user.user_id,

        "name": new_user.name,

        "email": new_user.email,

        "role": new_user.role,

        "volunteer_id": volunteer_id
    }


# =====================================================
# LOGIN
# =====================================================

@app.post("/login")
def login(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.password_hash != password:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    volunteer_id = None

    if user.role == "VOLUNTEER":

        volunteer = (
            db.query(Volunteer)
            .filter(
                Volunteer.user_id == user.user_id
            )
            .first()
        )

        if volunteer:

            volunteer_id = volunteer.volunteer_id

    return {

        "message": "Login successful",

        "user_id": user.user_id,

        "name": user.name,

        "email": user.email,

        "role": user.role,

        "volunteer_id": volunteer_id
    }


# =====================================================
# CREATE EMERGENCY REQUEST
# =====================================================

@app.post("/requests")
def create_request(
    request: EmergencyRequestCreate,
    db: Session = Depends(get_db)
):

    # =================================================
    # CREATE LOCATION FROM REAL GPS
    # =================================================

    new_location = Location(

        latitude=request.latitude,

        longitude=request.longitude,

        city="GPS Detected",

        address="Current GPS Location"
    )

    db.add(new_location)

    db.commit()

    db.refresh(new_location)

    # =================================================
    # CALCULATE PRIORITY
    # =================================================

    score, priority = calculate_priority(

        request.severity,

        request.people_affected,

        request.request_type
    )

    # =================================================
    # CREATE EMERGENCY REQUEST
    # =================================================

    new_request = EmergencyRequest(

        user_id=request.user_id,

        location_id=new_location.location_id,

        request_type=request.request_type,

        description=request.description,

        severity=request.severity,

        people_affected=request.people_affected,

        priority_score=score
    )

    db.add(new_request)

    db.commit()

    db.refresh(new_request)

    return {

        "message":
            "Emergency request created successfully",

        "request_id":
            new_request.request_id,

        "location_id":
            new_location.location_id,

        "latitude":
            float(new_location.latitude),

        "longitude":
            float(new_location.longitude),

        "priority_score":
            score,

        "priority":
            priority
    }


# =====================================================
# GET MY EMERGENCY REQUESTS
# =====================================================

@app.get("/requests/user/{user_id}")
def get_user_requests(
    user_id: int,
    db: Session = Depends(get_db)
):

    requests = (

        db.query(EmergencyRequest)

        .filter(
            EmergencyRequest.user_id == user_id
        )

        .order_by(
            EmergencyRequest.request_id.desc()
        )

        .all()
    )

    return requests


# =====================================================
# DISTANCE CALCULATION
# =====================================================

def calculate_distance(
    lat1,
    lon1,
    lat2,
    lon2
):

    R = 6371.0

    lat1 = radians(float(lat1))
    lon1 = radians(float(lon1))

    lat2 = radians(float(lat2))
    lon2 = radians(float(lon2))

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        +
        cos(lat1)
        * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(
        sqrt(a),
        sqrt(1 - a)
    )

    return R * c


# =====================================================
# UPDATE VOLUNTEER LOCATION
# =====================================================

@app.post("/volunteer/location")
def update_volunteer_location(
    volunteer_id: int,
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db)
):

    volunteer = (

        db.query(Volunteer)

        .filter(
            Volunteer.volunteer_id == volunteer_id
        )

        .first()
    )

    if not volunteer:

        raise HTTPException(
            status_code=404,
            detail="Volunteer not found"
        )

    # =================================================
    # GET EXISTING LOCATION
    # =================================================

    location = (

        db.query(Location)

        .filter(
            Location.location_id ==
            volunteer.location_id
        )

        .first()
    )

    # =================================================
    # UPDATE EXISTING LOCATION
    # =================================================

    if location:

        location.latitude = latitude
        location.longitude = longitude
        location.city = "GPS Detected"
        location.address = "Volunteer Current Location"

    # =================================================
    # CREATE LOCATION IF NOT FOUND
    # =================================================

    else:

        location = Location(

            latitude=latitude,

            longitude=longitude,

            city="GPS Detected",

            address="Volunteer Current Location"
        )

        db.add(location)

        db.commit()

        db.refresh(location)

        volunteer.location_id = location.location_id

    db.commit()

    return {

        "message":
            "Volunteer location updated",

        "volunteer_id":
            volunteer_id,

        "latitude":
            latitude,

        "longitude":
            longitude
    }


# =====================================================
# VOLUNTEER - VIEW NEAREST REQUESTS
# =====================================================

# =========================
# VOLUNTEER - VIEW REQUESTS
# =========================

@app.get("/volunteer/requests")
def get_volunteer_requests(
    db: Session = Depends(get_db)
):

    requests = (
        db.query(EmergencyRequest)
        .filter(
            EmergencyRequest.status == "PENDING"
        )
        .order_by(
            EmergencyRequest.priority_score.desc()
        )
        .all()
    )

    result = []

    for request in requests:

        location = (
            db.query(Location)
            .filter(
                Location.location_id == request.location_id
            )
            .first()
        )

        result.append({
            "request_id": request.request_id,
            "user_id": request.user_id,
            "location_id": request.location_id,

            "request_type": request.request_type,
            "description": request.description,
            "severity": request.severity,
            "people_affected": request.people_affected,
            "priority_score": request.priority_score,
            "status": request.status,

            # Affected person's location
            "latitude": float(location.latitude) if location else None,
            "longitude": float(location.longitude) if location else None,

            "address": location.address if location else None,
            "city": location.city if location else None
        })

    return result


# =====================================================
# VOLUNTEER - ACCEPT REQUEST
# =====================================================
# =========================
# VOLUNTEER - ACCEPT REQUEST
# =========================

@app.post("/volunteer/accept/{request_id}")
def accept_request(
    request_id: int,
    volunteer_id: int,
    db: Session = Depends(get_db)
):

    # Find emergency request
    emergency_request = (
        db.query(EmergencyRequest)
        .filter(
            EmergencyRequest.request_id == request_id
        )
        .first()
    )

    if not emergency_request:
        raise HTTPException(
            status_code=404,
            detail="Emergency request not found"
        )

    # Check request status
    if emergency_request.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="This request is already assigned"
        )

    # Find volunteer
    volunteer = (
        db.query(Volunteer)
        .filter(
            Volunteer.volunteer_id == volunteer_id
        )
        .first()
    )

    if not volunteer:
        raise HTTPException(
            status_code=404,
            detail="Volunteer not found"
        )

    # Check availability
    if volunteer.availability_status != "AVAILABLE":
        raise HTTPException(
            status_code=400,
            detail="Volunteer is not available"
        )

    # Create assignment
    assignment = Assignment(
        request_id=request_id,
        volunteer_id=volunteer_id
    )

    db.add(assignment)

    # Update request
    emergency_request.status = "ASSIGNED"

    # Update volunteer
    volunteer.availability_status = "BUSY"

    db.commit()
    db.refresh(assignment)

    # =========================
    # GET AFFECTED PERSON LOCATION
    # =========================

    location = (
        db.query(Location)
        .filter(
            Location.location_id == emergency_request.location_id
        )
        .first()
    )

    # =========================
    # RETURN RESPONSE
    # =========================

    return {
        "message": "Request accepted successfully",
        "request_id": request_id,
        "volunteer_id": volunteer_id,
        "assignment_id": assignment.assignment_id,
        "status": "ASSIGNED",

        "latitude": float(location.latitude) if location else None,
        "longitude": float(location.longitude) if location else None,
        "address": location.address if location else None,
        "city": location.city if location else None
    }

# =====================================================
# GET ALL LOCATIONS
# =====================================================

@app.get("/locations")
def get_locations(
    db: Session = Depends(get_db)
):

    locations = (

        db.query(Location)

        .order_by(
            Location.location_id
        )

        .all()
    )

    return locations

