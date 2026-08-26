from pydantic import BaseModel


class EmergencyRequestCreate(BaseModel):
    user_id: int

    latitude: float
    longitude: float

    request_type: str
    description: str
    severity: int
    people_affected: int