from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
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
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://resqsync-disaster-response-1.onrender.com"
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

    # =================================================
    # FIND NEAREST AVAILABLE VOLUNTEER
    # =================================================

    volunteers = (
        db.query(Volunteer)
        .filter(
            Volunteer.availability_status == "AVAILABLE"
        )
        .all()
    )

    nearest_volunteer = None
    nearest_distance = float("inf")

    for volunteer in volunteers:

        print(
    "CHECK VOLUNTEER:",
    volunteer.volunteer_id,
    volunteer.availability_status,
    volunteer.location_id
)

        volunteer_location = (
            db.query(Location)
            .filter(
                Location.location_id == volunteer.location_id
            )
            .first()
        )

        if not volunteer_location:
            continue

        # Affected person's coordinates
        lat1 = radians(float(new_location.latitude))
        lon1 = radians(float(new_location.longitude))

        # Volunteer coordinates
        lat2 = radians(float(volunteer_location.latitude))
        lon2 = radians(float(volunteer_location.longitude))

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

        earth_radius_km = 6371

        distance_km = (
            earth_radius_km * c
        )

        if distance_km < nearest_distance:

            nearest_distance = distance_km
            nearest_volunteer = volunteer

    # =================================================
    # ASSIGN NEAREST VOLUNTEER
    # =================================================

    assignment = None

    if nearest_volunteer:

        assignment = Assignment(
            request_id=new_request.request_id,
            volunteer_id=nearest_volunteer.volunteer_id
        )

        db.add(assignment)

        # Mark request as assigned
        new_request.status = "ASSIGNED"

        # Mark volunteer as busy
        nearest_volunteer.availability_status = "BUSY"

        db.commit()
        db.refresh(assignment)

    # =================================================
    # RESPONSE
    # =================================================

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
            priority,

        "status":
            new_request.status,

        "assigned_volunteer_id":
            nearest_volunteer.volunteer_id
            if nearest_volunteer
            else None,

        "distance_km":
            round(nearest_distance, 2)
            if nearest_volunteer
            else None
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
    volunteer_id: int,
    db: Session = Depends(get_db)
):
        

    # =================================================
    # GET VOLUNTEER
    # =================================================

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
    # GET VOLUNTEER LOCATION
    # =================================================

    volunteer_location = (
        db.query(Location)
        .filter(
            Location.location_id == volunteer.location_id
        )
        .first()
    )

    # =================================================
    # GET PENDING REQUESTS
    # =================================================

    requests = (
    db.query(EmergencyRequest)
    .outerjoin(
        Assignment,
        Assignment.request_id == EmergencyRequest.request_id
    )
    .filter(
        or_(
            EmergencyRequest.status == "PENDING",
            Assignment.volunteer_id == volunteer_id
        )
    )
    .order_by(
        EmergencyRequest.priority_score.desc()
    )
    .all()
)

    result = []

    # =================================================
    # CALCULATE DISTANCE
    # =================================================

    for request in requests:

        location = (
            db.query(Location)
            .filter(
                Location.location_id == request.location_id
            )
            .first()
        )

        distance_km = None

        if volunteer_location and location:

            lat1 = radians(float(volunteer_location.latitude))
            lon1 = radians(float(volunteer_location.longitude))

            lat2 = radians(float(location.latitude))
            lon2 = radians(float(location.longitude))

            dlat = lat2 - lat1
            dlon = lon2 - lon1

            a = (
                sin(dlat / 2) ** 2
                +
                cos(lat1)
                * cos(lat2)
                * sin(dlon / 2) ** 2
            )

            c = 2 * atan2(sqrt(a), sqrt(1 - a))

            earth_radius_km = 6371

            distance_km = round(
                earth_radius_km * c,
                2
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
            "latitude":
                float(location.latitude)
                if location else None,

            "longitude":
                float(location.longitude)
                if location else None,

            "address":
                location.address
                if location else None,

            "city":
                location.city
                if location else None,

            # Distance from volunteer
            "distance_km":
                distance_km
        })

    # Sort nearest requests first
    result.sort(
        key=lambda x:
            x["distance_km"]
            if x["distance_km"] is not None
            else float("inf")
    )

    return result


# =====================================================
# VOLUNTEER - ACCEPT REQUEST
# =====================================================


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

