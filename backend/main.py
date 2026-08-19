from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import SessionLocal
from models import EmergencyRequest, Volunteer, Assignment
from schemas import EmergencyRequestCreate
from priority_engine import calculate_priority

app = FastAPI(title="ResQSync API")
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


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {
        "message": "Welcome to ResQSync",
        "status": "Backend is running",
        "database": "MySQL connected"
    }


@app.post("/requests")
def create_request(
    request: EmergencyRequestCreate,
    db: Session = Depends(get_db)
):

    score, priority = calculate_priority(
        request.severity,
        request.people_affected,
        request.request_type
    )

    new_request = EmergencyRequest(
        user_id=request.user_id,
        location_id=request.location_id,
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
        "message": "Emergency request created successfully",
        "request_id": new_request.request_id,
        "priority_score": score,
        "priority": priority
    }

@app.get("/volunteer/requests")
def get_volunteer_requests(db: Session = Depends(get_db)):

    requests = (
        db.query(EmergencyRequest)
        .filter(EmergencyRequest.status == "PENDING")
        .order_by(EmergencyRequest.priority_score.desc())
        .all()
    )

    return requests
@app.post("/volunteer/accept/{request_id}")
def accept_request(
    request_id: int,
    volunteer_id: int,
    db: Session = Depends(get_db)
):
    # Find the emergency request
    emergency_request = (
        db.query(EmergencyRequest)
        .filter(EmergencyRequest.request_id == request_id)
        .first()
    )

    if not emergency_request:
        raise HTTPException(
            status_code=404,
            detail="Emergency request not found"
        )

    # Check if request is still pending
    if emergency_request.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="This request is already assigned"
        )

    # Find the volunteer
    volunteer = (
        db.query(Volunteer)
        .filter(Volunteer.volunteer_id == volunteer_id)
        .first()
    )

    if not volunteer:
        raise HTTPException(
            status_code=404,
            detail="Volunteer not found"
        )

    # Check volunteer availability
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

    # Update statuses
    emergency_request.status = "ASSIGNED"
    volunteer.availability_status = "BUSY"

    db.commit()
    db.refresh(assignment)

    return {
        "message": "Request accepted successfully",
        "request_id": request_id,
        "volunteer_id": volunteer_id,
        "assignment_id": assignment.assignment_id,
        "status": "ASSIGNED"
    }